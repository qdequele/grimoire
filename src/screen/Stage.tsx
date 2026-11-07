import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DEFAULT_FIRE, LOOKS, paletteFor, type PresetEffect, type PresetId, type TimeOfDay } from './ambiance'
import { Hearth } from './Hearth'
import { Particles } from './Particles'
import { PhotoLights } from './PhotoLights'
import { Place } from './Places'
import { sceneKey, type ScreenHandout, type ScreenScene } from './state'
import './screen.css'

/** How long a new picture may take to load before the scene shows without it. */
const LOAD_TIMEOUT = 15_000
/** Handouts leave with a short animation before being removed. */
const HANDOUT_OUT_MS = 700

function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Resolves true once the picture is decoded (so it fades in whole), false if it fails or takes too long. */
function preload(url: string | undefined): Promise<boolean> {
  if (!url) return Promise.resolve(false)
  const img = new Image()
  img.src = url
  return Promise.race([
    img.decode().then(() => true, () => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), LOAD_TIMEOUT)),
  ])
}

function Lightning() {
  const [n, setN] = useState(0)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const next = () => {
      timer = setTimeout(() => {
        setN((x) => x + 1)
        next()
      }, 7000 + Math.random() * 16000)
    }
    next()
    return () => clearTimeout(timer)
  }, [])
  return n ? <div key={n} className="scr-fill scr-lightning" /> : null
}

/** A preset's light effect: plain elements, everything is in screen.css (`.scr-fx-<effect>`). */
function Effect({ effect }: { effect: PresetEffect }) {
  return (
    <div className={`scr-fill scr-fx scr-fx-${effect}`} data-effect={effect}>
      {effect === 'shafts' && (
        <>
          <i />
          <i />
          <i />
          <i />
        </>
      )}
      {effect === 'aura' && (
        <>
          <i className="scr-aura-rays" />
          <i className="scr-aura-glow" />
        </>
      )}
      {effect === 'blaze' && (
        <>
          <i className="scr-blaze-low" />
          <i className="scr-blaze-high" />
        </>
      )}
    </div>
  )
}

interface Layer { id: number; key: string; scene: ScreenScene | null; url: string | null }

function SceneLayer({ layer, reduced, onShown }: { layer: Layer; reduced: boolean; onShown: () => void }) {
  const preset: PresetId = layer.scene?.preset ?? 'fog'
  const look = LOOKS[preset]
  const fire = layer.scene?.fire ?? DEFAULT_FIRE
  // A drawn décor only when there is no picture: the picture is the place.
  const place = layer.scene?.place ?? null
  // Underground, no daylight: a crypt keeps its night colours.
  const time: TimeOfDay = place === 'crypt' && !layer.url ? 'night' : (layer.scene?.time ?? look.time)
  const palette = paletteFor(preset, time)
  const style = {
    '--c0': palette[0],
    '--c1': palette[1],
    '--c2': palette[2],
    '--drift': `${look.drift}s`,
    '--fog': look.fog,
    '--grain': look.grain,
    '--vig': time === 'day' ? look.vignette * 0.55 : look.vignette,
    '--fog-rgb': look.fogColor,
  } as CSSProperties
  return (
    <div
      className="scr-fill scr-layer"
      style={style}
      data-preset={preset}
      data-time={time}
      data-sky={look.overcast ? 'overcast' : 'clear'}
      data-image={layer.url ? 'yes' : 'no'}
      onAnimationEnd={(e) => e.target === e.currentTarget && onShown()}
    >
      {layer.url ? (
        // The fire sits inside the pan-and-zoom, so it stays on the picture's hearth.
        <div className="scr-fill scr-kb">
          <img className="scr-fill scr-cover" src={layer.url} alt="" draggable={false} />
          <PhotoLights imageUrl={layer.url} />
          {look.fire && <Hearth fire={fire} imageUrl={layer.url} still={reduced} />}
        </div>
      ) : (
        <div className="scr-fill scr-abstract" data-place={place ?? undefined}>
          <div className="scr-blob a" />
          {place ? <Place place={place} /> : <div className="scr-blob b" />}
          {look.fire && <Hearth fire={fire} imageUrl={null} still={reduced} />}
        </div>
      )}
      {look.flicker && <div className="scr-fill scr-flicker" />}
      {look.fog > 0 && (
        <div className="scr-fill scr-fogs">
          <i />
          <i />
          <i />
        </div>
      )}
      {/* Over the fog: the light shows in it. */}
      {look.effect && <Effect effect={look.effect} />}
      {!reduced && look.particles && <Particles kind={look.particles} density={look.density} />}
      {!reduced && look.lightning && <Lightning />}
      <div className="scr-fill scr-grain" />
      <div className="scr-fill scr-vignette" />
    </div>
  )
}

/** Story rich text, safely: **bold** and *italic* kept, links and markers reduced to their words. */
function richText(text: string): ReactNode[] {
  const plain = text
    .replace(/\[\[[a-z0-9-]+\|(.*?)\]\]/g, '$1')
    .replace(/\[\[([a-z0-9-]+)\]\]/g, '')
    .replace(/\{\{[a-z]+:[a-z0-9-]+\}\}/g, '')
  return plain.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <b key={i}>{part.slice(2, -2)}</b>
      : part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <i key={i}>{part.slice(1, -1)}</i>
        : part,
  )
}

function Handout({ handout, out }: { handout: ScreenHandout; out: boolean }) {
  const url = handout.image?.url
  return (
    <figure className={cn('scr-handout', out && 'is-out')} aria-label={handout.title || undefined} data-handout={handout.key}>
      {url ? (
        <div className="scr-paper">
          <img src={url} alt={handout.title} draggable={false} />
        </div>
      ) : (
        <div className="scr-paper scr-letter">{richText(handout.text ?? '')}</div>
      )}
      {handout.title && <figcaption className="scr-caption">{handout.title}</figcaption>}
    </figure>
  )
}

/**
 * The living background and the handout over it. A new scene fades in over the old one (the old one is
 * removed once covered); a picture is loaded before its scene starts fading in.
 */
export function Stage({ scene, handout }: { scene: ScreenScene | null; handout: ScreenHandout | null }) {
  const reduced = useReducedMotion()
  const [layers, setLayers] = useState<Layer[]>([])
  const seq = useRef(0)
  const key = sceneKey(scene)
  const added = useRef<string | null>(null)

  useEffect(() => {
    // The same background re-sent (refetch, new signature): nothing to redraw.
    if (added.current === key) return
    let cancelled = false
    const url = scene?.image?.url
    void preload(url).then((ok) => {
      if (cancelled) return
      added.current = key
      const id = ++seq.current
      // Keep at most the layer being covered and the new one.
      setLayers((ls) => [...ls.slice(-1), { id, key, scene, url: ok && url ? url : null }])
    })
    return () => {
      cancelled = true
    }
  }, [key, scene])

  // A handout taken off the screen stays mounted for its exit animation.
  const [prev, setPrev] = useState(handout)
  const [leaving, setLeaving] = useState<ScreenHandout | null>(null)
  if (handout !== prev) {
    if (!handout && prev) setLeaving(prev)
    setPrev(handout)
  }
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setLeaving(null), HANDOUT_OUT_MS)
    return () => clearTimeout(timer)
  }, [leaving])
  const shown = handout ? { h: handout, out: false } : leaving ? { h: leaving, out: true } : null

  return (
    <div className="scr-fill" data-scene-key={layers.at(-1)?.key ?? ''}>
      {layers.map((l) => (
        <SceneLayer key={l.id} layer={l} reduced={reduced} onShown={() => setLayers((ls) => ls.filter((x) => x.id >= l.id))} />
      ))}
      {shown && <Handout key={shown.h.key} handout={shown.h} out={shown.out} />}
    </div>
  )
}
