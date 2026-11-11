import { describe, expect, it, vi } from 'vitest'

// CI runs the unit tests without Supabase keys: the real client throws at import.
vi.mock('@/lib/supabase', () => ({ supabase: {}, supabaseUrl: '', supabaseAnonKey: '' }))
const { feedbackRow, isFeedbackLimit, replyLink } = await import('./api')

describe('feedbackRow', () => {
  it('trims the message and keeps page and user agent within the database bounds', () => {
    const row = feedbackRow({ kind: 'bug', message: '  It broke \n', contactOk: true, page: '/x'.repeat(400), lang: 'en' }, 'U'.repeat(900))
    expect(row).toMatchObject({ kind: 'bug', message: 'It broke', contact_ok: true, lang: 'en' })
    expect(row.page).toHaveLength(500)
    expect(row.user_agent).toHaveLength(500)
  })

  it('stores an empty page or user agent as null', () => {
    expect(feedbackRow({ kind: 'idea', message: 'Hi', contactOk: false, page: '', lang: 'fr' }, '')).toMatchObject({ page: null, user_agent: null })
  })
})

it('recognises the daily limit error', () => {
  expect(isFeedbackLimit(new Error('feedback_limit'))).toBe(true)
  expect(isFeedbackLimit(new Error('other'))).toBe(false)
})

it('offers a reply link only to senders who agreed to one', () => {
  expect(replyLink({ contact_ok: true, email: 'a+b@example.com' }, 'Ton avis & Grimoire')).toBe('mailto:a%2Bb%40example.com?subject=Ton%20avis%20%26%20Grimoire')
  expect(replyLink({ contact_ok: false, email: 'a@example.com' }, 'x')).toBeNull()
  expect(replyLink({ contact_ok: true, email: '' }, 'x')).toBeNull()
})
