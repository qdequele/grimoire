import { Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Rich } from '@/i18n/Rich'
import { skillName, skillText, useT, type T } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { CHARACTERISTIC_INFO, CHARACTERISTICS, PROFILE_FIELDS, SKILLS, type SkillDef } from '@/rules/d100'
import type { Lang } from '@/settings/lang'
import { TOOL_PATHS } from './pages'
import { ToolArticle, ToolIntro, ToolLayout } from './ToolLayout'

// A blank investigator sheet to print: Grimoire's own layout (not a copy of any published sheet),
// built from the same rules data as the creation wizard. On screen in the app's look; on paper black
// on white, two A4 pages (src/tools/print.css).

/** A labelled blank line to write on. */
function Line({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn('flex items-end gap-2', className)}>
      <span className="shrink-0 text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">{label}</span>
      <span className="sheet-line h-6 flex-1 border-b border-border" />
    </div>
  )
}

function Block({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 break-inside-avoid border border-border p-3 sm:p-4', className)}>
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  )
}

/** A value with its half and fifth, as boxes. */
function Boxes({ label, sub, big }: { label: string; sub?: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">{label}</span>
      {sub && <span className="-mt-1 text-[0.625rem] text-muted-foreground">{sub}</span>}
      <div className="flex items-stretch">
        <span className={cn('sheet-box border border-border', big ? 'h-11 w-14' : 'h-9 w-11')} />
        <span className="flex flex-col">
          <span className="sheet-box h-1/2 w-7 border border-l-0 border-border" />
          <span className="sheet-box h-1/2 w-7 border border-t-0 border-l-0 border-border" />
        </span>
      </div>
    </div>
  )
}

/** Numbers to cross off: hit points, sanity, magic points, luck. */
function Track({ from = 0, to }: { from?: number; to: number }) {
  const n = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap pt-px pl-px font-mono text-[0.625rem] leading-none">
        {n.map((v) => (
          <span key={v} className="sheet-box flex h-5 w-5 items-center justify-center border border-border -ml-px -mt-px">{v}</span>
        ))}
      </div>
    </div>
  )
}

function baseText(t: T, s: SkillDef): string {
  if (s.base === 'DEX/2') return t('½ DEX')
  if (s.base === 'EDU') return t(CHARACTERISTIC_INFO.EDU.short)
  return String(s.base)
}

/** One skill line: a box to tick when it succeeds in play, its name, its base value, the value. */
function SkillRow({ s }: { s: SkillDef }) {
  const t = useT()
  const name = s.specialty ? skillText(t, s.label.replace(' (autre)', '')) : skillName(t, s.id)
  return (
    <li className="flex items-center gap-2 border-b border-border py-1 text-sm break-inside-avoid print:py-0">
      <span className="sheet-box size-3 shrink-0 border border-border" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        {name}
        {s.specialty && <span className="text-muted-foreground"> (……………)</span>}
        <span className="ml-1 text-xs text-muted-foreground">{baseText(t, s)}</span>
      </span>
      <span className="sheet-box h-5 w-8 shrink-0 border border-border print:h-4" />
      <span className="sheet-box h-5 w-6 shrink-0 border border-border print:h-4" />
      <span className="sheet-box h-5 w-6 shrink-0 border border-border print:h-4" />
    </li>
  )
}

export function BlankSheet() {
  const t = useT()
  const skills = SKILLS.filter((s) => !s.noCreation || s.id === 'credit-rating').sort((a, b) =>
    skillText(t, a.label).localeCompare(skillText(t, b.label), t.lang),
  )
  const statuses = ['Blessure grave', 'Inconscient', 'Mourant', 'Folie passagère', 'Folie durable']
  return (
    <div className="print-sheet blank-sheet flex flex-col gap-4 print:gap-3">
      <header className="flex flex-col gap-3 border-b-2 border-gold pb-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-heading text-3xl text-gold">{t("Fiche d'investigateur")}</h2>
          <span className="text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">legrimoire.quest</span>
        </div>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 print:grid-cols-2">
          <Line label={t('Nom')} />
          <Line label={t('Joueur')} />
          <Line label={t('Occupation')} />
          <div className="grid grid-cols-2 gap-x-6">
            <Line label={t('Âge')} />
            <Line label={t('Résidence')} />
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] print:grid-cols-[3fr_2fr]">
        <Block title={t('Caractéristiques')}>
          <div className="grid grid-cols-4 gap-x-2 gap-y-3">
            {CHARACTERISTICS.map((k) => (
              <Boxes key={k} label={t(CHARACTERISTIC_INFO[k].short)} sub={t(CHARACTERISTIC_INFO[k].name)} />
            ))}
          </div>
          <p className="text-[0.625rem] text-muted-foreground">{t('Grande case : la valeur. Petites cases : sa moitié et son cinquième.')}</p>
        </Block>
        <Block title={t('Valeurs dérivées')}>
          <div className="grid grid-cols-3 gap-x-2 gap-y-3">
            {['Mouvement', 'Impact', 'Carrure'].map((label) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">{t(label)}</span>
                <span className="sheet-box h-9 w-14 border border-border" />
              </div>
            ))}
          </div>
          <ul className="flex flex-col gap-1">
            {statuses.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className="sheet-box size-3 border border-border" aria-hidden="true" />
                {t(s)}
              </li>
            ))}
          </ul>
        </Block>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <Block title={t('Points de vie')}>
          <Track to={20} />
        </Block>
        <Block title={t('Points de magie')}>
          <Track to={24} />
        </Block>
      </div>
      <Block title={t('Santé mentale')}>
        <Track to={99} />
      </Block>
      <Block title={t('Chance')}>
        <Track to={99} />
      </Block>

      <Block title={t('Armes')}>
        <table className="w-full text-left text-sm">
          <thead className="text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">
            <tr>
              {['Arme', 'Valeur', 'Dégâts', 'Portée', 'Attaques', 'Munitions'].map((h) => (
                <th key={h} className="border-b border-border py-1 pr-2 font-normal">{t(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-border py-1.5 pr-2">{t('Mains nues')}</td>
              <td className="border-b border-border py-1.5 pr-2" />
              <td className="border-b border-border py-1.5 pr-2 font-mono">{t('1D3 + impact')}</td>
              <td className="border-b border-border py-1.5 pr-2">—</td>
              <td className="border-b border-border py-1.5 pr-2">1</td>
              <td className="border-b border-border py-1.5 pr-2">—</td>
            </tr>
            {Array.from({ length: 3 }, (_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }, (_, j) => <td key={j} className="h-8 border-b border-border" />)}
              </tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block title={t('Compétences')} className="sheet-page-break">
        <p className="text-[0.625rem] text-muted-foreground">
          {t('Coche la case quand la compétence réussit en jeu : elle pourra progresser entre deux parties. Après le nom, sa valeur de base. Puis la valeur, sa moitié et son cinquième.')}
        </p>
        <ul className="grid gap-x-6 sm:grid-cols-2 print:grid-cols-2">
          {skills.map((s) => <SkillRow key={s.id} s={s} />)}
          {Array.from({ length: 3 }, (_, i) => (
            <li key={`blank-${i}`} className="flex items-center gap-2 border-b border-border py-1 text-sm print:py-0">
              <span className="sheet-box size-3 shrink-0 border border-border" aria-hidden="true" />
              <span className="sheet-line h-5 flex-1" />
              <span className="sheet-box h-5 w-8 shrink-0 border border-border print:h-4" />
              <span className="sheet-box h-5 w-6 shrink-0 border border-border print:h-4" />
              <span className="sheet-box h-5 w-6 shrink-0 border border-border print:h-4" />
            </li>
          ))}
        </ul>
      </Block>


      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <Block title={t('Profil')}>
          <div className="flex flex-col gap-2 print:gap-1">
            {PROFILE_FIELDS.map((f) => <Line key={f.id} label={t(f.label)} />)}
          </div>
        </Block>
        <Block title={t('Équipement et argent')}>
          <div className="flex flex-col gap-2 print:gap-1">
            {Array.from({ length: 6 }, (_, i) => <span key={i} className="sheet-line h-6 border-b border-border" />)}
          </div>
        </Block>
      </div>
      <Block title={t('Notes')}>
        <div className="flex flex-col gap-2 print:gap-1">
          {Array.from({ length: 3 }, (_, i) => <span key={i} className="sheet-line h-6 border-b border-border" />)}
        </div>
      </Block>
    </div>
  )
}

export function BlankSheetPage({ lang }: { lang: Lang }) {
  const t = useT()
  const other: Lang = lang === 'fr' ? 'en' : 'fr'
  return (
    <ToolLayout lang={lang} alternate={TOOL_PATHS.sheet[other]}>
      <div className="flex flex-col gap-6 print:hidden">
        <ToolIntro
          eyebrow={t('À imprimer')}
          title={t('Fiche d’investigateur vierge')}
          crumbs={[[t('Outils'), TOOL_PATHS.hub[lang]], [t('Fiche vierge'), TOOL_PATHS.sheet[lang]]]}
        >
          <p>{t('Une fiche de personnage vierge pour les jeux d’enquête et d’horreur au d100 : caractéristiques avec leur moitié et leur cinquième, valeurs dérivées, toutes les compétences avec leur valeur de base, armes, profil et équipement. Deux pages A4, en noir et blanc.')}</p>
        </ToolIntro>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            {t('Imprimer la fiche')}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('Pour un PDF, choisis « Enregistrer au format PDF » dans la fenêtre d’impression. Tu préfères la remplir à l’écran ?')}{' '}
          <Link to={TOOL_PATHS.investigator[lang]} className="text-gold underline underline-offset-4">{t('Crée l’investigateur en ligne')}</Link>
        </p>
      </div>

      <BlankSheet />

      <ToolArticle title={t('Remplir la fiche')}>
        <p><Rich text={t('Commence par l’occupation, puis répartis **40, 50, 50, 50, 60, 60, 70 et 80** entre les huit caractéristiques. Note dans les petites cases la moitié et le cinquième de chaque valeur : ce sont les seuils des réussites majeures et extrêmes.')} /></p>
        <p>{t('Les points de vie valent (CON + TAI) ÷ 10, les points de magie POU ÷ 5, la santé mentale de départ est égale au POU. La Chance se tire à 3D6 × 5. Entoure les valeurs de départ sur les pistes et barre ce qui est perdu en jeu.')}</p>
        <p>{t('Chaque compétence part de sa valeur de base, notée après son nom. Ajoute les points de l’occupation et des centres d’intérêt, puis note la valeur, sa moitié et son cinquième.')}</p>
      </ToolArticle>
    </ToolLayout>
  )
}
