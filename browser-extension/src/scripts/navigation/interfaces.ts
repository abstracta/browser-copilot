export interface Flow {
  key: string
  description: string
  steps: Step[]
}

export interface Step {
  selector: string
  action: string
  value?: string
  description: string
}
