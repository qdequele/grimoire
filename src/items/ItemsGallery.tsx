// Dev only: /dev/items shows every catalogue card (no Supabase), to review the drawings and the layout.
// ?uses=half shows them half used; ?w=220 sets the card width; ?conditions=1 shows a firearm and a
// blade in every condition (clean, dirty, rusty, damaged, broken).
import { useSearchParams } from 'react-router'
import { CATALOG, CATALOG_BY_ID } from './catalog'
import { CONDITIONS } from './item'
import { ItemCard } from './ItemCard'

export function ItemsGallery() {
  const [q] = useSearchParams()
  const half = q.get('uses') === 'half'
  const w = Number(q.get('w')) || 220
  if (q.get('conditions')) {
    return (
      <main className="flex flex-col gap-6 p-6">
        {['revolver-38', 'knife'].map((id) => (
          <div key={id} className="flex flex-wrap gap-5">
            {CONDITIONS.map((condition) => (
              <div key={condition} style={{ width: w }}>
                <ItemCard card={CATALOG_BY_ID.get(id)!.card} source={{ kind: 'catalog', id }} condition={condition} />
              </div>
            ))}
          </div>
        ))}
      </main>
    )
  }
  return (
    <main className="flex flex-wrap gap-5 p-6">
      {CATALOG.map((c) => (
        <div key={c.id} style={{ width: w }}>
          <ItemCard
            card={c.card}
            source={{ kind: 'catalog', id: c.id }}
            uses={half && c.card.uses !== undefined ? Math.floor(c.card.uses / 2) : undefined}
          />
        </div>
      ))}
    </main>
  )
}
