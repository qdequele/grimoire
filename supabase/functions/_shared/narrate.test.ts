import { describe, expect, it } from 'vitest'
import { CONTEXT_MARKER, parseNarrateRequest, toApiMessages } from './narrate'

describe('parseNarrateRequest', () => {
  it('accepts a conversation that starts with the user', () => {
    const r = parseNarrateRequest({ messages: [{ role: 'user', content: 'Décris la scène' }, { role: 'assistant', content: 'La pluie…' }, { role: 'user', content: 'Et ensuite ?' }] })
    expect(Array.isArray(r) && r.length).toBe(3)
  })

  it.each([
    [{}, /non-empty list/],
    [{ messages: [{ role: 'system', content: 'x' }] }, /role must be/],
    [{ messages: [{ role: 'user', content: '  ' }] }, /non-empty text/],
    [{ messages: [{ role: 'assistant', content: 'x' }] }, /first message/],
    [{ messages: Array.from({ length: 31 }, () => ({ role: 'user', content: 'x' })) }, /At most 30/],
    [{ messages: [{ role: 'user', content: 'x'.repeat(200_001) }] }, /too long/],
  ])('rejects %j', (body, error) => {
    expect(parseNarrateRequest(body)).toMatch(error)
  })
})

describe('toApiMessages', () => {
  it('caches the stable instructions and sends the game context fresh', () => {
    const first = `Tu assistes le gardien.\n\nRÈGLES…${CONTEXT_MARKER}SCÉNARIO : …`
    const [m] = toApiMessages([{ role: 'user', content: first }])
    expect(m.content).toEqual([
      { type: 'text', text: 'Tu assistes le gardien.\n\nRÈGLES…', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `${CONTEXT_MARKER}SCÉNARIO : …` },
    ])
  })

  it('leaves later turns as plain text', () => {
    const out = toApiMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }])
    expect(out[1]).toEqual({ role: 'assistant', content: 'b' })
  })
})
