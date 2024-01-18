import browser from "webextension-polyfill"
import { AgentSession } from "./agent-session"

export const findAgentSession = async (tabId: number): Promise<AgentSession | undefined> => {
  let key = buildTabKey(tabId)
  let rec = await browser.storage.session.get(key)
  return rec[key] ? AgentSession.fromJsonObject(rec[key]) : undefined
}

const buildTabKey = (tabId: number): string => "agentSession-" + tabId

export const saveAgentSession = async (session: AgentSession) => {
  let rec: Record<string, any> = {}
  rec[buildTabKey(session.tabId)] = session
  await browser.storage.session.set(rec)
}

export const removeAgentSession = async (tabId: number) => {
  await browser.storage.session.remove(buildTabKey(tabId))
}
