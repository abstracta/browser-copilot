<script lang="ts" setup>
import { ref } from 'vue'
import { CopyIcon, CheckIcon } from 'vue-tabler-icons'


const props = defineProps<{ text: string, html: string }>()
const copied = ref<boolean>(false)

const copyToClipboard = async (text: string, html: string) => {
  if (navigator && 'clipboard' in navigator) {
    const plainMime = 'text/plain'
    const htmlMime = 'text/html'
    const data = [new ClipboardItem({
      [htmlMime]: new Blob([html], { type: htmlMime }),
      [plainMime]: new Blob([text], { type: plainMime }),
    })];
    await navigator.clipboard.write(data)
  } else {
    let tmp = document.createElement('textarea')
    tmp.value = text
    tmp.style.position = 'absolute'
    tmp.style.visibility = 'hidden'
    document.body.appendChild(tmp)
    tmp.select()
    document.execCommand('copy')
    tmp.remove()
  }
}

const copy = async () => {
  await copyToClipboard(props.text, props.html)
  copied.value = true
  setTimeout(() => copied.value = false, 3000)
}
</script>

<template>
  <!-- fixed width to avoid redimension of message text when chainging copy button status -->
  <button @click="copy">
    <copy-icon class="action-icon" v-if="!copied" />
    <check-icon fade v-if="copied" class="text-violet-600" />
  </button>
</template>