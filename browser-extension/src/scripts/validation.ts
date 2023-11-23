export class ValidationResult {
  status: ValidationStatus
  message: string
  cssClass: string

  constructor(status: ValidationStatus, message: string) {
    this.status = status
    this.message = message
    this.cssClass = ValidationStatus[this.status].toLowerCase()
  }

  static valid(): ValidationResult {
    return new ValidationResult(ValidationStatus.VALID, '')
  }

  static error(message: string): ValidationResult {
    return new ValidationResult(ValidationStatus.ERROR, message)
  }

  static warning(message: string): ValidationResult {
    return new ValidationResult(ValidationStatus.WARNING, message)
  }
  
}

export enum ValidationStatus {
  VALID, ERROR, WARNING
}
