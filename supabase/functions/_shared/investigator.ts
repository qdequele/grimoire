// Investigator sheets made through the MCP connector: ChatGPT or Claude choose, Grimoire checks and computes.
//
// The model sends only the CHOICES the creation wizard asks for (occupation, characteristics, the
// occupation skills and their values, personal interests, specialties, profile). Grimoire checks them
// against the creation rules, refusing anything off with the reason, and computes everything else
// itself (hit points, sanity, magic points, damage bonus, build, base values, final skills), exactly as
// the wizard's toCharacterData does. The saved sheet keeps the choices (`creation`), so the keeper can
// reopen it in the wizard.
//
// The rules data mirrors src/rules/d100.ts and the computation src/engine/creation.ts (the Edge Function
// can't import the app's code): investigator.test.ts keeps them equal, field for field.
//
// Pure TypeScript, no Deno or browser APIs: used by the mcp Edge Function and unit-tested with Vitest.

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)

// ------------------------------------------------------------------ rules data (mirrors src/rules/d100.ts)

export const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU'] as const
export type Characteristic = (typeof CHARACTERISTICS)[number]

/** Dice of each characteristic when rolled (×5). */
export const CHARACTERISTIC_DICE: Record<Characteristic, '3D6' | '2D6+6'> = {
  STR: '3D6', CON: '3D6', SIZ: '2D6+6', DEX: '3D6', APP: '3D6', INT: '2D6+6', POW: '3D6', EDU: '2D6+6',
}
/** Lowest and highest value of a characteristic rolled with its dice, ×5. */
export const DICE_RANGE = { '3D6': [15, 90], '2D6+6': [40, 90] } as const

export const CHARACTERISTIC_ARRAY = [40, 50, 50, 50, 60, 60, 70, 80]
export const OCCUPATION_ARRAY = [70, 60, 60, 50, 50, 50, 40, 40, 40]
export const OCCUPATION_SKILL_COUNT = 8
export const PERSONAL_INTEREST_COUNT = 4
export const PERSONAL_INTEREST_BONUS = 20
/** Luck: 3D6 × 5. */
export const LUCK_RANGE = [15, 90] as const
/** The wizard's age field. */
export const AGE_RANGE = [15, 89] as const

export type SkillBase = number | 'DEX/2' | 'EDU'
export interface SkillRule {
  id: string
  /** French label, as the sheet and the game engine name the skill. */
  label: string
  /** English label (src/i18n/en.ts). */
  en: string
  base: SkillBase
  specialty?: boolean
  noCreation?: boolean
}

export const SKILLS: SkillRule[] = [
  { id: 'anthropology', label: 'Anthropologie', en: 'Anthropology', base: 1 },
  { id: 'archaeology', label: 'Archéologie', en: 'Archaeology', base: 1 },
  { id: 'art-craft', label: 'Arts et métiers', en: 'Art/Craft', base: 5, specialty: true },
  { id: 'fast-talk', label: 'Baratin', en: 'Fast Talk', base: 5 },
  { id: 'library-use', label: 'Bibliothèque', en: 'Library Use', base: 20 },
  { id: 'charm', label: 'Charme', en: 'Charm', base: 15 },
  { id: 'firearms-handgun', label: 'Armes de poing', en: 'Firearms (Handgun)', base: 20 },
  { id: 'firearms-rifle', label: 'Fusils', en: 'Firearms (Rifle)', base: 25 },
  { id: 'fighting-brawl', label: 'Corps à corps', en: 'Fighting (Brawl)', base: 25 },
  { id: 'accounting', label: 'Comptabilité', en: 'Accounting', base: 5 },
  { id: 'drive-auto', label: 'Conduite', en: 'Drive Auto', base: 20 },
  { id: 'operate-heavy-machinery', label: "Conduite d'engin lourd", en: 'Operate Heavy Machinery', base: 1 },
  { id: 'credit-rating', label: 'Crédit', en: 'Credit Rating', base: 0, noCreation: true },
  { id: 'locksmith', label: 'Crochetage', en: 'Locksmith', base: 1 },
  { id: 'stealth', label: 'Discrétion', en: 'Stealth', base: 20 },
  { id: 'law', label: 'Droit', en: 'Law', base: 5 },
  { id: 'listen', label: 'Écouter', en: 'Listen', base: 20 },
  { id: 'electrical-repair', label: 'Électricité', en: 'Electrical Repair', base: 10 },
  { id: 'ride', label: 'Équitation', en: 'Ride', base: 5 },
  { id: 'dodge', label: 'Esquive', en: 'Dodge', base: 'DEX/2' },
  { id: 'appraise', label: 'Estimation', en: 'Appraise', base: 5 },
  { id: 'climb', label: 'Grimper', en: 'Climb', base: 20 },
  { id: 'history', label: 'Histoire', en: 'History', base: 5 },
  { id: 'disguise', label: 'Imposture', en: 'Disguise', base: 5 },
  { id: 'intimidate', label: 'Intimidation', en: 'Intimidate', base: 15 },
  { id: 'throw', label: 'Lancer', en: 'Throw', base: 20 },
  { id: 'language-own', label: 'Langue maternelle', en: 'Language (Own)', base: 'EDU' },
  { id: 'language-other', label: 'Langues', en: 'Language (Other)', base: 1, specialty: true },
  { id: 'mechanical-repair', label: 'Mécanique', en: 'Mechanical Repair', base: 10 },
  { id: 'medicine', label: 'Médecine', en: 'Medicine', base: 1 },
  { id: 'cthulhu-mythos', label: 'Mythe de Cthulhu', en: 'Cthulhu Mythos', base: 0, noCreation: true },
  { id: 'swim', label: 'Nager', en: 'Swim', base: 20 },
  { id: 'natural-world', label: 'Naturalisme', en: 'Natural World', base: 10 },
  { id: 'occult', label: 'Occultisme', en: 'Occult', base: 5 },
  { id: 'navigate', label: 'Orientation', en: 'Navigate', base: 10 },
  { id: 'persuade', label: 'Persuasion', en: 'Persuade', base: 10 },
  { id: 'sleight-of-hand', label: 'Pickpocket', en: 'Sleight of Hand', base: 10 },
  { id: 'pilot', label: 'Pilotage', en: 'Pilot', base: 1, specialty: true },
  { id: 'track', label: 'Pister', en: 'Track', base: 10 },
  { id: 'first-aid', label: 'Premiers soins', en: 'First Aid', base: 30 },
  { id: 'psychoanalysis', label: 'Psychanalyse', en: 'Psychoanalysis', base: 1 },
  { id: 'psychology', label: 'Psychologie', en: 'Psychology', base: 10 },
  { id: 'jump', label: 'Sauter', en: 'Jump', base: 20 },
  { id: 'science', label: 'Sciences', en: 'Science', base: 1, specialty: true },
  { id: 'science-2', label: 'Sciences (autre)', en: 'Science (other)', base: 1, specialty: true },
  { id: 'survival', label: 'Survie', en: 'Survival', base: 10, specialty: true },
  { id: 'spot-hidden', label: 'Trouver Objet Caché', en: 'Spot Hidden', base: 25 },
]
export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]))
/** Skills a sheet may choose at creation (Credit Rating comes with the occupation, the Mythos only in play). */
export const CREATION_SKILL_IDS = SKILLS.filter((s) => !s.noCreation).map((s) => s.id)
export const SOCIAL_SKILLS = ['fast-talk', 'charm', 'intimidate', 'persuade']

export interface OccupationRule {
  id: string
  /** French label, stored as the sheet's occupation (as the wizard does). */
  label: string
  en: string
  skills: string[]
  social: boolean
  specialties?: Record<string, string>
}

export const OCCUPATIONS: OccupationRule[] = [
  { id: 'antiquarian', label: 'Antiquaire', en: 'Antiquarian', skills: ['art-craft', 'library-use', 'appraise', 'history', 'language-other', 'spot-hidden'], social: true },
  {
    id: 'private-eye', label: 'Détective privé', en: 'Private eye',
    skills: ['art-craft', 'library-use', 'law', 'disguise', 'psychology', 'spot-hidden'], social: true,
    specialties: { 'art-craft': 'Photographie' },
  },
  { id: 'dilettante', label: 'Dilettante', en: 'Dilettante', skills: ['art-craft', 'firearms-rifle', 'ride', 'language-other'], social: true },
  {
    id: 'author', label: 'Écrivain', en: 'Author', skills: ['art-craft', 'library-use', 'history', 'language-own', 'language-other', 'psychology'], social: false,
    specialties: { 'art-craft': 'Littérature' },
  },
  { id: 'police-detective', label: 'Inspecteur', en: 'Police detective', skills: ['disguise', 'firearms-handgun', 'law', 'listen', 'psychology', 'spot-hidden'], social: true },
  {
    id: 'journalist', label: 'Journaliste', en: 'Journalist', skills: ['art-craft', 'library-use', 'history', 'language-own', 'psychology'], social: true,
    specialties: { 'art-craft': 'Photographie' },
  },
  {
    id: 'doctor', label: 'Médecin', en: 'Doctor', skills: ['language-other', 'medicine', 'first-aid', 'psychology', 'science', 'science-2'], social: false,
    specialties: { 'language-other': 'Latin', science: 'Biologie', 'science-2': 'Pharmacologie' },
  },
  { id: 'professor', label: 'Professeur', en: 'Professor', skills: ['library-use', 'language-own', 'language-other', 'psychology'], social: false },
  { id: 'custom', label: 'Autre (à inventer)', en: 'Other (make one up)', skills: [], social: false },
]
export const OCCUPATION_BY_ID = new Map(OCCUPATIONS.map((o) => [o.id, o]))

export const PROFILE_FIELDS = ['description', 'ideology', 'significantPeople', 'meaningfulLocations', 'treasuredPossessions', 'traits'] as const
export type ProfileField = (typeof PROFILE_FIELDS)[number]

/** Text limits, in characters (SHEET_LIMITS in src/characters/character.ts). */
export const SHEET_LIMITS = { name: 80, occupation: 200, link: 200, profile: 2000, skillKey: 80, specialty: 40, playerName: 80 } as const
/** Characters that build HTML on the game screen: refused in names, specialties and first names (hasMarkup). */
export const hasMarkup = (s: string): boolean => /[<>&"]/.test(s)

// ------------------------------------------------------------------ computation (mirrors src/engine/creation.ts)

/** The wizard's state (CreationDraft in src/engine/creation.ts), saved with the sheet. */
export interface InvestigatorDraft {
  name: string
  occupation: string
  age: number
  /** players.id, '' = nobody. */
  playerId: string
  link: string
  characteristics: Partial<Record<Characteristic, number>>
  luck?: number
  rolled: boolean
  occupationSkills: string[]
  occupationValues: Record<string, number>
  personalInterests: string[]
  specialties: Record<string, string>
  profile: Partial<Record<ProfileField, string>>
}

/** characters.data as the wizard writes it (CharacterData in src/characters/character.ts). */
export interface InvestigatorSheet {
  name: string
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
  skills: Record<string, number>
  profile?: Partial<Record<ProfileField, string>>
  creation?: InvestigatorDraft
}

export const DAMAGE_BONUS_TABLE: Array<[max: number, damageBonus: string, build: number]> = [
  [64, '-2', -2],
  [84, '-1', -1],
  [124, '0', 0],
  [164, '+1D4', 1],
  [Infinity, '+1D6', 2],
]

export function derivedValues(c: Partial<Record<Characteristic, number>>) {
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

function baseValue(skillId: string, c: Partial<Record<Characteristic, number>>): number {
  const base = SKILL_BY_ID.get(skillId)?.base ?? 0
  if (base === 'DEX/2') return derivedValues(c).dodge
  if (base === 'EDU') return derivedValues(c).ownLanguage
  return base
}

function skillTotal(skillId: string, d: InvestigatorDraft): number {
  const placed = d.occupationValues[skillId]
  if (placed !== undefined && (d.occupationSkills.includes(skillId) || skillId === 'credit-rating')) return placed
  const base = baseValue(skillId, d.characteristics)
  return d.personalInterests.includes(skillId) ? base + PERSONAL_INTEREST_BONUS : base
}

function finalSkills(d: InvestigatorDraft): Record<string, number> {
  const ids = [...new Set([...d.occupationSkills, ...d.personalInterests, 'dodge', 'credit-rating'])]
  const entries = ids.map((id): [string, number] => [d.specialties[id] ? `${id}:${d.specialties[id]}` : id, skillTotal(id, d)])
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]))
}

const points = (n: number) => Math.min(99, Math.max(0, Math.round(n)))

/** The sheet saved in characters.data, as the wizard's toCharacterData builds it. */
export function investigatorSheet(d: InvestigatorDraft): InvestigatorSheet {
  const v = derivedValues(d.characteristics)
  return {
    name: d.name.trim(),
    occupation: (OCCUPATION_BY_ID.get(d.occupation) ?? OCCUPATIONS.at(-1)!).label,
    age: d.age,
    link: d.link.trim() || undefined,
    characteristics: d.characteristics,
    hp: points(v.hp),
    mp: points(v.mp),
    san: points(v.san),
    luck: d.luck === undefined ? undefined : points(d.luck),
    move: v.move,
    build: v.build,
    damageBonus: v.damageBonus,
    skills: finalSkills(d),
    profile: Object.fromEntries(Object.entries(d.profile).filter(([, t]) => t?.trim())),
    creation: d,
  }
}

// ------------------------------------------------------------------ untrusted choices → draft

/** The choices a model sends (the tools' `investigator` argument). */
export interface InvestigatorInput {
  name: string
  occupation: string
  age: number
  /** The player's first name; "" = nobody. Left out on a replace: the player stays. */
  player?: string
  link?: string
  /** false (default): the eight values are 40, 50, 50, 50, 60, 60, 70, 80 placed as wished. true: rolled with dice. */
  rolled?: boolean
  characteristics: Record<Characteristic, number>
  luck: number
  occupationSkills: Array<{ id: string; value: number; specialty?: string }>
  creditRating: number
  personalInterests: Array<{ id: string; specialty?: string }>
  profile?: Partial<Record<ProfileField, string>>
}

export const INPUT_KEYS = [
  'name', 'occupation', 'age', 'player', 'link', 'rolled', 'characteristics', 'luck', 'occupationSkills', 'creditRating', 'personalInterests', 'profile',
] as const

export interface ParsedInvestigator {
  /** Set when there are no problems. playerId is '' (the caller resolves `player`). */
  draft: InvestigatorDraft | null
  /** undefined: not given; '': nobody; else a first name. */
  player: string | undefined
  /** What breaks the creation rules: nothing is saved while there are any. */
  problems: string[]
  /** Allowed, but worth telling the keeper. */
  warnings: string[]
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b)
const sameValues = (a: number[], b: number[]) => a.length === b.length && sorted(a).every((x, i) => x === sorted(b)[i])
const list = (xs: readonly (string | number)[]) => xs.join(', ')
const skillName = (id: string) => {
  const s = SKILL_BY_ID.get(id)
  return s ? `${id} (${s.en})` : id
}

/**
 * Check a model's choices against the creation rules. Every problem is listed (not just the first),
 * each saying what to change, so one more call can fix them all.
 */
export function parseInvestigator(input: unknown): ParsedInvestigator {
  const problems: string[] = []
  const warnings: string[] = []
  if (!isObj(input)) {
    problems.push('investigator must be an object with the creation choices (grimoire_guide topic "investigators").')
    return { draft: null, player: undefined, problems, warnings }
  }
  const unknownKeys = Object.keys(input).filter((k) => !(INPUT_KEYS as readonly string[]).includes(k))
  if (unknownKeys.length) {
    problems.push(`Unknown fields: ${list(unknownKeys)}. The fields are ${list(INPUT_KEYS)}; everything else (hit points, sanity, skills' final values…) is computed by Grimoire.`)
  }

  // Identity.
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) problems.push('name: required.')
  else if (name.length > SHEET_LIMITS.name) problems.push(`name: at most ${SHEET_LIMITS.name} characters.`)
  else if (hasMarkup(name)) problems.push('name: must not contain < > & or ".')

  const occupation = typeof input.occupation === 'string' ? OCCUPATION_BY_ID.get(input.occupation) : undefined
  if (!occupation) problems.push(`occupation: one of ${list(OCCUPATIONS.map((o) => o.id))}.`)

  const age = input.age
  if (!isInt(age) || age < AGE_RANGE[0] || age > AGE_RANGE[1]) problems.push(`age: a whole number from ${AGE_RANGE[0]} to ${AGE_RANGE[1]}.`)

  let player: string | undefined
  if (input.player !== undefined && input.player !== null) {
    if (typeof input.player !== 'string') problems.push('player: the player\'s first name, or "" for nobody.')
    else {
      player = input.player.trim()
      if (player.length > SHEET_LIMITS.playerName) problems.push(`player: at most ${SHEET_LIMITS.playerName} characters.`)
      else if (hasMarkup(player)) problems.push('player: must not contain < > & or ".')
    }
  }

  let link = ''
  if (input.link !== undefined && input.link !== null) {
    if (typeof input.link !== 'string') problems.push('link: text.')
    else if (input.link.trim().length > SHEET_LIMITS.link) problems.push(`link: at most ${SHEET_LIMITS.link} characters.`)
    else link = input.link.trim()
  }

  // Characteristics and luck.
  if (input.rolled !== undefined && typeof input.rolled !== 'boolean') problems.push('rolled: true or false.')
  const rolled = input.rolled === true
  const characteristics: Partial<Record<Characteristic, number>> = {}
  if (!isObj(input.characteristics)) {
    problems.push(`characteristics: an object with ${list(CHARACTERISTICS)}.`)
  } else {
    const c = input.characteristics
    const extra = Object.keys(c).filter((k) => !(CHARACTERISTICS as readonly string[]).includes(k))
    if (extra.length) problems.push(`characteristics: unknown keys ${list(extra)} (the keys are ${list(CHARACTERISTICS)}).`)
    const missing = CHARACTERISTICS.filter((k) => c[k] === undefined)
    if (missing.length) problems.push(`characteristics: missing ${list(missing)}.`)
    for (const k of CHARACTERISTICS) {
      const v = c[k]
      if (v === undefined) continue
      if (!isInt(v)) {
        problems.push(`characteristics.${k}: a whole number.`)
        continue
      }
      characteristics[k] = v
      if (rolled) {
        const dice = CHARACTERISTIC_DICE[k]
        const [lo, hi] = DICE_RANGE[dice]
        if (v < lo || v > hi || v % 5) problems.push(`characteristics.${k}: rolled with ${dice} × 5, so a multiple of 5 from ${lo} to ${hi} (got ${v}).`)
      }
    }
    if (!rolled && !missing.length) {
      const values = CHARACTERISTICS.map((k) => c[k]).filter(isInt)
      if (values.length === CHARACTERISTICS.length && !sameValues(values, CHARACTERISTIC_ARRAY)) {
        problems.push(
          `characteristics: without rolled: true, the eight values must be ${list(CHARACTERISTIC_ARRAY)}, each used once, in any order (got ${list(sorted(values))}). To roll them with dice instead, set rolled: true.`,
        )
      }
    }
  }
  if (rolled) warnings.push('The characteristics are marked as rolled: Grimoire checks their ranges, not the dice. Make sure the keeper agreed to rolling (the standard way is the fixed values).')

  const luck = input.luck
  if (!isInt(luck) || luck < LUCK_RANGE[0] || luck > LUCK_RANGE[1] || luck % 5) {
    problems.push(`luck: rolled with 3D6 × 5, so a multiple of 5 from ${LUCK_RANGE[0]} to ${LUCK_RANGE[1]}.`)
  }

  // Skills.
  const specialties: Record<string, string> = {}
  const chosen = new Set<string>()
  /** Check one chosen skill (id and specialty); false when it can't be used. */
  const takeSkill = (raw: Json, where: string): string | null => {
    const id = typeof raw.id === 'string' ? raw.id.trim() : ''
    const rule = SKILL_BY_ID.get(id)
    if (!rule) {
      problems.push(`${where}.id: unknown skill "${id}". Skills: ${list(CREATION_SKILL_IDS)}.`)
      return null
    }
    if (rule.noCreation) {
      problems.push(
        id === 'credit-rating'
          ? `${where}: Credit Rating is not one of the eight skills; give its value in creditRating.`
          : `${where}: ${skillName(id)} can't be learned at creation.`,
      )
      return null
    }
    if (chosen.has(id)) {
      problems.push(`${where}: ${skillName(id)} is chosen twice (a skill is either an occupation skill or a personal interest, once). For two sciences use science and science-2.`)
      return null
    }
    chosen.add(id)
    const specialty = typeof raw.specialty === 'string' ? raw.specialty.trim() : ''
    if (raw.specialty !== undefined && raw.specialty !== null && typeof raw.specialty !== 'string') problems.push(`${where}.specialty: text.`)
    if (rule.specialty) {
      if (!specialty) problems.push(`${where}: ${skillName(id)} needs a specialty (e.g. Photography, Latin, Chemistry, Aeroplane, Mountains), in the sheet's language.`)
      else if (specialty.length > SHEET_LIMITS.specialty) problems.push(`${where}.specialty: at most ${SHEET_LIMITS.specialty} characters.`)
      else if (hasMarkup(specialty)) problems.push(`${where}.specialty: must not contain < > & or ".`)
      else specialties[id] = specialty
    } else if (specialty) {
      problems.push(`${where}: ${skillName(id)} takes no specialty.`)
    }
    return id
  }

  const occupationSkills: string[] = []
  const occupationValues: Record<string, number> = {}
  const values: number[] = []
  if (!Array.isArray(input.occupationSkills)) {
    problems.push(`occupationSkills: a list of ${OCCUPATION_SKILL_COUNT} { id, value, specialty? }.`)
  } else {
    if (input.occupationSkills.length !== OCCUPATION_SKILL_COUNT) {
      problems.push(`occupationSkills: exactly ${OCCUPATION_SKILL_COUNT} skills (got ${input.occupationSkills.length}).`)
    }
    input.occupationSkills.slice(0, 20).forEach((raw, i) => {
      const where = `occupationSkills[${i}]`
      if (!isObj(raw)) {
        problems.push(`${where}: { id, value, specialty? }.`)
        return
      }
      const id = takeSkill(raw, where)
      if (!isInt(raw.value)) problems.push(`${where}.value: a whole number from the occupation values.`)
      else values.push(raw.value)
      if (id && isInt(raw.value)) {
        occupationSkills.push(id)
        occupationValues[id] = raw.value
      }
    })
  }
  if (!isInt(input.creditRating)) problems.push('creditRating: a whole number from the occupation values.')
  else {
    values.push(input.creditRating)
    occupationValues['credit-rating'] = input.creditRating
  }
  if (values.length === OCCUPATION_ARRAY.length && !sameValues(values, OCCUPATION_ARRAY)) {
    problems.push(
      `Occupation values: the eight occupation skills and creditRating share ${list(OCCUPATION_ARRAY)}, each used once (got ${list(sorted(values).reverse())}).`,
    )
  }
  if (occupation?.social && Array.isArray(input.occupationSkills) && !occupationSkills.some((s) => SOCIAL_SKILLS.includes(s))) {
    problems.push(`occupationSkills: a ${occupation.en} must take at least one social skill: ${list(SOCIAL_SKILLS)}.`)
  }

  const personalInterests: string[] = []
  if (!Array.isArray(input.personalInterests)) {
    problems.push(`personalInterests: a list of ${PERSONAL_INTEREST_COUNT} { id, specialty? }.`)
  } else {
    if (input.personalInterests.length !== PERSONAL_INTEREST_COUNT) {
      problems.push(`personalInterests: exactly ${PERSONAL_INTEREST_COUNT} skills that are not occupation skills (got ${input.personalInterests.length}).`)
    }
    input.personalInterests.slice(0, 20).forEach((raw, i) => {
      const where = `personalInterests[${i}]`
      const item = typeof raw === 'string' ? { id: raw } : raw
      if (!isObj(item)) {
        problems.push(`${where}: { id, specialty? }.`)
        return
      }
      if (item.value !== undefined) problems.push(`${where}: no value: a personal interest adds +${PERSONAL_INTEREST_BONUS} to the skill's base value, Grimoire computes it.`)
      const id = takeSkill(item, where)
      if (id) personalInterests.push(id)
    })
  }

  if (occupation && occupation.id !== 'custom') {
    const dropped = occupation.skills.filter((s) => !occupationSkills.includes(s))
    if (dropped.length && Array.isArray(input.occupationSkills)) {
      warnings.push(`A ${occupation.en} usually has ${list(dropped.map(skillName))} among the occupation skills. Replacing them is allowed with the keeper's agreement.`)
    }
  }

  // Profile.
  const profile: Partial<Record<ProfileField, string>> = {}
  if (input.profile !== undefined && input.profile !== null) {
    if (!isObj(input.profile)) problems.push(`profile: an object with some of ${list(PROFILE_FIELDS)}.`)
    else {
      for (const [k, v] of Object.entries(input.profile)) {
        if (!(PROFILE_FIELDS as readonly string[]).includes(k)) problems.push(`profile.${k}: unknown field (the fields are ${list(PROFILE_FIELDS)}).`)
        else if (typeof v !== 'string') problems.push(`profile.${k}: text.`)
        else if (v.trim().length > SHEET_LIMITS.profile) problems.push(`profile.${k}: at most ${SHEET_LIMITS.profile} characters.`)
        else if (v.trim()) profile[k as ProfileField] = v.trim()
      }
    }
  }

  if (problems.length || !occupation || !isInt(age) || !isInt(luck)) return { draft: null, player, problems, warnings }
  return {
    draft: {
      name,
      occupation: occupation.id,
      age,
      playerId: '',
      link,
      characteristics,
      luck,
      rolled,
      occupationSkills,
      occupationValues,
      personalInterests,
      specialties,
      profile,
    },
    player,
    problems,
    warnings,
  }
}

// ------------------------------------------------------------------ what the tools show

/** "art-craft:Photographie" → "Arts et métiers (Photographie)", as the sheet names it (skillLabel). */
export function skillKeyLabel(key: string): string {
  const [id, specialty] = key.split(/:(.*)/)
  const label = SKILL_BY_ID.get(id)?.label ?? id
  return specialty ? `${label.replace(' (autre)', '')} (${specialty})` : label
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** A stored sheet, readable by a model: computed values included, any investigator (defensive). */
export function investigatorView(data: unknown) {
  const d = isObj(data) ? data : {}
  const c = isObj(d.characteristics) ? d.characteristics : {}
  const skills = isObj(d.skills) ? d.skills : {}
  return {
    name: typeof d.name === 'string' ? d.name : '',
    occupation: typeof d.occupation === 'string' ? d.occupation : '',
    age: num(d.age),
    link: typeof d.link === 'string' ? d.link : undefined,
    characteristics: Object.fromEntries(CHARACTERISTICS.flatMap((k) => (num(c[k]) === undefined ? [] : [[k, c[k]]]))),
    luck: num(d.luck),
    hp: num(d.hp),
    mp: num(d.mp),
    san: num(d.san),
    move: num(d.move),
    build: num(d.build),
    damageBonus: typeof d.damageBonus === 'string' ? d.damageBonus : undefined,
    skills: Object.entries(skills)
      .filter((e): e is [string, number] => typeof e[1] === 'number')
      .map(([key, value]) => ({ key, label: skillKeyLabel(key), value, half: Math.floor(value / 2), fifth: Math.floor(value / 5) })),
    profile: isObj(d.profile) ? d.profile : {},
  }
}

/**
 * The choices behind a stored sheet, in the shape save_investigator takes, so a model can change some
 * and send them back. null when the sheet wasn't made with the creation rules (no `creation`).
 */
export function choicesOf(data: unknown, playerName: string | null): InvestigatorInput | null {
  const d = isObj(data) ? data : {}
  const c = isObj(d.creation) ? d.creation : null
  if (!c) return null
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const values = isObj(c.occupationValues) ? c.occupationValues : {}
  const specs = isObj(c.specialties) ? c.specialties : {}
  const spec = (id: string) => (typeof specs[id] === 'string' && specs[id] ? { specialty: specs[id] as string } : {})
  return {
    name: typeof c.name === 'string' ? c.name : '',
    occupation: typeof c.occupation === 'string' ? c.occupation : 'custom',
    age: num(c.age) ?? 25,
    player: playerName ?? '',
    link: typeof c.link === 'string' ? c.link : '',
    rolled: c.rolled === true,
    characteristics: (isObj(c.characteristics) ? c.characteristics : {}) as Record<Characteristic, number>,
    luck: num(c.luck) as number,
    occupationSkills: strs(c.occupationSkills).map((id) => ({ id, value: num(values[id]) as number, ...spec(id) })),
    creditRating: num(values['credit-rating']) as number,
    personalInterests: strs(c.personalInterests).map((id) => ({ id, ...spec(id) })),
    profile: (isObj(c.profile) ? c.profile : {}) as Partial<Record<ProfileField, string>>,
  }
}

// ------------------------------------------------------------------ the guide

const baseText = (b: SkillBase) => (b === 'DEX/2' ? 'half DEX' : b === 'EDU' ? 'EDU' : String(b))

export const INVESTIGATORS_GUIDE = () => `# Creating an investigator (check_investigator, save_investigator)

Grimoire's investigators are the player characters. You help the keeper (or a player, with the keeper) make one; Grimoire checks every choice against the creation rules and computes the rest. You send only the CHOICES below: hit points, sanity, magic points, move, damage bonus, build, base values and final skill values are computed by Grimoire, never sent.

## Steps

1. Ask who it is for (player's first name), the occupation, and a concept in a sentence or two. Propose the rest and say what you chose.
2. Build the choices following the rules below.
3. Call check_investigator: it returns the problems to fix (nothing is saved), or the finished sheet with every computed value. Fix and check again until "ok" is true.
4. Show the keeper the finished sheet as a short readable summary (characteristics, hit points, sanity, luck, the main skills, the profile) and wait for their go-ahead.
5. Call save_investigator with the same choices. It returns the investigator's link. To change one later: list_my_investigators, get_investigator (its "choices" and "version"), change what the keeper asked, check_investigator, then save_investigator with characterId and version. What the investigator gained in play is kept.

## The choices

- name: the investigator's full name (at most ${SHEET_LIMITS.name} characters, no < > & "). Invent it: no names from published games or fiction.
- player: the player's first name (an existing player of the keeper is reused, case-insensitively; a new name adds a player). "" for nobody. On a change, leave it out to keep the current player.
- occupation: one of the ids below. "custom" is an occupation the keeper and player invent: choose its eight skills together.
- age: ${AGE_RANGE[0]} to ${AGE_RANGE[1]}.
- link (optional): their link with the story or the other investigators, one sentence (at most ${SHEET_LIMITS.link} characters).
- characteristics: STR, CON, SIZ, DEX, APP, INT, POW, EDU. Standard way: place the values ${list(CHARACTERISTIC_ARRAY)} (each once, in any order) to fit the concept (a scholar gets a high EDU and INT, a boxer a high STR and CON). Variant, only if the keeper agrees: rolled: true and each value rolled with dice: 3D6 × 5 for STR, CON, DEX, APP and POW (15 to 90), (2D6 + 6) × 5 for SIZ, INT and EDU (40 to 90). Roll honestly, or use the dice the player rolled.
- luck: 3D6 × 5 (15 to 90, a multiple of 5). Roll it, or use the player's roll.
- occupationSkills: exactly ${OCCUPATION_SKILL_COUNT} skills { id, value, specialty? }: the occupation's own skills (listed below) completed with skills that fit the job. Occupations marked "social" must include at least one social skill (${list(SOCIAL_SKILLS)}). The values ${list(OCCUPATION_ARRAY)} are shared between these ${OCCUPATION_SKILL_COUNT} skills and creditRating, each used once: the chosen value replaces the skill's base value.
- creditRating: the value from that same set for wealth and standing (0 penniless, under 10 poor, under 50 middle class, under 90 well-off, under 99 rich).
- personalInterests: exactly ${PERSONAL_INTEREST_COUNT} other skills { id, specialty? } (not occupation skills): each gets +${PERSONAL_INTEREST_BONUS} on its base value.
- specialty: required for ${list(SKILLS.filter((s) => s.specialty).map((s) => s.id))} (e.g. art-craft "Photographie", language-other "Latin", science "Chimie", pilot "Avion", survival "Montagne"), written in the sheet's language, at most ${SHEET_LIMITS.specialty} characters. Other skills take none. Two sciences: science and science-2.
- profile (optional, in the sheet's language, at most ${SHEET_LIMITS.profile} characters each): ${list(PROFILE_FIELDS)} (description: looks and manner; ideology: beliefs; significantPeople: someone who matters; meaningfulLocations: a place that matters; treasuredPossessions: an object they cherish; traits: a few words of character). A sentence or two each, giving the player something to play.
- Dodge (half DEX) and Credit Rating are always on the sheet. The forbidden-lore skill (cthulhu-mythos) can't be chosen: it only comes in play.

## Occupations

${OCCUPATIONS.map((o) => `- ${o.id} (${o.en}; on the sheet "${o.label}")${o.social ? ', social' : ''}: ${o.skills.length ? list(o.skills.map((s) => (o.specialties?.[s] ? `${s} "${o.specialties[s]}"` : s))) : 'none, choose eight'}`).join('\n')}

## Skills (id: English name / name on the sheet, base value)

${CREATION_SKILL_IDS.map((id) => {
  const s = SKILL_BY_ID.get(id)!
  return `- ${id}: ${s.en} / ${s.label}, ${baseText(s.base)}${s.specialty ? ', needs a specialty' : ''}`
}).join('\n')}

## Example of choices

{"name":"Edith Calloway","player":"Sam","occupation":"journalist","age":31,"link":"Covered the first disappearance for the local paper.","characteristics":{"STR":40,"CON":50,"SIZ":50,"DEX":60,"APP":50,"INT":70,"POW":60,"EDU":80},"luck":55,"occupationSkills":[{"id":"art-craft","value":60,"specialty":"Photographie"},{"id":"library-use","value":70},{"id":"history","value":40},{"id":"language-own","value":50},{"id":"psychology","value":60},{"id":"fast-talk","value":50},{"id":"spot-hidden","value":50},{"id":"listen","value":40}],"creditRating":40,"personalInterests":[{"id":"stealth"},{"id":"occult"},{"id":"drive-auto"},{"id":"language-other","specialty":"Français"}],"profile":{"description":"Ink-stained fingers, a camera always at hand.","traits":"Stubborn, curious."}}`
