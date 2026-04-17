# Chat & Actie Architectuur Diepe Analyse

## 1. Executive Summary

### Hoofdproblemen
1. **Confirmatie Flow Kapot**: Bot vraagt om bevestiging zonder pending action state
2. **Truthfulness Guard Afwezig**: Bot claimt succes zonder backend verification
3. **Data Persistence Onbetrouwbaar**: Writes lijken niet altijd echt te gebeuren
4. **Kanaal Inconsistentie**: Telegram en app-chat delen niet alle state
5. **Follow-up Resolution Broke**: "Ja"/"Nee" antwoorden worden niet correct verwerkt

### Root Causes (Top 10)
1. **Geen gecentraliseerde pending action store** - confirmaties worden niet persistent opgeslagen
2. **Geen truthfulness validation layer** - AI responses worden niet gecheckt tegen real data
3. **Session state is te beperkt** - geen pending action tracking per sessie
4. **Execution en response zijn losgekoppeld** - success wordt gemeld vóór write verification
5. **Telegram gebruikt andere session keys** - geen gedeelde state met app-chat
6. **Finance queries hebben geen read-after-write verification** - optimistic responses
7. **Geen correlation tracking** - kan niet volgen welke actie bij welke response hoort
8. **Deterministic en AI paths zijn inconsistent** - verschillende validatie niveaus
9. **Error handling is te los** - failures worden soms geslikt zonder feedback
10. **Domain routing is niet stateful** - context switches breken continuïteit

### Grootste Architectuurprobleem
**Ontbrekende Transactional Chat Pipeline** - De chat flow is niet transactioneel. Er is geen garantie dat een "succesvolle" response ook daadwerkelijk correspondeert met een bevestigde database write. De AI kan success claimen terwijl de write faalt, stil wordt, of naar een verkeerde context gaat.

---

## 2. Scenario-Analyse

### Scenario A: Reminder Confirmatie Faalt
**Flow**: "Wil je dat ik een herinnering instel?" -> "Ja" -> "Er staat niets open om te bevestigen"

**Foutketen**:
1. `planMessage()` genereert confirmatie vraag zonder pending action te creëren
2. `executePendingAction()` wordt aangeroepen maar vindt geen pending action in session state
3. Session state bevat geen `pendingAction` veld
4. Confirmatie state wordt alleen in AI context bewaard, niet persistent

**Verantwoordelijke Lagen**:
- `src/lib/chat/deterministic.ts` - planMessage()
- `src/lib/chat/session-state.ts` - geen pending action storage
- `src/lib/chat/engine.ts` - executePendingAction()

**Root Cause**: **Geen gecentraliseerde pending action store** - confirmaties worden niet persistent opgeslagen tussen chat turns.

**Ernst**: **Kritiek** - Fundamental flow is gebroken

**Fix Richting**: Implementeer persistent pending action store met correlation ID.

### Scenario B: Financiële Tegenstrijdigheden
**Flow**: "Wat heb ik gisteren uitgegeven" -> Bot geeft mogelijk foute data

**Foutketen**:
1. Finance query regex is te breed en kan vandaag/gisteren verwarren
2. Date resolution is niet expliciet getest
3. AI kan details verzinnen zonder echte data validation
4. Geen read-after-write verification voor finance queries

**Verantwoordelijke Lagen**:
- `src/lib/chat/engine.ts` lines 241-287 (finance query fast-path)
- `src/lib/ai/parse-command.ts` - AI generated responses zonder validation
- Geen finance data validation layer

**Root Cause**: **Geen truthfulness guard voor data queries** - AI kan data presenteren zonder verificatie.

**Ernst**: **Hoog** - Data integrity is cruciaal

**Fix Richting**: Implementeer data verification layer met explicit date resolution.

### Scenario C: Uitgave Registratie Onbetrouwbaar
**Flow**: "Uitgave van 17 euro" -> "Toegevoegd" -> Item niet zichtbaar

**Foutketen**:
1. `executeActions()` kan falen zonder duidelijke error
2. Success wordt gemeld vóór write verification
3. UI refresh is niet gegarandeerd
4. Writes kunnen naar verkeerde omgeving gaan (multi-tenant issues)

**Verantwoordelijke Lagen**:
- `src/lib/ai/execute-actions.ts` - geen read-after-write verification
- `src/lib/chat/engine.ts` - success reporting vóór verification
- Database write validation is afwezig

**Root Cause**: **Geen write verification** - success wordt gemeld zonder database confirmatie.

**Ernst**: **Kritiek** - Core functionality is onbetrouwbaar

**Fix Richting**: Implementeer read-after-write verification voor alle writes.

### Scenario D: Telegram/App Chat Inconsistentie
**Flow**:zelfde input geeft verschillende resultaten per kanaal

**Foutketen**:
1. Telegram gebruikt `telegram:${phone}` session key, app gebruikt `chat`
2. Session state is niet gedeeld tussen kanalen
3. Telegram heeft eigen UI generation die afwijkt
4. Context carry-over werkt niet tussen kanalen

**Verantwoordelijke Lagen**:
- `src/lib/telegram/ingest.ts` - verschillende session key generation
- `src/lib/chat/session-state.ts` - geen cross-channel state sharing
- `src/lib/telegram/send-message.ts` - kanaalspecifieke UI

**Root Cause**: **Geen gedeelde session state** - kanalen werken als geïsoleerde systemen.

**Ernst**: **Medium** - UX inconsistentie

**Fix Richting**: Implementeer unified session management met cross-channel state.

---

## 3. Huidige Systeemkaart

### Input Per Kanaal
```
App Chat: POST /api/chat -> processChatMessage()
Telegram: POST /api/telegram/webhook -> ingestMessage() -> processChatMessage()
```

**Probleem**: **Verschillende session keys** - `chat` vs `telegram:${phone}`

### Parsing & Routing
```
1. Deterministic fast-path (planMessage)
2. Grocery fast-path (parseIntent)
3. Finance fast-path (regex queries)
4. AI processing (parseCommandWithAI)
```

**Probleem**: **Inconsistent validation** - deterministic paths hebben geen verification, AI path wel.

### State Management
```
Session State: {
  sessionKey: string
  lastDomain: string | null
  lastResult: LastResult | null
  updatedAt: Date
}
```

**Probleem**: **Geen pending action tracking** - confirmaties hebben geen state.

### Action Selection & Execution
```
AI Actions -> executeActions() -> database writes
Success gemeld vóór verification
```

**Probleem**: **No transactional guarantee** - success en write zijn losgekoppeld.

### Response Generation
```
Direct reply generation zonder backend verification
AI kan details verzinnen
```

**Probleem**: **Geen truthfulness guard** - responses zijn niet geverifieerd.

---

## 4. Gewenste Doelarchitectuur

### Layer 1: Unified Message Intake
```typescript
interface UnifiedMessage {
  id: string
  content: string
  source: 'chat' | 'telegram' | 'api'
  sessionId: string
  userId?: string
  metadata: Record<string, any>
  timestamp: Date
}
```

**Componenten**:
- `MessageIntakeService` - normaliseert alle input
- `SessionManager` - unified session handling
- `CorrelationTracker` - trace message -> action -> result

### Layer 2: Intent & Domain Classification
```typescript
interface IntentResult {
  intent: string
  domain: string
  confidence: number
  entities: Record<string, any>
  requiresConfirmation: boolean
  validationRules: ValidationRule[]
}
```

**Componenten**:
- `IntentClassifier` - unified intent detection
- `DomainRouter` - stateful domain routing
- `EntityExtractor` - structured data extraction

### Layer 3: Dialogue State Manager
```typescript
interface DialogueState {
  sessionId: string
  currentDomain: string | null
  pendingAction: PendingAction | null
  lastResult: LastResult | null
  contextStack: ContextItem[]
  expectedInput: ExpectedInput | null
  expiresAt: Date
}
```

**Componenten**:
- `DialogueStateManager` - persistent state
- `PendingActionManager` - transactional confirmations
- `ContextStack` - context carry-over

### Layer 4: Action Orchestration
```typescript
interface ActionPlan {
  id: string
  actions: Action[]
  requiresConfirmation: boolean
  confirmationPrompt?: string
  validationRules: ValidationRule[]
}
```

**Componenten**:
- `ActionPlanner` - creates action plans
- `ConfirmationManager` - handles confirmations
- `ExecutionEngine` - transactional execution

### Layer 5: Execution Engine
```typescript
interface ExecutionResult {
  actionId: string
  success: boolean
  data?: any
  error?: string
  verified: boolean
  verificationDetails?: VerificationDetails
}
```

**Componenten**:
- `TransactionExecutor` - ACID-compliant execution
- `WriteVerifier` - read-after-write verification
- `RollbackManager` - failed action cleanup

### Layer 6: Truthfulness Guard
```typescript
interface TruthfulnessPolicy {
  noSuccessWithoutVerification: boolean
  noFabricatedDetails: boolean
  uncertaintyExplicit: boolean
  dataSourceRequired: boolean
}
```

**Componenten**:
- `TruthfulnessValidator` - validates responses against data
- `DataVerificationLayer` - ensures all claims are backed
- `UncertaintyMarker` - explicit uncertainty handling

### Layer 7: Response Policy
```typescript
interface ResponsePolicy {
  allowSuccessClaim: boolean
  allowDetailGeneration: boolean
  allowUncertainty: boolean
  dataSource: 'verified' | 'estimated' | 'unknown'
}
```

**Componenten**:
- `ResponseGenerator` - constrained response generation
- `PolicyEnforcer` - enforces truthfulness rules
- `ChannelAdapter` - channel-specific formatting

---

## 5. Truthfulness Ontwerp

### Harde Regels
```typescript
const TRUTHFULNESS_RULES = {
  // 1. No success without confirmed write
  NO_SUCCESS_WITHOUT_VERIFICATION: true,
  
  // 2. No fabricated details
  NO_FABRICATED_DETAILS: true,
  
  // 3. Uncertainty must be explicit
  UNCERTAINTY_EXPLICIT: true,
  
  // 4. Data source must be traceable
  DATA_SOURCE_REQUIRED: true,
  
  // 5. No fake pending actions
  NO_FAKE_PENDING_ACTIONS: true,
  
  // 6. Date resolution must be explicit
  DATE_RESOLUTION_EXPLICIT: true,
  
  // 7. No hallucinated transactions
  NO_HALLUCINATED_TRANSACTIONS: true,
  
  // 8. Error honesty required
  ERROR_HONESTY_REQUIRED: true
}
```

### Implementatie
```typescript
class TruthfulnessGuard {
  validateResponse(response: GeneratedResponse, context: ExecutionContext): ValidationResult {
    // 1. Check success claims
    if (response.claimsSuccess && !context.verifiedWrite) {
      return { valid: false, reason: 'SUCCESS_WITHOUT_VERIFICATION' }
    }
    
    // 2. Check fabricated details
    if (response.details && !context.dataSource) {
      return { valid: false, reason: 'FABRICATED_DETAILS' }
    }
    
    // 3. Check uncertainty
    if (response.isUncertain && !response.explicitUncertainty) {
      return { valid: false, reason: 'UNCERTAINTY_NOT_EXPLICIT' }
    }
    
    return { valid: true }
  }
}
```

### Enforcement Mechanismen
1. **Pre-generation validation** - AI prompts worden gecontroleerd
2. **Post-generation verification** - responses worden gevalideerd
3. **Runtime enforcement** - policy violations worden geblokkeerd
4. **Audit logging** - alle violations worden gelogd

---

## 6. Pending Action / Confirmation Ontwerp

### Pending Action Structure
```typescript
interface PendingAction {
  id: string
  sessionId: string
  actionType: string
  payload: Record<string, any>
  confirmationPrompt: string
  createdAt: Date
  expiresAt: Date
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired'
  correlationId: string
}
```

### Confirmation Flow
```typescript
class ConfirmationManager {
  // 1. Create pending action
  async createPendingAction(sessionId: string, action: Action): Promise<string> {
    const pendingAction: PendingAction = {
      id: generateId(),
      sessionId,
      actionType: action.type,
      payload: action.payload,
      confirmationPrompt: this.generatePrompt(action),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
      status: 'pending',
      correlationId: generateCorrelationId()
    }
    
    await this.storePendingAction(pendingAction)
    return pendingAction.id
  }
  
  // 2. Handle confirmation
  async handleConfirmation(sessionId: string, response: 'yes' | 'no' | 'cancel'): Promise<ActionResult> {
    const pending = await this.getPendingAction(sessionId)
    if (!pending) {
      throw new Error('No pending action found')
    }
    
    if (response === 'yes') {
      const result = await this.executeAction(pending)
      await this.updateStatus(pending.id, 'confirmed')
      return result
    } else {
      await this.updateStatus(pending.id, 'cancelled')
      return { success: false, reason: 'cancelled' }
    }
  }
}
```

### Cross-Channel Support
```typescript
// Session keys zijn unified: userId:channel:sessionId
const SESSION_KEY_FORMAT = `${userId}:${source}:${sessionId}`

// Cross-channel state sharing
class UnifiedSessionManager {
  async getPendingAction(sessionKey: string): Promise<PendingAction | null> {
    // Works for both chat and telegram
  }
}
```

---

## 7. Finance Reliability Ontwerp

### Read Operations
```typescript
class FinanceReadService {
  async queryFinances(query: FinanceQuery): Promise<VerifiedFinanceResult> {
    // 1. Parse and validate query
    const validatedQuery = this.validateQuery(query)
    
    // 2. Execute with explicit date resolution
    const result = await this.executeQuery(validatedQuery)
    
    // 3. Verify data integrity
    const verified = await this.verifyResult(result)
    
    // 4. Return with metadata
    return {
      ...verified,
      dataSource: 'database',
      queryTimestamp: new Date(),
      verificationStatus: 'verified'
    }
  }
  
  private validateQuery(query: FinanceQuery): ValidatedQuery {
    // Explicit date resolution
    if (query.period === 'yesterday') {
      return { ...query, dateRange: this.getYesterdayRange() }
    }
    // Add more explicit date parsing
  }
}
```

### Write Operations
```typescript
class FinanceWriteService {
  async createTransaction(transaction: CreateTransactionRequest): Promise<VerifiedResult> {
    // 1. Validate input
    const validated = this.validateTransaction(transaction)
    
    // 2. Execute write
    const writeResult = await this.executeWrite(validated)
    
    // 3. Read-after-write verification
    const verification = await this.verifyWrite(writeResult.id, validated)
    
    // 4. Return verified result
    if (!verification.verified) {
      throw new Error('Write verification failed')
    }
    
    return {
      success: true,
      data: verification.data,
      verified: true,
      verificationDetails: verification.details
    }
  }
  
  private async verifyWrite(id: number, expected: CreateTransactionRequest): Promise<VerificationResult> {
    const actual = await this.getTransaction(id)
    
    // Verify all fields match
    const matches = this.compareTransaction(expected, actual)
    
    return {
      verified: matches,
      data: actual,
      details: {
        expectedFields: Object.keys(expected),
        actualFields: Object.keys(actual),
        mismatches: this.findMismatches(expected, actual)
      }
    }
  }
}
```

---

## 8. Telegram + App Channel Consistency

### Unified Session Management
```typescript
class UnifiedSessionManager {
  // Unified session key format
  private getSessionKey(source: string, userId: string): string {
    return `${userId}:${source}:default`
  }
  
  // Cross-channel state sharing
  async getUnifiedSession(userId: string): Promise<UnifiedSession> {
    const sessions = await Promise.all([
      this.getSession(this.getSessionKey('chat', userId)),
      this.getSession(this.getSessionKey('telegram', userId))
    ])
    
    return this.mergeSessions(sessions)
  }
  
  private mergeSessions(sessions: Session[]): UnifiedSession {
    // Merge logic prioritizing most recent data
  }
}
```

### Channel-Specific Adapters
```typescript
interface ChannelAdapter {
  formatResponse(response: UnifiedResponse): ChannelResponse
  parseInput(input: ChannelInput): UnifiedMessage
  generateUI(actions: Action[]): ChannelUI
}

class ChatAdapter implements ChannelAdapter {
  formatResponse(response: UnifiedResponse): ChatResponse {
    return {
      text: response.text,
      actions: response.actions,
      metadata: response.metadata
    }
  }
}

class TelegramAdapter implements ChannelAdapter {
  formatResponse(response: UnifiedResponse): TelegramResponse {
    return {
      text: this.stripMarkdown(response.text),
      replyMarkup: this.generateKeyboard(response.actions),
      parseMode: 'HTML'
    }
  }
}
```

---

## 9. Debug & Observability Plan

### Correlation Tracking
```typescript
interface CorrelationContext {
  messageId: string
  sessionId: string
  actionId?: string
  writeId?: string
  timestamp: Date
  channel: string
  userId: string
}

class CorrelationTracker {
  async trackMessage(message: UnifiedMessage): Promise<string> {
    const correlationId = generateId()
    await this.storeContext({
      messageId: message.id,
      correlationId,
      sessionId: message.sessionId,
      timestamp: message.timestamp,
      channel: message.source,
      userId: message.userId
    })
    return correlationId
  }
  
  async trackAction(correlationId: string, action: Action): Promise<string> {
    const actionId = generateId()
    await this.updateContext(correlationId, { actionId, action })
    return actionId
  }
}
```

### Comprehensive Logging
```typescript
interface ChatLog {
  correlationId: string
  timestamp: Date
  phase: 'intake' | 'parsing' | 'routing' | 'planning' | 'execution' | 'verification' | 'response'
  data: any
  success: boolean
  error?: string
  duration?: number
}

class ChatLogger {
  async logPhase(correlationId: string, phase: string, data: any): Promise<void> {
    await this.storeLog({
      correlationId,
      timestamp: new Date(),
      phase,
      data,
      success: true
    })
  }
  
  async getFullTrace(correlationId: string): Promise<ChatLog[]> {
    return this.queryLogs({ correlationId })
  }
}
```

### Debug Endpoints
```typescript
// /api/debug/chat-trace?correlationId=xxx
export async function GET(request: NextRequest) {
  const { correlationId } = parseQueryParams(request.searchParams)
  const trace = await chatLogger.getFullTrace(correlationId)
  return NextResponse.json({ trace })
}

// /api/debug/session-state?sessionId=xxx
export async function GET(request: NextRequest) {
  const { sessionId } = parseQueryParams(request.searchParams)
  const state = await sessionManager.getSession(sessionId)
  const pending = await confirmationManager.getPendingAction(sessionId)
  return NextResponse.json({ state, pending })
}
```

---

## 10. Testmatrix

### Confirmation Tests
```typescript
describe('Confirmation Flow', () => {
  test('reminder confirmation yes', async () => {
    // 1. Send reminder request
    const response1 = await processMessage('Wil je dat ik een herinnering instel?')
    expect(response1.actions).toContainEqual({ type: 'confirmation_requested' })
    
    // 2. Send confirmation
    const response2 = await processMessage('Ja')
    expect(response2.reply).toContain('herinnering ingesteld')
    expect(response2.success).toBe(true)
    
    // 3. Verify in database
    const reminders = await getReminders()
    expect(reminders).toHaveLength(1)
  })
  
  test('reminder confirmation no pending action', async () => {
    // Send "Ja" without pending action
    const response = await processMessage('Ja')
    expect(response.reply).toContain('niets open om te bevestigen')
  })
})
```

### Finance Tests
```typescript
describe('Finance Reliability', () => {
  test('yesterday expense query', async () => {
    // Add expense
    await addExpense({ title: 'Test', amount: 50, date: 'yesterday' })
    
    // Query yesterday
    const response = await processMessage('Wat heb ik gisteren uitgegeven?')
    expect(response.reply).toContain('50')
    expect(response.dataVerified).toBe(true)
  })
  
  test('expense write verification', async () => {
    const response = await processMessage('Voeg uitgave toe: test 25 euro')
    expect(response.success).toBe(true)
    
    // Verify in database
    const expenses = await getExpenses()
    expect(expenses).toContainEqual(
      expect.objectContaining({ title: 'test', amount: 25 })
    )
  })
})
```

### Cross-Channel Tests
```typescript
describe('Channel Consistency', () => {
  test('same input different channels', async () => {
    const input = 'Voeg todo toe: test taak'
    
    // App chat
    const appResponse = await processMessage(input, { source: 'chat' })
    
    // Telegram
    const telegramResponse = await processMessage(input, { source: 'telegram' })
    
    expect(appResponse.actions).toEqual(telegramResponse.actions)
    expect(appResponse.success).toBe(telegramResponse.success)
  })
})
```

---

## 11. Implementatieplan in Fasen

### Fase 1: Observability & Tracing (Week 1)
**Doel**: Full visibility in current system
- Implementeer correlation tracking
- Voeg comprehensive logging toe
- Creëer debug endpoints
- Implementeer audit trail

**Wijzigingen**:
- `src/lib/chat/correlation.ts` - correlation tracking
- `src/lib/chat/logger.ts` - comprehensive logging
- `src/app/api/debug/*` - debug endpoints
- Update alle existing chat flows met correlation IDs

**Risico's**: Minimal, logging only
**Validatie**: Trace volledige chat flow

### Fase 2: Truthfulness Guard (Week 2)
**Doel**: Prevent false success claims
- Implementeer truthfulness validation layer
- Voeg write verification toe
- Implementeer data source requirements

**Wijzigingen**:
- `src/lib/chat/truthfulness.ts` - validation layer
- `src/lib/ai/execute-actions.ts` - add verification
- `src/lib/chat/engine.ts` - integrate guard
- Update AI prompts met verification requirements

**Risico's**: Medium, kan existing flows breken
**Validatie**: Test alle success claims

### Fase 3: Pending Action System (Week 3)
**Doel**: Robuste confirmation flow
- Implementeer persistent pending action store
- Creëer confirmation manager
- Add cross-channel session management

**Wijzigingen**:
- `src/lib/chat/pending-actions.ts` - pending action store
- `src/lib/chat/confirmation.ts` - confirmation manager
- `src/lib/chat/session-state.ts` - add pending actions
- Update deterministic flows

**Risico's**: High, core flow changes
**Validatie**: Test all confirmation scenarios

### Fase 4: Finance Hardening (Week 4)
**Doel**: Reliable finance operations
- Implementeer read-after-write verification
- Add explicit date resolution
- Create finance validation layer

**Wijzigingen**:
- `src/lib/finance/verification.ts` - verification layer
- `src/lib/finance/validation.ts` - input validation
- `src/lib/chat/engine.ts` - update finance flows
- Add finance-specific tests

**Risico's**: Medium, finance-specific changes
**Validatie**: Test all finance operations

### Fase 5: Channel Unification (Week 5)
**Doel**: Consistent behavior across channels
- Implement unified session management
- Create channel adapters
- Add cross-channel state sharing

**Wijzigingen**:
- `src/lib/chat/unified-session.ts` - unified sessions
- `src/lib/chat/adapters/*` - channel adapters
- `src/lib/telegram/ingest.ts` - unified integration
- Update session key generation

**Risico's**: Medium, channel-specific changes
**Validatie**: Test cross-channel scenarios

### Fase 6: Regression Tests (Week 6)
**Doel**: Comprehensive test coverage
- Implement automated test suite
- Add integration tests
- Create performance benchmarks

**Wijzigingen**:
- `tests/chat/*` - comprehensive test suite
- `tests/integration/*` - integration tests
- `tests/performance/*` - performance tests
- CI/CD pipeline updates

**Risico's**: Low, testing only
**Validatie**: Full test suite passes

---

## 12. Concrete Code-Aanpak

### Bestanden die Aangepast Moeten Worden
1. **`src/lib/chat/engine.ts`** - Core orchestration
2. **`src/lib/chat/session-state.ts`** - Add pending actions
3. **`src/lib/ai/execute-actions.ts`** - Add verification
4. **`src/lib/chat/deterministic.ts`** - Fix confirmation flow
5. **`src/lib/telegram/ingest.ts`** - Unified session handling
6. **`src/app/api/chat/route.ts`** - Add correlation tracking

### Nieuwe Bestanden die Gemaakt Moeten Worden
1. **`src/lib/chat/correlation.ts`** - Correlation tracking
2. **`src/lib/chat/truthfulness.ts`** - Truthfulness guard
3. **`src/lib/chat/pending-actions.ts`** - Pending action store
4. **`src/lib/chat/confirmation.ts`** - Confirmation manager
5. **`src/lib/chat/unified-session.ts`** - Unified sessions
6. **`src/lib/finance/verification.ts`** - Finance verification

### Abstractions die Ontbreken
1. **UnifiedMessage Interface** - Standardized input format
2. **ActionPlan Interface** - Structured action planning
3. **VerificationResult Interface** - Standardized verification
4. **ChannelAdapter Interface** - Channel abstraction
5. **TruthfulnessPolicy Interface** - Policy enforcement

### Centralisatie Nodig
1. **Message Intake** - Single entry point
2. **Session Management** - Unified state handling
3. **Action Execution** - Centralized execution
4. **Response Generation** - Constrained responses
5. **Error Handling** - Consistent error management

---

## 13. Harde Conclusie

### Grootste Bottleneck
**Geen Transactional Chat Pipeline** - De huidige architectuur heeft geen garantie dat een "succesvolle" response ook daadwerkelijk correspondeert met een bevestigde database write.

### Eerste Prioriteit
**Implementeer Truthfulness Guard** - Voorkom dat de bot success claimt zonder verificatie. Dit is de meest kritieke issue die direct de betrouwbaarheid beïnvloedt.

### Quick Wins
1. **Add correlation tracking** - Directe visibility in chat flows
2. **Implement read-after-write verification** - Directe write verification
3. **Fix confirmation flow** - Directe pending action fix

### Structurele Refactor Nodig
**Complete Chat Pipeline Overhaul** - De huidige architectuur is fundamenteel niet transactioneel en betrouwbaar. Een complete refactor naar een transactionele, verifiable pipeline is noodzakelijk voor production-ready betrouwbaarheid.

### Implementatie Strategie
Begin met observability (Fase 1) voor directe visibility, implementeer daarna truthfulness guard (Fase 2) voor directe betrouwbaarheid, en werk stapsgewijs naar een volledig transactionele chat pipeline.

Deze aanpak transformeert de chat van een "best effort" systeem naar een betrouwbare, transactionele AI assistant die nooit liegt en altijd verifieerbare resultaten levert.
