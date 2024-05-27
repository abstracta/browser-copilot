<script lang="ts" setup>
import { ref, watch, onBeforeMount } from 'vue'
import { useI18n } from 'vue-i18n'
import { TrashXIcon } from 'vue-tabler-icons'
import { getPrompts, Prompt, deletePrompt, savePrompt } from '../scripts/prompt-repository'
import Modal from './Modal.vue'
import ModalForm from './ModalForm.vue'
import PromptEditor from './PromptEditor.vue'
import NewPromptButton from './NewPromptButton.vue'

const props = defineProps<{ agentId: string, agentName: string, agentLogo: string, show: boolean }>()
const emit = defineEmits(['close'])
const { t } = useI18n()
const prompts = ref<Prompt[]>()
const editingPrompt = ref<Prompt>()
const deletingPromptIndex = ref(-1)

onBeforeMount(async () => {
  await loadPrompts()
})

const loadPrompts = async () => {
  prompts.value = await getPrompts(props.agentId)
}

watch(() => props.agentId, async () => {
  await loadPrompts()
})

const close = () => {
  emit('close')
}

const removePrompt = (index: number) => {
  deletingPromptIndex.value = index
}

const onPromptUpdate = async (updatedPrompt: Prompt) => {
  await deletePrompt(editingPrompt.value!.name, props.agentId)
  await savePrompt(updatedPrompt, props.agentId)
  prompts.value = await getPrompts(props.agentId)
  closePromptEditor()
}

const onNewPrompt = async () => {
  prompts.value = await getPrompts(props.agentId)
}

const closePromptEditor = () => {
  editingPrompt.value = undefined
}

const closePromptDeletionConfirmation = () => {
  deletingPromptIndex.value = -1
}

const confirmPromptRemoval = async () => {
  let prompt = prompts.value![deletingPromptIndex.value]
  await deletePrompt(prompt.name, props.agentId)
  prompts.value?.splice(deletingPromptIndex.value, 1)
  closePromptDeletionConfirmation()
}
</script>

<template>
  <Modal :title="t('title', { agentName: agentName })" :show="show" @close="close">
    <NewPromptButton text="" :isLargeIcon="true" :agent-id="agentId" @save="onNewPrompt" />
      <div v-for="(prompt, index) in prompts" :key="prompt.name" class="flex flex-row">
        <div class="flex-auto self-center cursor-pointer p-1" @click="editingPrompt = prompt">{{ prompt.name }}</div>
        <button @click="removePrompt(index)"><trash-x-icon class="action-icon" /></button>
      </div>
  </Modal>
  <PromptEditor :name="editingPrompt?.name || ''" :text="editingPrompt?.text || ''" @close="closePromptEditor"
    @saved="onPromptUpdate" :show="editingPrompt !== undefined" :agent-id="agentId" />
  <ModalForm title="Delete prompt" :show="deletingPromptIndex >= 0" @close="closePromptDeletionConfirmation"
    @save="confirmPromptRemoval" button-text="Delete">
    {{ t('deleteConfirmation', { promptName: prompts ? prompts[deletingPromptIndex].name : '' }) }}
  </ModalForm>
</template>

<i18n>
{
  "en": {
    "title": "{agentName} config",
    "deleteConfirmation": "Are you sure you want to delete the prompt {promptName}?"
  },
  "es": {
    "title": "Configuración de {agentName}",
    "deleteConfirmation": "¿Estás seguro de borrar el prompt {promptName}?"
  }
}
</i18n>
