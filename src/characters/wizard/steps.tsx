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
  skillLabel,
} from '@/rules/d100'
import { Pool, Stat, Tuto, ValueSelect } from './parts'
import { ProfileStep } from './ProfileStep'

export interface StepProps {
  draft: CreationDraft
  update: (patch: Partial<CreationDraft> | ((d: CreationDraft) => CreationDraft)) => void
  goTo?: (step: number) => void
}

const label = (d: CreationDraft, id: string) => skillLabel(id, d.specialties[id])
const damageBonusText = (db: string) => (db === '0' ? 'aucun' : db.replace('-', '−'))

// ------------------------------------------------------------------ 1. Concept

export function ConceptStep({ draft: d, update }: StepProps) {
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
        <p>
          Un investigateur est une personne ordinaire des années 1920 : pense d'abord à la façon dont il gagne sa vie.
        </p>
        <p>Les occupations conseillées sont dans la liste. Tu peux aussi en inventer une, avec l'accord du gardien.</p>
      </Tuto>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
          <Field>
            <FieldLabel htmlFor="w-name">Nom</FieldLabel>
            <Input id="w-name" value={d.name} placeholder="Ex. Ada Whitcombe" onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="w-occ">Occupation</FieldLabel>
            <NativeSelect id="w-occ" value={d.occupation} onChange={(e) => update((x) => applyOccupation(x, e.target.value))}>
              {OCCUPATIONS.map((x) => <NativeSelectOption key={x.id} value={x.id}>{x.label}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="w-age">Âge</FieldLabel>
            <Input id="w-age" type="number" min={15} max={89} value={d.age} onChange={(e) => update({ age: Number(e.target.value) || 0 })} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="Genre du nom" size="sm" value={gender} onChange={(e) => setGender(e.target.value as NameGender)}>
            <NativeSelectOption value="any">Au hasard</NativeSelectOption>
            <NativeSelectOption value="f">Femme</NativeSelectOption>
            <NativeSelectOption value="m">Homme</NativeSelectOption>
          </NativeSelect>
          <NativeSelect aria-label="Origine du nom" size="sm" value={origin} onChange={(e) => setOrigin(e.target.value)}>
            {Object.entries(NAME_ORIGINS).map(([k, v]) => <NativeSelectOption key={k} value={k}>{v.label}</NativeSelectOption>)}
          </NativeSelect>
          <Button type="button" variant="outline" size="sm" onClick={generate}>Générer un nom</Button>
        </div>
        {ideas.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Idées de noms">
            {ideas.map((n) => (
              <Button key={n} type="button" variant={n === d.name ? 'secondary' : 'ghost'} size="sm" onClick={() => update({ name: n })}>
                {n}
              </Button>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="w-player">Joueur</FieldLabel>
            <Input id="w-player" value={d.player} placeholder="Qui l'incarne" onChange={(e) => update({ player: e.target.value })} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="w-link">Lien avec l'histoire</FieldLabel>
          <Textarea id="w-link" value={d.link} placeholder="Ancien étudiant, voisin, cousine…" onChange={(e) => update({ link: e.target.value })} />
        </Field>
      </FieldGroup>
      <Tuto>
        <p>
          <b>{o.label}</b> :{' '}
          {o.skills.length ? o.skills.map((s) => label(d, s)).join(', ') : '8 compétences au choix'}
          {o.social && ', 1 compétence sociale (Baratin, Charme, Intimidation ou Persuasion)'}
          {o.skills.length > 0 && free > 0 && `, ${free} au choix`}.
        </p>
        {o.hint && <p>{o.hint}</p>}
      </Tuto>
    </>
  )
}

// ------------------------------------------------------------------ 2. Characteristics

export function CharacteristicsStep({ draft: d, update }: StepProps) {
  const left = remaining(CHARACTERISTIC_ARRAY, placedCharacteristics(d))
  const setChar = (k: (typeof CHARACTERISTICS)[number], v: number | undefined) =>
    update((x) => ({ ...x, characteristics: { ...x.characteristics, [k]: v } }))

  return (
    <>
      <Tuto>
        <p>
          Répartis les valeurs <b>40, 50, 50, 50, 60, 60, 70, 80</b> entre les huit caractéristiques, dans l'ordre qui te
          plaît. Chaque valeur est un pourcentage : 70 en FOR, c'est un personnage costaud.
        </p>
        <p>La <b>Chance</b> se tire aux dés : 3D6 × 5.</p>
      </Tuto>
      {!d.rolled && <Pool label="Valeurs à placer" values={left} done="toutes placées ✓" />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CHARACTERISTICS.map((k) => {
          const info = CHARACTERISTIC_INFO[k]
          const v = d.characteristics[k]
          return (
            <div key={k} className="flex flex-col gap-2 border bg-card p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold tracking-[0.12em]">{info.short}</span>
                {v ? <span className="font-mono text-xs text-muted-foreground">½ {Math.floor(v / 2)} · ⅕ {Math.floor(v / 5)}</span> : null}
              </div>
              {d.rolled ? (
                <Input
                  type="number" min={15} max={90} aria-label={info.name} value={v ?? ''} className="font-mono"
                  onChange={(e) => setChar(k, e.target.value ? Number(e.target.value) : undefined)}
                />
              ) : (
                <ValueSelect id={`c-${k}`} label={info.name} value={v} pool={CHARACTERISTIC_ARRAY} left={left} onChange={(x) => setChar(k, x)} className="w-full" />
              )}
              <span className="text-xs text-muted-foreground">{info.name} · {info.what}</span>
            </div>
          )
        })}
        <div className="flex flex-col gap-2 border bg-card p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold tracking-[0.12em]">Chance</span>
            <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">3D6 × 5</span>
          </div>
          <Input
            type="number" min={15} max={90} aria-label="Chance" value={d.luck ?? ''} className="font-mono"
            onChange={(e) => update({ luck: e.target.value ? Number(e.target.value) : undefined })}
          />
          <span className="text-xs text-muted-foreground">Pour les coups du sort.</span>
          <Button type="button" size="sm" onClick={() => update({ luck: rollLuck() })}>
            <Dices data-icon="inline-start" />
            Lancer
          </Button>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Variante des règles complètes : tirer les caractéristiques aux dés</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="font-serif text-base">
            Tirer 3D6 × 5, ou (2D6 + 6) × 5 pour TAI, INT et ÉDU. À n'utiliser que si le gardien est d'accord.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => update({ rolled: true, characteristics: Object.fromEntries(CHARACTERISTICS.map((k) => [k, rollCharacteristic(k)])) })}
            >
              <Dices data-icon="inline-start" />
              {d.rolled ? 'Relancer' : 'Tirer'} toutes les caractéristiques
            </Button>
            {d.rolled && (
              <Button type="button" variant="ghost" size="sm" onClick={() => update({ rolled: false, characteristics: {} })}>
                Revenir à la répartition fixe
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
  const v = derivedValues(d.characteristics)
  const strSiz = (d.characteristics.STR ?? 0) + (d.characteristics.SIZ ?? 0)
  return (
    <>
      <Tuto><p>Calculées à partir des caractéristiques.</p></Tuto>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Points de vie" value={v.hp} how="(TAI + CON) ÷ 10" />
        <Stat label="Santé mentale" value={v.san} how="= POU" />
        <Stat label="Points de magie" value={v.mp} how="POU ÷ 5" />
        <Stat label="Mouvement" value={v.move} how="8 pour tous les humains" />
        <Stat label="Impact" value={damageBonusText(v.damageBonus)} how={`FOR + TAI = ${strSiz}`} />
        <Stat label="Carrure" value={v.build} how="FOR + TAI" />
        <Stat label="Esquive" value={v.dodge} how="DEX ÷ 2" />
        <Stat label="Langue maternelle" value={v.ownLanguage} how="= ÉDU" />
      </div>
      <Table className="max-w-md">
        <TableHeader>
          <TableRow>
            <TableHead>FOR + TAI</TableHead>
            <TableHead>Impact</TableHead>
            <TableHead>Carrure</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {DAMAGE_BONUS_TABLE.map(([max, db, build], i) => {
            const min = i === 0 ? 2 : DAMAGE_BONUS_TABLE[i - 1][0] + 1
            const on = strSiz >= min && strSiz <= max
            return (
              <TableRow key={db} data-state={on ? 'selected' : undefined}>
                <TableCell className="font-mono">{min}–{max === Infinity ? 204 : max}</TableCell>
                <TableCell>{damageBonusText(db)}</TableCell>
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
  if (!SKILL_BY_ID.get(id)?.specialty) return null
  return (
    <Input
      aria-label={`Spécialité de ${skillLabel(id)}`}
      placeholder="spécialité"
      value={d.specialties[id] ?? ''}
      className="h-7 w-36 text-xs"
      onChange={(e) => update((x) => ({ ...x, specialties: { ...x.specialties, [id]: e.target.value } }))}
    />
  )
}

export function OccupationStep({ draft: d, update }: StepProps) {
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
        <p>
          Ton occupation donne <b>8 compétences</b>, plus le <b>Crédit</b>. Répartis entre ces 9 lignes : <b>70</b>, deux fois{' '}
          <b>60</b>, trois fois <b>50</b> et trois fois <b>40</b>. La valeur choisie remplace la valeur de base.
        </p>
        {o.social && <p>Choisis au moins une compétence sociale : Baratin, Charme, Intimidation ou Persuasion.</p>}
        {o.hint && <p>{o.hint}</p>}
      </Tuto>
      <Pool label="Valeurs à placer" values={left} done="toutes placées ✓" extra={`${d.occupationSkills.length} / 8 compétences`} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Compétence</TableHead>
            <TableHead className="text-right">Base</TableHead>
            <TableHead>Valeur</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {d.occupationSkills.map((id) => (
            <TableRow key={id}>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gold">{label(d, id)}</span>
                  <SpecialtyInput draft={d} update={update} id={id} />
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">{baseValue(id, d.characteristics)}</TableCell>
              <TableCell>
                <ValueSelect id={`ov-${id}`} label={`Valeur de ${label(d, id)}`} value={d.occupationValues[id]} pool={OCCUPATION_ARRAY} left={left} onChange={(v) => setValue(id, v)} />
              </TableCell>
              <TableCell className="text-right">
                {o.skills.includes(id) ? (
                  <span className="text-xs text-muted-foreground">imposée</span>
                ) : (
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Retirer ${label(d, id)}`} onClick={() => remove(id)}>
                    <X />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>
              <span className="text-gold">Crédit</span>
              {d.occupationValues['credit-rating'] !== undefined && (
                <span className="text-muted-foreground"> · {creditTier(d.occupationValues['credit-rating'])}</span>
              )}
            </TableCell>
            <TableCell className="text-right font-mono">0</TableCell>
            <TableCell>
              <ValueSelect id="ov-credit-rating" label="Valeur du Crédit" value={d.occupationValues['credit-rating']} pool={OCCUPATION_ARRAY} left={left} onChange={(v) => setValue('credit-rating', v)} />
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
      {choices > 0 && (
        <NativeSelect
          aria-label="Compétence à ajouter"
          value=""
          className="w-full"
          onChange={(e) => e.target.value && add(e.target.value)}
        >
          <NativeSelectOption value="">
            Ajouter {needSocial ? 'la compétence sociale ou ' : ''}une compétence au choix ({choices} restante{choices > 1 ? 's' : ''})…
          </NativeSelectOption>
          {needSocial && (
            <NativeSelectOptGroup label="Sociales">
              {SOCIAL_SKILLS.filter((s) => !d.occupationSkills.includes(s)).map((s) => (
                <NativeSelectOption key={s} value={s}>{skillLabel(s)}</NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          )}
          <NativeSelectOptGroup label="Toutes">
            {available.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.label}</NativeSelectOption>)}
          </NativeSelectOptGroup>
        </NativeSelect>
      )}
    </>
  )
}

// ------------------------------------------------------------------ 5. Personal interests

export function InterestsStep({ draft: d, update }: StepProps) {
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
        <p>
          Ce que ton personnage a appris en dehors de son travail : coche <b>4 compétences</b> qui ne sont pas des
          compétences d'occupation. Chacune gagne <b>+20</b> sur sa valeur de base.
        </p>
        <p>Pas de points en Mythe de Cthulhu : un investigateur débutant ignore tout du Mythe.</p>
      </Tuto>
      <Pool label="Choisies" values={[]} done={`${n} / ${PERSONAL_INTEREST_COUNT}`} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Compétence</TableHead>
            <TableHead className="text-right">Base</TableHead>
            <TableHead className="text-right">Total</TableHead>
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
                      aria-label={`Intérêt personnel : ${s.label}`}
                    />
                    <label htmlFor={`pi-${s.id}`} className={cn(on && 'text-gold')}>{label(d, s.id)}</label>
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

export function issueText(i: Issue): string {
  switch (i.code) {
    case 'name': return 'nom manquant'
    case 'characteristic': return `${CHARACTERISTIC_INFO[i.key].short} manquante`
    case 'luck': return 'Chance manquante'
    case 'occupationSkills': return `${i.missing} compétence(s) d'occupation à choisir`
    case 'socialSkill': return 'une compétence sociale manquante'
    case 'occupationValues': return `valeurs d'occupation à placer : ${i.left.join(', ')}`
    case 'personalInterests': return `${i.missing} intérêt(s) personnel(s) à choisir`
  }
}

export function SummaryStep({ draft: d, goTo }: StepProps) {
  const v = derivedValues(d.characteristics)
  const { issues, warnings } = checkDraft(d)
  const skills = [...d.occupationSkills, ...d.personalInterests]
    .map((id): [string, number] => [label(d, id), skillTotal(id, d)])
    .sort((a, b) => b[1] - a[1])
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="font-serif text-lg text-muted-foreground">
          {occupationOf(d).label}, {d.age} ans{d.player && ` · joué par ${d.player}`}{d.link && ` · ${d.link}`}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
        {CHARACTERISTICS.map((k) => <Stat key={k} label={CHARACTERISTIC_INFO[k].short} value={d.characteristics[k] ?? '—'} />)}
        <Stat label="Chance" value={d.luck ?? '—'} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Stat label="PV" value={v.hp} />
        <Stat label="SAN" value={v.san} />
        <Stat label="PM" value={v.mp} />
        <Stat label="Mvt" value={v.move} />
        <Stat label="Impact · Carrure" value={`${damageBonusText(v.damageBonus)} · ${v.build}`} />
        <Stat label="Esquive" value={skillTotal('dodge', d)} />
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="eyebrow">Compétences</h3>
        <p className="font-serif text-base leading-relaxed">
          {skills.length ? skills.map(([n, val]) => `${n} ${val}`).join(' · ') : 'Aucune pour l’instant.'}
          {' · '}Crédit {skillTotal('credit-rating', d)} ({creditTier(skillTotal('credit-rating', d))})
        </p>
      </section>
      {warnings.length > 0 && (
        <Tuto><p>À vérifier : les caractéristiques ne reprennent pas exactement 40, 50, 50, 50, 60, 60, 70, 80.</p></Tuto>
      )}
      {issues.length > 0 ? (
        <Tuto>
          <p>À compléter avant d'enregistrer :</p>
          <ul className="flex flex-col gap-1">
            {issues.map((i) => (
              <li key={issueText(i)}>
                <button type="button" className="text-left underline underline-offset-4 hover:text-gold" onClick={() => goTo?.(ISSUE_STEP[i.code])}>
                  {issueText(i)} → {STEP_TITLES[ISSUE_STEP[i.code]]}
                </button>
              </li>
            ))}
          </ul>
        </Tuto>
      ) : (
        <Tuto><p>Tout est prêt. Enregistre le personnage : il apparaîtra dans la liste et pourra rejoindre une partie.</p></Tuto>
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

