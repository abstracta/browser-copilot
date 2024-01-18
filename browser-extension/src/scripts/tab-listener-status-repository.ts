import browser from "webextension-polyfill"

export const isActiveTabListener = async (tabId: number): Promise<boolean | undefined> => {
  let key = buildTabKey(tabId)
  const rec = await browser.storage.session.get(key)
  return rec[key]
}

const buildTabKey = (tabId: number): string => "activeTabListener-" + tabId

export const setTabListenerActive = async (tabId: number, active: boolean) => {
  let rec: Record<string, any> = {}
  rec[buildTabKey(tabId)] = active
  await browser.storage.session.set(rec)
}

export const removeTabListenerStatus = async (tabId: number) => {
  await browser.storage.session.remove(buildTabKey(tabId))
}
