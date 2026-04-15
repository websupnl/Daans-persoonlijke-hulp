'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, Sparkles, Zap, Brain } from 'lucide-react'
import { cn, formatMarkdown } from '@/lib/utils'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

const QUICK_COMMANDS = [
  { label: '📋 Dagplan', cmd: 'Wat moet ik vandaag doen?' },
  { label: '🎯 Gewoontes', cmd: 'Hoe gaan mijn gewoontes?' },
  { label: '💰 Financiën', cmd: 'Hoe staan mijn financiën?' },
  { label: '📊 Overzicht', cmd: 'Geef me een overzicht van hoe ik ervoor sta' },
  { label: '✅ Todos', cmd: 'Toon open todos' },
  { label: '💡 Advies', cmd: 'Geef me advies op basis van mijn data' },
]

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [aiProvider, setAiProvider] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then(d => {
        setAiProvider(d.ai_provider)
        if (d.data?.length) {
          setMessages(d.data)
        } else {
          setMessages([{
            id: 0,
            role: 'assistant',
            content: aiProvider
              ? `Hey Daan! 👋 Ik ben je AI-persoonlijke assistent. Ik heb toegang tot al je data — gewoontes, todos, financiën, dagboek en meer.\n\nVraag me alles, of gebruik de snelknoppen hieronder.`
              : `Hey Daan! 👋\n\nOm de AI-assistent te activeren, voeg een van deze toe aan \`.env.local\`:\n\`\`\`\nANTHROPIC_API_KEY=sk-ant-...\n# of\nOPENAI_API_KEY=sk-...\n\`\`\`\n\nHerstart daarna de server.`,
            created_at: new Date().toISOString(),
          }])
        }
      })
      .finally(() => setInitialLoad(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

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
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      if (data.provider) setAiProvider(data.provider)
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response || 'Er ging iets mis.',
        created_at: new Date().toISOString(),
      }])
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
        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center">
          <Brain size={16} className="text-brand-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-semibold text-white">AI Persoonlijke Assistent</h1>
          <p className="text-[11px] text-slate-500">Stel vragen over je data, maak todos, log gewoontes</p>
        </div>
        {/* AI Provider badge */}
        {aiProvider && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-950/50 border border-emerald-800/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">
              {aiProvider === 'anthropic' ? 'Claude' : 'GPT'} actief
            </span>
          </div>
        )}
        {!aiProvider && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-950/50 border border-amber-800/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium">Geen API key</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-3 animate-fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles size={13} className="text-brand-400" />
              </div>
            )}
            <div className={cn(
              'max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed',
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
              <Sparkles size={13} className="text-brand-400" />
            </div>
            <div className="bg-[#13151c] border border-white/5 px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-slate-600">denkt na...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick commands */}
      <div className="px-4 pb-2 flex gap-1.5 flex-wrap flex-shrink-0">
        {QUICK_COMMANDS.map(({ label, cmd }) => (
          <button
            key={label}
            onClick={() => sendMessage(cmd)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-slate-400 hover:bg-brand-600/20 hover:text-brand-300 transition-all disabled:opacity-40"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="flex gap-2 items-end bg-[#13151c] border border-white/10 rounded-xl p-2 focus-within:border-brand-600/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Vraag iets of geef een opdracht... (Enter om te sturen)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none outline-none py-1.5 px-2"
            style={{ minHeight: '36px', maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
              input.trim() && !loading
                ? 'bg-brand-600 hover:bg-brand-500 text-white'
                : 'bg-white/5 text-slate-600 cursor-not-allowed'
            )}
          >
            {loading ? (
              <Zap size={13} className="animate-pulse text-brand-400" />
            ) : (
              <Send size={13} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-slate-700 mt-1.5 px-2">
          Shift+Enter voor nieuwe regel · AI gebruikt je volledige persoonlijke context
        </p>
      </div>
    </div>
  )
}
