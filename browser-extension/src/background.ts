import browser from "webextension-polyfill"
import { Agent, AgentRuleCondition, AddHeaderRuleAction } from "./scripts/agent"
import { findAgentById, findAllAgents, addAgent } from "./scripts/agent-repository"
import { findSessionByTabId, saveSession, removeSession } from "./scripts/session-repository"
import { saveAgentPrompts } from "./scripts/prompt-repository"
import { TabSession } from "./scripts/session"
import { AuthService } from "./scripts/auth"
import { BrowserMessage, DisplaySidebar, CloseSidebar, ToggleSidebar, ActivateAgent, AgentActivationError, UserMessage } from "./scripts/browser-message"

const createToggleContextMenu = () => {
  browser.contextMenus.create({
    id: "toggle-browser-copilot",
    title: "Browser Copilot",
    contexts: ["all"]
  })
}

const activateAgent = async (agent: Agent, tabId: number, url: string) => {
  if (await findSessionByTabId(tabId)) {
    return
  }
  try {
    let authService = agent.manifest.auth ? new AuthService(agent.manifest.auth) : undefined
    let resp = await agent.createSession(await browser.i18n.getAcceptLanguages(), authService)
    let session = new TabSession(resp.id, tabId, agent, url, authService)
    await saveSession(session)
    await session.activate(url)
    await updateRequestRules(session)
  } catch (e) {
    browser.tabs.sendMessage(tabId, new AgentActivationError(agent.manifest.name, agent.manifest.contactEmail))
  }
}

const updateRequestRules = async (session: TabSession) => {
  if (!session.agent.manifest.onHttpRequest) {
    return
  }
  let lastRuleId = await getLastRuleId()
  let requestRules = session.agent.manifest.onHttpRequest
    .flatMap(r => r.actions
      .filter(a => a.addHeader)
      .map(a => buildModifyHeadersRule(lastRuleId++, r.condition, a.addHeader!, session))
    )
  if (!requestRules) {
    return
  }
  let prevRuleIds = await getTabPreviousRuleIds(session.tabId)
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: prevRuleIds,
    addRules: requestRules
  })
}

const getLastRuleId = async (): Promise<number> => {
  let rules = await browser.declarativeNetRequest.getSessionRules()
  return Math.max(...rules.map(r => r.id))
}

const buildModifyHeadersRule = (ruleId: number, condition: AgentRuleCondition, action: AddHeaderRuleAction, session: TabSession): browser.DeclarativeNetRequest.Rule => ({
  id: ruleId,
  priority: 1,
  action: {
    type: "modifyHeaders",
    requestHeaders: [{
      operation: "set",
      header: action.header,
      value: action.value.replace("${sessionId}", session.id)
    }]
  },
  condition: {
    tabIds: [session.tabId],
    regexFilter: condition.urlRegex,
    requestMethods: condition.requestMethods,
    resourceTypes: condition.resourceTypes as browser.DeclarativeNetRequest.ResourceType[]
  }
})

const getTabPreviousRuleIds = async (tabId: number): Promise<number[]> => {
  let prevRules = await browser.declarativeNetRequest.getSessionRules()
  return prevRules.filter(r => r.condition.tabIds?.includes(tabId)).map(r => r.id)
}

const toggleSidebar = (tabId: number) => {
  browser.tabs.sendMessage(tabId, new ToggleSidebar())
}

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

browser.action.onClicked.addListener((tab, _) => toggleSidebar(tab.id!))

browser.contextMenus.onClicked.addListener((_, tab) => {
  let tabId = tab!.id!
  toggleSidebar(tabId)
})

browser.runtime.onMessage.addListener(async (m: any, sender) => {
  let tabId = sender.tab?.id!
  let msg = BrowserMessage.fromJsonObject(m)
  if (msg instanceof ActivateAgent) {
    let agent = await findAgentById(msg.agentId)
    await activateAgent(agent!, tabId, sender.url!)
  } else if (msg instanceof DisplaySidebar) {
    toggleSidebar(tabId)
  } else if (msg instanceof CloseSidebar) {
    toggleSidebar(tabId)
  } else if (msg instanceof UserMessage) {
    let session = (await findSessionByTabId(tabId))!
    await session.processUserMessage(msg.text, msg.file)
  }
})

browser.webRequest.onCompleted.addListener(async (req) => {
  let tabId = req.tabId
  if (req.initiator?.startsWith("chrome-extension://")) {
    return
  }
  let session = await findSessionByTabId(tabId)
  if (session) {
    await session.processInteraction(req)
  } else {
    let agents = await findAllAgents()
    for (const a of agents) {
      if (a.activatesOn(req)) {
        await activateAgent(a, req.tabId, req.url)
      }
    }
  }
}, { urls: ["http://*/*", "https://*/*"] })

browser.tabs.onRemoved.addListener(async (tabId) => {
  let prevRuleIds = await getTabPreviousRuleIds(tabId)
  browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: prevRuleIds })
  let session = await findSessionByTabId(tabId)
  if (session) {
    await removeSession(session)
    try {
      session.close()
    } catch (e) {
      // here we can't provide a toast as we do in activation since tab is closed and there is no content where toast can be shown
      console.error(`Problem closing session. Please contact support at ${session.agent.manifest.contactEmail} with the details.`, e)
    }
  }
})
