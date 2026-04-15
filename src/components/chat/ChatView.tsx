'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, Sparkles, Bug, ChevronDown, ChevronUp } from 'lucide-react'
import { cn, formatMarkdown } from '@/lib/utils'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface LogEntry {
  timestamp: string
  message: string
  intent: string
  parser: string
  confidence: number
  actionsCount: number
  response: string
}

const QUICK_COMMANDS = [
  'Toon open todos',
  'Toon agenda deze week',
  'Hoeveel gewerkt vandaag?',
  'Toon mijn financiën',
  'Heb gesport vandaag',
  'Help',
]

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [showLog, setShowLog] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
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
            content: `Hey Daan! 👋 Ik ben je persoonlijke hulp. Ik kan je helpen met todos, agenda, werklog, notes, contacten, financiën, gewoontes en meer.\n\nTyp **help** voor een overzicht van alles wat ik kan!`,
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

    const reqTime = new Date().toLocaleTimeString('nl-NL')

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

      // Store log entry
      setLogs(prev => [{
        timestamp: reqTime,
        message: msg,
        intent: data.intent ?? '?',
        parser: data.parser ?? '?',
        confidence: data.confidence ?? 0,
        actionsCount: data.actions?.length ?? 0,
        response: data.response ?? '',
      }, ...prev].slice(0, 20))

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
    <div className="flex min-h-full flex-col bg-white">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
          >
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gradient">Persoonlijke Assistent</h1>
            <p className="text-[11px] text-gray-400">Typ in het Nederlands</p>
          </div>
        </div>
        <button
          onClick={() => setShowLog(s => !s)}
          title="Toon/verberg debug log"
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors',
            showLog ? 'bg-violet-50 border-violet-200 text-violet-600' : 'border-gray-200 text-gray-400 hover:border-gray-300'
          )}
        >
          <Bug size={12} />
          <span className="hidden sm:inline">Log</span>
          {showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Debug log panel */}
      {showLog && (
        <div className="border-b border-violet-100 bg-violet-50/50 px-4 py-3 max-h-52 overflow-y-auto flex-shrink-0">
          <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2">Debug Log</p>
          {logs.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic">Nog geen berichten gestuurd deze sessie.</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-2 border-b border-violet-100 pb-2 last:border-0 last:mb-0 last:pb-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[10px] text-gray-400">{log.timestamp}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono font-medium', {
                    'bg-emerald-100 text-emerald-700': log.parser === 'rule',
                    'bg-blue-100 text-blue-700': log.parser === 'ai',
                    'bg-orange-100 text-orange-700': log.parser === 'fallback',
                  })}>{log.parser}</span>
                  <span className="text-[10px] font-mono text-violet-600 font-medium">{log.intent}</span>
                  <span className="text-[10px] text-gray-400">conf: {(log.confidence * 100).toFixed(0)}%</span>
                  {log.actionsCount > 0 && <span className="text-[10px] text-emerald-600">{log.actionsCount} actie(s)</span>}
                </div>
                <p className="text-[11px] text-gray-500 truncate">↑ {log.message}</p>
                <p className="text-[11px] text-gray-400 truncate">↓ {log.response}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex gap-2 sm:gap-3 animate-fade-in', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
              >
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div className={cn(
              'max-w-[82%] sm:max-w-[75%] px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
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
          <div className="flex gap-2 sm:gap-3 animate-fade-in">
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
      <div className="px-4 sm:px-5 pb-2 flex gap-1.5 flex-wrap flex-shrink-0 overflow-x-auto">
        {QUICK_COMMANDS.map(cmd => (
          <button
            key={cmd}
            onClick={() => sendMessage(cmd)}
            className="text-[11px] px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-pink-200 hover:text-gray-800 transition-all font-medium whitespace-nowrap flex-shrink-0"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 sm:px-5 pb-5 pt-1 flex-shrink-0">
        <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:border-pink-200 transition-colors shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Typ een bericht... (Enter om te sturen)"
            rows={1}
            className="flex-1 bg-transparent text-gray-700 placeholder:text-gray-400 resize-none outline-none py-1.5 px-2 max-h-28"
            style={{ minHeight: '36px', fontSize: '16px' }}
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
