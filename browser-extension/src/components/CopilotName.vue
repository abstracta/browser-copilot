<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

defineProps<{ agentName: string }>()
const { t } = useI18n()
</script>

<template>
  <i18n-t keypath="template">
    <template #name>
      {{ agentName }}
    </template>
    <template #label>
      <span class="font-light">{{ t('label') }}</span>
    </template>
  </i18n-t>
</template>

<i18n>
{
  "en": {
    "template": "{name} {label}",
    "label": "Copilot"
  },
  "es": {
    "template": "{label} {name}",
    "label": "Copiloto"
  }
}
</i18n>
