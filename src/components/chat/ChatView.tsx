'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  Bug,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  MessageSquareText,
  Send,
  Sparkles,
  User,
} from 'lucide-react'
import { cn, formatMarkdown, formatRelative } from '@/lib/utils'
import { ActionPill, EmptyPanel, Panel, PanelHeader } from '@/components/ui/Panel'

interface MessageMeta {
  parser?: string
  intent?: string
  confidence?: number
  actionsCount?: number
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
  actions?: unknown[]
  meta?: MessageMeta
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
  'Herinner me morgen om Amy te appen',
  'Boodschappen: melk, brood en kaas',
  'Hoeveel gewerkt vandaag?',
  'Toon mijn financiën',
]

const CAPABILITIES = [
  'Agenda, todo’s en boodschappen vastleggen',
  'Lijsten en overzichten ophalen uit de echte database',
  'Snel context terugvinden uit projecten, notities en werklog',
  'Acties uitvoeren zonder dat je door losse modules hoeft te klikken',
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
      .then((response) => response.json())
      .then((payload) => {
        if (payload.data?.length) {
          setMessages(
            payload.data.map((message: Message) => ({
              ...message,
              meta: (message.actions?.length ?? 0) > 0
                ? { actionsCount: message.actions?.length ?? 0 }
                : undefined,
            }))
          )
        } else {
          setMessages([
            {
              id: 0,
              role: 'assistant',
              content: 'Ik help je om acties echt uit te voeren, context terug te vinden en overzicht te houden. Geef me gewoon je opdracht in normaal Nederlands.',
              created_at: new Date().toISOString(),
            },
          ])
        }
      })
      .finally(() => setInitialLoad(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text?: string) {
    const message = (text || input).trim()
    if (!message || loading) return

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    }

    setMessages((previous) => [...previous, userMessage])
    setInput('')
    setLoading(true)

    const requestTime = new Date().toLocaleTimeString('nl-NL')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const payload = await response.json()
      const meta: MessageMeta = {
        parser: payload.debug?.parserType ?? payload.parser ?? '?',
        intent: payload.debug?.intent ?? payload.intent ?? '?',
        confidence: payload.debug?.confidence ?? payload.confidence ?? 0,
        actionsCount: payload.actions?.length ?? 0,
      }

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: payload.response || payload.message || 'Er ging iets mis.',
        created_at: new Date().toISOString(),
        meta,
      }

      setMessages((previous) => [...previous, assistantMessage])
      setLogs((previous) => [
        {
          timestamp: requestTime,
          message,
          intent: meta.intent ?? '?',
          parser: meta.parser ?? '?',
          confidence: meta.confidence ?? 0,
          actionsCount: meta.actionsCount ?? 0,
          response: payload.response ?? '',
        },
        ...previous,
      ].slice(0, 20))
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: 'Er ging iets mis in de chat. Probeer het opnieuw.',
          created_at: new Date().toISOString(),
          meta: { parser: 'error', intent: 'unknown', confidence: 0, actionsCount: 0 },
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const lastEngineRun = logs[0]

  if (initialLoad) {
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Panel tone="accent" padding="lg" className="min-h-[170px] animate-pulse" />
            <Panel className="min-h-[640px] animate-pulse" />
          </div>
          <div className="space-y-5">
            <Panel className="min-h-[220px] animate-pulse" />
            <Panel className="min-h-[220px] animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 xl:sticky xl:top-8 xl:self-start">
          <Panel tone="accent" padding="lg">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <ActionPill>Chat als command center</ActionPill>
                  <ActionPill>{messages.length} berichten in context</ActionPill>
                </div>
                <h1 className="mt-4 text-3xl font-headline font-extrabold tracking-tight text-on-surface sm:text-[2.35rem]">
                  Praat met je systeem, niet met een losse widget
                </h1>
                <p className="mt-3 text-base leading-7 text-on-surface-variant">
                  Deze chat moet betrouwbaar aanvoelen: duidelijk wat hij begrijpt, wat hij uitvoert en wat er echt uit de database komt. Geen magische zwarte doos.
                </p>
              </div>

              <div className="rounded-[24px] border border-black/5 bg-white/75 p-4 shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                  Laatste engine-run
                </p>
                {lastEngineRun ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-on-surface">
                      {lastEngineRun.intent}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                      Parser {lastEngineRun.parser} • {(lastEngineRun.confidence * 100).toFixed(0)}% zekerheid • {lastEngineRun.actionsCount} actie(s)
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    Nog geen engine-run in deze sessie. Stuur een opdracht om het systeem direct te testen.
                  </p>
                )}
              </div>
            </div>
          </Panel>

          <Panel padding="sm" className="flex min-h-[680px] flex-col overflow-hidden">
            <div className="border-b border-black/5 px-3 pb-3 pt-2 sm:px-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                    Gesprek
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Enter verstuurt, Shift+Enter maakt een nieuwe regel.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {QUICK_COMMANDS.slice(0, 3).map((command) => (
                    <button
                      key={command}
                      onClick={() => sendMessage(command)}
                      className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                    >
                      {command}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4 sm:px-4">
              {messages.length === 0 ? (
                <EmptyPanel
                  title="Nog geen gesprek gestart"
                  description="Gebruik de chat om iets uit te voeren, terug te vinden of slim samen te vatten. Dit moet de snelste ingang van de app zijn."
                />
              ) : (
                messages.map((message) => {
                  const isAssistant = message.role === 'assistant'
                  return (
                    <div
                      key={message.id}
                      className={cn('flex gap-3', isAssistant ? 'justify-start' : 'justify-end')}
                    >
                      {isAssistant && (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#202625] text-white">
                          <Bot size={16} />
                        </div>
                      )}

                      <div className={cn('max-w-[92%] sm:max-w-[78%]', !isAssistant && 'order-first')}>
                        <div className="mb-2 flex items-center gap-2 text-[11px] text-on-surface-variant">
                          <span className="font-semibold text-on-surface">
                            {isAssistant ? 'Assistent' : 'Jij'}
                          </span>
                          <span>{formatRelative(message.created_at)}</span>
                        </div>

                        <div
                          className={cn(
                            'rounded-[26px] border px-4 py-3.5 text-sm leading-7 shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)] sm:px-5',
                            isAssistant
                              ? 'border-black/5 bg-white text-on-surface'
                              : 'border-[#202625] bg-[#202625] text-white'
                          )}
                        >
                          {isAssistant ? (
                            <div
                              className="chat-content"
                              dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
                            />
                          ) : (
                            message.content
                          )}
                        </div>

                        {message.meta && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {message.meta.parser && <ActionPill>{message.meta.parser}</ActionPill>}
                            {message.meta.intent && <ActionPill>{message.meta.intent}</ActionPill>}
                            {typeof message.meta.actionsCount === 'number' && (
                              <ActionPill>{message.meta.actionsCount} actie(s)</ActionPill>
                            )}
                            {typeof message.meta.confidence === 'number' && message.meta.confidence > 0 && (
                              <ActionPill>{Math.round(message.meta.confidence * 100)}% zeker</ActionPill>
                            )}
                          </div>
                        )}
                      </div>

                      {!isAssistant && (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-surface-container-low text-on-surface">
                          <User size={16} />
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#202625] text-white">
                    <Bot size={16} />
                  </div>
                  <div className="rounded-[26px] border border-black/5 bg-white px-4 py-3.5 shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)]">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((index) => (
                        <span
                          key={index}
                          className="h-2 w-2 rounded-full bg-[#202625] opacity-40 animate-pulse-soft"
                          style={{ animationDelay: `${index * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-black/5 px-3 py-3 sm:px-4">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {QUICK_COMMANDS.map((command) => (
                  <button
                    key={command}
                    onClick={() => sendMessage(command)}
                    className="whitespace-nowrap rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                  >
                    {command}
                  </button>
                ))}
              </div>

              <div className="rounded-[28px] border border-black/5 bg-surface-container-low p-2 shadow-[0_18px_44px_-36px_rgba(31,37,35,0.24)]">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Bijvoorbeeld: zet morgen 14:30 tandarts in agenda"
                    rows={1}
                    className="min-h-[46px] flex-1 resize-none bg-transparent px-3 py-2 text-[15px] text-on-surface outline-none placeholder:text-on-surface-variant"
                    style={{ maxHeight: '168px' }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#202625] text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHeader
              eyebrow="Snelle opdrachten"
              title="Wat je hier direct moet kunnen"
              description="De chat is pas goed als je zonder nadenken iets kunt vragen en meteen weet wat er is gebeurd."
            />

            <div className="mt-5 space-y-2.5">
              {CAPABILITIES.map((capability) => (
                <div key={capability} className="rounded-[22px] border border-black/5 bg-white/70 px-4 py-3 text-sm text-on-surface">
                  {capability}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/agenda" className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low">
                Agenda
              </Link>
              <Link href="/todos" className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low">
                Todo’s
              </Link>
              <Link href="/memory" className="rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low">
                Memory
              </Link>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                  Engine
                </p>
                <h2 className="mt-1 text-lg font-headline font-extrabold text-on-surface">
                  Vertrouwen en debug
                </h2>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                  Debug-info hoort beschikbaar te zijn, maar mag de kernchat niet vervuilen.
                </p>
              </div>
              <button
                onClick={() => setShowLog((value) => !value)}
                className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <Bug size={13} />
                {showLog ? 'Verberg' : 'Toon'}
                {showLog ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            <div className="mt-5 rounded-[24px] border border-black/5 bg-white/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <Database size={15} />
                Laatste status
              </div>
              {lastEngineRun ? (
                <div className="mt-3 space-y-2 text-sm text-on-surface-variant">
                  <p><span className="font-semibold text-on-surface">Intent:</span> {lastEngineRun.intent}</p>
                  <p><span className="font-semibold text-on-surface">Parser:</span> {lastEngineRun.parser}</p>
                  <p><span className="font-semibold text-on-surface">Acties:</span> {lastEngineRun.actionsCount}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  Nog geen debugdata in deze sessie. Dat is prima, maar zodra je test wil je hier snel kunnen checken of er echt acties liepen.
                </p>
              )}
            </div>

            {showLog && (
              <div className="mt-4 space-y-3">
                {logs.length === 0 ? (
                  <EmptyPanel
                    title="Nog geen logregels"
                    description="Stuur een paar testopdrachten. Hier zie je dan direct welke parser draaide, met hoeveel vertrouwen en hoeveel acties eruit kwamen."
                  />
                ) : (
                  logs.map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} className="rounded-[22px] border border-black/5 bg-white/70 px-4 py-3.5">
                      <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                        <Clock3 size={12} />
                        <span>{log.timestamp}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-on-surface">{log.intent}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        Parser {log.parser} • {(log.confidence * 100).toFixed(0)}% • {log.actionsCount} actie(s)
                      </p>
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-on-surface-variant">
                        {log.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </Panel>

          <Panel tone="muted">
            <PanelHeader
              eyebrow="Productkoppeling"
              title="Chat moet niet los staan"
              description="De chat hoort als ingang van het hele systeem te voelen, niet als een apart speeltje."
            />

            <div className="mt-5 space-y-3 text-sm leading-6 text-on-surface-variant">
              <p>
                Als deze chat iets aanmaakt, moet het daarna meteen terug te vinden zijn in agenda, todo’s of boodschappen.
              </p>
              <p>
                Als hij een lijst toont, moet die uit de echte data komen en niet uit een verzonnen tekstlaag.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionPill>
                <MessageSquareText size={12} className="mr-1.5" />
                Eén ingang
              </ActionPill>
              <ActionPill>
                <Sparkles size={12} className="mr-1.5" />
                Slim maar controleerbaar
              </ActionPill>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
