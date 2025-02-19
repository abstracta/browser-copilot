<script lang="ts" setup>
import { ref, onBeforeMount, onBeforeUnmount, toRaw } from 'vue'
import browser from 'webextension-polyfill'
import { useToast } from 'vue-toastification'
import { AlertCircleFilledIcon } from 'vue-tabler-icons'
import { useI18n } from 'vue-i18n'
import { BrowserMessage, ActiveTabListener, ToggleSidebar, ActivateAgent, AgentActivation, InteractionSummary, ResizeSidebar } from '../scripts/browser-message'
import { Agent } from '../scripts/agent'
import { TabState, ChatMessage } from '../scripts/tab-state'
import { findTabState, saveTabState } from '../scripts/tab-state-repository'
import { findAgentSession } from '../scripts/agent-session-repository'
import { FlowStepError } from '../scripts/flow'
import CopilotChat from '../components/CopilotChat.vue'
import CopilotList from '../components/CopilotList.vue'
import ToastMessage from '../components/ToastMessage.vue'
import { HttpServiceError } from "../scripts/http"

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
  const pendingMessages: any = await sendToServiceWorker(new ActiveTabListener(true))
  for (const m of pendingMessages) {
    onMessage(m)
  }
  for (const m of collectedMessages) {
    onMessage(m)
  }
  collectedMessages = undefined
  await resumeFlow()
})

const restoreTabState = async () => {
  const tabId = await getCurrentTabId()
  const tabState = await findTabState(tabId)
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

const resumeFlow = async () => {
  const agentSession = await findAgentSession(await getCurrentTabId())
  await agentSession?.resumeFlow(onAgentResponse, onAgentError)
}

onBeforeUnmount(async () => {
  const tabId = await getCurrentTabId()
  await saveTabState(tabId, new TabState(sidebarSize, displaying, toRaw(messages.value), toRaw(agent.value)))
  // wait for message processing so we are sure that before loading new content this has been marked as not ready for messages
  await sendToServiceWorker(new ActiveTabListener(false))
})

const onMessage = (m: any) => {
  const msg = BrowserMessage.fromJsonObject(m)
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
  const ret = await browser.tabs.getCurrent()
  return ret.id!
}

const onStartResize = (e: MouseEvent) => {
  lastResizePos = e.screenX
  window.document.body.className = 'resizing'
  window.addEventListener('mousemove', onResize)
  window.addEventListener('mouseup', onEndResize)
}

const onResize = async (e: MouseEvent) => {
  e.preventDefault()
  const delta = lastResizePos - e.screenX
  lastResizePos = e.screenX
  sidebarSize += delta
  if (sidebarSize < minSidebarSize) {
    sidebarSize = minSidebarSize
  }
  resizeSidebar(sidebarSize)
}

const onEndResize = () => {
  window.document.body.className = ''
  window.removeEventListener('mousemove', onResize)
  window.removeEventListener('mouseup', onEndResize)
}

const onCloseSidebar = () => {
  displaying = false
  resizeSidebar(0)
}

const onActivateAgent = async (agentId: string) => {
  const tab = await browser.tabs.getCurrent()
  sendToServiceWorker(new ActivateAgent(agentId, tab.url!))
}

const onAgentActivation = (msg: AgentActivation) => {
  if (!displaying) {
    onToggleSidebar()
  }
  if (!msg.success) {
    const text = t('activationError', { agentName: msg.agent.manifest.name, contactEmail: msg.agent.manifest.contactEmail })
    toast.error({ component: ToastMessage, props: { message: text } }, { icon: AlertCircleFilledIcon })
  } else {
    agent.value = Agent.fromJsonObject(msg.agent)
    messages.value.push(ChatMessage.agentMessage(agent.value.manifest.welcomeMessage))
  }
}

const onInteractionSummary = (msg: InteractionSummary) => {
  const text = msg.text ? msg.text : t('interactionSummaryError', { contactEmail: agent.value!.manifest.contactEmail })
  const lastMessage = messages.value[messages.value.length - 1]
  const messagePosition = lastMessage.isComplete ? messages.value.length : messages.value.length - 1
  messages.value.splice(messagePosition, 0, msg.success ? ChatMessage.agentMessage(text) : ChatMessage.agentErrorMessage(text))
}

const onUserMessage = async (text: string, file: Record<string, string>) => {
  messages.value.push(ChatMessage.userMessage(text, file))
  messages.value.push(ChatMessage.agentMessage())
  const agentSession = await findAgentSession(await getCurrentTabId())
  agentSession!.processUserMessage(text, file, onAgentResponse, onAgentError)
}

const onAgentResponse = (text: string, complete: boolean) => {
  const lastMessage = messages.value[messages.value.length - 1]
  lastMessage.isComplete = complete
  lastMessage.text += text
}

const onAgentError = (error: any) => {
  // exceptions from http methods are already logged so no need to handle them
  if (!(error instanceof HttpServiceError)) {
    console.warn("Problem processing agent answer", error)
  }
  let text = null
  if (error instanceof HttpServiceError && error.detail) {
    text = error.detail
  } else if (error instanceof FlowStepError && error.errorCode === 'MissingElement') {
    text = t("flowStep" + error.errorCode, { selector: error.step.selector, contactEmail: agent.value!.manifest.contactEmail })
  } else {
    text = t('agentAnswerError', { contactEmail: agent.value!.manifest.contactEmail })
  }
  const lastMessage = messages.value[messages.value.length - 1]
  lastMessage.isComplete = true
  if (!lastMessage.text) {
    lastMessage.text += text
    lastMessage.isSuccess = false
  } else {
    messages.value.push(ChatMessage.agentErrorMessage(text))
  }
}
</script>

<template>
  <div
    class="fixed flex flex-col -left-2 m-2 w-full h-[calc(100%_-_16px)] justify-left border border-gray-300 bg-white rounded-tl-3xl rounded-bl-3xl"
    id="sidebar">
    <div class="absolute left-0 z-auto cursor-ew-resize w-2 h-full" @mousedown="onStartResize" />
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
    "activationError": "Could not activate {agentName} Copilot. You can try again and if the issue persists then contact [{agentName} Copilot support](mailto:{contactEmail}?subject=Activation%20issue)",
    "interactionSummaryError": "I could not process some information from the current site. This might impact the information and answers I provide. If the issue persists please contact [support](mailto:{contactEmail}?subject=Interaction%20issue)",
    "agentAnswerError": "I am currently unable to complete your request. You can try again and if the issue persists contact [support](mailto:{contactEmail}?subject=Question%20issue)",
    "flowStepMissingElement": "I could not find the element '{selector}'. This might be due to recent changes in the page which I am not aware of. Please try again and if the issue persists contact [support](mailto:{contactEmail}?subject=Navigation%20element).",
  },
  "es": {
    "activationError": "No se pudo activar el Copiloto {agentName}. Puedes intentar de nuevo y si el problema persiste contactar al [soporte del Copiloto {agentName}](mailto:{contactEmail}?subject=Activation%20issue)",
    "interactionSummaryError": "No pude procesar informacion generada por la página actual. Esto puede impactar en la información y respuestas que te puedo dar. Si el problema persiste por favor contacta a [soporte](mailto:{contactEmail})?subject=Interaction%20issue",
    "agentAnswerError": "Ahora no puedo completar tu pedido. Puedes intentar de nuevo y si el problema persiste contactar a [soporte](mailto:{contactEmail}?subject=Question%20issue)",
    "flowStepMissingElement": "No pude encontrar el elemento '{selector}'. Esto puede ser debido a cambios recientes en la página de los cuales no tengo conocimiento. Por favor intenta de nuevo y si el problema persiste contacta a [soporte](mailto:{contactEmail}?subject=Navigation%20element).", 
  }
}
</i18n>
