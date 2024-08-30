import browser from "webextension-polyfill"
import { Agent, AgentRuleCondition, AddHeaderRuleAction, RecordInteractionRuleAction } from "./agent"
import { AuthService } from "./auth"
import { sendToTab } from "../background"
import { HttpServiceError, fetchJson } from "./http"
import { InteractionSummary } from "./browser-message"

export class AgentSession {
  tabId: number
  agent: Agent
  url: string
  id?: string
  authService?: AuthService
  pollId?: number

  constructor(tabId: number, agent: Agent, url: string, id?: string, pollId?: number) {
    this.id = id
    this.tabId = tabId
    this.agent = agent
    this.url = url
    this.authService = this.agent.manifest.auth ? new AuthService(this.agent.manifest.auth) : undefined
    this.pollId = pollId
  }

  public static fromJsonObject(obj: any): AgentSession {
    return new AgentSession(obj.tabId, Agent.fromJsonObject(obj.agent), obj.url, obj.id, obj.pollId)
  }

  public async activate() {
    let resp = await this.agent.createSession(await browser.i18n.getAcceptLanguages(), this.authService)
    this.id = resp.id
    let httpAction = this.agent.activationAction?.httpRequest
    if (httpAction) {
      await fetchJson(this.solveUrlTemplate(httpAction.url, this.url), { method: httpAction.method })
    }
    await this.updateRequestRules()
    await this.startPolling()
  }

  private solveUrlTemplate(urlTemplate: string, baseUrl: string): string {
    let parsedUrl = new URL(baseUrl)
    let basePath = parsedUrl.pathname.substring(1, parsedUrl.pathname.lastIndexOf("/"))
    let ret = urlTemplate.replace("${origin}", parsedUrl.origin).replace("${basePath}", basePath).replace("${sessionId}", this.id!)
    return ret
  }

  private async updateRequestRules() {
    if (!this.agent.manifest.onHttpRequest) {
      return
    }
    let lastRuleId = await this.getLastRuleId()
    let requestRules = this.agent.manifest.onHttpRequest
      .flatMap(r => r.actions
        .filter(a => a.addHeader)
        .map(a => this.buildModifyHeadersRule(lastRuleId++, r.condition, a.addHeader!))
      )
    if (!requestRules) {
      return
    }
    let prevRuleIds = await this.getTabPreviousRuleIds()
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: prevRuleIds,
      addRules: requestRules
    })
  }

  private async getLastRuleId(): Promise<number> {
    let rules = await browser.declarativeNetRequest.getSessionRules()
    return Math.max(...rules.map(r => r.id))
  }

  private buildModifyHeadersRule(ruleId: number, condition: AgentRuleCondition, action: AddHeaderRuleAction): browser.DeclarativeNetRequest.Rule {
    return {
      id: ruleId,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [{
          operation: "set",
          header: action.header,
          value: action.value.replace("${sessionId}", this.id!)
        }]
      },
      condition: {
        tabIds: [this.tabId],
        regexFilter: condition.urlRegex,
        requestMethods: condition.requestMethods,
        resourceTypes: condition.resourceTypes as browser.DeclarativeNetRequest.ResourceType[]
      }
    }
  }

  private async getTabPreviousRuleIds(): Promise<number[]> {
    const prevRules = await browser.declarativeNetRequest.getSessionRules()
    return prevRules.filter(r => r.condition.tabIds?.includes(this.tabId)).map(r => r.id)
  }

  private async startPolling() {
    const pollPeriodSeconds = this.agent.manifest.pollInteractionPeriodSeconds
    if (pollPeriodSeconds) {
      this.pollId = setInterval(async () => await this.pollInteraction(), pollPeriodSeconds * 1000)
    }
  }

  private async pollInteraction() {
    try {
    const summary = await this.agent.solveInteractionSummary({}, this.id!, this.authService)
    await sendToTab(this.tabId, new InteractionSummary(true, summary))
    } catch (e) {
      // exceptions from http methods are already logged so no need to handle them
      const msg = new InteractionSummary(false, e instanceof HttpServiceError ? e.detail : undefined)
      sendToTab(this.tabId, msg);
    }
  }

  public async processInteraction(req: browser.WebRequest.OnCompletedDetailsType): Promise<string | undefined> {
    const actions = this.agent.findMatchingActions(req)
    for (const a of actions) {
      if (a.recordInteraction) {
        const interactionDetail = await this.findInteraction(req, a.recordInteraction)
        return await this.agent.solveInteractionSummary(interactionDetail, this.id!, this.authService)
      }
    }
  }

  private async findInteraction(req: browser.WebRequest.OnCompletedDetailsType, action: RecordInteractionRuleAction): Promise<any> {
    return await fetchJson(this.solveUrlTemplate(action.url, req.url))
  }

  public async processUserMessage(text: string, file: Record<string, string>, msgHandler: (text: string, complete: boolean, success: boolean) => void) {
    try {
      if (file.data) {
        text = await this.agent.transcriptAudio(file.data, this.id!, this.authService);
      }
      const ret = this.agent.ask(text, this.id!, this.authService)
      for await (const part of ret) {
        msgHandler(part, false, true)
      }
      msgHandler("", true, true)
    } catch (e) {
      // exceptions from http methods are already logged so no need to handle them
      msgHandler((e instanceof HttpServiceError ? e.detail : undefined) || "", true, false)
    }
  }

  public async close() {
    await this.removeRequestRules()
    await this.stopPolling()
    try {
      const endAction = this.agent.manifest.onSessionClose
      if (endAction) {
        await fetchJson(this.solveUrlTemplate(endAction.httpRequest.url, this.url), { method: endAction.httpRequest.method })
      }
    } catch (e) {
      // here we can't provide a toast as we do in activation since tab is closed and there is no content where toast can be shown
      console.error(`Problem closing session. Please contact support at ${this.agent.manifest.contactEmail} with the details.`, e)
    }
  }

  private async removeRequestRules() {
    const prevRuleIds = await this.getTabPreviousRuleIds()
    await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: prevRuleIds })
  }

  private async stopPolling() {
    if (this.pollId) {
      clearInterval(this.pollId)
    }
  }

}
