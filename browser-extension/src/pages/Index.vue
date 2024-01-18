<script lang="ts" setup>
import { ref, onBeforeMount, onBeforeUnmount, toRaw } from 'vue'
import browser from "webextension-polyfill"
import { useToast } from "vue-toastification"
import { useI18n } from 'vue-i18n'
import { BrowserMessage, ActiveTabListener, ToggleSidebar, ActivateAgent, AgentActivation, InteractionSummary, ResizeSidebar } from "../scripts/browser-message"
import { Agent } from "../scripts/agent"
import { TabState, ChatMessage } from "../scripts/tab-state"
import { findTabState, saveTabState } from "../scripts/tab-state-repository"
import { findAgentSession } from '../scripts/agent-session-repository'
import CopilotChat from "../components/CopilotChat.vue"
import CopilotList from "../components/CopilotList.vue"
import ToastMessage from "../components/ToastMessage.vue"

const toast = useToast()
const { t } = useI18n()

const agent = ref<Agent>()
let sidebarSize = 400
let displaying = false
const minSidebarSize = 200
let lastResizePos = 0
const messages = ref<ChatMessage[]>([])

onBeforeMount(async () => {
  await restoreTabState()
  // we collect messages until we get all pending to avoid potential message order.
  // This may happen if listener is up, sends ActivateTabListener and while message 
  // is being processed (and pending messages collected and returned) the service worker sends messages for processing here
  let collectedMessages: any[] | undefined = []
  browser.runtime.onMessage.addListener((m: any) => {
    if (collectedMessages === undefined) {
      onMessage(m)
    } else {
      collectedMessages.push(m)
    }
  })
  let pendingMessages: any = await sendToServiceWorker(new ActiveTabListener(true))
  for (const m of pendingMessages) {
    onMessage(m)
  }
  for (const m of collectedMessages) {
    onMessage(m)
  }
  collectedMessages = undefined
})

const restoreTabState = async () => {
  let tabId = await getCurrentTabId()
  let tabState = await findTabState(tabId)
  if (tabState) {
    sidebarSize = tabState.sidebarSize
    displaying = tabState.displaying
    agent.value = tabState.agent
    messages.value = tabState.messages
  }
  if (displaying) {
    resizeSidebar(sidebarSize)
  }
}

const sendToServiceWorker = async (msg: BrowserMessage): Promise<any> => {
  return await browser.runtime.sendMessage(msg)
}

onBeforeUnmount(async () => {
  let tabId = await getCurrentTabId()
  await saveTabState(tabId, new TabState(sidebarSize, displaying, toRaw(messages.value), toRaw(agent.value)))
  // wait for message processing so we are sure that before loading new content this has been marked as not ready for messages
  await sendToServiceWorker(new ActiveTabListener(false))
})

const onMessage = (m: any) => {
  let msg = BrowserMessage.fromJsonObject(m)
  if (msg instanceof ToggleSidebar) {
    onToggleSidebar()
  } else if (msg instanceof AgentActivation) {
    onAgentActivation(msg)
  } else if (msg instanceof InteractionSummary) {
    onInteractionSummary(msg)
  }
}

const onToggleSidebar = () => {
  displaying = !displaying
  resizeSidebar(displaying ? sidebarSize : 0)
}

const resizeSidebar = async (size: number) => {
  browser.tabs.sendMessage(await getCurrentTabId(), new ResizeSidebar(size))
}

const getCurrentTabId = async (): Promise<number> => {
  let ret = await browser.tabs.getCurrent()
  return ret.id!
}


const onStartResize = (e: MouseEvent) => {
  lastResizePos = e.screenX
  window.document.body.className = "resizing"
  window.addEventListener("mousemove", onResize)
  window.addEventListener("mouseup", onEndResize)
}

const onResize = async (e: MouseEvent) => {
  e.preventDefault()
  let delta = lastResizePos - e.screenX
  lastResizePos = e.screenX
  sidebarSize += delta
  if (sidebarSize < minSidebarSize) {
    sidebarSize = minSidebarSize
  }
  resizeSidebar(sidebarSize)
}

const onEndResize = () => {
  window.document.body.className = ""
  window.removeEventListener("mousemove", onResize)
  window.removeEventListener("mouseup", onEndResize)
}

const onCloseSidebar = () => {
  displaying = false
  resizeSidebar(0)
}

const onActivateAgent = async (agentId: string) => {
  let tab = await browser.tabs.getCurrent()
  sendToServiceWorker(new ActivateAgent(agentId, tab.url!))
}

const onAgentActivation = (msg: AgentActivation) => {
  if (!displaying) {
    onToggleSidebar()
  }
  if (!msg.success) {
    let text = t('activationError', { agentName: msg.agent.manifest.name, contactEmail: msg.agent.manifest.contactEmail })
    toast.error({ component: ToastMessage, props: { message: text } })
  } else {
    agent.value = Agent.fromJsonObject(msg.agent)
    messages.value.push(ChatMessage.agentMessage(agent.value.manifest.welcomeMessage))
  }
}

const onInteractionSummary = (msg: InteractionSummary) => {
  let text = msg.text ? msg.text : t("interactionSummaryError", { contactEmail: agent.value!.manifest.contactEmail })
  let lastMessage = messages.value[messages.value.length - 1]
  let messagePosition = lastMessage.isComplete ? messages.value.length : messages.value.length - 1
  messages.value.splice(messagePosition, 0, ChatMessage.agentMessage(text))
}

const onUserMessage = async (text: string, file: Record<string, string>) => {
  messages.value.push(ChatMessage.userMessage(text, file))
  messages.value.push(ChatMessage.agentMessage())
  let agentSession = await findAgentSession(await getCurrentTabId())
  agentSession!.processUserMessage(text, file, onAgentResponse)
}

const onAgentResponse = (text: string, complete: boolean, success: boolean) => {
  let lastMessage = messages.value[messages.value.length - 1]
  if (!success) {
    text = text ? text : t("agentAnswerError", { contactEmail: agent.value!.manifest.contactEmail })
    lastMessage.isComplete = true
    if (!lastMessage.text) {
      lastMessage.text += text
    } else {
      messages.value.push(ChatMessage.agentMessage(text))
    }
  } else {
    lastMessage.isComplete = complete
    lastMessage.text += text
  }
}
</script>

<template>
  <div
    class="fixed flex flex-col left-[-10px] w-full h-[var(--sidebar-height)] justify-left m-[var(--spacing)] border-[.1px] border-slate-500 bg-[var(--background-color)] rounded-tl-[var(--top-round-corner)] rounded-bl-[var(--bottom-round-corner)]"
    id="sidebar">
    <div class="absolute left-0 z-[1000] cursor-ew-resize w-[var(--spacing)] h-full" @mousedown="onStartResize" />
    <CopilotChat v-if="agent" :messages="messages" :agent-id="agent.manifest.id" :agent-name="agent.manifest.name"
      :agent-logo="agent.logo" :agent-capabilities="agent.manifest.capabilities || []" @userMessage="onUserMessage"
      @close="onCloseSidebar" />
    <CopilotList v-if="!agent" @activateAgent="onActivateAgent" @close="onCloseSidebar" />
  </div>
</template>

<style scoped>
#sidebar ::-webkit-scrollbar {
  width: 7px;
  background-color: #ccc;
  border-radius: 3px;
}

#sidebar ::-webkit-scrollbar-thumb {
  background-color: var(--accent-color);
  border-radius: 3px;
}

#sidebar ::-webkit-scrollbar-thumb:hover {
  background-color: var(--accent-color);
}
</style>

<i18n>
{
  "en": {
    "activationError": "Cound not activate {agentName} Copilot. You can try again and if the issue persists then contact [{agentName} Copilot support](mailto:{contactEmail}?subject=Activation%20issue)",
    "interactionSummaryError": "I could not process some information from the current site. This might impact the information and answers I provide. If the issue persists please contact [support](mailto:{contactEmail}?subject=Interaction%20issue)",
    "agentAnswerError": "I am currently unable to complete your request. You can try again and if the issue persists contact [support](mailto:{contactEmail}?subject=Question%20issue)"
  },
  "es": {
    "activationError": "No se pudo activar el Copiloto {agentName}. Puedes intentar de nuevo y si el problema persiste contactar al [soporte del Copiloto {agentName}](mailto:{contactEmail}?subject=Activation%20issue)",
    "interactionSummaryError": "No pude procesar informacion generada por la página actual. Esto puede impactar en la información y respuestas que te puedo dar. Si el problema persiste por favor contacta a [soporte](mailto:{contactEmail})?subject=Interaction%20issue",
    "agentAnswerError": "Ahora no puedo completar tu pedido. Puedes intentar de nuevo y si el problema persiste contactar a [soporte](mailto:{contactEmail}?subject=Question%20issue)"
  }
}
</i18n>
