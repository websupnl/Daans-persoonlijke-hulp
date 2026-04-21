'use client'

import { useEffect, useState } from 'react'
import { Calendar, CreditCard, Save, Sparkles, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import AIActionButton from '@/components/ai/AIActionButton'
import ContextInput from '@/components/ai/ContextInput'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/interfaces-select'
import { Textarea } from '@/components/ui/interfaces-textarea'
import { Spinner } from '@/components/ui/spinner'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (id: number, data: any) => Promise<void>
  onCreate?: (data: any) => Promise<void>
  onDelete: (id: number) => Promise<void>
  transaction: any | null
}

const GRAD = 'linear-gradient(135deg, #a8cecf 0%, #e6ae8c 100%)'
const CATEGORIES = ['overig', 'boodschappen', 'auto', 'transport', 'eten', 'abonnement', 'belasting', 'vaste lasten', 'kleding', 'buffer', 'btw', 'sparen']
const ACCOUNTS = ['privé', 'zakelijk']

export default function TransactionModal({ isOpen, onClose, onSave, onCreate, onDelete, transaction }: TransactionModalProps) {
  const [form, setForm] = useState({
    title: '',
    amount: '',
    type: 'uitgave',
    category: 'overig',
    subcategory: '',
    account: 'privé',
    due_date: '',
    status: 'betaald',
    user_notes: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    setForm({
      title: transaction?.title || '',
      amount: String(transaction?.amount || ''),
      type: transaction?.type || 'uitgave',
      category: transaction?.category || 'overig',
      subcategory: transaction?.subcategory || '',
      account: transaction?.account || 'privé',
      due_date: transaction?.due_date ? String(transaction.due_date).split('T')[0] : '',
      status: transaction?.status || 'betaald',
      user_notes: transaction?.user_notes || '',
      description: transaction?.description || '',
    })
  }, [transaction, isOpen])

  if (!isOpen) return null

  async function handleAIAction(itemId: number, action: string) {
    setAiLoading(true)
    try {
      await fetch('/api/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, itemType: 'transaction', action }),
      })
    } finally {
      setAiLoading(false)
    }
  }

  async function handleContextSave(itemId: number, context: string) {
    await fetch('/api/ai/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, itemType: 'transaction', context }),
    })
  }

  async function handleSave() {
    setLoading(true)
    try {
      const data = { ...form, amount: parseFloat(form.amount) || 0, due_date: form.due_date || null }
      if (transaction?.id) await onSave(transaction.id, data)
      else await onCreate?.(data)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/35 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-hidden rounded-t-lg border border-outline-variant bg-white shadow-2xl sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white" style={{ background: GRAD }}>
              <CreditCard size={19} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-on-surface">{transaction?.id ? 'Transactie details' : 'Nieuwe transactie'}</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{transaction?.id ? `ID ${transaction.id}` : 'Direct opslaan'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-on-surface-variant hover:bg-surface-container-low" aria-label="Sluiten">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[64dvh] space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Omschrijving">
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="field-input" />
            </Field>
            <Field label="Bedrag">
              <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="field-input font-bold" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Type">
              <div className="flex gap-1 rounded-md border border-outline-variant bg-surface-container-low p-1">
                {['inkomst', 'uitgave'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setForm((p) => ({ ...p, type }))}
                    className={cn('flex-1 rounded px-3 py-2 text-xs font-bold uppercase', form.type === type ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Datum">
              <div className="relative">
                <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} className="field-input" />
                <Calendar size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Rekening">
              <div className="flex gap-1 rounded-md border border-outline-variant bg-surface-container-low p-1">
                {ACCOUNTS.map((account) => (
                  <button
                    key={account}
                    onClick={() => setForm((p) => ({ ...p, account }))}
                    className={cn('flex-1 rounded px-3 py-2 text-xs font-bold uppercase', form.account === account ? 'bg-white text-on-surface shadow-sm' : 'text-on-surface-variant')}
                  >
                    {account}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Categorie">
              <Select value={form.category} onValueChange={(value) => setForm((p) => ({ ...p, category: value }))}>
                <SelectTrigger className="w-full rounded-md bg-surface-container-low px-3 py-2 text-sm">
                  <SelectValue placeholder="Categorie" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Notitie">
            <Textarea value={form.user_notes} onChange={(e) => setForm((p) => ({ ...p, user_notes: e.target.value }))} rows={3} className="w-full resize-none rounded-md border-outline-variant bg-surface-container-low px-3 py-2 text-sm" />
          </Field>

          <div className="grid grid-cols-1 gap-3 border-t border-outline-variant pt-4 sm:grid-cols-2">
            <Field label="Subcategorie">
              <input value={form.subcategory} onChange={(e) => setForm((p) => ({ ...p, subcategory: e.target.value }))} className="field-input" />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(value) => setForm((p) => ({ ...p, status: value }))}>
                <SelectTrigger className="w-full rounded-md bg-surface-container-low px-3 py-2 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {['betaald', 'concept', 'verstuurd', 'verlopen', 'geannuleerd'].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {transaction?.id && (
          <div className="border-t border-outline-variant bg-surface-container-low px-4 py-3 sm:px-6">
            <ContextInput itemId={transaction.id} itemType="transaction" onSendContext={handleContextSave} placeholder="Context voor AI bij deze transactie..." />
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-low px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            {transaction?.id && (
              <>
                <button onClick={() => { if (confirm('Weet je het zeker?')) onDelete(transaction.id); onClose() }} className="rounded-md p-2 text-on-surface-variant hover:bg-red-50 hover:text-red-600" title="Verwijderen">
                  <Trash2 size={18} />
                </button>
                <AIActionButton itemId={transaction.id} itemType="transaction" onAIAction={handleAIAction} size="sm" variant="secondary" />
                {aiLoading && <Sparkles size={15} className="animate-pulse text-on-surface-variant" />}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-white">Annuleer</button>
            <button onClick={handleSave} disabled={loading || !form.title.trim()} className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: GRAD }}>
              {loading ? <Spinner className="h-4 w-4" /> : <Save size={16} />}
              Opslaan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="ml-0.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</span>
      {children}
    </label>
  )
}
