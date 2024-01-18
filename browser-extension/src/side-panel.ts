import browser from "webextension-polyfill";
import { BrowserMessage, ResizeSidebar } from "./scripts/browser-message";

const setSidebarIframeStyle = (iframe: HTMLIFrameElement) => {
    let style = iframe.style;
    style.height = "100%";
    style.width = "0px";
    style.position = "fixed";
    style.top = "0px";
    style.right = "0px";
    style.zIndex = "2147483647";
    style.border = "0px";
}

const resize = (size: number) => {
    if (size > window.innerWidth) {
        size = window.innerWidth
    }
    iframe.style.width = size + "px"
}

let iframe = document.createElement('iframe')
setSidebarIframeStyle(iframe)
iframe.allow = "clipboard-write; microphone"
iframe.src = browser.runtime.getURL("src/index.html")
document.body.appendChild(iframe)

browser.runtime.onMessage.addListener((m: any) => {
    let msg = BrowserMessage.fromJsonObject(m)
    if (msg instanceof ResizeSidebar) {
        resize(msg.size)
    }
})
