// Investigator creation, ported from the legacy wizard. Pure functions over a CreationDraft.
import {
  CHARACTERISTIC_ARRAY,
  CHARACTERISTIC_INFO,
  CHARACTERISTICS,
  NAME_ORIGINS,
  OCCUPATION_ARRAY,
  OCCUPATION_BY_ID,
  OCCUPATION_SKILL_COUNT,
  OCCUPATIONS,
  PERSONAL_INTEREST_BONUS,
  PERSONAL_INTEREST_COUNT,
  SKILL_BY_ID,
  SOCIAL_SKILLS,
  type Characteristic,
  type Occupation,
  type ProfileField,
} from '@/rules/d100'
import { rollFormula } from './dice'
import { defaultRng, type Rng } from './random'

export interface CreationDraft {
  name: string
  occupation: string
  age: number
  player: string
  /** Link with the story or the other investigators. */
  link: string
  /** undefined = not placed yet. */
  characteristics: Partial<Record<Characteristic, number>>
  luck?: number
  /** Characteristics rolled with dice instead of placing the fixed values. */
  rolled: boolean
  /** The occupation's 8 skills (occupation defaults + choices). */
  occupationSkills: string[]
  /** Value placed on each occupation skill, and on credit-rating. */
  occupationValues: Record<string, number>
  personalInterests: string[]
  specialties: Record<string, string>
  profile: Partial<Record<ProfileField, string>>
}

export function newDraft(occupationId = 'journalist'): CreationDraft {
  return applyOccupation(
    {
      name: '', occupation: occupationId, age: 25, player: '', link: '',
      characteristics: {}, rolled: false,
      occupationSkills: [], occupationValues: {}, personalInterests: [], specialties: {}, profile: {},
    },
    occupationId,
  )
}

export const occupationOf = (d: CreationDraft): Occupation => OCCUPATION_BY_ID.get(d.occupation) ?? OCCUPATIONS.at(-1)!

/** Switching occupation resets the occupation skills to its defaults (as in the legacy wizard). */
export function applyOccupation(d: CreationDraft, occupationId: string): CreationDraft {
  const o = OCCUPATION_BY_ID.get(occupationId) ?? OCCUPATIONS.at(-1)!
  return {
    ...d,
    occupation: o.id,
    occupationSkills: [...o.skills],
    occupationValues: {},
    specialties: { ...(o.specialties ?? {}) },
    personalInterests: d.personalInterests.filter((s) => !o.skills.includes(s)),
  }
}

// ------------------------------------------------------------------ derived values

export interface Derived {
  hp: number
  san: number
  mp: number
  move: number
  damageBonus: string
  build: number
  dodge: number
  ownLanguage: number
}

/** STR + SIZ → damage bonus and build. */
export const DAMAGE_BONUS_TABLE: Array<[max: number, damageBonus: string, build: number]> = [
  [64, '-2', -2],
  [84, '-1', -1],
  [124, '0', 0],
  [164, '+1D4', 1],
  [Infinity, '+1D6', 2],
]

export function derivedValues(c: Partial<Record<Characteristic, number>>): Derived {
  const v = (k: Characteristic) => c[k] ?? 0
  const [, damageBonus, build] = DAMAGE_BONUS_TABLE.find(([max]) => v('STR') + v('SIZ') <= max)!
  return {
    hp: Math.floor((v('CON') + v('SIZ')) / 10),
    san: v('POW'),
    mp: Math.floor(v('POW') / 5),
    move: 8,
    damageBonus,
    build,
    dodge: Math.floor(v('DEX') / 2),
    ownLanguage: v('EDU'),
  }
}

// ------------------------------------------------------------------ value pools

/** What's left of a fixed value pool once `used` values are placed. */
export function remaining(pool: number[], used: number[]): number[] {
  const left = [...pool]
  for (const v of used) {
    const i = left.indexOf(v)
    if (i >= 0) left.splice(i, 1)
  }
  return left
}

export const placedCharacteristics = (d: CreationDraft) =>
  CHARACTERISTICS.map((k) => d.characteristics[k]).filter((v): v is number => v !== undefined)

export const placedOccupationValues = (d: CreationDraft) =>
  [...d.occupationSkills, 'credit-rating'].map((s) => d.occupationValues[s]).filter((v): v is number => v !== undefined)

export function rollCharacteristic(k: Characteristic, rng: Rng = defaultRng): number {
  return rollFormula(CHARACTERISTIC_INFO[k].dice, rng)!.total * 5
}

export const rollLuck = (rng: Rng = defaultRng) => rollFormula('3D6', rng)!.total * 5

// ------------------------------------------------------------------ skills

export function baseValue(skillId: string, c: Partial<Record<Characteristic, number>>): number {
  const base = SKILL_BY_ID.get(skillId)?.base ?? 0
  if (base === 'DEX/2') return derivedValues(c).dodge
  if (base === 'EDU') return derivedValues(c).ownLanguage
  return base
}

/** Final value: the placed occupation value replaces the base; a personal interest adds +20. */
export function skillTotal(skillId: string, d: CreationDraft): number {
  const placed = d.occupationValues[skillId]
  if (placed !== undefined && (d.occupationSkills.includes(skillId) || skillId === 'credit-rating')) return placed
  const base = baseValue(skillId, d.characteristics)
  return d.personalInterests.includes(skillId) ? base + PERSONAL_INTEREST_BONUS : base
}

/** Occupation skills still to choose (beyond the occupation's own list). */
export const occupationChoicesLeft = (d: CreationDraft) => OCCUPATION_SKILL_COUNT - d.occupationSkills.length

export const hasSocialSkill = (d: CreationDraft) => d.occupationSkills.some((s) => SOCIAL_SKILLS.includes(s))

// ------------------------------------------------------------------ checks

export type Issue =
  | { code: 'name' }
  | { code: 'characteristic'; key: Characteristic }
  | { code: 'luck' }
  | { code: 'occupationSkills'; missing: number }
  | { code: 'socialSkill' }
  | { code: 'occupationValues'; left: number[] }
  | { code: 'personalInterests'; missing: number }

export type Warning = { code: 'characteristicArray' }

/** What blocks saving, and what only deserves a second look. */
export function checkDraft(d: CreationDraft): { issues: Issue[]; warnings: Warning[] } {
  const issues: Issue[] = []
  const warnings: Warning[] = []
  if (!d.name.trim()) issues.push({ code: 'name' })
  for (const k of CHARACTERISTICS) if (!d.characteristics[k]) issues.push({ code: 'characteristic', key: k })
  if (!d.luck) issues.push({ code: 'luck' })
  const allPlaced = CHARACTERISTICS.every((k) => d.characteristics[k])
  if (!d.rolled && allPlaced && remaining(CHARACTERISTIC_ARRAY, placedCharacteristics(d)).length) {
    warnings.push({ code: 'characteristicArray' })
  }
  if (occupationChoicesLeft(d) > 0) issues.push({ code: 'occupationSkills', missing: occupationChoicesLeft(d) })
  if (occupationOf(d).social && !hasSocialSkill(d)) issues.push({ code: 'socialSkill' })
  const left = remaining(OCCUPATION_ARRAY, placedOccupationValues(d))
  if (left.length) issues.push({ code: 'occupationValues', left })
  if (d.personalInterests.length < PERSONAL_INTEREST_COUNT) {
    issues.push({ code: 'personalInterests', missing: PERSONAL_INTEREST_COUNT - d.personalInterests.length })
  }
  return { issues, warnings }
}

/** Skills on the finished sheet: occupation + interests, dodge always, sorted by value. Keys are skill ids, with ":specialty" when there is one. */
export function finalSkills(d: CreationDraft): Record<string, number> {
  const ids = [...new Set([...d.occupationSkills, ...d.personalInterests, 'dodge', 'credit-rating'])]
  const entries = ids.map((id): [string, number] => [d.specialties[id] ? `${id}:${d.specialties[id]}` : id, skillTotal(id, d)])
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]))
}

// ------------------------------------------------------------------ names

export type NameGender = 'f' | 'm' | 'any'

/** Six distinct name ideas, "First [M.] Surname", as the legacy generator did. */
export function generateNames(origin: string, gender: NameGender, rng: Rng = defaultRng, count = 6): string[] {
  const o = NAME_ORIGINS[origin] ?? NAME_ORIGINS.ne
  const pick = (list: string[]) => list[Math.floor(rng() * list.length)]
  const out = new Set<string>()
  for (let guard = 0; out.size < count && guard < count * 50; guard++) {
    const g = gender === 'any' ? (rng() < 0.5 ? 'f' : 'm') : gender
    const middle = rng() < 0.35 ? ` ${pick(o[g]).charAt(0)}.` : ''
    out.add(`${pick(o[g])}${middle} ${pick(o.surnames)}`)
  }
  return [...out]
}

/** Wizard step (0-based) where each kind of issue is fixed. */
export const ISSUE_STEP: Record<Issue['code'], number> = {
  name: 0,
  characteristic: 1,
  luck: 1,
  occupationSkills: 3,
  socialSkill: 3,
  occupationValues: 3,
  personalInterests: 4,
}
