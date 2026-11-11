// `/t/:token/c/:id/objets`: the investigator's item cards on the player's phone. Tapping a card shows
// it big, where the player spends or regains a use and reloads a weapon. Only the keeper gives or
// takes back cards.
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n/t'
import { ItemCard } from '@/items/ItemCard'
import { localCard, usesText } from '@/items/text'
import { ItemTile } from '@/items/ItemTile'
import { useReloadItem, useUseItem } from './api'
import { useSheetContext } from './SheetPage'

export function ItemsTab() {
  const t = useT()
  const { token, view, member } = useSheetContext()
  const use = useUseItem(token)
  const reload = useReloadItem(token)
  const held = view.items.filter((i) => i.characterId === member.id)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = held.find((i) => i.id === openId) ?? null

  if (!held.length) {
    return <p className="text-center font-serif text-lg text-muted-foreground">{t('Pas encore d’objet. Le gardien te donnera des cartes pendant la partie.')}</p>
  }
  return (
    <>
      <ul className="grid grid-cols-2 gap-3">
        {held.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              aria-label={localCard(t, item.card, item.source).name}
              onClick={() => setOpenId(item.id)}
            >
              <ItemCard card={item.card} uses={item.uses} source={item.source} />
            </button>
            {item.uses != null && <p className="mt-1 text-center font-mono text-xs text-muted-foreground">{usesText(t, item.card, item.uses)}</p>}
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[calc(100svh-1rem)] w-[min(24rem,calc(100vw-1.5rem))] gap-3 overflow-y-auto border-0 bg-transparent p-0 ring-0 shadow-none">
          {open && (
            <>
              <DialogTitle className="sr-only">{localCard(t, open.card, open.source).name}</DialogTitle>
              <DialogDescription className="sr-only">{t('Carte d’objet')}</DialogDescription>
              <ul>
                <ItemTile
                  item={open}
                  held={held}
                  className="[&_[data-slot=button]]:bg-background"
                  actions={{
                    onUse: (item, delta) => use.mutate({ item, delta }),
                    onReload: (item) =>
                      reload.mutate(item, {
                        onSuccess: (n) => (n ? toast.success(t.n(n, '{n} munition rechargée.', '{n} munitions rechargées.')) : toast(t('Rien à recharger.'))),
                      }),
                  }}
                  extra={<Button size="sm" variant="ghost" className="bg-background" onClick={() => setOpenId(null)}>{t('Fermer')}</Button>}
                />
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

