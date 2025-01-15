export interface Step {
  selector: string
  action: string
  value?: string
  description?: string
}

export interface RunnerState {
  currentStepIndex: number
  steps: Step[]
}
