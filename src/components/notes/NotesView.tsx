'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, FileText, MoreHorizontal, Pin, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, EmptyPanel, MetricTile, Panel, PanelHeader } from '@/components/ui/Panel'
import AIContextPanel from '@/components/ai/AIContextPanel'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/material-ui-dropdown-menu'
import { Textarea } from '@/components/ui/interfaces-textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActionSearchBar, type Action } from '@/components/ui/action-search-bar'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AppDetailDrawer from '@/components/ui/AppDetailDrawer'
import FloatingActionButton from '@/components/ui/FloatingActionButton'

interface Note {
  id: number
  title: string
  content_text: string
  tags: string[]
  pinned: boolean
  updated_at: string
  project_title?: string
  project_color?: string
}

export default function NotesView() {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')
  const [smartSearch, setSmartSearch] = useState(false)
  const [quickNote, setQuickNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingQuick, setSavingQuick] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)

  const fetchNotes = useCallback(async (query?: string) => {
    const params = new URLSearchParams()
    if (query) params.set('search', query)
    if (smartSearch) params.set('smart', 'true')
    const response = await fetch(`/api/notes?${params.toString()}`)
    const payload = await response.json()
    setNotes(payload.data || [])
    setLoading(false)
  }, [smartSearch])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  useEffect(() => {
    const timer = setTimeout(() => fetchNotes(search), 250)
    return () => clearTimeout(timer)
  }, [search, smartSearch, fetchNotes])

  async function createNote(initial?: { title?: string; content?: string }) {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: initial?.title || 'Naamloze note',
        content: initial?.content || '',
        content_text: initial?.content || '',
      }),
    })
    const payload = await response.json()
    router.push(`/notes/${payload.data.id}`)
  }

  async function saveQuickNote() {
    if (!quickNote.trim() || savingQuick) return
    setSavingQuick(true)
    await createNote({
      title: quickNote.trim().slice(0, 60),
      content: quickNote.trim(),
    })
    setQuickNote('')
    setSavingQuick(false)
  }

  async function deleteNote(id: number) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes((previous) => previous.filter((note) => note.id !== id))
    setSelectedNote((current) => current?.id === id ? null : current)
  }

  const pinned = notes.filter((note) => note.pinned)
  const regular = notes.filter((note) => !note.pinned)
  const recent = notes.slice(0, 6)
  const searchActions = useMemo<Action[]>(
    () => [
      {
        id: 'command:new-note',
        label: 'Nieuwe note',
        icon: <Plus className="h-4 w-4 text-emerald-500" />,
        description: 'Maak direct een lege notitie',
        end: 'Command',
      },
      ...notes.slice(0, 12).map((note) => ({
        id: `note:${note.id}`,
        label: note.title,
        icon: <FileText className="h-4 w-4 text-blue-500" />,
        description: note.content_text?.slice(0, 60) || 'Open notitie',
        end: note.pinned ? 'Pinned' : 'Note',
      })),
    ],
    [notes]
  )

  return (
    <PageShell
      title="Notities"
      subtitle={`${notes.length} notities.`}
      desktopSearch={
        <ActionSearchBar
          actions={searchActions}
          label="Zoek notities"
          placeholder="Zoek note of actie..."
          onActionSelect={(action) => {
            if (action.id === 'command:new-note') {
              createNote()
              return
            }
            if (action.id.startsWith('note:')) {
              const found = notes.find((note) => note.id === Number(action.id.split(':')[1]))
              if (found) setSelectedNote(found)
            }
          }}
        />
      }
      actions={
        <button
          onClick={() => createNote()}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
        >
          <Plus size={15} />
          Nieuwe notitie
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Totaal" value={notes.length} meta="Alles in je kennisbank" icon={<FileText size={18} />} />
        <MetricTile label="Vastgezet" value={pinned.length} meta="Belangrijke referenties" icon={<Pin size={18} />} />
        <MetricTile label="Recent" value={recent.length} meta="Snel terugvinden" icon={<Search size={18} />} />
        <MetricTile label="Met inhoud" value={notes.filter((note) => note.content_text?.trim()).length} meta="Niet leeg opgeslagen" icon={<Sparkles size={18} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          <Panel tone="muted">
            <PanelHeader
              eyebrow="Recent"
              title="Snel terug"
              description="Je laatste notities op één plek."
            />

            <div className="mt-5 space-y-3">
              {recent.length === 0 ? (
                <EmptyPanel
                  title="Nog geen recente notities"
                  description="Zodra je notities actief gebruikt, horen de laatste items hier meteen als ingang klaar te staan."
                />
              ) : (
                recent.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="block w-full rounded-xl border border-outline-variant bg-white/70 px-4 py-3.5 text-left transition-colors hover:bg-white"
                  >
                    <p className="truncate text-sm font-semibold text-on-surface">{note.title}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{formatRelative(note.updated_at)}</p>
                  </button>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          {loading ? (
            <Panel className="min-h-[420px] animate-pulse" />
          ) : notes.length === 0 ? (
            <Panel>
              <EmptyPanel
                title="Nog geen notities"
                description="Maak een notitie of gebruik snelle capture."
              />
            </Panel>
          ) : (
            <Tabs defaultValue={pinned.length > 0 ? 'pinned' : 'all'}>
              <ScrollArea className="w-full whitespace-nowrap">
                <TabsList>
                  {pinned.length > 0 && <TabsTrigger value="pinned">Vastgezet</TabsTrigger>}
                  <TabsTrigger value="all">Alles</TabsTrigger>
                  <TabsTrigger value="recent">Recent</TabsTrigger>
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {pinned.length > 0 && (
                <TabsContent value="pinned">
                  <Panel>
                    <PanelHeader
                      eyebrow="Vastgezet"
                      title="Altijd snel bij de hand"
                      description="Belangrijke notities bovenaan."
                    />
                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 lg:hidden">
                      {pinned.map((note) => (
                        <NoteCard key={note.id} note={note} onOpen={setSelectedNote} onDelete={deleteNote} />
                      ))}
                    </div>
                    <div className="mt-5 hidden lg:block" data-slot="frame">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Titel</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Bijgewerkt</TableHead>
                            <TableHead className="text-right">Acties</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pinned.map((note) => (
                            <NoteTableRow key={note.id} note={note} onOpen={setSelectedNote} onDelete={deleteNote} />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Panel>
                </TabsContent>
              )}

              <TabsContent value="all">
                <Panel>
                  <PanelHeader
                    eyebrow={pinned.length > 0 ? 'Overige notities' : 'Alle notities'}
                    title={pinned.length > 0 ? 'Werknotities en context' : 'Je notities'}
                    description="Kaarten mogen helpen scannen, maar moeten informatie dragen in plaats van alleen mooi te ogen."
                  />
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 lg:hidden">
                    {regular.map((note) => (
                      <NoteCard key={note.id} note={note} onOpen={setSelectedNote} onDelete={deleteNote} />
                    ))}
                  </div>
                  <div className="mt-5 hidden lg:block" data-slot="frame">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Titel</TableHead>
                          <TableHead>Snippet</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead>Bijgewerkt</TableHead>
                          <TableHead className="text-right">Acties</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regular.map((note) => (
                          <NoteTableRow key={note.id} note={note} onOpen={setSelectedNote} onDelete={deleteNote} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Panel>
              </TabsContent>

              <TabsContent value="recent">
                <Panel>
                  <PanelHeader
                    eyebrow="Recent"
                    title="Laatste wijzigingen"
                    description="Snel terug naar waar je net was."
                  />
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {recent.map((note) => (
                      <NoteCard key={note.id} note={note} onOpen={setSelectedNote} onDelete={deleteNote} />
                    ))}
                  </div>
                </Panel>
              </TabsContent>
            </Tabs>
            )}
        </div>
      </div>
      <AppDetailDrawer
        open={!!selectedNote}
        onClose={() => setSelectedNote(null)}
        eyebrow="Notitie"
        title={selectedNote?.title}
        subtitle={selectedNote?.content_text?.trim() ? selectedNote.content_text.slice(0, 180) : 'Lege notitie.'}
        status={selectedNote?.pinned ? 'Vastgezet' : undefined}
        primaryHref={selectedNote ? `/notes/${selectedNote.id}` : undefined}
        primaryLabel="Open editor"
        fields={[
          { label: 'Bijgewerkt', value: selectedNote ? formatRelative(selectedNote.updated_at) : '-' },
          { label: 'Project', value: selectedNote?.project_title || 'Geen project' },
          { label: 'Tags', value: selectedNote?.tags?.length ? selectedNote.tags.join(', ') : 'Geen tags' },
        ]}
        actions={selectedNote ? [
          { label: 'Verwijderen', variant: 'outlined', onClick: () => deleteNote(selectedNote.id) },
        ] : []}
      />
      <FloatingActionButton label="Nieuwe notitie" onClick={() => createNote()} />
    </PageShell>
  )
}

function NoteCard({
  note,
  onOpen,
  onDelete,
}: {
  note: Note
  onOpen: (note: Note) => void
  onDelete: (id: number) => void
}) {
  const [aiOpen, setAiOpen] = useState(false)

  return (
    <div
      onClick={() => onOpen(note)}
      className="group relative block cursor-pointer rounded-xl border border-outline-variant bg-white p-4 text-left shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container-low"
    >
      {note.pinned && (
        <div className="absolute right-4 top-4">
          <Pin size={12} className="text-on-surface-variant" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 pr-6 text-sm font-semibold leading-6 text-on-surface">
          {note.title}
        </h3>
        <div className="opacity-0 transition-opacity group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface">
              <MoreHorizontal size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[12rem] rounded-2xl bg-white">
              <DropdownMenuItem onSelect={() => setAiOpen(true)}>
                <Sparkles size={13} />
                <span>AI context</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[#a55a2c]"
                onSelect={() => onDelete(note.id)}
              >
                <Trash2 size={13} />
                <span>Verwijderen</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="mt-3 min-h-[88px] line-clamp-5 text-sm leading-7 text-on-surface-variant">
        {note.content_text?.trim() || 'Lege note'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {note.tags.slice(0, 3).map((tag) => (
          <ActionPill key={tag}>{tag}</ActionPill>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-outline-variant pt-4">
        <span className="text-xs text-on-surface-variant">{formatRelative(note.updated_at)}</span>
        {note.project_title && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: `${note.project_color ?? '#5a677b'}18`,
              color: note.project_color ?? '#5a677b',
            }}
          >
            {note.project_title}
          </span>
        )}
      </div>
      {aiOpen && (
        <AIContextPanel
          type="note"
          title={note.title}
          content={note.content_text?.slice(0, 200)}
          id={note.id}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  )
}

function NoteTableRow({
  note,
  onOpen,
  onDelete,
}: {
  note: Note
  onOpen: (note: Note) => void
  onDelete: (id: number) => void
}) {
  const [aiOpen, setAiOpen] = useState(false)

  return (
    <TableRow onClick={() => onOpen(note)} className="cursor-pointer">
      <TableCell className="font-medium">
        <button onClick={(event) => { event.stopPropagation(); onOpen(note) }} className="max-w-[220px] truncate text-left text-on-surface hover:text-accent">
          {note.title}
        </button>
      </TableCell>
      <TableCell className="max-w-[220px] truncate text-on-surface-variant">
        {note.project_title || note.content_text?.trim() || 'Lege note'}
      </TableCell>
      <TableCell>
        <div className="flex max-w-[220px] flex-wrap gap-1">
          {note.tags.length > 0 ? note.tags.slice(0, 3).map((tag) => (
            <ActionPill key={tag}>{tag}</ActionPill>
          )) : (
            <span className="text-xs text-on-surface-variant">Geen tags</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-on-surface-variant">{formatRelative(note.updated_at)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(event) => { event.stopPropagation(); setAiOpen(true) }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            <Sparkles size={13} />
          </button>
          <button
            onClick={(event) => { event.stopPropagation(); onDelete(note.id) }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-[#a55a2c]"
          >
            <Trash2 size={13} />
          </button>
        </div>
        {aiOpen && (
          <AIContextPanel
            type="note"
            title={note.title}
            content={note.content_text?.slice(0, 200)}
            id={note.id}
            onClose={() => setAiOpen(false)}
          />
        )}
      </TableCell>
    </TableRow>
  )
}
