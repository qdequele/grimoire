// What the player's phone shows of an investigator: pure helpers, no UI.
import { skillKeyLabel, type CharacterData } from '@/characters/character'
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
