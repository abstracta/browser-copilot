<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/base16/gigavolt.min.css'
import { ExclamationCircleIcon, CircleFilledIcon } from 'vue-tabler-icons'
import NewPromptButton from './NewPromptButton.vue'
import CopyButton from './CopyButton.vue'

const useTargetBlankLinks = (md: MarkdownIt) => {
  let defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }
  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    tokens[idx].attrSet('target', '_blank')
    return defaultRender(tokens, idx, options, env, self)
  }
}

const renderMarkDown = (text: string) => {
  let md = new MarkdownIt({
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
  useTargetBlankLinks(md)
  return md.render(text)
}

const props = defineProps<{ text: string, file: Record<string, string>, isUser: boolean, isComplete: boolean, isSuccess: boolean, agentLogo: string, agentName: string, agentId: string }>()
const { t } = useI18n()
const renderedMsg = computed(() => props.isUser ? props.text.replaceAll('\n', '<br/>') : renderMarkDown(props.text))

</script>

<template>
  <div class="flex flex-col mb-1 p-1 min-w-7" :class=" !isSuccess ? ['border-red-500', 'border-b']: []">
    <div class="flex items-center flex-row">
      <template v-if="isUser">
        <circle-filled-icon class="text-violet-600"/>
      </template>
      <template v-else-if="!isUser && isSuccess">
        <img :src="agentLogo" class="w-5 mr-1 rounded-full" />
      </template>
      <template v-else>
        <exclamation-circle-icon class="text-red-600"/>
      </template>
      
      <span class="text-base">{{ isUser ? t('you') : agentName }}</span>
      <div class="flex-auto flex justify-end">
        <CopyButton v-if="!isUser && text" :text="text" :html="renderedMsg" />
        <NewPromptButton v-if="isUser && text" :is-large-icon="false" :text="text" :agent-id="agentId" />
      </div>
    </div>
    <div class="mt-2 ml-8">
      <div>
        <template v-if="file.data">
          <audio controls>
            <source :src="file.url" type="audio/webm">
          </audio>
        </template>
        <template v-if="text">
          <div v-html="renderedMsg" class="flex flex-col text-sm font-light leading-tight gap-4" id="rendered-msg"/>
        </template>
      </div>
      <div class="ml-3 dot-pulse" v-if="!isComplete" />
    </div>
  </div>
</template>
<style lang="scss">
@use 'three-dots' with ($dot-width: 5px,
  $dot-height: 5px,
  $dot-color: var(--accent-color));

pre {
  padding: 15px;
  background: #202126;
  border-radius: 8px;
  text-wrap: wrap;
}

// Fix: Inadequate gap between code blocks within list items.
#rendered-msg li pre {
  margin-bottom: 10px;
}

pre code.hljs {
  padding: 0px;
}

div a {
  color: var(--accent-color);
  text-decoration: none;
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
