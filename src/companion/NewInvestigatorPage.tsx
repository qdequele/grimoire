import { useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { CreationDraft } from '@/engine/creation'
import { SHEET_LIMITS, skillKeyLabel, toCharacterData } from '@/characters/character'
import { CharacterWizard } from '@/characters/wizard/CharacterWizard'
import { invokeSuggestProfile, loadLocalDraft, saveLocalDraft, WizardHostProvider, type WizardHost } from '@/characters/wizard/host'
import { TextLimit } from '@/characters/wizard/parts'
import { PROFILE_FIELDS } from '@/rules/d100'
import { useT, type T } from '@/i18n/t'
import { Masthead } from '@/theme/Masthead'
import { companionKeys, forgetCharacter, rememberedCharacter, useCreateCharacter, type CompanionErrorCode } from './api'
import { useCompanionContext } from './CompanionLayout'
import { companionSheet, companionSheetProblems, type SheetProblem } from './sheet'

/** The first name typed on the phone: page state, not one of the keeper's players. */
const PlayerNameContext = createContext<{ name: string; setName: (name: string) => void }>({ name: '', setName: () => {} })

function PlayerNameInput() {
  const t = useT()
  const { name, setName } = useContext(PlayerNameContext)
  return (
    <Field>
      <FieldLabel htmlFor="w-player">{t('Ton prénom')}</FieldLabel>
      <Input id="w-player" value={name} maxLength={SHEET_LIMITS.playerName} autoComplete="given-name" placeholder={t('Prénom')} onChange={(e) => setName(e.target.value)} />
      <TextLimit value={name.trim()} max={SHEET_LIMITS.playerName} markup />
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

/** Toast for a field the server would refuse: which one, and why (instead of "a value was refused"). */
function problemText(t: T, p: SheetProblem): string {
  const field =
    p.field === 'name' ? t('Nom')
    : p.field === 'occupation' ? t('Occupation')
    : p.field === 'link' ? t("Lien avec l'histoire")
    : p.field === 'playerName' ? t('Ton prénom')
    : 'id' in p ? t(PROFILE_FIELDS.find((f) => f.id === p.id)?.label ?? 'Profil')
    : 'key' in p ? skillKeyLabel(p.key)
    : ''
  return p.reason === 'tooLong'
    ? t('« {field} » : {max} caractères au plus.', { field, max: p.max })
    : t('« {field} » : les caractères < > & et " ne sont pas acceptés.', { field })
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
    noMarkup: true,
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
    const data = companionSheet(toCharacterData(draft))
    const problems = companionSheetProblems(data, name)
    if (problems.length) {
      toast.error(problemText(t, problems[0]))
      return
    }
    try {
      const id = await create.mutateAsync({ data, playerName: name.trim() })
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
