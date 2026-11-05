import { newDraft, type CreationDraft } from '@/engine/creation'
import type { CharacterRow } from '../api'

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * The wizard's state saved with the investigator, on top of a fresh draft so a partial one (a phone
 * sheet's) still opens. An investigator made before the wizard existed, or with only a name (created
 * from a phone): rebuild what we can.
 */
export function draftFromCharacter({ data: c, player_id }: CharacterRow): CreationDraft {
  const base = newDraft('custom')
  const characteristics = isObject(c.characteristics) ? c.characteristics : {}
  const d: CreationDraft = isObject(c.creation)
    ? { ...base, ...c.creation }
    : { ...base, name: c.name, age: c.age ?? 25, characteristics, luck: c.luck, rolled: true }
  return {
    ...d,
    characteristics: isObject(d.characteristics) ? d.characteristics : characteristics,
    occupationSkills: Array.isArray(d.occupationSkills) ? d.occupationSkills : base.occupationSkills,
    occupationValues: isObject(d.occupationValues) ? (d.occupationValues as Record<string, number>) : {},
    personalInterests: Array.isArray(d.personalInterests) ? d.personalInterests : [],
    specialties: isObject(d.specialties) ? (d.specialties as Record<string, string>) : {},
    profile: isObject(d.profile) ? d.profile : {},
    name: typeof d.name === 'string' ? d.name : c.name,
    playerId: player_id ?? '',
  }
}
