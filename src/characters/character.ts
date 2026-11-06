import type { CreationDraft } from '@/engine/creation'
import { skillLabel, type Characteristic, type ProfileField } from '@/rules/d100'

/** Investigator data stored in characters.data. */
export interface CharacterData {
  name: string
  /** Occupation label as shown on the sheet. */
  occupation?: string
  age?: number
  link?: string
  characteristics: Partial<Record<Characteristic, number>>
  hp?: number
  mp?: number
  san?: number
  luck?: number
  move?: number
  build?: number
  damageBonus?: string
  /** Skill id (with ":specialty" when there is one) → value. */
  skills: Record<string, number>
  profile?: Partial<Record<ProfileField, string>>
  /** The creation wizard's state, so editing reopens it as it was. */
  creation?: CreationDraft
  /**
   * Progression from play, carried from one story to the next: the game engine's per-investigator
   * record (improved skills, checked skills, history, current SAN, characteristics typed in play).
   */
  progress?: Record<string, unknown>
}

/**
 * Text limits of a sheet, in characters. They are the database's for a sheet made on a phone
 * (companion_clean_character, companion_create_character); the wizard applies them everywhere.
 * A specialty of 40 keeps any skill key ("id:specialty") within the server's 80.
 */
export const SHEET_LIMITS = { name: 80, occupation: 200, link: 200, profile: 2000, skillKey: 80, specialty: 40, playerName: 80 } as const

/**
 * Characters a phone may not put in a name, a skill or a first name: they build HTML on the keeper's
 * game screen (the database refuses them too).
 */
export const hasMarkup = (s: string): boolean => /[<>&"]/.test(s)

/** "art-craft:Photographie" → "Arts et métiers (Photographie)". */
export function skillKeyLabel(key: string): string {
  const [id, specialty] = key.split(/:(.*)/)
  return skillLabel(id, specialty)
}

/** What play has changed on an investigator, read from the game engine's progression record. */
export interface ProgressSummary {
  /** Current SAN, when play changed it. */
  san?: number
  /** Skills whose value changed in play (improvement phase), label → value. */
  improved: Array<[string, number]>
  /** Skills ticked during play, waiting for the improvement phase. */
  checks: string[]
  /** Stories played to the end. */
  gamesPlayed: number
  /** Most recent first. */
  history: Array<{ at: number; text: string }>
}

export function progressSummary(c: CharacterData): ProgressSummary {
  const p = (c.progress ?? {}) as {
    san?: unknown; skills?: Record<string, unknown>; checks?: unknown[]; hist?: Array<{ at?: unknown; txt?: unknown }>
  }
  const history = (Array.isArray(p.hist) ? p.hist : [])
    .filter((h) => typeof h?.txt === 'string')
    .map((h) => ({ at: Number(h.at) || 0, text: h.txt as string }))
  return {
    san: typeof p.san === 'number' ? p.san : undefined,
    improved: Object.entries(p.skills ?? {}).filter((e): e is [string, number] => typeof e[1] === 'number'),
    checks: (Array.isArray(p.checks) ? p.checks : []).filter((x): x is string => typeof x === 'string'),
    gamesPlayed: history.filter((h) => /^A joué/.test(h.text)).length,
    history,
  }
}
