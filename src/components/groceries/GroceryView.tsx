'use client'

import React, { useState, useEffect } from 'react'
import { Plus, ShoppingCart, Trash2, CheckCircle, Circle, Loader2 } from 'lucide-react'
import { GroceryItem } from '@/lib/types'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

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
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShoppingCart className="text-blue-500" />
          Boodschappenlijst
        </h1>
        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
          {items.length} items
        </span>
      </div>

      <form onSubmit={addItem} className="bg-white p-4 rounded-xl shadow-sm border flex gap-2">
        <input
          type="text"
          placeholder="Wat heb je nodig?"
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Aantal/Hoeveelheid"
          className="w-40 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={newItemQuantity}
          onChange={(e) => setNewItemQuantity(e.target.value)}
        />
        <button
          type="submit"
          disabled={adding || !newItemTitle.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {adding ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus className="h-5 w-5" />}
          Toevoegen
        </button>
      </form>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed">
            <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">Je boodschappenlijst is leeg!</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="group bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between hover:border-blue-300 transition-all"
              >
                <div className="flex items-center gap-4 flex-1">
                  <button
                    onClick={() => toggleComplete(item)}
                    className="text-gray-400 hover:text-green-500 transition-colors"
                  >
                    {item.completed ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <Circle className="h-6 w-6" />
                    )}
                  </button>
                  <div>
                    <h3 className="font-semibold text-gray-800">{item.title}</h3>
                    {item.quantity && (
                      <p className="text-sm text-gray-500">{item.quantity}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
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
