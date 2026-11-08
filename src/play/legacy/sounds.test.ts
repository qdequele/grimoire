import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import library from '../../../spec/sounds.json'
import { AMB_TO_LIBRARY, engineAmbience, engineSfx, SFX_TO_LIBRARY } from './sounds'

// The engine's own sound tables (public/play/engine.js): `const REC_AMB={ id:{n:…}, … }`, `const REC_FX={ … }`
// plus the user-recorded effect slots `const SLOTS=[["verre",…],…]`.
const engine = readFileSync('public/play/engine.js', 'utf8')
const keysOf = (name: string) => {
  const block = engine.slice(engine.indexOf(`const ${name}={`)).split('\n};')[0]
  return new Set([...block.matchAll(/(?:^|[,{\s])([a-z]+):\{n:/g)].map((m) => m[1]))
}
const REC_AMB = keysOf('REC_AMB')
const REC_FX = keysOf('REC_FX')
const SLOTS = new Set([...(engine.match(/const SLOTS=\[(.*?)\];/)?.[1] ?? '').matchAll(/\["([a-z]+)"/g)].map((m) => m[1]))

describe('sound ids: library ↔ engine', () => {
  it('reads the engine tables', () => {
    expect(REC_AMB.size).toBeGreaterThan(10)
    expect(REC_FX.size).toBeGreaterThan(5)
  })

  it('maps every ambience to a recording the engine has (an unknown one stops the scene rendering)', () => {
    expect(Object.keys(AMB_TO_LIBRARY).filter((id) => !REC_AMB.has(id))).toEqual([])
    expect(library.ambience.map((a) => a.id).filter((id) => !engineAmbience([id]).length)).toEqual([])
  })

  it('maps every effect to an engine effect or recording slot', () => {
    expect(Object.keys(SFX_TO_LIBRARY).filter((id) => !REC_FX.has(id) && !SLOTS.has(id))).toEqual([])
    expect(library.sfx.map((s) => s.id).filter((id) => !engineSfx([id]).length)).toEqual([])
  })

  it('keeps engine ids, drops ids the engine does not know', () => {
    expect(engineAmbience(['village-night', 'village', 'my-own-sound'])).toEqual(['village', 'village'])
    expect(engineSfx(['door-creak', 'grince', 'nope'])).toEqual(['grince', 'grince'])
    expect(engineAmbience(undefined)).toEqual([])
  })
})
