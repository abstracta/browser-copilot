<script lang="ts" setup>
import MarkdownIt from 'markdown-it'

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

addTargetBlankToLinks(md)
</script>

<template>
  <div v-html="md.render(message!)" class="Vue-Toastification__toast-body" style="white-space: normal" />
</template>

<style>
div .Vue-Toastification__toast {
  padding: var(--spacing);
}
</style>
