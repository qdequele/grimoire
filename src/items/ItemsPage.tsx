// `/characters/objets` (Investigateurs → Objets): every catalogue card, laid out like a card set
// (CatalogGallery: search, type filter, a card picked up opens big), where the keeper gives a card to
// one of their investigators.
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Avatar } from '@/characters/Avatar'
import { useCharacters } from '@/characters/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { useGiveItem, useItemCounts } from './api'
import { CATALOG_BY_ID } from './catalog'
import { CatalogGallery } from './CatalogGallery'
import { DocumentFields, filledCard, type DocumentDraft } from './DocumentFields'
import type { ViewedCard } from './CardViewer'
import { ITEM_LIMITS } from './item'
import { localCard } from './text'

/** "Donner à…": the keeper's investigators, one button each. */
function GivePanel({ viewed }: { viewed: ViewedCard }) {
  const t = useT()
  const characters = useCharacters()
  const counts = useItemCounts()
  const give = useGiveItem()
  const [who, setWho] = useState('')
  const catalogEntry = viewed.source?.kind === 'catalog' ? CATALOG_BY_ID.get(viewed.source.id) : undefined
  // A paper template: the keeper writes its title and text before giving it.
  const [paper, setPaper] = useState<DocumentDraft>({ title: localCard(t, viewed.card, viewed.source).name, text: '' })
  const card = catalogEntry?.fill ? filledCard(viewed.card, paper, localCard(t, viewed.card, viewed.source).name) : viewed.card
  const name = catalogEntry?.fill ? card.name : localCard(t, viewed.card, viewed.source).name
  const list = (characters.data ?? []).filter((c) => !who.trim() || c.data.name.toLowerCase().includes(who.trim().toLowerCase()))
  const catalogId = viewed.source?.kind === 'catalog' ? viewed.source.id : undefined

  const to = async (id: string, investigator: string) => {
    try {
      await give.mutateAsync({ characterId: id, card, catalogId })
      toast.success(t('{name} reçoit « {item} ».', { name: investigator, item: name }))
    } catch (e) {
      toast.error((e as Error).message.includes('too_many_items') ? t('{n} objets au plus.', { n: ITEM_LIMITS.perCharacter }) : t('Impossible de donner l’objet : {error}', { error: (e as Error).message }))
    }
  }

  return (
    <div className="flex flex-col gap-3 border border-gold/40 bg-background/90 p-4">
      {catalogEntry?.fill && <DocumentFields id={`paper-${viewed.key}`} draft={paper} onChange={setPaper} kind={viewed.card.kind} />}
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
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl font-serif text-lg text-muted-foreground">
        {t('Les objets que tes investigateurs peuvent trouver ou recevoir. Choisis une carte pour la voir de près et la donner.')}
      </p>
      <CatalogGallery panel={(viewed) => <GivePanel key={viewed.key} viewed={viewed} />} />
    </div>
  )
}
