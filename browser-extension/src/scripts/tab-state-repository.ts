import browser from "webextension-polyfill"
import { TabState } from "./tab-state"

export const findTabState = async (tabId: number): Promise<TabState | undefined> => {
  let key = buildTabKey(tabId)
  let ret = await browser.storage.session.get(key)
  return ret[key] ? TabState.fromJsonObject(ret[key]) : undefined
}

const buildTabKey = (tabId: number): string => "tabState-" + tabId

export const saveTabState = async (tabId: number, state: TabState) => {
  let rec: Record<string, any> = {}
  rec[buildTabKey(tabId)] = state
  await browser.storage.session.set(rec)
}

export const removeTabState = async (tabId: number) => {
  await browser.storage.session.remove(buildTabKey(tabId))
}
