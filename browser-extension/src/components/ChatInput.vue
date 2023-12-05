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
  <div class="flex flex-row rounded-[6px] p-[5px] border-[1px] border-[#754BDE] shadow-sm">
    <TextArea class="w-full ml-[5px] mr-[10px] resize-none overflow-hidden max-h-[60px] border-0 outline-0 self-center" :placeholder="t('placeholder')" v-model="inputText" @keydown="onKeydown" focused
      :cursor-position="inputPosition" />
    <button class="hover:text-[var(--accent-color)]" @click="sendMessage"><brand-telegram-icon /></button>
  
    <div class="absolute bottom-[100px] z-[100px] rounded-[5.5px] border-[1px] border-[var(--accent-color)] bg-[var(--background-color)] shadow-sm" v-if="showingPromptList()">
        <div v-for="(prompt, index) in promptList" :key="prompt.name" @keydown="onKeydown"
          :class="['flex flex-row p-[5px] cursor-pointer', index === selectedPromptIndex && 'bg-[var(--accent-color)] text-white']"
          @click="e => usePrompt(index, e)" @mousedown="e => e.preventDefault()">{{ prompt.name }}
        </div>
    </div>
  </div>
</template>
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
