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
        content: data.response || data.message || 'Er ging iets mis.',
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
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-shrink-0 bg-white">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
          style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
        >
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-gradient">Persoonlijke Assistent</h1>
          <p className="text-[11px] text-gray-400">Typ in het Nederlands of Engels</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-3 animate-fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
              >
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div className={cn(
              'max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
              msg.role === 'user'
                ? 'text-white rounded-tr-sm'
                : 'bg-gray-50 border border-gray-100 text-gray-700 rounded-tl-sm'
            )}
              style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' } : {}}
            >
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
              <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={14} className="text-gray-500" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 animate-fade-in">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
            >
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-gray-50 border border-gray-100 px-4 py-3.5 rounded-2xl rounded-tl-sm shadow-sm">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
                    style={{
                      background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)',
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick commands */}
      <div className="px-5 pb-3 flex gap-2 flex-wrap flex-shrink-0">
        {QUICK_COMMANDS.map(cmd => (
          <button
            key={cmd}
            onClick={() => cmd.endsWith('...') ? setInput(cmd.slice(0, -3).trim() + ' ') : sendMessage(cmd)}
            className="text-[11px] px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-pink-200 hover:text-gradient transition-all font-medium"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-5 pb-5 flex-shrink-0">
        <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:border-pink-200 transition-colors shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Typ een bericht... (Enter om te sturen, Shift+Enter voor nieuwe regel)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 resize-none outline-none py-1.5 px-2 max-h-32"
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0 text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
