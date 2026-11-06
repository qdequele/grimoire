import { useEffect, useRef } from 'react'
import type { PresetLook } from './ambiance'

/** The canvas never draws more than this many pixels wide: CSS scales it up (soft particles look fine). */
const MAX_WIDTH = 960
/** ~30 fps is plenty for slow particles and halves the work on a cheap TV. */
const FRAME_MS = 33

type Kind = NonNullable<PresetLook['particles']>

interface Drop { x: number; y: number; v: number; len: number; a: number }

/** Particles of each kind at density 1. */
const COUNT: Record<Kind, number> = { rain: 170, dust: 70, embers: 40, snow: 150, bubbles: 45, spores: 60 }
/** What falls (the others rise). */
const FALLS: Partial<Record<Kind, true>> = { rain: true, snow: true }

/**
 * Rain, snow, dust motes, embers, bubbles or spores on one small canvas. Stops when the tab is hidden;
 * not mounted at all when the viewer asked for reduced motion.
 */
export function Particles({ kind, density = 1 }: { kind: Kind; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let w = 0
    let h = 0
    let items: Drop[] = []
    const count = () => Math.round(COUNT[kind] * density)
    const spawn = (anywhere: boolean): Drop => {
      const x = Math.random() * w
      const y = anywhere ? Math.random() * h : FALLS[kind] ? -20 : h + 10
      switch (kind) {
        case 'rain':
          return { x, y, v: 9 + Math.random() * 7, len: 10 + Math.random() * 14, a: 0.12 + Math.random() * 0.22 }
        // Flakes: the big ones are near, so they fall faster and show brighter.
        case 'snow': {
          const near = Math.random()
          return { x, y, v: 0.35 + near * 1.1, len: 0.7 + near * 2.2, a: 0.25 + near * 0.6 }
        }
        case 'bubbles':
          return { x, y, v: 0.3 + Math.random() * 0.9, len: 1 + Math.random() * 3.2, a: Math.random() }
        case 'spores':
          return { x, y, v: 0.04 + Math.random() * 0.14, len: 0.8 + Math.random() * 1.8, a: Math.random() }
        // Dust and embers drift up slowly; embers are fewer, warmer and faster.
        case 'embers':
          return { x, y, v: 0.5 + Math.random() * 0.9, len: 1 + Math.random() * 1.6, a: Math.random() }
        case 'dust':
          return { x, y, v: 0.08 + Math.random() * 0.25, len: 0.6 + Math.random() * 1.6, a: Math.random() }
      }
    }
    const resize = () => {
      const scale = Math.min(1, MAX_WIDTH / Math.max(1, innerWidth))
      w = canvas.width = Math.round(innerWidth * scale)
      h = canvas.height = Math.round(innerHeight * scale)
      items = Array.from({ length: count() }, () => spawn(true))
    }
    resize()
    addEventListener('resize', resize)

    const dot = (d: Drop) => {
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.len, 0, Math.PI * 2)
      ctx.fill()
    }

    let raf = 0
    let last = 0
    let t = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < FRAME_MS) return
      last = now
      t += 1
      ctx.clearRect(0, 0, w, h)
      if (kind === 'rain') {
        ctx.strokeStyle = 'rgba(190,210,230,1)'
        ctx.lineWidth = 1
        for (const d of items) {
          d.y += d.v
          d.x -= d.v * 0.18
          if (d.y > h + 20) Object.assign(d, spawn(false))
          ctx.globalAlpha = d.a
          ctx.beginPath()
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(d.x + d.len * 0.18, d.y - d.len)
          ctx.stroke()
        }
      } else if (kind === 'snow') {
        ctx.fillStyle = 'rgb(240,244,250)'
        for (const d of items) {
          d.y += d.v
          // Each flake sways on its own, a light wind pushes them all a little.
          d.x += Math.sin((t + d.a * 900) / 55) * 0.35 * d.v + 0.12
          if (d.y > h + 10) Object.assign(d, spawn(false))
          if (d.x > w + 10) d.x -= w + 20
          ctx.globalAlpha = d.a
          dot(d)
        }
      } else if (kind === 'bubbles') {
        ctx.strokeStyle = 'rgb(190,235,230)'
        ctx.lineWidth = 0.8
        for (const d of items) {
          d.y -= d.v
          d.x += Math.sin((t + d.a * 700) / 25) * 0.3
          if (d.y < -10) Object.assign(d, spawn(false))
          // Fainter in the deep, clearer near the surface.
          ctx.globalAlpha = 0.12 + 0.4 * (1 - Math.max(0, Math.min(1, d.y / h)))
          ctx.beginPath()
          ctx.arc(d.x, d.y, d.len, 0, Math.PI * 2)
          ctx.stroke()
        }
      } else if (kind === 'spores') {
        ctx.fillStyle = 'rgb(185,235,140)'
        for (const d of items) {
          // Slow circles while they climb: they seem to hang in the air.
          const turn = (t + d.a * 2000) / 160
          d.y -= d.v + Math.cos(turn) * 0.12
          d.x += Math.sin(turn) * 0.28
          if (d.y < -10) Object.assign(d, spawn(false))
          ctx.globalAlpha = 0.1 + 0.55 * (0.5 + 0.5 * Math.sin((t + d.a * 1300) / 28))
          dot(d)
        }
      } else {
        ctx.fillStyle = kind === 'embers' ? 'rgb(255,170,90)' : 'rgb(235,220,190)'
        for (const d of items) {
          d.y -= d.v
          d.x += Math.sin((t + d.a * 600) / 90) * (kind === 'embers' ? 0.5 : 0.25)
          if (d.y < -10) Object.assign(d, spawn(false))
          // Motes twinkle slowly; embers fade as they rise.
          ctx.globalAlpha = kind === 'embers' ? Math.max(0, Math.min(1, d.y / h)) * 0.8 : 0.15 + 0.35 * (0.5 + 0.5 * Math.sin((t + d.a * 1000) / 40))
          dot(d)
        }
      }
      ctx.globalAlpha = 1
    }
    const start = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }
    start()
    document.addEventListener('visibilitychange', start)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', start)
    }
  }, [kind, density])
  return <canvas ref={ref} className="scr-fill scr-particles" aria-hidden />
}
