<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()
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
    return ValidationResult.error(t('emptyName'))
  }
  let prompts = await getPrompts(props.agentId)
  if (val !== props.name && prompts.filter(p => p.name === val).length !== 0) {
    return ValidationResult.warning(t('existingName'))
  }
  return ValidationResult.valid()
}

const checkText = async (val: string): Promise<ValidationResult> => {
  return (!val) ? ValidationResult.error(t('emptyText')) : ValidationResult.valid()
}
</script>

<template>
  <ModalForm title="Prompt" :button-text="t('saveButton')" :show="show" @close="$emit('close')" @save="save">
    <FormInput :label="t('name')" v-model="nameVal" :check="checkName" focused />
    <FormTextArea :label="t('text')" v-model="textVal" :check="checkText">
      <template #instructions>
        <p><i18n-t keypath="instructions"><code>${input}</code></i18n-t></p>
      </template>
    </FormTextArea>
  </ModalForm>
</template>
<style>
.modal-form textarea,
.modal-form input {
  border-radius: 7px;
  overflow: hidden;
}
</style>

<i18n>
{
  "en": {
    "emptyName": "Name can't be empty",
    "existingName": "A prompt with the same name already exists. If saved, the existing one will be overwritten",
    "emptyText": "Text can't be empty",
    "saveButton": "Save",
    "name": "Name",
    "text": "Text",
    "instructions": "Use {0} to parameterize the prompt"
  },
  "es": {
    "emptyName": "El nombre no puede ser vacío",
    "existingName": "Un prompt con el mismo nombre ya existe. Si guardas, el existente sera sobreescrito",
    "emptyText": "El texto no puede ser vacío",
    "saveButton": "Guardar",
    "name": "Nombre",
    "text": "Texto",
    "instructions": "Usa {0} para parametrizar el prompt"
  }
}
</i18n>
