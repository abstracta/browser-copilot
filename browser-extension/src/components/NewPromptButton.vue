<script lang="ts" setup>
import { ref } from 'vue'
import PromptEditor from "./PromptEditor.vue"
import { savePrompt, Prompt } from '../scripts/prompt-repository';

const props = defineProps<{ text: string, agentId: string, isLargeIcon: boolean }>()
const emit = defineEmits(['save', 'close'])

const showModal = ref(false)

const onSaved = async (prompt: Prompt) => {
  await savePrompt(prompt, props.agentId)
  close()
  emit("save")
}

const close = () => {
  showModal.value = false
  emit("close")
}
</script>

<template>
  <div>
    <div v-if="isLargeIcon">
    <button @click="showModal = true" class="flex items-center p-2 my-2 add-prompt-btn-large">Prompt <circle-plus-icon/></button>
  </div>
  <div v-else>
    <circle-plus-icon class="action-icon add-prompt-btn-sm" @click="showModal = true"/>
  </div>
  <Teleport to="body">
    <PromptEditor :text="text" :show="showModal" @close="close" @saved="onSaved" :agent-id="agentId" />
  </Teleport>
  </div>
</template>
<style scoped>
.add-prompt-btn-sm.icon-tabler-circle-plus {
  position: relative;
  bottom: 2px;
}

.add-prompt-btn-large {
  color: var(--white-color); 
  background: var(--color); 
  width: 100%; 
  height: 32px;
  border-radius: 4px; 
}
</style>