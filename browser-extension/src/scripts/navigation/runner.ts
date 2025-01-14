import { Step, Flow } from "./interfaces";
import CircleControls from "ai-circle";

export class Runner {
  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getElementBySelector(selector: string): HTMLElement | null {
    const element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return element.singleNodeValue as HTMLElement;
  }

  private async waitForElement(
    selector: string,
    timeout = 5000
  ): Promise<Element> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = this.getElementBySelector(selector);
      
      if (element) return element;

      await this.wait(100);
    }

    throw new Error(`Timeout waiting for element: ${selector}`);
  }

  private async runStep(step: Step, isLastStep: boolean): Promise<void> {
    // Wait for element
    const element = await this.waitForElement(step.selector);
    if (element) await this.wait(1500);

    // Show circle with ✦ icon to highlight the element
    CircleControls.showCircle(element as HTMLElement);
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

  public async runFlow(flow: Flow): Promise<boolean> {
    for (const step of flow.steps || []) {
      try {
        const isLastStep = step === (flow?.steps?.[flow?.steps?.length - 1]);
        await this.runStep(step, isLastStep);
      } catch (error) {
        throw error;
      }
    }
    return true
  }
}
