import { Agent, RecordInteractionRuleAction } from "./agent"
import { HttpServiceError, fetchJson } from "./http"
import { AuthService } from "./auth"
import browser from "webextension-polyfill"
import { AgentActivated, AgentMessage, AgentErrorMessage } from "./browser-message"

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
    let httpAction = this.agent.activationAction?.httpRequest
    if (httpAction) {
      await fetchJson(this.solveUrlTemplate(httpAction.url, url), { method: httpAction.method })
    }
    await this.sendMessageToTab(new AgentActivated(this.agent.manifest, this.agent.logo))
    await this.sendMessageToTab(AgentMessage.complete(this.agent.manifest.welcomeMessage))
  }

  public async processUserMessage(msg: string, file: Record<string, string>) {
    try {
      if (file.data) {
        msg = await this.agent.transcriptAudio(file.data, this.id);
      }
      let ret: AsyncIterable<string> = await this.agent.ask(msg, this.id, this.authService)
      for await (const part of ret) {
        await this.sendMessageToTab(AgentMessage.incomplete(part))
      }
      await this.sendMessageToTab(AgentMessage.complete())
    } catch (e) {
      await this.handleSessionError("answerUser", e)
    }
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

  private async handleSessionError(context: string, e: any) {
    // need to send message and context to tab since in background the i18n module is not initialized, so resolution might differ from frontend if we try using it here.
    await this.sendMessageToTab(new AgentErrorMessage(context, (e instanceof HttpServiceError ? e.detail : undefined)))
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
    try {
      let interactionDetail = await this.findInteraction(req, action)
      let summary = await this.agent.solveInteractionSummary(interactionDetail, this.id, this.authService)
      if (summary) {
        this.sendMessageToTab(AgentMessage.complete(summary))
      }
    } catch (e) {
      await this.handleSessionError("recordInteraction", e)
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
