// The scene /screen-preview draws, from its query params (see ScreenPreview.tsx).
import { isPlace, isPreset, isTime } from './ambiance'
import type { ScreenScene } from './state'

/** Signed Storage URLs of this project start with this (read when called, so tests can set it). */
function storagePrefix(): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  return base ? `${base}/storage/v1/object/sign/` : null
}

/** Query params of /screen-preview for a scene (the picture as a signed URL). */
export function previewParams(scene: ScreenScene, imageUrl: string | undefined): URLSearchParams {
  const p = new URLSearchParams({ preset: scene.preset })
  if (scene.place) p.set('place', scene.place)
  if (scene.time) p.set('time', scene.time)
  if (imageUrl) p.set('image', imageUrl)
  return p
}

/** The scene drawn for these params. A picture is only taken from this project's Storage. */
export function previewScene(params: URLSearchParams): ScreenScene {
  const p = params.get('preset')
  const place = params.get('place')
  const time = params.get('time')
  const image = params.get('image')
  const storage = storagePrefix()
  return {
    preset: isPreset(p) ? p : 'fog',
    image: image && storage && image.startsWith(storage) ? { bucket: 'story-packs', path: '', url: image } : null,
    sounds: [],
    ...(isPlace(place) ? { place } : {}),
    ...(isTime(time) ? { time } : {}),
  }
}

