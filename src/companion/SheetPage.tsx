import { Check, Minus, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { Link, Navigate, NavLink, Outlet, useOutletContext, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { skillName, useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import type { Points } from '@/play/companion'
import { CHARACTERISTIC_INFO, CHARACTERISTICS, PROFILE_FIELDS } from '@/rules/d100'
import { Masthead } from '@/theme/Masthead'
import { pointsOf, rememberCharacter, useSetPoints, type CompanionMember } from './api'
import { useCompanionContext, type CompanionContext } from './CompanionLayout'
import type { PickState } from './PickPage'
import { skillRows } from './sheet'

export interface SheetContext extends CompanionContext {
  member: CompanionMember
}
export const useSheetContext = () => useOutletContext<SheetContext>()

const TABS = [
  { to: '', label: 'Fiche', end: true },
  { to: 'carnet', label: 'Carnet' },
  { to: 'profil', label: 'Profil' },
]

/** `/t/:token/c/:characterId`: one investigator, tabs Fiche · Carnet · Profil. */
export function SheetPage() {
  const t = useT()
  const ctx = useCompanionContext()
  const { token, view, live } = ctx
  const { characterId = '' } = useParams()
  const member = view.party.find((m) => m.id === characterId)

  useEffect(() => {
    if (member && !view.focus) rememberCharacter(token, member.id)
  }, [member, view.focus, token])

  if (view.focus && view.focus !== characterId) return <Navigate to={`/t/${token}/c/${view.focus}`} replace />
  if (!member) {
    return (
      <>
        <Masthead compact eyebrow={view.game.title || t('À la table')} title="Grimoire" />
        <span className="double-rule" />
        <p role="alert" className="text-center font-serif text-xl">{t("Cet investigateur n'est plus dans la partie.")}</p>
        {!view.focus && <ChangeLink token={token} />}
      </>
    )
  }

  const d = member.data
  const subtitle = [d.occupation, d.age ? t('{n} ans', { n: d.age }) : ''].filter(Boolean).join(' · ')
  return (
    <>
      <header className="flex flex-col items-center gap-2">
        <Masthead compact eyebrow={view.game.title || t('À la table')} title={d.name} subtitle={subtitle || undefined} />
        <p
          className={cn(
            'flex h-4 items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.14em] text-emerald-400 uppercase transition-opacity',
            !live && 'opacity-0',
          )}
          aria-hidden={!live}
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          {t('En direct avec le gardien')}
        </p>
      </header>
      <span className="double-rule" />
      <Outlet context={{ ...ctx, member } satisfies SheetContext} />
      {!view.focus && <ChangeLink token={token} />}
      <nav
        aria-label={t('Fiche')}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-lg justify-around">
          {TABS.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex-1 py-4 text-center text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase hover:text-gold',
                  isActive && 'text-gold',
                )
              }
            >
              {t(tab.label)}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}

function ChangeLink({ token }: { token: string }) {
  const t = useT()
  return (
    <Link
      to={`/t/${token}`}
      state={{ pick: true } satisfies PickState}
      className="mx-auto text-xs tracking-[0.2em] text-muted-foreground uppercase underline underline-offset-4 hover:text-foreground"
    >
      {t("Changer d'investigateur")}
    </Link>
  )
}

const STATS: Array<{ key: keyof Points; label: string }> = [
  { key: 'pv', label: 'PV' },
  { key: 'san', label: 'SAN' },
  { key: 'chance', label: 'Chance' },
  { key: 'pm', label: 'PM' },
]

/** HP / SAN / Luck / MP with − / +. Each tap is a ±1 on the latest value, so quick taps all count. */
function StatTiles({ member }: { member: CompanionMember }) {
  const t = useT()
  const { token, view } = useSheetContext()
  const setPoints = useSetPoints(token)
  const maxHp = member.data.hp ?? 10
  const now = pointsOf(view, member)

  const tap = (field: keyof Points, delta: number) => setPoints.mutate({ characterId: member.id, field, delta })

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STATS.map(({ key, label }) => {
        const max = key === 'pv' ? maxHp : 99
        const low = key === 'pv' && now.pv <= Math.floor(maxHp / 2)
        return (
          <div key={key} className="flex flex-col items-center gap-1 border border-border bg-card px-2 pt-2 pb-1">
            <span className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{t(label)}</span>
            <output aria-label={t(label)} className={cn('font-heading text-3xl leading-none', low && 'text-destructive')}>
              {key === 'pv' ? `${now.pv} / ${maxHp}` : now[key]}
            </output>
            <div className="flex w-full justify-between">
              <Button
                variant="ghost"
                size="icon-lg"
                className="text-gold"
                aria-label={t('Retirer 1 {stat}', { stat: t(label) })}
                disabled={now[key] <= 0}
                onClick={() => tap(key, -1)}
              >
                <Minus />
              </Button>
              <Button
                variant="ghost"
                size="icon-lg"
                className="text-gold"
                aria-label={t('Ajouter 1 {stat}', { stat: t(label) })}
                disabled={now[key] >= max}
                onClick={() => tap(key, 1)}
              >
                <Plus />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Fiche tab: points, characteristics, skills. */
export function SheetTab() {
  const t = useT()
  const { view, member } = useSheetContext()
  const d = member.data
  const rows = skillRows(d, pointsOf(view, member).checks)
  const chars = CHARACTERISTICS.filter((c) => typeof d.characteristics?.[c] === 'number')
  const derived = [
    { label: 'Mouvement', value: d.move },
    { label: 'Carrure', value: d.build },
    { label: 'Impact', value: d.damageBonus },
  ].filter((x) => x.value !== undefined && x.value !== '')

  return (
    <div className="flex flex-col gap-6">
      <StatTiles member={member} />

      {(chars.length > 0 || derived.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="eyebrow">{t('Caractéristiques')}</h2>
          {chars.length > 0 && (
            <dl className="grid grid-cols-4 gap-px border border-border bg-border">
              {chars.map((c) => (
                <div key={c} className="flex flex-col items-center bg-card py-2">
                  <dt className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{t(CHARACTERISTIC_INFO[c].short)}</dt>
                  <dd className="font-mono text-lg">{d.characteristics?.[c]}</dd>
                </div>
              ))}
            </dl>
          )}
          {derived.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {derived.map((x) => `${t(x.label)} ${x.value}`).join(' · ')}
            </p>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="eyebrow">{t('Compétences')}</h2>
            <span className="text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">{t('ordinaire · majeure · extrême')}</span>
          </div>
          <ul>
            {rows.map((r) => {
              const [id, specialty] = r.key.split(/:(.*)/)
              return (
                <li key={r.key} className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                  <span className={cn('font-serif text-lg', r.checked && 'text-gold')}>
                    {skillName(t, id, specialty)}
                    {r.checked && (
                      <Check aria-label={t('Cochée en jeu')} className="ml-1.5 inline size-4 align-[-2px]" />
                    )}
                  </span>
                  <span className="font-mono text-sm whitespace-nowrap">
                    {r.value} <span className="text-muted-foreground">· {r.hard} · {r.extreme}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Profil tab: backstory fields and link with the story. */
export function ProfileTab() {
  const t = useT()
  const { member } = useSheetContext()
  const d = member.data
  const fields = [
    ...PROFILE_FIELDS.map((f) => ({ label: f.label, text: d.profile?.[f.id]?.trim() ?? '' })),
    { label: "Lien avec l'histoire", text: d.link?.trim() ?? '' },
  ].filter((f) => f.text)

  return (
    <div className="flex flex-col gap-5">
      {member.player && <p className="text-center text-sm text-muted-foreground">{t('Joué par {name}', { name: member.player })}</p>}
      {fields.length ? (
        fields.map((f) => (
          <section key={f.label} className="flex flex-col gap-1">
            <h2 className="eyebrow">{t(f.label)}</h2>
            <p className="font-serif text-lg whitespace-pre-wrap">{f.text}</p>
          </section>
        ))
      ) : (
        <p className="font-serif text-lg text-muted-foreground italic">{t("Rien dans le profil pour l'instant.")}</p>
      )}
    </div>
  )
}
