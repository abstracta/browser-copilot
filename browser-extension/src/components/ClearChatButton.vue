<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineEmits(['clearChat'])
</script>

<template>
  <button 
    @click="$emit('clearChat')" 
    class="flex items-center p-2 my-2 text-white bg-red-600 w-full h-8 rounded-md hover:bg-red-700"
  >
    {{ t('clearChat') }}
  </button>
</template>

<i18n>
{
  "en": {
    "clearChat": "Clear chat"
  },
  "es": {
    "clearChat": "Limpiar chat"
  }
}
</i18n>
