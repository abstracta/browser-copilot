<script lang="ts" setup>
defineProps<{ show: boolean, title: string, icon?: string}>()

</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="flex absolute z-[9998] top-0 left-0 w-full h-full bg-[var(--modal-overlay-background-color)] transition-opacity duration-300 ease-in-out rounded-tl-[var(--top-round-corner)] rounded-bl-[var(--bottom-round-corner)]">
      <div class="w-[320px] h-auto m-auto p-[15px] bg-[var(--background-color)] rounded-[var(--spacing)] shadow-[var(--shadow)] transition-all duration-300 ease-in-out">
        <div class="modal-header flex flex-row">
          <img :src="icon" v-if="icon" />
          <h2 class="font-semibold text-base text-current self-center">{{ title }}</h2>
          <div class="modal-actions flex flex-auto flex-row-reverse">
            <button @click="$emit('close')"><x-icon /></button>
          </div>
        </div>
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style>
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
</style>