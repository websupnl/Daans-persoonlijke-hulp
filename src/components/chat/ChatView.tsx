'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, Sparkles } from 'lucide-react'
import { cn, formatMarkdown } from '@/lib/utils'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

const QUICK_COMMANDS = [
  'Toon open todos',
  'Zet in todo om ...',
  'Noteer: ...',
  'Toon mijn financiën',
  'Heb gesport vandaag',
  'Help',
]

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then(d => {
        if (d.data?.length) {
          setMessages(d.data)
        } else {
          // Welkomstbericht
          setMessages([{
            id: 0,
            role: 'assistant',
            content: `Hey Daan! 👋 Ik ben je persoonlijke hulp. Ik kan je helpen met todos, notes, contacten, financiën, gewoontes en meer.\n\nTip: Typ **help** voor een overzicht van wat ik kan, of probeer:\n• _"Zet in todo om factuur te sturen naar MCE voor hosting"_\n• _"Noteer: idee voor nieuwe feature"_\n• _"Toon open todos"_`,
            created_at: new Date().toISOString(),
          }])
        }
      })
      .finally(() => setInitialLoad(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response || 'Er ging iets mis.',
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Oeps, er ging iets mis. Probeer het opnieuw.',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (initialLoad) {
    return <div className="flex items-center justify-center h-full"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center">
          <Sparkles size={16} className="text-brand-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-white">Persoonlijke Assistent</h1>
          <p className="text-[11px] text-slate-500">Typ in het Nederlands of Engels</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-3 animate-fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={14} className="text-brand-400" />
              </div>
            )}
            <div className={cn(
              'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-tr-sm'
                : 'bg-[#13151c] border border-white/5 text-slate-300 rounded-tl-sm'
            )}>
              {msg.role === 'assistant' ? (
                <div
                  className="chat-content"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                />
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={14} className="text-slate-400" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-brand-400" />
            </div>
            <div className="bg-[#13151c] border border-white/5 px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse-soft" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick commands */}
      <div className="px-4 pb-2 flex gap-2 flex-wrap flex-shrink-0">
        {QUICK_COMMANDS.map(cmd => (
          <button
            key={cmd}
            onClick={() => cmd.endsWith('...') ? setInput(cmd.slice(0, -3).trim() + ' ') : sendMessage(cmd)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-all"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="flex gap-2 items-end bg-[#13151c] border border-white/10 rounded-xl p-2 focus-within:border-brand-600/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Typ een bericht... (Enter om te sturen, Shift+Enter voor nieuwe regel)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none outline-none py-1.5 px-2 max-h-32"
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-500 transition-colors flex-shrink-0"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
