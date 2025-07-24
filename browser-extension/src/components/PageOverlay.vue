<script lang="ts" setup>
defineProps<{ minimized?: boolean }>()
</script>

<template>
    <div class="h-full flex flex-col">
        <div>
            <div class="flex flex-row items-center p-3">
                <slot name="headerContent" />
                <div class="flex-auto text-right">
                    <slot name="headerActions" />
                </div>
            </div>
            <div v-if="!minimized" class="border-t border-gray-300 absolute left-0 right-0"></div>
        </div>
        <main v-if="!minimized" class="flex-grow overflow-y-auto overflow-x-hidden p-3">
            <slot name="content" />
        </main>
        <slot name="modalsContainer" />
        <footer v-if="!minimized" class="self-center">
            <div class="border-t border-gray-300 absolute left-0 right-0"></div>
            <div class="flex justify-center items-end h-full">
                <a href="https://github.com/abstracta/browser-copilot" target="_blank" rel="noopener noreferrer">
                    <img src="../assets/img/copilot.svg" class="w-[90px] h-[32px]" />
                </a>
            </div>
        </footer>
    </div>
</template>
