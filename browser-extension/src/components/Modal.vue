<script lang="ts" setup>
defineProps<{ show: boolean, title: string, icon?: string}>()
const emit = defineEmits(['close'])

const onClose = () => {
  emit('close')
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-mask">
      <div class="modal-container">
        <div class="modal-header">
          <img :src="icon" v-if="icon" />
          <h2>{{ title }}</h2>
          <div class="modal-actions">
            <button @click="onClose" style="border: none"><x-icon /></button>
          </div>
        </div>
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style>
.modal-mask {
  position: absolute;
  z-index: 9998;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  transition: opacity 0.3s ease;
  border-top-left-radius: var(--top-round-corner);
  border-bottom-left-radius: var(--bottom-round-corner);
}

.modal-container {
  width: 320px;
  margin: auto;
  padding: 15px;
  background-color: var(--background-color);
  border-radius: var(--spacing);
  box-shadow: var(--shadow);
  transition: all 0.3s ease;
}

.modal-enter-from {
  opacity: 0;
}

.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  -webkit-transform: scale(1.1);
  transform: scale(1.1);
}

.modal-container label {
  display: block;
}

.modal-header {
  display: flex;
  flex-direction: row;
}

.modal-header h2 {
  font-weight: 600;
  font-size: 16px;
  color: inherit;
}

.modal-header h2 {
  align-self: center;
}

.modal-actions {
  display: flex;
  flex: auto;
  flex-direction: row-reverse;
}

.modal-actions .icon-tabler-x {
  width: 22px;
  height: 22px;
}
</style>