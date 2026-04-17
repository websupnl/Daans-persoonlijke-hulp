import { execute, query } from '@/lib/db'

export type FinanceConfidence = 'high' | 'medium' | 'low'
export type FinanceRecurrenceType =
  | 'none'
  | 'uncertain_recurring_expense'
  | 'recurring_transaction'
  | 'fixed_recurring_bill'
  | 'probable_subscription'
  | 'confirmed_subscription'

export type MerchantType =
  | 'mortgage'
  | 'insurance'
  | 'telecom'
  | 'utilities'
  | 'housing'
  | 'fuel_station'
  | 'supermarket'
  | 'restaurant'
  | 'retail'
  | 'software'
  | 'streaming'
  | 'membership'
  | 'transport'
  | 'healthcare'
  | 'unknown'

export interface FinanceRule {
  id?: number
  merchant_key: string
  merchant_label?: string | null
  category?: string | null
  subcategory?: string | null
  merchant_type?: MerchantType | null
  recurrence_type?: FinanceRecurrenceType | null
  subscription_override?: 'confirm' | 'exclude' | 'fixed_bill' | 'none' | null
  personal_business?: 'privé' | 'zakelijk' | 'gedeeld' | 'unknown' | null
  fixed_cost_flag?: boolean | null
  essential_flag?: boolean | null
  notes?: string | null
  user_verified?: boolean | null
}

export interface FinanceRow {
  id: number
  type: 'inkomst' | 'uitgave'
  title: string
  amount: number
  category: string
  account: string
  status: string
  due_date: string | null
  transaction_date: string
  created_at: string
  merchant_normalized?: string | null
  merchant_raw?: string | null
  subcategory?: string | null
  recurrence_type?: string | null
  recurrence_confidence?: number | null
  subscription_status?: string | null
  fixed_cost_flag?: number | boolean | null
  essential_flag?: number | boolean | null
  personal_business?: string | null
  user_verified?: number | boolean | null
  user_notes?: string | null
  needs_review?: number | boolean | null
}

export interface FinanceTransactionEnrichment {
  merchantKey: string
  merchantDisplay: string
  merchantType: MerchantType
  category: string
  subcategory: string
  categoryConfidence: number
  categoryConfidenceLabel: FinanceConfidence
  excludedFromSubscription: boolean
  personalBusiness: 'privé' | 'zakelijk' | 'gedeeld' | 'unknown'
  rule?: FinanceRule
}

export interface FinanceRecurringGroup {
  merchantKey: string
  displayName: string
  merchantType: MerchantType
  category: string
  subcategory: string
  recurrenceType: FinanceRecurrenceType
  recurrenceLabel: string
  recurrenceConfidence: number
  confidenceLabel: FinanceConfidence
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'irregular' | 'unknown'
  amountPerCharge: number
  monthlyEquivalent: number | null
  monthlyEquivalentLabel: string | null
  count: number
  lastSeen: string
  intervalDaysMedian: number | null
  explanation: string
  needsReview: boolean
  userVerified: boolean
  fixedCost: boolean
  essential: boolean
  reviewReason?: string
}

export interface FinancePattern {
  merchant: string
  totalSpent: number
  visits: number
  avgAmount: number
  category: string
  confidenceLabel: FinanceConfidence
}

export interface FinanceTrend {
  month: string
  income: number
  expenses: number
  net: number
  topCategory: string
}

export interface FinanceAnomaly {
  title: string
  amount: number
  date: string
  reason: string
  severity: 'low' | 'medium' | 'high'
  merchantKey?: string
}

export interface FinanceReviewQuestion {
  queueKey: string
  merchantKey: string
  merchantLabel: string
  prompt: string
  rationale: string
  priority: number
  confidenceLabel: FinanceConfidence
  suggestedActions: Array<{
    label: string
    rulePatch: Partial<FinanceRule>
  }>
}

export interface FinanceAnalysisResult {
  recurringGroups: FinanceRecurringGroup[]
  patterns: FinancePattern[]
  trends: FinanceTrend[]
  anomalies: FinanceAnomaly[]
  reviewQuestions: FinanceReviewQuestion[]
  summary: {
    totalIncome: number
    totalExpenses: number
    net: number
    recurringMonthlyCost: number
    fixedMonthlyCost: number
    subscriptionMonthlyCost: number
    uncertainRecurringCount: number
    transactionCount: number
  }
  aiContext: {
    recurringGroups: FinanceRecurringGroup[]
    reviewQuestions: FinanceReviewQuestion[]
    anomalies: FinanceAnomaly[]
    trends: FinanceTrend[]
    summary: FinanceAnalysisResult['summary']
  }
}

const DUTCH_STOPWORDS = new Set([
  'de', 'het', 'een', 'van', 'voor', 'aan', 'met', 'via', 'bij', 'op', 'te',
  'en', 'of', 'betaling', 'betaalpas', 'pin', 'sepa', 'incasso', 'ideal',
  'overboeking', 'omschrijving', 'factuur', 'transactie', 'name', 'naam',
  'store', 'winkel', 'ref', 'kenmerk', 'pasnr', 'pasvolgnummer', 'card',
])

const BUILTIN_RULES: Array<{
  canonicalKey: string
  canonicalLabel: string
  merchantType: MerchantType
  category: string
  subcategory: string
  patterns: RegExp[]
  excludedFromSubscription?: boolean
  fixedCostHint?: boolean
  essentialHint?: boolean
  subscriptionHint?: boolean
}> = [
  {
    canonicalKey: 'vista_hypotheken',
    canonicalLabel: 'Vista Hypotheken',
    merchantType: 'mortgage',
    category: 'wonen',
    subcategory: 'hypotheek',
    patterns: [/vista\s+hypotheken?/, /\bhypotheken?\b/, /\bhypotheek\b/],
    fixedCostHint: true,
    essentialHint: true,
  },
  {
    canonicalKey: 'de_friesland_zorgverzekeraar',
    canonicalLabel: 'De Friesland Zorgverzekeraar',
    merchantType: 'insurance',
    category: 'verzekeringen',
    subcategory: 'zorgverzekering',
    patterns: [/de\s+friesland/, /zorgverzekeraar/, /\bzorgverzekering\b/, /menzis/, /vgz/, /cz\s+groep/, /zilveren\s+kruis/],
    fixedCostHint: true,
    essentialHint: true,
  },
  {
    canonicalKey: 'centraal_beheer',
    canonicalLabel: 'Centraal Beheer',
    merchantType: 'insurance',
    category: 'verzekeringen',
    subcategory: 'verzekering',
    patterns: [/centraal\s+beheer/, /interpolis/, /allianz/, /asr\s+verzekeringen/],
    fixedCostHint: true,
    essentialHint: true,
  },
  {
    canonicalKey: 'nutsbedrijven',
    canonicalLabel: 'Nutsbedrijven',
    merchantType: 'utilities',
    category: 'vaste lasten',
    subcategory: 'energie',
    patterns: [/vattenfall/, /essent/, /eneco/, /greenchoice/, /budget\s+energie/, /vandebron/],
    fixedCostHint: true,
    essentialHint: true,
  },
  {
    canonicalKey: 'waterbedrijf',
    canonicalLabel: 'Water',
    merchantType: 'utilities',
    category: 'vaste lasten',
    subcategory: 'water',
    patterns: [/vitens/, /pwn/, /brabant\s+water/, /waternet/],
    fixedCostHint: true,
    essentialHint: true,
  },
  {
    canonicalKey: 'kabelnoord',
    canonicalLabel: 'Kabelnoord',
    merchantType: 'telecom',
    category: 'vaste lasten',
    subcategory: 'internet',
    patterns: [/kabelnoord/, /ziggo/, /kpn/],
    fixedCostHint: true,
    essentialHint: true,
  },
  {
    canonicalKey: 'odido',
    canonicalLabel: 'Odido',
    merchantType: 'telecom',
    category: 'vaste lasten',
    subcategory: 'telecom',
    patterns: [/\bodido\b/, /\bt-mobile\b/, /\bsimpel\b/, /\byoufone\b/, /\bvodafone\b/],
    fixedCostHint: true,
    essentialHint: true,
  },
  {
    canonicalKey: 'tanqyou',
    canonicalLabel: 'TanQyou',
    merchantType: 'fuel_station',
    category: 'mobiliteit',
    subcategory: 'brandstof',
    patterns: [/tanqyou/, /thankyou/, /\btinq\b/, /\btango\b/, /\bshell\b/, /\besso\b/, /\bbp\b/, /brandstof/, /tankstation/],
    excludedFromSubscription: true,
  },
  {
    canonicalKey: 'ah_jumbo_supermarkt',
    canonicalLabel: 'Supermarkt',
    merchantType: 'supermarket',
    category: 'boodschappen',
    subcategory: 'supermarkt',
    patterns: [/albert\s*heijn/, /\bah\b/, /\bjumbo\b/, /\blidl\b/, /\baldi\b/, /\bplus\b/, /\bboni\b/, /\bdirk\b/, /supermarkt/],
    excludedFromSubscription: true,
  },
  {
    canonicalKey: 'horeca',
    canonicalLabel: 'Horeca',
    merchantType: 'restaurant',
    category: 'eten',
    subcategory: 'horeca',
    patterns: [/restaurant/, /\bcafe\b/, /koffie/, /lunch/, /diner/, /broodje/, /bakker/, /mcdonald/, /subway/, /pizza/],
    excludedFromSubscription: true,
  },
  {
    canonicalKey: 'streaming_media',
    canonicalLabel: 'Streaming',
    merchantType: 'streaming',
    category: 'abonnement',
    subcategory: 'streaming',
    patterns: [/\bspotify\b/, /\bnetflix\b/, /\bvideoland\b/, /\bdisney\b/, /\bprime video\b/, /\bprime\b/, /\baudiotube\b/, /\byoutube\s+premium\b/],
    subscriptionHint: true,
  },
  {
    canonicalKey: 'software_subscription',
    canonicalLabel: 'Software',
    merchantType: 'software',
    category: 'abonnement',
    subcategory: 'software',
    patterns: [/\bgithub\b/, /\bopenai\b/, /\bchatgpt\b/, /\bgoogle workspace\b/, /\bmicrosoft 365\b/, /\badobe\b/, /\bfigma\b/, /\bnotion\b/, /\bcursor\b/, /\bapple.com\b/, /\bicloud\b/],
    subscriptionHint: true,
  },
  {
    canonicalKey: 'overheid',
    canonicalLabel: 'Overheid',
    merchantType: 'unknown',
    category: 'overig',
    subcategory: 'overheid',
    patterns: [/belastingdienst/, /cjib/, /duo\b/, /gemeente/],
    excludedFromSubscription: true,
  },
]

const FIXED_BILL_TYPES = new Set<MerchantType>(['mortgage', 'insurance', 'telecom', 'utilities', 'housing'])
const EXCLUDED_SUBSCRIPTION_TYPES = new Set<MerchantType>(['fuel_station', 'supermarket', 'restaurant', 'retail', 'transport'])
const SUBSCRIPTION_TYPES = new Set<MerchantType>(['software', 'streaming', 'membership'])

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function maxRelativeDeviation(values: number[], baseline: number): number {
  if (!values.length || baseline === 0) return 1
  return Math.max(...values.map(value => Math.abs(value - baseline) / baseline))
}

function confidenceLabel(score: number): FinanceConfidence {
  if (score >= 0.76) return 'high'
  if (score >= 0.52) return 'medium'
  return 'low'
}

function normalizeDescription(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b(nl\d{2}[a-z]{4}\d{10})\b/g, ' ')
    .replace(/\b[a-z]{2,4}\d{4,}\b/g, ' ')
    .replace(/\b\d{2,}\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function deriveMerchantKey(description: string): { merchantKey: string; merchantDisplay: string } {
  const normalized = normalizeDescription(description)
  for (const rule of BUILTIN_RULES) {
    if (rule.patterns.some(pattern => pattern.test(normalized))) {
      return { merchantKey: rule.canonicalKey, merchantDisplay: rule.canonicalLabel }
    }
  }

  const tokens = normalized
    .split(' ')
    .filter(token => token && token.length > 1 && !DUTCH_STOPWORDS.has(token))
    .slice(0, 4)

  const fallback = tokens.length > 0 ? tokens.join(' ') : 'onbekende merchant'
  return {
    merchantKey: slugify(fallback),
    merchantDisplay: titleCase(fallback),
  }
}

function inferMerchantProfile(description: string) {
  const normalized = normalizeDescription(description)
  const builtIn = BUILTIN_RULES.find(rule => rule.patterns.some(pattern => pattern.test(normalized)))
  if (builtIn) {
    return {
      merchantType: builtIn.merchantType,
      category: builtIn.category,
      subcategory: builtIn.subcategory,
      categoryConfidence: 0.82 + (builtIn.subscriptionHint || builtIn.fixedCostHint ? 0.08 : 0),
      excludedFromSubscription: Boolean(builtIn.excludedFromSubscription),
    }
  }

  if (/\bzorg\b|\bapotheek\b|\bhuisarts\b|\btandarts\b/.test(normalized)) {
    return { merchantType: 'healthcare' as MerchantType, category: 'gezondheid', subcategory: 'zorg', categoryConfidence: 0.72, excludedFromSubscription: false }
  }
  if (/\bns\b|\bov\b|\barriva\b|\bconnexxion\b|\bqbuzz\b|\buber\b/.test(normalized)) {
    return { merchantType: 'transport' as MerchantType, category: 'mobiliteit', subcategory: 'transport', categoryConfidence: 0.71, excludedFromSubscription: true }
  }
  if (/\benergie\b|\bessent\b|\bvattenfall\b|\bnuon\b|\beneco\b/.test(normalized)) {
    return { merchantType: 'utilities' as MerchantType, category: 'vaste lasten', subcategory: 'energie', categoryConfidence: 0.77, excludedFromSubscription: false }
  }
  if (/\bhuur\b|\bwoning\b|\bwoon\b/.test(normalized)) {
    return { merchantType: 'housing' as MerchantType, category: 'wonen', subcategory: 'huur', categoryConfidence: 0.74, excludedFromSubscription: false }
  }
  if (/\bbol\b|\bcoolblue\b|\bmediamarkt\b|\bamazon\b|\bwebshop\b/.test(normalized)) {
    return { merchantType: 'retail' as MerchantType, category: 'winkels', subcategory: 'retail', categoryConfidence: 0.66, excludedFromSubscription: true }
  }

  return {
    merchantType: 'unknown' as MerchantType,
    category: 'overig',
    subcategory: 'onbekend',
    categoryConfidence: 0.38,
    excludedFromSubscription: false,
  }
}

export function enrichTransaction(row: Pick<FinanceRow, 'title' | 'account'>, rule?: FinanceRule): FinanceTransactionEnrichment {
  const merchant = deriveMerchantKey(row.title)
  const inferred = inferMerchantProfile(row.title)

  const merchantType = (rule?.merchant_type || inferred.merchantType) as MerchantType
  const category = rule?.category || inferred.category
  const subcategory = rule?.subcategory || inferred.subcategory
  const categoryConfidence = rule?.user_verified ? 0.99 : inferred.categoryConfidence
  const excludedFromSubscription = rule?.subscription_override === 'exclude'
    ? true
    : rule?.subscription_override === 'confirm'
      ? false
      : inferred.excludedFromSubscription || EXCLUDED_SUBSCRIPTION_TYPES.has(merchantType)

  return {
    merchantKey: rule?.merchant_key || merchant.merchantKey,
    merchantDisplay: rule?.merchant_label || merchant.merchantDisplay,
    merchantType,
    category,
    subcategory,
    categoryConfidence,
    categoryConfidenceLabel: confidenceLabel(categoryConfidence),
    excludedFromSubscription,
    personalBusiness: (rule?.personal_business || (row.account === 'zakelijk' ? 'zakelijk' : row.account === 'privé' ? 'privé' : 'unknown')) as FinanceTransactionEnrichment['personalBusiness'],
    rule,
  }
}

function detectFrequency(intervalMedian: number | null): FinanceRecurringGroup['frequency'] {
  if (intervalMedian == null) return 'unknown'
  if (intervalMedian >= 5 && intervalMedian <= 9) return 'weekly'
  if (intervalMedian >= 24 && intervalMedian <= 38) return 'monthly'
  if (intervalMedian >= 80 && intervalMedian <= 100) return 'quarterly'
  if (intervalMedian >= 330 && intervalMedian <= 390) return 'yearly'
  return 'irregular'
}

function recurrenceLabel(type: FinanceRecurrenceType): string {
  switch (type) {
    case 'fixed_recurring_bill': return 'vaste terugkerende last'
    case 'probable_subscription': return 'waarschijnlijk abonnement'
    case 'confirmed_subscription': return 'bevestigd abonnement'
    case 'recurring_transaction': return 'terugkerende transactie'
    case 'uncertain_recurring_expense': return 'twijfelachtig terugkerend'
    default: return 'geen terugkerend patroon'
  }
}

function monthlyEquivalentFor(frequency: FinanceRecurringGroup['frequency'], amount: number): { value: number | null; label: string | null } {
  if (frequency === 'monthly') return { value: round2(amount), label: 'direct maandelijks bedrag' }
  if (frequency === 'weekly') return { value: round2(amount * 52 / 12), label: 'geschat uit wekelijkse betalingen' }
  if (frequency === 'quarterly') return { value: round2(amount / 3), label: 'geschat uit kwartaalbetaling' }
  if (frequency === 'yearly') return { value: round2(amount / 12), label: 'geschat uit jaarbetaling' }
  return { value: null, label: null }
}

function buildMonthlyTrends(rows: FinanceRow[]): FinanceTrend[] {
  const byMonth = new Map<string, { income: number; expenses: number; categories: Record<string, number> }>()

  for (const row of rows) {
    const month = row.transaction_date.slice(0, 7)
    const current = byMonth.get(month) || { income: 0, expenses: 0, categories: {} }
    if (row.type === 'inkomst') current.income += Number(row.amount)
    else {
      current.expenses += Number(row.amount)
      current.categories[row.category] = (current.categories[row.category] || 0) + Number(row.amount)
    }
    byMonth.set(month, current)
  }

  return Array.from(byMonth.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, value]) => ({
      month,
      income: round2(value.income),
      expenses: round2(value.expenses),
      net: round2(value.income - value.expenses),
      topCategory: Object.entries(value.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'onbekend',
    }))
}

function detectFinanceAnomalies(rows: Array<{ row: FinanceRow; enrichment: FinanceTransactionEnrichment }>): FinanceAnomaly[] {
  const anomalies: FinanceAnomaly[] = []
  const byMerchant = new Map<string, Array<typeof rows[number]>>()

  for (const item of rows.filter(item => item.row.type === 'uitgave')) {
    const current = byMerchant.get(item.enrichment.merchantKey) || []
    current.push(item)
    byMerchant.set(item.enrichment.merchantKey, current)
  }

  for (const [merchantKey, items] of Array.from(byMerchant.entries())) {
    const sorted = [...items].sort((a, b) => new Date(a.row.transaction_date).getTime() - new Date(b.row.transaction_date).getTime())
    const amounts = sorted.map(item => Number(item.row.amount))
    const base = median(amounts)
    if (base && sorted.length >= 3) {
      for (const item of sorted) {
        const ratio = Number(item.row.amount) / base
        if (ratio >= 1.8 && Number(item.row.amount) - base >= 75) {
          anomalies.push({
            title: item.row.title,
            amount: Number(item.row.amount),
            date: item.row.transaction_date,
            reason: `${item.enrichment.merchantDisplay} ligt ${round2(ratio)}x boven je normale bedrag van circa €${round2(base).toFixed(2)}`,
            severity: ratio >= 2.5 ? 'high' : 'medium',
            merchantKey,
          })
        }
      }
    }
  }

  const duplicates = new Map<string, Array<typeof rows[number]>>()
  for (const item of rows) {
    const key = `${item.enrichment.merchantKey}_${item.row.transaction_date}_${Number(item.row.amount).toFixed(2)}`
    const current = duplicates.get(key) || []
    current.push(item)
    duplicates.set(key, current)
  }
  for (const [merchantKey, items] of Array.from(duplicates.entries())) {
    if (items.length > 1) {
      anomalies.push({
        title: items[0].row.title,
        amount: Number(items[0].row.amount),
        date: items[0].row.transaction_date,
        reason: `mogelijke dubbele boeking: ${items.length} keer zelfde merchant, datum en bedrag`,
        severity: 'low',
        merchantKey,
      })
    }
  }

  return anomalies
    .sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.severity] - { high: 3, medium: 2, low: 1 }[a.severity]))
    .slice(0, 8)
}

function buildReviewQuestions(groups: FinanceRecurringGroup[], patterns: FinancePattern[]): FinanceReviewQuestion[] {
  const questions: FinanceReviewQuestion[] = []

  for (const group of groups) {
    const priorityBase = group.amountPerCharge >= 250 || (group.monthlyEquivalent || 0) >= 100 ? 90 : 60

    if (group.recurrenceType === 'uncertain_recurring_expense' || (group.merchantType === 'fuel_station' && !group.userVerified)) {
      if (group.merchantType === 'fuel_station') {
        questions.push({
          queueKey: `${group.merchantKey}:fuel-review`,
          merchantKey: group.merchantKey,
          merchantLabel: group.displayName,
          prompt: `Ik zie meerdere betalingen aan ${group.displayName}. Is dit brandstof, een vaste mobiliteitslast of iets anders?`,
          rationale: 'Deze merchant komt terug, maar brandstof mag niet automatisch als abonnement worden behandeld.',
          priority: priorityBase + 10,
          confidenceLabel: group.confidenceLabel,
          suggestedActions: [
            { label: 'Markeer als brandstof', rulePatch: { merchant_key: group.merchantKey, merchant_label: group.displayName, merchant_type: 'fuel_station', category: 'mobiliteit', subcategory: 'brandstof', subscription_override: 'exclude', user_verified: true } },
            { label: 'Markeer als vaste last', rulePatch: { merchant_key: group.merchantKey, merchant_label: group.displayName, merchant_type: 'transport', category: 'mobiliteit', subcategory: 'mobiliteit', subscription_override: 'fixed_bill', fixed_cost_flag: true, user_verified: true } },
            { label: 'Geen abonnement', rulePatch: { merchant_key: group.merchantKey, merchant_label: group.displayName, subscription_override: 'exclude', user_verified: true } },
          ],
        })
      } else {
        questions.push({
          queueKey: `${group.merchantKey}:recurrence-review`,
          merchantKey: group.merchantKey,
          merchantLabel: group.displayName,
          prompt: `${group.displayName} lijkt terug te komen, maar ik ben nog niet zeker wat voor type uitgave dit is. Hoe wil je dit markeren?`,
          rationale: group.reviewReason || 'De frequentie of semantiek is nog te onzeker voor een harde classificatie.',
          priority: priorityBase,
          confidenceLabel: group.confidenceLabel,
          suggestedActions: [
            { label: 'Vaste last', rulePatch: { merchant_key: group.merchantKey, merchant_label: group.displayName, subscription_override: 'fixed_bill', fixed_cost_flag: true, user_verified: true } },
            { label: 'Abonnement', rulePatch: { merchant_key: group.merchantKey, merchant_label: group.displayName, subscription_override: 'confirm', user_verified: true } },
            { label: 'Geen abonnement', rulePatch: { merchant_key: group.merchantKey, merchant_label: group.displayName, subscription_override: 'exclude', user_verified: true } },
          ],
        })
      }
    }

    if (!group.userVerified && group.recurrenceType === 'fixed_recurring_bill' && group.amountPerCharge >= 250) {
      questions.push({
        queueKey: `${group.merchantKey}:fixed-bill-confirm`,
        merchantKey: group.merchantKey,
        merchantLabel: group.displayName,
        prompt: `${group.displayName} lijkt een ${group.subcategory} die maandelijks terugkomt. Klopt dat?`,
        rationale: `Gebaseerd op ${group.explanation}.`,
        priority: priorityBase + 15,
        confidenceLabel: group.confidenceLabel,
        suggestedActions: [
          { label: 'Ja, vaste last', rulePatch: { merchant_key: group.merchantKey, merchant_label: group.displayName, subscription_override: 'fixed_bill', fixed_cost_flag: true, essential_flag: true, user_verified: true } },
          { label: 'Alleen recurring', rulePatch: { merchant_key: group.merchantKey, merchant_label: group.displayName, recurrence_type: 'recurring_transaction', user_verified: true } },
          { label: 'Geen recurring', rulePatch: { merchant_key: group.merchantKey, merchant_label: group.displayName, subscription_override: 'exclude', fixed_cost_flag: false, user_verified: true } },
        ],
      })
    }
  }

  for (const pattern of patterns) {
    if (pattern.confidenceLabel === 'low' && pattern.totalSpent >= 250) {
      questions.push({
        queueKey: `${slugify(pattern.merchant)}:business-review`,
        merchantKey: slugify(pattern.merchant),
        merchantLabel: pattern.merchant,
        prompt: `${pattern.merchant} heeft relatief veel impact op je uitgaven. Is dit privé, zakelijk of gedeeld?`,
        rationale: 'Zakelijk vs. privé heeft veel invloed op de analyse, maar is nog niet bevestigd.',
        priority: 70,
        confidenceLabel: 'low',
        suggestedActions: [
          { label: 'Zakelijk', rulePatch: { merchant_key: slugify(pattern.merchant), merchant_label: pattern.merchant, personal_business: 'zakelijk', user_verified: true } },
          { label: 'Privé', rulePatch: { merchant_key: slugify(pattern.merchant), merchant_label: pattern.merchant, personal_business: 'privé', user_verified: true } },
          { label: 'Gedeeld', rulePatch: { merchant_key: slugify(pattern.merchant), merchant_label: pattern.merchant, personal_business: 'gedeeld', user_verified: true } },
        ],
      })
    }
  }

  return questions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6)
}

export function analyzeFinance(rows: FinanceRow[], rules: FinanceRule[] = []): FinanceAnalysisResult {
  const ruleMap = new Map(rules.map(rule => [rule.merchant_key, rule]))
  const expenseRows = rows.filter(row => row.type === 'uitgave')
  const enrichedRows = rows.map(row => {
    const fallbackMerchant = deriveMerchantKey(row.title)
    const rule = ruleMap.get(row.merchant_normalized || fallbackMerchant.merchantKey) || ruleMap.get(fallbackMerchant.merchantKey)
    const enrichment = enrichTransaction(row, rule)
    return { row, enrichment }
  })

  const groups = new Map<string, Array<typeof enrichedRows[number]>>()
  for (const item of enrichedRows.filter(item => item.row.type === 'uitgave')) {
    const key = item.enrichment.merchantKey
    const current = groups.get(key) || []
    current.push(item)
    groups.set(key, current)
  }

  const recurringGroups: FinanceRecurringGroup[] = []
  const patterns: FinancePattern[] = []

  for (const [merchantKey, items] of Array.from(groups.entries())) {
    const sorted = [...items].sort((a, b) => new Date(a.row.transaction_date).getTime() - new Date(b.row.transaction_date).getTime())
    const amounts = sorted.map(item => Number(item.row.amount))
    const averageAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
    const amountMedian = median(amounts) || averageAmount
    const amountDeviation = maxRelativeDeviation(amounts, amountMedian || 1)
    const dates = sorted.map(item => new Date(item.row.transaction_date))
    const intervals = dates.slice(1).map((date, index) => (date.getTime() - dates[index].getTime()) / 86400000)
    const intervalMedian = median(intervals)
    const intervalDeviation = intervalMedian ? maxRelativeDeviation(intervals, intervalMedian) : 1
    const frequency = detectFrequency(intervalMedian)
    const monthCoverage = new Set(sorted.map(item => item.row.transaction_date.slice(0, 7))).size
    const daySpread = frequency === 'monthly'
      ? Math.max(...dates.map(date => date.getDate())) - Math.min(...dates.map(date => date.getDate()))
      : 0
    const calendarAligned = frequency === 'monthly' ? daySpread <= 5 : true
    const rule = items[0].enrichment.rule
    const merchantType = items[0].enrichment.merchantType
    const likelyRecurring = items.length >= 2 && intervalMedian !== null && frequency !== 'irregular'

    let recurrenceConfidence = 0.18
    if (items.length >= 2) recurrenceConfidence += 0.16
    if (items.length >= 3) recurrenceConfidence += 0.08
    if (amountDeviation <= 0.03) recurrenceConfidence += 0.24
    else if (amountDeviation <= 0.1) recurrenceConfidence += 0.14
    else if (amountDeviation <= 0.2) recurrenceConfidence += 0.05
    if (intervalMedian !== null) {
      if (frequency !== 'irregular' && frequency !== 'unknown') recurrenceConfidence += 0.18
      if (intervalDeviation <= 0.15) recurrenceConfidence += 0.18
      else if (intervalDeviation <= 0.3) recurrenceConfidence += 0.1
    }
    if (calendarAligned) recurrenceConfidence += 0.08
    if (monthCoverage >= 3) recurrenceConfidence += 0.08
    else if (monthCoverage >= 2) recurrenceConfidence += 0.04
    if (FIXED_BILL_TYPES.has(merchantType) || SUBSCRIPTION_TYPES.has(merchantType)) recurrenceConfidence += 0.08
    if (rule?.user_verified) recurrenceConfidence = 0.99

    recurrenceConfidence = Math.min(0.99, recurrenceConfidence)

    let recurrenceType: FinanceRecurrenceType = 'none'
    let reviewReason: string | undefined
    const fixedCost = Boolean(rule?.fixed_cost_flag) || FIXED_BILL_TYPES.has(merchantType)
    const essential = Boolean(rule?.essential_flag) || FIXED_BILL_TYPES.has(merchantType)
    const userVerified = Boolean(rule?.user_verified)

    if (rule?.subscription_override === 'confirm') {
      recurrenceType = items.length >= 2 ? 'confirmed_subscription' : 'probable_subscription'
    } else if (rule?.subscription_override === 'fixed_bill') {
      recurrenceType = 'fixed_recurring_bill'
    } else if (rule?.subscription_override === 'exclude') {
      recurrenceType = likelyRecurring ? 'recurring_transaction' : 'uncertain_recurring_expense'
    } else if (likelyRecurring && recurrenceConfidence >= 0.64) {
      if (FIXED_BILL_TYPES.has(merchantType)) recurrenceType = 'fixed_recurring_bill'
      else if (SUBSCRIPTION_TYPES.has(merchantType)) recurrenceType = recurrenceConfidence >= 0.8 && items.length >= 3 ? 'confirmed_subscription' : 'probable_subscription'
      else if (EXCLUDED_SUBSCRIPTION_TYPES.has(merchantType)) recurrenceType = 'recurring_transaction'
      else recurrenceType = 'recurring_transaction'
    } else if (items.length >= 2) {
      recurrenceType = 'uncertain_recurring_expense'
      if (EXCLUDED_SUBSCRIPTION_TYPES.has(merchantType)) reviewReason = 'komt vaker terug, maar lijkt inhoudelijk geen abonnement'
      else if (frequency === 'irregular' || frequency === 'unknown') reviewReason = 'interval tussen betalingen is niet stabiel genoeg'
      else reviewReason = 'terugkerend patroon is nog te onzeker'
    }

    let monthlyEquivalent: number | null = null
    let monthlyEquivalentLabel: string | null = null
    if (
      recurrenceConfidence >= 0.64 &&
      frequency !== 'unknown' &&
      frequency !== 'irregular' &&
      (recurrenceType === 'fixed_recurring_bill' || recurrenceType === 'probable_subscription' || recurrenceType === 'confirmed_subscription')
    ) {
      const monthly = monthlyEquivalentFor(frequency, averageAmount)
      monthlyEquivalent = monthly.value
      monthlyEquivalentLabel = monthly.label
    }

    const explanationParts = [
      `${items.length} transacties`,
      frequency !== 'unknown' && frequency !== 'irregular' ? `median interval ${Math.round(intervalMedian || 0)} dagen` : 'geen stabiel interval',
      `bedrag rond €${round2(averageAmount).toFixed(2)}`,
    ]
    if (calendarAligned && frequency === 'monthly') explanationParts.push('kalendermatig maandelijks uitgelijnd')
    if (EXCLUDED_SUBSCRIPTION_TYPES.has(merchantType)) explanationParts.push('merchanttype sluit abonnement vrijwel uit')
    if (rule?.user_verified) explanationParts.push('door gebruiker bevestigd')

    patterns.push({
      merchant: items[0].enrichment.merchantDisplay,
      totalSpent: round2(amounts.reduce((sum, amount) => sum + amount, 0)),
      visits: items.length,
      avgAmount: round2(averageAmount),
      category: items[0].enrichment.category,
      confidenceLabel: confidenceLabel(Math.max(items[0].enrichment.categoryConfidence, recurrenceConfidence)),
    })

    if (recurrenceType !== 'none') {
      recurringGroups.push({
        merchantKey,
        displayName: items[0].enrichment.merchantDisplay,
        merchantType,
        category: items[0].enrichment.category,
        subcategory: items[0].enrichment.subcategory,
        recurrenceType,
        recurrenceLabel: recurrenceLabel(recurrenceType),
        recurrenceConfidence: round2(recurrenceConfidence),
        confidenceLabel: confidenceLabel(recurrenceConfidence),
        frequency,
        amountPerCharge: round2(averageAmount),
        monthlyEquivalent,
        monthlyEquivalentLabel,
        count: items.length,
        lastSeen: sorted[sorted.length - 1].row.transaction_date,
        intervalDaysMedian: intervalMedian ? round2(intervalMedian) : null,
        explanation: explanationParts.join(' · '),
        needsReview: recurrenceType === 'uncertain_recurring_expense' || confidenceLabel(recurrenceConfidence) === 'low' || (!userVerified && recurrenceType !== 'recurring_transaction' && recurrenceConfidence < 0.78),
        userVerified,
        fixedCost,
        essential,
        reviewReason,
      })
    }
  }

  const trends = buildMonthlyTrends(rows)
  const anomalies = detectFinanceAnomalies(enrichedRows)
  const reviewQuestions = buildReviewQuestions(recurringGroups, patterns)

  const totalIncome = rows.filter(row => row.type === 'inkomst').reduce((sum, row) => sum + Number(row.amount), 0)
  const totalExpenses = expenseRows.reduce((sum, row) => sum + Number(row.amount), 0)
  const fixedMonthlyCost = recurringGroups
    .filter(group => group.recurrenceType === 'fixed_recurring_bill' && group.monthlyEquivalent != null)
    .reduce((sum, group) => sum + Number(group.monthlyEquivalent), 0)
  const subscriptionMonthlyCost = recurringGroups
    .filter(group => (group.recurrenceType === 'probable_subscription' || group.recurrenceType === 'confirmed_subscription') && group.monthlyEquivalent != null)
    .reduce((sum, group) => sum + Number(group.monthlyEquivalent), 0)
  const recurringMonthlyCost = fixedMonthlyCost + subscriptionMonthlyCost

  const summary = {
    totalIncome: round2(totalIncome),
    totalExpenses: round2(totalExpenses),
    net: round2(totalIncome - totalExpenses),
    recurringMonthlyCost: round2(recurringMonthlyCost),
    fixedMonthlyCost: round2(fixedMonthlyCost),
    subscriptionMonthlyCost: round2(subscriptionMonthlyCost),
    uncertainRecurringCount: recurringGroups.filter(group => group.recurrenceType === 'uncertain_recurring_expense').length,
    transactionCount: rows.length,
  }

  return {
    recurringGroups: recurringGroups.sort((a, b) => {
      const aValue = a.monthlyEquivalent ?? a.amountPerCharge
      const bValue = b.monthlyEquivalent ?? b.amountPerCharge
      return bValue - aValue
    }),
    patterns: patterns.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10),
    trends: trends.slice(-6),
    anomalies,
    reviewQuestions,
    summary,
    aiContext: {
      recurringGroups,
      reviewQuestions,
      anomalies,
      trends,
      summary,
    },
  }
}

export async function getFinanceRules(): Promise<FinanceRule[]> {
  return query<FinanceRule>(`
    SELECT
      id,
      merchant_key,
      merchant_label,
      category,
      subcategory,
      merchant_type,
      recurrence_type,
      subscription_override,
      personal_business,
      fixed_cost_flag,
      essential_flag,
      notes,
      user_verified
    FROM finance_merchant_rules
    ORDER BY updated_at DESC, created_at DESC
  `)
}

export async function upsertFinanceRule(input: FinanceRule): Promise<FinanceRule | null> {
  const merchantKey = input.merchant_key || slugify(input.merchant_label || '')
  if (!merchantKey) return null

  await execute(`
    INSERT INTO finance_merchant_rules (
      merchant_key,
      merchant_label,
      category,
      subcategory,
      merchant_type,
      recurrence_type,
      subscription_override,
      personal_business,
      fixed_cost_flag,
      essential_flag,
      notes,
      user_verified,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
    ON CONFLICT (merchant_key)
    DO UPDATE SET
      merchant_label = COALESCE(EXCLUDED.merchant_label, finance_merchant_rules.merchant_label),
      category = COALESCE(EXCLUDED.category, finance_merchant_rules.category),
      subcategory = COALESCE(EXCLUDED.subcategory, finance_merchant_rules.subcategory),
      merchant_type = COALESCE(EXCLUDED.merchant_type, finance_merchant_rules.merchant_type),
      recurrence_type = COALESCE(EXCLUDED.recurrence_type, finance_merchant_rules.recurrence_type),
      subscription_override = COALESCE(EXCLUDED.subscription_override, finance_merchant_rules.subscription_override),
      personal_business = COALESCE(EXCLUDED.personal_business, finance_merchant_rules.personal_business),
      fixed_cost_flag = COALESCE(EXCLUDED.fixed_cost_flag, finance_merchant_rules.fixed_cost_flag),
      essential_flag = COALESCE(EXCLUDED.essential_flag, finance_merchant_rules.essential_flag),
      notes = COALESCE(EXCLUDED.notes, finance_merchant_rules.notes),
      user_verified = COALESCE(EXCLUDED.user_verified, finance_merchant_rules.user_verified),
      updated_at = NOW()
  `, [
    merchantKey,
    input.merchant_label || null,
    input.category || null,
    input.subcategory || null,
    input.merchant_type || null,
    input.recurrence_type || null,
    input.subscription_override || null,
    input.personal_business || null,
    input.fixed_cost_flag ?? null,
    input.essential_flag ?? null,
    input.notes || null,
    input.user_verified ?? true,
  ])

  const [saved] = await query<FinanceRule>(`
    SELECT
      id,
      merchant_key,
      merchant_label,
      category,
      subcategory,
      merchant_type,
      recurrence_type,
      subscription_override,
      personal_business,
      fixed_cost_flag,
      essential_flag,
      notes,
      user_verified
    FROM finance_merchant_rules
    WHERE merchant_key = $1
    LIMIT 1
  `, [merchantKey])

  return saved || null
}
