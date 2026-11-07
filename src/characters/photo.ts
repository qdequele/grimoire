// Investigator photos: a small square JPEG kept as a data URL in `characters.photo` (see the
// migration 20261107110000_character_photos.sql, whose character_photo_ok has the same rules).

/** Side of the stored square, in pixels: sharp in the biggest round head (80 px) on a 2× screen. */
export const PHOTO_SIZE = 192
/** Longest data URL the database accepts. */
export const PHOTO_MAX = 60_000

const PHOTO_RE = /^data:image\/(jpeg;base64,\/9j\/|png;base64,iVBORw0KGgo|webp;base64,UklGR)[A-Za-z0-9+/]*={0,2}$/

/** A photo the database would accept: base64 image data only, so it is safe in a CSS url() or an <img>. */
export function isPhoto(v: unknown): v is string {
  return typeof v === 'string' && v.length <= PHOTO_MAX && PHOTO_RE.test(v)
}

/** The photo if valid, else null (values from the network are checked before being shown). */
export const photoOr = (v: unknown): string | null => (isPhoto(v) ? v : null)

/** Initials in the round head when there's no photo: "Ada Lovelace" → "AL" (as the game screen). */
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => [...w][0]).slice(0, 2).join('').toUpperCase()
}

/** The centred square of a w × h picture: the part kept, the rest is cropped. */
export function squareCrop(w: number, h: number): { sx: number; sy: number; side: number } {
  const side = Math.min(w, h)
  return { sx: Math.round((w - side) / 2), sy: Math.round((h - side) / 2), side }
}

export class PhotoError extends Error {
  code: 'unreadable' | 'too_big'
  constructor(code: 'unreadable' | 'too_big') {
    super(code)
    this.code = code
    this.name = 'PhotoError'
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  // <img> applies the EXIF orientation of phone pictures; decode() waits for the pixels.
  return img.decode().then(
    () => img,
    () => Promise.reject(new PhotoError('unreadable')),
  ).finally(() => URL.revokeObjectURL(url))
}

/**
 * A picked file (camera or library) → the centred square, PHOTO_SIZE wide, as a JPEG data URL small
 * enough for the database (quality lowered until it fits).
 */
export async function photoFromFile(file: Blob): Promise<string> {
  const img = await loadImage(file)
  const w = img.naturalWidth, h = img.naturalHeight
  if (!w || !h) throw new PhotoError('unreadable')
  const { sx, sy, side } = squareCrop(w, h)
  const out = Math.min(PHOTO_SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError('unreadable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)
  for (const quality of [0.85, 0.75, 0.6, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (isPhoto(url)) return url
  }
  throw new PhotoError('too_big')
}
