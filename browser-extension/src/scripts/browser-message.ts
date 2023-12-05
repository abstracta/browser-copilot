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
        return new AiMessage(obj.text, obj.isComplete)
      case "activatedAgent":
        return new ActivatedAgent(obj.agentId, obj.agentName, obj.agentLogo)
      default:
        throw Error("Unknown message type: " + obj.type)
    }
  }
}

export class ToggleSidebar extends BrowserMessage {
  constructor() {
    super("toggleSidebar")
  }
}

export class ResizeSidebar extends BrowserMessage {

  delta: number

  constructor(delta: number) {
    super("resizeSidebar")
    this.delta = delta
  }

}

export class CloseSidebar extends BrowserMessage {
  constructor() {
    super("closeSidebar")
  }
}

export class DisplaySidebar extends BrowserMessage {
  constructor() {
    super("displaySidebar")
  }
}

export class ActivateAgent extends BrowserMessage {
  agentId: string

  constructor(agentId: string) {
    super("activateAgent")
    this.agentId = agentId
  }
}

export class UserMessage extends BrowserMessage {

  text: string

  constructor(msg: string) {
    super("userMessage")
    this.text = msg
  }

}

export class ActivatedAgent extends BrowserMessage {
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

export class AiMessage extends BrowserMessage {
  text: string
  isComplete: boolean

  constructor(msg: string, isComplete: boolean) {
    super("aiMessage")
    this.text = msg
    this.isComplete = isComplete
  }

  public static incomplete(msg: string): AiMessage {
    return new AiMessage(msg, false)
  }

  public static complete(msg = ""): AiMessage {
    return new AiMessage(msg, true)
  }

}