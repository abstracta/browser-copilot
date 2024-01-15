<script lang="ts" setup>
import { ref, onBeforeMount, nextTick } from 'vue'
import browser from "webextension-polyfill"
import { useToast } from "vue-toastification"
import { useI18n } from 'vue-i18n'
import {
  BrowserMessage, DisplaySidebar, CloseSidebar, ActivateAgent, AgentActivated,
  AgentActivationError, UserMessage, AgentMessage, AgentErrorMessage
} from "../scripts/browser-message"
import CopilotChat, { ChatMessage } from "../components/CopilotChat.vue"
import CopilotList from "../components/CopilotList.vue"
import ToastMessage from "../components/ToastMessage.vue"

const sidebar = ref<HTMLDivElement>()
const agentId = ref<string>("")
const agentLogo = ref<string>("")
const agentName = ref<string>("")
let agentContactEmail: string
const agentCapabilities = ref<string[]>([])
const lastResizePos = ref<number>()
const messages = ref<ChatMessage[]>([])
const toast = useToast()
const { t } = useI18n()

onBeforeMount(() => {
  browser.runtime.onMessage.addListener(async (m: any) => {
    let msg = BrowserMessage.fromJsonObject(m)
    if (msg instanceof AgentActivated) {
      await onAgentActivated(msg)
    } else if (msg instanceof AgentActivationError) {
      await onAgentActivationError(msg)
    } else if (msg instanceof AgentMessage) {
      onAgentMessage(msg)
    } else if (msg instanceof AgentErrorMessage) {
      onAgentErrorMessage(msg)
    }
  })
})

const onAgentActivated = async (msg: AgentActivated) => {
  agentId.value = msg.manifest.id
  agentName.value = msg.manifest.name
  agentLogo.value = msg.logo
  agentContactEmail = msg.manifest.contactEmail
  agentCapabilities.value = msg.manifest.capabilities || []
  messages.value.push(ChatMessage.agentMessage())
  if (sidebar.value?.clientWidth == 0) {
    await nextTick(async () => {
      await sendToServiceWorker(new DisplaySidebar())
    })
  }
}

const sendToServiceWorker = async (msg: BrowserMessage) => {
  await browser.runtime.sendMessage(msg)
}

const onAgentActivationError = async (msg: AgentActivationError) => {
  toast.error({component: ToastMessage, props: { message: t('activationError', { ...msg })}})
}

const onAgentMessage = (msg: AgentMessage) => {
  let lastMessage = messages.value[messages.value.length - 1]
  if (!lastMessage.isComplete) {
    lastMessage.isComplete = msg.isComplete
    lastMessage.text += msg.text
  } else {
    messages.value.push(ChatMessage.agentMessage(msg.text))
  }
}

const onAgentErrorMessage = (msg: AgentErrorMessage) => {
  let lastMessage = messages.value[messages.value.length - 1]
  let text = msg.detail ? msg.detail : t(msg.context + "Error", { contactEmail: agentContactEmail })
  if (msg.context === "recordInteraction") {
    let messagePosition = lastMessage.isComplete ? messages.value.length : messages.value.length - 1
    messages.value.splice(messagePosition, 0, ChatMessage.agentMessage(text))
  } else {
    lastMessage.isComplete = true
    if (!lastMessage.text) {
      lastMessage.text += text
    } else {
      messages.value.push(ChatMessage.agentMessage(text))
    }
  }
}

const startResize = (e: MouseEvent) => {
  lastResizePos.value = e.screenX
  window.document.body.className = "resizing"
  window.addEventListener("mousemove", resize)
  window.addEventListener("mouseup", endResize)
}

const resize = async (e: MouseEvent) => {
  e.preventDefault()
  let delta = lastResizePos.value! - e.screenX
  lastResizePos.value = e.screenX
  let tab = await browser.tabs.getCurrent()
  await browser.tabs.sendMessage(tab.id!, { type: "resizeSidebar", delta: delta })
}

const endResize = () => {
  window.document.body.className = ""
  window.removeEventListener("mousemove", resize)
  window.removeEventListener("mouseup", endResize)
}

const closeSidebar = () => {
  sendToServiceWorker(new CloseSidebar())
}

const onActivateAgent = async (agentId: string) => {
  await sendToServiceWorker(new ActivateAgent(agentId))
}

const onUserMessage = async (msg: string, file: Record<string, string>) => {
  messages.value.push(ChatMessage.userMessage(msg, file))
  messages.value.push(ChatMessage.agentMessage())
  await sendToServiceWorker(new UserMessage(msg, file))
}
</script>

<template>
  <div
    class="fixed flex flex-col left-[-10px] w-full h-[var(--sidebar-height)] justify-left m-[var(--spacing)] border-[.1px] border-slate-500 bg-[var(--background-color)] rounded-tl-[var(--top-round-corner)] rounded-bl-[var(--bottom-round-corner)]"
    id="sidebar" ref="sidebar">
    <div class="absolute left-0 z-[1000] cursor-ew-resize w-[var(--spacing)] h-full" @mousedown="startResize" />
    <CopilotChat v-if="agentId" :messages="messages" :agent-id="agentId" :agent-name="agentName" :agent-logo="agentLogo"
      :agent-capabilities="agentCapabilities" @userMessage="onUserMessage" @close="closeSidebar" />
    <CopilotList v-if="!agentId" @activateAgent="onActivateAgent" @close="closeSidebar" />
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
    "recordInteractionError": "I could not process some information from the current site. This might impact the information and answers I provide. If the issue persists please contact [support](mailto:{contactEmail}?subject=Interaction%20issue)",
    "answerUserError": "I am currently unable to complete your request. You can try again and if the issue persists contact [support](mailto:{contactEmail}?subject=Question%20issue)"
  },
  "es": {
    "activationError": "No se pudo activar el Copiloto {agentName}. Puedes intentar de nuevo y si el problema persiste contactar al [soporte del Copiloto {agentName}](mailto:{contactEmail}?subject=Activation%20issue)",
    "recordInteractionError": "No pude procesar informacion generada por la página actual. Esto puede impactar en la información y respuestas que te puedo dar. Si el problema persiste por favor contacta a [soporte](mailto:{contactEmail})?subject=Interaction%20issue",
    "answerUserError": "Ahora no puedo completar tu pedido. Puedes intentar de nuevo y si el problema persiste contactar a [soporte](mailto:{contactEmail}?subject=Question%20issue)"
  }
}
</i18n>
