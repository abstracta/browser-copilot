import { createApp } from "vue"
import Index from "./pages/Index.vue"
import "./assets/style/index.css"
import { createI18n } from "vue-i18n"
import browser from "webextension-polyfill"
import Toast from "vue-toastification"
import "vue-toastification/dist/index.css"

const i18n = createI18n({
  legacy: false,
  locale: (await browser.i18n.getAcceptLanguages())[0],
  fallbackLocale: "en",
  missingWarn: false,
  fallbackWarn: false
})
const app = createApp(Index)
app.use(i18n)
app.use(Toast, {})
app.mount("body")

let elem : HTMLBodyElement = document.getElementsByTagName("body")[0]
elem!.onbeforeunload = () => app.unmount()