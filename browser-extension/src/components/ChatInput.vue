<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPrompts, Prompt } from '../scripts/prompt-repository'
import TextArea from './TextArea.vue'

const props = defineProps<{
  canSendMessage: boolean,
  agentId: string
}>()
const emit = defineEmits<{
  (e: 'sendMessage', text: string): void
}>()
const { t } = useI18n()
const inputText = ref('')
const promptList = ref<Prompt[]>([])
const selectedPromptIndex = ref(0)
const inputPosition = ref<number>()

const sendMessage = () => {
  if (!props.canSendMessage) {
    return
  }
  if (inputText.value.trim() !== '') {
    emit("sendMessage", inputText.value)
    inputText.value = ''
  }
}

const onKeydown = async (e: KeyboardEvent) => {
  inputPosition.value = undefined
  if (showingPromptList()) {
    if (e.key === "Enter") {
      usePrompt(selectedPromptIndex.value, e)
    } else if (e.key === "Escape") {
      clearPromptList()
    } else if (e.key === "ArrowUp" && selectedPromptIndex.value > 0) {
      e.preventDefault()
      selectedPromptIndex.value--
    } else if (e.key === "ArrowDown" && selectedPromptIndex.value < promptList.value.length - 1) {
      e.preventDefault()
      selectedPromptIndex.value++
    }
  } else if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const usePrompt = (index: number, e: UIEvent) => {
  e.preventDefault()
  let promptText = promptList.value[index].text
  let promptInputPosition = promptText.indexOf('${input}')
  if (promptInputPosition >= 0) {
    promptText = promptText.replace('${input}', '')
    inputPosition.value = promptInputPosition
  }
  inputText.value = promptText
  clearPromptList()
}

const showingPromptList = () => promptList.value.length > 0

const clearPromptList = () => {
  promptList.value = []
  selectedPromptIndex.value = 0
}

watch(inputText, async () => {
  if (!inputText.value.startsWith("/")) {
    clearPromptList()
  } else {
    await loadPromptList()
  }
})

const loadPromptList = async () => {
  promptList.value = (await getPrompts(props.agentId)).filter(p => p.name.toLowerCase().includes(inputText.value.substring(1).toLowerCase()))
}
</script>

<template>
  <div class="chat-input">
    <div class="prompt-list-popup" v-if="showingPromptList()">
      <div class="prompt-list">
        <div v-for="(prompt, index) in promptList" :key="prompt.name" @keydown="onKeydown"
          :class="['prompt-item', 'list-row', index === selectedPromptIndex && 'selected-prompt']"
          @click="e => usePrompt(index, e)" @mousedown="e => e.preventDefault()">{{ prompt.name }}</div>
      </div>
    </div>
    <TextArea class="message-input" :placeholder="t('placeholder')" v-model="inputText" @keydown="onKeydown" focused
      :cursor-position="inputPosition" />
    <button class="send-button" @click="sendMessage"><brand-telegram-icon /></button>
  </div>
</template>

<style>
.chat-input {
  display: flex;
  flex-direction: row;
  border-radius: 6px;
  padding: var(--half-spacing);
  border: 1.5px solid #754BDE;
  box-shadow: 0px 0px 2px 0px rgba(0, 0, 0, 0.15);
}

.message-input {
  width: 100%;
  margin-right: var(--spacing);
  resize: none;
  overflow: hidden;
  max-height: 400px;
  border: none;
  outline: none;
  align-self: center;
  margin-left: 5px;
}

.prompt-list-popup {
  position: absolute;
  bottom: 90px;
  z-index: 100;
}

.prompt-list-popup .prompt-list {
  border-radius: 5.5px;
  border: 1px solid var(--accent-color);
  background: var(--background-color);
  box-shadow: 0px 0px 2px 0px rgba(0, 0, 0, 0.12);
}

.selected-prompt {
  background-color: var(--light-accent-color);
}

.send-button:hover {
  color: var(--accent-color);
}
</style>

<i18n>
{
  "en": {
    "placeholder": "Type / to use a prompt, or type a message..."
  },
  "es": {
    "placeholder": "Usa / para usar un prompt, o escribe un mensaje..."
  }
}
</i18n>
