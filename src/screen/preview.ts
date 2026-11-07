// The scene /screen-preview draws, from its query params (see ScreenPreview.tsx).
import { isPlace, isPreset, isTime } from './ambiance'
import type { ScreenScene } from './state'

const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
const STORAGE = base ? `${base}/storage/v1/object/sign/` : null

/** The scene drawn for these params. A picture is only taken from this project's Storage. */
export function previewScene(params: URLSearchParams): ScreenScene {
  const p = params.get('preset')
  const place = params.get('place')
  const time = params.get('time')
  const image = params.get('image')
  return {
    preset: isPreset(p) ? p : 'fog',
    image: image && STORAGE && image.startsWith(STORAGE) ? { bucket: 'story-packs', path: '', url: image } : null,
    sounds: [],
    ...(isPlace(place) ? { place } : {}),
    ...(isTime(time) ? { time } : {}),
  }
}

