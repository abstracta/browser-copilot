export abstract class BrowserMessage {
  type: string

  constructor(type: string) {
    this.type = type
  }

  static fromJsonObject(obj: any): BrowserMessage {
    switch (obj.type) {
      case "toggleSidebar":
        return new ToggleSidebar()
      case "resizeSidebar":
        return new ResizeSidebar(obj.delta)
      case "closeSidebar":
        return new CloseSidebar()
      case "displaySidebar":
        return new DisplaySidebar()
      case "activateAgent":
        return new ActivateAgent(obj.agentId)
      case "userMessage":
        return new UserMessage(obj.text)
      case "aiMessage":
        return new AiMessage(obj.text)
      case "activatedAgent":
        return new ActivatedAgent(obj.agentId, obj.agentName, obj.agentLogo)
      default:
        throw Error("Unknown message type: " + obj.type)
    }
  }
}

export abstract class SidebarMessage extends BrowserMessage { }

export class ToggleSidebar extends SidebarMessage {
  constructor() {
    super("toggleSidebar")
  }
}

export class ResizeSidebar extends SidebarMessage {

  delta: number

  constructor(delta: number) {
    super("resizeSidebar")
    this.delta = delta
  }

}

export abstract class ServiceMessage extends BrowserMessage { }

export class CloseSidebar extends ServiceMessage {
  constructor() {
    super("closeSidebar")
  }
}

export class DisplaySidebar extends ServiceMessage {
  constructor() {
    super("displaySidebar")
  }
}

export class ActivateAgent extends ServiceMessage {
  agentId: string

  constructor(agentId: string) {
    super("activateAgent")
    this.agentId = agentId
  }
}

export class UserMessage extends ServiceMessage {

  text: string

  constructor(msg: string) {
    super("userMessage")
    this.text = msg
  }

}

export abstract class ContentMessage extends BrowserMessage { }

export class ActivatedAgent extends ContentMessage {
  agentId: string
  agentName: string
  agentLogo: string

  constructor(agentId: string, agentName: string, agentLogo: string) {
    super("activatedAgent")
    this.agentId = agentId
    this.agentName = agentName
    this.agentLogo = agentLogo
  }
}

export class AiMessage extends ContentMessage {
  text: string

  constructor(msg: string) {
    super("aiMessage")
    this.text = msg
  }

}

