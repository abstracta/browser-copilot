<script lang="ts">
let currentMsgId = 2

export class ChatMessage {
  id: number
  text: string
  isUser: boolean

  constructor(text: string, isUser: boolean) {
    this.id = currentMsgId++
    this.text = text
    this.isUser = isUser
  }
}
</script>

<script lang="ts" setup>
import { ref, nextTick, watch, computed } from 'vue'
import CopilotName from "../components/CopilotName.vue"
import Message from "../components/Message.vue"
import ChatInput from "../components/ChatInput.vue"
import CopilotConfig from "../components/CopilotConfig.vue"
import Footer from "../components/Footer.vue"

const props = defineProps<{ agentId: string, agentName: string, agentLogo: string, messages: ChatMessage[] }>()
const emit = defineEmits<{
  (e: 'close'): void,
  (e: 'userMessage', text: string): void
}>()

const messagesDiv = ref<HTMLDivElement>()
const showConfig = ref(false)

watch(props.messages, async () => {
  await adjustMessagesScroll()
})

const adjustMessagesScroll = async () => {
  await nextTick(() => {
    messagesDiv.value!.scrollTop = messagesDiv.value!.scrollHeight
  })
}

const onUserMessage = async (text: string) => {
  emit('userMessage', text)
}

const lastMessage = computed((): ChatMessage => props.messages[props.messages.length - 1])

</script>

<template>
  <div class="copilot-chat">
    <div class="header items-center py-3 px-1.5">
      <img :src="agentLogo" class="agent-icon" />
      <div class="text-[20px] font-semibold">
        <CopilotName :agentName="agentName" />
      </div>
      <div class="actions">
        <button @click="showConfig = true"><settings-icon /></button>
        <button @click="$emit('close')"><x-icon /></button>
      </div>
    </div>
    <div class="border-t border-gray-300 absolute left-0 right-0"></div>
    <div class="chat-container py-3">
      <div class="chat-messages" ref="messagesDiv">
        <Message :text="message.text" :is-user="message.isUser" v-for="message in messages" :key="message.id"
          :agent-logo="agentLogo" :agent-name="agentName" :agent-id="agentId" />
      </div>
      <ChatInput @send-message="onUserMessage" :can-send-message="lastMessage.text !== ''" :agent-id="agentId" />
      <Footer />
    </div>
    <CopilotConfig :show="showConfig" @close="showConfig = false" :agent-id="agentId" :agent-name="agentName"
      :agent-logo="agentLogo" />
  </div>
</template>

<style>
.agent-icon {
  width: 25px;
  height: 25px;
}

/* icon-tabler override */
.icon-tabler {
  width: 25px;
  height: 25px;
  margin-left: 5px;
  margin-right: 5px;
}

.icon-tabler-x:hover,
.icon-tabler-settings:hover {
  color: var(--accent-color);
}

.header .actions .icon-tabler-x {
  width: 28px;
  height: 28px;
  position: relative;
  top: 2px;
}

.action-icon {
  width: 20px;
  height: 20px;
  color: var(--action-icon-color);
}

.action-icon:hover {
  color: var(--accent-color);
  cursor: pointer;
}

/* icon-tabler override */
</style>
<style scoped>
.copilot-chat {
  height: 100%;
}

.chat-container {
  height: calc(100% - var(--content-space));
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: left;
}

.chat-messages {
  height: calc(100% - 110px);
  overflow-y: auto;
  margin-bottom: var(--spacing);
  border-radius: var(--spacing);
  padding: var(--half-spacing);
  display: flex;
  flex-direction: column;
}
</style>