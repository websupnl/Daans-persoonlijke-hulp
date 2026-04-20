'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Loader2, RotateCcw } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { MorphPanel } from '@/components/ui/ai-prompt-box'
import { ShiningText } from '@/components/ui/shining-text'
import { cn, formatMarkdown, formatRelative } from '@/lib/utils'

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
  role: 'user' | 'assistant' | 'error'
  content: string
  created_at: string
  debugInfo?: DebugInfo
  streaming?: boolean
  imageUrl?: string | null
  imageName?: string | null
}

const actionLabels: Record<string, { label: string; tone: string }> = {
  todo_create: { label: 'Taak aangemaakt', tone: 'border-l-accent' },
  grocery_create: { label: 'Boodschap toegevoegd', tone: 'border-l-success' },
  finance_create_expense: { label: 'Financiele post opgeslagen', tone: 'border-l-warning' },
  memory_store: { label: 'Geheugen bijgewerkt', tone: 'border-l-ai' },
  event_create: { label: 'Agenda-item aangemaakt', tone: 'border-l-info' },
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Kon bestand niet lezen'))
    reader.readAsDataURL(file)
  })
}

function ThinkingBubble({ status }: { status: string }) {
  return (
    <div className="animate-fade-in flex gap-3">
      <div className="bg-gradient mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-text-inverse">
        AI
      </div>
      <div className="chat-bubble-ai">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="animate-thinking h-2 w-2 rounded-full bg-accent"
              style={{ animationDelay: `${index * 0.15}s` }}
            />
          ))}
          <span className="ml-1">
            <ShiningText text={status} />
          </span>
        </div>
      </div>
    </div>
  )
}

function ActionCard({ action }: { action: DebugAction }) {
  const spec = actionLabels[action.type] ?? { label: action.type, tone: 'border-l-accent' }
  const title =
    typeof action.payload?.title === 'string'
      ? action.payload.title
      : typeof action.payload?.name === 'string'
        ? action.payload.name
        : spec.label

  return (
    <div className={cn('mt-3 rounded-md border border-border border-l-[3px] bg-surface p-3 shadow-xs', spec.tone)}>
      <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{spec.label}</p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(action.payload ?? {})
          .filter(([key, value]) => typeof value === 'string' && value && key !== 'title' && key !== 'name')
          .slice(0, 3)
          .map(([key, value]) => (
            <span key={key} className="rounded-pill bg-surface-inset px-2.5 py-1 text-xs text-text-secondary">
              {key}: {String(value)}
            </span>
          ))}
      </div>
      {action.result?.error && <p className="mt-2 text-xs text-error">{action.result.error}</p>}
    </div>
  )
}

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Interpreteren...')
  const [showExamples, setShowExamples] = useState(true)
  const [initialLoad, setInitialLoad] = useState(true)
  const [showScrollDown, setShowScrollDown] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.get('q')
    if (query && messages.length > 0 && !loading) {
      // Check if the last message is the same to avoid double sending
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'user' && lastMessage.content === query) return

      sendMessage(query)
    } else if (query && !initialLoad && messages.length === 0 && !loading) {
        sendMessage(query)
    }
  }, [searchParams, initialLoad, messages.length, loading])

  const loadHistory = useCallback(async () => {
    const response = await fetch('/api/chat?limit=40')
    const payload = await response.json()
    const history = (payload.data || []).map((message: any) => ({
      ...message,
      role: message.role === 'assistant' || message.role === 'user' ? message.role : 'assistant',
      debugInfo: message.actions && typeof message.actions === 'object' && !Array.isArray(message.actions) ? message.actions : undefined,
    }))

    setMessages(history)
    setShowExamples(history.length === 0)
    setInitialLoad(false)
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const syncScrollState = useCallback(() => {
    const element = listRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    setShowScrollDown(distance > 120)
  }, [])

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  async function sendMessage(rawMessage: string, files: File[] = []) {
    const message = rawMessage.trim()

    if ((!message && files.length === 0) || loading) {
      return
    }

    const imageFile = files[0]
    const imageDataUrl = imageFile ? await fileToDataUrl(imageFile) : null
    const imageBase64 = imageDataUrl ? imageDataUrl.split(',')[1] ?? null : null

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: message || 'Afbeelding gedeeld',
      created_at: new Date().toISOString(),
      imageUrl: imageDataUrl,
      imageName: imageFile?.name ?? null,
    }

    setMessages((current) => [...current, userMessage])
    setInput('')
    setShowExamples(false)
    setLoading(true)
    setLoadingStatus('Interpreteren...')
    abortControllerRef.current = new AbortController()

    let assistantId: number | null = null
    let assistantText = ''
    let debugInfo: DebugInfo | undefined

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          imageBase64,
          imageType: imageFile?.type,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.body) {
        throw new Error('Geen stream')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      assistantId = Date.now() + 1
      setMessages((current) => [
        ...current,
        { id: assistantId!, role: 'assistant', content: '', created_at: new Date().toISOString(), streaming: true },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        let boundary = buffer.indexOf('\n\n')

        while (boundary !== -1) {
          const event = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          boundary = buffer.indexOf('\n\n')

          const line = event.split('\n').find((entry) => entry.startsWith('data: '))
          if (!line) continue

          const data = JSON.parse(line.slice(6))

          if (data.type === 'status') {
            if (data.text?.includes('Acties')) {
              setLoadingStatus('Acties uitvoeren...')
            } else if (data.text?.includes('Denken')) {
              setLoadingStatus('Interpreteren...')
            }
          }

          if (data.type === 'debug') {
            debugInfo = data.data
          }

          if (data.type === 'text') {
            assistantText += data.text
            setLoadingStatus('Antwoord formuleren...')
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId ? { ...item, content: assistantText, debugInfo } : item
              )
            )
          }

          if (data.type === 'done') {
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId ? { ...item, content: assistantText, debugInfo, streaming: false } : item
              )
            )
          }

          if (data.type === 'error') {
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId ? { ...item, role: 'error', content: data.text, streaming: false } : item
              )
            )
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (assistantId !== null) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? { ...item, content: assistantText || 'Generatie gestopt.', debugInfo, streaming: false }
                : item
            )
          )
        }
        return
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 2,
          role: 'error',
          content: 'Er ging iets fout. Je bericht is bewaard.',
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
      abortControllerRef.current = null
    }
  }

  async function resetChat() {
    abortControllerRef.current?.abort()
    await fetch('/api/chat', { method: 'DELETE' })
    setMessages([])
    setInput('')
    setLoading(false)
    setShowExamples(true)
  }

  const contextCount = useMemo(() => {
    const actions = messages.reduce((count, item) => count + (item.debugInfo?.actions?.length ?? 0), 0)
    return Math.min(actions + 1, 9)
  }, [messages])

  if (initialLoad) {
    return (
      <div className="flex h-[calc(100dvh-72px)] items-center justify-center md:h-dvh">
        <Loader2 className="animate-spin text-text-secondary" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-72px)] flex-col bg-background md:h-dvh">
      <div className="page-shell-header sticky top-0 z-10 flex items-center justify-between px-3 py-3 md:px-6 md:py-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold text-text-inverse">
            AI
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Chat met je AI</p>
            <p className="hidden text-xs text-text-secondary md:block">De assistent verwerkt acties zichtbaar en direct.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-pill bg-accent-subtle px-2.5 py-1 text-[11px] font-medium text-accent md:px-3 md:py-1.5 md:text-xs">
            {contextCount} context-items
          </button>
          <button onClick={resetChat} className="focus-ring rounded-md border border-border bg-surface p-2 text-text-secondary">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div ref={listRef} onScroll={syncScrollState} className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4 px-4 py-6 md:px-6">
          {showExamples && (
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Probeer bijvoorbeeld</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  'Zet boodschappen doen in mijn takenlijst',
                  'Vat vandaag kort samen',
                  'Voeg een uitgave van 34 euro toe',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setInput(example)}
                    className="rounded-pill bg-surface-inset px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={cn('animate-fade-in flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              {message.role !== 'user' && (
                <div className="bg-gradient mr-3 mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-text-inverse md:flex">
                  AI
                </div>
              )}

              <div className={cn('w-full', message.role === 'user' ? 'max-w-[86%] sm:max-w-[72%]' : 'max-w-[92%] sm:max-w-[80%]')}>
                <div className={message.role === 'user' ? 'chat-bubble-user' : message.role === 'error' ? 'chat-bubble-error' : 'chat-bubble-ai'}>
                  {message.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={message.imageUrl}
                      alt={message.imageName ?? 'Upload'}
                      className="mb-3 max-h-64 w-full rounded-xl object-cover"
                    />
                  )}

                  {message.role === 'error' ? (
                    <p className="text-sm text-error">{message.content}</p>
                  ) : (
                    <div className="chat-content" dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content || '...') }} />
                  )}

                  {message.role === 'assistant' && message.debugInfo?.actions?.map((action, index) => (
                    <ActionCard key={`${message.id}-${index}`} action={action} />
                  ))}
                </div>

                <p className={cn('mt-1 text-xs text-text-tertiary', message.role === 'user' ? 'text-right' : 'text-left')}>
                  {formatRelative(message.created_at)}
                </p>
              </div>
            </div>
          ))}

          {loading && <ThinkingBubble status={loadingStatus} />}
          <div ref={bottomRef} />
        </div>

        {showScrollDown && (
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="focus-ring fixed bottom-28 right-4 z-20 rounded-full bg-surface p-3 shadow-md md:right-8"
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>

      <div className="border-t border-border bg-surface px-4 py-4 md:px-6">
        <div className="mx-auto w-full max-w-[920px]">
          <MorphPanel
            value={input}
            onValueChange={setInput}
            onSend={sendMessage}
            onCancel={cancelGeneration}
            isLoading={loading}
            placeholder="Typ een bericht of sleep een afbeelding hierheen..."
          />
        </div>
      </div>
    </div>
  )
}
