'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, CheckCircle, Circle, Apple } from 'lucide-react'
import { GroceryItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'
import { Divider, EmptyPanel, Panel, PanelHeader } from '@/components/ui/Panel'

export default function GroceryView() {
  const [items, setItems] = useState<GroceryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/groceries?completed=0')
      const data = await res.json()
      setItems(data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemTitle.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/groceries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ title: newItemTitle.trim(), quantity: newItemQuantity.trim() || null, category: 'overig' }),
      })
      if (res.ok) {
        setNewItemTitle('')
        setNewItemQuantity('')
        fetchItems()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  const toggleComplete = async (item: GroceryItem) => {
    try {
      const res = await fetch(`/api/groceries/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !item.completed }),
      })
      if (res.ok) setItems(items.filter((i) => i.id !== item.id))
    } catch (err) {
      console.error(err)
    }
  }

  const deleteItem = async (id: number) => {
    if (!confirm('Weet je het zeker?')) return
    try {
      const res = await fetch(`/api/groceries/${id}`, { method: 'DELETE' })
      if (res.ok) setItems(items.filter((i) => i.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <PageShell
      title="Boodschappen"
      subtitle={`${items.length} item${items.length !== 1 ? 's' : ''} op de lijst.`}
    >
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Panel tone="accent" className="xl:sticky xl:top-8 xl:self-start">
          <PanelHeader eyebrow="Toevoegen" title="Wat heb je nodig?" />
          <form onSubmit={addItem} className="mt-4 space-y-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-black/5 bg-white px-3.5 py-2.5">
              <Apple size={14} className="shrink-0 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Product naam..."
                className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
              />
            </div>
            <input
              type="text"
              placeholder="Aantal (bijv. 1 pak)"
              className="w-full rounded-lg border border-black/5 bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
            />
            <button
              type="submit"
              disabled={adding || !newItemTitle.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#202625] px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} />
              {adding ? 'Bezig...' : 'Toevoegen'}
            </button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow={`${items.length} items`}
            title="Te kopen"
          />

          <div className="mt-4">
            {loading ? (
              <div className="space-y-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-container-low" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyPanel
                title="Lijst is leeg"
                description="Voeg hierboven iets toe of vraag het via de chat."
              />
            ) : (
              <div>
                {items.map((item, index) => (
                  <div key={item.id}>
                    {index > 0 && <Divider />}
                    <div className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-container-low/50">
                      <button
                        onClick={() => toggleComplete(item)}
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                          item.completed
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                        )}
                      >
                        {item.completed ? <CheckCircle size={16} /> : <Circle size={16} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-medium text-on-surface', item.completed && 'line-through text-on-surface-variant')}>
                          {item.title}
                        </p>
                        {item.quantity && <p className="text-xs text-on-surface-variant">{item.quantity}</p>}
                      </div>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </PageShell>
  )
}
