'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Loader2, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { MorphPanel } from '@/components/ui/ai-prompt-box'
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
  todo_create: { label: 'Taak aangemaakt', tone: 'text-accent' },
  grocery_create: { label: 'Boodschap toegevoegd', tone: 'text-success' },
  finance_create_expense: { label: 'Financiele post opgeslagen', tone: 'text-warning' },
  memory_store: { label: 'Geheugen bijgewerkt', tone: 'text-ai' },
  event_create: { label: 'Agenda-item aangemaakt', tone: 'text-info' },
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
        AI
      </div>
      <div className="flex items-center gap-2 text-sm text-text-tertiary italic">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{status}</span>
      </div>
    </div>
  )
}

function ActionChip({ action }: { action: DebugAction }) {
  const spec = actionLabels[action.type] ?? { label: action.type, tone: 'text-accent' }
  const title =
    typeof action.payload?.title === 'string'
      ? action.payload.title
      : typeof action.payload?.name === 'string'
        ? action.payload.name
        : spec.label

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-secondary shadow-xs">
      {action.result?.success !== false ? (
        <CheckCircle2 className="h-3 w-3 text-success" />
      ) : (
        <AlertCircle className="h-3 w-3 text-error" />
      )}
      <span className="font-medium">{spec.label}:</span>
      <span className="max-w-[200px] truncate">{title}</span>
    </div>
  )
}

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Aan het nadenken...')
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
    setLoadingStatus('Aan het nadenken...')
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
              setLoadingStatus('Aan het nadenken...')
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

  if (initialLoad) {
    return (
      <div className="flex h-[calc(100dvh-72px)] items-center justify-center md:h-dvh">
        <Loader2 className="animate-spin text-text-secondary" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-72px)] flex-col bg-background md:h-dvh">
      <div className="page-shell-header sticky top-0 z-10 flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-text-primary">Chat</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={resetChat} className="focus-ring flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover">
            <RotateCcw size={14} />
            <span>Wis geschiedenis</span>
          </button>
        </div>
      </div>

      <div ref={listRef} onScroll={syncScrollState} className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6 px-4 py-8 md:px-6">
          {showExamples && (
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Probeer bijvoorbeeld</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  'Zet boodschappen doen in mijn takenlijst',
                  'Vat vandaag kort samen',
                  'Voeg een uitgave van 34 euro toe',
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => setInput(example)}
                    className="rounded-full border border-border bg-surface-inset px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={cn('animate-fade-in flex flex-col gap-2', message.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={cn('flex gap-3 max-w-[90%] sm:max-w-[85%]', message.role === 'user' && 'flex-row-reverse')}>
                {message.role !== 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                    AI
                  </div>
                )}

                <div className="flex flex-col gap-2">
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
                      <div className="chat-content prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content || '...') }} />
                    )}
                  </div>

                  {message.role === 'assistant' && message.debugInfo?.actions && message.debugInfo.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {message.debugInfo.actions.map((action, index) => (
                        <ActionChip key={`${message.id}-${index}`} action={action} />
                      ))}
                    </div>
                  )}

                  <p className={cn('text-[10px] text-text-tertiary px-1', message.role === 'user' ? 'text-right' : 'text-left')}>
                    {formatRelative(message.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {loading && <ThinkingBubble status={loadingStatus} />}
          <div ref={bottomRef} />
        </div>

        {showScrollDown && (
          <button
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="focus-ring fixed bottom-32 right-4 z-20 rounded-full bg-surface p-3 shadow-lg border border-border md:right-8"
          >
            <ArrowDown size={16} className="text-text-secondary" />
          </button>
        )}
      </div>

      <div className="bg-background px-4 py-4 md:px-6">
        <div className="mx-auto w-full max-w-[800px]">
          <MorphPanel
            value={input}
            onValueChange={setInput}
            onSend={sendMessage}
            onCancel={cancelGeneration}
            isLoading={loading}
            placeholder="Stuur een bericht..."
            className="shadow-xl"
          />
        </div>
      </div>
    </div>
  )
}
