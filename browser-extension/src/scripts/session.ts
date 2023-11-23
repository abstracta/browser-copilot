import { Agent, RecordInteractionRuleAction } from "./agent"
import { fetchJson } from "./http"
import browser from "webextension-polyfill"

export class TabSession {
  id: string
  tabId: number
  url: string
  agent: Agent
  port: browser.Runtime.Port

  constructor(id: string, agent: Agent, tabId: number, url: string, port: browser.Runtime.Port) {
    this.id = id
    this.agent = agent
    this.tabId = tabId!
    this.url = url
    this.port = port
  }

  public async activate(url: string): Promise<void> {
    this.sendMessageToTab({ type: "activate", agentId: this.agent.manifest.id, agentName: this.agent.manifest.name, agentLogo: this.agent.logo })
    this.sendMessageToTab(this.aiMessage(this.agent.manifest.welcomeMessage))
    this.port.onMessage.addListener(async (msg: any, _) => {
      if (msg.type === "userMessage") {
        let answer = await this.agent.ask(msg.text, this.id)
        this.sendMessageToTab(this.aiMessage(answer))
      }
    })
    let httpAction = this.agent.activationAction?.httpRequest
    if (httpAction) {
      await fetchJson(this.solveUrlTemplate(httpAction.url, url), { method: httpAction.method })
    }
  }

  private aiMessage(summary: string): any {
    return { type: "aiMessage", text: summary }
  }

  public sendMessageToTab(message: any): void {
    this.port.postMessage(message)
  }

  private solveUrlTemplate(urlTemplate: string, baseUrl: string): string {
    let parsedUrl = new URL(baseUrl)
    let basePath = parsedUrl.pathname.substring(1, parsedUrl.pathname.lastIndexOf("/"))
    let ret = urlTemplate.replace("${origin}", parsedUrl.origin).replace("${basePath}", basePath).replace("${sessionId}", this.id)
    return ret
  }

  public async processInteraction(req: browser.WebRequest.OnCompletedDetailsType): Promise<void> {
    const actions = await this.agent.findMatchingActions(req)
    for (const a of actions) {
      if (a.recordInteraction) {
        await this.recordInteraction(req, a.recordInteraction)
      }
    }
  }

  private async recordInteraction(req: browser.WebRequest.OnCompletedDetailsType, action: RecordInteractionRuleAction) {
    let interactionDetail = await this.findInteraction(req, action)
    let summary = await this.agent.solveInteractionSummary(interactionDetail, this.id)
    if (summary) {
      this.sendMessageToTab(this.aiMessage(summary))
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
