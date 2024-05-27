<script lang="ts" setup>
import { ref } from 'vue'
import { CirclePlusIcon } from 'vue-tabler-icons'
import { savePrompt, Prompt } from '../scripts/prompt-repository'
import PromptEditor from './PromptEditor.vue'

const props = defineProps<{ text: string, agentId: string, isLargeIcon: boolean }>()
const emit = defineEmits(['save', 'close'])
const showModal = ref(false)

const onSaved = async (prompt: Prompt) => {
  await savePrompt(prompt, props.agentId)
  close()
  emit('save')
}

const close = () => {
  showModal.value = false
  emit('close')
}
</script>

<template>
  <div>
    <div v-if="isLargeIcon">
      <button @click="showModal = true" class="flex items-center p-2 my-2 text-white bg-gray-800 w-full h-8 rounded-md">Prompts
        <circle-plus-icon class="ml-1"/></button>
    </div>
    <div v-else>
      <circle-plus-icon class="action-icon relative right-1" @click="showModal = true" />
    </div>
    <Teleport to="#sidebar">
      <PromptEditor :text="text" :show="showModal" @close="close" @saved="onSaved" :agent-id="agentId" />
    </Teleport>
  </div>
</template>