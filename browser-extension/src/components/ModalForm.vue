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
  <Modal :show="show" :title="title" @close="onClose" class="group">
    <div class="flex flex-col gap-2 my-1 modal-form *:flex *:flex-col">
      <slot/>
    </div>
    <button class="bg-violet-600 text-white rounded-md w-full h-8 hover:text-white hover:bg-violet-800" @click="onSave">{{ buttonText }}</button>
  </Modal>
</template>

<style>

.modal-form label {
  font-weight: bold;
}

.modal-form textarea,
.modal-form input {
  resize: none;
  outline-color: #3d363e;
  border: var(--border);
  border-radius: var(--spacing);
  padding: var(--half-spacing)
}

.modal-form .warning {
  color: orange;
  outline-color: orange;
}

.modal-form .error {
  color: red;
  outline-color: red;
}
</style>