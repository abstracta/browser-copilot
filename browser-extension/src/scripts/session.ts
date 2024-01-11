import { Agent, RecordInteractionRuleAction } from "./agent"
import { fetchJson } from "./http"
import { AuthService } from "./auth"
import browser from "webextension-polyfill"
import { ActivatedAgent, AiMessage } from "./browser-message"

export class TabSession {
  id: string
  tabId: number
  url: string
  agent: Agent
  authService?: AuthService


  constructor(id: string, tabId: number, agent: Agent, url: string, authService?: AuthService) {
    this.id = id
    this.tabId = tabId!
    this.agent = agent
    this.url = url
    this.authService = authService
  }

  public static fromJsonObject(obj: any): TabSession {
    return new TabSession(obj.id, obj.tabId, Agent.fromJsonObject(obj.agent), obj.url, AuthService.fromJsonObject(obj.authService))
  }

  public async activate(url: string): Promise<void> {
    await this.sendMessageToTab(new ActivatedAgent(this.agent.manifest.id, this.agent.manifest.name, this.agent.logo))
    await this.sendMessageToTab(AiMessage.complete(this.agent.manifest.welcomeMessage))
    let httpAction = this.agent.activationAction?.httpRequest
    if (httpAction) {
      await fetchJson(this.solveUrlTemplate(httpAction.url, url), { method: httpAction.method })
    }
  }

  public async processUserMessage(msg: string, file: Record<string, string>) {
    let messageToProcess = msg;
    if (file.data) {
      messageToProcess = await this.agent.transcriptAudio(file.data, this.id);
    }
    let ret : AsyncIterable<string> = await this.agent.ask(msg, this.id, this.authService)
    for await (const part of ret) {
      await this.sendMessageToTab(AiMessage.incomplete(part))
    }
    await this.sendMessageToTab(AiMessage.complete())
  }

  private async sendMessageToTab(message: any): Promise<void> {
    await browser.tabs.sendMessage(this.tabId, message)
  }

  private solveUrlTemplate(urlTemplate: string, baseUrl: string): string {
    let parsedUrl = new URL(baseUrl)
    let basePath = parsedUrl.pathname.substring(1, parsedUrl.pathname.lastIndexOf("/"))
    let ret = urlTemplate.replace("${origin}", parsedUrl.origin).replace("${basePath}", basePath).replace("${sessionId}", this.id)
    return ret
  }

  public async processInteraction(req: browser.WebRequest.OnCompletedDetailsType): Promise<void> {
    const actions = this.agent.findMatchingActions(req)
    for (const a of actions) {
      if (a.recordInteraction) {
        await this.recordInteraction(req, a.recordInteraction)
      }
    }
  }

  private async recordInteraction(req: browser.WebRequest.OnCompletedDetailsType, action: RecordInteractionRuleAction) {
    let interactionDetail = await this.findInteraction(req, action)
    let summary = await this.agent.solveInteractionSummary(interactionDetail, this.id, this.authService)
    if (summary) {
      this.sendMessageToTab(AiMessage.complete(summary))
    }
  }

  private async findInteraction(req: browser.WebRequest.OnCompletedDetailsType, action: RecordInteractionRuleAction): Promise<any> {
    return await fetchJson(this.solveUrlTemplate(action.url, req.url))
  }

  public async close() {
    let endAction = this.agent.manifest.onSessionClose
    if (endAction) {
      await fetchJson(this.solveUrlTemplate(endAction.httpRequest.url, this.url), { method: endAction.httpRequest.method })
    }
  }

}
