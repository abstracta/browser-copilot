<script lang="ts" setup>
import { ref, watch } from 'vue'
import ModalForm from './ModalForm.vue'
import FormInput from './FormInput.vue'
import { Agent } from '../scripts/agent'
import { addAgent } from '../scripts/agent-repository';
import { saveAgentPrompts } from '../scripts/prompt-repository'
import { ValidationResult } from '../scripts/validation';

defineProps<{ show: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void,
  (e: 'saved', prompt: Agent): void
}>()


const url = ref('')
const validation = ref(ValidationResult.valid())

const save = async () => {
  try {
    let agent = await Agent.fromUrl(url.value)
    addAgent(agent)
    await saveAgentPrompts(agent.manifest.prompts, agent.manifest.id)
    emit('saved', agent)
  } catch (e: any) {
    validation.value = ValidationResult.error((e instanceof Error) ? e.message : e)
  }
}

watch(url, () => {
  validation.value = ValidationResult.valid()
})

</script>

<template>
  <ModalForm title="Add Copilot" button-text="Save" :show="show" @close="$emit('close')" @save="save">
    <FormInput label="URL" v-model="url" focused :validationProp="validation" />
  </ModalForm>
</template>
