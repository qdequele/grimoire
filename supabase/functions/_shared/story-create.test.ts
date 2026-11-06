import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { LENGTHS as APP_LENGTHS, THREATS as APP_THREATS, TONES as APP_TONES } from '../../../src/stories/create/brief'
import { createSystemPrompt, FORBIDDEN_NAMES, ideasUserPrompt, outlineUserPrompt, scenesUserPrompt, writingContext } from './create-prompt'
import { draftToStory, emptyDraft, mergeDraft, type DraftScene, type ImportDraft } from './import-draft'
import { STORY_SCHEMA } from './spec-bundle'
import {
  ideasSchema,
  LENGTHS,
  nextBatch,
  onlyScenes,
  orderLikeOutline,
  outlineSchema,
  outlineToDraft,
  parseBrief,
  parseOutline,
  pickIdeas,
  playersFor,
  storyMetaId,
  THREATS,
  TONES,
  type StoryBrief,
  type StoryOutline,
} from './story-create'

const brief = (over: Partial<StoryBrief> = {}): StoryBrief => ({
  lang: 'en', era: '1920s', place: 'A mill town', tone: 'folk', threat: 'cult', hook: 'Children vanish at harvest.',
  ideas: '', avoid: 'harm to animals', investigators: 3, length: 'short', ...over,
})

const outlineInput = {
  title: 'Test Story',
  summary: 'A pitch.',
  era: '1920s',
  setting: 'Mill town',
  contentWarnings: ['missing children'],
  overview: { secret: 'The miller did it.', steps: ['[[arrival]]'], mustNotMiss: [], branches: [], ifStuck: [], keeperTips: [] },
  acts: [
    {
      id: 'Act One',
      title: 'Arrival',
      scenes: [
        { id: 'arrival', title: 'Arrival', summary: 'They arrive.', clues: ['A torn ribbon'], npcs: ['miller', 'ghost'], next: ['mill', 'nowhere'] },
        { id: 'mill', title: 'The mill', summary: 'The mill.', clues: [], npcs: [], next: [] },
      ],
    },
    { id: 'act-2', title: 'End', scenes: [{ id: 'arrival', title: 'Field at night', summary: '', clues: [], npcs: [], next: ['arrival'] }] },
  ],
  npcs: [{ id: 'miller', name: 'Abel Roe', kind: 'person', role: 'Miller', description: 'Floury hands.' }],
}

const scene = (id: string, over: Partial<DraftScene> = {}): DraftScene => ({
  id, title: id, ref: '', lead: 'Lead.', readAloud: ['You see it.'], flow: [], notes: [], npcs: [], handouts: [],
  rolls: [], ambience: [], sfx: [], place: '', preset: '', time: '', next: [], ...over,
})

describe('questionnaire presets', () => {
  it('match the creator form in src/stories/create/brief.ts', () => {
    expect(TONES.map((x) => x.id)).toEqual(APP_TONES.map((x) => x.id))
    expect(THREATS.map((x) => x.id)).toEqual(APP_THREATS.map((x) => x.id))
    expect(LENGTHS.map((x) => x.id)).toEqual(APP_LENGTHS.map((x) => x.id))
  })
})

describe('parseBrief', () => {
  it('caps text, rejects unknown ids, clamps the number of investigators', () => {
    const b = parseBrief({ lang: 'de', tone: 'space-opera', threat: 'cult', hook: 'x'.repeat(5000), investigators: 40, length: 'epic' })
    expect(b).toMatchObject({ lang: 'fr', tone: '', threat: 'cult', investigators: 8, length: 'oneshot', era: '' })
    expect((b as StoryBrief).hook).toHaveLength(600)
  })

  it('rejects a non-object', () => {
    expect(typeof parseBrief('nope')).toBe('string')
  })

  it('derives the players range', () => {
    expect(playersFor(1)).toEqual({ min: 1, max: 2 })
    expect(playersFor(4)).toEqual({ min: 3, max: 5 })
  })
})

describe('structured output schemas', () => {
  const required = (s: unknown): string[] => {
    if (!s || typeof s !== 'object') return []
    const o = s as Record<string, unknown>
    const bad: string[] = []
    if (o.type === 'object') {
      const props = Object.keys(o.properties as object)
      if (JSON.stringify(o.required) !== JSON.stringify(props) || o.additionalProperties !== false) bad.push(props.join())
    }
    for (const v of Object.values(o)) bad.push(...(Array.isArray(v) ? v.flatMap(required) : required(v)))
    return bad
  }

  it('require every field and forbid extras (structured outputs rules)', () => {
    expect(required(outlineSchema())).toEqual([])
    expect(required(ideasSchema())).toEqual([])
  })
})

describe('parseOutline', () => {
  it('normalises ids, removes duplicates and dangling links', () => {
    const o = parseOutline(outlineInput) as StoryOutline
    expect(o.acts.map((a) => a.id)).toEqual(['act-one', 'act-2'])
    const ids = o.acts.flatMap((a) => a.scenes.map((s) => s.id))
    expect(ids).toEqual(['arrival', 'mill', 'arrival-2'])
    expect(o.acts[0].scenes[0].npcs).toEqual(['miller'])
    expect(o.acts[0].scenes[0].next).toEqual(['mill'])
    expect(o.acts[1].scenes[0].next).toEqual(['arrival'])
    expect(o.overview.secret).toBe('The miller did it.')
  })

  it('keeps the keeper’s edits and refuses an outline with no scene', () => {
    const edited = { ...outlineInput, title: 'Renamed', acts: [{ ...outlineInput.acts[0], scenes: [outlineInput.acts[0].scenes[1]] }] }
    expect((parseOutline(edited) as StoryOutline).title).toBe('Renamed')
    expect(typeof parseOutline({ ...outlineInput, acts: [] })).toBe('string')
  })

  it('caps the number of scenes', () => {
    const many = { ...outlineInput, acts: [{ id: 'a', title: 'A', scenes: Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, title: `S${i}` })) }] }
    expect((parseOutline(many) as StoryOutline).acts[0].scenes).toHaveLength(16)
  })
})

describe('writing scenes in batches', () => {
  const o = parseOutline(outlineInput) as StoryOutline

  it('starts from the outline and goes through the scenes in order', () => {
    let d = outlineToDraft(o, brief())
    expect(d.title).toBe('Test Story')
    expect(d.duration).toBe('2 hours')
    expect(d.npcs[0]).toMatchObject({ id: 'miller', stats: [] })
    expect(nextBatch(o, d, 2)).toEqual(['arrival', 'mill'])

    // The model answers with the second scene in the wrong act and an extra scene: ignored / fixed.
    const batch: ImportDraft = {
      ...emptyDraft(),
      acts: [{ id: 'act-2', title: '', scenes: [scene('mill'), scene('arrival'), scene('bonus')] }],
      npcs: [{ ...d.npcs[0], stats: [{ key: 'STR', value: 60 }], personality: 'Gruff' }],
    }
    d = orderLikeOutline(mergeDraft(d, onlyScenes(batch, ['arrival', 'mill'])), o)
    expect(d.acts.map((a) => a.scenes.map((s) => s.id))).toEqual([['arrival', 'mill'], []])
    expect(d.npcs[0].stats).toEqual([{ key: 'STR', value: 60 }])
    expect(nextBatch(o, d, 2)).toEqual(['arrival-2'])
    expect(writingContext(o, d)).toContain('not detailed yet: none')
  })

  it('makes a valid private story with the creator meta', () => {
    const d = { ...outlineToDraft(o, brief()), acts: [{ id: 'act-one', title: 'Arrival', scenes: [scene('arrival')] }] }
    const story = draftToStory(d, { id: storyMetaId(o.title, 'abcdef123'), lang: 'en', players: playersFor(3), contentWarnings: o.contentWarnings, tags: ['grimoire-creator'] })
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(STORY_SCHEMA)
    expect(validate(story), JSON.stringify(validate.errors)).toBe(true)
    expect(story.meta).toMatchObject({ id: 'test-story-abcdef', license: 'private', players: { min: 2, max: 4 }, contentWarnings: ['missing children'] })
  })
})

describe('pickIdeas', () => {
  it('fills only empty fields, or the one asked for', () => {
    const out = { era: 'X', place: 'Y', hook: 'Z', ideas: 'W' }
    expect(pickIdeas(brief({ ideas: '' }), out)).toEqual({ ideas: 'W' })
    expect(pickIdeas(brief(), out, 'hook')).toEqual({ hook: 'Z' })
  })
})

describe('prompts', () => {
  it('tells Claude to stay original and avoid published names', () => {
    const p = createSystemPrompt()
    expect(p).toContain('ORIGINAL')
    for (const name of ['Cthulhu', 'Arkham', 'Necronomicon', 'Chaosium']) expect(FORBIDDEN_NAMES).toContain(name)
    expect(p).toContain('Necronomicon')
    // Stable across calls: nothing per-request in the cached block.
    expect(createSystemPrompt()).toBe(p)
  })

  it('maps the answers into the outline request', () => {
    const p = outlineUserPrompt(brief({ lang: 'fr', investigators: 5, length: 'multi', ideas: 'A scarecrow' }))
    expect(p).toContain('Write every text in French.')
    expect(p).toContain('Folk horror')
    expect(p).toContain('Investigators: 5')
    expect(p).toContain('10 to 14 scenes')
    expect(p).toContain('A scarecrow')
    expect(p).toContain('Content to avoid entirely (lines and veils):\nharm to animals')
  })

  it('leaves empty answers to Claude and passes revision notes', () => {
    const o = parseOutline(outlineInput) as StoryOutline
    const p = outlineUserPrompt(brief({ era: '', tone: '' }), { previous: o, notes: 'Less gore' })
    expect(p).toContain('Era: your choice')
    expect(p).toContain('Tone: your choice')
    expect(p).toContain('Less gore')
    expect(p).toContain('"title":"Test Story"')
    expect(outlineUserPrompt(brief(), { previous: o, notes: '' })).toContain('clearly different outline')
  })

  it('asks for exactly the batch’s scenes, with their acts', () => {
    const o = parseOutline(outlineInput) as StoryOutline
    const p = scenesUserPrompt(brief(), o, outlineToDraft(o, brief()), ['mill', 'arrival-2'])
    expect(p).toContain('"mill" (act "act-one"), "arrival-2" (act "act-2")')
    expect(p).toContain('NPCs from the outline not detailed yet: "miller"')
  })

  it('ideas: fill the gaps or one field', () => {
    expect(ideasUserPrompt(brief({ hook: '', ideas: '' }))).toContain('(era, place)')
    expect(ideasUserPrompt(brief(), 'place')).toContain('new idea for "place"')
    expect(ideasUserPrompt(brief({ era: '', place: '', hook: '', ideas: '' }))).toContain('fresh, original premise')
  })
})
