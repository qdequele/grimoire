// Round trip on the real legacy data: legacy constants → story.json → engine data must give back
// exactly what the legacy engine read. Runs only where the private dump exists (private/legacy-dump).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020'
import { describe, expect, it } from 'vitest'
import storySchema from '../../../spec/story.schema.json'
import { SKILL_BY_ID, SKILLS } from '../../rules/d100'
import { storyToEngine, type StoryForEngine } from './adapter.ts'
import { legacyToStories } from './convert.ts'
import type { LegacyDump, LegacyScene } from './types.ts'

const DIR = 'private/legacy-dump'
const hasDump = existsSync(DIR)

function loadDump(): LegacyDump {
  const out: Record<string, unknown> = {}
  for (const f of readdirSync(DIR)) out[f.replace('.json', '')] = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))
  return out as unknown as LegacyDump
}

const labelToId = Object.fromEntries(SKILLS.map((s) => [s.label, s.id]))
const skillLabel = (id: string) => SKILL_BY_ID.get(id)?.label ?? id

/** What the engine sees: empty arrays and empty strings behave like missing keys. */
function norm(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(norm)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== undefined && x !== '' && !(Array.isArray(x) && x.length === 0))
        .map(([k, x]) => [k, norm(x)]),
    )
  }
  return v
}

describe.skipIf(!hasDump)('legacy data round trip', () => {
  const dump = hasDump ? loadDump() : ({} as LegacyDump)
  const english = existsSync('private/engine-data.json')
    ? (JSON.parse(readFileSync('private/engine-data.json', 'utf8')).I18N?.ui as Record<string, string>)
    : {}
  const stories = hasDump ? legacyToStories(dump, labelToId, english) : []
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  const validate = ajv.compile(storySchema)

  it('converts every playable scenario', () => {
    expect(stories.map((s) => (s.meta as { id: string }).id)).toEqual(dump.SCENARIOS.filter((s) => s.acts?.length).map((s) => s.id))
  })

  for (const sc of hasDump ? dump.SCENARIOS.filter((s) => s.acts?.length) : []) {
    describe(sc.id, () => {
      const story = stories.find((s) => (s.meta as { id: string }).id === sc.id)!
      const engine = storyToEngine(story as unknown as StoryForEngine, skillLabel)
      const sceneIds = sc.acts!.flatMap((a) => a.scenes.map((s) => s.id))
      const pick = <T,>(m: Record<string, T>) => Object.fromEntries(sceneIds.filter((id) => m[id]).map((id) => [id, m[id]]))

      it('validates against spec/story.schema.json', () => {
        validate(story)
        expect(validate.errors ?? []).toEqual([])
      })

      it('gives back the scenario header', () => {
        const { acts: _a, status: _s, ...rest } = sc
        const { acts: _b, status: _t, ...back } = engine.SCENARIO
        expect(norm(back)).toEqual(norm(rest))
      })

      it('gives back every act and scene, field for field', () => {
        const strip = (s: LegacyScene) => {
          const { secsFirst: _f, ...rest } = s
          return rest
        }
        expect(norm(engine.SCENARIO.acts!.map((a) => ({ ...a, scenes: a.scenes.map(strip) })))).toEqual(norm(sc.acts))
      })

      it('keeps the one scene shown with notes before the read-aloud text', () => {
        const flagged = engine.SCENARIO.acts!.flatMap((a) => a.scenes).filter((s) => s.secsFirst).map((s) => s.id)
        expect(flagged).toEqual(sceneIds.filter((id) => id === 'rupert'))
      })

      it('gives back sounds and NPCs per scene', () => {
        expect(engine.AMB_FOR).toEqual(pick(dump.AMB_FOR))
        expect(engine.SFX_FOR).toEqual(pick(dump.SFX_FOR))
        expect(engine.SCENE_NPC).toEqual(pick(dump.SCENE_NPC))
      })

      it('gives back NPC descriptions and creature stats', () => {
        const npcX = (sc.lang === 'en' ? dump.NPC_X_EN : dump.NPC_X) ?? dump.NPC_X
        const ids = Object.keys(engine.NPC_X)
        expect(engine.NPC_X).toEqual(Object.fromEntries(ids.map((id) => [id, npcX[id]])))
        expect(norm(engine.BEASTS)).toEqual(norm(dump.BEASTS[sc.id] ?? []))
      })

      it('gives back pregenerated investigators and their weapons', () => {
        expect(engine.INV0).toEqual(dump.INV0)
        expect(engine.WEAPONS).toEqual(dump.WEAPONS)
      })

      it('gives back the NPC table, who-knows-what and the ritual', () => {
        const en = sc.lang === 'en'
        const tr = (t: string) => (en ? english[t] ?? t : t)
        if (dump.NPCS[sc.id]) {
          const rows = sc.id === 'livres' ? dump.LIVRES_PNJ : en ? dump.PROFILES_EN : dump.PROFILES
          expect(engine.NPC_TABLE).toEqual({ ...dump.NPCS[sc.id], rows })
        }
        if (sc.who) {
          expect(engine.WHO).toEqual(en ? dump.WHO_EN : dump.WHO)
          expect(engine.WHO_NOTE).toBe(tr(dump.WHO_NOTE!))
        }
        expect(engine.SCENARIO.ritual).toBe(sc.ritual)
        if (sc.ritual) {
          const r = dump.RITUAL!
          expect(engine.RITUAL).toEqual({
            title: tr(r.title), max: r.max, step: r.step, add: tr(r.add), sub: tr(r.sub),
            start: tr(r.start), running: tr(r.running), full: tr(r.full), help: tr(r.help),
          })
        }
      })

      it('lists opponents whose names must not become roll buttons', () => {
        if (sc.id === 'livres') expect(engine.NPC_WORDS).toContain('Douglas')
      })
    })
  }
})
