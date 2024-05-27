<script lang="ts" setup>
import { nextTick, onMounted, onUpdated, ref } from 'vue'

const emit = defineEmits<{
  (e: 'keydown', event: KeyboardEvent): void,
  (e: 'update:modelValue', value: string): void
}>()
const props = defineProps<{
  modelValue: string,
  class?: any,
  placeholder?: string,
  focused?: boolean,
  cursorPosition?: number
}>()
const input = ref<HTMLTextAreaElement>()
let selectedPosition: number | undefined = undefined

onMounted(async () => {
  await nextTick(() => {
    if (props.focused) {
      input.value!.focus()
    }
    resize()
  })
})

onUpdated(() => {
  resize()
  if (props.cursorPosition !== undefined && props.cursorPosition !== selectedPosition) {
    input.value!.selectionEnd = props.cursorPosition!
  }
  selectedPosition = props.cursorPosition
})

const resize = () => {
  const textarea = input.value!
  const padding = 0
  textarea.style.height = 'auto'
  if (textarea.value) {
    textarea.style.height = `${textarea.scrollHeight - (padding ?? 0)}px`
  }
}

const onInput = (e: Event) => {
  emit('update:modelValue', (e.target! as HTMLTextAreaElement).value)
}
</script>

<template>
  <textarea ref="input" rows="1" :class="class" :placeholder="placeholder" :value="modelValue"
    @keydown="$emit('keydown', $event)" @input="onInput" />
</template>