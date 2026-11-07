import { describe, expect, it } from 'vitest'
import SOUNDS from '../../spec/sounds.json'
import schema from '../../spec/story.schema.json'
import sample from '../../stories/the-silent-light/story.json'
import { AMBIENCE_FILE, asFire, LOOKS, mix, paletteFor, PLACE_PRESET, PLACES, placeFromText, PRESETS, presetFromSounds, sceneAmbiance, soundUrls, TIMES, timeFromSounds, timeFromText, type StoryForScreen } from './ambiance'

const story = (scene: Record<string, unknown>): StoryForScreen => ({ acts: [{ scenes: [{ id: 's', ...scene }] }] })

describe('presetFromSounds', () => {
  it('picks the most dramatic sound of the scene', () => {
    expect(presetFromSounds(['wind', 'storm'])).toBe('storm')
    expect(presetFromSounds(['fireplace', 'rain-window'])).toBe('rain')
    expect(presetFromSounds(['clock', 'fireplace'])).toBe('hearth')
    expect(presetFromSounds(['clock'])).toBe('candle')
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
    for (const p of PRESETS) {
      expect(LOOKS[p].palette).toHaveLength(3)
      expect(LOOKS[p].fogColor).toMatch(/^\d{1,3}, \d{1,3}, \d{1,3}$/)
      expect(LOOKS[p].density).toBeGreaterThan(0)
    }
  })

  it('the story format lists the same presets', () => {
    const enumOf = (o: unknown): unknown => {
      if (!o || typeof o !== 'object') return undefined
      const r = o as Record<string, unknown>
      const preset = (r.screen as { properties?: { preset?: { enum?: unknown } } } | undefined)?.properties?.preset?.enum
      return preset ?? Object.values(r).map(enumOf).find(Boolean)
    }
    expect(enumOf(schema)).toEqual([...PRESETS])
  })

})

describe('sceneAmbiance', () => {
  it("uses the scene's screen field first", () => {
    const s = story({ ambience: ['storm'], screen: { preset: 'candle', image: 'images/a.jpg' } })
    expect(sceneAmbiance(s, 's', ['images/a.jpg'])).toEqual({ preset: 'candle', image: 'images/a.jpg', sounds: ['storm'], fire: null, place: null, time: null })
  })

  it('ignores an unknown preset and a picture the pack does not have', () => {
    const s = story({ ambience: ['rain'], screen: { preset: 'disco', image: 'images/missing.jpg' } })
    expect(sceneAmbiance(s, 's', [])).toEqual({ preset: 'rain', image: null, sounds: ['rain'], fire: null, place: null, time: null })
  })

  it('shows scene images to players only when marked keeperOnly: false', () => {
    const s = story({ images: [{ src: 'images/map.jpg' }, { src: 'images/view.jpg', keeperOnly: false }] })
    expect(sceneAmbiance(s, 's', ['images/map.jpg', 'images/view.jpg']).image).toBe('images/view.jpg')
    const secret = story({ images: [{ src: 'images/map.jpg' }, { src: 'images/plan.jpg', keeperOnly: true }] })
    expect(sceneAmbiance(secret, 's', ['images/map.jpg', 'images/plan.jpg']).image).toBeNull()
  })

  it('an unknown scene gets the default ambiance', () => {
    expect(sceneAmbiance(story({}), 'nope', [])).toEqual({ preset: 'fog', image: null, sounds: [], fire: null, place: null, time: null })
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

describe('fire place (hearth)', () => {
  it('keeps a fire place made of fractions, rejects anything else', () => {
    expect(asFire({ x: 0.4, y: 0.8, width: 0.3 })).toEqual({ x: 0.4, y: 0.8, width: 0.3 })
    expect(asFire({ x: 1.2, y: 0.8, width: 0.3 })).toBeNull()
    expect(asFire({ x: 0.4, y: 0.8, width: 0 })).toBeNull()
    expect(asFire({ x: '0.4', y: 0.8, width: 0.3 })).toBeNull()
    expect(asFire(null)).toBeNull()
  })

  it("reads the scene's fire place", () => {
    const s = story({ ambience: ['fireplace'], screen: { fire: { x: 0.3, y: 0.7, width: 0.2 } } })
    expect(sceneAmbiance(s, 's', [])).toEqual({ preset: 'hearth', image: null, sounds: ['fireplace'], fire: { x: 0.3, y: 0.7, width: 0.2 }, place: null, time: null })
  })

  it('only the hearth draws a fire', () => {
    expect(PRESETS.filter((p) => LOOKS[p].fire)).toEqual(['hearth'])
  })
})

describe('places (drawn décors)', () => {
  it('guesses the place from the title, French or English, accents ignored', () => {
    expect(placeFromText('Le vieux cimetière')).toBe('graveyard')
    expect(placeFromText('The old church')).toBe('church')
    expect(placeFromText('EGLISE SAINT-JEAN')).toBe('church')
    expect(placeFromText('Sous-bois')).toBe('forest')
    expect(placeFromText('Au commissariat')).toBe('police')
    expect(placeFromText('Inside the lighthouse')).toBe('harbour')
    expect(placeFromText(undefined, 'chateau-noir')).toBe('castle')
    expect(placeFromText('La gare de Kingsport')).toBe('station')
    expect(placeFromText('À bord du navire')).toBe('ship')
    expect(placeFromText('La grotte sous la colline')).toBe('cavern')
    expect(placeFromText('La crypte')).toBe('crypt')
    expect(placeFromText('The old asylum')).toBe('asylum')
    expect(placeFromText('Les menhirs de la lande')).toBe('moor')
    expect(placeFromText('Night at the fairground')).toBe('fair')
    expect(placeFromText('La mine abandonnée')).toBe('mine')
    expect(placeFromText('Les fouilles')).toBe('dig')
  })

  it('the most specific place wins', () => {
    expect(placeFromText("La crypte de l'église")).toBe('crypt')
    expect(placeFromText('La bibliothèque du manoir')).toBe('library')
  })

  it('matches whole words only', () => {
    expect(placeFromText('La porte rouge')).toBeNull()
    expect(placeFromText('Martha Varnum')).toBeNull()
    expect(placeFromText('Woodward')).toBeNull()
  })

  it("the scene's screen.place first, then its title; the place's preset when the sounds say nothing", () => {
    expect(sceneAmbiance(story({ title: 'La bibliothèque' }), 's', [])).toMatchObject({ place: 'library', preset: 'candle' })
    expect(sceneAmbiance(story({ title: 'La bibliothèque', ambience: ['storm'] }), 's', [])).toMatchObject({ place: 'library', preset: 'storm' })
    expect(sceneAmbiance(story({ title: 'La bibliothèque', screen: { place: 'forest', preset: 'snow' } }), 's', [])).toMatchObject({ place: 'forest', preset: 'snow' })
    expect(sceneAmbiance(story({ title: 'La bibliothèque', screen: { place: 'disco' } }), 's', []).place).toBe('library')
  })

  it('every place has a preset, and the story format lists the same places', () => {
    for (const p of PLACES) expect(PRESETS).toContain(PLACE_PRESET[p])
    const raw = JSON.stringify(schema)
    const m = /"place":\{"enum":(\[[^\]]*\])/.exec(raw)
    expect(m && JSON.parse(m[1])).toEqual([...PLACES])
  })
})

describe('time of day', () => {
  it('reads the time in the title, French or English, or in the sounds', () => {
    expect(timeFromText('Minuit au moulin')).toBe('night')
    expect(timeFromText("L'aube")).toBe('dusk')
    expect(timeFromText('Dawn')).toBe('dusk')
    expect(timeFromText('Un matin gris')).toBe('day')
    expect(timeFromText('The mill')).toBeNull()
    expect(timeFromSounds(['wind', 'night-crickets'])).toBe('night')
    expect(timeFromSounds(['village-day'])).toBe('day')
    expect(timeFromSounds(['rain'])).toBeNull()
  })

  it("the scene's screen.time first, then its title, then its sounds", () => {
    expect(sceneAmbiance(story({ title: 'Minuit', ambience: ['village-day'] }), 's', []).time).toBe('night')
    expect(sceneAmbiance(story({ title: 'Le marché', ambience: ['village-day'] }), 's', []).time).toBe('day')
    expect(sceneAmbiance(story({ title: 'Minuit', screen: { time: 'day' } }), 's', []).time).toBe('day')
    expect(sceneAmbiance(story({ title: 'Minuit', screen: { time: 'noon' } }), 's', []).time).toBe('night')
  })

  it('night keeps the preset colours; day and dusk change them; every preset has a default time', () => {
    for (const p of PRESETS) {
      expect(paletteFor(p, 'night')).toEqual(LOOKS[p].palette)
      expect(paletteFor(p, 'day')).not.toEqual(LOOKS[p].palette)
      expect(paletteFor(p, 'dusk')).not.toEqual(LOOKS[p].palette)
      for (const t of TIMES) for (const c of paletteFor(p, t)) expect(c).toMatch(/^#[0-9a-f]{6}$/)
      expect(TIMES).toContain(LOOKS[p].time)
    }
    expect(paletteFor('snow', 'day')).toEqual(LOOKS.snow.day)
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('the story format lists the same times', () => {
    const m = /"time":\{"enum":(\[[^\]]*\])/.exec(JSON.stringify(schema))
    expect(m && JSON.parse(m[1])).toEqual([...TIMES])
  })
})
