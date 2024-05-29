<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MicrophoneIcon, BrandTelegramIcon, PlayerStopFilledIcon, TrashXIcon } from 'vue-tabler-icons'
import { getPrompts, Prompt } from '../scripts/prompt-repository'
import TextArea from './TextArea.vue'

const props = defineProps<{
  canSendMessage: boolean,
  supportRecording: boolean,
  agentId: string
}>()
const emit = defineEmits<{
  (e: 'sendMessage', text: string, file: Record<string, string>): void
}>()
const { t } = useI18n()
const inputText = ref('')
const promptList = ref<Prompt[]>([])
const selectedPromptIndex = ref(0)
const inputPosition = ref<number>()
const recordingAudio = ref(false)

let recordingChunks: [] = []
let recordingStream: MediaStream
let mediaRecorder: MediaRecorder


const sendMessage = () => {
  if (!props.canSendMessage) {
    return
  }
  if (inputText.value.trim() !== '') {
    emit('sendMessage', inputText.value, {})
    inputText.value = ''
  }
}

const canRecord = () => {
  return props.supportRecording && navigator.mediaDevices && navigator.mediaDevices.getUserMedia
}

const startRecording = async () => {
  if (!props.canSendMessage) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingStream = stream;
    mediaRecorder = new MediaRecorder(recordingStream);
    mediaRecorder.start();
    recordingAudio.value = true;
    mediaRecorder.ondataavailable = (e) => {
      recordingChunks.push(e.data as never);
    };
  } catch (err) {
    console.error(`getUserMedia error: ${err}`);
  }
};


/**
 * This is the only way to convert a blob file to base64
 * We use a Promise here due to the asynchronous nature of file reading in JavaScript.
 * The FileReader API operates asynchronously, meaning the file reading process 
 * doesn't complete immediately but takes some time.
 **/
const blobToBase64 = (blob: Blob) => {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

const stopRecording = () => {
  mediaRecorder.onstop = (e) => {
    recordingAudio.value = false;
  }
  stopRecorder()
}

const stopRecorder = () => {
  mediaRecorder.stop();
  /**
   * If you don't stop the tracks, the media devices (like the microphone) 
   * will continue to be used, and their indicator lights may stay on. 
   * This can lead to privacy concerns, as users might think they are still being recorded.
  * */
  recordingStream.getTracks().forEach(track => track.stop());
}

const sendAudioRecord = () => {
  mediaRecorder.onstop = (e) => {
    recordingAudio.value = false;
    const audioBlob = new Blob(recordingChunks, { type: 'audio/webm' });
    const audioObjectUrl = URL.createObjectURL(audioBlob);
    blobToBase64(audioBlob).then(result => {
      const base64WithoutTags = (result as string).substr((result as string).indexOf(',') + 1);
      emit('sendMessage', '', { data: base64WithoutTags, url: audioObjectUrl })
    })
    recordingChunks = []
  }
  stopRecorder()
}

const onKeydown = async (e: KeyboardEvent) => {
  inputPosition.value = undefined
  if (showingPromptList()) {
    if (e.key === 'Enter') {
      usePrompt(selectedPromptIndex.value, e)
    } else if (e.key === 'Escape') {
      clearPromptList()
    } else if (e.key === 'ArrowUp' && selectedPromptIndex.value > 0) {
      e.preventDefault()
      selectedPromptIndex.value--
    } else if (e.key === 'ArrowDown' && selectedPromptIndex.value < promptList.value.length - 1) {
      e.preventDefault()
      selectedPromptIndex.value++
    }
  } else if (e.key === 'Enter' && !e.shiftKey) {
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
  if (!inputText.value.startsWith('/')) {
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
  <div class="flex flex-row rounded-md p-1 border border-violet-600 shadow-sm text-xs">
    <template v-if="!recordingAudio">
      <template v-if="canRecord()">
        <button @click="startRecording" class="p-0"><microphone-icon /></button>
      </template>
      <TextArea class="w-full resize-none overflow-hidden max-h-16 border-0 outline-0 self-center"
        :placeholder="t('placeholder')" v-model="inputText" @keydown="onKeydown" focused
        :cursor-position="inputPosition" />
      <div class="flex items-center">
        <button @click="sendMessage" class="group rounded-full aspect-square bg-violet-600 hover:bg-violet-800 ml-1">
          <brand-telegram-icon color="white" class="group-hover:text-white" />
        </button>
      </div>
    </template>

    <template v-else>
      <button @click="sendAudioRecord"
        class="group rounded-full aspect-square border-solid p-0 border-red-500 hover:border-red-700 mr-1">
        <player-stop-filled-icon class="text-red-500 group-hover:text-red-700" />
      </button>
      <div class="text-nowrap flex items-center">{{ t('recordingAudio') }}</div>
      <div class="w-full flex items-center justify-center overflow-hidden ml-1">
        <div class="dot-floating" />
      </div>
      <button @click="stopRecording">
        <trash-x-icon />
      </button>
    </template>

    <div class="absolute bottom-28 z-10 rounded-md border border-violet-600 bg-white shadow-md"
      v-if="showingPromptList()">
      <div v-for="(prompt, index) in promptList" :key="prompt.name" @keydown="onKeydown"
        :class="['flex flex-row p-[5px] cursor-pointer', index === selectedPromptIndex && 'bg-violet-600 text-white']"
        @click="e => usePrompt(index, e)" @mousedown="e => e.preventDefault()">{{ prompt.name }}
      </div>
    </div>
  </div>
</template>
<i18n>
{
  "en": {
    "placeholder": "Type / to use a prompt, or type a message",
    "recordingAudio": "Recording audio"
  },
  "es": {
    "placeholder": "Usa / para usar un prompt, o escribe un mensaje",
    "recordingAudio": "Grabando audio"
  }
}
</i18n>
<style scoped>
.icon-tabler:hover {
  color: var(--accent-color);
}
</style>