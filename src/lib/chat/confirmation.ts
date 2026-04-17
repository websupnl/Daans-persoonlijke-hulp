/**
 * Confirmation Manager - Handles confirmation flow and user responses
 * 
 * Provides robust confirmation handling across different input types
 */

import { pendingActionManager } from './pending-actions'
import { chatLogger } from './logger'
import { correlationTracker } from './correlation'

export interface ConfirmationRequest {
  sessionId: string
  correlationId: string
  actionId: string
  prompt: string
  expectedInput: ExpectedInput
  timeoutMinutes?: number
}

export interface ConfirmationResponse {
  success: boolean
  confirmed: boolean
  actionId: string
  result?: any
  error?: string
  nextPrompt?: string
}

export interface ExpectedInput {
  type: 'confirmation' | 'text' | 'number' | 'date' | 'choice' | 'yes_no_cancel'
  prompt?: string
  options?: string[]
  validation?: ValidationRule[]
  allowMultiple?: boolean
}

export interface ValidationRule {
  field: string
  required: boolean
  type: 'string' | 'number' | 'boolean' | 'date' | 'email'
  pattern?: string
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
}

export interface ConfirmationFlow {
  id: string
  sessionId: string
  currentStep: number
  totalSteps: number
  steps: ConfirmationStep[]
  completed: boolean
  createdAt: Date
  expiresAt: Date
}

export interface ConfirmationStep {
  id: string
  type: 'confirmation' | 'input' | 'choice'
  prompt: string
  expectedInput: ExpectedInput
  response?: any
  completed: boolean
}

class ConfirmationManager {
  private static instance: ConfirmationManager
  
  static getInstance(): ConfirmationManager {
    if (!ConfirmationManager.instance) {
      ConfirmationManager.instance = new ConfirmationManager()
    }
    return ConfirmationManager.instance
  }

  async requestConfirmation(request: ConfirmationRequest): Promise<{
    success: boolean
    prompt: string
    actionId: string
    expiresAt: Date
  }> {
    try {
      // Store confirmation request
      const confirmationId = this.generateId()
      const expiresAt = new Date(Date.now() + (request.timeoutMinutes || 5) * 60 * 1000)

      await this.storeConfirmationRequest({
        id: confirmationId,
        sessionId: request.sessionId,
        correlationId: request.correlationId,
        actionId: request.actionId,
        prompt: request.prompt,
        expectedInput: request.expectedInput,
        expiresAt
      })

      return {
        success: true,
        prompt: request.prompt,
        actionId: request.actionId,
        expiresAt
      }
    } catch (err) {
      console.error('[ConfirmationManager] Failed to request confirmation:', err)
      return {
        success: false,
        prompt: '',
        actionId: '',
        expiresAt: new Date()
      }
    }
  }

  async handleResponse(
    sessionId: string,
    userInput: string,
    correlationId: string
  ): Promise<ConfirmationResponse> {
    try {
      // Get pending confirmation
      const confirmation = await this.getPendingConfirmation(sessionId)
      if (!confirmation) {
        return {
          success: false,
          confirmed: false,
          actionId: '',
          error: 'No pending confirmation found'
        }
      }

      // Check if expired
      if (confirmation.expiresAt < new Date()) {
        await this.markExpired(confirmation.id)
        return {
          success: false,
          confirmed: false,
          actionId: confirmation.actionId,
          error: 'Confirmation expired'
        }
      }

      // Validate input
      const validationResult = this.validateInput(userInput, confirmation.expectedInput)
      if (!validationResult.valid) {
        return {
          success: false,
          confirmed: false,
          actionId: confirmation.actionId,
          error: validationResult.errors.join(', ')
        }
      }

      // Handle different input types
      let confirmed = false
      let result: any

      switch (confirmation.expectedInput.type) {
        case 'yes_no_cancel':
          confirmed = this.parseYesNoCancel(userInput)
          if (confirmed) {
            const actionResult = await pendingActionManager.handleConfirmation(
              sessionId,
              'yes',
              correlationId
            )
            result = actionResult.result
          } else if (userInput.toLowerCase().includes('nee') || userInput.toLowerCase().includes('cancel')) {
            await pendingActionManager.handleConfirmation(
              sessionId,
              'cancel',
              correlationId
            )
          }
          break

        case 'confirmation':
          confirmed = this.parseConfirmation(userInput)
          if (confirmed) {
            const actionResult = await pendingActionManager.handleConfirmation(
              sessionId,
              'yes',
              correlationId
            )
            result = actionResult.result
          }
          break

        case 'choice':
          const choiceResult = this.parseChoice(userInput, confirmation.expectedInput.options || [])
          if (choiceResult.valid) {
            confirmed = true
            result = { choice: choiceResult.value }
          }
          break

        case 'text':
        case 'number':
        case 'date':
          confirmed = true
          result = { value: validationResult.parsedValue }
          break
      }

      // Mark confirmation as completed
      await this.markCompleted(confirmation.id, confirmed, userInput)

      return {
        success: true,
        confirmed,
        actionId: confirmation.actionId,
        result,
        error: confirmed ? undefined : 'Action not confirmed'
      }
    } catch (err) {
      console.error('[ConfirmationManager] Failed to handle response:', err)
      return {
        success: false,
        confirmed: false,
        actionId: '',
        error: err instanceof Error ? err.message : 'Unknown error'
      }
    }
  }

  async createMultiStepConfirmation(
    sessionId: string,
    steps: ConfirmationStep[],
    correlationId: string
  ): Promise<string> {
    const flowId = this.generateId()
    const flow: ConfirmationFlow = {
      id: flowId,
      sessionId,
      currentStep: 0,
      totalSteps: steps.length,
      steps,
      completed: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    }

    await this.storeConfirmationFlow(flow)
    return flowId
  }

  async handleMultiStepResponse(
    sessionId: string,
    userInput: string,
    correlationId: string
  ): Promise<{
    success: boolean
    completed: boolean
    currentStep: number
    totalSteps: number
    nextPrompt?: string
    results?: any[]
  }> {
    const flow = await this.getConfirmationFlow(sessionId)
    if (!flow || flow.completed) {
      return {
        success: false,
        completed: true,
        currentStep: 0,
        totalSteps: 0
      }
    }

    const currentStep = flow.steps[flow.currentStep]
    const validationResult = this.validateInput(userInput, currentStep.expectedInput)

    if (!validationResult.valid) {
      return {
        success: false,
        completed: false,
        currentStep: flow.currentStep,
        totalSteps: flow.totalSteps,
        nextPrompt: `Fout: ${validationResult.errors.join(', ')}. ${currentStep.prompt}`
      }
    }

    // Store response
    currentStep.response = validationResult.parsedValue
    currentStep.completed = true

    // Move to next step
    flow.currentStep++

    if (flow.currentStep >= flow.totalSteps) {
      flow.completed = true
      await this.markFlowCompleted(flow.id)
      
      // Execute all actions
      const results = await this.executeMultiStepActions(flow)
      
      return {
        success: true,
        completed: true,
        currentStep: flow.totalSteps,
        totalSteps: flow.totalSteps,
        results
      }
    } else {
      await this.updateFlow(flow)
      
      return {
        success: true,
        completed: false,
        currentStep: flow.currentStep,
        totalSteps: flow.totalSteps,
        nextPrompt: flow.steps[flow.currentStep].prompt
      }
    }
  }

  private parseYesNoCancel(input: string): boolean {
    const yesPatterns = ['ja', 'j', 'yes', 'y', 'oké', 'oke', 'doe het', 'uitvoeren', 'bevestig']
    const noPatterns = ['nee', 'n', 'no', 'annuleer', 'cancel', 'niet doen', 'stop']
    
    const lowerInput = input.toLowerCase().trim()
    
    return yesPatterns.some(pattern => lowerInput.includes(pattern)) && 
           !noPatterns.some(pattern => lowerInput.includes(pattern))
  }

  private parseConfirmation(input: string): boolean {
    const patterns = ['ja', 'j', 'yes', 'y', 'oké', 'oke', 'bevestig', 'doe het', 'uitvoeren']
    const lowerInput = input.toLowerCase().trim()
    
    return patterns.some(pattern => lowerInput.includes(pattern))
  }

  private parseChoice(input: string, options: string[]): { valid: boolean; value?: string } {
    const lowerInput = input.toLowerCase().trim()
    
    // Try exact match
    if (options.includes(lowerInput)) {
      return { valid: true, value: lowerInput }
    }
    
    // Try partial match
    for (const option of options) {
      if (option.includes(lowerInput) || lowerInput.includes(option)) {
        return { valid: true, value: option }
      }
    }
    
    // Try number selection
    const numMatch = lowerInput.match(/^(\d+)$/)
    if (numMatch) {
      const index = parseInt(numMatch[1]) - 1
      if (index >= 0 && index < options.length) {
        return { valid: true, value: options[index] }
      }
    }
    
    return { valid: false }
  }

  private validateInput(input: string, expectedInput: ExpectedInput): {
    valid: boolean
    errors: string[]
    parsedValue?: any
  } {
    const errors: string[] = []
    let parsedValue: any = input

    // Type-specific validation
    switch (expectedInput.type) {
      case 'number':
        const num = parseFloat(input)
        if (isNaN(num)) {
          errors.push('Ongeldig getal')
        } else {
          parsedValue = num
          if (expectedInput.validation?.min !== undefined && num < expectedInput.validation.min) {
            errors.push(`Getal moet minimaal ${expectedInput.validation.min} zijn`)
          }
          if (expectedInput.validation?.max !== undefined && num > expectedInput.validation.max) {
            errors.push(`Getal mag maximaal ${expectedInput.validation.max} zijn`)
          }
        }
        break

      case 'date':
        const date = new Date(input)
        if (isNaN(date.getTime())) {
          errors.push('Ongeldige datum')
        } else {
          parsedValue = date.toISOString()
        }
        break

      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailPattern.test(input)) {
          errors.push('Ongeldig e-mailadres')
        }
        break

      case 'string':
        if (expectedInput.validation?.minLength && input.length < expectedInput.validation.minLength) {
          errors.push(`Moet minimaal ${expectedInput.validation.minLength} karakters bevatten`)
        }
        if (expectedInput.validation?.maxLength && input.length > expectedInput.validation.maxLength) {
          errors.push(`Mag maximaal ${expectedInput.validation.maxLength} karakters bevatten`)
        }
        if (expectedInput.validation?.pattern && !new RegExp(expectedInput.validation.pattern).test(input)) {
          errors.push('Ongeldig formaat')
        }
        break
    }

    return {
      valid: errors.length === 0,
      errors,
      parsedValue
    }
  }

  private async storeConfirmationRequest(request: {
    id: string
    sessionId: string
    correlationId: string
    actionId: string
    prompt: string
    expectedInput: ExpectedInput
    expiresAt: Date
  }): Promise<void> {
    // Implementation would store in database
    // For now, this is a placeholder
  }

  private async getPendingConfirmation(sessionId: string): Promise<{
    id: string
    sessionId: string
    correlationId: string
    actionId: string
    prompt: string
    expectedInput: ExpectedInput
    expiresAt: Date
  } | null> {
    // Implementation would fetch from database
    // For now, check pending action manager
    const pending = await pendingActionManager.getPendingAction(sessionId)
    if (!pending) return null

    return {
      id: pending.id,
      sessionId: pending.sessionId,
      correlationId: pending.correlationId,
      actionId: pending.id,
      prompt: pending.confirmationPrompt,
      expectedInput: { type: 'yes_no_cancel' },
      expiresAt: pending.expiresAt
    }
  }

  private async markExpired(confirmationId: string): Promise<void> {
    // Implementation would mark as expired in database
  }

  private async markCompleted(confirmationId: string, confirmed: boolean, response: string): Promise<void> {
    // Implementation would mark as completed in database
  }

  private async storeConfirmationFlow(flow: ConfirmationFlow): Promise<void> {
    // Implementation would store flow in database
  }

  private async getConfirmationFlow(sessionId: string): Promise<ConfirmationFlow | null> {
    // Implementation would fetch from database
    return null
  }

  private async updateFlow(flow: ConfirmationFlow): Promise<void> {
    // Implementation would update flow in database
  }

  private async markFlowCompleted(flowId: string): Promise<void> {
    // Implementation would mark flow as completed
  }

  private async executeMultiStepActions(flow: ConfirmationFlow): Promise<any[]> {
    const results: any[] = []
    
    for (const step of flow.steps) {
      if (step.response) {
        results.push({
          step: step.id,
          response: step.response,
          completed: step.completed
        })
      }
    }
    
    return results
  }

  private generateId(): string {
    return `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async getConfirmationStats(): Promise<{
    total: number
    pending: number
    confirmed: number
    cancelled: number
    expired: number
  }> {
    // Implementation would fetch stats from database
    return {
      total: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      expired: 0
    }
  }
}

export const confirmationManager = ConfirmationManager.getInstance()
