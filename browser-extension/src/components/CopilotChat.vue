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
import PageOverlay from "./PageOverlay.vue"
import BtnClose from './BtnClose.vue'

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
  <PageOverlay>
      <template v-slot:headerContent>
        <img :src="agentLogo" class="w-[25px] h-[25px]" />
        <div class="text-[20px] font-semibold">
          <CopilotName :agentName="agentName" />
        </div>
      </template>
      <template v-slot:headerActions>
        <button @click="showConfig = true"><settings-icon /></button>
        <BtnClose @click="$emit('close')"/>
      </template>
    <template v-slot:content>
      <div class="h-full flex flex-col">
        <div class="h-full flex flex-col overflow-y-auto mb-4 rounded-[var(--spacing)]" ref="messagesDiv">
          <Message v-for="message in messages" :key="message.id" :text="message.text" :is-user="message.isUser" 
            :agent-logo="agentLogo" :agent-name="agentName" :agent-id="agentId" />
        </div>
        <ChatInput @send-message="onUserMessage" :can-send-message="lastMessage.text !== ''" :agent-id="agentId" />
      </div>
    </template>
    <template v-slot:modalsContainer>
      <CopilotConfig :show="showConfig" @close="showConfig = false" :agent-id="agentId" :agent-name="agentName" :agent-logo="agentLogo" />
    </template>
  </PageOverlay>
</template>
