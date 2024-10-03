import browser from "webextension-polyfill";
import { Agent, RequestEvent, RequestEventType } from "./scripts/agent";
import { findAllAgents, addAgent, findAgentById, } from "./scripts/agent-repository";
import { AgentSession } from "./scripts/agent-session";
import { findAgentSession, saveAgentSession, removeAgentSession, } from "./scripts/agent-session-repository";
import { saveAgentPrompts } from "./scripts/prompt-repository";
import { BrowserMessage, ToggleSidebar, ActiveTabListener, ActivateAgent, AgentActivation, InteractionSummary, } from "./scripts/browser-message";
import { HttpServiceError } from "./scripts/http";
import { isActiveTabListener, setTabListenerActive, removeTabListenerStatus, } from "./scripts/tab-listener-status-repository";
import { removeTabState } from "./scripts/tab-state-repository";

let pendingMessages: Map<number, BrowserMessage[]>;
let pendingRequests: Map<number, RequestEvent[]>;

browser.runtime.onInstalled.addListener(async () => {
  createToggleContextMenu();
  if (import.meta.env.DEV) {
    try {
      const agent = await Agent.fromUrl("http://localhost:8000");
      await addAgent(agent);
      await saveAgentPrompts(agent.manifest.prompts, agent.manifest.id);
    } catch (e) {
      console.error("Problem adding dev agent", e);
    }
  }
});

const createToggleContextMenu = () => {
  browser.contextMenus.create({
    id: "toggle-browser-copilot",
    title: "Browser Copilot",
    contexts: ["all"],
  });
};

browser.action.onClicked.addListener((tab, _) => toggleSidebar(tab.id!));

const toggleSidebar = (tabId: number) => {
  sendToTab(tabId, new ToggleSidebar());
};

const sendToTab = async (tabId: number, msg: BrowserMessage) => {
  // here we check for both the state of listener and pendingMessages since:
  // 1- if we only check for isActiveTabListener, isActiveTabListener may return false even after activateTabListener sets it to true. Eg, when starting a tab (since it may activate an agent while Index.vue component is mounting):
  //    1.1 webRequest.onCompleted invokes this method to activate an agent, and execution of service worker thread (SWT) suspends when calling await, internally it resolves the value to false but does not yet unsuspends the thread
  //    1.2 Index.vue component is mounted and sends ReadyForMessages message which is processed by SWT and suspends when calling the await to update tab listener status but unsuspends right afterwards, sends pending messages to Index.vue and resets pending messages
  //    1.3 the webRequest.onCompleted method resumes and adds the message to pendingMessages that is never sent to the Index.vue since the ReadyForMessages message has already been processed.
  // 2- if we only check for pendingMessages it may be null since service worker may have suspendend and does not maintain status while resumed (https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle#idle-shutdown).
  // But we can use both of them since we can use pendingMessages for short periods of time (service worker suspends after some time), and such concurrency conditions as the one described above are short lived.
  const isActiveListener = await isActiveTabListener(tabId);
  if (isActiveListener || pendingMessages?.get(tabId)?.length === 0) {
    browser.tabs.sendMessage(tabId, msg);
  } else {
    getTabPendingMessages(tabId).push(msg);
  }
};

const getTabPendingMessages = (tabId: number): BrowserMessage[] => {
  if (!pendingMessages) {
    pendingMessages = new Map();
  }
  let ret = pendingMessages.get(tabId);
  if (!ret) {
    ret = [];
    pendingMessages.set(tabId, ret);
  }
  return ret;
};

browser.contextMenus.onClicked.addListener((_, tab) => toggleSidebar(tab!.id!));

browser.runtime.onMessage.addListener(
  async (m: any, sender: browser.Runtime.MessageSender): Promise<any> => {
    const tabId = sender.tab?.id!;
    const msg = BrowserMessage.fromJsonObject(m);
    if (msg instanceof ActiveTabListener) {
      return await activateTabListener(tabId, msg.active);
    } else if (msg instanceof ActivateAgent) {
      const agent = await findAgentById(msg.agentId);
      await activateAgent(tabId, agent!, msg.url);
    }
  }
);

const activateTabListener = async (tabId: number, active: boolean) => {
  await setTabListenerActive(tabId, active);
  if (active) {
    const ret = getTabPendingMessages(tabId);
    pendingMessages.set(tabId, []);
    return ret;
  } else {
    pendingMessages?.delete(tabId);
  }
};

const activateAgent = async (tabId: number, agent: Agent, url: string) => {
  const session = new AgentSession(tabId, agent, url);
  let success = true;
  try {
    await session.activate((msg) => sendToTab(tabId, msg));
    await saveAgentSession(session);
  } catch (e) {
    // exceptions from http methods are already logged so no need to handle them
    success = false;
  }
  sendToTab(tabId, new AgentActivation(agent, success));
};

browser.webRequest.onBeforeRequest.addListener(
  (req) => processRequest(new RequestEvent(RequestEventType.OnBeforeRequest, req)),
  { urls: ["http://*/*", "https://*/*"] },
  ["requestBody"]
);

browser.webRequest.onCompleted.addListener(
  (req) => processRequest(new RequestEvent(RequestEventType.OnCompleted, req)),
  { urls: ["http://*/*", "https://*/*"] }
);

function processRequest(req: RequestEvent) {
  /* 
    this logic of enqueuing requests and processing in one call simplifies the rest of the logic
    to avoid for example reactivating an agent that is already activating due to async execution of methods. 
    In essence we want to only process one request at a time.
    */
    const tabId = req.details.tabId;
    const tabRequests = getTabPendingRequests(tabId);
    if (!tabRequests.length) {
      tabRequests.push(req);
      asyncProcessRequests(tabId);
    } else {
      tabRequests.push(req);
    }
}

function getTabPendingRequests(tabId: number): RequestEvent[] {
  if (!pendingRequests) {
    pendingRequests = new Map();
  }
  let ret = pendingRequests.get(tabId);
  if (!ret) {
    ret = [];
    pendingRequests.set(tabId, ret);
  }
  return ret;
}

async function asyncProcessRequests(tabId: number) {
  const tabRequests = getTabPendingRequests(tabId);
  while (tabRequests.length) {
    try {
      await asyncProcessRequest(tabRequests[0])
    } finally {
      // shift needs to be done after asyncProcessRequest to avoid processing requests concurrently due to condition cheking in processRequest
      tabRequests.shift()
    }
  }
}

async function asyncProcessRequest(req: RequestEvent) {
  const tabId = req.details.tabId;
  if (req.details.initiator?.startsWith("chrome-extension://")) {
    return;
  }
  const session = await findAgentSession(tabId);
  if (session) {
    try {
      const summary = await session.processInteraction(req);
      if (summary) {
        sendToTab(tabId, new InteractionSummary(true, summary));
      }
    } catch (e) {
      // exceptions from http methods are already logged so no need to handle them
      sendToTab(
        tabId,
        new InteractionSummary(
          false,
          e instanceof HttpServiceError ? e.detail : undefined
        )
      );
    }
  } else {
    const agents = await findAllAgents();
    for (const a of agents) {
      if (a.activatesOn(req)) {
        await activateAgent(tabId, a, req.details.url);
      }
    }
  }
}

browser.tabs.onRemoved.addListener(async (tabId) => {
  await removeTabListenerStatus(tabId);
  pendingMessages?.delete(tabId);
  await removeTabState(tabId);
  const session = await findAgentSession(tabId);
  if (session) {
    await removeAgentSession(tabId);
    await session.close();
  }
});
