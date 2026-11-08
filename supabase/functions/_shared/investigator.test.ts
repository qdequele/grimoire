import { describe, expect, it } from 'vitest'
import { SHEET_LIMITS as APP_SHEET_LIMITS, toCharacterData } from '../../../src/characters/character'
import { checkDraft, DAMAGE_BONUS_TABLE as APP_DAMAGE_BONUS_TABLE, newDraft, type CreationDraft } from '../../../src/engine/creation'
import { EN } from '../../../src/i18n/en'
import * as app from '../../../src/rules/d100'
import {
  CHARACTERISTIC_ARRAY,
  CHARACTERISTIC_DICE,
  CHARACTERISTICS,
  choicesOf,
  DAMAGE_BONUS_TABLE,
  investigatorSheet,
  INVESTIGATORS_GUIDE,
  investigatorView,
  OCCUPATION_ARRAY,
  OCCUPATION_SKILL_COUNT,
  OCCUPATIONS,
  parseInvestigator,
  PERSONAL_INTEREST_BONUS,
  PERSONAL_INTEREST_COUNT,
  PROFILE_FIELDS,
  SHEET_LIMITS,
  SKILLS,
  SOCIAL_SKILLS,
  type InvestigatorInput,
} from './investigator'

/** A valid set of choices (the guide's example). */
const valid = (): InvestigatorInput => ({
  name: 'Edith Calloway',
  player: 'Sam',
  occupation: 'journalist',
  age: 31,
  link: 'Covered the first disappearance.',
  characteristics: { STR: 40, CON: 50, SIZ: 50, DEX: 60, APP: 50, INT: 70, POW: 60, EDU: 80 },
  luck: 55,
  occupationSkills: [
    { id: 'art-craft', value: 60, specialty: 'Photographie' },
    { id: 'library-use', value: 70 },
    { id: 'history', value: 40 },
    { id: 'language-own', value: 50 },
    { id: 'psychology', value: 60 },
    { id: 'fast-talk', value: 50 },
    { id: 'spot-hidden', value: 50 },
    { id: 'listen', value: 40 },
  ],
  creditRating: 40,
  personalInterests: [{ id: 'stealth' }, { id: 'occult' }, { id: 'drive-auto' }, { id: 'language-other', specialty: 'Français' }],
  profile: { description: 'Ink-stained fingers.', traits: 'Stubborn.' },
})

const problemsOf = (input: unknown) => parseInvestigator(input).problems.join('\n')

describe('rules data mirrors the app', () => {
  it('has the same skills, occupations, value arrays, dice, limits and tables', () => {
    expect(SKILLS.map(({ en: _en, ...s }) => s)).toEqual(app.SKILLS.map(({ what: _what, ...s }) => s))
    expect(OCCUPATIONS.map(({ en: _en, ...o }) => o)).toEqual(app.OCCUPATIONS.map(({ hint: _hint, ...o }) => o))
    expect([...CHARACTERISTICS]).toEqual([...app.CHARACTERISTICS])
    expect(CHARACTERISTIC_DICE).toEqual(Object.fromEntries(app.CHARACTERISTICS.map((k) => [k, app.CHARACTERISTIC_INFO[k].dice])))
    expect(CHARACTERISTIC_ARRAY).toEqual(app.CHARACTERISTIC_ARRAY)
    expect(OCCUPATION_ARRAY).toEqual(app.OCCUPATION_ARRAY)
    expect([OCCUPATION_SKILL_COUNT, PERSONAL_INTEREST_COUNT, PERSONAL_INTEREST_BONUS]).toEqual([app.OCCUPATION_SKILL_COUNT, app.PERSONAL_INTEREST_COUNT, app.PERSONAL_INTEREST_BONUS])
    expect(SOCIAL_SKILLS).toEqual(app.SOCIAL_SKILLS)
    expect([...PROFILE_FIELDS]).toEqual(app.PROFILE_FIELDS.map((f) => f.id))
    expect(SHEET_LIMITS).toEqual(APP_SHEET_LIMITS)
    expect(DAMAGE_BONUS_TABLE).toEqual(APP_DAMAGE_BONUS_TABLE)
  })

  it('names skills and occupations in English as the app does', () => {
    for (const s of SKILLS) expect(s.en).toBe(EN[`compétence:${s.label}`])
    for (const o of OCCUPATIONS) expect(o.en).toBe(EN[o.label])
  })
})

/** The choices behind a complete wizard draft, as a model would send them. */
function inputOf(d: CreationDraft, player = ''): InvestigatorInput {
  const spec = (id: string) => (d.specialties[id] ? { specialty: d.specialties[id] } : {})
  return {
    name: d.name,
    player,
    occupation: d.occupation,
    age: d.age,
    link: d.link,
    rolled: d.rolled,
    characteristics: d.characteristics as InvestigatorInput['characteristics'],
    luck: d.luck!,
    occupationSkills: d.occupationSkills.map((id) => ({ id, value: d.occupationValues[id], ...spec(id) })),
    creditRating: d.occupationValues['credit-rating'],
    personalInterests: d.personalInterests.map((id) => ({ id, ...spec(id) })),
    profile: d.profile,
  }
}

/** A seeded random complete draft, built the way the wizard builds one. */
function randomDraft(seed: number): CreationDraft {
  let x = seed
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const shuffle = <T,>(xs: T[]) => xs.map((v) => [rnd(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v)
  const occupation = OCCUPATIONS[Math.floor(rnd() * OCCUPATIONS.length)]
  const d = newDraft(occupation.id)
  const pool = app.SKILLS.filter((s) => !s.noCreation).map((s) => s.id)
  const skills = [...d.occupationSkills]
  if (occupation.social && !skills.some((s) => SOCIAL_SKILLS.includes(s))) skills.push(shuffle(SOCIAL_SKILLS)[0])
  for (const id of shuffle(pool)) if (skills.length < 8 && !skills.includes(id)) skills.push(id)
  const values = shuffle(OCCUPATION_ARRAY)
  const interests = shuffle(pool.filter((s) => !skills.includes(s))).slice(0, 4)
  const rolled = rnd() < 0.3
  const characteristics = Object.fromEntries(
    app.CHARACTERISTICS.map((k, i) => [k, rolled ? (app.CHARACTERISTIC_INFO[k].dice === '3D6' ? 15 : 40) + 5 * Math.floor(rnd() * 11) : shuffle(CHARACTERISTIC_ARRAY)[i]]),
  )
  const fixed = shuffle(CHARACTERISTIC_ARRAY)
  if (!rolled) app.CHARACTERISTICS.forEach((k, i) => (characteristics[k] = fixed[i]))
  const specialties = { ...d.specialties }
  for (const id of [...skills, ...interests]) if (app.SKILL_BY_ID.get(id)?.specialty && !specialties[id]) specialties[id] = `Spé ${id.length}`
  for (const id of Object.keys(specialties)) if (![...skills, ...interests].includes(id)) delete specialties[id]
  return {
    ...d,
    name: `Name ${seed}`,
    age: 18 + (seed % 60),
    link: seed % 2 ? 'A link' : '',
    rolled,
    characteristics,
    luck: 15 + 5 * Math.floor(rnd() * 16),
    occupationSkills: skills,
    occupationValues: Object.fromEntries([...skills, 'credit-rating'].map((id, i) => [id, values[i]])),
    personalInterests: interests,
    specialties,
    profile: seed % 3 ? { description: 'Tall.', traits: 'Calm.' } : {},
  }
}

describe('parseInvestigator + investigatorSheet', () => {
  it("accepts the guide's example", () => {
    const example = JSON.parse(INVESTIGATORS_GUIDE().split('## Example of choices')[1])
    const p = parseInvestigator(example)
    expect(p.problems).toEqual([])
    expect(p.player).toBe('Sam')
  })

  it('builds exactly the sheet the wizard saves, for any valid draft', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const d = randomDraft(seed)
      expect(checkDraft(d).issues).toEqual([])
      const p = parseInvestigator(inputOf(d))
      expect(p.problems, `seed ${seed}`).toEqual([])
      expect(investigatorSheet({ ...p.draft!, playerId: 'p1' })).toEqual(toCharacterData({ ...d, playerId: 'p1' }))
    }
  })

  it('computes the derived values and final skills', () => {
    const sheet = investigatorSheet(parseInvestigator(valid()).draft!)
    // HP (CON+SIZ)/10, SAN = POW, MP = POW/5, damage bonus from STR+SIZ = 90.
    expect(sheet).toMatchObject({ occupation: 'Journaliste', hp: 10, san: 60, mp: 12, luck: 55, move: 8, build: 0, damageBonus: '0' })
    // Occupation value replaces the base; interests add 20; dodge is half DEX; specialties in the key.
    expect(sheet.skills).toMatchObject({ 'library-use': 70, 'art-craft:Photographie': 60, stealth: 40, occult: 25, 'language-other:Français': 21, dodge: 30, 'credit-rating': 40 })
    expect(sheet.creation).toMatchObject({ occupation: 'journalist', rolled: false, occupationValues: { 'credit-rating': 40 } })
  })

  it('round-trips through choicesOf', () => {
    const sheet = investigatorSheet(parseInvestigator(valid()).draft!)
    const back = choicesOf(sheet, 'Sam')!
    expect(back).toEqual({ ...valid(), rolled: false })
    expect(choicesOf({ name: 'Old', skills: {} }, null)).toBeNull()
  })

  it('shows a stored sheet with labels and thresholds', () => {
    const view = investigatorView(investigatorSheet(parseInvestigator(valid()).draft!))
    expect(view.skills.find((s) => s.key === 'art-craft:Photographie')).toEqual({ key: 'art-craft:Photographie', label: 'Arts et métiers (Photographie)', value: 60, half: 30, fifth: 12 })
    expect(investigatorView(null)).toMatchObject({ name: '', skills: [] })
  })
})

describe('parseInvestigator refuses what breaks the rules', () => {
  it('refuses non-objects and unknown fields (computed values are not sent)', () => {
    expect(problemsOf('Edith')).toMatch(/must be an object/)
    expect(problemsOf({ ...valid(), hp: 12, skills: {} })).toMatch(/Unknown fields: hp, skills/)
  })

  it('checks the identity fields', () => {
    expect(problemsOf({ ...valid(), name: '  ' })).toMatch(/name: required/)
    expect(problemsOf({ ...valid(), name: 'a'.repeat(81) })).toMatch(/name: at most 80/)
    expect(problemsOf({ ...valid(), name: '<b>Edith</b>' })).toMatch(/name: must not contain/)
    expect(problemsOf({ ...valid(), occupation: 'pirate' })).toMatch(/occupation: one of antiquarian/)
    expect(problemsOf({ ...valid(), age: 12 })).toMatch(/age: a whole number from 15 to 89/)
    expect(problemsOf({ ...valid(), age: 30.5 })).toMatch(/age:/)
    expect(problemsOf({ ...valid(), player: 'Sam & Max' })).toMatch(/player: must not contain/)
    expect(problemsOf({ ...valid(), link: 'x'.repeat(201) })).toMatch(/link: at most 200/)
  })

  it('wants the fixed characteristic values unless rolled, and rolled values within their dice', () => {
    const c = valid().characteristics
    expect(problemsOf({ ...valid(), characteristics: { ...c, STR: 80 } })).toMatch(/each used once/)
    expect(problemsOf({ ...valid(), characteristics: { ...c, EDU: undefined } })).toMatch(/missing EDU/)
    expect(problemsOf({ ...valid(), characteristics: { ...c, LUCK: 50 } })).toMatch(/unknown keys LUCK/)
    expect(problemsOf({ ...valid(), characteristics: { ...c, STR: '40' } })).toMatch(/characteristics.STR: a whole number/)
    const rolled = { STR: 15, CON: 90, SIZ: 40, DEX: 55, APP: 35, INT: 85, POW: 65, EDU: 75 }
    const ok = parseInvestigator({ ...valid(), rolled: true, characteristics: rolled })
    expect(ok.problems).toEqual([])
    expect(ok.warnings.join()).toMatch(/rolled/)
    expect(problemsOf({ ...valid(), rolled: true, characteristics: { ...rolled, SIZ: 35 } })).toMatch(/characteristics.SIZ: rolled with 2D6\+6 × 5, so a multiple of 5 from 40 to 90/)
    expect(problemsOf({ ...valid(), rolled: true, characteristics: { ...rolled, STR: 92 } })).toMatch(/characteristics.STR/)
    expect(problemsOf({ ...valid(), rolled: true, characteristics: { ...rolled, DEX: 52 } })).toMatch(/characteristics.DEX/)
    expect(problemsOf({ ...valid(), luck: 95 })).toMatch(/luck:/)
    expect(problemsOf({ ...valid(), luck: 52 })).toMatch(/luck:/)
  })

  it('wants eight occupation skills sharing the occupation values with credit rating', () => {
    const skills = valid().occupationSkills
    expect(problemsOf({ ...valid(), occupationSkills: skills.slice(0, 7) })).toMatch(/exactly 8 skills \(got 7\)/)
    expect(problemsOf({ ...valid(), creditRating: 70 })).toMatch(/share 70, 60, 60, 50, 50, 50, 40, 40, 40, each used once/)
    expect(problemsOf({ ...valid(), occupationSkills: skills.map((s, i) => (i === 7 ? { id: 'credit-rating', value: 40 } : s)) })).toMatch(/give its value in creditRating/)
    expect(problemsOf({ ...valid(), occupationSkills: skills.map((s, i) => (i === 7 ? { id: 'cthulhu-mythos', value: 40 } : s)) })).toMatch(/can't be learned at creation/)
    expect(problemsOf({ ...valid(), occupationSkills: skills.map((s, i) => (i === 7 ? { id: 'kung-fu', value: 40 } : s)) })).toMatch(/unknown skill "kung-fu"/)
    expect(problemsOf({ ...valid(), occupationSkills: skills.map((s, i) => (i === 7 ? { id: 'history', value: 40 } : s)) })).toMatch(/chosen twice/)
    // A journalist is a social occupation.
    expect(problemsOf({ ...valid(), occupationSkills: skills.map((s) => (s.id === 'fast-talk' ? { id: 'climb', value: 50 } : s)) })).toMatch(/at least one social skill/)
  })

  it('wants four personal interests outside the occupation, without values', () => {
    const interests = valid().personalInterests
    expect(problemsOf({ ...valid(), personalInterests: interests.slice(0, 3) })).toMatch(/exactly 4/)
    expect(problemsOf({ ...valid(), personalInterests: [...interests.slice(0, 3), { id: 'library-use' }] })).toMatch(/chosen twice/)
    expect(problemsOf({ ...valid(), personalInterests: [...interests.slice(0, 3), { id: 'swim', value: 40 }] })).toMatch(/no value/)
    // Plain ids are accepted too.
    expect(problemsOf({ ...valid(), personalInterests: ['stealth', 'occult', 'drive-auto', 'swim'] })).toBe('')
  })

  it('wants a specialty exactly where the skill takes one', () => {
    const skills = valid().occupationSkills
    expect(problemsOf({ ...valid(), occupationSkills: skills.map((s) => (s.id === 'art-craft' ? { id: 'art-craft', value: 60 } : s)) })).toMatch(/needs a specialty/)
    expect(problemsOf({ ...valid(), occupationSkills: skills.map((s) => (s.id === 'history' ? { ...s, specialty: 'Antique' } : s)) })).toMatch(/takes no specialty/)
    expect(problemsOf({ ...valid(), occupationSkills: skills.map((s) => (s.id === 'art-craft' ? { ...s, specialty: '<i>' } : s)) })).toMatch(/must not contain/)
  })

  it('checks the profile fields', () => {
    expect(problemsOf({ ...valid(), profile: { secrets: 'x' } })).toMatch(/profile.secrets: unknown field/)
    expect(problemsOf({ ...valid(), profile: { traits: 'x'.repeat(2001) } })).toMatch(/at most 2000/)
  })

  it('lists every problem at once, and warns when an occupation drops its own skills', () => {
    expect(parseInvestigator({ ...valid(), age: 5, luck: 7, name: '' }).problems).toHaveLength(3)
    const skills = valid().occupationSkills.map((s) => (s.id === 'history' ? { id: 'climb', value: 40 } : s))
    const p = parseInvestigator({ ...valid(), occupationSkills: skills })
    expect(p.problems).toEqual([])
    expect(p.warnings.join()).toMatch(/usually has history/)
  })
})
