import browser from "webextension-polyfill";

let sidebarWidth = 400
const minWidth = 200

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

const toggle = () => {
    iframe.style.width = iframe.style.width == "0px" ? sidebarWidth + "px" : "0px"
}

const resize = (delta: number) => {
    sidebarWidth += delta
    if (sidebarWidth < minWidth) {
        sidebarWidth = minWidth
    } else if (sidebarWidth > window.innerWidth) {
        sidebarWidth = window.innerWidth
    }
    iframe.style.width = sidebarWidth + "px"
}

let iframe = document.createElement('iframe')
setSidebarIframeStyle(iframe)
iframe.allow = "clipboard-write"
iframe.src = browser.runtime.getURL("src/popup.html")
document.body.appendChild(iframe)

browser.runtime.onMessage.addListener((msg, _) => {
    if (msg.type == "sidebar-toggle") {
        toggle()
    } else if (msg.type == "sidebar-resize") {
        resize(msg.delta)
    }
})
