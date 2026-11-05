import { useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { CreationDraft } from '@/engine/creation'
import { CharacterWizard, toCharacterData } from '@/characters/wizard/CharacterWizard'
import { invokeSuggestProfile, loadLocalDraft, saveLocalDraft, WizardHostProvider, type WizardHost } from '@/characters/wizard/host'
import { useT, type T } from '@/i18n/t'
import { Masthead } from '@/theme/Masthead'
import { companionKeys, forgetCharacter, rememberedCharacter, useCreateCharacter, type CompanionErrorCode } from './api'
import { useCompanionContext } from './CompanionLayout'
import { companionSheet } from './sheet'

/** The first name typed on the phone: page state, not one of the keeper's players. */
const PlayerNameContext = createContext<{ name: string; setName: (name: string) => void }>({ name: '', setName: () => {} })

function PlayerNameInput() {
  const t = useT()
  const { name, setName } = useContext(PlayerNameContext)
  return (
    <Field>
      <FieldLabel htmlFor="w-player">{t('Ton prénom')}</FieldLabel>
      <Input id="w-player" value={name} maxLength={80} autoComplete="given-name" placeholder={t('Prénom')} onChange={(e) => setName(e.target.value)} />
    </Field>
  )
}

const usePlayerName = () => useContext(PlayerNameContext).name.trim() || undefined

/** Toast for a refused creation; null for link_invalid (the layout shows the invalid-link state). */
function errorText(t: T, code: CompanionErrorCode): string | null {
  switch (code) {
    case 'party_full': return t('La table est complète : le gardien ne peut pas accueillir un investigateur de plus.')
    case 'bad_value': return t('Vérifie la fiche : une valeur a été refusée.')
    case 'not_in_game': return t('Ce lien ne permet pas de créer un investigateur.')
    case 'network': return t('Connexion impossible. Réessaie.')
    case 'link_invalid': return null
  }
}

/** `/t/:token/nouveau`: a player creates their investigator with the keeper's wizard. */
export function NewInvestigatorPage() {
  const t = useT()
  const { token, view } = useCompanionContext()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const create = useCreateCharacter(token)
  const [name, setName] = useState('')
  const draftKey = `grimoire-companion-draft-${token}`
  const [initial] = useState(() => loadLocalDraft(draftKey))

  const host = useMemo<WizardHost>(() => ({
    PlayerInput: PlayerNameInput,
    usePlayerName,
    suggestProfile: async (body) => {
      try {
        return await invokeSuggestProfile({ ...body, link: token })
      } catch (e) {
        // A revoked link: the layout's refetch shows the invalid-link state.
        if (e instanceof FunctionsHttpError && e.context.status === 401) {
          forgetCharacter(token)
          void qc.invalidateQueries({ queryKey: companionKeys.one(token) })
        }
        throw e
      }
    },
    draftKey,
  }), [token, qc, draftKey])
  const player = useMemo(() => ({ name, setName }), [name])

  // A link that can't create (personal link): back to the sheet, once.
  const refused = !view.canCreate
  const told = useRef(false)
  useEffect(() => {
    if (refused && !told.current) {
      told.current = true
      toast.info(errorText(t, 'not_in_game'))
    }
  }, [refused, t])
  if (refused) {
    const back = view.focus ?? rememberedCharacter(token)
    return <Navigate to={back ? `/t/${token}/c/${back}` : `/t/${token}`} replace />
  }

  async function onSave(draft: CreationDraft) {
    try {
      const id = await create.mutateAsync({ data: companionSheet(toCharacterData(draft)), playerName: name.trim() })
      saveLocalDraft(draftKey, null)
      toast.success(t('{name} rejoint la partie.', { name: draft.name.trim() }))
      navigate(`/t/${token}/c/${id}`)
    } catch (e) {
      const code = (e as { code?: CompanionErrorCode }).code ?? 'network'
      const message = errorText(t, code)
      if (message) toast.error(message)
    }
  }

  return (
    <>
      <Masthead compact eyebrow={t('À la table')} title="Grimoire" subtitle={view.game.title || undefined} />
      <span className="double-rule" />
      <WizardHostProvider value={host}>
        <PlayerNameContext.Provider value={player}>
          <CharacterWizard initial={initial} editing={false} onSave={onSave} compact />
        </PlayerNameContext.Provider>
      </WizardHostProvider>
    </>
  )
}
