'use client'

import React, { useState, useEffect } from 'react'
import { Plus, ShoppingCart, Trash2, CheckCircle, Circle, Loader2, Apple } from 'lucide-react'
import { GroceryItem } from '@/lib/types'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { cn } from '@/lib/utils'

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
        body: JSON.stringify({
          title: newItemTitle.trim(),
          quantity: newItemQuantity.trim() || null,
          category: 'overig'
        })
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
        body: JSON.stringify({ completed: !item.completed })
      })
      if (res.ok) {
        setItems(items.filter(i => i.id !== item.id))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const deleteItem = async (id: number) => {
    if (!confirm('Weet je het zeker?')) return
    try {
      const res = await fetch(`/api/groceries/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems(items.filter(i => i.id !== id))
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gradient flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}>
              <ShoppingCart size={24} />
            </div>
            Boodschappenlijst
          </h1>
          <p className="text-gray-400 text-sm mt-2 font-medium">Beheer je dagelijkse benodigdheden</p>
        </div>
        <div className="bg-orange-50 text-orange-600 px-4 py-2 rounded-2xl text-sm font-bold border border-orange-100 shadow-sm">
          {items.length} items
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={addItem} className="bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 px-4 py-2">
          <Apple className="text-gray-300" size={20} />
          <input
            type="text"
            placeholder="Wat heb je nodig?"
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-gray-700 font-medium placeholder:text-gray-300"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48 flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl sm:rounded-none">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aantal</span>
          <input
            type="text"
            placeholder="1 pak, 500g..."
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-gray-600 text-sm font-medium placeholder:text-gray-300"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={adding || !newItemTitle.trim()}
          className="h-14 sm:h-auto px-8 rounded-2xl sm:rounded-[1.75rem] btn-gradient font-bold shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2"
        >
          {adding ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus className="h-5 w-5" />}
          <span>Toevoegen</span>
        </button>
      </form>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin h-10 w-10 text-pink-500" />
            <p className="text-gray-400 font-medium animate-pulse">Lijst ophalen...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
            <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-4 text-gray-300">
              <ShoppingCart size={32} />
            </div>
            <p className="text-gray-400 font-bold">Je boodschappenlijst is leeg!</p>
            <p className="text-gray-300 text-sm mt-1">Voeg hierboven iets toe of vraag het aan de chat.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="group bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between hover:border-pink-200 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center gap-5 flex-1">
                  <button
                    onClick={() => toggleComplete(item)}
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                      item.completed 
                        ? "bg-emerald-100 text-emerald-600" 
                        : "bg-gray-50 text-gray-300 hover:bg-pink-50 hover:text-pink-400"
                    )}
                  >
                    {item.completed ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  <div>
                    <h3 className={cn("font-bold text-gray-700 transition-all", item.completed && "text-gray-300 line-through")}>
                      {item.title}
                    </h3>
                    {item.quantity && (
                      <p className="text-xs font-bold text-gray-400 mt-0.5">{item.quantity}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
