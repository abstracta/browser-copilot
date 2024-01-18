import browser from "webextension-polyfill"
import { Agent } from "./scripts/agent"
import { findAllAgents, addAgent, findAgentById } from "./scripts/agent-repository"
import { AgentSession } from "./scripts/agent-session"
import { findAgentSession, saveAgentSession, removeAgentSession } from "./scripts/agent-session-repository"
import { saveAgentPrompts } from "./scripts/prompt-repository"
import { BrowserMessage, ToggleSidebar, ActiveTabListener, ActivateAgent } from "./scripts/browser-message"
import { isActiveTabListener, setTabListenerActive, removeTabListenerStatus } from "./scripts/tab-listener-status-repository"
import { removeTabState } from "./scripts/tab-state-repository"

let pendingMessages: Map<number, BrowserMessage[]>

browser.runtime.onInstalled.addListener(async () => {
  createToggleContextMenu()
  if (import.meta.env.DEV) {
    try {
      let agent = await Agent.fromUrl("http://localhost:8000")
      await addAgent(agent)
      await saveAgentPrompts(agent.manifest.prompts, agent.manifest.id)
    } catch (e) {
      console.error("Problem adding dev agent", e)
    }
  }
})

const createToggleContextMenu = () => {
  browser.contextMenus.create({
    id: "toggle-browser-copilot",
    title: "Browser Copilot",
    contexts: ["all"]
  })
}

browser.action.onClicked.addListener((tab, _) => toggleSidebar(tab.id!))

const toggleSidebar = (tabId: number) => {
  sendToTab(tabId, new ToggleSidebar())
}

const sendToTab = async (tabId: number, msg: BrowserMessage) => {
  // here we check for both the state of listener and pendingMessages since:
  // 1- if we only check for isActiveTabListener, isActiveTabListener may return false even after activateTabListener sets it to true. Eg, when starting a tab (since it may activate an agent while Index.vue component is mounting): 
  //    1.1 webRequest.onCompleted invokes this method to activate an agent, and execution of service worker thread (SWT) suspends when calling await, internally it resolves the value to false but does not yet unsuspends the thread
  //    1.2 Index.vue component is mounted and sends ReadyForMessages message which is processed by SWT and suspends when calling the await to update tab listener status but unsuspends right afterwards, sends pending messages to Index.vue and resets pending messages
  //    1.3 the webRequest.onCompleted method resumes and adds the message to pendingMessages that is never sent to the Index.vue since the ReadyForMessages message has already been processed.
  // 2- if we only check for pendingMessages it may be null since service worker may have suspendend and does not maintain status while resumed (https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle#idle-shutdown).
  // But we can use both of them since we can use pendingMessages for short periods of time (service worker suspends after some time), and such concurrency conditions as the one described above are short lived.
  let isActiveListener = await isActiveTabListener(tabId)
  if (isActiveListener || pendingMessages?.get(tabId)?.length === 0) {
    browser.tabs.sendMessage(tabId, msg)
  } else {
    getTabPendingMessages(tabId).push(msg)
  }
}

const getTabPendingMessages = (tabId: number): BrowserMessage[] => {
  if (!pendingMessages) {
    pendingMessages = new Map()
  }
  let ret = pendingMessages.get(tabId)
  if (!ret) {
    ret = []
    pendingMessages.set(tabId, ret)
  }
  return ret
}

browser.contextMenus.onClicked.addListener((_, tab) => toggleSidebar(tab!.id!))

browser.runtime.onMessage.addListener(async (m: any, sender: browser.Runtime.MessageSender): Promise<any> => {
  let tabId = sender.tab?.id!
  let msg = BrowserMessage.fromJsonObject(m)
  if (msg instanceof ActiveTabListener) {
    return await activateTabListener(tabId, msg.active)
  } else if (msg instanceof ActivateAgent) {
    let agent = await findAgentById(msg.agentId)
    await activateAgent(tabId, agent!, msg.url)
  }
})

const activateTabListener = async (tabId: number, active: boolean) => {
  await setTabListenerActive(tabId, active)
  if (active) {
    let ret = getTabPendingMessages(tabId)
    pendingMessages.set(tabId, [])
    return ret
  } else {
    pendingMessages?.delete(tabId)
  }
}

const activateAgent = async (tabId: number, agent: Agent, url: string) => {
  let session = new AgentSession(tabId, agent, url)
  await session.activate((msg: BrowserMessage) => sendToTab(tabId, msg))
  await saveAgentSession(session)
}

browser.webRequest.onCompleted.addListener(async (req) => {
  let tabId = req.tabId
  if (req.initiator?.startsWith("chrome-extension://")) {
    return
  }
  let session = await findAgentSession(tabId)
  if (session) {
    await session.processInteraction(req, (msg: BrowserMessage) => sendToTab(tabId, msg))
  } else {
    let agents = await findAllAgents()
    for (const a of agents) {
      if (a.activatesOn(req)) {
        await activateAgent(tabId, a, req.url)
      }
    }
  }
}, { urls: ["http://*/*", "https://*/*"] })

browser.tabs.onRemoved.addListener(async (tabId) => {
  //TODO clear tabState
  await removeTabListenerStatus(tabId)
  pendingMessages?.delete(tabId)
  await removeTabState(tabId)
  let session = await findAgentSession(tabId)
  if (session) {
    await removeAgentSession(tabId)
    await session.close()
  }
})
