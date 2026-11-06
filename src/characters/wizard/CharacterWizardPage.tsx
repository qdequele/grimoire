import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { CreationDraft } from '@/engine/creation'
import { useT } from '@/i18n/t'
import { useCharacter, useDeleteCharacter, useSaveCharacter } from '../api'
import { CharacterWizard, toCharacterData } from './CharacterWizard'
import { draftFromCharacter } from './draft'
import { keeperWizardHost, loadLocalDraft, saveLocalDraft, WizardHostProvider } from './host'

function DeleteAction({ id }: { id: string }) {
  const t = useT()
  const navigate = useNavigate()
  const remove = useDeleteCharacter()
  const [confirm, setConfirm] = useState(false)
  if (!confirm) return <Button variant="ghost" onClick={() => setConfirm(true)}>{t('Supprimer')}</Button>
  return (
    <span className="flex items-center gap-2 text-sm">
      {t('Supprimer ce personnage ?')}
      <Button
        variant="destructive" size="sm" disabled={remove.isPending}
        onClick={async () => { await remove.mutateAsync(id); toast.success(t('Investigateur supprimé.')); navigate('/characters') }}
      >
        {t('Oui')}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>{t('Non')}</Button>
    </span>
  )
}

/** `/characters/new` and `/characters/:id`: the keeper's wizard. */
export function CharacterWizardPage() {
  const t = useT()
  const { id } = useParams()
  const editing = !!id && id !== 'new'
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const existing = useCharacter(editing ? id : undefined)
  const save = useSaveCharacter()
  const { draftKey } = keeperWizardHost
  // "Créer un personnage" from a player's card: /characters/new?joueur=<player id>.
  // Kept from the first render: changing step rewrites the query string.
  const [forPlayer] = useState(() => params.get('joueur'))
  const [fresh] = useState<CreationDraft | null>(() => {
    if (editing) return null
    const d = loadLocalDraft(draftKey)
    return forPlayer ? { ...d, playerId: forPlayer } : d
  })
  const initial = editing ? (existing.data ? draftFromCharacter(existing.data) : null) : fresh

  if (!initial) return <Skeleton className="h-96" />

  async function onSave(draft: CreationDraft) {
    try {
      // Editing the sheet keeps what the investigator earned in play.
      const progress = editing ? existing.data?.data.progress : undefined
      await save.mutateAsync({ id: editing ? id : undefined, data: { ...toCharacterData(draft), ...(progress ? { progress } : {}) }, playerId: draft.playerId || null })
      if (!editing) saveLocalDraft(draftKey, null)
      toast.success(t('{name} est enregistré.', { name: draft.name.trim() }))
      navigate(forPlayer ? '/characters/joueurs' : '/characters')
    } catch (e) {
      toast.error(t((e as Error).message))
    }
  }

  return (
    <WizardHostProvider value={keeperWizardHost}>
      <CharacterWizard
        key={editing ? id : 'new'}
        initial={initial}
        editing={editing}
        onSave={onSave}
        extraActions={editing ? <DeleteAction id={id!} /> : undefined}
      />
    </WizardHostProvider>
  )
}
