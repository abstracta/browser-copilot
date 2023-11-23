import browser from "webextension-polyfill"

export class Prompt {
  name: string
  text: string

  constructor(name: string, text: string) {
    this.name = name
    this.text = text
  }
}

interface PromptRepo {
  [key: string]: Prompt[]
}

export const saveAgentPrompts = async (agentPrompts: Prompt[] | undefined, agentId: string) => {
  if (!agentPrompts) {
    return
  }
  let userPrompts = await getPrompts(agentId)
  if (userPrompts.length == 0) {
    for (let p of agentPrompts) {
      await savePrompt(p, agentId)
    }
  }
}

export const removeAgentPrompts = async (agentId: string) => {
  let prompts = await getAllPrompts()
  delete prompts[agentId]
  await updatePrompts(prompts)
}

export const savePrompt = async (p: Prompt, agentId: string) => {
  let prompts = await getAllPrompts()
  let agentPrompts = prompts[agentId] || []
  agentPrompts = agentPrompts.filter(p2 => p2.name !== p.name)
  agentPrompts.push(p)
  prompts[agentId] = agentPrompts.sort((p1, p2) => p1.name < p2.name ? -1 : 1)
  await updatePrompts(prompts)
}

export const getPrompts = async (agentId: string): Promise<Prompt[]> => {
  let prompts = await getAllPrompts()
  return prompts[agentId] || []
}

const getAllPrompts = async (): Promise<PromptRepo> => {
  const { prompts } = await browser.storage.local.get("prompts")
  return prompts || {}
}

const updatePrompts = async (prompts: PromptRepo) => {
  await browser.storage.local.set({ prompts: prompts })
}

export const deletePrompt = async (name: string, agentId: string) => {
  let prompts = await getAllPrompts()
  let agentPrompts = prompts[agentId] || []
  agentPrompts = agentPrompts.filter(p => p.name !== name)
  prompts[agentId] = agentPrompts.sort((p1, p2) => p1.name < p2.name ? -1 : 1)
  await updatePrompts(prompts)
}