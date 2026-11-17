import { newDraft, type CreationDraft } from '@/engine/creation'
import { CHARACTERISTICS, PROFILE_FIELDS } from '@/rules/d100'
import type { CharacterRow } from '../api'
import { SHEET_LIMITS } from '../character'

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A text cut to the sheet's limit; undefined when the value isn't a text. */
const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined)

/** The entries of a record whose value reads as the wanted type. */
function record<V>(v: unknown, read: (x: unknown) => V | undefined): Record<string, V> {
  const out: Record<string, V> = {}
  if (!isObject(v)) return out
  for (const k of Object.keys(v)) {
    const x = read(v[k])
    if (x !== undefined) out[k] = x
  }
  return out
}

/** The same, for the known keys only. */
function known<K extends string, V>(v: unknown, read: (x: unknown) => V | undefined, keys: readonly K[]): Partial<Record<K, V>> {
  const all = record(v, read)
  const out: Partial<Record<K, V>> = {}
  for (const k of keys) if (Object.hasOwn(all, k)) out[k] = all[k]
  return out
}

const number = (v: unknown) => (isNumber(v) ? v : undefined)

/** Skill ids: texts no longer than a skill key. */
const skillIds = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= SHEET_LIMITS.skillKey) : undefined

/**
 * The wizard's state saved with the investigator, on top of a fresh draft so a partial one still
 * opens. An investigator made before the wizard existed, or with only a name (created from a phone):
 * rebuild what we can.
 *
 * `creation` is not trusted: a phone chose it, and rows stored before the database checked it
 * (companion_clean_creation) are still there. Every field is read by type and cut to the sheet's
 * limits, unknown keys are left out, and the name is the sheet's own, which the database always checked.
 */
export function draftFromCharacter({ data: c, player_id }: CharacterRow): CreationDraft {
  const base = newDraft('custom')
  const made = isObject(c.creation) ? c.creation : null
  const s: Record<string, unknown> = made ?? {}
  const sheetCharacteristics = known(c.characteristics, number, CHARACTERISTICS)
  return {
    name: text(c.name, SHEET_LIMITS.name) ?? text(s.name, SHEET_LIMITS.name) ?? '',
    occupation: text(s.occupation, SHEET_LIMITS.occupation) ?? base.occupation,
    age: number(s.age) ?? number(c.age) ?? base.age,
    playerId: player_id ?? '',
    link: text(s.link, SHEET_LIMITS.link) ?? base.link,
    characteristics: isObject(s.characteristics) ? known(s.characteristics, number, CHARACTERISTICS) : sheetCharacteristics,
    luck: number(s.luck) ?? number(c.luck),
    // A sheet without the wizard's state has its values already: nothing is left to place.
    rolled: made ? s.rolled === true : true,
    occupationSkills: skillIds(s.occupationSkills) ?? base.occupationSkills,
    occupationValues: record(s.occupationValues, number),
    personalInterests: skillIds(s.personalInterests) ?? [],
    specialties: record(s.specialties, (x) => text(x, SHEET_LIMITS.specialty)),
    profile: known(s.profile, (x) => text(x, SHEET_LIMITS.profile), PROFILE_FIELDS.map((f) => f.id)),
  }
}
