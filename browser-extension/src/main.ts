import { createApp } from "vue";
import Index from "./pages/Index.vue";
import VueTablerIcons from "vue-tabler-icons";
import './assets/style/index.css'
import { createI18n } from 'vue-i18n'
import browser from "webextension-polyfill"

const i18n = createI18n({
  legacy: false,
  locale: (await browser.i18n.getAcceptLanguages())[0],
  fallbackLocale: "en",
  missingWarn: false,
  fallbackWarn: false
})
const app = createApp(Index)
app.use(VueTablerIcons)
app.use(i18n)
app.mount("body")
