import { describe, expect, it } from 'vitest'
import {
  imagesOf, INITIAL_SCREEN, parseScreen, sameScreen, sceneKey, screenReducer, shownScene, toScreenScene,
  type ScreenAction, type ScreenHandout, type ScreenScene, type ScreenState,
} from './state'

const fog: ScreenScene = { preset: 'fog', image: null, sounds: ['wind'] }
const storm: ScreenScene = { preset: 'storm', image: { bucket: 'story-packs', path: 'u/s/images/a.jpg' }, sounds: ['storm'] }
const letter: ScreenHandout = { key: 'handout:letter', title: 'A letter', text: 'Come alone.', image: null }

const run = (...actions: ScreenAction[]) => actions.reduce(screenReducer, INITIAL_SCREEN)

describe('screenReducer', () => {
  it('follows the game from scene to scene', () => {
    const s = run({ type: 'scene', scene: fog }, { type: 'scene', scene: storm })
    expect(s.scene).toEqual(storm)
  })

  it('stays on the pinned scene, then jumps back to the game when following again', () => {
    const pinned = run({ type: 'scene', scene: fog }, { type: 'follow', on: false }, { type: 'scene', scene: storm })
    expect(pinned.scene).toEqual(fog)
    expect(pinned.follow).toBe(false)
    const again = screenReducer(pinned, { type: 'follow', on: true, scene: storm })
    expect(again).toMatchObject({ follow: true, scene: storm })
  })

  it("the keeper's preset holds until the screen moves to another scene", () => {
    const s = run({ type: 'scene', scene: fog }, { type: 'preset', preset: 'candle' })
    expect(shownScene(s)?.preset).toBe('candle')
    expect(screenReducer(s, { type: 'scene', scene: { ...fog } })).toBe(s) // same scene saved again
    expect(shownScene(screenReducer(s, { type: 'scene', scene: storm }))?.preset).toBe('storm')
  })

  it('a preset with no scene yet still shows something', () => {
    expect(shownScene(run({ type: 'preset', preset: 'night' }))).toEqual({ preset: 'night', image: null, sounds: [] })
    expect(shownScene(INITIAL_SCREEN)).toBeNull()
  })

  it("the keeper's décor holds until the screen moves on; 'none' hides the scene's own", () => {
    const church: ScreenScene = { ...fog, place: 'church' }
    const s = run({ type: 'scene', scene: church }, { type: 'place', place: 'forest' })
    expect(shownScene(s)?.place).toBe('forest')
    expect(shownScene(screenReducer(s, { type: 'place', place: 'none' }))).not.toHaveProperty('place')
    expect(shownScene(screenReducer(s, { type: 'place', place: null }))?.place).toBe('church')
    const moved = screenReducer(s, { type: 'scene', scene: storm })
    expect(moved.placeOverride).toBeNull()
    expect(shownScene(run({ type: 'place', place: 'crypt' }))).toEqual({ preset: 'fog', image: null, sounds: [], place: 'crypt' })
  })

  it("the keeper's time of day holds until the screen moves on, and is part of the scene", () => {
    const night: ScreenScene = { ...fog, time: 'night' }
    const s = run({ type: 'scene', scene: night }, { type: 'time', time: 'day' })
    expect(shownScene(s)?.time).toBe('day')
    expect(shownScene(screenReducer(s, { type: 'time', time: null }))?.time).toBe('night')
    expect(screenReducer(s, { type: 'scene', scene: storm }).timeOverride).toBeNull()
    const saved = JSON.parse(JSON.stringify(s))
    expect(parseScreen(saved)).toMatchObject({ scene: night, timeOverride: 'day' })
    expect(parseScreen({ ...saved, timeOverride: 'noon', scene: { ...night, time: 'noon' } })).toMatchObject({ scene: fog, timeOverride: null })
    expect(sceneKey(night)).not.toBe(sceneKey({ ...night, time: 'day' }))
    expect(toScreenScene({ preset: 'fog', image: null, sounds: [], fire: null, place: null, time: 'dusk' }, 'u/s').time).toBe('dusk')
  })

  it('the décor is part of the scene: saved, read back, a new background when it changes', () => {
    const church: ScreenScene = { ...fog, place: 'church' }
    const saved = JSON.parse(JSON.stringify(run({ type: 'scene', scene: church }, { type: 'place', place: 'none' })))
    expect(parseScreen(saved)).toMatchObject({ scene: church, placeOverride: 'none' })
    expect(parseScreen({ ...saved, placeOverride: 'disco', scene: { ...church, place: 'disco' } })).toMatchObject({ scene: fog, placeOverride: null })
    expect(sceneKey(church)).not.toBe(sceneKey(fog))
    expect(toScreenScene({ preset: 'fog', image: null, sounds: [], fire: null, place: 'harbour', time: null }, 'u/s').place).toBe('harbour')
  })

  it('pushes and clears a handout, over any scene change', () => {
    const s = run({ type: 'scene', scene: fog }, { type: 'show', handout: letter }, { type: 'scene', scene: storm })
    expect(s.handout).toEqual(letter)
    expect(screenReducer(s, { type: 'clear' }).handout).toBeNull()
  })

  it('returns the same object when nothing changes (nothing to publish)', () => {
    const s = run({ type: 'scene', scene: fog }, { type: 'show', handout: letter })
    const same: ScreenAction[] = [
      { type: 'scene', scene: { ...fog } },
      { type: 'show', handout: { ...letter } },
      { type: 'sound', on: false },
      { type: 'preset', preset: null },
      { type: 'follow', on: true },
    ]
    for (const a of same) expect(screenReducer(s, a)).toBe(s)
    expect(screenReducer(INITIAL_SCREEN, { type: 'clear' })).toBe(INITIAL_SCREEN)
  })
})

describe('helpers', () => {
  it('scene keys change with what is drawn, not with the sounds', () => {
    expect(sceneKey(fog)).toBe(sceneKey({ ...fog, sounds: [] }))
    expect(sceneKey(fog)).not.toBe(sceneKey(storm))
    expect(sceneKey(null)).toBe('idle')
  })

  it('pack paths become Storage refs', () => {
    expect(toScreenScene({ preset: 'rain', image: 'images/x.jpg', sounds: [], fire: null, place: null, time: null }, 'owner/story')).toEqual({
      preset: 'rain', image: { bucket: 'story-packs', path: 'owner/story/images/x.jpg' }, sounds: [],
    })
  })

  it('lists the pictures to sign and ignores signed URLs when comparing', () => {
    const s: ScreenState = { ...INITIAL_SCREEN, scene: storm, handout: { ...letter, image: { bucket: 'screen-images', path: 'u/g/1.png' } } }
    expect(imagesOf(s).map((i) => i.path)).toEqual(['u/s/images/a.jpg', 'u/g/1.png'])
    const signed = { ...s, scene: { ...storm, image: { ...storm.image!, url: 'https://x/signed' } } }
    expect(sameScreen(s, signed)).toBe(true)
    expect(sameScreen(s, { ...s, sound: true })).toBe(false)
  })
})

describe('parseScreen', () => {
  it('reads back what was saved', () => {
    const s: ScreenState = { v: 1, follow: false, sound: true, scene: storm, override: 'dust', placeOverride: null, timeOverride: null, nameOverride: null, handout: letter }
    expect(parseScreen(JSON.parse(JSON.stringify(s)))).toEqual(s)
  })

  it('anything else becomes the initial state or loses the bad parts', () => {
    expect(parseScreen(null)).toEqual(INITIAL_SCREEN)
    expect(parseScreen({ v: 2 })).toEqual(INITIAL_SCREEN)
    const s = parseScreen({
      v: 1, scene: { preset: 'disco' }, override: 'nope',
      handout: { key: 'h', title: 'T', image: { bucket: 'story-packs', path: 'p', url: 'javascript:alert(1)' } },
    })
    expect(s.scene).toBeNull()
    expect(s.override).toBeNull()
    expect(s.handout?.image).toEqual({ bucket: 'story-packs', path: 'p' })
  })
})

describe('fire place (hearth)', () => {
  const hearth: ScreenScene = { preset: 'hearth', image: storm.image, sounds: ['fireplace'], fire: { x: 0.4, y: 0.8, width: 0.3 } }

  it('travels from the scene to the saved state and back', () => {
    const scene = toScreenScene({ preset: 'hearth', image: 'images/hall.jpg', sounds: [], fire: { x: 0.4, y: 0.8, width: 0.3 }, place: null, time: null }, 'u/s')
    expect(scene.fire).toEqual({ x: 0.4, y: 0.8, width: 0.3 })
    expect(toScreenScene({ preset: 'fog', image: null, sounds: [], fire: null, place: null, time: null }, 'u/s')).not.toHaveProperty('fire')
    const saved = JSON.parse(JSON.stringify(run({ type: 'scene', scene: hearth })))
    expect(parseScreen(saved).scene).toEqual(hearth)
  })

  it('drops a broken fire place from the row', () => {
    const saved = { ...INITIAL_SCREEN, scene: { ...hearth, fire: { x: 3, y: 0.8, width: 0.3 } } }
    expect(parseScreen(saved).scene).not.toHaveProperty('fire')
  })

  it('moving the fire is a new background', () => {
    expect(sceneKey(hearth)).not.toBe(sceneKey({ ...hearth, fire: { x: 0.6, y: 0.8, width: 0.3 } }))
    expect(screenReducer(run({ type: 'scene', scene: hearth }), { type: 'scene', scene: { ...hearth, fire: { x: 0.6, y: 0.8, width: 0.3 } } }).scene?.fire?.x).toBe(0.6)
  })
})

describe('place name (players)', () => {
  const church: ScreenScene = { ...fog, place: 'church', name: 'The old church' }

  it('travels from the ambiance to the screen state and back, without a new background', () => {
    expect(toScreenScene({ preset: 'fog', image: null, sounds: [], fire: null, place: null, time: null, name: 'Harbour' }, 'u/s').name).toBe('Harbour')
    expect(toScreenScene({ preset: 'fog', image: null, sounds: [], fire: null, place: null, time: null }, 'u/s')).not.toHaveProperty('name')
    const saved = JSON.parse(JSON.stringify(run({ type: 'scene', scene: church })))
    expect(parseScreen(saved).scene).toEqual(church)
    expect(sceneKey(church)).toBe(sceneKey({ ...church, name: 'Elsewhere' }))
    expect(sceneKey(church)).toBe(sceneKey({ ...fog, place: 'church' }))
  })

  it('a scene with another name is another scene: the name follows the game', () => {
    const s = run({ type: 'scene', scene: church }, { type: 'scene', scene: { ...church, name: 'The crypt' } })
    expect(s.scene?.name).toBe('The crypt')
  })

  it("the keeper's name holds until the screen moves on; '' hides the scene's own", () => {
    const s = run({ type: 'scene', scene: church }, { type: 'name', name: '  The chapel ' })
    expect(s.nameOverride).toBe('The chapel')
    expect(shownScene(s)?.name).toBe('The chapel')
    expect(shownScene(screenReducer(s, { type: 'name', name: '' }))).not.toHaveProperty('name')
    expect(shownScene(screenReducer(s, { type: 'name', name: null }))?.name).toBe('The old church')
    expect(screenReducer(s, { type: 'name', name: 'The chapel' })).toBe(s)
    expect(screenReducer(s, { type: 'scene', scene: storm }).nameOverride).toBeNull()
    expect(screenReducer(screenReducer(s, { type: 'follow', on: false }), { type: 'follow', on: true, scene: storm }).nameOverride).toBeNull()
    expect(screenReducer(s, { type: 'name', name: 'x'.repeat(100) }).nameOverride).toHaveLength(80)
  })

  it('a name with no scene yet still shows something; hiding it alone shows nothing', () => {
    expect(shownScene(run({ type: 'name', name: 'Arrival' }))).toEqual({ preset: 'fog', image: null, sounds: [], name: 'Arrival' })
    expect(shownScene(run({ type: 'name', name: '' }))).toBeNull()
  })

  it('reads the name and the override back from the row, dropping bad values', () => {
    const saved = JSON.parse(JSON.stringify(run({ type: 'scene', scene: church }, { type: 'name', name: '' })))
    expect(parseScreen(saved)).toMatchObject({ scene: church, nameOverride: '' })
    expect(parseScreen({ ...saved, nameOverride: 3, scene: { ...church, name: 7 } })).toMatchObject({ scene: { ...fog, place: 'church' }, nameOverride: null })
    expect(parseScreen({ ...saved, nameOverride: 'y'.repeat(200), scene: { ...church, name: 'z'.repeat(200) } })).toMatchObject({ nameOverride: 'y'.repeat(80), scene: { name: 'z'.repeat(80) } })
    expect(parseScreen({ ...saved, scene: { ...church, name: '   ' } }).scene).not.toHaveProperty('name')
    expect(INITIAL_SCREEN.nameOverride).toBeNull()
  })
})
