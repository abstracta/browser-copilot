<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/base16/gigavolt.min.css'
import YouDot from "../assets/img/you.svg"
import NewPromptButton from "./NewPromptButton.vue"
import CopyButton from "./CopyButton.vue"

const props = defineProps<{ text: string, isUser: boolean, agentLogo: string, agentName: string, agentId: string }>()
const { t } = useI18n()
const md = new MarkdownIt({
  highlight: (code: string, lang: string) => {
    let ret = code
    if (lang && hljs.getLanguage(lang)) {
      try {
        ret = hljs.highlight(code, { language: lang }).value
      } catch (__) { }
    }
    return '<pre><code class="hljs">' + ret + '</code></pre>'
  }
})
const renderedMsg = computed(() => props.isUser ? props.text.replaceAll("\n", "<br/>") : md.render(props.text))

</script>

<template>
  <div class="message">
    <div class="flex items-center flex-row">
      <img :src="isUser ? YouDot : agentLogo" class="w-[20px] mr-1 rounded-full" />
      <span class="text-[15px]">{{ isUser ? t('you') : agentName }}</span>
      <div class="flex-auto flex justify-end">
        <CopyButton v-if="!isUser && text" :text="text" :html="renderedMsg" />
        <NewPromptButton v-if="isUser" :is-large-icon="false" :text="text" :agent-id="agentId" />
      </div>
    </div>
    <div class="mt-[10px] ml-[35px]">
      <div v-html="renderedMsg" class="message-text" />
      <div class="dot-pulse" style="margin-left: 10px;" v-if="!text" />
    </div>
  </div>
</template>
<style lang="scss">
@use 'three-dots' with ($dot-width: 5px,
  $dot-height: 5px,
  $dot-color: var(--accent-color));

ul {
  margin: 0px;
  padding-left: 20px;
}

h2,
h3,
h4 {
  margin: 0px;
  color: var(--accent-color);
}

pre {
  padding: 15px;
  background: var(--code-background-color);
  border-radius: 8px;
  text-wrap: wrap;
}

pre code.hljs {
  padding: 0px;
}

.message {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--half-spacing);
  position: relative;
  font-size: 14px;
  border-radius: 20px;
  padding: var(--half-spacing);
  min-width: 25px;
}

.message-text {
  font-weight: 300;
  font-size: 15px;
  line-height: 1.2em;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>

<i18n>
{
  "en": {
    "you": "You"
  },
  "es": {
    "you": "Tú"
  }
}
</i18n>
