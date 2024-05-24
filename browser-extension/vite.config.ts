import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import webExtension, { readJsonFile } from "vite-plugin-web-extension"
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

function generateManifest() {
  const manifest = readJsonFile("src/manifest.json")
  const pkg = readJsonFile("package.json")
  return {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
    ...manifest,
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    supported: {
      'top-level-await': true
    },
  },
  plugins: [
    vue(),
    webExtension({
      manifest: generateManifest,
      additionalInputs: ["src/index.html"],
      watchFilePaths: ["package.json", "manifest.json"],
      webExtConfig: {
        startUrl: process.env.START_URL || "https://github.com/abstracta/browser-copilot",
        args: process.env.BROWSER_ARGS?.split(' ') || []
      }
    }),
    VueI18nPlugin({
      jitCompilation: true
    }),
  ],
  build: {
    sourcemap: true
  }
});
