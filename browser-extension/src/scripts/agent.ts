import browser from "webextension-polyfill"
import { Prompt } from "./prompt-repository"
import { fetchJson, postJson } from "./http"

export class Agent {
    url: string
    logo: string
    manifest: AgentManifest
    activationRule: AgentRule
    activationAction: ActivationAction

    public static async fromUrl(url: string): Promise<Agent> {
        return new Agent(url, await fetchJson(url + "/manifest.json"))
    }

    public static fromJsonObject(obj: any): Agent {
        return new Agent(obj.url, obj.manifest)
    }

    private constructor(url: string, manifest: AgentManifest) {
        this.url = url
        this.logo = url + "/logo.png"
        this.manifest = manifest
        this.activationRule = manifest.onHttpRequest?.find(r => r.actions.find(a => a.activate))!
        this.activationAction = this.activationRule?.actions.find(a => a.activate)!.activate!
    }

    public async createSession(locales: string[]): Promise<AgentSession> {
        return await postJson(this.url + "/sessions", { locales: locales })
    }

    public activatesOn(req: browser.WebRequest.OnCompletedDetailsType): boolean {
        if (!this.activationRule) {
            return false
        }
        return this.requestMatchesRuleCondition(req, this.activationRule)
    }

    private requestMatchesRuleCondition(req: browser.WebRequest.OnCompletedDetailsType, rule: AgentRule): boolean {
        return new RegExp(rule.condition.urlRegex!).test(req.url)
            && (!rule.condition.requestMethods || rule.condition.requestMethods!.includes(req.method.toLowerCase()))
            && (!rule.condition.resourceTypes || rule.condition.resourceTypes!.includes(req.type))
    }

    public findMatchingActions(req: browser.WebRequest.OnCompletedDetailsType): AgentRuleAction[] {
        return this.manifest.onHttpRequest ? this.manifest.onHttpRequest.filter(r => this.requestMatchesRuleCondition(req, r))
            .flatMap(r => r.actions) : []
    }

    public async solveInteractionSummary(detail: any, sessionId: string): Promise<string> {
        let interaction = await postJson(this.url + "/sessions/" + sessionId + "/interactions", detail)
        return interaction.summary
    }


    public async ask(msg: string, sessionId: string): Promise<string> {
        let question = await postJson(this.url + "/sessions/" + sessionId + "/questions", { question: msg })
        return question.answer
    }

}

export interface AgentManifest {
    id: string
    name: string
    welcomeMessage: string
    prompts?: Prompt[]
    onSessionClose?: EndAction
    onHttpRequest?: AgentRule[]
}

export interface AgentRule {
    condition: AgentRuleCondition
    actions: AgentRuleAction[]
}

export interface AgentRuleCondition {
    urlRegex: string
    requestMethods?: string[]
    resourceTypes?: string[]
}

export interface AgentRuleAction {
    activate?: ActivationAction
    addHeader?: AddHeaderRuleAction
    recordInteraction?: RecordInteractionRuleAction
}

export interface ActivationAction {
    httpRequest?: HttpRequestAction
}

export interface EndAction {
    httpRequest: HttpRequestAction
}

export interface HttpRequestAction {
    url: string
    method?: string
}

export interface AddHeaderRuleAction {
    header: string
    value: string
}

export interface RecordInteractionRuleAction {
    url: string
}

export interface AgentSession {
    id: string
}
