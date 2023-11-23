# Browser Extension

The extension is built using the following:

* [vite-plugin-web-extension](https://vite-plugin-web-extension.aklinker1.io/)
* [Vue](https://vuejs.org/guide/introduction.html#what-is-vue)
* [TypeScript](https://www.typescriptlang.org/)
* [Vite](https://vitejs.dev/)
* [pnpm](https://pnpm.io/).

## Main files

| File                                         | Description                                                                                                     |
|----------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| [src/manifest.json](./src/manifest.json)     | Manifest file for the browser extension                                                                         |
| [src/pages/Popup.vue](./src/pages/Popup.vue) | Main component displayed when the extension is clicked                                                          |
| [src/components](./src/components)           | Collection of Vue components that provide the main UI features                                                  |
| [src/background.ts](./src/background.ts)     | Handles the main interactions between the browser extension and the backend agents (copilot services)           |
| [src/side-panel.ts](./src/side-panel.ts)     | Creates and toggles the sidebar (including the popup component) when a message is sent by the background script |
| [src/popup.ts](./src/popup.ts)               | Initializes vue                                                                                                 |
