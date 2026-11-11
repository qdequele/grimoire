import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'
import storySchema from '../../../spec/story.schema.json'
import { PLACES, PRESETS, TIMES } from '../../../src/screen/ambiance'
import {
  DRAFT_FORMAT_HEADING,
  draftAnswerFormat,
  draftContext,
  draftToStory,
  emptyDraft,
  importDraftSchema,
  mergeDraft,
  normalizeDraft,
  parseJsonAnswer,
  SCREEN_PLACES,
  SCREEN_PRESETS,
  SCREEN_TIMES,
  type DraftRoll,
  type DraftScene,
  type ImportDraft,
} from './import-draft'

const sounds = { ambience: ['rain', 'wind'], sfx: ['door-creak', 'footsteps'] }

const noRoll: DraftRoll = {
  type: 'skill', options: [], difficulty: 'regular', bonus: 0, san: '', dice: '', label: '', againstNpc: '', againstSkill: '',
}

const scene = (id: string, title: string, extra: Partial<DraftScene> = {}): DraftScene => ({
  id, title, ref: '', lead: '', readAloud: [], flow: [], notes: [], npcs: [], handouts: [], rolls: [],
  ambience: [], sfx: [], place: '', preset: '', time: '', next: [], ...extra,
})

// An original mini story, written for these tests.
function batchOne(): ImportDraft {
  return {
    ...emptyDraft(),
    title: 'The Clockmaker',
    summary: 'A clock that runs backwards.',
    era: '1920s',
    acts: [
      {
        id: 'shop',
        title: 'The shop',
        scenes: [
          scene('front-room', 'Front room', {
            lead: 'Dust and ticking.',
            readAloud: ['A hundred clocks, all wrong.'],
            flow: [
              {
                title: 'Look around',
                text: 'Every clock shows a different hour.',
                roll: [{ ...noRoll, options: ['spot-hidden'] }],
                success: 'A key under the counter.',
                failure: '',
                pushed: '',
                extra: '',
                goto: ['workshop'],
              },
              { title: 'Leave', text: '', roll: [], success: '', failure: '', pushed: '', extra: '', goto: [] },
            ],
            npcs: ['otto'],
            ambience: ['rain', 'wind', 'rain', 'wind'],
            rolls: [{ ...noRoll, type: 'san', san: '0/1D3', label: 'The stopped heart' }],
          }),
          scene('workshop', 'Workshop (start)'),
        ],
      },
    ],
    npcs: [
      {
        id: 'otto', name: 'Otto Brandt', kind: 'person', role: 'Clockmaker', description: '', personality: 'Nervous.',
        knows: ['The clock was a gift.'], stats: [{ key: 'DEX', value: 70 }, { key: 'hp', value: 9 }], damageBonus: '',
        attacks: [{ name: 'Screwdriver', skill: 30, damage: '1D4', note: '' }], skills: [{ id: 'mechanical-repair', value: 80 }],
        sanLoss: '', special: [],
      },
    ],
  }
}

function batchTwo(): ImportDraft {
  return {
    ...emptyDraft(),
    title: 'Ignored: title already known',
    setting: 'Boston',
    acts: [
      { id: 'shop', title: 'The shop', scenes: [scene('workshop', 'Workshop', { lead: 'Gears everywhere.' })] },
      { id: 'night', title: 'Midnight', scenes: [scene('chime', 'The chime')] },
    ],
  }
}

describe('importDraftSchema', () => {
  const schema = importDraftSchema(sounds)

  function walk(node: unknown, visit: (n: Record<string, unknown>) => void) {
    if (!node || typeof node !== 'object') return
    if (!Array.isArray(node)) visit(node as Record<string, unknown>)
    Object.values(node).forEach((v) => walk(v, visit))
  }

  it('has no optional fields: every object requires all its properties and forbids extras', () => {
    walk(schema, (n) => {
      if (n.type !== 'object') return
      expect(n.additionalProperties).toBe(false)
      expect(n.required).toEqual(Object.keys(n.properties as object))
    })
  })

  it('uses no unions and no keywords structured outputs reject', () => {
    const forbidden = ['anyOf', 'oneOf', 'allOf', 'minimum', 'maximum', 'minLength', 'maxLength', 'maxItems', 'pattern']
    walk(schema, (n) => forbidden.forEach((k) => expect(n).not.toHaveProperty(k)))
  })

  it("takes the ambiance screen's values from the story format, the app's own lists", () => {
    expect(SCREEN_PLACES).toEqual([...PLACES])
    expect(SCREEN_PRESETS).toEqual([...PRESETS])
    expect(SCREEN_TIMES).toEqual([...TIMES])
    const text = JSON.stringify(schema)
    expect(text).toContain(`"enum":${JSON.stringify(['', ...PLACES])}`)
    expect(text).toContain(`"enum":${JSON.stringify(['', ...PRESETS])}`)
  })

  it('only lets the model pick sound ids that exist', () => {
    const text = JSON.stringify(schema)
    expect(text).toContain('"enum":["rain","wind"]')
    expect(text).toContain('"enum":["door-creak","footsteps"]')
  })
})

describe('parseJsonAnswer', () => {
  it('reads a bare object, a fenced one, or one inside a sentence', () => {
    expect(parseJsonAnswer('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonAnswer('```json\n{"a":{"b":[1]}}\n```')).toEqual({ a: { b: [1] } })
    expect(parseJsonAnswer('Here it is: {"a":1} Done.')).toEqual({ a: 1 })
  })

  it('returns null for anything else', () => {
    expect(parseJsonAnswer('no json')).toBeNull()
    expect(parseJsonAnswer('{"a":')).toBeNull()
  })
})

describe('draftAnswerFormat', () => {
  it('gives the model the draft schema as text', () => {
    const f = draftAnswerFormat({ ambience: ['amb-rain'], sfx: [] })
    expect(f.startsWith(DRAFT_FORMAT_HEADING)).toBe(true)
    expect(f).toContain('"amb-rain"')
    expect(f).toContain('"flow"')
  })

  it('pairs with normalizeDraft: a sloppy answer becomes a well-typed draft', () => {
    const d = normalizeDraft(parseJsonAnswer('{"acts":[{"id":"a","scenes":[{"id":"s","place":"nowhere","preset":"fog"}]}]}'))
    expect(d.acts[0].scenes[0]).toMatchObject({ id: 's', place: '', preset: 'fog', flow: [], readAloud: [] })
    expect(d.npcs).toEqual([])
  })
})

describe('draftToStory', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const validate = ajv.compile(storySchema)

  it('produces a story that validates against spec/story.schema.json', () => {
    const story = draftToStory(batchOne(), { id: 'the-clockmaker', lang: 'en' })
    const ok = validate(story)
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it('marks imported stories private', () => {
    const story = draftToStory(batchOne(), { id: 'x', lang: 'en' }) as { meta: { license: string } }
    expect(story.meta.license).toBe('private')
  })

  it('drops empty fields, keeps at most 3 ambience sounds, and maps stats', () => {
    const story = draftToStory(batchOne(), { id: 'x', lang: 'en' }) as {
      acts: Array<{ scenes: Array<Record<string, unknown>> }>
      npcs: Array<Record<string, unknown>>
    }
    const front = story.acts[0].scenes[0]
    expect(front.ambience).toEqual(['rain', 'wind', 'rain'])
    expect(front).not.toHaveProperty('ref')
    const leave = (front.flow as Array<Record<string, unknown>>)[1]
    expect(leave).toEqual({ title: 'Leave' })
    expect(story.npcs[0]).toMatchObject({ characteristics: { DEX: 70 }, hp: 9, skills: { 'mechanical-repair': 80 } })
    expect(story.npcs[0]).not.toHaveProperty('kind') // 'person' is the default
  })

  it("writes the scene's ambiance screen, dropping what the format doesn't know", () => {
    const d = { ...emptyDraft(), title: 'T', acts: [{ id: 'a', title: 'A', scenes: [
      scene('crypt', 'Crypt', { place: 'crypt', preset: 'ritual', time: 'night' }),
      scene('road', 'Road', { place: 'disco', preset: 'snow', time: 'noon' }),
      scene('plain', 'Plain'),
    ] }] }
    const story = draftToStory(d, { id: 'x', lang: 'en' }) as { acts: Array<{ scenes: Array<Record<string, unknown>> }> }
    const [crypt, road, plain] = story.acts[0].scenes
    expect(crypt.screen).toEqual({ place: 'crypt', preset: 'ritual', time: 'night' })
    expect(road.screen).toEqual({ preset: 'snow' })
    expect(plain).not.toHaveProperty('screen')
    expect(validate(story), JSON.stringify(validate.errors)).toBe(true)
  })

  it('writes items as story items: weapons, uses, help; sloppy values are coerced or dropped', () => {
    const d = normalizeDraft({
      ...batchOne(),
      items: [
        { id: 'pistol', name: 'Old <pistol>', kind: 'weapon', art: 'revolver', text: 'Rusty.', scene: 'front-room', weaponSkill: 'firearms-handgun', damage: '1d10 dmg', addsDamageBonus: true, range: '15 m', rate: '1', uses: 6, unit: 'balles', ammo: '.38', helpsSkill: '', helpsNote: '' },
        { id: 'rope', name: 'Rope', kind: 'tool', weapon: { skill: 'climb' }, bonus: { skill: 'climb', note: 'bonus die' }, uses: 0, unit: 'balles' },
        { id: 'charm', name: 'Charm', kind: 'spell' },
        { id: '', name: 'No id', kind: 'tool' },
      ],
    }, sounds)
    expect(d.items.map((x) => x.id)).toEqual(['pistol', 'rope'])
    const story = draftToStory(d, { id: 'the-clockmaker', lang: 'en' }) as { items: unknown[] }
    expect(story.items).toEqual([
      { id: 'pistol', name: 'Old pistol', kind: 'weapon', art: 'revolver', text: 'Rusty.', weapon: { skill: 'firearms-handgun', damage: '1D10', range: '15 m', rate: '1', impale: true }, uses: 6, unit: 'balles', ammo: '.38', scene: 'front-room' },
      { id: 'rope', name: 'Rope', kind: 'tool', bonus: { skill: 'climb', note: 'bonus die' } },
    ])
    expect(validate(story), JSON.stringify(validate.errors)).toBe(true)
    // Drafts saved before items existed still merge and convert.
    const old = { ...batchOne() } as Partial<ImportDraft>
    delete old.items
    expect(mergeDraft(old as ImportDraft, d).items).toHaveLength(2)
  })

  it('keeps SAN and damage values only on the matching roll type', () => {
    const story = draftToStory(batchOne(), { id: 'x', lang: 'en' }) as {
      acts: Array<{ scenes: Array<{ rolls: unknown[]; flow: Array<{ roll?: unknown }> }> }>
    }
    expect(story.acts[0].scenes[0].rolls[0]).toEqual({ type: 'san', san: '0/1D3', label: 'The stopped heart' })
    expect(story.acts[0].scenes[0].flow[0].roll).toEqual({ type: 'skill', options: ['spot-hidden'] })
  })
})

describe('mergeDraft', () => {
  const merged = mergeDraft(mergeDraft(emptyDraft(), batchOne()), batchTwo())

  it('keeps the first known title and fills fields still empty', () => {
    expect(merged.title).toBe('The Clockmaker')
    expect(merged.setting).toBe('Boston')
  })

  it('replaces a scene continued across a page break and appends new acts', () => {
    expect(merged.acts.map((a) => a.id)).toEqual(['shop', 'night'])
    const shop = merged.acts[0]
    expect(shop.scenes.map((s) => s.id)).toEqual(['front-room', 'workshop'])
    expect(shop.scenes[1].title).toBe('Workshop')
  })

  it('keeps NPCs from earlier batches', () => {
    expect(merged.npcs.map((n) => n.id)).toEqual(['otto'])
  })
})

describe('draftContext', () => {
  it('says when nothing is imported yet', () => {
    expect(draftContext(emptyDraft())).toMatch(/first pages/)
  })

  it('lists existing ids so the next batch reuses them', () => {
    const ctx = draftContext(batchOne())
    expect(ctx).toContain('"front-room"')
    expect(ctx).toContain('"otto" (Otto Brandt)')
  })
})
