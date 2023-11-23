import { createApp } from "vue";
import Popup from "./pages/Popup.vue";
import VueTablerIcons from "vue-tabler-icons";
import './assets/style/index.css'
const app = createApp(Popup);
app.use(VueTablerIcons);
app.mount("body");
