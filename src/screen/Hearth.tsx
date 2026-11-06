import { useEffect, useRef, useState } from 'react'
import type { FirePlace } from './ambiance'

/** The canvas never draws more than this many pixels wide: CSS scales it up (fire is soft anyway). */
const MAX_WIDTH = 960
/** ~30 fps, like the other particles: plenty for fire on a cheap TV. */
const FRAME_MS = 33
/** Flames per second. Constant whatever the fire's size: the flames scale with it, so it looks the same. */
const RATE = 420

interface Flame { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; seed: number }
interface Ember { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; seed: number }

type Sprites = Record<'core' | 'yellow' | 'orange' | 'red' | 'ember', HTMLCanvasElement>
let sprites: Sprites | null = null

function sprite(rgb: string, size: number, hard: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  if (!g) return c
  const h = size / 2
  const gr = g.createRadialGradient(h, h, 0, h, h, h)
  gr.addColorStop(0, `rgba(${rgb},1)`)
  gr.addColorStop(hard, `rgba(${rgb},.45)`)
  gr.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = gr
  g.fillRect(0, 0, size, size)
  return c
}

const getSprites = (): Sprites =>
  (sprites ??= {
    core: sprite('255,236,190', 64, 0.35),
    yellow: sprite('255,184,70', 64, 0.35),
    orange: sprite('255,112,26', 64, 0.35),
    red: sprite('190,44,8', 64, 0.35),
    ember: sprite('255,150,60', 16, 0.25),
  })

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Natural size of the background picture, to find the fire place under object-fit: cover. */
function useImageSize(url: string | null): { w: number; h: number } | null {
  const [size, setSize] = useState<{ url: string; w: number; h: number } | null>(null)
  useEffect(() => {
    if (!url) return
    let live = true
    const img = new Image()
    img.src = url
    img.decode().then(
      () => {
        if (live) setSize({ url, w: img.naturalWidth, h: img.naturalHeight })
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [url])
  return size && size.url === url ? size : null
}

/**
 * A live fire on one canvas: flame tongues, a bed of embers, sparks, and the warm flickering light it
 * throws (with darkness away from it). Placed on the picture's fire (`fire`, fractions of the picture,
 * mapped through object-fit: cover), so it moves with the slow pan and zoom when mounted inside it.
 * `still`: one settled frame, no animation (reduced motion).
 */
export function Hearth({ fire, imageUrl, still }: { fire: FirePlace; imageUrl: string | null; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const imageSize = useImageSize(imageUrl)
  const imgW = imageSize?.w
  const imgH = imageSize?.h

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const spr = getSprites()
    let w = 0
    let h = 0
    let k = 1
    const resize = () => {
      const box = canvas.parentElement?.getBoundingClientRect()
      const bw = box?.width || innerWidth
      const bh = box?.height || innerHeight
      k = Math.min(1, MAX_WIDTH / Math.max(1, bw))
      w = canvas.width = Math.round(bw * k)
      h = canvas.height = Math.round(bh * k)
    }
    resize()
    addEventListener('resize', resize)

    /** The fire on the canvas: base centre and width in canvas pixels. */
    const place = () => {
      if (!imgW || !imgH) return { fx: fire.x * w, fy: fire.y * h, fw: fire.width * w }
      const s = Math.max(w / imgW, h / imgH)
      const dx = (w - imgW * s) / 2
      const dy = (h - imgH * s) / 2
      return { fx: dx + fire.x * imgW * s, fy: dy + fire.y * imgH * s, fw: fire.width * imgW * s }
    }

    const flames: Flame[] = []
    const embers: Ember[] = []
    let acc = 0
    let flick = 0.5
    let flickTarget = 0.5
    let kick = 0
    let t = 0

    const step = (dt: number) => {
      const { fx, fy, fw } = place()
      const u = fw / 300
      t += dt
      if (Math.random() < dt * 3) flickTarget = Math.random()
      flick += (flickTarget - flick) * Math.min(1, dt * 9)
      kick *= Math.exp(-dt * 7)
      if (Math.random() < dt * 1.4) kick = Math.max(kick, rand(0.2, 0.7))
      acc += RATE * dt * (1 + kick * 0.6)
      while (acc >= 1) {
        acc--
        flames.push({
          x: fx + (Math.random() + Math.random() - 1) * fw * 0.45, y: fy + rand(-4, 8) * u,
          vx: rand(-10, 10) * u, vy: -rand(170, 330) * u * (1 + kick * 0.4),
          age: 0, life: rand(0.4, 0.95), size: rand(16, 34) * u, seed: rand(0, 99),
        })
      }
      for (let i = flames.length - 1; i >= 0; i--) {
        const p = flames[i]
        p.age += dt
        if (p.age >= p.life) {
          flames.splice(i, 1)
          continue
        }
        p.x += (p.vx + Math.sin(t * 6 + p.seed) * 22 * u + (fx - p.x) * 1.6) * dt
        p.y += p.vy * dt
        p.vy -= 30 * u * dt
      }
      if (Math.random() < (9 + kick * 40) * dt) {
        embers.push({ x: fx + rand(-0.4, 0.4) * fw, y: fy - rand(0, 30) * u, vx: rand(-20, 20) * u, vy: -rand(50, 130) * u, age: 0, life: rand(1.6, 4), size: rand(3, 7) * u, seed: rand(0, 99) })
      }
      for (let i = embers.length - 1; i >= 0; i--) {
        const p = embers[i]
        p.age += dt
        if (p.age >= p.life) {
          embers.splice(i, 1)
          continue
        }
        p.x += (p.vx + Math.sin(t * 2.3 + p.seed) * 22 * u) * dt
        p.y += p.vy * dt
        p.vy *= 0.997
      }
    }

    const glow = (x: number, y: number, r: number, color: string) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, color)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gr
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    const draw = () => {
      const { fx, fy, fw } = place()
      const f = 0.82 + 0.18 * flick + kick * 0.25
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.clearRect(0, 0, w, h)
      // Darkness away from the fire: the light's reach breathes with the flames.
      const reach = Math.max(w, h) * (0.62 + 0.05 * f)
      const lx = fx + (flick - 0.5) * fw * 0.04
      const ly = fy - fw * 0.35
      const dark = ctx.createRadialGradient(lx, ly, fw * 0.3, lx, ly, reach)
      dark.addColorStop(0, 'rgba(0,0,0,0)')
      dark.addColorStop(0.55, `rgba(0,0,0,${0.22 - 0.08 * f})`)
      dark.addColorStop(1, `rgba(0,0,0,${0.5 - 0.08 * f})`)
      ctx.fillStyle = dark
      ctx.fillRect(0, 0, w, h)

      ctx.globalCompositeOperation = 'lighter'
      // Warm light on the room, then the hearth's own glow.
      glow(lx, ly, reach * 0.9, `rgba(255,120,40,${0.07 + 0.05 * f})`)
      glow(fx, fy - fw * 0.1, fw * 1.1, `rgba(255,110,25,${0.16 + 0.1 * f})`)
      // Bed of embers along the base.
      ctx.save()
      ctx.translate(fx, fy + fw * 0.04)
      ctx.scale(1, 0.22)
      glow(0, 0, fw * 0.63, `rgba(255,${Math.round(90 + 40 * f)},20,${0.55 + 0.2 * f})`)
      glow(0, 0, fw * 0.37, `rgba(255,190,90,${0.35 + 0.2 * f})`)
      ctx.restore()
      // Flame tongues: narrow and tall, stretched more as they rise.
      for (const p of flames) {
        const q = p.age / p.life
        const s = q < 0.1 ? spr.core : q < 0.35 ? spr.yellow : q < 0.65 ? spr.orange : spr.red
        const size = p.size * (1 - 0.7 * q)
        const fwid = size * 0.62
        const fh = size * (1.5 + 1.6 * q)
        ctx.globalAlpha = (1 - q) * (q < 0.1 ? 0.28 : 0.42)
        ctx.drawImage(s, p.x - fwid / 2, p.y - fh * 0.7, fwid, fh)
      }
      for (const p of embers) {
        const q = p.age / p.life
        ctx.globalAlpha = (1 - q) * (0.55 + 0.45 * Math.sin(t * 18 + p.seed))
        const s = p.size * (1 - 0.5 * q) * 2
        ctx.drawImage(spr.ember, p.x - s / 2, p.y - s / 2, s, s)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    if (still) {
      for (let i = 0; i < 45; i++) step(1 / 30)
      draw()
      const redraw = () => {
        resize()
        draw()
      }
      removeEventListener('resize', resize)
      addEventListener('resize', redraw)
      return () => removeEventListener('resize', redraw)
    }

    let raf = 0
    let last = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < FRAME_MS) return
      const dt = last ? Math.min(0.05, (now - last) / 1000) : FRAME_MS / 1000
      last = now
      step(dt)
      draw()
    }
    const start = () => {
      cancelAnimationFrame(raf)
      last = 0
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }
    start()
    document.addEventListener('visibilitychange', start)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', start)
    }
  }, [fire.x, fire.y, fire.width, still, imgW, imgH])

  return <canvas ref={ref} className="scr-fill scr-hearth" aria-hidden />
}
