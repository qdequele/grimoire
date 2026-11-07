import { describe, expect, it } from 'vitest'
import { gravatarHash, gravatarUrl } from './gravatar'

describe('gravatar', () => {
  it('hashes the trimmed, lower-cased address with SHA-256', async () => {
    // Gravatar's documented example address.
    const hash = '84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee'
    expect(await gravatarHash('MyEmailAddress@example.com ')).toBe(hash)
    expect(await gravatarHash('myemailaddress@example.com')).toBe(hash)
  })

  it('asks for a 404 when there is no Gravatar, at the requested size', async () => {
    const url = new URL(await gravatarUrl('keeper@example.com', 64))
    expect(url.origin).toBe('https://gravatar.com')
    expect(url.pathname).toMatch(/^\/avatar\/[0-9a-f]{64}$/)
    expect(url.searchParams.get('s')).toBe('64')
    expect(url.searchParams.get('d')).toBe('404')
    expect(url.href).not.toContain('keeper')
  })
})
