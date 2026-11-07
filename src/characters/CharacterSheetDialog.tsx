import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { useCharacter } from './api'
import { CharacterSheet } from './CharacterSheet'

/** An investigator's presentation sheet above the game screen (the name on an investigator card). */
export function CharacterSheetDialog({ characterId, onOpenChange }: { characterId: string | null; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const character = useCharacter(characterId ?? undefined)
  return (
    <Dialog open={!!characterId} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto border border-gold/50 bg-background p-6 ring-0 sm:max-w-4xl sm:p-8"
      >
        <DialogTitle className="sr-only">{t("Fiche d'investigateur")}</DialogTitle>
        <DialogDescription className="sr-only">{character.data?.data.name ?? ''}</DialogDescription>
        {character.data ? (
          <CharacterSheet
            character={character.data}
            headingLevel={2}
            actions={<DialogClose render={<Button variant="outline" />}>{t('Fermer')}</DialogClose>}
          />
        ) : (
          <Skeleton className="h-96" />
        )}
      </DialogContent>
    </Dialog>
  )
}
