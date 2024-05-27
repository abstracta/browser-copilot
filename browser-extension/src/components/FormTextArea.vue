<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { ValidationResult, ValidationStatus } from '../scripts/validation';
import TextArea from './TextArea.vue';

const props = defineProps<{
  label: string,
  modelValue: string,
  focused?: boolean,
  check: (val: string) => Promise<ValidationResult>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const validationMessage = ref()
const validationClass = ref()

onMounted(async () => {
  await validate(props.modelValue)
})

const validate = async (value: string) => {
  const result = await props.check(value)
  validationMessage.value = result.message
  validationClass.value = ValidationStatus[result.status].toLowerCase()
}

const onInput = async (e: Event) => {
  let value = (e.target! as HTMLTextAreaElement).value
  validate(value)
  emit('update:modelValue', value)
}
</script>

<template>
  <div>
    <label>{{ label }}</label>
    <TextArea :modelValue="modelValue" @input="onInput" :class="validationClass" :focused="focused" />
    <div v-if="validationMessage" :class="validationClass">{{ validationMessage }}</div>
    <div class="p-1 [&_code]:text-violet-600">
      <slot name="instructions">
      </slot>
    </div>
  </div>
</template>
