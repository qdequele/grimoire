// A document card read on aged paper: the letter, diary or plan legend an investigator kept. The text
// is story rich text (bold, italics, line breaks), rendered as page elements, never HTML.
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n/t'
import { StoryText } from '@/tools/scenarios/StoryText'
import { KIND_LABEL, type ItemCard } from './item'

export function DocumentReader({ card, name, open, onOpenChange }: { card: ItemCard; name: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100svh-2rem)] gap-4 overflow-y-auto border-0 bg-transparent p-0 ring-0 shadow-none sm:max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{t(KIND_LABEL[card.kind])}</p>
          <DialogClose render={<Button size="sm" variant="outline" className="bg-background" />}>{t('Fermer')}</DialogClose>
        </div>
        <article className="idoc-paper">
          <DialogTitle className="idoc-title">{name}</DialogTitle>
          <DialogDescription render={<div className="idoc-text" />}>
            {card.document ? <StoryText text={card.document} /> : card.text}
          </DialogDescription>
        </article>
      </DialogContent>
    </Dialog>
  )
}
