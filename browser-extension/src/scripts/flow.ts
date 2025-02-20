import browser from "webextension-polyfill";
import { FlowStepExecution } from "./browser-message";

export class AgentFlow {
  steps: FlowStep[]

  constructor(steps: FlowStep[]) {
      this.steps = steps
  }

  public static fromJsonObject(obj: any): AgentFlow {
      return new AgentFlow(obj.steps.map((s: any) => FlowStep.fromJsonObject(s)))
  }
}

export class FlowStep {
  action: FlowAction
  selector?: string
  value?: string
  
  constructor(action: FlowAction, selector?: string, value?: string) {
      this.action = action
      this.selector = selector
      this.value = value
  }

  public static fromJsonObject(obj: any): FlowStep {
      return new FlowStep(obj.action, obj.selector, obj.value);
  }
}

export enum FlowAction {
  MESSAGE = "message",
  CLICK = "click",
  FILL = "fill",
  GOTO = "goto",
  SCROLL = "scroll"
}

export class FlowExecutor {
  // since runner may generate page navigations, we need to save state in each step and resume execution when starting sidepanel (since entire copilot frame is re created)
  storageKey: string;
  tabId: number;
  msgHandler?: (text: string, complete: boolean) => void

  constructor(tabId: number, msgHandler?: (text: string, complete: boolean) => void) {
    this.tabId = tabId;
    this.storageKey = `flow-${tabId}`;
    this.msgHandler = msgHandler;
  }

  public async runFlow(steps: FlowStep[], startIndex: number = 0): Promise<void> {
    try {
      for (let i = startIndex; i < steps.length; i++) {
        if (steps[i].action === FlowAction.MESSAGE) {
          this.msgHandler!(steps[i].value!, false);
        } else {
          await this.runStepInContentScript(steps[i]);
          await this.saveState(steps, i + 1);
          // we wait some time in case a redirect is generated to avoid running any step that might not properly execute (in particular adding messages that never show, or never complete while resuming a flow)
          await this.wait(500);
        }
      }
      await this.clearState();
    } catch (e) {
      await this.clearState();
      throw e;
    }
  }

  private async runStepInContentScript(step: FlowStep) {
    // we need to send the message to content script se we can't interact with the page outside the extension since they are from different origin
    let err = await browser.tabs.sendMessage(this.tabId, new FlowStepExecution(step));
    if (err) {
      throw new FlowStepError(step, err.errorCode);
    }
  }

  private async saveState(steps: FlowStep[], stepIndex: number) {
    let state = new FlowState(steps, stepIndex);
    let rec: Record<string, any> = {};
    rec[this.storageKey] = state;
    await browser.storage.session.set(rec);
  }

  private async clearState() {
    await browser.storage.session.remove(this.storageKey);
  }

  public async runStep(step: FlowStep): Promise<undefined | FlowStepError> {
    try {
      console.log("Running step", step);
      if (step.action === FlowAction.GOTO) {
        if (step.value) {
          window.location.href = step.value;
        }
        return;
      }
      const element = await this.waitForElement(step);
      await this.highlightElement(element, 1000);
      switch (step.action) {
        case FlowAction.CLICK:
          element.click();
          break;
        case FlowAction.FILL:
          (element as HTMLInputElement).value = step.value || "";
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          break;
        case FlowAction.SCROLL:
          element.scrollIntoView({ behavior: "smooth", block: "start" });
          break;
        default:
          throw new FlowStepError(step, "UnexpectedAction");
      }
    } catch (e) {
      if (e instanceof FlowStepError) {
        return e as FlowStepError;
      } else {
        console.error(
          `Error while running action '${step.action}'` + (step.selector ? ` on '${step.selector}'` : ""),
          e
        );
        return new FlowStepError(step, "UnexpectedError");
      }
    }
  }

  private async waitForElement(step: FlowStep, timeout = 5000): Promise<HTMLElement> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = this.findElement(step);
      if (element) return element;
      await this.wait(100);
    }
    throw new FlowStepError(step, "MissingElement");
  }

  private findElement(step: FlowStep): HTMLElement | null {
    let xpathSelectorPrefix = "xpath:";
    if (!step.selector) {
      throw new FlowStepError(step, "MissingSelector");
    } else if (step.selector.startsWith(xpathSelectorPrefix)) {
      const element = parent.document.evaluate(
        step.selector.substring(xpathSelectorPrefix.length),
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return element.singleNodeValue as HTMLElement;
    } else {
      return parent.document.querySelector(step.selector);
    }
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async highlightElement(element: HTMLElement, duration: number): Promise<void> {
    let circle = this.createCircleAt(element, duration);
    const icon = this.createIcon();
    circle.appendChild(icon);
    document.body.appendChild(circle);
    await this.wait(duration);
    document.body.removeChild(circle);
  }

  private createCircleAt(targetElement: HTMLElement, duration: number): HTMLDivElement {
    const rect = targetElement.getBoundingClientRect();
    const ret = document.createElement("div");
    Object.assign(ret.style, {
      width: "60px",
      height: "60px",
      top: `${rect.top + rect.height / 2}px`,
      left: `${rect.left + rect.width / 2}px`,
      background: "radial-gradient(circle, #9f7aea, #7c3aed)",
      borderRadius: "50%",
      // IMPORTANT: Use 'fixed' so the circle is positioned relative to the viewport.
      position: "fixed",
      transform: "translate(-50%, -50%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 0 15px 5px rgba(159, 122, 234, 0.6), 0 0 30px 15px rgba(124, 58, 237, 0.3)",
      animation: "glow-right 2s infinite",
      pointerEvents: "none",
      zIndex: "9999",
    });
    ret.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.9)", opacity: 0.9 },
        { transform: "translate(-50%, -50%) scale(1.1)", opacity: 0.7 },
        { transform: "translate(-50%, -50%) scale(0.9)", opacity: 0.9 },
      ],
      {
        duration: duration,
        iterations: Infinity,
        direction: "alternate",
      }
    );
    return ret;
  }

  private createIcon(): HTMLDivElement {
    const ret = document.createElement("div");
    ret.innerHTML = "✦";
    Object.assign(ret.style, {
      fontSize: "24px",
      color: "white",
    });
    return ret;
  }

  public async resumeFlow(): Promise<void> {
    let ret = await browser.storage.session.get(this.storageKey);
    let state = ret[this.storageKey] ? FlowState.fromJsonObject(ret[this.storageKey]) : undefined;
    if (state) {
      await this.runFlow(state.steps, state.currentStepIndex);
      this.msgHandler!("", true);
    }
  }

}

class FlowState {
  steps: FlowStep[];
  currentStepIndex: number;

  constructor(steps: FlowStep[], currentStepIndex: number) {
    this.steps = steps;
    this.currentStepIndex = currentStepIndex;
  }

  public static fromJsonObject(obj: any): FlowState {
    return new FlowState(
      obj.steps.map((s: any) => FlowStep.fromJsonObject(s)),
      obj.currentStepIndex
    );
  }
}

export class FlowStepError extends Error {
  step: FlowStep;
  errorCode: string;

  constructor(step: FlowStep, errorCode: string) {
    super();
    this.step = step;
    this.errorCode = errorCode;
  }
}
