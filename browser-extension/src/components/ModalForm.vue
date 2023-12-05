<script lang="ts" setup>
import Modal from './Modal.vue'

const props = defineProps<{ show: boolean, title: string, buttonText?: string }>()
const emit = defineEmits(['save', 'close'])

const onClose = () => {
  //This avoids double submit when double click in button
  if (!props.show) {
    return
  }
  emit('close')
}

const onSave = () => {
  //This avoids double submit when double click in button
  if (!props.show) {
    return
  }
  emit('save')
}
</script>

<template>
  <Modal :show="show" :title="title" @close="onClose">
    <div class="flex flex-col gap-[var(--spacing)] my-[var(--spacing)] modal-form">
      <slot />
    </div>
    <button class="bg-[var(--accent-color)] text-white rounded-[4px] w-full h-[32px] hover:text-white hover:bg-[var(--light-accent-color)]" @click="onSave">{{ buttonText }}</button>
  </Modal>
</template>

<style>
.modal-form div {
  display: flex;
  flex-direction: column;
}

.modal-form label {
  font-weight: bold;
  font-size: 14px;
}

.modal-form textarea,
.modal-form input {
  font-family: inherit;
  resize: none;
  outline-color: var(--focus-color);
  border: var(--border);
  border-radius: var(--spacing);
  padding: var(--half-spacing)
}

.modal-form .warning {
  color: var(--warning-color);
  outline-color: var(--warning-color);
}

.modal-form .error {
  color: var(--error-color);
  outline-color: var(--error-color);
}
</style>