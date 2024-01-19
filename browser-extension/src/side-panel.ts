import browser from "webextension-polyfill"
import { BrowserMessage, ResizeSidebar } from "./scripts/browser-message"

const setSidebarIframeStyle = (iframe: HTMLIFrameElement) => {
    let style = iframe.style
    style.height = "100%"
    style.position = "fixed"
    style.top = "0px"
    style.right = "0px"
    style.zIndex = "2147483647"
    style.border = "0px"
}

const resize = (size: number) => {
    if (size > window.innerWidth) {
        size = window.innerWidth
    }
    iframeStyle.innerHTML = `#${iframe.id} {
        width: ${size}px !important;
        min-width: ${size}px !important;
    }`
}

let iframe = document.createElement('iframe')
iframe.id="browser-copilot"
setSidebarIframeStyle(iframe)
iframe.allow = "clipboard-write; microphone"
iframe.src = browser.runtime.getURL("src/index.html")
document.body.appendChild(iframe)

// On pages that define an style for iframes with min-width set to a value and important
// setting the inline style width gets overwritten by the page style, 
// and setting the inline style width as important makes the resulting page to don't even include the style
// As a workaround we set the iframe an id and create a style that points to that id with important widths
// and then updated this style whenever a resize is needed
let iframeStyle = document.createElement('style')
document.head.appendChild(iframeStyle)
resize(0)

browser.runtime.onMessage.addListener((m: any) => {
    let msg = BrowserMessage.fromJsonObject(m)
    if (msg instanceof ResizeSidebar) {
        resize(msg.size)
    }
})
