'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Send, Paperclip, CheckSquare, BookOpen, Euro, Lightbulb,
  X, ChevronDown, ChevronUp, AlertCircle, RotateCcw, Image as ImageIcon,
  Bug, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
import { cn, formatMarkdown, formatRelative } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DebugAction {
  type: string
  payload?: Record<string, unknown>
  result?: { success: boolean; error?: string; data?: unknown }
}

interface DebugInfo {
  summary?: string
  actions: DebugAction[]
  requires_confirmation?: boolean
  failed?: number
}

interface Message {
  id: number
  role: 'user' | 'assistant' | 'system-action' | 'error' | 'status'
  content: string
  created_at: string
  actions?: DebugAction[]
  debugInfo?: DebugInfo
  streaming?: boolean
  imagePreview?: string
  systemAction?: {
    icon: string
    title: string
    detail?: string
    success?: boolean
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: CheckSquare, label: 'Taak toevoegen', prompt: 'Maak een taak: ' },
  { icon: Euro,        label: 'Boek uitgave',    prompt: 'Boek uitgave: ' },
  { icon: BookOpen,    label: 'Dagboek',          prompt: 'Schrijf in dagboek: ' },
  { icon: Lightbulb,   label: 'Analyseer',        prompt: 'Analyseer mijn ' },
]

const EXAMPLE_COMMANDS = [
  'Toon open todos',
  'Agenda deze week',
  'Boodschappen: melk, brood, kaas',
  'Hoeveel gewerkt vandaag?',
  'Boek uitgave: koffie €3.50',
  'Ik ga nu slapen',
]

const ACTION_LABELS: Record<string, string> = {
  todo_create:           'Taak aangemaakt',
  todo_complete:         'Taak afgerond',
  todo_update:           'Taak bijgewerkt',
  todo_delete:           'Taak verwijderd',
  event_create:          'Agenda-item aangemaakt',
  finance_create_expense:'Uitgave geboekt',
  finance_create_income: 'Inkomst geboekt',
  journal_create:        'Dagboek bijgewerkt',
  habit_log:             'Gewoonte gelogd',
  memory_store:          'Onthouden',
  note_create:           'Notitie aangemaakt',
  worklog_create:        'Werklog opgeslagen',
  timer_start:           'Timer gestart',
  timer_stop:            'Timer gestopt',
  grocery_create:        'Boodschap toegevoegd',
  contact_create:        'Contact aangemaakt',
  inbox_capture:         'Opgeslagen in inbox',
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TypingIndicator({ status }: { status?: string }) {
  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient text-white text-xs font-bold select-none">
        ✦
      </div>
      <div className="chat-bubble-ai inline-flex items-center gap-2 py-2.5 px-4">
        {status ? (
          <>
            <Loader2 size={12} className="animate-spin text-on-surface-variant" />
            <span className="text-[12px] text-on-surface-variant">{status}</span>
          </>
        ) : (
          [0, 1, 2].map(i => (
            <span key={i} className="h-2 w-2 rounded-full bg-on-surface-variant animate-thinking" style={{ animationDelay: `${i * 0.16}s` }} />
          ))
        )}
      </div>
    </div>
  )
}

function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex items-end justify-end gap-2 animate-fade-in">
      <div>
        {message.imagePreview && (
          <div className="mb-1.5 flex justify-end">
            <img src={message.imagePreview} alt="Geüploade afbeelding" className="max-h-48 max-w-[240px] rounded-xl border border-outline-variant object-cover" />
          </div>
        )}
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

function AIBubble({ message, debugMode }: { message: Message; debugMode: boolean }) {
  const [debugOpen, setDebugOpen] = useState(false)
  const hasDebug = !!message.debugInfo?.actions?.length

  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold select-none mb-5',
        message.streaming ? 'bg-gradient animate-pulse' : 'bg-gradient'
      )}>
        ✦
      </div>
      <div className="flex-1 min-w-0">
        <div className="chat-bubble-ai">
          <div
            className="chat-content text-[14px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content || '…') }}
          />
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <p className="text-[10px] text-on-surface-variant/60">
            {formatRelative(message.created_at)}
          </p>
          {hasDebug && debugMode && (
            <button
              onClick={() => setDebugOpen(v => !v)}
              className="inline-flex items-center gap-1 text-[10px] text-on-surface-variant/60 hover:text-accent transition-colors"
            >
              <Bug size={9} />
              {message.debugInfo!.actions.length} actie(s)
              {debugOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            </button>
          )}
          {hasDebug && !debugMode && (
            <span className="text-[10px] text-on-surface-variant/40">
              {message.debugInfo!.actions.length} actie(s) uitgevoerd
            </span>
          )}
        </div>

        {debugOpen && message.debugInfo && (
          <div className="mt-2 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-[11px] space-y-2 animate-fade-in">
            <p className="font-semibold text-on-surface-variant uppercase tracking-wider text-[9px]">Debug — Actie trace</p>
            {message.debugInfo.actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-outline-variant last:border-0">
                {a.result?.success !== false
                  ? <CheckCircle2 size={12} className="text-success shrink-0 mt-0.5" />
                  : <XCircle size={12} className="text-danger shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-on-surface">{ACTION_LABELS[a.type] ?? a.type}</p>
                  {a.payload && (
                    <pre className="mt-0.5 text-[10px] text-on-surface-variant whitespace-pre-wrap break-all">
                      {JSON.stringify(a.payload, null, 2)}
                    </pre>
                  )}
                  {a.result?.error && (
                    <p className="mt-0.5 text-danger">{a.result.error}</p>
                  )}
                </div>
              </div>
            ))}
            {message.debugInfo.failed! > 0 && (
              <p className="text-danger font-medium">{message.debugInfo.failed} actie(s) mislukt</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBubble({ action }: { action: { type: string; success: boolean; detail?: string } }) {
  const label = ACTION_LABELS[action.type] ?? action.type
  return (
    <div className="flex justify-center my-1 animate-scale-in">
      <div className={cn(
        'chat-bubble-system flex items-center gap-2',
        !action.success && 'border-danger-border bg-red-50'
      )}>
        {action.success
          ? <CheckCircle2 size={12} className="text-success shrink-0" />
          : <XCircle size={12} className="text-danger shrink-0" />
        }
        <p className="text-[12px] font-medium text-on-surface">{label}</p>
        {action.detail && (
          <p className="text-[11px] text-on-surface-variant">{action.detail}</p>
        )}
      </div>
    </div>
  )
}

function ErrorBubble({ message }: { message: Message }) {
  return (
    <div className="flex items-start gap-2 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-danger">
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
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<string>('')
  const [initialLoad, setInitialLoad] = useState(true)
  const [showExamples, setShowExamples] = useState(true)
  const [debugMode, setDebugMode]   = useState(false)
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef  = useRef<NodeJS.Timeout>()

  // ── Load history ────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async (silent = false) => {
    try {
      const r = await fetch('/api/chat?limit=60')
      const p = await r.json()
      if (p.data?.length) {
        setMessages(p.data.map((m: any) => ({
          ...m,
          debugInfo: m.actions && typeof m.actions === 'object' && !Array.isArray(m.actions)
            ? m.actions
            : undefined,
        })))
        if (!silent) setShowExamples(false)
      } else if (!silent) {
        setMessages([{
          id: 0,
          role: 'assistant',
          content: 'Hey! Ik ben je persoonlijke AI-assistent. Geef me een opdracht in gewoon Nederlands — ik regel de rest.',
          created_at: new Date().toISOString(),
        }])
      }
    } finally {
      if (!silent) setInitialLoad(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
    // Poll elke 30s voor berichten van andere kanalen (Telegram)
    pollingRef.current = setInterval(() => loadHistory(true), 30_000)
    return () => clearInterval(pollingRef.current)
  }, [loadHistory])

  // ── Auto-scroll ──────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Input handlers ───────────────────────────────────────────────────────────

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Foto upload ──────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      const preview = reader.result as string
      setPendingImage({ base64, mimeType: file.type, preview })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Send message (met streaming) ─────────────────────────────────────────────

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if ((!msg && !pendingImage) || loading) return

    setInput('')
    setShowExamples(false)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const imageData = pendingImage
    setPendingImage(null)

    // Voeg gebruikersbericht toe aan UI
    const userMsgId = Date.now()
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      content: msg || (imageData ? '[Afbeelding gestuurd]' : ''),
      created_at: new Date().toISOString(),
      imagePreview: imageData?.preview,
    }])

    setLoading(true)
    setLoadingStatus('Denken...')

    // Voeg streaming AI bubble toe
    const aiMsgId = Date.now() + 1
    setMessages(prev => [...prev, {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      streaming: true,
    }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          imageBase64: imageData?.base64,
          imageType: imageData?.mimeType,
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let fullText  = ''
      let debugInfo: DebugInfo | undefined
      const actionBubbles: Array<{ type: string; success: boolean; detail?: string }> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'status') {
              setLoadingStatus(data.text)
            }

            if (data.type === 'debug') {
              debugInfo = data.data
            }

            if (data.type === 'text') {
              fullText += data.text
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: fullText, debugInfo } : m
              ))
            }

            if (data.type === 'done') {
              // Maak action bubbles op basis van werkelijke resultaten
              const results = data.actionResults ?? []
              for (const r of results) {
                actionBubbles.push({
                  type: r.type ?? 'unknown',
                  success: r.success,
                  detail: r.error,
                })
              }

              // Finaliseer AI bubble
              setMessages(prev => {
                const updated = prev.map(m =>
                  m.id === aiMsgId
                    ? { ...m, content: fullText, streaming: false, debugInfo }
                    : m
                )
                // Voeg actie-bubbles in NA het AI bericht
                const idx = updated.findIndex(m => m.id === aiMsgId)
                const bubbleMsgs: Message[] = actionBubbles.map((ab, i) => ({
                  id: Date.now() + 10 + i,
                  role: 'system-action' as const,
                  content: '',
                  created_at: new Date().toISOString(),
                  systemAction: {
                    icon: ab.success ? 'check' : 'error',
                    title: ACTION_LABELS[ab.type] ?? ab.type,
                    detail: ab.detail,
                    success: ab.success,
                  },
                }))
                return [
                  ...updated.slice(0, idx + 1),
                  ...bubbleMsgs,
                  ...updated.slice(idx + 1),
                ]
              })
            }

            if (data.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, role: 'error', content: data.text, streaming: false } : m
              ))
            }
          } catch { /* skip malformed line */ }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, role: 'error', content: 'Verbinding verbroken. Probeer het opnieuw.', streaming: false }
          : m
      ))
    } finally {
      setLoading(false)
      setLoadingStatus('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  const resetChat = () => {
    setMessages([{
      id: Date.now(),
      role: 'assistant',
      content: 'Nieuw gesprek gestart. Wat kan ik voor je doen?',
      created_at: new Date().toISOString(),
    }])
    setShowExamples(true)
    setPendingImage(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (initialLoad) {
    return (
      <div className="flex h-[calc(100dvh-72px)] md:h-dvh flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient animate-pulse" />
          <p className="text-[13px] text-on-surface-variant">Chat laden...</p>
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
              <p className="text-[10px] text-on-surface-variant">Actief · GPT-4o</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDebugMode(v => !v)}
            title="Debug modus"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
              debugMode
                ? 'bg-ai-purple-bg text-ai-purple border border-ai-purple-border'
                : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container'
            )}
          >
            <Bug size={11} />
            Debug
          </button>
          <button
            onClick={resetChat}
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

          {messages.map(message => {
            if (message.role === 'user') return <UserBubble key={message.id} message={message} />
            if (message.role === 'system-action' && message.systemAction) {
              return <ActionBubble key={message.id} action={message.systemAction as any} />
            }
            if (message.role === 'error') return <ErrorBubble key={message.id} message={message} />
            return <AIBubble key={message.id} message={message} debugMode={debugMode} />
          })}

          {loading && <TypingIndicator status={loadingStatus} />}

          <div ref={bottomRef} className="h-2" />
        </div>
      </div>

      {/* ── IMAGE PREVIEW ──────────────────────────────────────────────────── */}
      {pendingImage && (
        <div className="shrink-0 border-t border-outline-variant bg-white px-4 pt-3">
          <div className="relative inline-block">
            <img src={pendingImage.preview} alt="Preview" className="h-20 rounded-lg border border-outline-variant object-cover" />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-on-surface text-white"
            >
              <X size={10} />
            </button>
          </div>
        </div>
      )}

      {/* ── INPUT AREA ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-outline-variant bg-white px-4 py-3 md:px-6">

        {!input && !loading && !pendingImage && (
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-0.5 hide-scrollbar">
            {QUICK_ACTIONS.map(({ icon: Icon, label, prompt }) => (
              <button
                key={label}
                onClick={() => { setInput(prompt); setTimeout(() => inputRef.current?.focus(), 0) }}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-[12px] font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface whitespace-nowrap"
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        )}

        <div className={cn(
          'flex items-end gap-2 rounded-xl border bg-surface-container-low px-4 py-2 transition-all duration-150',
          (input || pendingImage) ? 'border-accent shadow-focus' : 'border-outline-variant'
        )}>
          {/* Foto upload knop */}
          <button
            className="mb-1 text-on-surface-variant/50 transition-colors hover:text-on-surface-variant"
            title="Foto sturen (kassabon, notitie)"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon size={17} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={pendingImage ? 'Beschrijf de afbeelding (optioneel)…' : 'Schrijf een bericht… (Enter verstuurt)'}
            rows={1}
            disabled={loading}
            className="flex-1 resize-none bg-transparent py-1.5 text-[14px] text-on-surface outline-none placeholder:text-on-surface-variant/50 leading-relaxed disabled:opacity-60"
            style={{ maxHeight: '160px', minHeight: '28px' }}
          />

          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !pendingImage) || loading}
            className={cn(
              'mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
              (input.trim() || pendingImage) && !loading
                ? 'bg-accent text-white hover:bg-accent-hover shadow-sm'
                : 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
            )}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-on-surface-variant/40">
          AI kan fouten maken · Stuur foto&apos;s van kassabonnen voor automatisch boeken
        </p>
      </div>
    </div>
  )
}
