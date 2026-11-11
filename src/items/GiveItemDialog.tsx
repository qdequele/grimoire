// "Donner un objet": the keeper picks a card from the catalogue or the story being played, or makes
// one on the spot, and gives it to an investigator. The dialog stays open to give several.
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { hasMarkup } from '@/characters/character'
import { skillName, useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { SKILLS } from '@/rules/d100'
import { useGiveItem } from './api'
import { ART_IDS, type ArtId } from './arts'
import { CATALOG } from './catalog'
import { ITEM_KINDS, ITEM_LIMITS, KIND_ART, KIND_LABEL, parseCard, USE_UNITS, WEAPON_SKILLS, type ItemCard as Card, type ItemKind, type UseUnit } from './item'
import { ItemArt } from './ItemArt'
import { searchCatalog } from './search'
import { ItemCard } from './ItemCard'
import { DRAFT_PROBLEMS, localCard } from './text'

/** An item of the story being played, ready to give. */
export interface StoryItemChoice {
  /** The story's row id (stories.id). */
  storyId: string
  /** The item's id in the story. */
  itemId: string
  card: Card
}

type Tab = 'catalog' | 'story' | 'new'
type Pick = { tab: 'catalog'; id: string } | { tab: 'story'; itemId: string }

const ALL = 'all'

/** A grid of cards to choose from (a button each). */
function CardPicker({ cards, selected, onSelect }: { cards: Array<{ key: string; card: Card; source: Parameters<typeof ItemCard>[0]['source'] }>; selected: string | null; onSelect: (key: string) => void }) {
  const t = useT()
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {cards.map(({ key, card, source }) => (
        <li key={key}>
          <button
            type="button"
            aria-pressed={selected === key}
            aria-label={localCard(t, card, source).name}
            onClick={() => onSelect(key)}
            className={cn(
              'block w-full rounded-none p-1 outline-offset-2 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-gold',
              selected === key && 'outline-2 outline-gold',
            )}
          >
            <ItemCard card={card} source={source} as="h4" />
          </button>
        </li>
      ))}
    </ul>
  )
}

interface Draft {
  name: string
  kind: ItemKind
  art: ArtId
  text: string
  skill: string
  damage: string
  db: boolean
  range: string
  rate: string
  malfunction: string
  uses: string
  unit: UseUnit
  ammo: string
  bonusSkill: string
  bonusNote: string
}

const EMPTY: Draft = {
  name: '', kind: 'gear', art: KIND_ART.gear, text: '', skill: 'fighting-brawl', damage: '', db: true, range: '', rate: '1',
  malfunction: '', uses: '', unit: 'utilisations', ammo: '', bonusSkill: '', bonusNote: '',
}

/** The draft as a card (parseCard checks it), and what to fix in the keeper's words. */
function draftCard(d: Draft): { card: Card | null; problem: string | null } {
  const name = d.name.trim()
  if (!name) return { card: null, problem: DRAFT_PROBLEMS[0] }
  if (hasMarkup(name)) return { card: null, problem: DRAFT_PROBLEMS[1] }
  const weapon = d.kind === 'weapon'
  if (weapon && !/\d/.test(d.damage)) return { card: null, problem: DRAFT_PROBLEMS[2] }
  const raw: Record<string, unknown> = { name, kind: d.kind, art: d.art }
  if (d.text.trim()) raw.text = d.text.trim()
  if (weapon) {
    const w: Record<string, unknown> = { skill: d.skill, damage: d.damage.trim().toUpperCase() }
    if (d.skill === 'fighting-brawl' || d.skill === 'throw') w.db = d.db
    if (d.range.trim()) w.range = d.range.trim()
    if (d.rate.trim()) w.rate = d.rate.trim()
    if (d.malfunction) w.malfunction = Number(d.malfunction)
    if (d.skill.startsWith('firearms')) w.impale = true
    raw.weapon = w
  }
  if (d.uses) {
    raw.uses = Number(d.uses)
    raw.unit = d.unit
  }
  if ((weapon || d.kind === 'ammo') && d.ammo.trim()) raw.ammo = d.ammo.trim()
  if (d.bonusSkill) raw.bonus = d.bonusNote.trim() ? { skill: d.bonusSkill, note: d.bonusNote.trim() } : { skill: d.bonusSkill }
  const parsed = parseCard(raw)
  return parsed.card ? { card: parsed.card, problem: null } : { card: null, problem: DRAFT_PROBLEMS[3] }
}

function NewCardForm({ draft, set }: { draft: Draft; set: (patch: Partial<Draft>) => void }) {
  const t = useT()
  const weapon = draft.kind === 'weapon'
  const id = (k: string) => `item-new-${k}`
  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel htmlFor={id('name')}>{t('Nom')}</FieldLabel>
        <Input id={id('name')} value={draft.name} maxLength={ITEM_LIMITS.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('Clé de la crypte')} />
      </Field>
      <Field>
        <FieldLabel htmlFor={id('kind')}>{t('Type')}</FieldLabel>
        <NativeSelect id={id('kind')} value={draft.kind} onChange={(e) => {
          const kind = e.target.value as ItemKind
          set({ kind, art: draft.art === KIND_ART[draft.kind] ? KIND_ART[kind] : draft.art, unit: kind === 'weapon' || kind === 'ammo' ? 'balles' : draft.unit })
        }}>
          {ITEM_KINDS.map((k) => <NativeSelectOption key={k} value={k}>{t(KIND_LABEL[k])}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('Illustration')}</legend>
        <div className="grid grid-cols-8 gap-1">
          {ART_IDS.map((a) => (
            <button key={a} type="button" aria-pressed={draft.art === a} aria-label={a} onClick={() => set({ art: a })}
              className={cn('aspect-square border bg-card p-0.5 hover:border-gold', draft.art === a && 'border-gold bg-secondary')}>
              <ItemArt art={a} className="size-full [--ia-line:#15110a]" />
            </button>
          ))}
        </div>
      </fieldset>
      {weapon && (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={id('skill')}>{t('Compétence')}</FieldLabel>
            <NativeSelect id={id('skill')} value={draft.skill} onChange={(e) => set({ skill: e.target.value })}>
              {WEAPON_SKILLS.map((s) => <NativeSelectOption key={s} value={s}>{skillName(t, s)}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={id('damage')}>{t('Dégâts')}</FieldLabel>
            <Input id={id('damage')} value={draft.damage} maxLength={ITEM_LIMITS.damage} placeholder="1D6" onChange={(e) => set({ damage: e.target.value.replace(/[^0-9Dd+\-/ ]/g, '') })} />
          </Field>
          <Field>
            <FieldLabel htmlFor={id('range')}>{t('Portée')}</FieldLabel>
            <Input id={id('range')} value={draft.range} maxLength={ITEM_LIMITS.range} placeholder={t('contact')} onChange={(e) => set({ range: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor={id('rate')}>{t('Attaques par round')}</FieldLabel>
            <Input id={id('rate')} value={draft.rate} maxLength={ITEM_LIMITS.rate} onChange={(e) => set({ rate: e.target.value })} />
          </Field>
          {draft.skill.startsWith('firearms') ? (
            <Field>
              <FieldLabel htmlFor={id('malfunction')}>{t('Panne')}</FieldLabel>
              <Input id={id('malfunction')} type="number" min={90} max={100} value={draft.malfunction} placeholder="100" onChange={(e) => set({ malfunction: e.target.value })} />
            </Field>
          ) : (
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Checkbox checked={draft.db} onCheckedChange={(c) => set({ db: c === true })} />
              {t('Ajoute l’Impact')}
            </label>
          )}
        </div>
      )}
      {(weapon || draft.kind === 'ammo') && (
        <Field>
          <FieldLabel htmlFor={id('ammo')}>{t('Calibre (pour recharger)')}</FieldLabel>
          <Input id={id('ammo')} value={draft.ammo} maxLength={ITEM_LIMITS.ammo} placeholder=".38" onChange={(e) => set({ ammo: e.target.value })} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={id('uses')}>{t('Utilisations')}</FieldLabel>
          <Input id={id('uses')} type="number" min={1} max={ITEM_LIMITS.uses} value={draft.uses} placeholder={t('aucune')}
            onChange={(e) => set({ uses: e.target.value === '' ? '' : String(Math.max(1, Math.min(ITEM_LIMITS.uses, Math.round(Number(e.target.value) || 1)))) })} />
        </Field>
        <Field>
          <FieldLabel htmlFor={id('unit')}>{t('Unité')}</FieldLabel>
          <NativeSelect id={id('unit')} value={draft.unit} disabled={!draft.uses} onChange={(e) => set({ unit: e.target.value as UseUnit })}>
            {USE_UNITS.map((u) => <NativeSelectOption key={u} value={u}>{t(u)}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={id('bonus')}>{t('Aide pour')}</FieldLabel>
          <NativeSelect id={id('bonus')} value={draft.bonusSkill} onChange={(e) => set({ bonusSkill: e.target.value })}>
            <NativeSelectOption value="">{t('aucune compétence')}</NativeSelectOption>
            {SKILLS.filter((s) => !s.id.endsWith('-2')).map((s) => <NativeSelectOption key={s.id} value={s.id}>{skillName(t, s.id)}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={id('note')}>{t('Comment')}</FieldLabel>
          <Input id={id('note')} value={draft.bonusNote} maxLength={ITEM_LIMITS.note} disabled={!draft.bonusSkill} placeholder={t('dé bonus')} onChange={(e) => set({ bonusNote: e.target.value })} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={id('text')}>{t('Texte de la carte')}</FieldLabel>
        <Textarea id={id('text')} value={draft.text} maxLength={ITEM_LIMITS.text} rows={3} onChange={(e) => set({ text: e.target.value })} placeholder={t('Ce que l’objet fait, ou ce qu’on en raconte.')} />
      </Field>
    </FieldGroup>
  )
}

export function GiveItemDialog({ open, onOpenChange, characterId, characterName, storyItems = [] }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  characterId: string
  characterName: string
  storyItems?: StoryItemChoice[]
}) {
  const t = useT()
  const give = useGiveItem()
  const [tab, setTab] = useState<Tab>(storyItems.length ? 'story' : 'catalog')
  const [kind, setKind] = useState<ItemKind | typeof ALL>(ALL)
  const [query, setQuery] = useState('')
  const [pick, setPick] = useState<Pick | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const made = useMemo(() => draftCard(draft), [draft])

  const catalog = useMemo(() => searchCatalog(t, query, kind === ALL ? undefined : kind), [t, query, kind])
  const chosen: { card: Card; gift: Parameters<typeof give.mutateAsync>[0] } | null =
    tab === 'new'
      ? made.card && { card: made.card, gift: { characterId, card: made.card } }
      : tab === 'catalog' && pick?.tab === 'catalog'
        ? (() => {
          const c = CATALOG.find((x) => x.id === pick.id)
          return c ? { card: c.card, gift: { characterId, card: c.card, catalogId: c.id } } : null
        })()
        : tab === 'story' && pick?.tab === 'story'
          ? (() => {
            const s = storyItems.find((x) => x.itemId === pick.itemId)
            return s ? { card: s.card, gift: { characterId, card: s.card, story: { id: s.storyId, itemId: s.itemId } } } : null
          })()
          : null

  const submit = async () => {
    if (!chosen) return
    try {
      await give.mutateAsync(chosen.gift)
      const name = localCard(t, chosen.card, chosen.gift.catalogId ? { kind: 'catalog', id: chosen.gift.catalogId } : undefined).name
      toast.success(t('{name} reçoit « {item} ».', { item: name, name: characterName }))
      if (tab === 'new') setDraft(EMPTY)
      setPick(null)
    } catch (e) {
      toast.error((e as Error).message.includes('too_many_items') ? t('{n} objets au plus.', { n: ITEM_LIMITS.perCharacter }) : t('Impossible de donner l’objet : {error}', { error: (e as Error).message }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-hidden border border-gold/50 bg-background p-5 ring-0 sm:max-w-5xl sm:p-6">
        <div className="flex flex-col gap-1">
          <p className="eyebrow">{t('Objets')}</p>
          <DialogTitle className="font-heading text-2xl text-gold">{t('Donner un objet à {name}', { name: characterName })}</DialogTitle>
          <DialogDescription className="font-serif text-base">{t('La carte reste à l’investigateur d’une partie à l’autre. Le joueur la voit sur son téléphone.')}</DialogDescription>
        </div>
        <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setPick(null) }}>
          <TabsList variant="line">
            {storyItems.length > 0 && <TabsTrigger value="story">{t('Histoire')} ({storyItems.length})</TabsTrigger>}
            <TabsTrigger value="catalog">{t('Catalogue')}</TabsTrigger>
            <TabsTrigger value="new">{t('Créer une carte')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
          {tab === 'catalog' && (
            <div className="flex flex-col gap-3">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Chercher un objet : revolver, lumière, grimper…')}
                  aria-label={t('Chercher un objet')}
                  className="pl-9"
                  onKeyDown={(e) => {
                    // Enter picks the first match: search, Enter, then "Donner".
                    if (e.key === 'Enter' && catalog[0]) {
                      e.preventDefault()
                      setPick({ tab: 'catalog', id: catalog[0].id })
                    }
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Type')}>
                {[ALL, ...ITEM_KINDS.filter((k) => CATALOG.some((c) => c.card.kind === k))].map((k) => (
                  <Button key={k} size="xs" variant={kind === k ? 'default' : 'outline'} aria-pressed={kind === k} onClick={() => setKind(k as ItemKind | typeof ALL)}>
                    {k === ALL ? t('Tous') : t(KIND_LABEL[k as ItemKind])}
                  </Button>
                ))}
              </div>
              {catalog.length ? (
                <CardPicker
                  cards={catalog.map((c) => ({ key: c.id, card: c.card, source: { kind: 'catalog', id: c.id } }))}
                  selected={pick?.tab === 'catalog' ? pick.id : null}
                  onSelect={(id) => setPick({ tab: 'catalog', id })}
                />
              ) : (
                <p className="font-serif text-lg">{t('Aucune carte ne correspond.')}</p>
              )}
            </div>
          )}
          {tab === 'story' && (
            <CardPicker
              cards={storyItems.map((s) => ({ key: s.itemId, card: s.card, source: { kind: 'story', storyId: s.storyId, itemId: s.itemId } }))}
              selected={pick?.tab === 'story' ? pick.itemId : null}
              onSelect={(itemId) => setPick({ tab: 'story', itemId })}
            />
          )}
          {tab === 'new' && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
              <NewCardForm draft={draft} set={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
              <div className="flex flex-col gap-2 md:sticky md:top-0 md:self-start">
                <p className="eyebrow">{t('Aperçu')}</p>
                <ItemCard card={made.card ?? { ...draftCard({ ...draft, name: draft.name.trim() || t('Nouvel objet'), damage: draft.damage || '1D6' }).card ?? { name: t('Nouvel objet'), kind: draft.kind } }} source={{ kind: 'keeper' }} as="h4" />
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          {tab === 'new' && made.problem && draft.name && <p className="mr-auto text-sm text-muted-foreground">{t(made.problem)}</p>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('Fermer')}</Button>
          <Button onClick={submit} disabled={!chosen || give.isPending}>
            {chosen ? t('Donner « {item} »', { item: localCard(t, chosen.card, chosen.gift.catalogId ? { kind: 'catalog', id: chosen.gift.catalogId } : undefined).name }) : t('Donner')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
