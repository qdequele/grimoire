import { Camera, Check, Dices, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useOutletContext, useParams } from 'react-router'
import { Avatar } from '@/characters/Avatar'
import { PhotoDialog } from '@/characters/PhotoDialog'
import { Button } from '@/components/ui/button'
import { skillName, useT, type T } from '@/i18n/t'
import { cn } from '@/lib/utils'
import type { Points } from '@/play/companion'
import { CHARACTERISTIC_INFO, CHARACTERISTICS, PROFILE_FIELDS, SKILL_BY_ID } from '@/rules/d100'
import { Masthead, SkinToggle } from '@/theme/Masthead'
import { pointsOf, rememberCharacter, useSetPhoto, useSetPoints, type CompanionMember } from './api'
import { useCompanionContext, type CompanionContext } from './CompanionLayout'
import type { PickState } from './PickPage'
import { RollDialog, type RollTarget } from './Dice'
import { rollableSkillKey } from './rolls'
import { skillRows } from './sheet'

export interface SheetContext extends CompanionContext {
  member: CompanionMember
}
export const useSheetContext = () => useOutletContext<SheetContext>()

const TABS = [
  { to: '', label: 'Fiche', end: true },
  { to: 'des', label: 'Dés' },
  { to: 'objets', label: 'Objets' },
  { to: 'carnet', label: 'Carnet' },
  { to: 'profil', label: 'Profil' },
]

/** `/t/:token/c/:characterId`: one investigator, tabs Fiche · Dés · Objets · Carnet · Profil. */
export function SheetPage() {
  const t = useT()
  const ctx = useCompanionContext()
  const { token, view, live } = ctx
  const { characterId = '' } = useParams()
  const member = view.party.find((m) => m.id === characterId)
  const [photoOpen, setPhotoOpen] = useState(false)
  const setPhoto = useSetPhoto(token)

  useEffect(() => {
    if (member && !view.focus) rememberCharacter(token, member.id)
  }, [member, view.focus, token])

  if (view.focus && view.focus !== characterId) return <Navigate to={`/t/${token}/c/${view.focus}`} replace />
  if (!member) {
    return (
      <div className="flex flex-col gap-6 lg:mx-auto lg:w-full lg:max-w-lg">
        <Masthead compact eyebrow={view.game.title || t('À la table')} title="Grimoire" />
        <span className="double-rule" />
        <p role="alert" className="text-center font-serif text-xl">{t("Cet investigateur n'est plus dans la partie.")}</p>
        {!view.focus && <ChangeLink token={token} />}
      </div>
    )
  }

  const d = member.data
  const subtitle = [d.occupation, d.age ? t('{n} ans', { n: d.age }) : ''].filter(Boolean).join(' · ')
  return (
    <>
      {/* Phone: one column, tabs at the bottom. Computer (lg): the investigator and the tabs in a
          side column that stays put, the tab's content beside it. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-12">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
          <header className="flex flex-col items-center gap-2">
            <button
              type="button"
              className="group relative rounded-full focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
              aria-label={member.photo ? t('Changer la photo de {name}', { name: d.name }) : t('Ajouter une photo de {name}', { name: d.name })}
              onClick={() => setPhotoOpen(true)}
            >
              <Avatar name={d.name} photo={member.photo} className="size-20 text-2xl group-hover:border-foreground lg:size-24" />
              <span aria-hidden="true" className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border border-gold bg-background text-gold">
                <Camera className="size-3.5" />
              </span>
            </button>
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
          <SideTabs />
          <div className="hidden flex-col items-center gap-4 lg:flex">
            {!view.focus && <ChangeLink token={token} />}
            <SkinToggle />
          </div>
        </aside>
        <div className="flex min-w-0 flex-col gap-6">
          <Outlet context={{ ...ctx, member } satisfies SheetContext} />
          {!view.focus && <ChangeLink token={token} className="lg:hidden" />}
        </div>
      </div>
      <PhotoDialog
        name={d.name}
        photo={member.photo}
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        onSave={(photo) => setPhoto.mutateAsync({ characterId: member.id, photo })}
      />
      <nav
        aria-label={t('Fiche')}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur lg:hidden"
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

/** The tabs on a computer: a legacy diamond-bullet menu in the side column. */
function SideTabs() {
  const t = useT()
  return (
    <nav aria-label={t('Fiche')} className="hidden lg:block">
      <ul className="flex flex-col gap-3">
        {TABS.map((tab) => (
          <li key={tab.label}>
            <NavLink to={tab.to} end={tab.end} className="group flex items-center gap-3">
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={cn('size-2.5 shrink-0 rotate-45 border border-gold/50 group-hover:bg-gold', isActive && 'bg-gold')}
                  />
                  <span className={cn('font-heading text-2xl leading-tight group-hover:text-gold', isActive && 'text-gold')}>
                    {t(tab.label)}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ChangeLink({ token, className }: { token: string; className?: string }) {
  const t = useT()
  return (
    <Link
      to={`/t/${token}`}
      state={{ pick: true } satisfies PickState}
      className={cn(
        'mx-auto text-xs tracking-[0.2em] text-muted-foreground uppercase underline underline-offset-4 hover:text-foreground',
        className,
      )}
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

/** What a SAN or Luck roll is for; null for the points that are never rolled. */
function statWhat(t: T, key: keyof Points): string | null {
  if (key === 'san') return t('Santé mentale. Le gardien demande un jet de SAN face à l’horreur : le réussir limite la perte.')
  if (key === 'chance') return t('Le gardien demande un jet de Chance quand seul le hasard peut trancher.')
  return null
}

/**
 * HP / SAN / Luck / MP with − / +. Each tap is a ±1 on the latest value, so quick taps all count.
 * SAN and Luck are also rolled: their label opens the roll dialog with the current value.
 */
function StatTiles({ member, onRoll }: { member: CompanionMember; onRoll: (r: RollTarget) => void }) {
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
        const what = statWhat(t, key)
        const labelClass = 'text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase'
        return (
          <div key={key} className="flex flex-col items-center gap-1 border border-border bg-card px-2 pt-2 pb-1">
            {what ? (
              <button
                type="button"
                className={cn(labelClass, 'inline-flex items-center gap-1 hover:text-gold')}
                aria-label={t('Jet de {stat}', { stat: t(label) })}
                onClick={() => onRoll({ subject: { kind: key === 'san' ? 'san' : 'luck' }, title: t(label), what, value: now[key] })}
              >
                {t(label)}
                <Dices aria-hidden="true" className="size-3" />
              </button>
            ) : (
              <span className={labelClass}>{t(label)}</span>
            )}
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
  const [rolling, setRolling] = useState<RollTarget | null>(null)
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
      <RollDialog target={rolling} onClose={() => setRolling(null)} />
      <StatTiles member={member} onRoll={setRolling} />

      {/* Computer: characteristics in a narrow column beside the skills. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      {(chars.length > 0 || derived.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="eyebrow">{t('Caractéristiques')}</h2>
          {chars.length > 0 && (
            <div className="grid grid-cols-4 gap-px border border-border bg-border">
              {chars.map((c) => {
                const value = d.characteristics?.[c] ?? 0
                const info = CHARACTERISTIC_INFO[c]
                return (
                  <button
                    key={c}
                    type="button"
                    className="flex w-full flex-col items-center bg-card py-2 hover:text-gold"
                    aria-label={`${t(info.name)} ${value}`}
                    onClick={() => setRolling({ subject: { kind: 'char', id: c }, title: t(info.name), what: t(info.what), value })}
                  >
                    <span className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{t(info.short)}</span>
                    <span className="font-mono text-lg">{value}</span>
                  </button>
                )
              })}
            </div>
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
          <p className="text-xs text-muted-foreground pointer-fine:hidden">{t('Touche une compétence pour savoir à quoi elle sert et la lancer.')}</p>
          <p className="hidden text-xs text-muted-foreground pointer-fine:block">{t('Clique sur une compétence pour savoir à quoi elle sert et la lancer.')}</p>
          <ul>
            {rows.map((r) => {
              const [id, specialty] = r.key.split(/:(.*)/)
              const name = skillName(t, id, specialty)
              const what = SKILL_BY_ID.get(id)?.what
              const rollable = rollableSkillKey(r.key)
              const open = () =>
                setRolling({
                  subject: { kind: 'skill', key: r.key },
                  title: name,
                  what: what ? t(what) : '',
                  value: r.value,
                })
              return (
                <li key={r.key} className="border-b border-border">
                  <button
                    type="button"
                    disabled={!rollable}
                    onClick={open}
                    className="flex w-full items-baseline justify-between gap-3 py-2 text-left hover:text-gold disabled:hover:text-inherit"
                  >
                    <span className={cn('font-serif text-lg', r.checked && 'text-gold')}>
                      {name}
                      {r.checked && (
                        <Check aria-label={t('Cochée en jeu')} className="ml-1.5 inline size-4 align-[-2px]" />
                      )}
                    </span>
                    <span className="font-mono text-sm whitespace-nowrap">
                      {r.value} <span className="text-muted-foreground">· {r.hard} · {r.extreme}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      </div>
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
    <div className="flex max-w-2xl flex-col gap-5">
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
