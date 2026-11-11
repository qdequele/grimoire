// /outils/cartes-objets, /tools/item-cards: the item card catalogue, free. Search and filter it, open a
// card to see it up close and save it as a PNG, or print the cards shown (nine per A4 page at playing-
// card size, with their backs if wanted). Public and prerendered: no account, no Supabase.
import { Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/t'
import { CatalogGallery } from '@/items/CatalogGallery'
import { DownloadPng } from '@/items/CardPng'
import type { CatalogItem } from '@/items/catalog'
import { PrintSheet } from '@/items/PrintSheet'
import type { Lang } from '@/settings/lang'
import { TOOL_PATHS } from './pages'
import { ToolIntro, ToolLayout } from './ToolLayout'

/** Every picture of the sheet loaded: a page printed before would show empty windows. */
async function picturesReady(root: ParentNode) {
  await Promise.all([...root.querySelectorAll('img')].map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))))
}

export function ItemCardsPage({ lang }: { lang: Lang }) {
  const t = useT()
  const other: Lang = lang === 'fr' ? 'en' : 'fr'
  const [backs, setBacks] = useState(true)
  // The cards being printed: the sheet exists only then (96 cards drawn twice otherwise).
  const [printing, setPrinting] = useState<CatalogItem[] | null>(null)

  useEffect(() => {
    if (!printing) return
    let cancelled = false
    // Three cards a row need 8 mm margins (the tool pages print with 12): only while the sheet prints.
    const margins = document.createElement('style')
    margins.textContent = '@page { size: A4; margin: 8mm; }'
    document.head.appendChild(margins)
    const done = () => setPrinting(null)
    window.addEventListener('afterprint', done, { once: true })
    void picturesReady(document.querySelector('.isheet') ?? document).then(() => {
      if (!cancelled) window.print()
    })
    return () => {
      cancelled = true
      margins.remove()
      window.removeEventListener('afterprint', done)
    }
  }, [printing])

  return (
    <ToolLayout lang={lang} alternate={TOOL_PATHS.cards[other]}>
      <div className="flex flex-col gap-6 print:hidden">
        <ToolIntro eyebrow={t('Gratuit, sans compte')} title={t('Cartes d’objets à imprimer')}>
          <p>{t('Armes, munitions, lumières, outils, soins, documents et objets étranges des années 1920, en cartes à jouer pour la table : cherche, ouvre une carte pour la voir de près et l’enregistrer en image, ou imprime toutes celles affichées, neuf par page, au format d’une carte à jouer.')}</p>
        </ToolIntro>
        <CatalogGallery
          toolbar={(results) => (
            <span className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => setPrinting(results)} disabled={!results.length}>
                <Printer data-icon="inline-start" />
                {t.n(results.length, 'Imprimer {n} carte', 'Imprimer les {n} cartes')}
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={backs} onCheckedChange={(c) => setBacks(c === true)} />
                {t('avec le dos des cartes (recto verso)')}
              </label>
            </span>
          )}
          panel={(viewed) => (
            <div className="flex flex-col gap-3 border border-gold/40 bg-background/90 p-4">
              <p className="eyebrow">{t('Télécharger')}</p>
              <DownloadPng card={viewed.card} source={viewed.source} />
              <p className="text-xs text-muted-foreground">{t('Une image de 1500 × 2095 pixels, nette à l’impression au format d’une carte à jouer.')}</p>
            </div>
          )}
        />
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('Pour l’impression : papier épais si possible, « taille réelle » (sans mise à l’échelle) et l’impression des couleurs d’arrière-plan activée. Recto verso : bord long.')}
        </p>
      </div>
      {printing ? <PrintSheet cards={printing} backs={backs} /> : (
        <p className="hidden print:block">{t('Utilise le bouton « Imprimer » de la page pour obtenir une planche de cartes.')}</p>
      )}
    </ToolLayout>
  )
}
