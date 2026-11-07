import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useT, type T } from '@/i18n/t'
import { Chip, DemoCard } from './parts'

// The game screen's sound panel, cut down: looping ambiences that mix together and one-shot effects,
// from the same sound library (public/sons). Nothing plays until the visitor taps.

// Labels through t() literals (en.test.ts finds them there).
const ambiences = (t: T) => [
  { file: 'amb-pluie', label: t('Pluie') },
  { file: 'amb-orage', label: t('Orage') },
  { file: 'amb-cheminee', label: t('Feu de cheminée') },
  { file: 'amb-vent-hurlant', label: t('Vent hurlant') },
  { file: 'amb-horloge', label: t('Horloge') },
  { file: 'amb-corbeaux', label: t('Corbeaux') },
]
const effects = (t: T) => [
  { file: 'fx-creak1', label: t('Grincement') },
  { file: 'fx-dooropen-1', label: t('Porte') },
  { file: 'fx-footstep03', label: t('Pas') },
  { file: 'fx-tonnerre-1', label: t('Tonnerre') },
  { file: 'fx-loup-1', label: t('Loup') },
  { file: 'fx-chouette-1', label: t('Chouette') },
]

const VOLUME = 0.6
const src = (file: string) => `/sons/${file}.mp3`

/** Volume ramp, like the game's 2 s fade in and 1.5 s fade out. */
function fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = a.volume
  const start = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / ms)
    a.volume = from + (to - from) * k
    if (k < 1) requestAnimationFrame(step)
    else done?.()
  }
  requestAnimationFrame(step)
}

export function SoundDemo() {
  const t = useT()
  const playing = useRef(new Map<string, HTMLAudioElement>())
  const [on, setOn] = useState<string[]>([])

  useEffect(() => {
    const map = playing.current
    return () => map.forEach((a) => a.pause())
  }, [])

  function toggle(file: string) {
    const map = playing.current
    const a = map.get(file)
    if (a) {
      map.delete(file)
      fade(a, 0, 1500, () => a.pause())
      setOn((o) => o.filter((f) => f !== file))
      return
    }
    const next = new Audio(src(file))
    next.loop = true
    next.volume = 0
    next.play().then(() => fade(next, VOLUME, 2000)).catch(() => {})
    map.set(file, next)
    setOn((o) => [...o, file])
  }

  function effect(file: string) {
    const a = new Audio(src(file))
    a.volume = 0.8
    a.play().catch(() => {})
  }

  function stopAll() {
    playing.current.forEach((a) => fade(a, 0, 800, () => a.pause()))
    playing.current.clear()
    setOn([])
  }

  return (
    <DemoCard label={t('Sons')} hint={t('allume une ambiance, ajoute un bruitage')}>
      <div className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{t('Ambiances en boucle')}</span>
        <div className="flex flex-wrap gap-1.5">
          {ambiences(t).map((s) => (
            <Chip key={s.file} on={on.includes(s.file)} onClick={() => toggle(s.file)}>
              {on.includes(s.file) && <span aria-hidden="true">♪ </span>}
              {s.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs tracking-[0.14em] text-muted-foreground uppercase">{t('Bruitages')}</span>
        <div className="grid grid-cols-3 gap-1.5">
          {effects(t).map((s) => (
            <button
              key={s.file}
              type="button"
              onClick={() => effect(s.file)}
              className="border border-border py-3 text-xs tracking-[0.1em] text-muted-foreground uppercase hover:border-gold/60 hover:text-gold active:bg-gold/10"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">
          {on.length ? t.n(on.length, '{n} ambiance en cours', '{n} ambiances en cours') : t('Silence.')}
        </span>
        <Button variant="ghost" size="sm" disabled={!on.length} onClick={stopAll}>{t('Tout arrêter')}</Button>
      </div>
    </DemoCard>
  )
}
