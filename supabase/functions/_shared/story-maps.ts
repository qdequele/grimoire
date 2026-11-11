// The story creator's maps: which scenes get one, what Claude is told about them, and how the two
// pictures (players' and keeper's copies) join the draft as handouts of their scene. Pure.
import type { DraftScene, ImportDraft } from './import-draft.ts'
import type { MapKind } from './maps/model.ts'

/** At most this many maps per created story. */
export const STORY_MAPS_PER_STORY = 3

const slug = (id: string) => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'scene'

/** Pack paths and handout ids of a scene's map. */
export function mapFiles(sceneId: string) {
  const s = slug(sceneId)
  return {
    players: { handout: `map-${s}`, image: `images/map-${s}.svg` },
    keeper: { handout: `map-${s}-keeper`, image: `images/map-${s}-keeper.svg` },
  }
}

const scenesOf = (d: ImportDraft) => d.acts.flatMap((a) => a.scenes)

/** Scenes that asked for a map (the first STORY_MAPS_PER_STORY, in story order). */
export const mapScenes = (d: ImportDraft): DraftScene[] => scenesOf(d).filter((s) => s.mapKind).slice(0, STORY_MAPS_PER_STORY)

/** Those whose map isn't drawn yet. */
export const scenesWithoutMap = (d: ImportDraft): DraftScene[] => mapScenes(d).filter((s) => !d.handouts.some((h) => h.id === mapFiles(s.id).players.handout))

/** What the story says about the scene's place, for Claude (bounded). */
export function sceneMapContext(s: DraftScene): string {
  const parts = [
    `Scene: ${s.title}`,
    s.lead,
    ...s.readAloud,
    ...s.flow.map((st) => [st.title, st.text, st.success].filter(Boolean).join(': ')),
    ...s.notes.map((n) => `${n.title}: ${n.items.join(' / ')}`),
  ].filter(Boolean)
  return parts.join('\n').slice(0, 5000)
}

/** The map's request for this scene: its description, else its title. */
export const sceneMapRequest = (s: DraftScene, lang: 'fr' | 'en') => ({
  description: (s.mapDescription || s.title).slice(0, 1500),
  kind: (s.mapKind || undefined) as MapKind | undefined,
  lang,
  context: sceneMapContext(s),
})

/** The draft with the scene's two map handouts (replacing earlier ones of the same scene). */
export function withSceneMap(d: ImportDraft, sceneId: string, title: string, lang: 'fr' | 'en'): ImportDraft {
  const f = mapFiles(sceneId)
  const name = title || scenesOf(d).find((s) => s.id === sceneId)?.title || ''
  const words = lang === 'fr'
    ? { players: `Plan : ${name}`, keeper: `Plan du gardien : ${name}`, keeperText: 'Version du gardien, avec les secrets en rouge : à ne pas montrer aux joueurs.' }
    : { players: `Map: ${name}`, keeper: `Keeper’s map: ${name}`, keeperText: 'The keeper’s copy, secrets in red: not for the players.' }
  const handouts = d.handouts.filter((h) => h.id !== f.players.handout && h.id !== f.keeper.handout)
  handouts.push(
    { id: f.players.handout, title: words.players.slice(0, 160), text: '', scene: sceneId, image: f.players.image },
    { id: f.keeper.handout, title: words.keeper.slice(0, 160), text: words.keeperText, scene: sceneId, image: f.keeper.image },
  )
  return {
    ...d,
    handouts,
    acts: d.acts.map((a) => ({
      ...a,
      scenes: a.scenes.map((s) => (s.id === sceneId ? { ...s, handouts: [...s.handouts.filter((h) => h !== f.players.handout && h !== f.keeper.handout), f.players.handout, f.keeper.handout] } : s)),
    })),
  }
}
