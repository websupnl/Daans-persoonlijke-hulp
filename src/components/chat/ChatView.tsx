'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextareaAutosize from '@mui/material/TextareaAutosize'
import Typography from '@mui/material/Typography'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import BugReportIcon from '@mui/icons-material/BugReport'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SendIcon from '@mui/icons-material/Send'
import { useSearchParams } from 'next/navigation'
import { formatMarkdown, formatRelative } from '@/lib/utils'

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
}

const examples = [
  '/taak: offerte opvolgen',
  '/log: 2u aan project X gewerkt',
  '/fin: lunch 15 euro',
  'Hoe sta ik er financieel voor?',
]

const actionLabels: Record<string, { label: string; color: 'primary' | 'success' | 'warning' | 'secondary' | 'info' | 'error' }> = {
  todo_create: { label: 'Taak aangemaakt', color: 'primary' },
  grocery_create: { label: 'Boodschap toegevoegd', color: 'success' },
  finance_create_expense: { label: 'Uitgave opgeslagen', color: 'warning' },
  worklog_create: { label: 'Uren gelogd', color: 'info' },
  memory_store: { label: 'Geheugen bijgewerkt', color: 'secondary' },
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
      <CircularProgress size={14} />
      <Typography variant="caption">{status}</Typography>
    </Stack>
  )
}

function ActionCard({ action }: { action: DebugAction }) {
  const spec = actionLabels[action.type] ?? { label: action.type, color: 'primary' as const }
  const failed = action.result?.success === false

  return (
    <Paper
      sx={{
        mt: 1.5,
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: failed ? 'error.main' : `${spec.color}.main`,
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {failed ? <ErrorOutlineIcon color="error" fontSize="small" /> : <CheckCircleIcon color={spec.color as any} fontSize="small" />}
            <Typography variant="overline" color="text.secondary">
              {spec.label}
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
    </Paper>
  )
}

export default function ChatView() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Interpreteren...')
  const [showExamples, setShowExamples] = useState(true)
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
    setShowExamples(history.length === 0)
    setInitialLoad(false)
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!initialLoad && initialQuery) {
      sendMessage(initialQuery)
      // Clear URL parameter without reload
      window.history.replaceState({}, '', '/chat')
    }
  }, [initialLoad, initialQuery, sendMessage])

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
      content: imageAttachment ? `${message || 'Analyseer deze foto.'}\n\n[Foto: ${imageAttachment.name}]` : message,
      created_at: new Date().toISOString(),
    }

    setMessages((current) => [...current, userMessage])
    setInput('')
    setImageAttachment(null)
    setShowExamples(false)
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

          const data = JSON.parse(line.slice(6))
          if (data.type === 'status') {
            if (String(data.text).includes('Acties')) setLoadingStatus('Actie uitvoeren...')
            else setLoadingStatus('Interpreteren...')
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
    } catch {
      setMessages((current) => [
        ...current,
        { id: Date.now() + 2, role: 'error', content: 'Er ging iets fout. Je bericht is bewaard.', created_at: new Date().toISOString() },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, imageAttachment, loading])

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
    setShowExamples(false)
    inputRef.current?.focus()
  }

  async function resetChat() {
    await fetch('/api/chat', { method: 'DELETE' })
    setMessages([])
    setShowExamples(true)
  }

  const contextCount = useMemo(() => Math.min(messages.reduce((count, item) => count + (item.debugInfo?.actions?.length ?? 0), 1), 9), [messages])

  if (initialLoad) {
    return (
      <Box sx={{ height: { xs: 'calc(100dvh - 72px)', md: '100dvh' }, display: 'grid', placeItems: 'center' }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
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
            <Box sx={{ width: 38, height: 38, borderRadius: 999, display: 'grid', placeItems: 'center', color: 'common.white', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
              <AutoAwesomeIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h4" noWrap>
                Chat met je AI
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Acties worden zichtbaar uitgevoerd en als action card bevestigd.
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
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
            {showExamples && (
              <Paper sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AutoAwesomeIcon color="secondary" fontSize="small" />
                  <Typography variant="overline" color="text.secondary">
                    Snelle opdrachten
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                  {examples.map((example) => (
                    <Button key={example} variant="outlined" size="small" onClick={() => sendMessage(example)}>
                      {example}
                    </Button>
                  ))}
                </Stack>
              </Paper>
            )}

            {messages.map((message) => {
              const isUser = message.role === 'user'
              const isError = message.role === 'error'
              return (
                <Stack key={message.id} direction="row" justifyContent={isUser ? 'flex-end' : 'flex-start'} spacing={1.5}>
                  {!isUser && (
                    <Box sx={{ width: 32, height: 32, mt: 0.5, borderRadius: 999, flexShrink: 0, display: { xs: 'none', sm: 'grid' }, placeItems: 'center', color: 'common.white', background: isError ? 'error.main' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
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
                        borderRadius: isUser ? '18px 18px 6px 18px' : '6px 18px 18px 18px',
                        bgcolor: isUser ? 'text.primary' : isError ? 'error.light' : 'background.paper',
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
                <Chip
                  clickable
                  size="small"
                  icon={<PhotoCameraIcon />}
                  label="Maak foto / upload bon"
                  color="primary"
                  onClick={() => fileInputRef.current?.click()}
                />
              </Stack>
            )}
            {imageAttachment && (
              <Paper sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
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
            <Paper sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: '#fafafb' }}>
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <IconButton aria-label="Maak foto of upload bon" onClick={() => fileInputRef.current?.click()}>
                  <AttachFileIcon fontSize="small" />
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
                  placeholder="Typ een bericht of vraag iets aan je AI..."
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
                  {loading ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
                </IconButton>
              </Stack>
            </Paper>
          </Stack>
        </Container>
      </Paper>
    </Box>
  )
}
