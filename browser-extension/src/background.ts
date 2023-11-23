import browser from "webextension-polyfill"
import { Agent, AgentRuleCondition, AddHeaderRuleAction } from "./scripts/agent"
import { findAgentById, findAllAgents, addAgent } from "./scripts/agent-repository"
import { saveAgentPrompts } from "./scripts/prompt-repository"
import { TabSession } from "./scripts/session"

let lastRuleId = 0
let tabPort: Map<number, browser.Runtime.Port> = new Map()
let sessions: Map<number, TabSession> = new Map()
let activeTabs: Set<number> = new Set()

const createToggleContextMenu = () => {
  browser.contextMenus.create({
    id: "toggle-browser-copilot",
    title: "Toggle Browser Copilot",
    contexts: ["all"]
  })
}

const activateAgent = async (agent: Agent, tabId: number, url: string) => {
  if (sessions.has(tabId)) {
    return
  }
  let resp = await agent.createSession(await browser.i18n.getAcceptLanguages())
  let session = new TabSession(resp.id, agent, tabId, url, tabPort.get(tabId)!)
  sessions.set(tabId, session)
  await updateRequestRules(session)
  await session.activate(url)
}

const updateRequestRules = async (session: TabSession) => {
  if (!session.agent.manifest.onHttpRequest) {
    return
  }
  let requestRules = session.agent.manifest.onHttpRequest
    .flatMap(r => r.actions
      .filter(a => a.addHeader)
      .map(a => buildModifyHeadersRule(r.condition, a.addHeader!, session))
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

const buildModifyHeadersRule = (condition: AgentRuleCondition, action: AddHeaderRuleAction, session: TabSession): browser.DeclarativeNetRequest.Rule => ({
  id: lastRuleId++,
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

const onPopupMessage = async (msg: any, tabId: number, port: browser.Runtime.Port) => {
  if (msg.type === "activateAgent") {
    let agent = await findAgentById(msg.agentId)
    activateAgent(agent!, tabId, port.sender!.url!)
  } else if (msg.type === "activated") {
    if (!activeTabs.has(tabId)) {
      toggleSidebar(tabId)
    }
  } else if (msg.type === "closeSidebar") {
    toggleSidebar(tabId)
  }
}

const toggleSidebar = (tabId: number) => {
  if (activeTabs.has(tabId)) {
    activeTabs.delete(tabId)
  } else {
    activeTabs.add(tabId)
  }
  browser.tabs.sendMessage(tabId, { type: "sidebar-toggle" })
}

browser.runtime.onInstalled.addListener(async () => {
  console.log("INSTALL " + new Date().toISOString())
  createToggleContextMenu()
  if (import.meta.env.DEV) {
    let agent = await Agent.fromUrl("http://localhost:8000")
    await addAgent(agent)
    await saveAgentPrompts(agent.manifest.prompts, agent.manifest.id)
  }
})

browser.runtime.onConnect.addListener(async (port) => {
  let tabId = port.sender?.tab?.id!
  tabPort.set(tabId, port)
  port.onMessage.addListener(async (msg: any, _) => {
    console.log("BG PORT MSG " + new Date().toISOString())
    onPopupMessage(msg, tabId, port)
  })
  port.onDisconnect.addListener(() => {
    console.log("BG DISCONNECT " + new Date().toISOString())
    tabPort.delete(tabId)
    activeTabs.delete(tabId)
  })
})

browser.action.onClicked.addListener((tab, _) => toggleSidebar(tab.id!))

browser.contextMenus.onClicked.addListener((_, tab) => {
  console.log("TOGGLE " + new Date().toISOString())
  toggleSidebar(tab!.id!);
})

browser.webRequest.onCompleted.addListener(async (req) => {
  console.log("REQ " + new Date().toISOString())
  if (req.initiator?.startsWith("chrome-extension://")) {
    return
  }
  let tabId = req.tabId
  let session = sessions.get(tabId)
  if (session) {
    session.processInteraction(req)
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
  await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: prevRuleIds });
  tabPort.delete(tabId)
  let session = sessions.get(tabId)
  if (session) {
    session.close()
  }
  sessions.delete(tabId)
})
