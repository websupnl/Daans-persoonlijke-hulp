import test from 'node:test'
import assert from 'node:assert/strict'

import { analyzeFinance, enrichTransaction, type FinanceRow } from '@/lib/finance/engine'

function expenseRow(id: number, title: string, amount: number, date: string): FinanceRow {
  return {
    id,
    type: 'uitgave',
    title,
    amount,
    category: 'overig',
    account: 'privé',
    status: 'betaald',
    due_date: date,
    transaction_date: date,
    created_at: `${date}T10:00:00.000Z`,
  }
}

test('Vista Hypotheken wordt als maandelijkse vaste last herkend', () => {
  const rows: FinanceRow[] = [
    expenseRow(1, 'Vista Hypotheken', 729.68, '2026-01-02'),
    expenseRow(2, 'Vista Hypotheken', 729.68, '2026-02-02'),
    expenseRow(3, 'Vista Hypotheken', 729.68, '2026-03-02'),
    expenseRow(4, 'Vista Hypotheken', 729.68, '2026-04-02'),
  ]

  const analysis = analyzeFinance(rows)
  const vista = analysis.recurringGroups.find(group => group.merchantKey === 'vista_hypotheken')

  assert.ok(vista)
  assert.equal(vista?.recurrenceType, 'fixed_recurring_bill')
  assert.equal(vista?.frequency, 'monthly')
  assert.equal(vista?.confidenceLabel, 'high')
  assert.equal(vista?.monthlyEquivalent, 729.68)
})

test('TanQyou wordt niet automatisch als abonnement behandeld', () => {
  const rows: FinanceRow[] = [
    expenseRow(1, 'TanQyou Bergum', 62.11, '2026-03-01'),
    expenseRow(2, 'TanQyou Bergum', 54.32, '2026-03-09'),
    expenseRow(3, 'TanQyou Bergum', 71.98, '2026-03-18'),
    expenseRow(4, 'TanQyou Bergum', 58.04, '2026-03-27'),
    expenseRow(5, 'TanQyou Bergum', 65.87, '2026-04-05'),
  ]

  const analysis = analyzeFinance(rows)
  const tanqyou = analysis.recurringGroups.find(group => group.merchantKey === 'tanqyou')

  assert.ok(tanqyou)
  assert.notEqual(tanqyou?.recurrenceType, 'probable_subscription')
  assert.notEqual(tanqyou?.recurrenceType, 'confirmed_subscription')
  assert.equal(tanqyou?.monthlyEquivalent, null)
  assert.ok(analysis.reviewQuestions.some(question => question.merchantKey === 'tanqyou'))
})

test('Jaarlijkse zorgverzekering wordt voorzichtig naar maand omgerekend', () => {
  const rows: FinanceRow[] = [
    expenseRow(1, 'De Friesland Zorgverzekeraar', 177.70, '2025-01-14'),
    expenseRow(2, 'De Friesland Zorgverzekeraar', 177.70, '2026-01-13'),
  ]

  const analysis = analyzeFinance(rows)
  const insurance = analysis.recurringGroups.find(group => group.merchantKey === 'de_friesland_zorgverzekeraar')

  assert.ok(insurance)
  assert.equal(insurance?.recurrenceType, 'fixed_recurring_bill')
  assert.equal(insurance?.frequency, 'yearly')
  assert.equal(insurance?.monthlyEquivalent, 14.81)
})

test('Terugkerende boodschappen blijven buiten abonnementen', () => {
  const rows: FinanceRow[] = [
    expenseRow(1, 'Albert Heijn Burgum', 43.22, '2026-03-01'),
    expenseRow(2, 'Albert Heijn Burgum', 38.04, '2026-03-07'),
    expenseRow(3, 'Albert Heijn Burgum', 47.88, '2026-03-14'),
    expenseRow(4, 'Albert Heijn Burgum', 41.13, '2026-03-21'),
  ]

  const analysis = analyzeFinance(rows)
  const grocery = analysis.recurringGroups.find(group => group.merchantKey === 'ah_jumbo_supermarkt')

  assert.ok(grocery)
  assert.equal(grocery?.recurrenceType, 'recurring_transaction')
  assert.equal(grocery?.monthlyEquivalent, null)
})

test('Merchant enrichment herkent TanQyou als brandstof', () => {
  const enrichment = enrichTransaction({ title: 'TanQyou Bergum', account: 'privé' })

  assert.equal(enrichment.merchantKey, 'tanqyou')
  assert.equal(enrichment.category, 'mobiliteit')
  assert.equal(enrichment.subcategory, 'brandstof')
  assert.equal(enrichment.categoryConfidenceLabel, 'high')
})
