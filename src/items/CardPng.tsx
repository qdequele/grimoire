// A card saved as a PNG picture (the public card catalogue's "Télécharger en PNG"). A copy of the card
// is drawn off screen at a fixed size, untilted, then photographed by html-to-image (loaded only on
// click: it is not needed to show the page). 750 px wide, at twice the pixel density: 1500 × 2095 px,
// about 600 dpi at playing-card size.
import { Download } from 'lucide-react'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/t'
import type { ItemCard as Card, ItemSource } from './item'
import { ItemCard } from './ItemCard'
import { localCard } from './text'

/** A file name from the card's name: "revolver-38.png". */
export const pngName = (name: string) =>
  `${name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'carte'}.png`

/** Every picture inside an element loaded (or failed): a photo taken before would show an empty window. */
async function picturesReady(el: HTMLElement) {
  await Promise.all([...el.querySelectorAll('img')].map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))))
}

export function DownloadPng({ card, source }: { card: Card; source?: ItemSource }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const holder = useRef<HTMLDivElement>(null)
  const name = localCard(t, card, source).name

  const download = async () => {
    setBusy(true)
    try {
      flushSync(() => setDrawing(true))
      const el = holder.current?.querySelector<HTMLElement>('article')
      if (!el) throw new Error('no card')
      await picturesReady(el)
      const { toPng } = await import('html-to-image')
      const url = await toPng(el, { pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a')
      a.href = url
      a.download = pngName(name)
      a.click()
    } catch (e) {
      console.error('PNG export failed', e)
      toast.error(t('Impossible de créer l’image. Réessaie.'))
    } finally {
      setDrawing(false)
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={() => void download()} disabled={busy} className="w-full">
        <Download data-icon="inline-start" />
        {busy ? t('Préparation de l’image…') : t('Télécharger en PNG')}
      </Button>
      {drawing && (
        <div ref={holder} aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, width: 750 }}>
          <ItemCard card={card} source={source} eager />
        </div>
      )}
    </>
  )
}
