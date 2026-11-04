/** Investigator data stored in characters.data. Mirrors the story format's pregen shape. */
export const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU'] as const
export type Characteristic = (typeof CHARACTERISTICS)[number]

export interface CharacterData {
  name: string
  occupation?: string
  age?: number
  characteristics: Partial<Record<Characteristic, number>>
  hp?: number
  mp?: number
  san?: number
  luck?: number
  /** Skill name or id → value. */
  skills: Record<string, number>
  background?: string
}

/** Derived values when the sheet doesn't give them: HP = (CON+SIZ)/10, MP = POW/5, SAN = POW. */
export function derived(c: CharacterData): { hp?: number; mp?: number; san?: number } {
  const { CON, SIZ, POW } = c.characteristics
  return {
    hp: c.hp ?? (CON && SIZ ? Math.floor((CON + SIZ) / 10) : undefined),
    mp: c.mp ?? (POW ? Math.floor(POW / 5) : undefined),
    san: c.san ?? POW,
  }
}

/** "Spot Hidden 60" per line → { "Spot Hidden": 60 }. Lines without a trailing number are ignored. */
export function parseSkills(text: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^(.+?)\s*[:=]?\s+(\d{1,2})\s*%?$/)
    if (m) out[m[1].trim()] = Number(m[2])
  }
  return out
}

export function formatSkills(skills: Record<string, number>): string {
  return Object.entries(skills)
    .map(([k, v]) => `${k} ${v}`)
    .join('\n')
}
