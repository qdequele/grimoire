import type { CreationDraft } from '@/engine/creation'
import { skillLabel, type Characteristic, type ProfileField } from '@/rules/d100'

/** Investigator data stored in characters.data. */
export interface CharacterData {
  name: string
  /** Occupation label as shown on the sheet. */
  occupation?: string
  age?: number
  /** Who plays them (a name: players don't have accounts). */
  player?: string
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

/** "art-craft:Photographie" → "Arts et métiers (Photographie)". */
export function skillKeyLabel(key: string): string {
  const [id, specialty] = key.split(/:(.*)/)
  return skillLabel(id, specialty)
}
