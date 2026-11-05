import { useEffect, useRef } from 'react'
import type { PresetLook } from './ambiance'

/** The canvas never draws more than this many pixels wide: CSS scales it up (soft particles look fine). */
const MAX_WIDTH = 960
/** ~30 fps is plenty for slow particles and halves the work on a cheap TV. */
const FRAME_MS = 33

interface Drop { x: number; y: number; v: number; len: number; a: number }

/**
 * Rain, dust motes or embers on one small canvas. Stops when the tab is hidden; not mounted at all
 * when the viewer asked for reduced motion.
 */
export function Particles({ kind, heavy }: { kind: NonNullable<PresetLook['particles']>; heavy?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let w = 0
    let h = 0
    let items: Drop[] = []
    const count = () => (kind === 'rain' ? (heavy ? 260 : 170) : kind === 'embers' ? 40 : 70)
    const spawn = (anywhere: boolean): Drop => {
      const x = Math.random() * w
      if (kind === 'rain') return { x, y: anywhere ? Math.random() * h : -20, v: 9 + Math.random() * 7, len: 10 + Math.random() * 14, a: 0.12 + Math.random() * 0.22 }
      // Dust and embers drift up slowly; embers are fewer, warmer and faster.
      const v = kind === 'embers' ? 0.5 + Math.random() * 0.9 : 0.08 + Math.random() * 0.25
      return { x, y: anywhere ? Math.random() * h : h + 10, v, len: kind === 'embers' ? 1 + Math.random() * 1.6 : 0.6 + Math.random() * 1.6, a: Math.random() }
    }
    const resize = () => {
      const scale = Math.min(1, MAX_WIDTH / Math.max(1, innerWidth))
      w = canvas.width = Math.round(innerWidth * scale)
      h = canvas.height = Math.round(innerHeight * scale)
      items = Array.from({ length: count() }, () => spawn(true))
    }
    resize()
    addEventListener('resize', resize)

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
      } else {
        ctx.fillStyle = kind === 'embers' ? 'rgb(255,170,90)' : 'rgb(235,220,190)'
        for (const d of items) {
          d.y -= d.v
          d.x += Math.sin((t + d.a * 600) / 90) * (kind === 'embers' ? 0.5 : 0.25)
          if (d.y < -10) Object.assign(d, spawn(false))
          // Motes twinkle slowly; embers fade as they rise.
          ctx.globalAlpha = kind === 'embers' ? Math.max(0, Math.min(1, d.y / h)) * 0.8 : 0.15 + 0.35 * (0.5 + 0.5 * Math.sin((t + d.a * 1000) / 40))
          ctx.beginPath()
          ctx.arc(d.x, d.y, d.len, 0, Math.PI * 2)
          ctx.fill()
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
  }, [kind, heavy])
  return <canvas ref={ref} className="scr-fill scr-particles" aria-hidden />
}
