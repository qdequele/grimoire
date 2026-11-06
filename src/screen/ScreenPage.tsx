import { Maximize } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { soundUrls } from './ambiance'
import { useScreenLive, useScreenView } from './api'
import { Stage } from './Stage'
import { shownScene } from './state'

/** The cursor and the controls hide after this long without moving. */
const IDLE_MS = 3000
const VOLUME = 0.7
const FADE_MS = 2500

function useIdle(): boolean {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), IDLE_MS)
    const wake = () => {
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), IDLE_MS)
    }
    const events = ['mousemove', 'pointerdown', 'keydown', 'touchstart'] as const
    for (const e of events) addEventListener(e, wake, { passive: true })
    return () => {
      clearTimeout(timer)
      for (const e of events) removeEventListener(e, wake)
    }
  }, [])
  return idle
}

/** Keeps the TV / tablet awake while the page is visible (the lock drops when hidden: take it again). */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let disposed = false
    const take = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(
        (l) => {
          if (disposed) void l.release()
          else lock = l
        },
        () => undefined,
      )
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', take)
      void lock?.release().catch(() => undefined)
    }
  }, [on])
}

/** Loops the scene's ambience sounds, fading them in and out. Only after a tap (browsers block autoplay). */
function useAmbience(urls: string[], on: boolean) {
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

function Message({ text }: { text: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-black p-8 text-center">
      <span className="eyebrow">Grimoire</span>
      <p className="font-heading text-2xl text-[#efe6cf]">{text}</p>
    </div>
  )
}

/**
 * The ambiance screen (`/screen/:token`): a TV, monitor or tablet in the middle of the table shows the
 * current scene's living background and the handouts the keeper pushes. No account: the link is the key.
 */
export function ScreenPage() {
  const t = useT()
  const { token = '' } = useParams()
  const view = useScreenView(token)
  useScreenLive(token, view.data?.channel)
  const idle = useIdle()
  const [started, setStarted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  useWakeLock(started)

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  const screen = view.data?.screen
  const scene = screen ? shownScene(screen) : null
  useAmbience(soundUrls(scene?.sounds ?? []), started && !!screen?.sound)

  const start = () => {
    setStarted(true)
    void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  if (view.error?.code === 'link_invalid') return <Message text={t("Ce lien d'écran n'est plus valide.")} />

  return (
    <div className={cn('scr-root', idle && 'is-idle')} onDoubleClick={start}>
      <Stage scene={scene} handout={screen?.handout ?? null} />
      {(!started || !fullscreen) && (
        <div className={cn('scr-start', started && 'is-started')}>
          <Button variant="outline" size="lg" onClick={start} className="border-gold/60 bg-black/50 font-serif text-[#efe6cf] backdrop-blur-none">
            <Maximize /> {started ? t('Plein écran') : t('Toucher pour lancer l’écran')}
          </Button>
          {!started && <span className="text-sm text-[#efe6cf]/70">{t('Plein écran, son et écran toujours allumé.')}</span>}
        </div>
      )}
    </div>
  )
}
