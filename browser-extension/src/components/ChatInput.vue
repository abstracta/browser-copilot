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
  (e: 'sendMessage', text: string, file: Record<string, string> ): void
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
    emit("sendMessage", inputText.value, {})
    inputText.value = ''
  }
}

const canRecord = () => {
  return navigator.mediaDevices && navigator.mediaDevices.getUserMedia
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
      emit("sendMessage", "", {data: base64WithoutTags, url: audioObjectUrl})
    }) 
    recordingChunks = []
  }
  stopRecorder()
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
    <TextArea class="w-full ml-[5px] mr-[10px] resize-none overflow-hidden max-h-[60px] border-0 outline-0 self-center text-[10.5px]" :placeholder="!recordingAudio ? t('placeholder') : t('placeholderRecordingAudio')" v-model="inputText" @keydown="onKeydown" focused
      :cursor-position="inputPosition" />
      
      <template v-if="!recordingAudio">
        <button @click="sendMessage"><brand-telegram-icon /></button>
        <button v-if="canRecord()" @click="startRecording"><microphone-icon/></button>
      </template>
      <template v-else>
        <button @click="stopRecording"><x-icon/></button>
        <button @click="sendAudioRecord"><player-stop-icon /></button>
      </template>

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
    "placeholder": "Type / to use a prompt, or type a message...",
    "placeholderRecordingAudio": "Recording audio..."
  },
  "es": {
    "placeholder": "Usa / para usar un prompt, o escribe un mensaje...",
    "placeholderRecordingAudio": "Grabando audio..."
  }
}
</i18n>
<style scoped>
button > .icon-tabler:hover {
  color: var(--accent-color);
}
</style>