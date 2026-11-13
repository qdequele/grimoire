import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { useAddNote } from './api'
import { useSheetContext } from './SheetPage'

const MAX_NOTE = 2000

/**
 * Carnet tab: the investigator's own notebook (the player writes here), and "Lire les carnets" to
 * read the others' (read-only). Newest note first.
 */
export function Notebook() {
  const t = useT()
  const { token, view, member } = useSheetContext()
  const [reading, setReading] = useState(member.id)
  const [draft, setDraft] = useState('')
  const addNote = useAddNote(token)

  const shown = view.party.find((m) => m.id === reading) ?? member
  const own = shown.id === member.id
  const notes = view.notes.filter((n) => n.characterId === shown.id)
  const length = draft.trim().length
  const canAdd = length >= 1 && length <= MAX_NOTE && !addNote.isPending

  const submit = () => {
    if (!canAdd) return
    addNote.mutate({ characterId: member.id, body: draft.trim() }, { onSuccess: () => setDraft('') })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      {view.party.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="eyebrow">{t('Lire les carnets')}</h2>
          <div className="flex flex-wrap gap-1.5">
            {view.party.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={m.id === shown.id}
                onClick={() => setReading(m.id)}
                className={cn(
                  'border border-border px-2.5 py-1.5 text-[0.6875rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase hover:text-foreground',
                  m.id === shown.id && 'border-gold text-gold hover:text-gold',
                )}
              >
                {m.data.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="eyebrow">{own ? t('Carnet') : t('Carnet de {name}', { name: shown.data.name })}</h2>

        {own && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // On a keyboard, Ctrl+Enter (⌘+Enter on a Mac) adds the note.
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={t('Écrire une note…')}
              aria-label={t('Écrire une note…')}
              maxLength={MAX_NOTE + 200}
              className="min-h-20 font-serif text-lg md:text-lg"
            />
            <div className="flex items-center justify-between gap-2">
              <span className={cn('text-xs text-muted-foreground', length > MAX_NOTE && 'text-destructive')}>
                {length > MAX_NOTE ? `${length} / ${MAX_NOTE}` : ''}
              </span>
              <Button type="submit" variant="outline" className="border-gold text-gold hover:text-gold" disabled={!canAdd}>
                {t('Ajouter')}
              </Button>
            </div>
          </form>
        )}

        {notes.length ? (
          <ol className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="border-l-2 border-gold bg-card px-3 py-2">
                <time dateTime={n.createdAt} className="block text-[0.625rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                  {t.date(n.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </time>
                <p className="font-serif text-lg whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="font-serif text-lg text-muted-foreground italic">{t('Carnet vide.')}</p>
        )}
      </section>
    </div>
  )
}
