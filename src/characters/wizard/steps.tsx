import { Dices, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  applyOccupation,
  baseValue,
  checkDraft,
  DAMAGE_BONUS_TABLE,
  derivedValues,
  generateNames,
  hasSocialSkill,
  occupationChoicesLeft,
  occupationOf,
  placedCharacteristics,
  placedOccupationValues,
  remaining,
  rollCharacteristic,
  rollLuck,
  skillTotal,
  ISSUE_STEP,
  type CreationDraft,
  type Issue,
  type NameGender,
} from '@/engine/creation'
import { cn } from '@/lib/utils'
import { useWizardHost } from './host'
import {
  CHARACTERISTIC_ARRAY,
  CHARACTERISTIC_INFO,
  CHARACTERISTICS,
  creditTier,
  NAME_ORIGINS,
  OCCUPATION_ARRAY,
  OCCUPATIONS,
  PERSONAL_INTEREST_COUNT,
  SKILL_BY_ID,
  SKILLS,
  SOCIAL_SKILLS,
} from '@/rules/d100'
import { Rich } from '@/i18n/Rich'
import { skillName, type T } from '@/i18n/t'
import { Pool, Stat, Tuto, ValueSelect } from './parts'
import { ProfileStep } from './ProfileStep'
import { useT } from '@/i18n/t'

export interface StepProps {
  draft: CreationDraft
  update: (patch: Partial<CreationDraft> | ((d: CreationDraft) => CreationDraft)) => void
  goTo?: (step: number) => void
}

const label = (t: T, d: CreationDraft, id: string) => skillName(t, id, d.specialties[id])
const damageBonusText = (t: T, db: string) => (db === '0' ? t('aucun') : db.replace('-', '−'))
/** FOR → STR in English. */
const short = (t: T, k: (typeof CHARACTERISTICS)[number]) => t(CHARACTERISTIC_INFO[k].short)

// ------------------------------------------------------------------ 1. Concept

export function ConceptStep({ draft: d, update }: StepProps) {
  const t = useT()
  const { PlayerInput } = useWizardHost()
  const [gender, setGender] = useState<NameGender>('any')
  const [origin, setOrigin] = useState('ne')
  const [ideas, setIdeas] = useState<string[]>([])
  const o = occupationOf(d)
  const free = 8 - o.skills.length - (o.social ? 1 : 0)

  function generate() {
    const names = generateNames(origin, gender)
    setIdeas(names)
    if (!d.name.trim()) update({ name: names[0] })
  }

  return (
    <>
      <Tuto>
        <p>{t("Un investigateur est une personne ordinaire des années 1920 : pense d'abord à la façon dont il gagne sa vie.")}</p>
        <p>{t("Les occupations conseillées sont dans la liste. Tu peux aussi en inventer une, avec l'accord du gardien.")}</p>
      </Tuto>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
          <Field>
            <FieldLabel htmlFor="w-name">{t('Nom')}</FieldLabel>
            <Input id="w-name" value={d.name} placeholder={t('Ex. Ada Whitcombe')} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="w-occ">{t('Occupation')}</FieldLabel>
            <NativeSelect id="w-occ" value={d.occupation} onChange={(e) => update((x) => applyOccupation(x, e.target.value))}>
              {OCCUPATIONS.map((x) => <NativeSelectOption key={x.id} value={x.id}>{t(x.label)}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="w-age">{t('Âge')}</FieldLabel>
            <Input id="w-age" type="number" min={15} max={89} value={d.age} onChange={(e) => update({ age: Number(e.target.value) || 0 })} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label={t('Genre du nom')} size="sm" value={gender} onChange={(e) => setGender(e.target.value as NameGender)}>
            <NativeSelectOption value="any">{t('Au hasard')}</NativeSelectOption>
            <NativeSelectOption value="f">{t('Femme')}</NativeSelectOption>
            <NativeSelectOption value="m">{t('Homme')}</NativeSelectOption>
          </NativeSelect>
          <NativeSelect aria-label={t('Origine du nom')} size="sm" value={origin} onChange={(e) => setOrigin(e.target.value)}>
            {Object.entries(NAME_ORIGINS).map(([k, v]) => <NativeSelectOption key={k} value={k}>{t(v.label)}</NativeSelectOption>)}
          </NativeSelect>
          <Button type="button" variant="outline" size="sm" onClick={generate}>{t('Générer un nom')}</Button>
        </div>
        {ideas.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label={t('Idées de noms')}>
            {ideas.map((n) => (
              <Button key={n} type="button" variant={n === d.name ? 'secondary' : 'ghost'} size="sm" onClick={() => update({ name: n })}>
                {n}
              </Button>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <PlayerInput value={d.playerId ?? ''} onChange={(playerId) => update({ playerId })} />
        </div>
        <Field>
          <FieldLabel htmlFor="w-link">{t("Lien avec l'histoire")}</FieldLabel>
          <Textarea id="w-link" value={d.link} placeholder={t('Ancien étudiant, voisin, cousine…')} onChange={(e) => update({ link: e.target.value })} />
        </Field>
      </FieldGroup>
      <Tuto>
        <p>
          <b>{t(o.label)}</b>{t(' :')}{' '}
          {o.skills.length ? o.skills.map((s) => label(t, d, s)).join(', ') : t('8 compétences au choix')}
          {o.social && t(', 1 compétence sociale (Baratin, Charme, Intimidation ou Persuasion)')}
          {o.skills.length > 0 && free > 0 && t(', {n} au choix', { n: free })}.
        </p>
        {o.hint && <p>{t(o.hint)}</p>}
      </Tuto>
    </>
  )
}

// ------------------------------------------------------------------ 2. Characteristics

export function CharacteristicsStep({ draft: d, update }: StepProps) {
  const t = useT()
  const left = remaining(CHARACTERISTIC_ARRAY, placedCharacteristics(d))
  const setChar = (k: (typeof CHARACTERISTICS)[number], v: number | undefined) =>
    update((x) => ({ ...x, characteristics: { ...x.characteristics, [k]: v } }))

  return (
    <>
      <Tuto>
        <p><Rich text={t("Répartis les valeurs **40, 50, 50, 50, 60, 60, 70, 80** entre les huit caractéristiques, dans l'ordre qui te plaît. Chaque valeur est un pourcentage : 70 en FOR, c'est un personnage costaud.")} /></p>
        <p><Rich text={t('La **Chance** se tire aux dés : 3D6 × 5.')} /></p>
      </Tuto>
      {!d.rolled && <Pool label={t('Valeurs à placer')} values={left} done={t('toutes placées ✓')} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CHARACTERISTICS.map((k) => {
          const info = CHARACTERISTIC_INFO[k]
          const v = d.characteristics[k]
          return (
            <div key={k} className="flex flex-col gap-2 border bg-card p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold tracking-[0.12em]">{short(t, k)}</span>
                {v ? <span className="font-mono text-xs text-muted-foreground">½ {Math.floor(v / 2)} · ⅕ {Math.floor(v / 5)}</span> : null}
              </div>
              {d.rolled ? (
                <Input
                  type="number" min={15} max={90} aria-label={t(info.name)} value={v ?? ''} className="font-mono"
                  onChange={(e) => setChar(k, e.target.value ? Number(e.target.value) : undefined)}
                />
              ) : (
                <ValueSelect id={`c-${k}`} label={t(info.name)} value={v} pool={CHARACTERISTIC_ARRAY} left={left} onChange={(x) => setChar(k, x)} className="w-full" />
              )}
              <span className="text-xs text-muted-foreground">{t(info.name)} · {t(info.what)}</span>
            </div>
          )
        })}
        <div className="flex flex-col gap-2 border bg-card p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold tracking-[0.12em]">{t('Chance')}</span>
            <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">3D6 × 5</span>
          </div>
          <Input
            type="number" min={15} max={90} aria-label={t('Chance')} value={d.luck ?? ''} className="font-mono"
            onChange={(e) => update({ luck: e.target.value ? Number(e.target.value) : undefined })}
          />
          <span className="text-xs text-muted-foreground">{t('Pour les coups du sort.')}</span>
          <Button type="button" size="sm" onClick={() => update({ luck: rollLuck() })}>
            <Dices data-icon="inline-start" />
            {t('Lancer')}
          </Button>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">{t('Variante des règles complètes : tirer les caractéristiques aux dés')}</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="font-serif text-base">
            {t("Tirer 3D6 × 5, ou (2D6 + 6) × 5 pour TAI, INT et ÉDU. À n'utiliser que si le gardien est d'accord.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => update({ rolled: true, characteristics: Object.fromEntries(CHARACTERISTICS.map((k) => [k, rollCharacteristic(k)])) })}
            >
              <Dices data-icon="inline-start" />
              {d.rolled ? t('Relancer toutes les caractéristiques') : t('Tirer toutes les caractéristiques')}
            </Button>
            {d.rolled && (
              <Button type="button" variant="ghost" size="sm" onClick={() => update({ rolled: false, characteristics: {} })}>
                {t('Revenir à la répartition fixe')}
              </Button>
            )}
          </div>
        </div>
      </details>
    </>
  )
}

// ------------------------------------------------------------------ 3. Derived values

export function DerivedStep({ draft: d }: StepProps) {
  const t = useT()
  const v = derivedValues(d.characteristics)
  const strSiz = (d.characteristics.STR ?? 0) + (d.characteristics.SIZ ?? 0)
  return (
    <>
      <Tuto><p>{t('Calculées à partir des caractéristiques.')}</p></Tuto>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('Points de vie')} value={v.hp} how={t('(TAI + CON) ÷ 10')} />
        <Stat label={t('Santé mentale')} value={v.san} how={t('= POU')} />
        <Stat label={t('Points de magie')} value={v.mp} how={t('POU ÷ 5')} />
        <Stat label={t('Mouvement')} value={v.move} how={t('8 pour tous les humains')} />
        <Stat label={t('Impact')} value={damageBonusText(t, v.damageBonus)} how={t('FOR + TAI = {n}', { n: strSiz })} />
        <Stat label={t('Carrure')} value={v.build} how={t('FOR + TAI')} />
        <Stat label={t('Esquive')} value={v.dodge} how={t('DEX ÷ 2')} />
        <Stat label={t('Langue maternelle')} value={v.ownLanguage} how={t('= ÉDU')} />
      </div>
      <Table className="max-w-md">
        <TableHeader>
          <TableRow>
            <TableHead>{t('FOR + TAI')}</TableHead>
            <TableHead>{t('Impact')}</TableHead>
            <TableHead>{t('Carrure')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {DAMAGE_BONUS_TABLE.map(([max, db, build], i) => {
            const min = i === 0 ? 2 : DAMAGE_BONUS_TABLE[i - 1][0] + 1
            const on = strSiz >= min && strSiz <= max
            return (
              <TableRow key={db} data-state={on ? 'selected' : undefined}>
                <TableCell className="font-mono">{min}–{max === Infinity ? 204 : max}</TableCell>
                <TableCell>{damageBonusText(t, db)}</TableCell>
                <TableCell className="font-mono">{build}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </>
  )
}

// ------------------------------------------------------------------ 4. Occupation skills

function SpecialtyInput({ draft: d, update, id }: StepProps & { id: string }) {
  const t = useT()
  if (!SKILL_BY_ID.get(id)?.specialty) return null
  return (
    <Input
      aria-label={t('Spécialité de {skill}', { skill: skillName(t, id) })}
      placeholder={t('spécialité')}
      value={d.specialties[id] ?? ''}
      className="h-7 w-36 text-xs"
      onChange={(e) => update((x) => ({ ...x, specialties: { ...x.specialties, [id]: e.target.value } }))}
    />
  )
}

export function OccupationStep({ draft: d, update }: StepProps) {
  const t = useT()
  const o = occupationOf(d)
  const left = remaining(OCCUPATION_ARRAY, placedOccupationValues(d))
  const choices = occupationChoicesLeft(d)
  const needSocial = o.social && !hasSocialSkill(d)
  const available = SKILLS.filter((s) => !s.noCreation && !d.occupationSkills.includes(s.id))
  const setValue = (id: string, v: number | undefined) =>
    update((x) => {
      const occupationValues = { ...x.occupationValues }
      if (v === undefined) delete occupationValues[id]
      else occupationValues[id] = v
      return { ...x, occupationValues }
    })
  const remove = (id: string) =>
    update((x) => {
      const occupationValues = { ...x.occupationValues }
      delete occupationValues[id]
      return { ...x, occupationSkills: x.occupationSkills.filter((s) => s !== id), occupationValues }
    })
  const add = (id: string) =>
    update((x) =>
      x.occupationSkills.length >= 8 || x.occupationSkills.includes(id)
        ? x
        : { ...x, occupationSkills: [...x.occupationSkills, id], personalInterests: x.personalInterests.filter((s) => s !== id) },
    )

  return (
    <>
      <Tuto>
        <p><Rich text={t('Ton occupation donne **8 compétences**, plus le **Crédit**. Répartis entre ces 9 lignes : **70**, deux fois **60**, trois fois **50** et trois fois **40**. La valeur choisie remplace la valeur de base.')} /></p>
        {o.social && <p>{t('Choisis au moins une compétence sociale : Baratin, Charme, Intimidation ou Persuasion.')}</p>}
        {o.hint && <p>{t(o.hint)}</p>}
      </Tuto>
      <Pool label={t('Valeurs à placer')} values={left} done={t('toutes placées ✓')} extra={t('{n} / 8 compétences', { n: d.occupationSkills.length })} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Compétence')}</TableHead>
            <TableHead className="text-right">{t('Base')}</TableHead>
            <TableHead>{t('Valeur')}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.occupationSkills.map((id) => (
            <TableRow key={id}>
              <TableCell className="whitespace-normal">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gold">{label(t, d, id)}</span>
                  <SpecialtyInput draft={d} update={update} id={id} />
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">{baseValue(id, d.characteristics)}</TableCell>
              <TableCell>
                <ValueSelect id={`ov-${id}`} label={t('Valeur de {skill}', { skill: label(t, d, id) })} value={d.occupationValues[id]} pool={OCCUPATION_ARRAY} left={left} onChange={(v) => setValue(id, v)} className="w-20" />
              </TableCell>
              <TableCell className="text-right">
                {o.skills.includes(id) ? (
                  <span className="text-xs whitespace-nowrap text-muted-foreground">{t('imposée')}</span>
                ) : (
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={t('Retirer {name}', { name: label(t, d, id) })} onClick={() => remove(id)}>
                    <X />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="whitespace-normal">
              <span className="text-gold">{t('Crédit')}</span>
              {d.occupationValues['credit-rating'] !== undefined && (
                <span className="text-muted-foreground"> · {t(creditTier(d.occupationValues['credit-rating']))}</span>
              )}
            </TableCell>
            <TableCell className="text-right font-mono">0</TableCell>
            <TableCell>
              <ValueSelect id="ov-credit-rating" label={t('Valeur du Crédit')} value={d.occupationValues['credit-rating']} pool={OCCUPATION_ARRAY} left={left} onChange={(v) => setValue('credit-rating', v)} className="w-20" />
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
      {choices > 0 && (
        <NativeSelect
          aria-label={t('Compétence à ajouter')}
          value=""
          className="w-full"
          onChange={(e) => e.target.value && add(e.target.value)}
        >
          <NativeSelectOption value="">
            {needSocial
              ? t.n(choices, 'Ajouter la compétence sociale ou une compétence au choix ({n} restante)…', 'Ajouter la compétence sociale ou une compétence au choix ({n} restantes)…')
              : t.n(choices, 'Ajouter une compétence au choix ({n} restante)…', 'Ajouter une compétence au choix ({n} restantes)…')}
          </NativeSelectOption>
          {needSocial && (
            <NativeSelectOptGroup label={t('Sociales')}>
              {SOCIAL_SKILLS.filter((s) => !d.occupationSkills.includes(s)).map((s) => (
                <NativeSelectOption key={s} value={s}>{skillName(t, s)}</NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          )}
          <NativeSelectOptGroup label={t('Toutes')}>
            {available.map((s) => <NativeSelectOption key={s.id} value={s.id}>{skillName(t, s.id)}</NativeSelectOption>)}
          </NativeSelectOptGroup>
        </NativeSelect>
      )}
    </>
  )
}

// ------------------------------------------------------------------ 5. Personal interests

export function InterestsStep({ draft: d, update }: StepProps) {
  const t = useT()
  const n = d.personalInterests.length
  const candidates = SKILLS.filter((s) => !s.noCreation && !d.occupationSkills.includes(s.id))
  const toggle = (id: string, on: boolean) =>
    update((x) => ({
      ...x,
      personalInterests: on
        ? x.personalInterests.length < PERSONAL_INTEREST_COUNT ? [...x.personalInterests, id] : x.personalInterests
        : x.personalInterests.filter((s) => s !== id),
    }))

  return (
    <>
      <Tuto>
        <p><Rich text={t("Ce que ton personnage a appris en dehors de son travail : coche **4 compétences** qui ne sont pas des compétences d'occupation. Chacune gagne **+20** sur sa valeur de base.")} /></p>
        <p>{t('Pas de points en Mythe de Cthulhu : un investigateur débutant ignore tout du Mythe.')}</p>
      </Tuto>
      <Pool label={t('Choisies')} values={[]} done={`${n} / ${PERSONAL_INTEREST_COUNT}`} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Compétence')}</TableHead>
            <TableHead className="text-right">{t('Base')}</TableHead>
            <TableHead className="text-right">{t('Total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((s) => {
            const on = d.personalInterests.includes(s.id)
            return (
              <TableRow key={s.id} data-state={on ? 'selected' : undefined}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Checkbox
                      id={`pi-${s.id}`}
                      checked={on}
                      disabled={!on && n >= PERSONAL_INTEREST_COUNT}
                      onCheckedChange={(c) => toggle(s.id, c === true)}
                      aria-label={t('Intérêt personnel : {skill}', { skill: skillName(t, s.id) })}
                    />
                    <label htmlFor={`pi-${s.id}`} className={cn(on && 'text-gold')}>{label(t, d, s.id)}</label>
                    {on && <SpecialtyInput draft={d} update={update} id={s.id} />}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">{baseValue(s.id, d.characteristics)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{skillTotal(s.id, d)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </>
  )
}

// ------------------------------------------------------------------ 7. Summary

export function issueText(t: T, i: Issue): string {
  switch (i.code) {
    case 'name': return t('nom manquant')
    case 'characteristic': return t('{c} manquante', { c: short(t, i.key) })
    case 'luck': return t('Chance manquante')
    case 'occupationSkills': return t("{n} compétence(s) d'occupation à choisir", { n: i.missing })
    case 'socialSkill': return t('une compétence sociale manquante')
    case 'occupationValues': return t("valeurs d'occupation à placer : {list}", { list: i.left.join(', ') })
    case 'personalInterests': return t('{n} intérêt(s) personnel(s) à choisir', { n: i.missing })
  }
}

export function SummaryStep({ draft: d, goTo }: StepProps) {
  const t = useT()
  const playerName = useWizardHost().usePlayerName(d.playerId)
  const v = derivedValues(d.characteristics)
  const { issues, warnings } = checkDraft(d)
  const skills = [...d.occupationSkills, ...d.personalInterests]
    .map((id): [string, number] => [label(t, d, id), skillTotal(id, d)])
    .sort((a, b) => b[1] - a[1])
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="font-serif text-lg text-muted-foreground">
          {t(occupationOf(d).label)}, {t('{n} ans', { n: d.age })}{playerName && ` · ${t('joué par {name}', { name: playerName })}`}{d.link && ` · ${d.link}`}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
        {CHARACTERISTICS.map((k) => <Stat key={k} label={short(t, k)} value={d.characteristics[k] ?? '—'} />)}
        <Stat label={t('Chance')} value={d.luck ?? '—'} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Stat label={t('PV')} value={v.hp} />
        <Stat label="SAN" value={v.san} />
        <Stat label={t('PM')} value={v.mp} />
        <Stat label={t('Mvt')} value={v.move} />
        <Stat label={t('Impact · Carrure')} value={`${damageBonusText(t, v.damageBonus)} · ${v.build}`} />
        <Stat label={t('Esquive')} value={skillTotal('dodge', d)} />
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="eyebrow">{t('Compétences')}</h3>
        <p className="font-serif text-base leading-relaxed">
          {skills.length ? skills.map(([n, val]) => `${n} ${val}`).join(' · ') : t('Aucune pour l’instant.')}
          {' · '}{t('Crédit')} {skillTotal('credit-rating', d)} ({t(creditTier(skillTotal('credit-rating', d)))})
        </p>
      </section>
      {warnings.length > 0 && (
        <Tuto><p>{t('À vérifier : les caractéristiques ne reprennent pas exactement 40, 50, 50, 50, 60, 60, 70, 80.')}</p></Tuto>
      )}
      {issues.length > 0 ? (
        <Tuto>
          <p>{t("À compléter avant d'enregistrer :")}</p>
          <ul className="flex flex-col gap-1">
            {issues.map((i) => (
              <li key={issueText(t, i)}>
                <button type="button" className="text-left underline underline-offset-4 hover:text-gold" onClick={() => goTo?.(ISSUE_STEP[i.code])}>
                  {issueText(t, i)} → {t(STEP_TITLES[ISSUE_STEP[i.code]])}
                </button>
              </li>
            ))}
          </ul>
        </Tuto>
      ) : (
        <Tuto><p>{t('Tout est prêt. Enregistre le personnage : il apparaîtra dans la liste et pourra rejoindre une partie.')}</p></Tuto>
      )}
    </>
  )
}

const STEP_TITLES = ['Concept', 'Caractéristiques', 'Valeurs dérivées', "Compétences d'occupation", 'Intérêts personnels', 'Profil', 'Récapitulatif']

export const STEPS = [
  { title: STEP_TITLES[0], Component: ConceptStep },
  { title: STEP_TITLES[1], Component: CharacteristicsStep },
  { title: STEP_TITLES[2], Component: DerivedStep },
  { title: STEP_TITLES[3], Component: OccupationStep },
  { title: STEP_TITLES[4], Component: InterestsStep },
  { title: STEP_TITLES[5], Component: ProfileStep },
  { title: STEP_TITLES[6], Component: SummaryStep },
] as const

