import { describe, expect, it } from 'vitest'
import { footprint, groundAt, mapProblems, parseMapDoc } from './maps/model.ts'
import { STAMP_LIST } from './maps/stamps.ts'
import { MAP_DESCRIPTION_MAX, mapSchema, mapSystemPrompt, mapUserPrompt, parseMapRequest } from './map-prompt.ts'

describe('map prompt', () => {
  const prompt = mapSystemPrompt()

  it('lists every stamp', () => {
    for (const s of STAMP_LIST) expect(prompt, s.id).toContain(`- ${s.id} (`)
  })

  it('shows an example that is itself a sound map', () => {
    const example = JSON.parse(prompt.slice(prompt.lastIndexOf('\n{') + 1))
    const { doc, problems } = parseMapDoc(example)
    expect(problems).toEqual([])
    expect(mapProblems(doc)).toEqual([])
    // Matches the structured output: every field the schema requires.
    expect(Object.keys(example).sort()).toEqual(Object.keys((mapSchema() as { properties: object }).properties).sort())
    for (const it of doc.items) {
      const [w, h] = footprint(it)
      for (let y = it.y; y < it.y + h; y++) for (let x = it.x; x < it.x + w; x++) expect(groundAt(doc, x, y), `${it.t} at ${x},${y}`).toBe('.')
    }
    expect(doc.secret?.some((r) => r.includes('x'))).toBe(true)
  })

  it('puts the keeper’s words and the story inside their own tags', () => {
    const text = mapUserPrompt({ description: 'A small chapel.', kind: 'building', lang: 'fr', context: 'The scene.' })
    expect(text).toContain('<description>\nA small chapel.\n</description>')
    expect(text).toContain('<story>\nThe scene.\n</story>')
    expect(text).toContain('French')
  })

  it('checks the request', () => {
    expect(parseMapRequest({ description: 'short' })).toMatch(/phrase/)
    expect(parseMapRequest({ description: 'x'.repeat(MAP_DESCRIPTION_MAX + 1) })).toMatch(/trop longue/)
    expect(parseMapRequest({ description: 'A ruined mill by the river.', kind: 'castle' })).toMatch(/kind/)
    expect(parseMapRequest({ description: 'A ruined mill by the river.', lang: 'en' })).toEqual({ description: 'A ruined mill by the river.', kind: undefined, lang: 'en' })
  })
})
