// `/characters/objets` (Investigateurs → Objets): every catalogue card, laid out like a card set.
// Search and a type filter (kept in the address: ?q=…&type=…); a card picked up opens big
// (CardViewer), where the keeper gives it to one of their investigators.
import { Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Avatar } from '@/characters/Avatar'
import { useCharacters } from '@/characters/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { useGiveItem, useItemCounts } from './api'
import { CATALOG } from './catalog'
import { CardViewer, type ViewedCard } from './CardViewer'
import { ITEM_KINDS, ITEM_LIMITS, KIND_LABEL } from './item'
import { ItemCard } from './ItemCard'
import { searchCatalog } from './search'
import { localCard } from './text'

const KINDS = ITEM_KINDS.filter((k) => CATALOG.some((c) => c.card.kind === k))

/** "Donner à…": the keeper's investigators, one button each. */
function GivePanel({ viewed }: { viewed: ViewedCard }) {
  const t = useT()
  const characters = useCharacters()
  const counts = useItemCounts()
  const give = useGiveItem()
  const [who, setWho] = useState('')
  const name = localCard(t, viewed.card, viewed.source).name
  const list = (characters.data ?? []).filter((c) => !who.trim() || c.data.name.toLowerCase().includes(who.trim().toLowerCase()))
  const catalogId = viewed.source?.kind === 'catalog' ? viewed.source.id : undefined

  const to = async (id: string, investigator: string) => {
    try {
      await give.mutateAsync({ characterId: id, card: viewed.card, catalogId })
      toast.success(t('{name} reçoit « {item} ».', { name: investigator, item: name }))
    } catch (e) {
      toast.error((e as Error).message.includes('too_many_items') ? t('{n} objets au plus.', { n: ITEM_LIMITS.perCharacter }) : t('Impossible de donner l’objet : {error}', { error: (e as Error).message }))
    }
  }

  return (
    <div className="flex flex-col gap-3 border border-gold/40 bg-background/90 p-4">
      <p className="eyebrow">{t('Donner à…')}</p>
      {characters.isPending ? (
        <Skeleton className="h-24" />
      ) : !characters.data?.length ? (
        <p className="font-serif text-base">
          {t('Aucun investigateur pour l’instant.')} <Link to="/characters/new" className="text-gold underline">{t('Créer un investigateur')}</Link>
        </p>
      ) : (
        <>
          {characters.data.length > 6 && (
            <Input value={who} onChange={(e) => setWho(e.target.value)} placeholder={t('Chercher un investigateur')} aria-label={t('Chercher un investigateur')} />
          )}
          <ul className="flex max-h-[40svh] flex-col gap-2 overflow-y-auto">
            {list.map((c) => (
              <li key={c.id}>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 py-2"
                  disabled={give.isPending}
                  onClick={() => void to(c.id, c.data.name)}
                  aria-label={t('Donner « {item} » à {name}', { item: name, name: c.data.name })}
                >
                  <Avatar name={c.data.name} photo={c.photo} className="size-8 text-xs" />
                  <span className="flex min-w-0 flex-1 flex-col items-start normal-case">
                    <span className="truncate font-serif text-base tracking-normal">{c.data.name}</span>
                    <span className="text-xs tracking-normal text-muted-foreground">
                      {t.n(counts.data?.get(c.id) ?? 0, '{n} objet', '{n} objets')}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          {!list.length && <p className="text-sm text-muted-foreground">{t('Aucun investigateur à ce nom.')}</p>}
        </>
      )}
      <p className="text-xs text-muted-foreground">{t('L’investigateur garde la carte d’une partie à l’autre.')}</p>
    </div>
  )
}

export function ItemsPage() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const kind = KINDS.find((k) => k === params.get('type'))
  const results = useMemo(() => searchCatalog(t, q, kind), [t, q, kind])
  const [viewed, setViewed] = useState<ViewedCard | null>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  const set = (key: string, value: string | undefined) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl font-serif text-lg text-muted-foreground">
        {t('Les objets que tes investigateurs peuvent trouver ou recevoir. Choisis une carte pour la voir de près et la donner.')}
      </p>
      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={q}
            onChange={(e) => set('q', e.target.value || undefined)}
            placeholder={t('Chercher un objet : revolver, lumière, grimper…')}
            aria-label={t('Chercher un objet')}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Type')}>
          <Button size="xs" variant={!kind ? 'default' : 'outline'} aria-pressed={!kind} onClick={() => set('type', undefined)}>{t('Tous')}</Button>
          {KINDS.map((k) => (
            <Button key={k} size="xs" variant={kind === k ? 'default' : 'outline'} aria-pressed={kind === k} onClick={() => set('type', kind === k ? undefined : k)}>
              {t(KIND_LABEL[k])}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">{t.n(results.length, '{n} carte', '{n} cartes')}</p>
      </div>

      {results.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {results.map((c) => {
            const source = { kind: 'catalog', id: c.id } as const
            return (
              <li key={c.id}>
                <button
                  type="button"
                  ref={(el) => {
                    if (el) buttons.current.set(c.id, el)
                    else buttons.current.delete(c.id)
                  }}
                  className="icard-pick"
                  data-lifted={viewed?.key === c.id || undefined}
                  aria-label={localCard(t, c.card, source).name}
                  onClick={(e) => setViewed({ key: c.id, card: c.card, source, from: e.currentTarget.getBoundingClientRect() })}
                >
                  <ItemCard card={c.card} source={source} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="font-serif text-lg">{t('Aucune carte ne correspond.')}</p>
      )}

      <CardViewer
        viewed={viewed}
        origin={(key) => buttons.current.get(key)?.getBoundingClientRect()}
        onClose={() => {
          const key = viewed?.key
          setViewed(null)
          if (key) requestAnimationFrame(() => buttons.current.get(key)?.focus())
        }}
      >
        {viewed && <GivePanel viewed={viewed} />}
      </CardViewer>
    </div>
  )
}
