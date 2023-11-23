<script lang="ts" setup>
import { ref, watch } from 'vue'
import { Prompt, getPrompts } from '../scripts/prompt-repository'
import { ValidationResult } from '../scripts/validation'
import ModalForm from './ModalForm.vue'
import FormInput from './FormInput.vue'
import FormTextArea from './FormTextArea.vue'

const props = defineProps<{ name?: string, text: string, show: boolean, agentId: string }>()
const emit = defineEmits<{
  (e: 'close'): void,
  (e: 'saved', prompt: Prompt): void
}>()
const nameVal = ref()
const textVal = ref()

watch(() => props.show, (val) => {
  if (!val) {
    return;
  }
  nameVal.value = props.name ?? ''
  textVal.value = props.text
})

const save = async () => {
  if (!nameVal.value || !textVal.value) {
    return
  }
  emit('saved', new Prompt(nameVal.value, textVal.value))
}

const checkName = async (val: string): Promise<ValidationResult> => {
  if (!val) {
    return ValidationResult.error("Name can't be empty")
  }
  let prompts = await getPrompts(props.agentId)
  if (val !== props.name && prompts.filter(p => p.name === val).length !== 0) {
    return ValidationResult.warning("A prompt with the same name already exists. If saved, the existing one will be overwritten.")
  }
  return ValidationResult.valid()
}

const checkText = async (val: string): Promise<ValidationResult> => {
  return (!val) ? ValidationResult.error("Text can't be empty") : ValidationResult.valid()
}
</script>

<template>
  <ModalForm title="Prompt" button-text="Save prompt" :show="show" @close="$emit('close')" @save="save">
    <FormInput label="Name" v-model="nameVal" :check="checkName" focused />
    <FormTextArea label="Description" v-model="textVal" :check="checkText">
      <template #instructions>
        <p>Use <code>${input}</code> to parameterize the prompt.</p>
      </template>
    </FormTextArea>
  </ModalForm>
</template>
<style>
.modal-form textarea, .modal-form input {
  border-radius: 7px;
}
</style>
