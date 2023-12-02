import browser from "webextension-polyfill"
import { TabSession } from "./session"


export const findSessionByTabId = async (tabId: number): Promise<TabSession | undefined> => {
  let sessions = await getAllSessions()
  let ret = sessions[tabId]
  return ret ? TabSession.fromJsonObject(ret) : undefined
}

const getAllSessions = async () => {
  const { sessions } = await browser.storage.local.get("sessions")
  return sessions || {}
}

export const saveSession = async (session: TabSession) => {
  let sessions = await getAllSessions()
  sessions[session.tabId] = session
  updateSessions(sessions)
}

const updateSessions = async (sessions: any) => {
  await browser.storage.local.set({ sessions: sessions })
}

export const removeSession = async (session: TabSession) => {
  let sessions = await getAllSessions()
  delete sessions[session.tabId]
  updateSessions(sessions)
}
