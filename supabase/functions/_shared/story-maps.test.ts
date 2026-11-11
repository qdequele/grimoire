import { describe, expect, it } from 'vitest'
import { draftToStory, emptyDraft, normalizeDraft } from './import-draft.ts'
import { mapFiles, mapScenes, sceneMapRequest, scenesWithoutMap, STORY_MAPS_PER_STORY, withSceneMap } from './story-maps.ts'

const scene = (id: string, mapKind = '', mapDescription = '') => ({ id, title: `T ${id}`, lead: 'Lead.', readAloud: ['Seen.'], mapKind, mapDescription, handouts: ['letter'] })
const draft = normalizeDraft({
  acts: [{ id: 'a', scenes: [scene('Hall 1', 'building', 'Two rooms.'), scene('road'), scene('crypt', 'underground'), scene('wood', 'outdoor'), scene('mill', 'building')] }],
  handouts: [{ id: 'letter', title: 'Letter', text: 'Hi', scene: 'road' }],
})

describe('story maps', () => {
  it('reads the draft’s map requests, and models can’t set a handout picture', () => {
    expect(draft.acts[0].scenes[0]).toMatchObject({ mapKind: 'building', mapDescription: 'Two rooms.' })
    expect(normalizeDraft({ acts: [{ id: 'a', scenes: [{ id: 's', mapKind: 'castle' }] }] }).acts[0].scenes[0].mapKind).toBe('')
    expect(normalizeDraft({ handouts: [{ id: 'h', title: 'H', image: 'images/x.svg' }] }).handouts[0]).not.toHaveProperty('image')
  })

  it('keeps the first scenes that ask, in story order', () => {
    expect(mapScenes(draft).map((s) => s.id)).toEqual(['Hall 1', 'crypt', 'wood'].slice(0, STORY_MAPS_PER_STORY))
    expect(mapFiles('Hall 1')).toEqual({
      players: { handout: 'map-hall-1', image: 'images/map-hall-1.svg' },
      keeper: { handout: 'map-hall-1-keeper', image: 'images/map-hall-1-keeper.svg' },
    })
  })

  it('asks with the description, the kind and the scene’s text', () => {
    const req = sceneMapRequest(draft.acts[0].scenes[0], 'en')
    expect(req).toMatchObject({ description: 'Two rooms.', kind: 'building', lang: 'en' })
    expect(req.context).toContain('Seen.')
    expect(sceneMapRequest(draft.acts[0].scenes[2], 'fr').description).toBe('T crypt')
  })

  it('adds both copies as handouts of the scene, once, and story.json carries their pictures', () => {
    let d = withSceneMap(draft, 'Hall 1', 'The Hall', 'fr')
    d = withSceneMap(d, 'Hall 1', 'The Hall', 'fr')
    expect(d.handouts.map((h) => h.id)).toEqual(['letter', 'map-hall-1', 'map-hall-1-keeper'])
    expect(d.acts[0].scenes[0].handouts).toEqual(['letter', 'map-hall-1', 'map-hall-1-keeper'])
    expect(scenesWithoutMap(d).map((s) => s.id)).toEqual(['crypt', 'wood'])
    const story = draftToStory(d, { id: 'x', lang: 'fr' }) as { handouts: Array<{ id: string; title: string; image?: string }> }
    expect(story.handouts[1]).toMatchObject({ id: 'map-hall-1', title: 'Plan : The Hall', image: 'images/map-hall-1.svg' })
    expect(story.handouts[2].title).toMatch(/^Plan du gardien/)
    expect(withSceneMap(emptyDraft(), 'nowhere', '', 'en').handouts).toHaveLength(2)
  })
})
