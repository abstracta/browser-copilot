<script lang="ts" setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import { ValidationResult } from '../scripts/validation';

const props = defineProps<{
  label: string,
  modelValue: string,
  focused?: boolean,
  check?: (val: string) => Promise<ValidationResult>,
  validationProp?: ValidationResult
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const inputRef = ref<HTMLInputElement>()
const validation = ref(ValidationResult.valid())

onMounted(async () => {
  await validate(props.modelValue)
  await nextTick(async () => {
    if (props.focused) {
      inputRef.value!.focus()
    }
  })
})

watch(() => props.validationProp, (val) => {
  if (val) {
    validation.value = val
  }
})

const validate = async (value: string) => {
  validation.value = props.check ? await props.check(value) : ValidationResult.valid()
}

const onInput = async (e: Event) => {
  let value = (e.target! as HTMLInputElement).value
  validate(value)
  emit('update:modelValue', value)
}
</script>

<template>
  <div>
    <label>{{ label }}</label>
    <input ref="inputRef" :value="modelValue" @input="onInput" :class="validation.cssClass">
    <div v-if="validation.message" :class="validation.cssClass">{{ validation.message }}</div>
  </div>
</template>
