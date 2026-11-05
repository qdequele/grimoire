import { describe, expect, it } from 'vitest'
import SOUNDS from '../../spec/sounds.json'
import sample from '../../stories/the-silent-light/story.json'
import { AMBIENCE_FILE, LOOKS, PRESETS, presetFromSounds, sceneAmbiance, soundUrls, type StoryForScreen } from './ambiance'

const story = (scene: Record<string, unknown>): StoryForScreen => ({ acts: [{ scenes: [{ id: 's', ...scene }] }] })

describe('presetFromSounds', () => {
  it('picks the most dramatic sound of the scene', () => {
    expect(presetFromSounds(['wind', 'storm'])).toBe('storm')
    expect(presetFromSounds(['fireplace', 'rain-window'])).toBe('rain')
    expect(presetFromSounds(['clock', 'fireplace'])).toBe('candle')
    expect(presetFromSounds(['wind-howling'])).toBe('night')
    expect(presetFromSounds(['village-day', 'wind'])).toBe('fog')
    expect(presetFromSounds(['street'])).toBe('dust')
  })

  it('falls back to fog', () => {
    expect(presetFromSounds([])).toBe('fog')
    expect(presetFromSounds(undefined)).toBe('fog')
    expect(presetFromSounds(['a-story-sound'])).toBe('fog')
  })

  it('every preset has a look', () => {
    for (const p of PRESETS) expect(LOOKS[p].palette).toHaveLength(3)
  })
})

describe('sceneAmbiance', () => {
  it("uses the scene's screen field first", () => {
    const s = story({ ambience: ['storm'], screen: { preset: 'candle', image: 'images/a.jpg' } })
    expect(sceneAmbiance(s, 's', ['images/a.jpg'])).toEqual({ preset: 'candle', image: 'images/a.jpg', sounds: ['storm'] })
  })

  it('ignores an unknown preset and a picture the pack does not have', () => {
    const s = story({ ambience: ['rain'], screen: { preset: 'disco', image: 'images/missing.jpg' } })
    expect(sceneAmbiance(s, 's', [])).toEqual({ preset: 'rain', image: null, sounds: ['rain'] })
  })

  it('shows scene images to players only when marked keeperOnly: false', () => {
    const s = story({ images: [{ src: 'images/map.jpg' }, { src: 'images/view.jpg', keeperOnly: false }] })
    expect(sceneAmbiance(s, 's', ['images/map.jpg', 'images/view.jpg']).image).toBe('images/view.jpg')
    const secret = story({ images: [{ src: 'images/map.jpg' }, { src: 'images/plan.jpg', keeperOnly: true }] })
    expect(sceneAmbiance(secret, 's', ['images/map.jpg', 'images/plan.jpg']).image).toBeNull()
  })

  it('an unknown scene gets the default ambiance', () => {
    expect(sceneAmbiance(story({}), 'nope', [])).toEqual({ preset: 'fog', image: null, sounds: [] })
  })

  it('the sample story gets varied presets from its sounds', () => {
    const s = sample as unknown as StoryForScreen
    const presets = s.acts.flatMap((a) => a.scenes).map((sc) => sceneAmbiance(s, sc.id, []).preset)
    expect(presets.every((p) => PRESETS.includes(p))).toBe(true)
    expect(new Set(presets).size).toBeGreaterThan(2)
  })
})

describe('sounds', () => {
  it('every library ambience has a file', () => {
    expect(SOUNDS.ambience.map((a) => a.id).filter((id) => !AMBIENCE_FILE[id])).toEqual([])
  })

  it('skips sounds the screen cannot play', () => {
    expect(soundUrls(['rain', 'my-own'])).toEqual(['/sons/amb-pluie.mp3'])
  })
})
