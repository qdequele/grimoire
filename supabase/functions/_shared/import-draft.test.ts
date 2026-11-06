import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'
import storySchema from '../../../spec/story.schema.json'
import {
  draftContext,
  draftToStory,
  emptyDraft,
  importDraftSchema,
  mergeDraft,
  normalizeDraft,
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
  ambience: [], sfx: [], next: [], ...extra,
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

  it('stays small: shared objects are defined once, long id lists are only described', () => {
    const text = JSON.stringify(schema)
    // "The compiled grammar is too large": roll is used by steps and scenes, scene and npc are big
    expect(Object.keys(schema.$defs as object)).toEqual(['roll', 'step', 'scene', 'npc'])
    expect(text.match(/"againstSkill":{/g)).toHaveLength(1)
    expect(text.match(/"readAloud":{/g)).toHaveLength(1)
    expect(text).not.toContain('"enum":["rain"')
    expect(text).toContain('only from: rain, wind')
    expect(text).toContain('only from: door-creak, footsteps')
  })
})

describe('normalizeDraft', () => {
  it('keeps a well-formed draft as it is', () => {
    expect(normalizeDraft(batchOne(), sounds)).toEqual({ ...batchOne() })
  })

  it('drops sound ids and stat keys outside their lists', () => {
    const d = batchOne()
    d.acts[0].scenes[0].ambience = ['rain', 'thunder']
    d.acts[0].scenes[0].sfx = ['footsteps', 'scream']
    d.npcs[0].stats = [{ key: 'DEX', value: 70 }, { key: 'LUCK' as 'DEX', value: 50 }]
    const n = normalizeDraft(d, sounds)
    expect(n.acts[0].scenes[0].ambience).toEqual(['rain'])
    expect(n.acts[0].scenes[0].sfx).toEqual(['footsteps'])
    expect(n.npcs[0].stats).toEqual([{ key: 'DEX', value: 70 }])
  })

  it('fills what is missing and fixes wrong types (the fallback without structured outputs)', () => {
    const n = normalizeDraft(
      {
        title: 'T',
        acts: [{ id: 'a', scenes: [{ id: 's', flow: [{ title: 'x', roll: [{ type: 'magic', bonus: '2' }, {}] }] }, { title: 'no id' }] }],
        npcs: [{ name: 'no id' }],
        handouts: 'nope',
      },
      sounds,
    )
    expect(n.overview).toEqual(emptyDraft().overview)
    expect(n.acts[0].scenes).toHaveLength(1)
    expect(n.acts[0].scenes[0]).toEqual(scene('s', '', {
      flow: [{ title: 'x', text: '', roll: [{ ...noRoll, bonus: 2 }], success: '', failure: '', pushed: '', extra: '', goto: [] }],
    }))
    expect(n.npcs).toEqual([])
    expect(n.handouts).toEqual([])
    expect(normalizeDraft(null, sounds)).toEqual(emptyDraft())
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
