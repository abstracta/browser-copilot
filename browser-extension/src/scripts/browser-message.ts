import { AgentManifest } from "./agent"

export abstract class BrowserMessage {
  type: string

  constructor(type: string) {
    this.type = type
  }

  static fromJsonObject(obj: any): BrowserMessage {
    switch (obj.type) {
      case "toggleSidebar":
        return new ToggleSidebar()
      case "displaySidebar":
        return new DisplaySidebar()
      case "closeSidebar":
        return new CloseSidebar()
      case "resizeSidebar":
        return new ResizeSidebar(obj.delta)
      case "activateAgent":
        return new ActivateAgent(obj.agentId)
      case "agentActivated":
        return new AgentActivated(obj.manifest, obj.logo)
      case "agentActivationError":
        return new AgentActivationError(obj.agentName, obj.contactEmail)
      case "userMessage":
        return new UserMessage(obj.text, obj.file)
      case "agentMessage":
        return new AgentMessage(obj.text, obj.isComplete)
      case "agentErrorMessage":
        return new AgentErrorMessage(obj.context, obj.detail)
      default:
        // we log and throw since the handling should be the same in all points and error allows to properly interrupt any further processing of the message
        let msg = `Unknown message type: ${obj.type}`
        console.error(msg, obj)
        throw Error(msg)
    }
  }
}

export class ToggleSidebar extends BrowserMessage {
  constructor() {
    super("toggleSidebar")
  }
}

export class DisplaySidebar extends BrowserMessage {
  constructor() {
    super("displaySidebar")
  }
}

export class CloseSidebar extends BrowserMessage {
  constructor() {
    super("closeSidebar")
  }
}

export class ResizeSidebar extends BrowserMessage {
  delta: number

  constructor(delta: number) {
    super("resizeSidebar")
    this.delta = delta
  }
}

export class ActivateAgent extends BrowserMessage {
  agentId: string

  constructor(agentId: string) {
    super("activateAgent")
    this.agentId = agentId
  }
}

export class AgentActivated extends BrowserMessage {
  manifest: AgentManifest
  logo: string

  constructor(manifest: AgentManifest, logo: string) {
    super("agentActivated")
    this.manifest = manifest
    this.logo = logo
  }
}

export class AgentActivationError extends BrowserMessage {
  agentName: string
  contactEmail: string

  constructor(agentName: string, contactEmail: string) {
    super("agentActivationError")
    this.agentName = agentName
    this.contactEmail = contactEmail
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

export class AgentErrorMessage extends BrowserMessage {
  context: string
  detail?: string

  constructor(context: string, detail?: string) {
    super("agentErrorMessage")
    this.context = context
    this.detail = detail
  }
}
