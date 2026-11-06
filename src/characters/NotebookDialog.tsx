import { Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { MAX_NOTE, useDeleteNote, useNotes, useUpdateNote, type NoteRow } from './notes'

/** One note: read, edit in place, or delete after a confirmation. */
function NoteItem({ note }: { note: NoteRow }) {
  const t = useT()
  const update = useUpdateNote()
  const remove = useDeleteNote()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [draft, setDraft] = useState(note.body)
  const length = draft.trim().length
  const valid = length >= 1 && length <= MAX_NOTE

  // mutateAsync, not mutate's callbacks: a deleted note's item unmounts when the list refetches,
  // and mutate's callbacks never run once their component is gone.
  const save = async () => {
    if (!valid) return
    try {
      await update.mutateAsync({ id: note.id, body: draft })
      setEditing(false)
      toast.success(t('Note modifiée.'))
    } catch (e) {
      toast.error(t('Impossible de modifier la note : {error}', { error: (e as Error).message }))
    }
  }
  const del = async () => {
    try {
      await remove.mutateAsync(note.id)
      toast.success(t('Note supprimée.'))
    } catch (e) {
      setConfirming(false)
      toast.error(t('Impossible de supprimer la note : {error}', { error: (e as Error).message }))
    }
  }

  return (
    <li className="flex flex-col gap-2 border-l-2 border-gold bg-background/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <time dateTime={note.created_at} className="text-[0.625rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          {t.date(note.created_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </time>
        {!editing && !confirming && (
          <span className="ml-auto flex gap-1">
            <Button size="icon-sm" variant="ghost" aria-label={t('Modifier la note')} title={t('Modifier la note')}
              onClick={() => { setDraft(note.body); setEditing(true) }}>
              <Pencil />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={t('Supprimer la note')} title={t('Supprimer la note')}
              onClick={() => setConfirming(true)}>
              <Trash2 />
            </Button>
          </span>
        )}
      </div>

      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Textarea
            value={draft}
            autoFocus
            aria-label={t('Texte de la note')}
            maxLength={MAX_NOTE + 200}
            className="min-h-20 font-serif text-base"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-xs text-muted-foreground', !valid && 'text-destructive')}>
              {length > MAX_NOTE ? `${length} / ${MAX_NOTE}` : length === 0 ? t('La note ne peut pas être vide.') : ''}
            </span>
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(false)}>{t('Annuler')}</Button>
            <Button type="submit" size="sm" disabled={!valid || update.isPending}>{t('Enregistrer')}</Button>
          </div>
        </form>
      ) : (
        <p className="font-serif text-base whitespace-pre-wrap">{note.body}</p>
      )}

      {confirming && (
        <div role="group" aria-label={t('Supprimer cette note ?')} className="flex flex-wrap items-center gap-2 text-sm">
          {t('Supprimer cette note ?')}
          <Button variant="destructive" size="sm" disabled={remove.isPending} onClick={() => void del()}>{t('Oui')}</Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>{t('Non')}</Button>
        </div>
      )}
    </li>
  )
}

/** The notebook the players keep about an investigator on their phones, newest note first. */
export function NotebookDialog({ characterId, name, open, onOpenChange }: {
  characterId: string
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const notes = useNotes(open ? characterId : undefined)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto border border-gold/50 bg-card p-6 font-serif ring-0 sm:max-w-lg"
      >
        <header className="flex flex-col gap-2">
          <span className="eyebrow">{t('Carnet')}</span>
          <DialogTitle className="font-heading text-2xl font-normal">{name}</DialogTitle>
          <span className="double-rule" />
          <DialogDescription className="font-serif text-base text-muted-foreground">
            {t('Les notes que les joueurs écrivent sur leur téléphone.')}
          </DialogDescription>
          <DialogClose render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label={t('Fermer')} />}>
            <X />
          </DialogClose>
        </header>

        {notes.error && (
          <p role="alert" className="text-sm text-destructive">
            {t('Impossible de charger le carnet : {error}', { error: notes.error.message })}
          </p>
        )}
        {notes.isPending && <Skeleton className="h-24" />}
        {notes.data && (notes.data.length ? (
          <ol aria-label={t('Notes')} className="flex flex-col gap-2">
            {notes.data.map((n) => <NoteItem key={n.id} note={n} />)}
          </ol>
        ) : (
          <p className="font-serif text-lg text-muted-foreground italic">{t('Carnet vide.')}</p>
        ))}
      </DialogContent>
    </Dialog>
  )
}
