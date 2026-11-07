// Lights in a scene photo (lightSpots.ts): finds the lamps, candles and lit windows in the picture, so the ambiance
// screen can make them flicker and breathe like the drawn décors' lights. Pure (pixels in, masks out):
// the component (PhotoLights.tsx) reads the pixels and shows the masks.
//
// A light is a spot that is bright, warm (yellow to orange, not the blue of a sky) and much brighter
// than what is around it (a lit window in a dark wall, not a sunny wall). A picture where such spots
// cover too much of it is a daylight picture: it gets no lights.

/** Analysis width: the picture is shrunk to this before looking for lights (the glow is soft anyway). */
export const ANALYSIS_WIDTH = 384

/** How a light moves: 0 and 1 flicker (flames, small lamps; two rhythms), 2 breathes (windows, doorways). */
export type LightGroup = 0 | 1 | 2
export const GROUPS: readonly LightGroup[] = [0, 1, 2]

export interface PhotoLight {
  /** Centre, in fractions of the picture. */
  x: number
  y: number
  /** Share of the picture it covers. */
  area: number
  group: LightGroup
}

export interface LightMasks {
  width: number
  height: number
  lights: PhotoLight[]
  /** One RGBA mask per group (premultiplied-free, straight alpha): the lights and their halo, ready for putImageData. */
  masks: Record<LightGroup, Uint8ClampedArray>
}

/** Above this share of the picture, the bright warm spots are daylight, not lights. */
export const MAX_LIT_SHARE = 0.08
/** Below this share of the picture, a light is a flame or a small lamp: it flickers. */
const SMALL_LIGHT = 0.0015
/** Brightness above which a pixel is white-hot: a flame or a bulb, not what it lights. */
const HOT = 0.82

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Mean of `v` over a (2r+1)² square around each pixel (summed-area table). */
function localMean(v: Float32Array, w: number, h: number, r: number): Float32Array {
  const sat = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += v[y * w + x]
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row
    }
  }
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w, x + r + 1)
      const s = sat[y1 * (w + 1) + x1] - sat[y0 * (w + 1) + x1] - sat[y1 * (w + 1) + x0] + sat[y0 * (w + 1) + x0]
      out[y * w + x] = s / ((x1 - x0) * (y1 - y0))
    }
  }
  return out
}

/** Box blur of one channel, two passes (close to a gaussian), in place. */
function blur(v: Float32Array, w: number, h: number, r: number) {
  if (r < 1) return
  const tmp = new Float32Array(Math.max(w, h))
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      let s = 0
      for (let x = -r; x <= r; x++) s += v[y * w + Math.min(w - 1, Math.max(0, x))]
      for (let x = 0; x < w; x++) {
        tmp[x] = s / (2 * r + 1)
        s += v[y * w + Math.min(w - 1, x + r + 1)] - v[y * w + Math.max(0, x - r)]
      }
      for (let x = 0; x < w; x++) v[y * w + x] = tmp[x]
    }
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let y = -r; y <= r; y++) s += v[Math.min(h - 1, Math.max(0, y)) * w + x]
      for (let y = 0; y < h; y++) {
        tmp[y] = s / (2 * r + 1)
        s += v[Math.min(h - 1, y + r + 1) * w + x] - v[Math.max(0, y - r) * w + x]
      }
      for (let y = 0; y < h; y++) v[y * w + x] = tmp[y]
    }
  }
}

/** Finds the lights in RGBA pixels (`w`×`h`). No light found (or a daylight picture): `lights` is empty. */
export function findLights(px: Uint8ClampedArray, w: number, h: number): LightMasks {
  const n = w * h
  const lum = new Float32Array(n)
  const warm = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255
    const g = px[i * 4 + 1] / 255
    const b = px[i * 4 + 2] / 255
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
    warm[i] = r - b
  }
  const around = localMean(lum, w, h, Math.max(3, Math.round(w * 0.08)))

  // How much each pixel is a light (0..1).
  const score = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    score[i] = smooth(0.42, 0.8, lum[i]) * smooth(0.1, 0.32, lum[i] - around[i]) * smooth(0.02, 0.14, warm[i])
  }
  // A flame's white core sits inside its orange glow: take in the pixels next to a light too.
  const lit = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let m = score[i]
      if (lum[i] > 0.75) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) m = Math.max(m, score[yy * w + xx] * 0.9)
        }
      }
      lit[i] = m
    }
  }

  const empty = (): Record<LightGroup, Uint8ClampedArray> => ({ 0: new Uint8ClampedArray(n * 4), 1: new Uint8ClampedArray(n * 4), 2: new Uint8ClampedArray(n * 4) })
  let total = 0
  for (let i = 0; i < n; i++) total += lit[i]
  if (total === 0 || total / n > MAX_LIT_SHARE) return { width: w, height: h, lights: [], masks: empty() }

  // Each spot (connected pixels) is one light, with its own rhythm. White-hot pixels (a flame, a bulb)
  // make spots of their own, apart from what they light (the candle's wax): the flame flickers.
  const hot = (i: number) => lum[i] > HOT
  const label = new Int32Array(n).fill(-1)
  const lights: PhotoLight[] = []
  const stack: number[] = []
  for (let start = 0; start < n; start++) {
    if (label[start] !== -1 || lit[start] < 0.2) continue
    const id = lights.length
    let count = 0
    let sx = 0
    let sy = 0
    label[start] = id
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()!
      const x = i % w
      const y = (i - x) / w
      count++
      sx += x
      sy += y
      const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]
      for (const j of next) {
        if (j >= 0 && label[j] === -1 && lit[j] >= 0.2 && hot(j) === hot(start)) {
          label[j] = id
          stack.push(j)
        }
      }
    }
    const area = count / n
    const cx = sx / count / w
    const cy = sy / count / h
    // Two flicker rhythms, picked from the light's place: neighbouring flames don't pulse together.
    const group: LightGroup = area >= SMALL_LIGHT ? 2 : ((Math.floor(cx * 7) + Math.floor(cy * 5)) % 2) as LightGroup
    lights.push({ x: cx, y: cy, area, group })
  }
  // Faint edges around a spot (below the spot threshold) belong to the nearest labelled pixel's light.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      if (label[i] !== -1 || lit[i] === 0) continue
      const x = i % w
      const near = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]
      for (const j of near) if (j >= 0 && j < n && label[j] >= 0) { label[i] = label[j]; break }
    }
  }

  // Masks: the light's own colour, pushed towards warm white, plus a soft halo around it.
  const masks = empty()
  const halo = new Float32Array(n)
  for (const g of GROUPS) {
    const mask = masks[g]
    halo.fill(0)
    let any = false
    for (let i = 0; i < n; i++) {
      if (label[i] < 0 || lights[label[i]].group !== g) continue
      halo[i] = lit[i]
      any = true
    }
    if (!any) continue
    const core = halo.slice()
    blur(halo, w, h, Math.max(1, Math.round(w * 0.012)))
    for (let i = 0; i < n; i++) {
      const a = Math.min(1, core[i] + halo[i] * 1.6)
      if (a <= 0.004) continue
      // On the light: its own colour, warmed. Around it: an amber glow.
      const own = core[i] > 0
      mask[i * 4] = own ? px[i * 4] * 0.65 + 255 * 0.35 : 255
      mask[i * 4 + 1] = own ? px[i * 4 + 1] * 0.65 + 214 * 0.35 : 176
      mask[i * 4 + 2] = own ? px[i * 4 + 2] * 0.65 + 150 * 0.35 : 96
      mask[i * 4 + 3] = Math.round(a * 255)
    }
  }
  return { width: w, height: h, lights, masks }
}
