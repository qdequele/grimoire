// The keeper's Gravatar, shown when they haven't chosen a photo of their own (profiles.photo).
// Gravatar is asked for a SHA-256 hash of the e-mail address, never the address itself.

/** Lower-case hex SHA-256 of the trimmed, lower-cased e-mail address, as Gravatar expects. */
export async function gravatarHash(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase())
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The address of the keeper's Gravatar picture, `size` pixels square. `d=404`: an address without a
 * Gravatar answers 404 instead of a generic picture, so the round head falls back to the initials.
 */
export async function gravatarUrl(email: string, size = 192): Promise<string> {
  return `https://gravatar.com/avatar/${await gravatarHash(email)}?s=${size}&d=404`
}
