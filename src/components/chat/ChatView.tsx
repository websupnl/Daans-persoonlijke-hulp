'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextareaAutosize from '@mui/material/TextareaAutosize'
import Typography from '@mui/material/Typography'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SendIcon from '@mui/icons-material/Send'
import { useSearchParams } from 'next/navigation'
import { formatMarkdown, formatRelative } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

interface DebugAction {
  type: string
  payload?: Record<string, unknown>
  result?: { success: boolean; error?: string; data?: unknown }
}

interface DebugInfo {
  summary?: string
  actions?: DebugAction[]
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
  imagePreviewUrl?: string
  imageName?: string
}

const commandBlocks = [
  { label: 'Agenda', prompt: '/agenda: ' },
  { label: 'Taken', prompt: '/taak: ' },
  { label: 'Boodschappen', prompt: '/boodschap: ' },
  { label: 'Transactie', prompt: '/fin: ' },
]

const actionLabels: Record<string, { label: string; color: 'primary' | 'success' | 'warning' | 'secondary' | 'info' | 'error' }> = {
  todo_create: { label: 'Taak aangemaakt', color: 'primary' },
  todo_update: { label: 'Taak bijgewerkt', color: 'primary' },
  todo_complete: { label: 'Taak afgerond', color: 'success' },
  grocery_create: { label: 'Boodschap toegevoegd', color: 'success' },
  finance_create_expense: { label: 'Uitgave opgeslagen', color: 'warning' },
  finance_create_income: { label: 'Inkomst opgeslagen', color: 'success' },
  event_create: { label: 'Agenda-item aangemaakt', color: 'info' },
  worklog_create: { label: 'Uren gelogd', color: 'info' },
  note_create: { label: 'Notitie aangemaakt', color: 'secondary' },
  journal_create: { label: 'Dagboek bijgewerkt', color: 'secondary' },
  habit_log: { label: 'Gewoonte gelogd', color: 'success' },
  memory_store: { label: 'Geheugen bijgewerkt', color: 'secondary' },
  inbox_capture: { label: 'Inbox-item opgeslagen', color: 'info' },
}

function parseStreamData(line: string) {
  try {
    return JSON.parse(line.slice(6))
  } catch {
    return null
  }
}

function getActionTitle(action: DebugAction) {
  if (typeof action.payload?.title === 'string') return action.payload.title
  if (typeof action.payload?.name === 'string') return action.payload.name
  if (typeof action.payload?.raw_text === 'string') return action.payload.raw_text
  return actionLabels[action.type]?.label ?? action.type
}

function ThinkingState({ status }: { status: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', px: 1 }}>
      <Spinner className="h-3.5 w-3.5" />
      <Typography variant="caption">{status}</Typography>
    </Stack>
  )
}

function ActionSummary({ debugInfo }: { debugInfo?: DebugInfo }) {
  const actions = debugInfo?.actions ?? []
  const successful = actions.filter((action) => action.result?.success === true).length
  const failed = actions.filter((action) => action.result?.success === false).length

  if (!debugInfo?.requires_confirmation && actions.length === 0) return null

  return (
    <Box
      sx={{
        mt: 1.25,
        p: 1.25,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'var(--surface-container-low)',
      }}
    >
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
        {debugInfo?.requires_confirmation ? (
          <Chip size="small" color="warning" label={`${actions.length} actie(s) wachten op bevestiging`} />
        ) : (
          <Chip size="small" color={failed > 0 ? 'warning' : 'success'} label={`${successful}/${actions.length} uitgevoerd`} />
        )}
        {failed > 0 && <Chip size="small" color="error" variant="outlined" label={`${failed} mislukt`} />}
        {debugInfo?.summary && (
          <Typography variant="caption" color="text.secondary" sx={{ flexBasis: '100%', letterSpacing: 0 }}>
            {debugInfo.summary}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

function ActionCard({ action }: { action: DebugAction }) {
  const spec = actionLabels[action.type] ?? { label: action.type, color: 'primary' as const }
  const failed = action.result?.success === false
  const pending = !action.result

  return (
    <Box
      sx={{
        mt: 1,
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: failed ? 'error.light' : pending ? 'warning.light' : 'background.paper',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {failed ? <ErrorOutlineIcon color="error" fontSize="small" /> : <CheckCircleIcon color={pending ? 'warning' : spec.color as any} fontSize="small" />}
            <Typography variant="overline" color="text.secondary">
              {pending ? 'Wacht op bevestiging' : spec.label}
            </Typography>
          </Stack>
          <Typography variant="body2" fontWeight={800} sx={{ mt: 0.5 }}>
            {getActionTitle(action)}
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {Object.entries(action.payload ?? {})
              .filter(([key, value]) => typeof value === 'string' && key !== 'title' && key !== 'name')
              .slice(0, 4)
              .map(([key, value]) => (
                <Chip key={key} size="small" label={`${key}: ${String(value)}`} variant="outlined" />
              ))}
          </Stack>
          {action.result?.error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
              {action.result.error}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  )
}

export default function ChatView() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Interpreteren...')
  const [initialLoad, setInitialLoad] = useState(true)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [imageAttachment, setImageAttachment] = useState<{ base64: string; mimeType: string; name: string; previewUrl: string } | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadHistory = useCallback(async () => {
    const response = await fetch('/api/chat?limit=40')
    const payload = await response.json()
    const history = (payload.data || []).map((message: any) => ({
      ...message,
      role: message.role === 'assistant' || message.role === 'user' ? message.role : 'assistant',
      debugInfo: message.actions && typeof message.actions === 'object' && !Array.isArray(message.actions) ? message.actions : undefined,
    }))
    setMessages(history)
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
    setShowScrollDown(element.scrollHeight - element.scrollTop - element.clientHeight > 160)
  }, [])

  const sendMessage = useCallback(async (text?: string) => {
    const message = (text ?? input).trim()
    if ((!message && !imageAttachment) || loading) return

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: message || (imageAttachment ? 'Analyseer deze foto.' : ''),
      created_at: new Date().toISOString(),
      imagePreviewUrl: imageAttachment?.previewUrl,
      imageName: imageAttachment?.name,
    }

    setMessages((current) => [...current, userMessage])
    setInput('')
    setImageAttachment(null)
    setLoading(true)
    setLoadingStatus('Interpreteren...')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message || 'Analyseer deze foto. Als dit een kassabon of factuur is, haal bedrag, datum, winkel en categorie eruit en sla het logisch op.',
          imageBase64: imageAttachment?.base64,
          imageType: imageAttachment?.mimeType,
        }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error?.message || errorPayload?.message || 'Chat request mislukt')
      }
      if (!response.body) throw new Error('Geen stream')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistantText = ''
      let debugInfo: DebugInfo | undefined
      let finalMessageAdded = false

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

          const data = parseStreamData(line)
          if (!data) continue
          if (data.type === 'status') {
            setLoadingStatus(String(data.text || 'Bezig...'))
          }
          if (data.type === 'debug') debugInfo = data.data
          if (data.type === 'text') {
            assistantText += data.text
          }
          if (data.type === 'done') {
            finalMessageAdded = true
            setMessages((current) => [
              ...current,
              {
                id: Date.now() + 1,
                role: 'assistant',
                content: assistantText || data.debugInfo?.summary || 'Afgerond.',
                created_at: new Date().toISOString(),
                debugInfo: debugInfo ?? data.debugInfo,
                streaming: false,
              },
            ])
          }
          if (data.type === 'error') {
            finalMessageAdded = true
            setMessages((current) => [
              ...current,
              { id: Date.now() + 2, role: 'error', content: data.text, created_at: new Date().toISOString(), streaming: false },
            ])
          }
        }
      }
      if (!finalMessageAdded && assistantText) {
        setMessages((current) => [
          ...current,
          { id: Date.now() + 3, role: 'assistant', content: assistantText, created_at: new Date().toISOString(), debugInfo, streaming: false },
        ])
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 2,
          role: 'error',
          content: error instanceof Error ? error.message : 'Ik kon dit bericht niet afronden. Probeer het opnieuw.',
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, imageAttachment, loading])

  useEffect(() => {
    if (!initialLoad && initialQuery) {
      sendMessage(initialQuery)
      // Clear URL parameter without reload
      window.history.replaceState({}, '', '/chat')
    }
  }, [initialLoad, initialQuery, sendMessage])

  async function handleImageSelect(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessages((current) => [
        ...current,
        { id: Date.now(), role: 'error', content: 'Upload alleen een afbeelding, bijvoorbeeld een foto van een kassabon.', created_at: new Date().toISOString() },
      ])
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    const [, base64 = ''] = dataUrl.split(',')
    setImageAttachment({
      base64,
      mimeType: file.type,
      name: file.name || 'foto',
      previewUrl: dataUrl,
    })
    inputRef.current?.focus()
  }

  async function resetChat() {
    await fetch('/api/chat', { method: 'DELETE' })
    setMessages([])
  }

  const contextCount = useMemo(() => Math.min(messages.reduce((count, item) => count + (item.debugInfo?.actions?.length ?? 0), 1), 9), [messages])

  if (initialLoad) {
    return (
      <Box sx={{ height: { xs: 'calc(100dvh - 72px)', md: '100dvh' }, display: 'grid', placeItems: 'center' }}>
        <Stack alignItems="center" spacing={2}>
          <Spinner className="h-6 w-6 text-[var(--brand-primary)]" />
          <Typography variant="body2" color="text.secondary">
            Chat laden...
          </Typography>
        </Stack>
      </Box>
    )
  }

  return (
    <Box sx={{ height: { xs: 'calc(100dvh - 72px)', md: '100dvh' }, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Paper sx={{ borderRadius: 0, borderBottom: '1px solid', borderColor: 'divider', px: { xs: 2, md: 3 }, py: 1.5, position: 'sticky', top: 0, zIndex: 10 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 1, display: 'grid', placeItems: 'center', color: 'common.white', background: 'var(--brand-gradient)' }}>
              <AutoAwesomeIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h4" noWrap>
                Chat met je AI
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            {loading && <Chip size="small" color="info" variant="outlined" label={loadingStatus} />}
            <Chip size="small" color="primary" variant="outlined" label={`${contextCount} context-items`} />
            <IconButton onClick={resetChat} aria-label="Nieuw gesprek">
              <RestartAltIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>

      <Box ref={listRef} onScroll={syncScrollState} sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Container maxWidth="md" sx={{ py: 3 }}>
          <Stack spacing={2}>
            {messages.map((message) => {
              const isUser = message.role === 'user'
              const isError = message.role === 'error'
              return (
                <Stack key={message.id} direction="row" justifyContent={isUser ? 'flex-end' : 'flex-start'} spacing={1.5}>
                  {!isUser && (
                    <Box sx={{ width: 32, height: 32, mt: 0.5, borderRadius: 1, flexShrink: 0, display: { xs: 'none', sm: 'grid' }, placeItems: 'center', color: 'common.white', background: isError ? 'error.main' : 'var(--brand-gradient)' }}>
                      {isError ? <ErrorOutlineIcon fontSize="small" /> : <AutoAwesomeIcon fontSize="small" />}
                    </Box>
                  )}
                  <Box sx={{ maxWidth: { xs: isUser ? '86%' : '94%', sm: isUser ? '72%' : '82%' }, minWidth: 0 }}>
                    <Paper
                      sx={{
                        px: 2,
                        py: 1.5,
                        border: isUser ? 'none' : '1px solid',
                        borderColor: isError ? 'error.light' : 'divider',
                        borderRadius: isUser ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
                        bgcolor: isUser ? 'transparent' : isError ? 'error.light' : 'background.paper',
                        backgroundImage: isUser ? 'var(--brand-gradient)' : undefined,
                        color: isUser ? 'common.white' : 'text.primary',
                      }}
                    >
                      {isError ? (
                        <Typography variant="body2" color="error.dark">
                          {message.content}
                        </Typography>
                      ) : (
                        <Box
                          sx={{
                            '& p': { my: 0.5 },
                            '& ul, & ol': { pl: 2.25 },
                            '& code': { bgcolor: isUser ? 'rgba(255,255,255,0.14)' : '#f4f4f5', px: 0.5, py: 0.2, borderRadius: 1 },
                          }}
                          dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content || '...') }}
                        />
                      )}
                      {isUser && message.imagePreviewUrl && (
                        <Box
                          component="img"
                          src={message.imagePreviewUrl}
                          alt={message.imageName || 'Verzonden foto'}
                          sx={{
                            display: 'block',
                            mt: message.content ? 1.25 : 0,
                            width: 'min(240px, 100%)',
                            maxHeight: 220,
                            objectFit: 'cover',
                            borderRadius: 1,
                            border: '1px solid rgba(255,255,255,0.28)',
                          }}
                        />
                      )}
                      {!isUser && <ActionSummary debugInfo={message.debugInfo} />}
                      {!isUser && message.debugInfo?.actions?.map((action, index) => (
                        <ActionCard key={`${message.id}-${index}`} action={action} />
                      ))}
                    </Paper>
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, textAlign: isUser ? 'right' : 'left' }}>
                      {formatRelative(message.created_at)}
                    </Typography>
                  </Box>
                </Stack>
              )
            })}

            {loading && <ThinkingState status={loadingStatus} />}
            <div ref={bottomRef} />
          </Stack>
        </Container>

        {showScrollDown && (
          <IconButton
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            sx={{ position: 'fixed', right: { xs: 16, md: 32 }, bottom: 112, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: 2 }}
          >
            <ArrowDownwardIcon />
          </IconButton>
        )}
      </Box>

      <Paper sx={{ borderRadius: 0, borderTop: '1px solid', borderColor: 'divider', px: { xs: 2, md: 3 }, py: 1.5 }}>
        <Container maxWidth="md" disableGutters>
          <Stack spacing={1}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(event) => {
                handleImageSelect(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            {!input && !imageAttachment && (
              <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                {commandBlocks.map((command) => (
                  <Chip
                    key={command.label}
                    clickable
                    size="small"
                    label={command.label}
                    variant="outlined"
                    onClick={() => {
                      setInput(command.prompt)
                      inputRef.current?.focus()
                    }}
                    sx={{
                      bgcolor: 'rgba(168,206,207,0.10)',
                      borderColor: 'rgba(95,159,161,0.22)',
                      fontWeight: 800,
                    }}
                  />
                ))}
                <Chip
                  clickable
                  size="small"
                  icon={<PhotoCameraIcon />}
                  label="Maak foto"
                  color="primary"
                  onClick={() => fileInputRef.current?.click()}
                />
              </Stack>
            )}
            {imageAttachment && (
              <Paper sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box
                    component="img"
                    src={imageAttachment.previewUrl}
                    alt={imageAttachment.name}
                    sx={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={800} noWrap>{imageAttachment.name}</Typography>
                    <Typography variant="caption" color="text.secondary">Klaar om te analyseren, bijvoorbeeld als kassabon.</Typography>
                  </Box>
                  <IconButton aria-label="Verwijder foto" onClick={() => setImageAttachment(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Paper>
            )}
            <Paper sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: '#fafafb' }}>
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <IconButton aria-label="Maak foto" onClick={() => fileInputRef.current?.click()}>
                  <PhotoCameraIcon fontSize="small" />
                </IconButton>
                <TextareaAutosize
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      sendMessage()
                    }
                  }}
                  minRows={1}
                  maxRows={5}
                  placeholder="Typ je bericht..."
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: 0,
                    outline: 0,
                    background: 'transparent',
                    font: 'inherit',
                    padding: '8px 10px',
                    color: '#0f0f10',
                  }}
                />
                <IconButton color="primary" onClick={() => sendMessage()} disabled={(!input.trim() && !imageAttachment) || loading} sx={{ bgcolor: (input.trim() || imageAttachment) && !loading ? 'primary.main' : 'transparent', color: (input.trim() || imageAttachment) && !loading ? 'common.white' : 'text.disabled', '&:hover': { bgcolor: (input.trim() || imageAttachment) && !loading ? 'primary.dark' : 'action.hover' } }}>
                  {loading ? <Spinner className="h-[18px] w-[18px]" /> : <SendIcon fontSize="small" />}
                </IconButton>
              </Stack>
            </Paper>
          </Stack>
        </Container>
      </Paper>
    </Box>
  )
}
