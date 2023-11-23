<script lang="ts" setup>
import { ref, onBeforeMount, onUnmounted, nextTick } from 'vue'
import browser from "webextension-polyfill"
import CopilotChat, { ChatMessage } from "../components/CopilotChat.vue"
import CopilotList from "../components/CopilotList.vue"

const agentId = ref<string>("")
const agentLogo = ref<string>("")
const agentName = ref<string>("")
let port: browser.Runtime.Port
const lastResizePos = ref<number>()
const messages = ref<ChatMessage[]>([])


onBeforeMount(() => {
  console.log("CONNECT " + new Date().toISOString())
  port = browser.runtime.connect()
  port.onMessage.addListener(async (m: any, port: browser.Runtime.Port) => {
    if (m.type === "activate") {
      agentId.value = m.agentId
      agentName.value = m.agentName
      agentLogo.value = m.agentLogo
      messages.value.push(new ChatMessage('', false))
      await nextTick(() => {
        port.postMessage({ type: "activated" })
      })
    } else if (m.type === "aiMessage") {
      let lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage.text === '') {
        lastMessage.text = m.text
      } else {
        messages.value.push(new ChatMessage(m.text, false))
      }
    }
  })
  port.onDisconnect.addListener(() => {
    console.log("DISCONNECT " + new Date().toISOString())
  })
})

onUnmounted(() => {
  console.log("UNMOUNTED " + new Date().toISOString())
  port.disconnect()
})

const onUserMessage = (msg: string) => {
  messages.value.push(new ChatMessage(msg, true))
  messages.value.push(new ChatMessage('', false))
  port.postMessage({ type: "userMessage", text: msg })
}

const onActivateAgent = (agentId: string) => {
  port.postMessage({ type: "activateAgent", agentId: agentId })
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
  await browser.tabs.sendMessage(tab.id!, { type: "sidebar-resize", delta: delta })
}

const endResize = () => {
  window.document.body.className = ""
  window.removeEventListener("mousemove", resize)
  window.removeEventListener("mouseup", endResize)
}

const closeSidebar = () => {
  port.postMessage({ type: "closeSidebar" })
}
</script>

<template>
  <div class="sidebar">
    <div class="resizer" @mousedown="startResize" />
    <CopilotChat v-if="agentId" :messages="messages" :agent-id="agentId" :agent-name="agentName" :agent-logo="agentLogo"
      @userMessage="onUserMessage" @close="closeSidebar" />
    <CopilotList v-if="!agentId" @activateAgent="onActivateAgent" @close="closeSidebar" />
  </div>
</template>

<style>
@font-face {
  font-family: "Sora";
  src: url("../assets/fonts/Sora-Regular.ttf") format("truetype");
}

@font-face {
  font-family: "Sora";
  src: url("../assets/fonts/Sora-Thin.ttf") format("truetype");
  font-weight: 100;
}

@font-face {
  font-family: "Sora";
  src: url("../assets/fonts/Sora-Light.ttf") format("truetype");
  font-weight: 300;
}

html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: 'Sora';
  --white-color: #FFF;
  --background-color: var(--white-color);
  --shadow: 0 var(--half-spacing) var(--spacing) rgba(0, 0, 0, 0.33);
  --border: 1px solid #ccc;
  --color: #3D363E;
  --code-background-color: #202126;
  --action-icon-color: #ACACAC;
  --light-accent-color: #6f37fd;
  --accent-color: rgb(117, 75, 222);
  --warning-color: orange;
  --error-color: red;
  --title-color: #3D363E;
  --focus-color: var(--title-color);
  --spacing: 10px;
  --half-spacing: 5px;
  --content-space: 20px;
  --top-round-corner: 24px;
  --bottom-round-corner: 24px;
  color: var(--color);
}

.header {
  display: flex;
  flex-direction: row;
}

.actions {
  text-align: right;
  flex: auto;
}

.resizer {
  position: absolute;
  left: 0;
  z-index: 1000;
  cursor: ew-resize;
  height: 100%;
  width: var(--spacing);
}

.sidebar {
  position: fixed;
  left: -10px;
  width: 100%;
  height: calc(100% - var(--content-space));
  display: flex;
  flex-direction: column;
  justify-content: left;
  margin: var(--spacing);
  border: var(--border);
  background-color: var(--background-color);
  border-top-left-radius: var(--top-round-corner);
  border-bottom-left-radius: var(--bottom-round-corner);
  padding: var(--spacing);
}

.sidebar ::-webkit-scrollbar {
  width: 7px;
  background-color: #ccc;
  border-radius: 3px;
}

.sidebar ::-webkit-scrollbar-thumb {
  background-color: var(--accent-color);
  border-radius: 3px;
}

.sidebar ::-webkit-scrollbar-thumb:hover {
  background-color: var(--accent-color);
}

button {
  padding: var(--half-spacing);
  background-color: inherit;
  border: none;
  cursor: pointer;
  width: fit-content;
}

button:hover {
  color: var(--focus-color);
}

div.list-row {
  display: flex;
  flex-direction: row;
}

.list-row+.list-row {
  border-top: var(--border);
}

div.list-item {
  flex: auto;
  align-self: center;
}

img {
  margin: var(--half-spacing);
}
</style>
