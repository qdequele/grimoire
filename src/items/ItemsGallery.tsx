// Dev only: /dev/items shows every catalogue card (no Supabase), to review the drawings and the layout.
// ?uses=half shows them half used; ?w=220 sets the card width.
import { useSearchParams } from 'react-router'
import { CATALOG } from './catalog'
import { ItemCard } from './ItemCard'

export function ItemsGallery() {
  const [q] = useSearchParams()
  const half = q.get('uses') === 'half'
  const w = Number(q.get('w')) || 220
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
