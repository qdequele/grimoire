// An investigator's full presentation sheet: who they are, their characteristics, skills, profile and
// what play has changed. Shown on its own page (/characters/:id) and above the game screen when the
// keeper clicks an investigator's name there.
import type { ReactNode } from 'react'
import { skillName, useT, type T } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { CHARACTERISTIC_INFO, CHARACTERISTICS, creditTier, PROFILE_FIELDS } from '@/rules/d100'
import type { CharacterRow } from './api'
import { Avatar } from './Avatar'
import { progressSummary } from './character'

const damageBonusText = (t: T, db: string) => (db === '0' ? t('aucun') : db.replace('-', '−'))

function Value({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 border bg-card px-2 py-2.5 text-center">
      <span className="text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">{label}</span>
      <span className="font-mono text-xl">{value}</span>
      {note && <span className="text-[0.6875rem] text-gold">{note}</span>}
    </div>
  )
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  )
}

export function CharacterSheet({ character: c, actions, headingLevel = 1 }: { character: CharacterRow; actions?: ReactNode; headingLevel?: 1 | 2 }) {
  const t = useT()
  const d = c.data
  const progress = progressSummary(d)
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  const skills = Object.entries(d.skills ?? {})
    .map(([key, value]) => {
      const [id, specialty] = key.split(/:(.*)/)
      return { key, value, name: skillName(t, id, specialty) }
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  const credit = d.skills?.['credit-rating']
  const profile = PROFILE_FIELDS.filter((f) => d.profile?.[f.id]?.trim())
  const identity = [d.occupation && t(d.occupation), d.age && t('{n} ans', { n: d.age }), c.player && t('joué par {name}', { name: c.player.name })]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="flex flex-col gap-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={d.name} photo={c.photo} className="size-28 shrink-0 text-3xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="eyebrow">{t("Fiche d'investigateur")}</p>
          <Heading className="font-heading text-4xl leading-tight text-gold">{d.name}</Heading>
          {identity && <p className="font-serif text-lg text-muted-foreground">{identity}</p>}
          {d.link && <p className="font-serif text-base italic">{t("Lien avec l'histoire")} : {d.link}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:self-start">{actions}</div>}
      </header>
      <span className="double-rule" />

      <Section title={t('Caractéristiques')}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
          {CHARACTERISTICS.map((k) => (
            <Value key={k} label={t(CHARACTERISTIC_INFO[k].short)} value={d.characteristics?.[k] ?? '—'} />
          ))}
          <Value label={t('Chance')} value={d.luck ?? '—'} />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Value label={t('PV')} value={d.hp ?? '—'} />
          <Value label="SAN" value={d.san ?? '—'} note={progress.san !== undefined && progress.san !== d.san ? t('actuelle {n}', { n: progress.san }) : undefined} />
          <Value label={t('PM')} value={d.mp ?? '—'} />
          <Value label={t('Mvt')} value={d.move ?? '—'} />
          <Value label={t('Impact · Carrure')} value={`${d.damageBonus ? damageBonusText(t, d.damageBonus) : '—'} · ${d.build ?? '—'}`} />
          <Value label={t('Esquive')} value={d.skills?.dodge ?? '—'} />
        </div>
      </Section>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Section title={t('Compétences')}>
          {skills.length ? (
            <ul className="grid gap-x-6 sm:grid-cols-2">
              {skills.map((s) => (
                <li key={s.key} className="flex items-baseline justify-between gap-3 border-b border-border py-1.5">
                  <span className="font-serif text-lg">{s.name}</span>
                  <span className="font-mono text-sm whitespace-nowrap">
                    {s.value} <span className="text-muted-foreground">· {Math.floor(s.value / 2)} · {Math.floor(s.value / 5)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t('Aucune pour l’instant.')}</p>
          )}
          {credit !== undefined && (
            <p className="text-sm text-muted-foreground">{t('Crédit')} {credit} ({t(creditTier(credit))})</p>
          )}
        </Section>

        <div className="flex flex-col gap-7">
          {profile.length > 0 && (
            <Section title={t('Profil')}>
              <dl className="flex flex-col gap-3">
                {profile.map((f) => (
                  <div key={f.id} className="flex flex-col gap-0.5">
                    <dt className="text-xs tracking-[0.12em] text-muted-foreground uppercase">{t(f.label)}</dt>
                    <dd className="font-serif text-lg leading-snug whitespace-pre-line">{d.profile?.[f.id]}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {(progress.improved.length > 0 || progress.checks.length > 0 || progress.history.length > 0) && (
            <Section title={t('Progression')}>
              {progress.improved.length > 0 && (
                <p className="font-serif text-base">
                  <span className="text-muted-foreground">{t('Améliorées en jeu')} : </span>
                  {progress.improved.map(([n, v]) => `${n} ${v}`).join(' · ')}
                </p>
              )}
              {progress.checks.length > 0 && (
                <p className="font-serif text-base">
                  <span className="text-muted-foreground">{t('Cochées, à améliorer')} : </span>
                  {progress.checks.join(' · ')}
                </p>
              )}
              {progress.history.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                  {progress.history.slice(0, 8).map((h, i) => (
                    <li key={i} className="flex gap-2">
                      {h.at > 0 && <span className="shrink-0 text-muted-foreground">{t.date(new Date(h.at))}</span>}
                      <span>{h.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>
      </div>
    </article>
  )
}
