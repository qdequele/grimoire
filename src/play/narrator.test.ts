import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { httpError } from './narrator'

// The engine switches the narrator off for the rest of the session on `sampling_disabled`:
// that is for a server with no narrator at all, not for one that is busy for a moment.
describe('narrator: the function’s refusals in the engine’s words', () => {
  it('a server without a narrator switches it off', () => {
    expect(httpError(503, { error: { code: 'not_configured', message: 'x' } }).code).toBe('sampling_disabled')
  })

  it('a narrator that is unavailable for a moment can be asked again', () => {
    expect(httpError(503, { error: { code: 'unavailable', message: 'x' } }).code).toBe('error')
  })

  it('keeps the other answers: session, monthly limit, too many at once', () => {
    expect(httpError(401, {}).code).toBe('session_expired')
    expect(httpError(429, { error: { code: 'quota_exceeded', message: 'x' } }).code).toBe('quota')
    expect(httpError(429, {}).code).toBe('rate_limited')
    expect(httpError(500, {}).code).toBe('error')
  })
})
