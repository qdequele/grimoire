import { Link, useParams } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { CharacterItems } from '@/items/CharacterItems'
import { useCharacter } from './api'
import { CharacterSheet } from './CharacterSheet'

/** `/characters/:id`: the investigator's presentation sheet; editing is `/characters/:id/edit`. */
export function CharacterSheetPage() {
  const t = useT()
  const { id } = useParams()
  const character = useCharacter(id)
  if (character.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('Investigateur introuvable.')}</AlertDescription>
      </Alert>
    )
  }
  if (!character.data) return <Skeleton className="h-96" />
  return (
    <div className="flex flex-col gap-6">
      <Link to="/characters/mine" className="text-sm text-muted-foreground hover:text-gold">← {t('Mes personnages')}</Link>
      <CharacterSheet
        character={character.data}
        items={<CharacterItems characterId={character.data.id} characterName={character.data.data.name} />}
        actions={<Button render={<Link to={`/characters/${character.data.id}/edit`} />} nativeButton={false}>{t('Modifier')}</Button>}
      />
    </div>
  )
}
