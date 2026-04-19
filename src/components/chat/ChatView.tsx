'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Send, Paperclip, CheckSquare, BookOpen, Euro, Lightbulb,
  X, ChevronDown, ChevronUp, AlertCircle, RotateCcw,
} from 'lucide-react'
import { cn, formatMarkdown, formatRelative } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MessageMeta {
  parser?: string
  intent?: string
  confidence?: number
  actionsCount?: number
}

interface ActionRecord {
  type: string
  payload?: Record<string, unknown>
}

interface Message {
  id: number
  role: 'user' | 'assistant' | 'system-action' | 'error'
  content: string
  created_at: string
  actions?: ActionRecord[]
  meta?: MessageMeta
  systemAction?: {
    icon: 'task' | 'memory' | 'finance' | 'diary' | 'check'
    title: string
    detail?: string
  }
  undone?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: CheckSquare, label: 'Voeg taak toe',    prompt: 'Maak een taak: ' },
  { icon: Euro,        label: 'Boek uitgave',      prompt: 'Boek uitgave: ' },
  { icon: BookOpen,    label: 'Dagboek entry',     prompt: 'Schrijf in dagboek: ' },
  { icon: Lightbulb,   label: 'Analyseer patroon', prompt: 'Analyseer mijn ' },
]

const EXAMPLE_COMMANDS = [
  'Toon open todos',
  'Agenda deze week',
  'Boodschappen: melk, brood, kaas',
  'Hoeveel gewerkt vandaag?',
  'Toon mijn financiën',
  'Herinner me morgen om Amy te appen',
]

const ACTION_ICONS: Record<string, string> = {
  task:    '✓',
  memory:  '💾',
  finance: '€',
  diary:   '📔',
  check:   '✓',
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient text-white text-xs font-bold select-none">
        ✦
      </div>
      <div className="chat-bubble-ai inline-flex items-center gap-1.5 py-3 px-4">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-on-surface-variant animate-thinking"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex items-end justify-end gap-2 animate-fade-in">
      <div>
        <div className="chat-bubble-user">
          <p className="text-[14px] leading-relaxed">{message.content}</p>
        </div>
        <p className="mt-1 text-right text-[10px] text-on-surface-variant/60">
          {formatRelative(message.created_at)}
        </p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container border border-outline-variant text-[11px] font-bold text-on-surface select-none mb-5">
        D
      </div>
    </div>
  )
}

function AIBubble({ message }: { message: Message }) {
  const [metaOpen, setMetaOpen] = useState(false)
  const hasMeta = message.meta && (message.meta.actionsCount ?? 0) > 0

  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient text-white text-xs font-bold select-none mb-5">
        ✦
      </div>
      <div className="flex-1 min-w-0">
        <div className="chat-bubble-ai">
          <div
            className="chat-content text-[14px]"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
          />
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="text-[10px] text-on-surface-variant/60">
            {formatRelative(message.created_at)}
            {message.meta?.parser && ` · ${message.meta.parser}`}
          </p>
          {hasMeta && (
            <button
              onClick={() => setMetaOpen(v => !v)}
              className="inline-flex items-center gap-1 text-[10px] text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
            >
              {message.meta!.actionsCount} actie(s)
              {metaOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>

        {metaOpen && message.meta && (
          <div className="mt-2 rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-[11px] text-on-surface-variant space-y-1 animate-fade-in">
            {message.meta.intent && (
              <p><span className="font-medium text-on-surface">Intent:</span> {message.meta.intent}</p>
            )}
            {message.meta.parser && (
              <p><span className="font-medium text-on-surface">Parser:</span> {message.meta.parser}</p>
            )}
            {typeof message.meta.confidence === 'number' && message.meta.confidence > 0 && (
              <p><span className="font-medium text-on-surface">Zekerheid:</span> {Math.round(message.meta.confidence * 100)}%</p>
            )}
            {typeof message.meta.actionsCount === 'number' && (
              <p><span className="font-medium text-on-surface">Acties:</span> {message.meta.actionsCount}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SystemActionBubble({
  message,
  onUndo,
}: {
  message: Message
  onUndo?: (id: number) => void
}) {
  const [dismissed, setDismissed] = useState(false)
  const action = message.systemAction

  if (dismissed || message.undone || !action) return null

  return (
    <div className="flex justify-center my-1 animate-scale-in">
      <div className="chat-bubble-system flex items-center gap-2.5 w-auto">
        <span className="text-ai-purple text-base leading-none shrink-0">
          {ACTION_ICONS[action.icon] ?? '✓'}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-on-surface">{action.title}</p>
          {action.detail && (
            <p className="text-[11px] text-on-surface-variant mt-0.5">{action.detail}</p>
          )}
        </div>
        {onUndo && (
          <button
            onClick={() => {
              onUndo(message.id)
              setDismissed(true)
            }}
            className="shrink-0 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors whitespace-nowrap ml-1"
          >
            Ongedaan
          </button>
        )}
      </div>
    </div>
  )
}

function ErrorBubble({ message }: { message: Message }) {
  return (
    <div className="flex items-start gap-2 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertCircle size={14} />
      </div>
      <div className="chat-bubble-error">
        <p className="text-[13px] font-medium text-danger">Er ging iets mis</p>
        <p className="mt-0.5 text-[12px] text-on-surface-variant">{message.content}</p>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [showExamples, setShowExamples] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const inputAreaRef = useRef<HTMLDivElement>(null)

  // Load history
  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then(p => {
        if (p.data?.length) {
          setMessages(p.data.map((m: Message) => ({
            ...m,
            meta: (m.actions?.length ?? 0) > 0
              ? { actionsCount: m.actions?.length ?? 0 }
              : undefined,
          })))
          setShowExamples(false)
        } else {
          setMessages([{
            id: 0,
            role: 'assistant',
            content: 'Goedemorgen, Daan. Ik help je om acties uit te voeren, context terug te vinden en overzicht te houden. Geef me gewoon je opdracht in normaal Nederlands.',
            created_at: new Date().toISOString(),
          }])
        }
      })
      .finally(() => setInitialLoad(false))
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }, [])

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    setInput('')
    setShowExamples(false)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const userMsg: Message = {
      id:         Date.now(),
      role:       'user',
      content:    msg,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res  = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: msg }),
      })
      const data = await res.json()

      const meta: MessageMeta = {
        parser:       data.debug?.parserType ?? data.parser,
        intent:       data.debug?.intent     ?? data.intent,
        confidence:   data.debug?.confidence ?? data.confidence ?? 0,
        actionsCount: data.actions?.length   ?? 0,
      }

      // Detect system actions from response
      const systemActions = detectSystemActions(msg, data)

      const aiMsg: Message = {
        id:         Date.now() + 1,
        role:       'assistant',
        content:    data.response || data.message || 'Klaar.',
        created_at: new Date().toISOString(),
        meta,
        actions:    data.actions,
      }

      const newMessages: Message[] = [aiMsg]

      // Prepend system action bubbles if detected
      if (systemActions) {
        newMessages.unshift({
          id:           Date.now() + 2,
          role:         'system-action',
          content:      '',
          created_at:   new Date().toISOString(),
          systemAction: systemActions,
        })
      }

      setMessages(prev => [...prev, ...newMessages])
    } catch {
      setMessages(prev => [...prev, {
        id:         Date.now() + 1,
        role:       'error',
        content:    'De verbinding met de server is verbroken. Probeer het opnieuw.',
        created_at: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function detectSystemActions(userInput: string, response: unknown): Message['systemAction'] | null {
    const input   = userInput.toLowerCase()
    const actions = (response as { actions?: ActionRecord[] }).actions ?? []
    const count   = actions.length

    if (count === 0) return null

    // Detect action type from intent or input keywords
    if (input.includes('taak') || input.includes('todo') || input.includes('herinner')) {
      return { icon: 'task', title: 'Taak aangemaakt', detail: userInput.length > 60 ? userInput.slice(0, 60) + '…' : userInput }
    }
    if (input.includes('dagboek') || input.includes('journal')) {
      return { icon: 'diary', title: 'Dagboek entry opgeslagen', detail: 'Succesvol vastgelegd' }
    }
    if (input.includes('uitgave') || input.includes('betaald') || input.includes('euro') || input.includes('€')) {
      return { icon: 'finance', title: 'Uitgave geboekt', detail: `${count} item(s) verwerkt` }
    }
    if (count > 0) {
      return { icon: 'check', title: `${count} actie(s) uitgevoerd`, detail: 'Via AI assistent' }
    }
    return null
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleUndo(id: number) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, undone: true } : m))
  }

  if (initialLoad) {
    return (
      <div className="flex h-[calc(100dvh-72px)] md:h-dvh flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient animate-pulse" />
            <p className="text-[13px] text-on-surface-variant">Chat laden...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-72px)] md:h-dvh flex-col bg-background">

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-outline-variant bg-white px-4 py-3 md:px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient text-white text-xs font-bold select-none">
            ✦
          </div>
          <div>
            <p className="text-[13px] font-semibold text-on-surface">Daan AI</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success ai-pulse-dot" />
              <p className="text-[10px] text-on-surface-variant">Actief</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-[11px] text-on-surface-variant">
            {messages.filter(m => m.role !== 'system-action').length} berichten
          </span>
          <button
            onClick={() => {
              setMessages([{
                id:         Date.now(),
                role:       'assistant',
                content:    'Nieuw gesprek gestart. Wat kan ik voor je doen?',
                created_at: new Date().toISOString(),
              }])
              setShowExamples(true)
            }}
            className="flex items-center gap-1.5 rounded-md border border-outline-variant bg-white px-2.5 py-1.5 text-[12px] font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <RotateCcw size={12} />
            Nieuw
          </button>
        </div>
      </div>

      {/* ── MESSAGES ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 py-6 space-y-4 md:px-6">

          {/* Welcome / examples */}
          {showExamples && messages.length <= 1 && (
            <div className="rounded-xl border border-outline-variant bg-white p-5 animate-fade-in">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/60 mb-3">
                Snelle opdrachten
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {EXAMPLE_COMMANDS.map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => sendMessage(cmd)}
                    className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-left text-[12px] font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(message => {
            if (message.role === 'user') {
              return <UserBubble key={message.id} message={message} />
            }
            if (message.role === 'system-action') {
              return <SystemActionBubble key={message.id} message={message} onUndo={handleUndo} />
            }
            if (message.role === 'error') {
              return <ErrorBubble key={message.id} message={message} />
            }
            return <AIBubble key={message.id} message={message} />
          })}

          {/* Typing indicator */}
          {loading && <TypingIndicator />}

          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* ── INPUT AREA ─────────────────────────────────────────────────────── */}
      <div
        ref={inputAreaRef}
        className="shrink-0 border-t border-outline-variant bg-white px-4 py-3 md:px-6"
      >
        {/* Quick action pills — show when input is empty */}
        {!input && !loading && (
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-0.5 hide-scrollbar">
            {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                onClick={() => {
                  setInput(prompt)
                  setTimeout(() => inputRef.current?.focus(), 0)
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-[12px] font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface whitespace-nowrap"
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className={cn(
          'flex items-end gap-2 rounded-xl border bg-surface-container-low px-4 py-2 transition-all duration-150',
          input ? 'border-accent shadow-focus' : 'border-outline-variant'
        )}>
          {/* Attachment */}
          <button
            className="mb-1 text-on-surface-variant/50 transition-colors hover:text-on-surface-variant"
            title="Bestand uploaden"
            onClick={() => {/* TODO: file upload */}}
          >
            <Paperclip size={17} />
          </button>

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Schrijf een bericht… (Enter verstuurt, Shift+Enter = nieuwe regel)"
            rows={1}
            className="flex-1 resize-none bg-transparent py-1.5 text-[14px] text-on-surface outline-none placeholder:text-on-surface-variant/50 leading-relaxed"
            style={{ maxHeight: '160px', minHeight: '28px' }}
          />

          {/* Send */}
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className={cn(
              'mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
              input.trim() && !loading
                ? 'bg-accent text-white hover:bg-accent-hover shadow-sm'
                : 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
            )}
          >
            <Send size={15} />
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-on-surface-variant/40">
          AI kan fouten maken — controleer altijd belangrijke informatie
        </p>
      </div>
    </div>
  )
}
