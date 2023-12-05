<template>
    <div class="h-full flex flex-col">
        <div>
            <div class="flex flex-row items-center p-3">
                <slot name="headerContent" />
                <div class="flex-auto text-right">
                    <slot name="headerActions" />
                </div>
            </div>
            <div class="border-t border-gray-300 absolute left-0 right-0"></div>
        </div>
        <main class="flex-grow overflow-y-auto overflow-x-hidden p-3">
            <slot name="content" />
        </main>
        <slot name="modalsContainer" />
        <footer class="self-center">
            <div class="border-t border-gray-300 absolute left-0 right-0"></div>
            <div class="flex justify-center items-end h-full">
                <a href="https://github.com/abstracta/browser-copilot" target="_blank" rel="noopener noreferrer">
                    <img src="../assets/img/copilot.svg" class="w-[90px] h-[32px]" />
                </a>
            </div>
        </footer>
    </div>
</template>
