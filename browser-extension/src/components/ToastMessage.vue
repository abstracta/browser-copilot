<script lang="ts" setup>
import MarkdownIt from 'markdown-it'
import { useToast } from 'vue-toastification'
const toast = useToast()

const md = MarkdownIt({})
defineProps({ message: String })

const addTargetBlankToLinks = (md: MarkdownIt) => {
  var defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  }
  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    tokens[idx].attrSet('target', '_blank');
    return defaultRender(tokens, idx, options, env, self);
  };
}
addTargetBlankToLinks(md);
</script>

<template>
  <div v-html="md.render(message!)" />
</template>

<style>

div .Vue-Toastification__container {
  @apply p-2 pt-6;
}

div .Vue-Toastification__toast--error {
  @apply bg-white p-2 text-sm text-black font-sans rounded-md align-middle;
}

div .Vue-Toastification__icon {
  @apply text-red-500 mr-2 w-8;
}

div .Vue-Toastification__close-button {
  @apply text-gray-500 h-fit;
}

div .Vue-Toastification__progress-bar {
  @apply bg-red-500;
}
</style>
