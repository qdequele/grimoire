// The keeper's view of an investigator's items: their cards, with uses, reload and "take back", and
// "Donner un objet" (catalogue, story, or a new card). On the investigator's sheet, its page and the
// game screen's dialog.
import { Gift } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { useCharacterItems, useRemoveItem, useReloadItem, useUseItem } from './api'
import { GiveItemDialog, type StoryItemChoice } from './GiveItemDialog'
import { ITEM_LIMITS } from './item'
import { ItemTile } from './ItemTile'

export function CharacterItems({ characterId, characterName, storyItems }: { characterId: string; characterName: string; storyItems?: StoryItemChoice[] }) {
  const t = useT()
  const items = useCharacterItems(characterId)
  const use = useUseItem()
  const reload = useReloadItem()
  const remove = useRemoveItem()
  const [giving, setGiving] = useState(false)
  const held = items.data ?? []
  const full = held.length >= ITEM_LIMITS.perCharacter

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`items-${characterId}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`items-${characterId}`} className="eyebrow">{t('Objets')}{held.length ? ` (${held.length})` : ''}</h2>
        <Button size="sm" variant="outline" onClick={() => setGiving(true)} disabled={full} title={full ? t('{n} objets au plus.', { n: ITEM_LIMITS.perCharacter }) : undefined}>
          <Gift data-icon="inline-start" />
          {t('Donner un objet')}
        </Button>
      </div>
      {items.isPending ? (
        <Skeleton className="h-40" />
      ) : held.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {held.map((item) => (
            <ItemTile
              key={item.id}
              item={item}
              held={held}
              actions={{
                onUse: (i, delta) => use.mutate({ item: i, delta }, { onError: (e) => toast.error(e.message) }),
                onReload: (i) =>
                  reload.mutate(i, {
                    onSuccess: (n) => (n ? toast.success(t.n(n, '{n} munition rechargée.', '{n} munitions rechargées.')) : toast(t('Rien à recharger.'))),
                    onError: (e) => toast.error(e.message),
                  }),
                onRemove: (i) => remove.mutateAsync(i).catch((e: Error) => toast.error(e.message)),
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="font-serif text-base text-muted-foreground">{t('Aucun objet. Les cartes données ici suivent l’investigateur d’une partie à l’autre.')}</p>
      )}
      <GiveItemDialog open={giving} onOpenChange={setGiving} characterId={characterId} characterName={characterName} storyItems={storyItems} />
    </section>
  )
}
