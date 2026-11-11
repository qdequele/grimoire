// The title and text of a card the keeper fills in when giving it (catalogue templates: a letter, a
// telegram, a floor plan…; or a key and what it opens). Shared by the "Donner un objet" dialog and the items page.
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n/t'
import { ITEM_LIMITS, type ItemCard, type ItemKind } from './item'

export interface DocumentDraft {
  title: string
  text: string
}

/** The given card: the keeper's title (else the template's) and text; the template's own blurb gives way to it. */
export function filledCard(card: ItemCard, d: DocumentDraft, fallbackTitle: string): ItemCard {
  const name = d.title.replace(/[<>&"]/g, '').trim().slice(0, ITEM_LIMITS.name) || fallbackTitle
  const document = d.text.trim().slice(0, ITEM_LIMITS.document)
  if (!document) return { ...card, name }
  const { text: _blurb, ...rest } = card
  return { ...rest, name, document }
}

export function DocumentFields({ id, draft, onChange, kind = 'document' }: { id: string; draft: DocumentDraft; onChange: (d: DocumentDraft) => void; kind?: ItemKind }) {
  const t = useT()
  const key = kind === 'key'
  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor={`${id}-title`}>{key ? t('Nom de la clé') : t('Titre du document')}</FieldLabel>
        <Input id={`${id}-title`} value={draft.title} maxLength={ITEM_LIMITS.name} onChange={(e) => onChange({ ...draft, title: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-text`}>{key ? t('Ce qu’elle ouvre (facultatif)') : t('Ce qu’il dit')}</FieldLabel>
        <Textarea
          id={`${id}-text`}
          rows={key ? 2 : 6}
          value={draft.text}
          maxLength={ITEM_LIMITS.document}
          placeholder={key ? t('Par exemple : la grille de la crypte, derrière la chapelle.') : t('Le texte que le joueur pourra relire sur son téléphone. **gras**, *italique*, un retour à la ligne par paragraphe.')}
          onChange={(e) => onChange({ ...draft, text: e.target.value })}
        />
      </Field>
    </div>
  )
}
