// The item catalogue laid out like a card set: search and type filter (kept in the address, ?q=&type=),
// a grid of cards, and a card picked up opening big (CardViewer) with a panel beside it. Used by the
// keeper's items page (the panel gives the card to an investigator) and by the public tool page (the
// panel downloads it). No Supabase here: the public page is prerendered.
import { Search } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/i18n/t'
import { CATALOG, type CatalogItem } from './catalog'
import { CardViewer, type ViewedCard } from './CardViewer'
import { ITEM_KINDS, KIND_LABEL } from './item'
import { ItemCard } from './ItemCard'
import { searchCatalog } from './search'
import { localCard } from './text'

const KINDS = ITEM_KINDS.filter((k) => CATALOG.some((c) => c.card.kind === k))

/** The catalogue cards matching the address's search and type. */
export function useCatalogSearch() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const kind = KINDS.find((k) => k === params.get('type'))
  const results = useMemo(() => searchCatalog(t, q, kind), [t, q, kind])
  const set = (key: string, value: string | undefined) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  return { q, kind, results, setQuery: (v: string) => set('q', v || undefined), setKind: (k?: string) => set('type', k) }
}

export function CatalogGallery({ panel, toolbar }: {
  /** Beside the card held up (giving it, downloading it). */
  panel?: (viewed: ViewedCard) => ReactNode
  /** Under the search and filter, with the count (printing). */
  toolbar?: (results: CatalogItem[]) => ReactNode
}) {
  const t = useT()
  const { q, kind, results, setQuery, setKind } = useCatalogSearch()
  const [viewed, setViewed] = useState<ViewedCard | null>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Chercher un objet : revolver, lumière, grimper…')}
            aria-label={t('Chercher un objet')}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Type')}>
          <Button size="xs" variant={!kind ? 'default' : 'outline'} aria-pressed={!kind} onClick={() => setKind(undefined)}>{t('Tous')}</Button>
          {KINDS.map((k) => (
            <Button key={k} size="xs" variant={kind === k ? 'default' : 'outline'} aria-pressed={kind === k} onClick={() => setKind(kind === k ? undefined : k)}>
              {t(KIND_LABEL[k])}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">{t.n(results.length, '{n} carte', '{n} cartes')}</p>
          {toolbar?.(results)}
        </div>
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
        {viewed && panel?.(viewed)}
      </CardViewer>
    </>
  )
}
