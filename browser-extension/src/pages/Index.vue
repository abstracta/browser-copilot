<script lang="ts" setup>
import { ref, onBeforeMount, nextTick } from 'vue'
import browser from "webextension-polyfill"
import { BrowserMessage, ToggleSidebar, DisplaySidebar, ActivatedAgent, AiMessage, UserMessage, ActivateAgent, CloseSidebar } from "../scripts/browser-message"
import CopilotChat, { ChatMessage } from "../components/CopilotChat.vue"
import CopilotList from "../components/CopilotList.vue"


let displaying = false
const agentId = ref<string>("")
const agentLogo = ref<string>("")
const agentName = ref<string>("")
const lastResizePos = ref<number>()
const messages = ref<ChatMessage[]>([])

onBeforeMount(() => {
  browser.runtime.onMessage.addListener(async (m: any) => {
    let msg = BrowserMessage.fromJsonObject(m)
    if (msg instanceof ToggleSidebar) {
      displaying = !displaying
    } else if (msg instanceof ActivatedAgent) {
      agentId.value = msg.agentId
      agentName.value = msg.agentName
      agentLogo.value = msg.agentLogo
      messages.value.push(ChatMessage.aiMessage())
      if (!displaying) {
        await nextTick(async () => {
          await sendToServiceWorker(new DisplaySidebar())
        })
      }
    } else if (msg instanceof AiMessage) {
      let lastMessage = messages.value[messages.value.length - 1]
      if (!lastMessage.isComplete) {
        lastMessage.isComplete = msg.isComplete
        lastMessage.text += msg.text
      } else {
        messages.value.push(ChatMessage.aiMessage(msg.text))
      }
    }
  })
})

const sendToServiceWorker = async (msg: BrowserMessage) => {
  await browser.runtime.sendMessage(msg)
}

const onUserMessage = async (msg: string) => {
  messages.value.push(ChatMessage.userMessage(msg))
  messages.value.push(ChatMessage.aiMessage())
  await sendToServiceWorker(new UserMessage(msg))
}

const onActivateAgent = async (agentId: string) => {
  await sendToServiceWorker(new ActivateAgent(agentId))
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
</script>

<template>
  <div class="fixed flex flex-col left-[-10px] w-full h-[var(--sidebar-height)] justify-left m-[var(--spacing)] border-[.1px] border-slate-500 bg-[var(--background-color)] rounded-tl-[var(--top-round-corner)] rounded-bl-[var(--bottom-round-corner)]" id="sidebar">
    <div class="absolute left-0 z-[1000] cursor-ew-resize w-[var(--spacing)] h-full" @mousedown="startResize" />
    <CopilotChat v-if="agentId" :messages="messages" :agent-id="agentId" :agent-name="agentName" :agent-logo="agentLogo"
      @userMessage="onUserMessage" @close="closeSidebar" />
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