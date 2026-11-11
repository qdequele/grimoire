// Items above the game screen: an investigator's cards (the items button on their card in the
// engine), and giving one of the story's items to someone at the table (the scene's items row).
import { toast } from 'sonner'
import { Avatar } from '@/characters/Avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n/t'
import { useGiveItem } from '@/items/api'
import { CharacterItems } from '@/items/CharacterItems'
import type { StoryItemChoice } from '@/items/GiveItemDialog'
import { ItemCard } from '@/items/ItemCard'
import type { TableMember } from './TableLinksDialog'

export function CharacterItemsDialog({ member, storyItems, onOpenChange }: { member: TableMember | null; storyItems: StoryItemChoice[]; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100svh-2rem)] gap-4 overflow-y-auto border border-gold/50 bg-background p-6 ring-0 sm:max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {member && <Avatar name={member.name} photo={member.photo} className="size-12 text-base" />}
            <div className="flex flex-col">
              <p className="eyebrow">{t('Objets')}</p>
              <DialogTitle className="font-heading text-2xl text-gold">{member?.name ?? ''}</DialogTitle>
            </div>
          </div>
          <DialogClose render={<Button variant="outline" />}>{t('Fermer')}</DialogClose>
        </div>
        <DialogDescription className="sr-only">{t('Les cartes de l’investigateur')}</DialogDescription>
        {member && <CharacterItems characterId={member.id} characterName={member.name} storyItems={storyItems} />}
      </DialogContent>
    </Dialog>
  )
}

/** "Donner à…": one of the story's items, to one of the account investigators at the table. */
export function GiveStoryItemDialog({ item, party, onOpenChange }: { item: StoryItemChoice | null; party: TableMember[]; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const give = useGiveItem()
  const to = async (m: TableMember) => {
    if (!item) return
    try {
      await give.mutateAsync({ characterId: m.id, card: item.card, story: { id: item.storyId, itemId: item.itemId } })
      toast.success(t('{name} reçoit « {item} ».', { name: m.name, item: item.card.name }))
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error).message.includes('too_many_items') ? t('{n} objets au plus.', { n: 60 }) : t('Impossible de donner l’objet : {error}', { error: (e as Error).message }))
    }
  }
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-4 overflow-y-auto border border-gold/50 bg-background p-6 ring-0 sm:max-w-xl">
        <div className="flex flex-col gap-1">
          <p className="eyebrow">{t('Objet de l’histoire')}</p>
          <DialogTitle className="font-heading text-2xl text-gold">{t('Donner à…')}</DialogTitle>
          <DialogDescription className="font-serif text-base">{t('L’investigateur garde la carte d’une partie à l’autre.')}</DialogDescription>
        </div>
        {item && (
          <div className="grid gap-5 sm:grid-cols-[13rem_minmax(0,1fr)]">
            <ItemCard card={item.card} source={{ kind: 'story', storyId: item.storyId, itemId: item.itemId }} as="h3" />
            <ul className="flex flex-col gap-2">
              {party.length ? party.map((m) => (
                <li key={m.id}>
                  <Button variant="outline" className="h-auto w-full justify-start gap-3 py-2" disabled={give.isPending} onClick={() => void to(m)}>
                    <Avatar name={m.name} photo={m.photo} className="size-8 text-xs" />
                    <span className="flex flex-col items-start normal-case">
                      <span className="font-serif text-base tracking-normal">{m.name}</span>
                      {m.player && <span className="text-xs text-muted-foreground">{m.player}</span>}
                    </span>
                  </Button>
                </li>
              )) : <li className="text-muted-foreground">{t('Aucun investigateur du compte dans la partie.')}</li>}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
