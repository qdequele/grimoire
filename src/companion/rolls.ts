// Dice rolls from the players' phones: what is rolled, the server's answer, how it reads. Pure helpers,
// shared by the phone (roll dialog, Dés tab) and the keeper's game screen (a toast per roll).
import type { SuccessLevel } from '@/engine/dice'
import { skillName, type T } from '@/i18n/t'
import { CHARACTERISTIC_INFO, CHARACTERISTICS, type Characteristic } from '@/rules/d100'

/** What a d100 check is rolled against, as the server stores it (`game_rolls.subject`). */
export type RollSubject =
  | { kind: 'skill'; key: string }
  | { kind: 'char'; id: Characteristic }
  | { kind: 'san' }
  | { kind: 'luck' }
  /** The keeper's game screen names what it rolls in its own words ("Bibliothèque", "Chute"). */
  | { kind: 'label'; text: string }

export function subjectKey(s: RollSubject): string {
  switch (s.kind) {
    case 'skill': return `skill:${s.key}`
    case 'char': return `char:${s.id}`
    case 'label': return `label:${s.text}`
    default: return s.kind
  }
}

export function parseSubject(key: string): RollSubject | null {
  if (key === 'san' || key === 'luck') return { kind: key }
  if (key.startsWith('skill:') && key.length > 6) return { kind: 'skill', key: key.slice(6) }
  if (key.startsWith('label:') && key.length > 6) return { kind: 'label', text: key.slice(6) }
  const id = key.startsWith('char:') ? key.slice(5) : ''
  return (CHARACTERISTICS as readonly string[]).includes(id) ? { kind: 'char', id: id as Characteristic } : null
}

/** The subject's name in the current language: "Trouver Objet Caché", "Force", "SAN", "Chance". */
export function subjectName(t: T, key: string): string {
  const s = parseSubject(key)
  if (!s) return key
  switch (s.kind) {
    case 'skill': {
      const [id, specialty] = s.key.split(/:(.*)/)
      return skillName(t, id, specialty)
    }
    case 'char': return t(CHARACTERISTIC_INFO[s.id].name)
    case 'san': return t('SAN')
    case 'luck': return t('Chance')
    case 'label': return s.text
  }
}

/** Skill keys the server accepts (the app's own shape, see companion_clean_character). */
export const rollableSkillKey = (key: string) => key.length <= 84 && /^[a-z][a-z0-9-]*(:.+)?$/.test(key) && !/[<>&"]/.test(key)

/** What a roll cost the investigator, taken off by the roll itself (SAN lost, damage taken). */
export interface RollEffect {
  field: 'san' | 'pv'
  /** Negative: points lost. */
  delta: number
  from: number
  to: number
  /** The loss as announced ("1D6"), when it was rolled. */
  formula?: string
}

/** Who rolled: a player from their link, or the keeper's game screen for the investigator. */
export type RollSource = 'phone' | 'keeper'

export interface CheckRoll {
  id: string
  characterId: string
  kind: 'check'
  subject: string
  target: number
  /** Bonus dice (> 0) or penalty dice (< 0). */
  net: number
  /** Every tens die rolled (0..9); the kept one gives the result. */
  tens: number[]
  units: number
  result: number
  level: SuccessLevel
  createdAt: string
  /** Absent: a player's own roll. */
  source?: RollSource
  effect?: RollEffect
}

export interface DiceRoll {
  id: string
  characterId: string
  kind: 'dice'
  count: number
  sides: number
  modifier: number
  results: number[]
  result: number
  createdAt: string
  /** Absent: a player's own roll. */
  source?: RollSource
}

/** Damage the keeper rolled on an investigator: taken off their HP by the game screen. */
export interface DamageRoll {
  id: string
  characterId: string
  kind: 'damage'
  /** What hurt, `label:<text>`. */
  subject: string
  formula: string
  result: number
  createdAt: string
  /** Absent: a player's own roll. */
  source?: RollSource
  effect?: RollEffect
}

export type Roll = CheckRoll | DiceRoll
/** Every roll the table shows: the players' own, and the keeper's for investigators. */
export type TableRoll = Roll | DamageRoll

export const DICE_SIDES = [3, 4, 6, 8, 10, 12, 20, 100] as const
export const MAX_DICE = 10
export const MAX_MODIFIER = 20
export const MAX_NET = 2

const LEVELS: SuccessLevel[] = ['extreme', 'hard', 'regular', 'failure']
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)
const ints = (v: unknown): number[] | null =>
  Array.isArray(v) && v.every((x) => int(x) !== null) ? (v as number[]) : null

function asEffect(raw: unknown): RollEffect | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const e = raw as Record<string, unknown>
  const delta = int(e.delta), from = int(e.from), to = int(e.to)
  if ((e.field !== 'san' && e.field !== 'pv') || delta === null || from === null || to === null) return undefined
  return { field: e.field, delta, from, to, ...(typeof e.formula === 'string' && e.formula ? { formula: e.formula.slice(0, 20) } : {}) }
}

/**
 * A roll from the RPCs (camelCase) or a `game_rolls` row (snake_case), checked; null when it isn't one.
 * The game screen reads rows under its RLS; the phone reads the RPC's answer.
 */
export function asTableRoll(raw: unknown): TableRoll | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = r.id, characterId = r.characterId ?? r.character_id, createdAt = r.createdAt ?? r.created_at
  const dice = (r.dice && typeof r.dice === 'object' ? r.dice : {}) as Record<string, unknown>
  const result = int(r.result)
  if (typeof id !== 'string' || typeof characterId !== 'string' || typeof createdAt !== 'string' || result === null) return null
  const source: { source?: RollSource } = r.source === 'keeper' ? { source: 'keeper' } : {}
  const effect = asEffect(r.effect)
  if (r.kind === 'check') {
    const target = int(r.target), net = int(r.net), tens = ints(dice.tens), units = int(dice.units)
    const level = LEVELS.find((l) => l === r.level)
    if (typeof r.subject !== 'string' || target === null || net === null || !tens?.length || units === null || !level) return null
    return { id, characterId, kind: 'check', subject: r.subject, target, net, tens, units, result, level, createdAt, ...source, ...(effect ? { effect } : {}) }
  }
  if (r.kind === 'dice') {
    const count = int(dice.count), sides = int(dice.sides), modifier = int(dice.modifier), results = ints(dice.results)
    if (count === null || sides === null || modifier === null || !results) return null
    return { id, characterId, kind: 'dice', count, sides, modifier, results, result, createdAt, ...source }
  }
  if (r.kind === 'damage') {
    if (typeof r.subject !== 'string' || typeof dice.formula !== 'string') return null
    return { id, characterId, kind: 'damage', subject: r.subject, formula: dice.formula.slice(0, 40), result, createdAt, ...source, ...(effect ? { effect } : {}) }
  }
  return null
}

/** A player's roll (a d100 check or free dice); null for anything else, the keeper's damage included. */
export function asRoll(raw: unknown): Roll | null {
  const roll = asTableRoll(raw)
  return roll && roll.kind !== 'damage' ? roll : null
}

/** "2D6+1", "1D100", "1D4-1". */
export function diceFormula(r: Pick<DiceRoll, 'count' | 'sides' | 'modifier'>): string {
  const mod = r.modifier > 0 ? `+${r.modifier}` : r.modifier < 0 ? `${r.modifier}` : ''
  return `${r.count}D${r.sides}${mod}`
}

/** "4 + 3 + 1": every die, then the modifier. */
export function diceDetail(r: DiceRoll): string {
  const dice = r.results.join(' + ')
  return r.modifier > 0 ? `${dice} + ${r.modifier}` : r.modifier < 0 ? `${dice} − ${-r.modifier}` : dice
}

/** Index in `tens` of the die that gave the result (bonus keeps the lowest, penalty the highest). */
export function keptTens(r: CheckRoll): number {
  const value = (tens: number) => (tens === 0 && r.units === 0 ? 100 : tens * 10 + r.units)
  return r.tens.findIndex((d) => value(d) === r.result)
}

export const LEVEL_LABEL: Record<SuccessLevel, string> = {
  extreme: 'Réussite extrême',
  hard: 'Réussite majeure',
  regular: 'Réussite',
  failure: 'Échec',
}

/** "1 dé bonus", "2 dés de pénalité", or '' without any. */
export function netLabel(t: T, net: number): string {
  if (net > 0) return t.n(net, '{n} dé bonus', '{n} dés bonus')
  if (net < 0) return t.n(-net, '{n} dé de pénalité', '{n} dés de pénalité')
  return ''
}

/** "−4 SAN (54 → 50)", or "SAN : aucune perte" when the roll cost nothing. */
export function effectText(t: T, e: RollEffect): string {
  const stat = e.field === 'san' ? t('SAN') : t('PV')
  if (e.delta === 0) return t('{stat} : aucune perte', { stat })
  return t('{delta} {stat} ({from} → {to})', { delta: e.delta > 0 ? `+${e.delta}` : `−${-e.delta}`, stat, from: e.from, to: e.to })
}

/** A title and a line for one roll of an investigator: the keeper's toast, the table's list of rolls. */
export function rollMessage(t: T, r: TableRoll, name: string): { title: string; text: string } {
  if (r.kind === 'damage') {
    return {
      title: t('{name} · {subject}', { name, subject: subjectName(t, r.subject) }),
      text: `${t('{formula} = {n} dégâts', { formula: r.formula, n: r.result })}${r.effect ? ` · ${effectText(t, r.effect)}` : ''}`,
    }
  }
  if (r.kind === 'dice') {
    return {
      title: t('{name} lance {dice}', { name, dice: diceFormula(r) }),
      text: r.results.length > 1 || r.modifier ? `${r.result} (${diceDetail(r)})` : String(r.result),
    }
  }
  const extra = netLabel(t, r.net)
  return {
    title: t('{name} · {subject} ({target})', { name, subject: subjectName(t, r.subject), target: r.target }),
    text: `${r.result} — ${t(LEVEL_LABEL[r.level])}${extra ? ` · ${extra}` : ''}${r.effect ? ` · ${effectText(t, r.effect)}` : ''}`,
  }
}

/**
 * The roll as a line of the game screen's Journal, and its filter there: free dice under Dés, SAN
 * under Santé mentale, every other check under Tests (where the engine puts its own skill tests).
 */
export function rollJournal(t: T, r: Roll, name: string): { text: string; kind: 'de' | 'test' | 'san' } {
  const { title, text } = rollMessage(t, r, name)
  const kind = r.kind === 'dice' ? 'de' : r.subject === 'san' ? 'san' : 'test'
  return { text: t('{label} : {detail}', { label: title, detail: text }), kind }
}
