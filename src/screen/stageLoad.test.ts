import { describe, expect, it } from 'vitest'
import { addsLayer, needsLoad, type Drawn } from './stageLoad'

const KEY = 'fog|story-packs|o/s/images/a.jpg'
const OLD = 'https://db.example/sign/a.jpg?token=expired'
const NEW = 'https://db.example/sign/a.jpg?token=fresh'

describe('needsLoad', () => {
  it('loads a scene the first time, and another scene', () => {
    expect(needsLoad(null, KEY, OLD)).toBe(true)
    expect(needsLoad({ key: 'idle', url: undefined, ok: false }, KEY, OLD)).toBe(true)
    expect(needsLoad({ key: KEY, url: OLD, ok: true }, 'storm||', undefined)).toBe(true)
  })

  it('leaves a picture that loaded alone, even when its signature is renewed', () => {
    const drawn: Drawn = { key: KEY, url: OLD, ok: true }
    expect(needsLoad(drawn, KEY, OLD)).toBe(false)
    expect(needsLoad(drawn, KEY, NEW)).toBe(false)
    expect(needsLoad(drawn, KEY, undefined)).toBe(false)
  })

  it('tries again when the picture failed and another URL arrives for the same scene', () => {
    // The TV opened with an expired signature; the keeper's page then signs again.
    expect(needsLoad({ key: KEY, url: OLD, ok: false }, KEY, NEW)).toBe(true)
    // The signature was missing (signing failed), then comes.
    expect(needsLoad({ key: KEY, url: undefined, ok: false }, KEY, NEW)).toBe(true)
  })

  it('does not ask again for a URL that already failed, nor without a URL', () => {
    // The same state comes back at every check-in: a broken picture is not requested every minute.
    expect(needsLoad({ key: KEY, url: OLD, ok: false }, KEY, OLD)).toBe(false)
    expect(needsLoad({ key: KEY, url: OLD, ok: false }, KEY, undefined)).toBe(false)
    // A scene without a picture, re-sent.
    expect(needsLoad({ key: 'fog||', url: undefined, ok: false }, 'fog||', undefined)).toBe(false)
  })
})

describe('addsLayer', () => {
  it('a new scene always fades in, with or without its picture', () => {
    expect(addsLayer(null, KEY, false)).toBe(true)
    expect(addsLayer({ key: 'idle', url: undefined, ok: false }, KEY, true)).toBe(true)
  })

  it('the same scene fades in again only when its picture finally loaded', () => {
    expect(addsLayer({ key: KEY, url: OLD, ok: false }, KEY, true)).toBe(true)
    expect(addsLayer({ key: KEY, url: OLD, ok: false }, KEY, false)).toBe(false)
  })
})
