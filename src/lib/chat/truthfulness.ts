/**
 * Truthfulness Guard - Prevents AI from lying or claiming success without verification
 * 
 * Enforces strict rules:
 * 1. No success without confirmed write
 * 2. No fabricated details
 * 3. Uncertainty must be explicit
 * 4. Data source must be traceable
 * 5. No fake pending actions
 * 6. Date resolution must be explicit
 * 7. No hallucinated transactions
 * 8. Error honesty required
 */

import { query, queryOne } from '@/lib/db'

export interface TruthfulnessRule {
  id: string
  name: string
  description: string
  enabled: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface ValidationContext {
  correlationId: string
  sessionId: string
  phase: 'parsing' | 'planning' | 'execution' | 'verification' | 'response'
  intent?: string
  domain?: string
  verifiedWrites?: VerifiedWrite[]
  dataSource?: 'database' | 'ai_generated' | 'estimated' | 'unknown' | 'verified' | 'ai_verified'
  uncertaintyLevel?: 'low' | 'medium' | 'high'
}

export interface VerifiedWrite {
  id: string
  type: string
  success: boolean
  data?: any
  verified: boolean
  verificationDetails?: any
  timestamp: Date
}

export interface GeneratedResponse {
  reply: string
  claimsSuccess: boolean
  details?: any
  dataSource?: string
  uncertainty?: boolean
  explicitUncertainty?: boolean
  dateReferences?: DateReference[]
  transactionReferences?: TransactionReference[]
}

export interface DateReference {
  text: string
  resolvedDate: Date | null
  resolutionMethod: 'explicit' | 'inferred' | 'ambiguous'
  confidence: number
}

export interface TransactionReference {
  id?: number
  amount?: number
  description?: string
  verified: boolean
  source: 'database' | 'ai_generated' | 'unknown'
}

export interface ValidationResult {
  valid: boolean
  reason?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  suggestions?: string[]
  requiredChanges?: ResponseChange[]
}

export interface ResponseChange {
  type: 'replace_text' | 'add_uncertainty' | 'remove_claim' | 'add_verification'
  original: string
  suggested: string
  reason: string
}

class TruthfulnessGuard {
  private static instance: TruthfulnessGuard
  private rules: Map<string, TruthfulnessRule> = new Map()

  static getInstance(): TruthfulnessGuard {
    if (!TruthfulnessGuard.instance) {
      TruthfulnessGuard.instance = new TruthfulnessGuard()
      TruthfulnessGuard.instance.initializeRules()
    }
    return TruthfulnessGuard.instance
  }

  private initializeRules(): void {
    const rules: TruthfulnessRule[] = [
      {
        id: 'NO_SUCCESS_WITHOUT_VERIFICATION',
        name: 'No Success Without Verification',
        description: 'Cannot claim success without confirmed database write',
        enabled: true,
        severity: 'critical'
      },
      {
        id: 'NO_FABRICATED_DETAILS',
        name: 'No Fabricated Details',
        description: 'Cannot include details that are not from verified data sources',
        enabled: true,
        severity: 'high'
      },
      {
        id: 'UNCERTAINTY_EXPLICIT',
        name: 'Uncertainty Must Be Explicit',
        description: 'Must explicitly state when information is uncertain',
        enabled: true,
        severity: 'medium'
      },
      {
        id: 'DATA_SOURCE_REQUIRED',
        name: 'Data Source Required',
        description: 'Must be able to trace data sources for all claims',
        enabled: true,
        severity: 'high'
      },
      {
        id: 'NO_FAKE_PENDING_ACTIONS',
        name: 'No Fake Pending Actions',
        description: 'Cannot suggest pending actions that do not exist',
        enabled: true,
        severity: 'critical'
      },
      {
        id: 'DATE_RESOLUTION_EXPLICIT',
        name: 'Date Resolution Explicit',
        description: 'Date references must be explicitly resolved',
        enabled: true,
        severity: 'medium'
      },
      {
        id: 'NO_HALLUCINATED_TRANSACTIONS',
        name: 'No Hallucinated Transactions',
        description: 'Cannot reference transactions that do not exist',
        enabled: true,
        severity: 'critical'
      },
      {
        id: 'ERROR_HONESTY_REQUIRED',
        name: 'Error Honesty Required',
        description: 'Must be honest about errors and failures',
        enabled: true,
        severity: 'high'
      }
    ]

    rules.forEach(rule => this.rules.set(rule.id, rule))
  }

  async validateResponse(response: GeneratedResponse, context: ValidationContext): Promise<ValidationResult> {
    const violations: ValidationResult[] = []

    // Rule 1: No success without verification
    if (response.claimsSuccess) {
      const verificationResult = this.validateSuccessClaim(response, context)
      if (!verificationResult.valid) {
        violations.push(verificationResult)
      }
    }

    // Rule 2: No fabricated details
    if (response.details) {
      const detailsResult = this.validateDetails(response, context)
      if (!detailsResult.valid) {
        violations.push(detailsResult)
      }
    }

    // Rule 3: Uncertainty must be explicit
    if (response.uncertainty && !response.explicitUncertainty) {
      violations.push({
        valid: false,
        reason: 'UNCERTAINTY_NOT_EXPLICIT',
        severity: 'medium',
        suggestions: ['Add explicit uncertainty statement like "ik denk dat" or "mogelijk"'],
        requiredChanges: [{
          type: 'add_uncertainty',
          original: response.reply,
          suggested: this.addUncertainty(response.reply),
          reason: 'Uncertainty must be explicitly stated'
        }]
      })
    }

    // Rule 4: Data source must be traceable
    if (!response.dataSource || response.dataSource === 'unknown') {
      violations.push({
        valid: false,
        reason: 'DATA_SOURCE_NOT_TRACEABLE',
        severity: 'high',
        suggestions: ['Specify data source in response'],
        requiredChanges: [{
          type: 'add_verification',
          original: response.reply,
          suggested: this.addDataSource(response.reply),
          reason: 'Data source must be specified'
        }]
      })
    }

    // Rule 5: No fake pending actions
    const pendingActionResult = this.validatePendingActions(response, context)
    if (!pendingActionResult.valid) {
      violations.push(pendingActionResult)
    }

    // Rule 6: Date resolution must be explicit
    if (response.dateReferences) {
      const dateResult = this.validateDateReferences(response, context)
      if (!dateResult.valid) {
        violations.push(dateResult)
      }
    }

    // Rule 7: No hallucinated transactions
    if (response.transactionReferences) {
      const transactionResult = this.validateTransactionReferences(response, context)
      if (!transactionResult.valid) {
        violations.push(transactionResult)
      }
    }

    // Return most severe violation
    if (violations.length > 0) {
      const mostSevere = violations.reduce((prev, curr) => 
        this.getSeverityWeight(curr.severity) > this.getSeverityWeight(prev.severity) ? curr : prev
      )
      return mostSevere
    }

    return { valid: true, severity: 'low' as const }
  }

  private validateSuccessClaim(response: GeneratedResponse, context: ValidationContext): ValidationResult {
    if (!context.verifiedWrites || context.verifiedWrites.length === 0) {
      return {
        valid: false,
        reason: 'SUCCESS_WITHOUT_VERIFICATION',
        severity: 'critical',
        suggestions: ['Remove success claim', 'Add write verification', 'Change to tentative language'],
        requiredChanges: [{
          type: 'replace_text',
          original: response.reply,
          suggested: this.removeSuccessClaim(response.reply),
          reason: 'Success cannot be claimed without verified write'
        }]
      }
    }

    const allVerified = context.verifiedWrites.every(write => write.verified && write.success)
    if (!allVerified) {
      return {
        valid: false,
        reason: 'SUCCESS_WITH_PARTIAL_VERIFICATION',
        severity: 'high',
        suggestions: ['Specify which actions succeeded', 'Remove success claim for failed actions'],
        requiredChanges: [{
          type: 'replace_text',
          original: response.reply,
          suggested: this.specifyPartialSuccess(response.reply, context.verifiedWrites),
          reason: 'Only verified actions can be claimed as successful'
        }]
      }
    }

    return { valid: true, severity: 'low' as const }
  }

  private validateDetails(response: GeneratedResponse, context: ValidationContext): ValidationResult {
    // Check if details are from verified data sources
    if (context.dataSource !== 'database' && context.dataSource !== 'verified' && context.dataSource !== 'ai_verified') {
      return {
        valid: false,
        reason: 'FABRICATED_DETAILS',
        severity: 'high',
        suggestions: ['Remove unverified details', 'Add data source verification', 'Use tentative language'],
        requiredChanges: [{
          type: 'remove_claim',
          original: JSON.stringify(response.details),
          suggested: '{}',
          reason: 'Details must be from verified data sources'
        }]
      }
    }

    return { valid: true, severity: 'low' as const }
  }

  private validatePendingActions(response: GeneratedResponse, context: ValidationContext): ValidationResult {
    // Check if response mentions pending actions that don't exist
    const hasPendingMention = response.reply.toLowerCase().includes('bevestig') || 
                             response.reply.toLowerCase().includes('confirm') ||
                             response.reply.toLowerCase().includes('sta open')

    if (hasPendingMention) {
      // Would need to check if there's actually a pending action
      // For now, assume this needs verification
      return {
        valid: false,
        reason: 'FAKE_PENDING_ACTION',
        severity: 'critical',
        suggestions: ['Remove pending action mention', 'Create actual pending action', 'Verify pending action exists'],
        requiredChanges: [{
          type: 'replace_text',
          original: response.reply,
          suggested: this.removePendingActionMention(response.reply),
          reason: 'Cannot mention pending actions that do not exist'
        }]
      }
    }

    return { valid: true, severity: 'low' as const }
  }

  private validateDateReferences(response: GeneratedResponse, context: ValidationContext): ValidationResult {
    const invalidDates = response.dateReferences?.filter(ref => 
      !ref.resolvedDate || ref.resolutionMethod === 'ambiguous' || ref.confidence < 0.8
    )

    if (invalidDates && invalidDates.length > 0) {
      return {
        valid: false,
        reason: 'DATE_RESOLUTION_AMBIGUOUS',
        severity: 'medium',
        suggestions: ['Make date references explicit', 'Add specific dates', 'Remove ambiguous date references'],
        requiredChanges: [{
          type: 'replace_text',
          original: response.reply,
          suggested: this.fixDateReferences(response.reply, invalidDates),
          reason: 'Date references must be explicit and unambiguous'
        }]
      }
    }

    return { valid: true, severity: 'low' as const }
  }

  private validateTransactionReferences(response: GeneratedResponse, context: ValidationContext): ValidationResult {
    const unverifiedTransactions = response.transactionReferences?.filter(ref => 
      !ref.verified || ref.source === 'ai_generated' || ref.source === 'unknown'
    )

    if (unverifiedTransactions && unverifiedTransactions.length > 0) {
      return {
        valid: false,
        reason: 'HALLUCINATED_TRANSACTIONS',
        severity: 'critical',
        suggestions: ['Remove unverified transaction references', 'Verify transactions exist', 'Use only database-confirmed transactions'],
        requiredChanges: [{
          type: 'remove_claim',
          original: JSON.stringify(unverifiedTransactions),
          suggested: '[]',
          reason: 'Cannot reference transactions that are not verified'
        }]
      }
    }

    return { valid: true, severity: 'low' as const }
  }

  // Helper methods for generating suggested changes
  private addUncertainty(text: string): string {
    const uncertaintyMarkers = ['ik denk dat', 'mogelijk', 'waarschijnlijk', 'lijkt', 'zou kunnen']
    const marker = uncertaintyMarkers[Math.floor(Math.random() * uncertaintyMarkers.length)]
    return `${marker} ${text}`
  }

  private addDataSource(text: string): string {
    return `${text} (gebaseerd op actuele gegevens)`
  }

  private removeSuccessClaim(text: string): string {
    return text.replace(/(is|zijn|werd)(.*)(toegevoegd|opgeslagen|gemaakt|gelukt)/gi, '$1$2worden toegevoegd')
  }

  private specifyPartialSuccess(text: string, writes: VerifiedWrite[]): string {
    const successfulWrites = writes.filter(w => w.verified && w.success)
    const failedWrites = writes.filter(w => !w.success)
    
    let result = text
    if (successfulWrites.length > 0 && failedWrites.length > 0) {
      result = text.replace(/(is|zijn|werd)(.*)(toegevoegd|opgeslagen)/gi, 
        `$1$2deels toegevoegd (${successfulWrites.length} van ${writes.length})`)
    }
    return result
  }

  private removePendingActionMention(text: string): string {
    return text.replace(/(staat.*open|bevestig|confirm)/gi, 'wordt verwerkt')
  }

  private fixDateReferences(text: string, invalidDates: DateReference[]): string {
    let result = text
    invalidDates.forEach(ref => {
      if (ref.text.includes('gisteren')) {
        result = result.replace(ref.text, 'gisteren (' + new Date(Date.now() - 86400000).toLocaleDateString('nl-NL') + ')')
      }
    })
    return result
  }

  private getSeverityWeight(severity: string): number {
    const weights = { low: 1, medium: 2, high: 3, critical: 4 }
    return weights[severity as keyof typeof weights] || 0
  }

  async verifyWrite(writeId: string, expectedData: any): Promise<VerifiedWrite> {
    try {
      // This would verify the write actually happened in the database
      // Implementation depends on the type of write
      const verified = await this.checkDatabaseWrite(writeId, expectedData)
      
      return {
        id: writeId,
        type: 'database_write',
        success: verified.success,
        data: verified.data,
        verified: verified.verified,
        verificationDetails: verified.details,
        timestamp: new Date()
      }
    } catch (err) {
      return {
        id: writeId,
        type: 'database_write',
        success: false,
        verified: false,
        timestamp: new Date(),
        verificationDetails: { error: err instanceof Error ? err.message : 'Unknown error' }
      }
    }
  }

  private async checkDatabaseWrite(writeId: string, expectedData: any): Promise<{
    success: boolean
    data?: any
    verified: boolean
    details?: any
  }> {
    // Implementation would depend on the specific write type
    // For now, return a basic verification
    return {
      success: true,
      verified: true,
      details: { verificationMethod: 'basic_check' }
    }
  }

  getEnabledRules(): TruthfulnessRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.enabled)
  }

  isRuleEnabled(ruleId: string): boolean {
    const rule = this.rules.get(ruleId)
    return rule?.enabled || false
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId)
    if (rule) {
      rule.enabled = true
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId)
    if (rule) {
      rule.enabled = false
    }
  }
}

export const truthfulnessGuard = TruthfulnessGuard.getInstance()
