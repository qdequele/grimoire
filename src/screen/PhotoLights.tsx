import { useEffect, useRef, useState } from 'react'
import { ANALYSIS_WIDTH, findLights, GROUPS, type LightGroup, type LightMasks } from './lightSpots'

/** Reads a picture's pixels, small. Null when it can't (no CORS on that address, decode error). */
async function pixels(url: string): Promise<{ data: Uint8ClampedArray; w: number; h: number } | null> {
  const img = new Image()
  // A separate, CORS request: the shown <img> stays untouched if the server refuses.
  img.crossOrigin = 'anonymous'
  img.src = url
  try {
    await img.decode()
  } catch {
    return null
  }
  const w = Math.min(ANALYSIS_WIDTH, img.naturalWidth)
  const h = Math.max(1, Math.round((img.naturalHeight * w) / img.naturalWidth))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  try {
    return { data: ctx.getImageData(0, 0, w, h).data, w, h }
  } catch {
    return null // tainted canvas
  }
}

function Mask({ masks, group }: { masks: LightMasks; group: LightGroup }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    c.width = masks.width
    c.height = masks.height
    ctx.putImageData(new ImageData(new Uint8ClampedArray(masks.masks[group]), masks.width, masks.height), 0, 0)
  }, [masks, group])
  return <canvas ref={ref} className="scr-fill scr-cover scr-plight" data-g={group} aria-hidden />
}

/**
 * The lights of a scene photo (lamps, candles, lit windows), found in its pixels, glowing over it:
 * flames flicker, windows breathe. Mounted inside the picture's pan and zoom, so they stay on it.
 * Only opacity is animated (screen.css), the masks are drawn once.
 */
export function PhotoLights({ imageUrl }: { imageUrl: string }) {
  const [found, setFound] = useState<{ url: string; masks: LightMasks } | null>(null)
  useEffect(() => {
    let live = true
    void pixels(imageUrl).then((p) => {
      if (!live || !p) return
      const masks = findLights(p.data, p.w, p.h)
      if (masks.lights.length > 0) setFound({ url: imageUrl, masks })
    })
    return () => {
      live = false
    }
  }, [imageUrl])
  if (!found || found.url !== imageUrl) return null
  const groups = GROUPS.filter((g) => found.masks.lights.some((l) => l.group === g))
  return (
    <div className="scr-fill scr-plights" data-lights={found.masks.lights.length}>
      {groups.map((g) => (
        <Mask key={g} masks={found.masks} group={g} />
      ))}
    </div>
  )
}
