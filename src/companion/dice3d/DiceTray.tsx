import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { TrayDie } from './dice'
import { dieFaces, faceFor, faceLight, faceTransform, labelSlots, throwKeyframes, type Face } from './geometry'

/** How long one die tumbles; dice after the first start a little later. */
const THROW_MS = 1150
const STAGGER_MS = 55
const delayOf = (i: number) => (i % 6) * STAGGER_MS

const QUERY = '(prefers-reduced-motion: reduce)'
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(QUERY).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const m = matchMedia(QUERY)
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Cell size: big for one die, smaller as the tray fills (up to 20 d10s for 10D100). */
const cellSize = (n: number) => (n <= 1 ? 88 : n <= 2 ? 80 : n <= 3 ? 70 : n <= 6 ? 56 : 44)

const SHAKE: Keyframe[] = [
  { transform: 'translate(0,0) rotate(0deg)' },
  { transform: 'translate(-3px,1px) rotate(-7deg)' },
  { transform: 'translate(2px,-2px) rotate(6deg)' },
  { transform: 'translate(-1px,2px) rotate(-3deg)' },
  { transform: 'translate(0,0) rotate(0deg)' },
]

/** One face: the outline, a thin inner rule, the label, and its shade for the light. */
function FaceView({ face, half, label, shade }: { face: Face; half: number; label: string; shade: number }) {
  const r = face.outradius * half
  const outline = face.points.map(([x, y]) => `${x * half * 1.015},${y * half * 1.015}`).join(' ')
  const inner = face.points.map(([x, y]) => `${x * half * 0.8},${y * half * 0.8}`).join(' ')
  const fontSize = face.inradius * half * (label.length > 1 ? 0.95 : 1.25)
  const mark = label === '6' || label === '9'
  return (
    <svg
      width={2 * r}
      height={2 * r}
      viewBox={`${-r} ${-r} ${2 * r} ${2 * r}`}
      style={{ position: 'absolute', overflow: 'visible', left: -r, top: -r, transform: faceTransform(face, half), backfaceVisibility: 'hidden' }}
    >
      <polygon points={outline} fill="var(--slab2)" stroke="var(--gold)" strokeWidth={Math.max(1, half / 30)} strokeLinejoin="round" />
      <polygon points={inner} fill="none" stroke="var(--gold)" strokeOpacity={0.3} strokeWidth={0.75} strokeLinejoin="round" />
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fill="var(--gold)" style={{ fontFamily: 'var(--f-disp)' }}>
        {label}
      </text>
      {mark && <line x1={-fontSize * 0.22} x2={fontSize * 0.22} y1={fontSize * 0.58} y2={fontSize * 0.58} stroke="var(--gold)" strokeWidth={Math.max(1, fontSize / 12)} />}
      <polygon points={outline} fill="#000" fillOpacity={shade} />
    </svg>
  )
}

function Die({ die, size, throwKey, delay, settled, reduced }: {
  die: TrayDie
  size: number
  throwKey: string | null
  delay: number
  settled: boolean
  reduced: boolean
}) {
  const faces = dieFaces(die.shape)
  const slots = useMemo(() => labelSlots(faces), [faces])
  const half = size / 2
  const dieRef = useRef<HTMLDivElement>(null)
  const shakeRef = useRef<HTMLDivElement>(null)
  /** The throw already played (never replay one when the parent re-renders). */
  const thrown = useRef<string | null>(null)
  /** The face it rests (or lands) on: the light depends on it. */
  const [shown, setShown] = useState(() => Math.floor(Math.random() * faces.length))

  useLayoutEffect(() => {
    const el = dieRef.current
    if (!el) return
    if (die.value === null) {
      // Waiting for the server: rattle in place.
      if (!el.style.transform) el.style.transform = throwKeyframes(faces[shown], size, Math.random).rest
      if (reduced) return
      const shake = shakeRef.current?.animate(SHAKE, { duration: 280, iterations: Infinity })
      return () => shake?.cancel()
    }
    const face = faceFor(slots, die.labels, die.value, Math.random)
    setShown(face)
    const { rest, keyframes } = throwKeyframes(faces[face], size, Math.random)
    el.style.transform = rest
    if (throwKey === null || throwKey === thrown.current || reduced) return
    const before = thrown.current
    thrown.current = throwKey
    const anim = el.animate(keyframes, { duration: THROW_MS, delay, easing: 'linear', fill: 'backwards' })
    return () => {
      if (anim.playState === 'finished') return
      anim.cancel()
      thrown.current = before
    }
    // Only a new value or a new throw moves the die.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [die.value, die.shape, throwKey, size, reduced])

  return (
    <div
      style={{
        position: 'relative', width: size, height: size, perspective: size * 8,
        transition: 'opacity 0.5s', opacity: die.dim && settled ? 0.3 : 1,
      }}
    >
      <div ref={shakeRef} style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
        <div ref={dieRef} style={{ position: 'absolute', top: '50%', left: '50%', transformStyle: 'preserve-3d' }}>
          {faces.map((f, i) => (
            <FaceView key={i} face={f} half={half} label={die.labels[slots[i]]} shade={0.62 * (1 - faceLight(f, faces[shown]))} />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * The dice of a roll, in 3D (CSS transforms, no WebGL). While `value`s are null the dice rattle; when
 * they come with a new `throwKey` (the roll's id) the dice are thrown and land on them, then
 * `onSettled(throwKey)` fires so the result can show. Decorative: the result is told in text elsewhere.
 * Inline styles only: it also runs inside the game screen's iframe, which has no Tailwind.
 */
export function DiceTray({ dice, throwKey, onSettled, maxSize = Infinity, style }: {
  dice: TrayDie[]
  throwKey: string | null
  onSettled: (key: string) => void
  /** Largest die cell, px (the size otherwise depends on how many dice there are). */
  maxSize?: number
  style?: CSSProperties
}) {
  const reduced = useReducedMotion()
  const size = Math.min(cellSize(dice.length), maxSize)
  const [settled, setSettled] = useState<string | null>(null)
  const waiting = dice.some((d) => d.value === null)
  const settledRef = useRef(onSettled)
  useEffect(() => { settledRef.current = onSettled })

  useEffect(() => {
    if (throwKey === null || waiting) return
    const done = () => { setSettled(throwKey); settledRef.current(throwKey) }
    if (reduced) { done(); return }
    const id = setTimeout(done, THROW_MS + delayOf(Math.min(dice.length, 6) - 1) + 60)
    return () => clearTimeout(id)
  }, [throwKey, waiting, reduced, dice.length])

  return (
    <div
      aria-hidden="true"
      data-testid="dice-tray"
      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '4px 8px', padding: '8px 0', ...style }}
    >
      {dice.map((d, i) => (
        // A new shape in a slot (a D20, then a D6) is a new die.
        <Die key={`${i}:${d.shape}`} die={d} size={size} throwKey={throwKey} delay={delayOf(i)} settled={!waiting && (settled === throwKey || throwKey === null)} reduced={reduced} />
      ))}
    </div>
  )
}
