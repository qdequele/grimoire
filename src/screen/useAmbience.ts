// The scene's ambience sounds, looped: the ambiance screen (a TV at the table) and the players' table
// on a computer both play them.
import { useEffect, useRef } from 'react'

const VOLUME = 0.7
const FADE_MS = 2500

/** Loops the scene's ambience sounds, fading them in and out. Only after a tap (browsers block autoplay). */
export function useAmbience(urls: string[], on: boolean) {
  const playing = useRef(new Map<string, { audio: HTMLAudioElement; timer?: ReturnType<typeof setInterval> }>())
  const wanted = on ? urls : []
  const signature = wanted.join('|')
  useEffect(() => {
    const want = new Set(signature ? signature.split('|') : [])
    const fade = (url: string, to: number) => {
      const p = playing.current.get(url)
      if (!p) return
      clearInterval(p.timer)
      const from = p.audio.volume
      const start = performance.now()
      p.timer = setInterval(() => {
        const k = Math.min(1, (performance.now() - start) / FADE_MS)
        p.audio.volume = from + (to - from) * k
        if (k < 1) return
        clearInterval(p.timer)
        if (to === 0) {
          p.audio.pause()
          playing.current.delete(url)
        }
      }, 50)
    }
    for (const url of want) {
      if (!playing.current.has(url)) {
        const audio = new Audio(url)
        audio.loop = true
        audio.volume = 0
        playing.current.set(url, { audio })
        void audio.play().catch(() => undefined)
      }
      fade(url, VOLUME)
    }
    for (const url of [...playing.current.keys()]) if (!want.has(url)) fade(url, 0)
  }, [signature])
  useEffect(() => {
    const all = playing.current
    return () => {
      for (const p of all.values()) {
        clearInterval(p.timer)
        p.audio.pause()
      }
      all.clear()
    }
  }, [])
}
