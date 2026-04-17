export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'
import { getFinanceRules, upsertFinanceRule, type FinanceRule } from '@/lib/finance/engine'

export async function GET() {
  const rules = await getFinanceRules()
  return NextResponse.json({ data: rules })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<FinanceRule>
  if (!body.merchant_key && !body.merchant_label) {
    return NextResponse.json({ error: 'merchant_key of merchant_label is verplicht' }, { status: 400 })
  }

  const saved = await upsertFinanceRule({
    merchant_key: body.merchant_key || '',
    merchant_label: body.merchant_label || null,
    category: body.category || null,
    subcategory: body.subcategory || null,
    merchant_type: body.merchant_type || null,
    recurrence_type: body.recurrence_type || null,
    subscription_override: body.subscription_override || null,
    personal_business: body.personal_business || null,
    fixed_cost_flag: body.fixed_cost_flag ?? null,
    essential_flag: body.essential_flag ?? null,
    notes: body.notes || null,
    user_verified: body.user_verified ?? true,
  })

  return NextResponse.json({ data: saved }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const merchantKey = req.nextUrl.searchParams.get('merchant_key')
  if (!merchantKey) {
    return NextResponse.json({ error: 'merchant_key is verplicht' }, { status: 400 })
  }
  const count = await execute('DELETE FROM finance_merchant_rules WHERE merchant_key = $1', [merchantKey])
  return NextResponse.json({ deleted: count > 0 })
}
