import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useAddPlayer, usePlayers } from '../api'
import { useT } from '@/i18n/t'

const NEW = '__new'

/** Who plays this investigator: one of the keeper's players, or a new one typed in place. */
export function PlayerField({ value, onChange }: { value: string; onChange: (playerId: string) => void }) {
  const t = useT()
  const players = usePlayers()
  const add = useAddPlayer()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  async function create() {
    if (!name.trim()) return
    try {
      const p = await add.mutateAsync(name)
      onChange(p.id)
      setAdding(false)
      setName('')
    } catch (e) {
      toast.error(t((e as Error).message))
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={adding ? 'w-player-new' : 'w-player'}>{t('Joueur')}</FieldLabel>
      {adding ? (
        <div className="flex gap-2">
          <Input
            id="w-player-new" autoFocus value={name} placeholder={t('Prénom')}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void create() }
              if (e.key === 'Escape') setAdding(false)
            }}
          />
          <Button type="button" onClick={create} disabled={!name.trim() || add.isPending}>{t('Ajouter')}</Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>{t('Annuler')}</Button>
        </div>
      ) : (
        <NativeSelect
          id="w-player" value={value}
          onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value))}
        >
          <NativeSelectOption value="">{t('Sans joueur')}</NativeSelectOption>
          {players.data?.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>)}
          <NativeSelectOption value={NEW}>{t('+ Nouveau joueur…')}</NativeSelectOption>
        </NativeSelect>
      )}
    </Field>
  )
}
