import { Agent } from "./agent"
import { FlowStep } from "./flow"

export abstract class BrowserMessage {
  type: string

  constructor(type: string) {
    this.type = type
  }

  public static fromJsonObject(obj: any): BrowserMessage {
    switch (obj.type) {
      case "activeTabListener":
        return ActiveTabListener.fromJsonObject(obj)
      case "toggleSidebar":
        return new ToggleSidebar()
      case "resizeSidebar":
        return ResizeSidebar.fromJsonObject(obj)
      case "activateAgent":
        return ActivateAgent.fromJsonObject(obj)
      case "agentActivation":
        return AgentActivation.fromJsonObject(obj)
      case "interactionSummary":
        return InteractionSummary.fromJsonObject(obj)
      case "flowStepExecution":
        return FlowStepExecution.fromJsonObject(obj)
      default:
        // we log and throw since the handling should be the same in all points and error allows to properly interrupt any further processing of the message
        let msg = `Unknown message type: ${obj.type}`
        console.error(msg, obj)
        throw Error(msg)
    }
  }
}

export class ActiveTabListener extends BrowserMessage {
  active: boolean

  constructor(active: boolean) {
    super("activeTabListener")
    this.active = active
  }

  public static fromJsonObject(obj: any): ActiveTabListener {
    return new ActiveTabListener(obj.active)
  }
}

export class ToggleSidebar extends BrowserMessage {
  constructor() {
    super("toggleSidebar")
  }
}

export class ResizeSidebar extends BrowserMessage {
  size: number

  constructor(size: number) {
    super("resizeSidebar")
    this.size = size
  }

  public static fromJsonObject(obj: any): ResizeSidebar {
    return new ResizeSidebar(obj.size)
  }
}

export class ActivateAgent extends BrowserMessage {
  agentId: string
  url: string

  constructor(agentId: string, url: string) {
    super("activateAgent")
    this.agentId = agentId
    this.url = url
  }

  public static fromJsonObject(obj: any): ActivateAgent {
    return new ActivateAgent(obj.agentId, obj.url)
  }
}

export class AgentActivation extends BrowserMessage {
  agent: Agent
  success: boolean

  constructor(agent: Agent, success: boolean) {
    super("agentActivation")
    this.agent = agent
    this.success = success
  }

  public static fromJsonObject(obj: any): AgentActivation {
    return new AgentActivation(Agent.fromJsonObject(obj.agent), obj.success)
  }
}

export class InteractionSummary extends BrowserMessage {
  text?: string
  success: boolean

  constructor(success: boolean, text?: string) {
    super("interactionSummary")
    this.text = text
    this.success = success
  }

  public static fromJsonObject(obj: any): InteractionSummary {
    return new InteractionSummary(obj.success, obj.text)
  }
}

export class FlowStepExecution extends BrowserMessage {
  step: FlowStep

  constructor(step: FlowStep) {
    super("flowStepExecution")
    this.step = step
  }

  public static fromJsonObject(obj: any): FlowStepExecution {
    return new FlowStepExecution(obj.step)
  }
}
