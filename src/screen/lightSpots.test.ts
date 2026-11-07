import { describe, expect, it } from 'vitest'
import { findLights, MAX_LIT_SHARE } from './lightSpots'

const W = 200
const H = 120

/** A dark picture with rectangles painted on it. */
function picture(rects: Array<{ x: number; y: number; w: number; h: number; rgb: [number, number, number] }>, bg: [number, number, number] = [20, 16, 14]) {
  const px = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) px.set([...bg, 255], i * 4)
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) px.set([...r.rgb, 255], (y * W + x) * 4)
  }
  return px
}

describe('findLights', () => {
  it('finds a warm light in the dark, and a flame flickers while a window breathes', () => {
    const res = findLights(picture([
      { x: 20, y: 40, w: 3, h: 4, rgb: [255, 210, 120] }, // a flame
      { x: 120, y: 30, w: 14, h: 20, rgb: [230, 160, 70] }, // a lit window
    ]), W, H)
    expect(res.lights).toHaveLength(2)
    const flame = res.lights.find((l) => l.x < 0.5)!
    const window = res.lights.find((l) => l.x > 0.5)!
    expect(flame.group).not.toBe(2)
    expect(window.group).toBe(2)
    // The masks carry the lights where they are, transparent elsewhere.
    const at = (g: 0 | 1 | 2, x: number, y: number) => res.masks[g][(y * W + x) * 4 + 3]
    expect(at(2, 127, 40)).toBeGreaterThan(200)
    expect(at(2, 60, 100)).toBe(0)
    expect(at(flame.group, 21, 42)).toBeGreaterThan(200)
  })

  it('leaves cold lights alone (moonlit window, sky)', () => {
    const res = findLights(picture([{ x: 120, y: 30, w: 14, h: 20, rgb: [150, 170, 200] }]), W, H)
    expect(res.lights).toHaveLength(0)
  })

  it('finds nothing in a daylight picture (bright warm areas everywhere)', () => {
    const rects = Array.from({ length: 6 }, (_, i) => ({ x: i * 34, y: 10, w: 26, h: 100, rgb: [240, 200, 140] as [number, number, number] }))
    const res = findLights(picture(rects), W, H)
    expect(26 * 100 * 6 / (W * H)).toBeGreaterThan(MAX_LIT_SHARE)
    expect(res.lights).toHaveLength(0)
  })

  it('finds nothing in a dark picture with no light', () => {
    expect(findLights(picture([]), W, H).lights).toHaveLength(0)
  })
})
