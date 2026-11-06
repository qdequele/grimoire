import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { CRAFT_RULES, createSystemPrompt, FORBIDDEN_NAMES, ORIGINALITY_RULES, PLACE_HINTS, PRESET_HINTS, TIME_HINTS } from './create-prompt'
import { draftToStory, SCREEN_PLACES, SCREEN_PRESETS, SCREEN_TIMES } from './import-draft'
import { SAMPLE_STORY, STORY_SCHEMA } from './spec-bundle'
import {
  applyEdits,
  EDIT_OPS,
  forbiddenNamesIn,
  GUIDE_TOPICS,
  guideText,
  normalizeDraft,
  relax,
  sceneCount,
  SERVER_INSTRUCTIONS,
  SOUND_IDS,
  storyPart,
  storySummary,
  ToolError,
  toolDefinitions,
} from './story-mcp'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(STORY_SCHEMA)
const sample = () => structuredClone(SAMPLE_STORY) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const firstScene = (s: Record<string, any>) => s.acts[0].scenes[0] // eslint-disable-line @typescript-eslint/no-explicit-any
const allSceneIds = (s: unknown) => storySummary(s).acts.flatMap((a) => a.scenes.map((x) => x.id))

describe('normalizeDraft', () => {
  it('turns garbage into an empty, well-typed draft', () => {
    for (const input of [null, 'text', 42, [], { acts: 'no', npcs: {}, overview: [] }]) {
      const d = normalizeDraft(input)
      expect(d.acts).toEqual([])
      expect(d.overview.steps).toEqual([])
      expect(() => draftToStory(d, { id: 'x', lang: 'en', fallbackTitle: 'T' })).not.toThrow()
    }
  })

  it('fills missing fields, coerces types and drops what has no id', () => {
    const d = normalizeDraft({
      title: 'A title',
      acts: [
        {
          id: 'act-1',
          scenes: [
            {
              id: 'the-mill',
              title: 'The mill',
              readAloud: 'one paragraph',
              flow: [{ title: 'Search', roll: { type: 'skill', options: ['spot-hidden'], bonus: 7 } }],
              ambience: ['not-a-sound', SOUND_IDS.ambience[0]],
            },
            { title: 'no id' },
          ],
        },
        { title: 'act without id', scenes: [{ id: 'x' }] },
      ],
      npcs: [{ id: 'miller', name: 'The miller', skills: { persuade: 55 }, stats: [{ key: 'STR', value: '60' }, { key: 'nope', value: 1 }] }, { id: 'nameless' }],
    })
    expect(d.acts).toHaveLength(1)
    const sc = d.acts[0].scenes
    expect(sc).toHaveLength(1)
    expect(sc[0].readAloud).toEqual(['one paragraph'])
    expect(sc[0].flow[0].roll).toEqual([expect.objectContaining({ options: ['spot-hidden'], bonus: 2, difficulty: 'regular' })])
    expect(sc[0].ambience).toEqual([SOUND_IDS.ambience[0]])
    expect(d.npcs).toEqual([expect.objectContaining({ id: 'miller', skills: [{ id: 'persuade', value: 55 }], stats: [{ key: 'STR', value: 60 }] })])
  })

  it("keeps a scene's ambiance screen, as draft fields or as story.json's screen, and drops unknown values", () => {
    const d = normalizeDraft({ acts: [{ id: 'a', scenes: [
      { id: 'one', place: 'library', preset: 'candle', time: 'dusk' },
      { id: 'two', screen: { place: 'graveyard', preset: 'fog', time: 'day' } },
      { id: 'three', place: 'spaceship', preset: 42 },
    ] }] })
    expect(d.acts[0].scenes.map((s) => [s.place, s.preset, s.time])).toEqual([['library', 'candle', 'dusk'], ['graveyard', 'fog', 'day'], ['', '', '']])
  })

  it('makes a draft the story schema accepts', () => {
    const d = normalizeDraft({
      title: 'T',
      acts: [{ id: 'a', title: 'A', scenes: [{ id: 's', title: 'S', lead: 'Lead.', flow: [{ title: 'Step', success: 'ok' }] }] }],
      npcs: [{ id: 'n', name: 'N', kind: 'creature', stats: [{ key: 'hp', value: 12 }], attacks: [{ name: 'Claw', skill: 150, damage: '1D6' }] }],
    })
    const story = draftToStory(d, { id: 'meta-id', lang: 'en' })
    expect(validate(story), JSON.stringify(validate.errors)).toBe(true)
  })
})

describe('forbiddenNamesIn', () => {
  it('finds names in any text, as written or in capitals', () => {
    expect(forbiddenNamesIn({ a: [{ b: 'They went to Arkham at dawn.' }], c: 'THE NECRONOMICON' })).toEqual(['Arkham', 'Necronomicon'])
    expect(forbiddenNamesIn('R’lyeh rises')).toEqual(["R'lyeh"])
  })

  it('ignores skill ids, other words and other capitalisations', () => {
    const story = {
      acts: [{ scenes: [{ flow: [{ roll: { type: 'skill', options: ['cthulhu-mythos'] } }], rolls: [{ against: { skill: 'cthulhu-mythos' } }] }] }],
      npcs: [{ skills: { 'cthulhu-mythos': 10 } }, { skills: [{ id: 'cthulhu-mythos', value: 5 }] }],
      text: 'Sir Dagonet and the deep ones of the lake; mythos as a word.',
    }
    expect(forbiddenNamesIn(story)).toEqual([])
  })

  it('knows every name the prompt forbids', () => {
    for (const name of FORBIDDEN_NAMES) expect(forbiddenNamesIn(`x ${name} y`)).toContain(name)
  })

  it('finds nothing in the sample story', () => {
    expect(forbiddenNamesIn(SAMPLE_STORY)).toEqual([])
  })
})

describe('reading a story', () => {
  it('summarises meta, overview and every id', () => {
    const sum = storySummary(SAMPLE_STORY)
    expect(sum.meta).toMatchObject({ id: expect.any(String), title: expect.any(String), lang: expect.any(String) })
    expect(sum.acts.length).toBeGreaterThan(0)
    expect(sum.acts.flatMap((a) => a.scenes).length).toBe(sceneCount(SAMPLE_STORY))
    expect(JSON.stringify(sum)).not.toContain('readAloud')
  })

  it('returns parts, scenes filtered by id', () => {
    const ids = allSceneIds(SAMPLE_STORY)
    const part = storyPart(SAMPLE_STORY, 'scenes', [ids[1]]) as { acts: Array<{ scenes: Array<{ id: string }> }> }
    expect(part.acts.flatMap((a) => a.scenes.map((s) => s.id))).toEqual([ids[1]])
    expect(sceneCount(storyPart(SAMPLE_STORY, 'scenes'))).toBe(ids.length)
    expect(storyPart(SAMPLE_STORY, 'all')).toEqual(SAMPLE_STORY)
    expect(storyPart(SAMPLE_STORY, 'npcs')).toHaveProperty('npcs')
  })
})

describe('applyEdits', () => {
  it('replaces a scene in place and keeps the story valid', () => {
    const s = sample()
    const scene = { ...firstScene(s), title: 'A new title' }
    const out = applyEdits(s, [{ op: 'put_scene', scene }]) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(firstScene(out).title).toBe('A new title')
    expect(allSceneIds(out)).toEqual(allSceneIds(s))
    expect(validate(out), JSON.stringify(validate.errors)).toBe(true)
    expect(firstScene(s).title).not.toBe('A new title') // the input is not changed
  })

  it('adds a scene after another, moves one between acts, adds an act', () => {
    const s = sample()
    const ids = allSceneIds(s)
    let out = applyEdits(s, [{ op: 'put_scene', actId: s.acts[0].id, after: ids[0], scene: { id: 'new-scene', title: 'New' } }])
    expect(allSceneIds(out)).toEqual([ids[0], 'new-scene', ...ids.slice(1)])
    out = applyEdits(out, [
      { op: 'put_act', act: { id: 'epilogue', title: 'Epilogue', scenes: [{ id: 'ignored' }] } },
      { op: 'put_scene', actId: 'epilogue', scene: { id: 'new-scene', title: 'Moved' } },
    ])
    const sum = storySummary(out)
    expect(sum.acts.at(-1)).toEqual({ id: 'epilogue', title: 'Epilogue', scenes: [{ id: 'new-scene', title: 'Moved' }] })
    expect(allSceneIds(out).filter((x) => x === 'new-scene')).toHaveLength(1)
  })

  it('removes a scene and the links to it', () => {
    const s = sample()
    const [a, b] = allSceneIds(s)
    firstScene(s).next = [b]
    const out = applyEdits(s, [{ op: 'remove_scene', id: b }]) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(allSceneIds(out)).not.toContain(b)
    expect(firstScene(out).id).toBe(a)
    expect(firstScene(out).next ?? []).not.toContain(b)
  })

  it('puts and removes NPCs and handouts, scrubbing scene references', () => {
    const s = sample()
    const npcId = s.npcs[0].id
    const out = applyEdits(s, [
      { op: 'put_npc', npc: { id: 'newcomer', name: 'A newcomer' } },
      { op: 'remove_npc', id: npcId },
      { op: 'put_handout', handout: { id: 'letter', title: 'A letter', text: 'Dear…' } },
    ]) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(out.npcs.map((n: { id: string }) => n.id)).not.toContain(npcId)
    expect(out.npcs.at(-1).id).toBe('newcomer')
    expect(JSON.stringify(out.acts)).not.toContain(`"${npcId}"`)
    expect(out.handouts.at(-1).id).toBe('letter')
    const back = applyEdits(out, [{ op: 'remove_handout', id: 'letter' }]) as Record<string, unknown>
    expect(JSON.stringify(back)).not.toContain('"letter"')
  })

  it('sets the overview and the allowed meta fields only', () => {
    const s = sample()
    const out = applyEdits(s, [
      { op: 'set_overview', overview: { secret: 'New secret.' } },
      { op: 'set_info', info: { title: 'Renamed', players: { min: 2, max: 5 } } },
    ]) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(out.overview).toEqual({ secret: 'New secret.' })
    expect(out.meta).toMatchObject({ title: 'Renamed', id: s.meta.id, license: s.meta.license })
    for (const field of ['id', 'license', 'lang', 'format']) {
      expect(() => applyEdits(s, [{ op: 'set_info', info: { [field]: 'x' } }])).toThrow(ToolError)
    }
  })

  it("set_screen changes only a scene's ambiance screen; {} removes it", () => {
    const s = sample()
    const id = firstScene(s).id
    const out = applyEdits(s, [{ op: 'set_screen', id, screen: { place: 'harbour', preset: 'storm', image: '' } }]) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(firstScene(out)).toEqual({ ...firstScene(s), screen: { place: 'harbour', preset: 'storm' } })
    expect(validate(out), JSON.stringify(validate.errors)).toBe(true)
    const back = applyEdits(out, [{ op: 'set_screen', id, screen: {} }]) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(firstScene(back)).toEqual(firstScene(s))
    expect(() => applyEdits(s, [{ op: 'set_screen', id: 'nowhere', screen: {} }])).toThrow(ToolError)
    expect(() => applyEdits(s, [{ op: 'set_screen', id, screen: 'fog' }])).toThrow(ToolError)
    // An unknown value gets through applyEdits but not the schema check that follows it.
    expect(validate(applyEdits(s, [{ op: 'set_screen', id, screen: { place: 'moon' } }]))).toBe(false)
  })

  it('refuses bad operations, naming the one at fault, and applies none', () => {
    const s = sample()
    const bad: unknown[] = [
      [],
      'ops',
      [{ op: 'explode' }],
      [{ op: 'put_scene', scene: { title: 'no id' } }],
      [{ op: 'put_scene', actId: 'nowhere', scene: { id: 'x' } }],
      [{ op: 'remove_scene', id: 'nowhere' }],
      [{ op: 'remove_act', id: s.acts[0].id }],
      [{ op: 'remove_npc', id: 'nobody' }],
      Array.from({ length: 21 }, () => ({ op: 'set_overview', overview: {} })),
    ]
    for (const ops of bad) expect(() => applyEdits(s, ops), JSON.stringify(ops).slice(0, 80)).toThrow(ToolError)
    expect(() => applyEdits(s, [{ op: 'set_overview', overview: {} }, { op: 'remove_scene', id: 'nowhere' }])).toThrow(/ops\[1\]/)
    expect(s).toEqual(SAMPLE_STORY)
  })
})

describe('guide and tools', () => {
  it('serves the creator prompt\'s own rules', () => {
    const prompt = createSystemPrompt()
    expect(prompt).toContain(ORIGINALITY_RULES)
    expect(prompt).toContain(CRAFT_RULES)
    expect(guideText('rules')).toContain(ORIGINALITY_RULES)
    expect(guideText('rules')).toContain(CRAFT_RULES)
    for (const topic of GUIDE_TOPICS) expect(guideText(topic).length).toBeGreaterThan(200)
    expect(guideText('example')).toContain(JSON.stringify(SAMPLE_STORY, null, 1))
    expect(SERVER_INSTRUCTIONS).toContain('grimoire_guide')
  })

  it('names every tool the guide mentions, with valid JSON Schemas and annotations', () => {
    const tools = toolDefinitions()
    const names = tools.map((t) => t.name)
    expect(names).toEqual(['grimoire_guide', 'save_outline', 'write_scenes', 'list_my_stories', 'get_story', 'edit_story'])
    for (const name of names) expect(guideText('workflow') + SERVER_INSTRUCTIONS).toContain(name)
    const ajv = new Ajv2020({ strict: false })
    for (const t of tools) {
      expect(() => ajv.compile(t.inputSchema), t.name).not.toThrow()
      expect(t.inputSchema.type).toBe('object')
      expect(JSON.stringify(t.inputSchema)).not.toContain('$ref')
      expect(t.annotations.readOnlyHint).toBe(['grimoire_guide', 'list_my_stories', 'get_story'].includes(t.name))
      // The ChatGPT and Claude directories: a title on every tool, and every hint an explicit boolean.
      expect(t.title, t.name).toBeTruthy()
      expect(t.name.length).toBeLessThanOrEqual(64)
      expect(t.annotations, t.name).toEqual({
        readOnlyHint: expect.any(Boolean),
        destructiveHint: t.name === 'edit_story',
        openWorldHint: false,
      })
    }
    const edit = tools.find((t) => t.name === 'edit_story')!
    for (const op of EDIT_OPS) expect(edit.description).toContain(op)
  })

  it("describes every décor and atmosphere of the ambiance screen", () => {
    expect(Object.keys(PLACE_HINTS)).toEqual([...SCREEN_PLACES])
    expect(Object.keys(PRESET_HINTS)).toEqual([...SCREEN_PRESETS])
    expect(Object.keys(TIME_HINTS)).toEqual([...SCREEN_TIMES])
    const sounds = guideText('sounds')
    for (const p of [...SCREEN_PLACES, ...SCREEN_PRESETS, ...SCREEN_TIMES]) expect(sounds).toContain(`${p} (`)
    expect(createSystemPrompt()).toContain(sounds)
  })

  it('relaxes required fields except the ones kept', () => {
    const s = { type: 'object', required: ['id', 'title', 'x'], properties: { list: { type: 'array', items: { type: 'object', required: ['x'] } } } }
    expect(relax(s, ['id'])).toEqual({ type: 'object', required: ['id'], properties: { list: { type: 'array', items: { type: 'object' } } } })
  })
})
