import { Dices, Pencil, Printer, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import type { CharacterRow } from '@/characters/api'
import { CharacterSheet } from '@/characters/CharacterSheet'
import { SHEET_LIMITS, toCharacterData } from '@/characters/character'
import { CharacterWizard } from '@/characters/wizard/CharacterWizard'
import { KEEPER_DRAFT_KEY, loadLocalDraft, saveLocalDraft, WizardHostProvider, type WizardHost } from '@/characters/wizard/host'
import { baseValue, randomInvestigator, type CreationDraft } from '@/engine/creation'
import { Rich } from '@/i18n/Rich'
import { skillName, useT } from '@/i18n/t'
import { SKILLS } from '@/rules/d100'
import type { Lang } from '@/settings/lang'
import { TOOL_PATHS } from './pages'
import { ToolArticle, ToolIntro, ToolLayout } from './ToolLayout'

// The free investigator creator: the keeper's wizard with no account (no players list, no AI help),
// or a whole investigator at random; then the sheet, ready to print. "Garder dans Grimoire" hands the
// draft to the account's own wizard (same localStorage key) through sign-up.

const DRAFT_KEY = 'grimoire-tool-investigator'

/** Who plays them, typed (no players list without an account): kept in playerId as plain text. */
function PlayerName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT()
  return (
    <Field>
      <FieldLabel htmlFor="w-player">{t('Joueur')}</FieldLabel>
      <Input id="w-player" value={value} maxLength={SHEET_LIMITS.playerName} placeholder={t('Prénom')} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

const toolHost: WizardHost = {
  PlayerInput: PlayerName,
  usePlayerName: (name) => name?.trim() || undefined,
  draftKey: DRAFT_KEY,
}

/** The sheet component reads a saved investigator: a stand-in row for one that only lives here. */
function rowOf(d: CreationDraft): CharacterRow {
  const data = toCharacterData(d)
  const player = d.playerId.trim() ? { id: '', name: d.playerId.trim() } : null
  return { id: 'tool', name: data.name, data, photo: null, player } as unknown as CharacterRow
}

/** Every skill the investigator didn't put points in, at its base value (to note them at the table). */
function OtherSkills({ draft }: { draft: CreationDraft }) {
  const t = useT()
  const taken = new Set([...draft.occupationSkills, ...draft.personalInterests, 'dodge', 'credit-rating'])
  const rest = SKILLS.filter((s) => !taken.has(s.id) && !s.noCreation && !s.id.endsWith('-2'))
    .map((s) => ({ id: s.id, name: skillName(t, s.id), value: baseValue(s.id, draft.characteristics) }))
    .sort((a, b) => a.name.localeCompare(b.name, t.lang))
  return (
    <section className="flex flex-col gap-3 break-inside-avoid">
      <h2 className="eyebrow">{t('Les autres compétences, à leur valeur de base')}</h2>
      <ul className="grid gap-x-6 text-sm sm:grid-cols-3 print:grid-cols-3">
        {rest.map((s) => (
          <li key={s.id} className="flex items-baseline justify-between gap-2 border-b border-border py-1">
            <span>{s.name}</span>
            <span className="font-mono">{s.value}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function InvestigatorToolPage({ lang }: { lang: Lang }) {
  const t = useT()
  const navigate = useNavigate()
  const other: Lang = lang === 'fr' ? 'en' : 'fr'
  const [draft, setDraft] = useState<CreationDraft>(() => loadLocalDraft(DRAFT_KEY))
  const [view, setView] = useState<'wizard' | 'sheet'>('wizard')
  // A new wizard each time its draft is replaced from outside (random investigator).
  const [round, setRound] = useState(0)

  function showSheet(d: CreationDraft) {
    setDraft(d)
    saveLocalDraft(DRAFT_KEY, d)
    setView('sheet')
    window.scrollTo(0, 0)
  }

  function random() {
    const d = randomInvestigator()
    setRound((r) => r + 1)
    showSheet(d)
  }

  function edit() {
    setRound((r) => r + 1)
    setView('wizard')
    navigate({ search: '?etape=1' }, { replace: true })
  }

  /** Into the account: the keeper's wizard opens on this draft after sign-up (or sign-in). */
  function keep() {
    saveLocalDraft(KEEPER_DRAFT_KEY, { ...draft, playerId: '' })
    navigate(`/login?mode=signup&next=${encodeURIComponent('/characters/new?etape=7')}`)
  }

  return (
    <ToolLayout lang={lang} alternate={TOOL_PATHS.investigator[other]}>
      <div className="print:hidden">
        <ToolIntro
          eyebrow={t('Outil gratuit')}
          title={t('Créer un investigateur')}
          crumbs={[[t('Outils'), TOOL_PATHS.hub[lang]], [t('Créer un investigateur'), TOOL_PATHS.investigator[lang]]]}
        >
          <p>{t('Un investigateur des années 1920, pas à pas : occupation, caractéristiques, valeurs dérivées, compétences et profil, vérifiés à chaque étape. Ou d’un clic, au hasard. La fiche se lit à l’écran et s’imprime.')}</p>
        </ToolIntro>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" variant={view === 'sheet' ? 'outline' : 'default'} onClick={random}>
            <Dices data-icon="inline-start" />
            {view === 'sheet' ? t('Un autre au hasard') : t('Un investigateur au hasard')}
          </Button>
        </div>
      </div>

      {view === 'wizard' ? (
        <WizardHostProvider value={toolHost}>
          <CharacterWizard key={round} initial={draft} editing={false} heading="h2" saveLabel={t('Voir la fiche à imprimer')} onSave={async (d) => showSheet(d)} />
        </WizardHostProvider>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="print-sheet flex flex-col gap-8">
            <CharacterSheet character={rowOf(draft)} headingLevel={2} />
            <OtherSkills draft={draft} />
          </div>
          <div className="flex flex-wrap gap-3 print:hidden">
            <Button size="lg" onClick={() => window.print()}>
              <Printer data-icon="inline-start" />
              {t('Imprimer la fiche')}
            </Button>
            <Button size="lg" variant="outline" onClick={edit}>
              <Pencil data-icon="inline-start" />
              {t('Modifier')}
            </Button>
            <Button size="lg" variant="ghost" onClick={keep}>
              <UserPlus data-icon="inline-start" />
              {t('Garder dans Grimoire')}
            </Button>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground print:hidden">
            {t('Pour un PDF, choisis « Enregistrer au format PDF » dans la fenêtre d’impression. Dans Grimoire, l’investigateur reste dans ton compte, progresse d’une partie à l’autre et s’ouvre sur le téléphone du joueur.')}
          </p>
        </div>
      )}

      <ToolArticle title={t('Créer un investigateur, étape par étape')}>
        <h3>{t('1. Le concept')}</h3>
        <p>{t('Un nom, un âge et surtout une occupation : antiquaire, journaliste, médecin, détective privé… C’est elle qui donne les compétences de départ.')}</p>
        <h3>{t('2. Les caractéristiques')}</h3>
        <p><Rich text={t('Force, Constitution, Taille, Dextérité, Apparence, Intelligence, Pouvoir et Éducation. On répartit les valeurs **40, 50, 50, 50, 60, 60, 70 et 80**, ou on les tire aux dés. La Chance se tire à 3D6 × 5.')} /></p>
        <h3>{t('3. Les valeurs dérivées')}</h3>
        <p>{t('Points de vie, points de magie, santé mentale, mouvement, impact et carrure se calculent à partir des caractéristiques. L’outil s’en charge.')}</p>
        <h3>{t('4. Les compétences')}</h3>
        <p><Rich text={t('Les huit compétences de l’occupation et le Crédit se partagent les valeurs **70, 60, 60, 50, 50, 50, 40, 40 et 40**. Quatre centres d’intérêt personnels gagnent ensuite 20 points chacun.')} /></p>
        <h3>{t('5. Le profil')}</h3>
        <p>{t('Description, idéologie, personne importante, lieu significatif, bien précieux, traits : quelques phrases qui donnent une âme à l’investigateur et des prises au gardien.')}</p>
      </ToolArticle>
    </ToolLayout>
  )
}
