import { Step, RunnerState } from "./interfaces";
import CircleControls from "ai-circle";

export class Runner {
  startIndex: number = 0
  steps: Step[] = []
  storageKey: string = "runner_state"

  //#region Waits
  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForElement(selector: string, timeout = 5000): Promise<Element> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = this.getElementBySelector(selector);
      if (element) return element;
      await this.wait(100);
    }

    throw new Error(`Timeout waiting for element: ${selector}`);
  }
  //#endregion

  //#region State
  private loadState(): RunnerState | null {
    const state = sessionStorage.getItem(this.storageKey);
    return state ? JSON.parse(state) : null;
  }

  private saveState(stepIndex: number) {
    const state: RunnerState = {
      currentStepIndex: stepIndex,
      steps: this.steps
    };

    sessionStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  private clearState() {
    sessionStorage.removeItem(this.storageKey);
  }
  //#endregion

  //#region Element Getters
  private getElementBySelector(selector: string): HTMLElement | null {
    const element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return element.singleNodeValue as HTMLElement;
  }
  //#endregion

  private async runStep(step: Step, isLastStep: boolean): Promise<void> {
    // Wait for element
    const element = await this.waitForElement(step.selector);
    if (element) await this.wait(1500);

    // Show circle with ✦ icon to highlight the element
    CircleControls.showCircle(element as HTMLElement, "PURPLE");
    await this.wait(1000);

    // Execute action
    switch (step.action) {
      case "click":
        (element as HTMLElement).click();
        break;
      case "fill":
        (element as HTMLInputElement).value = step.value || "";
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      case "scroll":
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
    }

    // This is made on purpose to emulate a real user interaction
    if (!isLastStep) await this.wait(1000);
    CircleControls.hideCircle();
  }

  public async runFlow(steps: Step[]): Promise<boolean> {
    this.steps = steps

    const savedState = this.loadState()

    if (savedState) {
      this.steps = savedState.steps
      this.startIndex = savedState.currentStepIndex
    }

    for (let i = this.startIndex; i < this.steps.length; i++) {
      const step = this.steps[i];
      const isLastStep = i === this.steps.length - 1;
      
      this.saveState(i+1);

      await this.runStep(step, isLastStep);

      if (isLastStep) {
        this.clearState();
      }
    }
    return true
  }
}
