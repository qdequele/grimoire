// The shipped portrait files (./portraits/<id>.jpg) as URLs, and as the data URL a keeper's copy
// stores in `characters.photo`.
import { isPhoto } from '../photo'

const URLS = import.meta.glob<string>('./portraits/*.jpg', { eager: true, query: '?url', import: 'default' })

/** The portrait's address, or null while it hasn't been drawn (the round head then shows initials). */
export const portraitUrl = (id: string): string | null => URLS[`./portraits/${id}.jpg`] ?? null

/** The portrait as a photo the database accepts, or null (none, unreadable or too big). */
export async function portraitPhoto(id: string): Promise<string | null> {
  const url = portraitUrl(id)
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
    return isPhoto(data) ? data : null
  } catch {
    return null
  }
}
