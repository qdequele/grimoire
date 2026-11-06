// What the player's phone shows of an investigator: pure helpers, no UI.
import { hasMarkup, SHEET_LIMITS, skillKeyLabel, type CharacterData } from '@/characters/character'
import type { ProfileField } from '@/rules/d100'
import type { Points } from '@/play/companion'

export interface SkillRow {
  /** Skill id, with ":specialty" when there is one. */
  key: string
  /** French label, as the game engine names the skill. */
  label: string
  value: number
  hard: number
  extreme: number
  /** Ticked in play (a success that may improve the skill). */
  checked: boolean
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * The sheet's skills, sorted by label. A value improved in play (`progress.skills`, keyed by label)
 * replaces the sheet's. Checked: in the investigator's progression or ticked live in this game
 * (`liveChecks`, the engine's skill labels).
 */
export function skillRows(data: CharacterData, liveChecks: string[] = []): SkillRow[] {
  const progress = (data.progress ?? {}) as { skills?: unknown; checks?: unknown }
  const improved = progress.skills && typeof progress.skills === 'object' ? (progress.skills as Record<string, unknown>) : {}
  const checks = new Set([...strings(progress.checks), ...liveChecks])
  return Object.entries(data.skills ?? {})
    .filter((e): e is [string, number] => typeof e[1] === 'number')
    .map(([key, base]) => {
      const label = skillKeyLabel(key)
      const value = typeof improved[label] === 'number' ? (improved[label] as number) : base
      return { key, label, value, hard: Math.floor(value / 2), extreme: Math.floor(value / 5), checked: checks.has(label) }
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}

const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)))

/** Points the server accepts: HP within 0..maxHp, the others within 0..99. */
export function clampPoints(p: Points, maxHp: number): Points {
  return { pv: clamp(p.pv, maxHp), san: clamp(p.san, 99), chance: clamp(p.chance, 99), pm: clamp(p.pm, 99) }
}

/**
 * The wizard's sheet as companion_create_character accepts it: skills within 0..99 (a personal
 * interest can push a skill past 99), age within 0..150.
 */
export function companionSheet(data: CharacterData): CharacterData {
  return {
    ...data,
    ...(data.age === undefined ? {} : { age: Math.min(150, Math.max(0, Math.round(data.age))) }),
    skills: Object.fromEntries(Object.entries(data.skills ?? {}).map(([k, v]) => [k, clamp(v, 99)])),
  }
}

/** A sheet field the server would refuse: too long, or holding characters that build HTML. */
export type SheetProblem =
  | { field: 'name' | 'occupation' | 'link' | 'playerName'; reason: 'tooLong'; max: number }
  | { field: 'name' | 'playerName'; reason: 'markup' }
  | { field: 'profile'; id: ProfileField; reason: 'tooLong'; max: number }
  | { field: 'skill'; key: string; reason: 'tooLong'; max: number }
  | { field: 'skill'; key: string; reason: 'markup' }

/**
 * What companion_create_character would refuse in this sheet (the `companionSheet` version) and first
 * name, so the phone can say which field instead of "a value was refused". Same limits as the server.
 */
export function companionSheetProblems(data: CharacterData, playerName: string): SheetProblem[] {
  const out: SheetProblem[] = []
  const name = data.name.trim()
  if (name.length > SHEET_LIMITS.name) out.push({ field: 'name', reason: 'tooLong', max: SHEET_LIMITS.name })
  if (hasMarkup(name)) out.push({ field: 'name', reason: 'markup' })
  if ((data.occupation ?? '').length > SHEET_LIMITS.occupation) out.push({ field: 'occupation', reason: 'tooLong', max: SHEET_LIMITS.occupation })
  if ((data.link ?? '').length > SHEET_LIMITS.link) out.push({ field: 'link', reason: 'tooLong', max: SHEET_LIMITS.link })
  for (const [id, text] of Object.entries(data.profile ?? {}) as Array<[ProfileField, string | undefined]>) {
    if ((text ?? '').length > SHEET_LIMITS.profile) out.push({ field: 'profile', id, reason: 'tooLong', max: SHEET_LIMITS.profile })
  }
  for (const key of Object.keys(data.skills ?? {})) {
    if (key.length > SHEET_LIMITS.skillKey) out.push({ field: 'skill', key, reason: 'tooLong', max: SHEET_LIMITS.skillKey })
    if (hasMarkup(key)) out.push({ field: 'skill', key, reason: 'markup' })
  }
  const player = playerName.trim()
  if (player.length > SHEET_LIMITS.playerName) out.push({ field: 'playerName', reason: 'tooLong', max: SHEET_LIMITS.playerName })
  if (hasMarkup(player)) out.push({ field: 'playerName', reason: 'markup' })
  return out
}
