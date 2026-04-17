'use client'

import { useState, useEffect } from 'react'
import { X, Save, Trash2, Calendar, Tag, CreditCard, AlignLeft, Info } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import AIActionButton from '@/components/ai/AIActionButton'
import ContextInput from '@/components/ai/ContextInput'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (id: number, data: any) => Promise<void>
  onDelete: (id: number) => Promise<void>
  transaction: any | null
}

const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'
const CATEGORIES = ['overig', 'boodschappen', 'auto', 'transport', 'eten', 'abonnement', 'belasting', 'vaste lasten', 'kleding', 'buffer', 'btw', 'sparen']
const ACCOUNTS = ['privé', 'zakelijk']

export default function TransactionModal({ isOpen, onClose, onSave, onDelete, transaction }: TransactionModalProps) {
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
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const handleAIAction = async (itemId: number, action: string) => {
    setAiLoading(true)
    try {
      const response = await fetch('/api/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          itemType: 'transaction',
          action
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        // Verwerk AI response (bijv. update form met suggesties)
        console.log('AI result:', result)
      }
    } catch (err) {
      console.error('AI action failed:', err)
    } finally {
      setAiLoading(false)
    }
  }

  const handleContextSave = async (itemId: number, context: string) => {
    try {
      const response = await fetch('/api/ai/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          itemType: 'transaction',
          context
        })
      })
      
      if (response.ok) {
        console.log('Context saved successfully')
      }
    } catch (err) {
      console.error('Context save failed:', err)
    }
  }

  useEffect(() => {
    if (transaction) {
      setForm({
        title: transaction.title || '',
        amount: String(transaction.amount || ''),
        type: transaction.type || 'uitgave',
        category: transaction.category || 'overig',
        subcategory: transaction.subcategory || '',
        account: transaction.account || 'privé',
        due_date: transaction.due_date ? transaction.due_date.split('T')[0] : '',
        status: transaction.status || 'betaald',
        user_notes: transaction.user_notes || '',
        description: transaction.description || ''
      })
    }
  }, [transaction])

  if (!isOpen || !transaction) return null

  const handleSave = async () => {
    setLoading(true)
    try {
      await onSave(transaction.id, {
        ...form,
        amount: parseFloat(form.amount) || 0
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md" style={{ background: GRAD }}>
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Transactie Details</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">ID: {transaction.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Title & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Omschrijving</label>
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Bedrag (€)</label>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all"
              />
            </div>
          </div>

          {/* Type & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Type</label>
              <div className="flex gap-1 p-1 bg-gray-50 rounded-2xl border border-gray-100">
                {['inkomst', 'uitgave'].map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(p => ({ ...p, type: t as any }))}
                    className={cn(
                      'flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all',
                      form.type === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Datum</label>
              <div className="relative">
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all appearance-none"
                />
                <Calendar size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Account & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Rekening</label>
              <div className="flex gap-1 p-1 bg-gray-50 rounded-2xl border border-gray-100">
                {ACCOUNTS.map(acc => (
                  <button
                    key={acc}
                    onClick={() => setForm(p => ({ ...p, account: acc }))}
                    className={cn(
                      'flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all',
                      form.account === acc ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {acc === 'privé' ? '🏠' : '💼'} {acc}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Categorie</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all appearance-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* User Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Persoonlijke Notitie</label>
            <div className="relative">
              <textarea
                value={form.user_notes}
                onChange={e => setForm(p => ({ ...p, user_notes: e.target.value }))}
                placeholder="Bijv: 'Lekkere lunch met Jan', 'Vliegticket vakantie'..."
                rows={2}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-100 transition-all resize-none"
              />
              <AlignLeft size={14} className="absolute right-4 top-4 text-gray-300 pointer-events-none" />
            </div>
          </div>

          {/* Subcategory & Description (Advanced) */}
          <div className="pt-2 border-t border-gray-50 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={12} className="text-gray-300" />
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Metadata</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Subcategorie</label>
                <input
                  value={form.subcategory}
                  onChange={e => setForm(p => ({ ...p, subcategory: e.target.value }))}
                  placeholder="Ingegeven door AI..."
                  className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl px-4 py-2 text-xs focus:outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl px-4 py-2 text-xs focus:outline-none transition-all appearance-none"
                >
                  {['betaald', 'concept', 'verstuurd', 'verlopen', 'geannuleerd'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* AI Context Input */}
        {transaction && (
          <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
            <ContextInput
              itemId={transaction.id}
              itemType="transaction"
              onSendContext={handleContextSave}
              placeholder="Voeg context toe voor AI analyse van deze transactie..."
            />
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (confirm('Weet je het zeker?')) onDelete(transaction.id); onClose() }}
              className="p-2.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
              title="Verwijderen"
            >
              <Trash2 size={20} />
            </button>
            {transaction && (
              <AIActionButton
                itemId={transaction.id}
                itemType="transaction"
                onAIAction={handleAIAction}
                size="sm"
                variant="secondary"
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all"
            >
              Annuleer
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !form.title.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-white text-sm font-bold shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: GRAD }}
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
              Opslaan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
