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
      case "agentActivated":
        return new AgentActivated(obj.agentId, obj.agentName, obj.agentLogo)
      case "userMessage":
        return new UserMessage(obj.text, obj.file)
      case "agentMessage":
        return new AgentMessage(obj.text, obj.isComplete)
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
  file: Record<string, string>

  constructor(msg: string, file: Record<string, string>) {
    super("userMessage")
    this.text = msg
    this.file = file
  }

}

export class AgentActivated extends BrowserMessage {
  agentId: string
  agentName: string
  agentLogo: string

  constructor(agentId: string, agentName: string, agentLogo: string) {
    super("agentActivated")
    this.agentId = agentId
    this.agentName = agentName
    this.agentLogo = agentLogo
  }
}

export class AgentMessage extends BrowserMessage {
  text: string
  isComplete: boolean

  constructor(msg: string, isComplete: boolean) {
    super("agentMessage")
    this.text = msg
    this.isComplete = isComplete
  }

  public static incomplete(msg: string): AgentMessage {
    return new AgentMessage(msg, false)
  }

  public static complete(msg = ""): AgentMessage {
    return new AgentMessage(msg, true)
  }

}