import { describe, expect, it } from 'vitest'
import { previewParams } from '@/games/screen'
import { previewScene } from './preview'

const STORAGE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/sign/story-packs/x.svg?token=t`

describe('ambiance screen preview', () => {
  it('round-trips a scene through its query params', () => {
    const p = previewParams({ preset: 'rain', image: null, sounds: [], place: 'manor', time: 'dusk' }, undefined)
    expect(previewScene(p)).toEqual({ preset: 'rain', image: null, sounds: [], place: 'manor', time: 'dusk' })
  })

  it('takes a picture only from this project\'s Storage', () => {
    expect(previewScene(new URLSearchParams({ preset: 'fog', image: STORAGE })).image?.url).toBe(STORAGE)
    expect(previewScene(new URLSearchParams({ preset: 'fog', image: 'https://evil.example/x.png' })).image).toBeNull()
    expect(previewScene(new URLSearchParams({ preset: 'fog', image: 'javascript:alert(1)' })).image).toBeNull()
  })

  it('ignores unknown values', () => {
    expect(previewScene(new URLSearchParams({ preset: 'lava', place: 'moon', time: 'noon' }))).toEqual({ preset: 'fog', image: null, sounds: [] })
  })
})
