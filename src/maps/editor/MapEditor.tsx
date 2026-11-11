import { Download, Eye, EyeOff, FileJson, Image as ImageIcon, MousePointer2, Printer, Redo2, RotateCw, Shuffle, Square, Trash2, Type, Undo2, Upload, Eraser, Lock, Minus, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import type { Lang } from '@/settings/lang'
import { emptyMap, footprint, MAP_KINDS, MAP_LIMITS, parseMapDoc, type MapDoc, type MapItem, type MapKind } from '../kit/model.ts'
import { randomMap } from '../kit/random.ts'
import { CELL, mapLayout, renderMap, type Audience } from '../kit/render.ts'
import { STAMPS, stampsFor, type Stamp } from '../kit/stamps.ts'
import { downloadBlob, fileSlug, svgToPng } from './exportMap'
import { BRUSHES, MAP_KIND_LABEL } from './labels'

// The map editor: paint the ground, draw rooms, place stamps and words, mark what is secret, and see
// the keeper's or the players' copy. The same component serves the free public page and the app.

type Tool =
  | { k: 'select' }
  | { k: 'room' }
  | { k: 'ground'; c: MapDoc['ground'][number] }
  | { k: 'stamp'; t: string }
  | { k: 'label' }
  | { k: 'secret' }
  | { k: 'erase' }

type Selection = { k: 'item'; i: number } | { k: 'label'; i: number } | null

const stampPreview = (st: Stamp) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${st.size[0] * 100} ${st.size[1] * 100}" width="100%" height="100%" color="#3a2a1a" overflow="visible">${st.body}</svg>`

const half = (n: number) => Math.round(n * 2) / 2

/** The draft kept from a previous visit (none while prerendering: no localStorage in Node). */
function savedDraft(key: string): MapDoc | null {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(key)
    return raw ? parseMapDoc(JSON.parse(raw)).doc : null
  } catch {
    return null
  }
}

/** Resizes a map, keeping what still fits. */
function resized(doc: MapDoc, cols: number, rows: number): MapDoc {
  return parseMapDoc({ ...doc, cols, rows, ground: doc.ground.map((r) => r.padEnd(cols, ' ')), secret: doc.secret }).doc
}

function setCell(doc: MapDoc, x: number, y: number, c: string, field: 'ground' | 'secret' = 'ground'): MapDoc {
  if (x < 0 || y < 0 || x >= doc.cols || y >= doc.rows) return doc
  const rows = field === 'ground' ? doc.ground : (doc.secret ?? Array.from({ length: doc.rows }, () => '.'.repeat(doc.cols)))
  if (rows[y][x] === c) return doc
  const next = rows.slice()
  next[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1)
  if (field === 'ground') return { ...doc, ground: next }
  return next.some((r) => r.includes('x')) ? { ...doc, secret: next } : { ...doc, secret: undefined }
}

/** Walls around a rectangle and floor inside (underground: just floor). */
function drawRoom(doc: MapDoc, x0: number, y0: number, x1: number, y1: number): MapDoc {
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)]
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)]
  let next = doc
  for (let y = ay; y <= by; y++) {
    for (let x = ax; x <= bx; x++) {
      const edge = x === ax || x === bx || y === ay || y === by
      const here = next.ground[y]?.[x]
      if (doc.kind !== 'underground' && edge) {
        if (here !== 'd' && here !== 's' && here !== 'w') next = setCell(next, x, y, '#')
      } else next = setCell(next, x, y, '.')
    }
  }
  return next
}

function hitItem(doc: MapDoc, fx: number, fy: number): number {
  for (let i = doc.items.length - 1; i >= 0; i--) {
    const it = doc.items[i]
    const [w, h] = footprint(it)
    if (fx >= it.x && fx < it.x + w && fy >= it.y && fy < it.y + h) return i
  }
  return -1
}

function hitLabel(doc: MapDoc, fx: number, fy: number): number {
  for (let i = doc.labels.length - 1; i >= 0; i--) {
    const l = doc.labels[i]
    const halfWidth = Math.max(1, (l.text.length * 0.17) / 2 + 0.2)
    if (Math.abs(fx - l.x) <= halfWidth && Math.abs(fy - l.y) <= 0.45) return i
  }
  return -1
}

function ToolButton({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn('flex items-center gap-2 border px-2 py-1.5 text-left text-sm hover:text-gold', active ? 'border-gold/70 bg-gold/10 text-gold' : 'border-border text-muted-foreground')}
    >
      {children}
    </button>
  )
}

export interface MapEditorProps {
  lang: Lang
  /** localStorage key of the draft (kept between visits). */
  storageKey: string
  /** Shown above the map: the app's "describe → map" panel. Gets a setter to load a map. */
  header?: (load: (doc: MapDoc) => void, doc: MapDoc) => ReactNode
}

export function MapEditor({ lang, storageKey, header }: MapEditorProps) {
  const t = useT()
  // The server and the first browser render show the same map; a saved draft replaces it after.
  const [hist, setHist] = useState<{ doc: MapDoc; past: MapDoc[]; future: MapDoc[] }>(() => ({ doc: savedDraft(storageKey) ?? randomMap('building', 7, lang), past: [], future: [] }))
  const { doc, past, future } = hist
  const [tool, setTool] = useState<Tool>({ k: 'room' })
  const [rot, setRot] = useState<0 | 1 | 2 | 3>(0)
  const [labelText, setLabelText] = useState('')
  const [view, setView] = useState<Audience>('keeper')
  const [sel, setSel] = useState<Selection>(null)
  const [hover, setHover] = useState<{ x: number; y: number; fx: number; fy: number } | null>(null)
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [stampFilter, setStampFilter] = useState('')
  // The gesture in progress, kept in a ref: pointer events can come faster than renders.
  const gesture = useRef<{
    before: MapDoc
    secretOn?: boolean
    grab?: { dx: number; dy: number; target: NonNullable<Selection> }
    room?: { x0: number; y0: number; x1: number; y1: number }
    /** Last painted cell: a fast stroke paints every cell in between. */
    last?: { x: number; y: number }
  } | null>(null)
  const overlay = useRef<SVGSVGElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // The draft, saved on every change.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(doc))
    } catch {
      /* private mode */
    }
  }, [doc, storageKey])

  /** A live change (a stroke in progress): no history entry yet. */
  const setDoc = useCallback((u: MapDoc | ((d: MapDoc) => MapDoc)) => setHist((h) => ({ ...h, doc: typeof u === 'function' ? u(h.doc) : u })), [])
  /** Ends a gesture: one history entry from the map before it. */
  const commit = useCallback((before: MapDoc) => setHist((h) => (h.doc === before ? h : { ...h, past: [...h.past.slice(-49), before], future: [] })), [])
  /** A change made in one go (a button): history entry + new map. */
  const change = useCallback((next: MapDoc) => setHist((h) => (next === h.doc ? h : { doc: next, past: [...h.past.slice(-49), h.doc], future: [] })), [])
  const undo = useCallback(() => {
    setHist((h) => (h.past.length ? { doc: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.doc, ...h.future] } : h))
    setSel(null)
  }, [])
  const redo = useCallback(() => {
    setHist((h) => (h.future.length ? { doc: h.future[0], past: [...h.past, h.doc], future: h.future.slice(1) } : h))
    setSel(null)
  }, [])
  const load = useCallback(
    (next: MapDoc) => {
      change(next)
      setSel(null)
    },
    [change],
  )
  const titleBefore = useRef<MapDoc | null>(null)

  const svg = useMemo(() => renderMap(doc, { audience: view, lang }), [doc, view, lang])
  const layout = mapLayout(doc)

  // ---------------------------------------------------------------- pointer
  const point = (e: ReactPointerEvent) => {
    const el = overlay.current
    const m = el?.getScreenCTM()
    if (!el || !m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const fx = (p.x - layout.ox) / CELL
    const fy = (p.y - layout.oy) / CELL
    return { fx, fy, x: Math.floor(fx), y: Math.floor(fy) }
  }

  const paint = (d: MapDoc, x: number, y: number): MapDoc => {
    if (tool.k === 'ground') return setCell(d, x, y, tool.c)
    if (tool.k === 'erase') {
      const items = d.items.filter((it) => {
        const [w, h] = footprint(it)
        return !(x + 0.5 >= it.x && x + 0.5 < it.x + w && y + 0.5 >= it.y && y + 0.5 < it.y + h)
      })
      const labels = d.labels.filter((l) => !(Math.floor(l.x) === x && Math.floor(l.y) === y) && !(Math.abs(l.x - (x + 0.5)) < 1 && Math.abs(l.y - (y + 0.5)) < 0.6))
      return items.length !== d.items.length || labels.length !== d.labels.length ? { ...d, items, labels } : d
    }
    return d
  }

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = point(e)
    if (!p) return
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = { before: doc }
    if (tool.k === 'room' || tool.k === 'secret') {
      // A rectangle: a room, or squares the players don't know (on or off, from the first square).
      if (tool.k === 'secret') gesture.current.secretOn = doc.secret?.[p.y]?.[p.x] !== 'x'
      gesture.current.room = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
      setDrag(gesture.current.room)
      return
    }
    if (tool.k === 'stamp') {
      const st = STAMPS[tool.t]
      if (!st || doc.items.length >= MAP_LIMITS.items) return
      const item: MapItem = { t: tool.t, x: 0, y: 0, ...(rot ? { r: rot } : {}) }
      const [w, h] = footprint(item)
      item.x = Math.max(0, Math.min(doc.cols - w, Math.round(p.fx - w / 2)))
      item.y = Math.max(0, Math.min(doc.rows - h, Math.round(p.fy - h / 2)))
      const next = { ...doc, items: [...doc.items, item] }
      setDoc(next)
      setSel({ k: 'item', i: next.items.length - 1 })
      return
    }
    if (tool.k === 'label') {
      const text = labelText.trim().replace(/[<>&"]/g, '').slice(0, MAP_LIMITS.label)
      if (!text) {
        toast(t('Écris d’abord le texte à placer.'))
        return
      }
      if (doc.labels.length >= MAP_LIMITS.labels) return
      const next = { ...doc, labels: [...doc.labels, { text, x: half(p.fx), y: half(p.fy) }] }
      setDoc(next)
      setSel({ k: 'label', i: next.labels.length - 1 })
      return
    }
    if (tool.k === 'select') {
      const li = hitLabel(doc, p.fx, p.fy)
      const ii = li < 0 ? hitItem(doc, p.fx, p.fy) : -1
      if (li >= 0) {
        const target = { k: 'label' as const, i: li }
        setSel(target)
        gesture.current.grab = { dx: doc.labels[li].x - p.fx, dy: doc.labels[li].y - p.fy, target }
      } else if (ii >= 0) {
        const target = { k: 'item' as const, i: ii }
        setSel(target)
        gesture.current.grab = { dx: doc.items[ii].x - p.fx, dy: doc.items[ii].y - p.fy, target }
      } else setSel(null)
      return
    }
    gesture.current.last = { x: p.x, y: p.y }
    setDoc((d) => paint(d, p.x, p.y))
  }

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = point(e)
    if (!p) return
    setHover(p.x >= 0 && p.y >= 0 && p.x < doc.cols && p.y < doc.rows ? p : null)
    const g = gesture.current
    if (!g) return
    if (g.room) {
      g.room = { ...g.room, x1: Math.max(0, Math.min(doc.cols - 1, p.x)), y1: Math.max(0, Math.min(doc.rows - 1, p.y)) }
      setDrag(g.room)
      return
    }
    if (g.grab) {
      const { dx, dy, target: sel } = g.grab
      setDoc((d) => {
        if (sel.k === 'item') {
          const it = d.items[sel.i]
          if (!it) return d
          const [w, h] = footprint(it)
          const x = Math.max(0, Math.min(d.cols - w, half(p.fx + dx)))
          const y = Math.max(0, Math.min(d.rows - h, half(p.fy + dy)))
          if (x === it.x && y === it.y) return d
          const items = d.items.slice()
          items[sel.i] = { ...it, x, y }
          return { ...d, items }
        }
        const l = d.labels[sel.i]
        if (!l) return d
        const x = Math.max(0, Math.min(d.cols, half(p.fx + dx)))
        const y = Math.max(0, Math.min(d.rows, half(p.fy + dy)))
        if (x === l.x && y === l.y) return d
        const labels = d.labels.slice()
        labels[sel.i] = { ...l, x, y }
        return { ...d, labels }
      })
      return
    }
    if ((tool.k === 'ground' || tool.k === 'erase') && g.last) {
      const from = g.last
      if (from.x === p.x && from.y === p.y) return
      const steps = Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y))
      const cells = Array.from({ length: steps }, (_, i) => ({ x: Math.round(from.x + ((p.x - from.x) * (i + 1)) / steps), y: Math.round(from.y + ((p.y - from.y) * (i + 1)) / steps) }))
      g.last = { x: p.x, y: p.y }
      setDoc((d) => cells.reduce((acc, c) => paint(acc, c.x, c.y), d))
    }
  }

  const onUp = () => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.room) {
      const { x0, y0, x1, y1 } = g.room
      setDrag(null)
      if (tool.k === 'secret') {
        const mark = g.secretOn ? 'x' : '.'
        setDoc((d) => {
          let next = d
          for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) next = setCell(next, x, y, mark, 'secret')
          return next
        })
      } else setDoc((d) => drawRoom(d, x0, y0, x1, y1))
    }
    commit(g.before)
  }

  // ---------------------------------------------------------------- selection edits
  const selItem = sel?.k === 'item' ? doc.items[sel.i] : undefined
  const selLabel = sel?.k === 'label' ? doc.labels[sel.i] : undefined
  const editItem = (patch: Partial<MapItem> | null) => {
    if (sel?.k !== 'item' || !selItem) return
    const items = doc.items.slice()
    if (patch === null) {
      items.splice(sel.i, 1)
      setSel(null)
    } else {
      const next = { ...selItem, ...patch }
      if (next.r === 0) delete next.r
      if (next.s === 1) delete next.s
      if (!next.secret) delete next.secret
      const [w, h] = footprint(next)
      next.x = Math.max(0, Math.min(doc.cols - w, next.x))
      next.y = Math.max(0, Math.min(doc.rows - h, next.y))
      items[sel.i] = next
    }
    change({ ...doc, items })
  }
  const editLabel = (patch: Partial<MapDoc['labels'][number]> | null) => {
    if (sel?.k !== 'label' || !selLabel) return
    const labels = doc.labels.slice()
    if (patch === null) {
      labels.splice(sel.i, 1)
      setSel(null)
    } else {
      const next = { ...selLabel, ...patch }
      if (!next.secret) delete next.secret
      labels[sel.i] = next
    }
    change({ ...doc, labels })
  }

  // Keyboard: undo/redo, rotate, delete, Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'r' || e.key === 'R') {
        if (tool.k === 'stamp') setRot((r) => ((r + 1) % 4) as 0 | 1 | 2 | 3)
        else if (selItem) editItem({ r: (((selItem.r ?? 0) + 1) % 4) as 0 | 1 | 2 | 3 })
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        if (sel.k === 'item') editItem(null)
        else editLabel(null)
      } else if (e.key === 'Escape') {
        setSel(null)
        setTool({ k: 'select' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---------------------------------------------------------------- export
  const name = fileSlug(doc.title, t('plan'))
  const suffix = view === 'players' ? `-${t('joueurs')}` : ''
  const exportSvg = () => downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${name}${suffix}.svg`)
  const exportPng = async () => {
    try {
      downloadBlob(await svgToPng(svg, 2), `${name}${suffix}.png`)
    } catch {
      toast.error(t('L’image n’a pas pu être créée dans ce navigateur. Télécharge le SVG.'))
    }
  }
  const exportJson = () => downloadBlob(new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' }), `${name}.grimoire-map.json`)
  const importJson = async (file: File) => {
    try {
      const { doc: next, problems } = parseMapDoc(JSON.parse(await file.text()))
      load(next)
      if (problems.length) toast(t('Plan ouvert, avec des corrections : {problems}', { problems: problems.join(' · ') }))
    } catch {
      toast.error(t('Ce fichier n’est pas un plan Grimoire.'))
    }
  }

  const hint = (k: Tool['k']) =>
    ({
      select: t('Clique sur un objet ou un texte pour le déplacer, le tourner ou le supprimer.'),
      room: doc.kind === 'underground' ? t('Fais glisser pour creuser une salle.') : t('Fais glisser pour tracer une pièce : les murs se placent tout seuls.'),
      ground: t('Clique ou fais glisser pour peindre le sol. Portes et fenêtres se posent dans un mur.'),
      stamp: t('Clique sur le plan pour poser l’objet. R le tourne.'),
      label: t('Écris le texte à gauche, puis clique sur le plan pour le poser.'),
      secret: t('Encadre les cases que les joueurs ne connaissent pas (encadre-les à nouveau pour les rendre visibles).'),
      erase: t('Clique ou fais glisser pour effacer objets et textes.'),
    })[k]

  const stamps = stampsFor(doc.kind).filter((s) => !stampFilter || s.label[lang].toLowerCase().includes(stampFilter.toLowerCase()))
  const own = stamps.filter((s) => s.kinds.includes(doc.kind))
  const others = stamps.filter((s) => !s.kinds.includes(doc.kind))
  const brushes = BRUSHES.filter((b) => !b.kinds || b.kinds.includes(doc.kind))

  // Overlay shapes: hover cell, ghost stamp, room rectangle, selection.
  const ghost = (() => {
    if (!hover) return null
    if (tool.k === 'stamp' && STAMPS[tool.t]) {
      const item: MapItem = { t: tool.t, x: 0, y: 0, ...(rot ? { r: rot } : {}) }
      const [w, h] = footprint(item)
      const x = Math.max(0, Math.min(doc.cols - w, Math.round(hover.fx - w / 2)))
      const y = Math.max(0, Math.min(doc.rows - h, Math.round(hover.fy - h / 2)))
      return <rect x={layout.ox + x * CELL} y={layout.oy + y * CELL} width={w * CELL} height={h * CELL} fill="#c9a24a" fillOpacity={0.18} stroke="#c9a24a" strokeWidth={2} strokeDasharray="6 4" />
    }
    if (tool.k === 'ground' || tool.k === 'secret' || tool.k === 'erase' || tool.k === 'room') {
      return <rect x={layout.ox + hover.x * CELL} y={layout.oy + hover.y * CELL} width={CELL} height={CELL} fill="none" stroke="#c9a24a" strokeWidth={2} />
    }
    return null
  })()
  const selection = (() => {
    if (selItem) {
      const [w, h] = footprint(selItem)
      return <rect x={layout.ox + selItem.x * CELL - 3} y={layout.oy + selItem.y * CELL - 3} width={w * CELL + 6} height={h * CELL + 6} fill="none" stroke="#c9a24a" strokeWidth={3} />
    }
    if (selLabel) {
      const hw = Math.max(1, (selLabel.text.length * 0.17) / 2 + 0.2)
      return <rect x={layout.ox + (selLabel.x - hw) * CELL} y={layout.oy + (selLabel.y - 0.45) * CELL} width={hw * 2 * CELL} height={0.9 * CELL} fill="none" stroke="#c9a24a" strokeWidth={3} />
    }
    return null
  })()

  return (
    <div className="flex flex-col gap-4" data-testid="map-editor">
      {header?.(load, doc)}

      {/* Map settings */}
      <div className="flex flex-wrap items-end gap-3 border border-border bg-card p-3 print:hidden">
        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="eyebrow">{t('Titre')}</span>
          <Input value={doc.title} maxLength={MAP_LIMITS.title} onFocus={() => (titleBefore.current = doc)}
            onChange={(e) => setDoc({ ...doc, title: e.target.value.replace(/[<>&"]/g, '') })}
            onBlur={() => titleBefore.current && commit(titleBefore.current)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">{t('Type de lieu')}</span>
          <NativeSelect value={doc.kind} onChange={(e) => change({ ...doc, kind: e.target.value as MapKind })} aria-label={t('Type de lieu')}>
            {MAP_KINDS.map((k) => (
              <NativeSelectOption key={k} value={k}>{t(MAP_KIND_LABEL[k])}</NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">{t('Largeur')}</span>
          <Input type="number" className="w-20" min={MAP_LIMITS.minCols} max={MAP_LIMITS.maxCols} value={doc.cols} onChange={(e) => change(resized(doc, Number(e.target.value) || doc.cols, doc.rows))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">{t('Hauteur')}</span>
          <Input type="number" className="w-20" min={MAP_LIMITS.minRows} max={MAP_LIMITS.maxRows} value={doc.rows} onChange={(e) => change(resized(doc, doc.cols, Number(e.target.value) || doc.rows))} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => load(randomMap(doc.kind, Math.floor(Math.random() * 1e9), lang))}>
            <Shuffle /> {t('Plan au hasard')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => load(emptyMap(doc.kind, doc.cols, doc.rows, doc.title))}>
            {t('Page blanche')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        {/* Tools */}
        <aside className="flex flex-col gap-4 print:hidden" aria-label={t('Outils')}>
          <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2">
            <ToolButton active={tool.k === 'select'} onClick={() => setTool({ k: 'select' })}><MousePointer2 className="size-4" /> {t('Choisir')}</ToolButton>
            <ToolButton active={tool.k === 'room'} onClick={() => setTool({ k: 'room' })}><Square className="size-4" /> {doc.kind === 'underground' ? t('Salle') : t('Pièce')}</ToolButton>
            <ToolButton active={tool.k === 'label'} onClick={() => setTool({ k: 'label' })}><Type className="size-4" /> {t('Texte')}</ToolButton>
            <ToolButton active={tool.k === 'secret'} onClick={() => setTool({ k: 'secret' })}><Lock className="size-4" /> {t('Secret')}</ToolButton>
            <ToolButton active={tool.k === 'erase'} onClick={() => setTool({ k: 'erase' })}><Eraser className="size-4" /> {t('Gomme')}</ToolButton>
          </div>
          {tool.k === 'label' && (
            <Input placeholder={t('Texte à placer')} value={labelText} maxLength={MAP_LIMITS.label} onChange={(e) => setLabelText(e.target.value)} aria-label={t('Texte à placer')} />
          )}

          <section className="flex flex-col gap-1.5">
            <h3 className="eyebrow">{t('Sol')}</h3>
            <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2" role="group" aria-label={t('Sol')}>
              {brushes.map((b) => (
                <ToolButton key={b.label} active={tool.k === 'ground' && tool.c === b.c} onClick={() => setTool({ k: 'ground', c: b.c })}>
                  <span className="size-4 shrink-0 border border-border" style={{ background: b.swatch }} aria-hidden="true" /> {t(b.label)}
                </ToolButton>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="eyebrow">{t('Objets')}</h3>
              {tool.k === 'stamp' && (
                <Button variant="ghost" size="xs" onClick={() => setRot((r) => ((r + 1) % 4) as 0 | 1 | 2 | 3)} title={t('Tourner (R)')}>
                  <RotateCw /> {rot * 90}°
                </Button>
              )}
            </div>
            <Input placeholder={t('Chercher un objet')} value={stampFilter} onChange={(e) => setStampFilter(e.target.value)} aria-label={t('Chercher un objet')} />
            <div className="grid max-h-[26rem] grid-cols-6 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-8 lg:grid-cols-3" role="group" aria-label={t('Objets')}>
              {[...own, ...others].map((st, i) => (
                <button
                  key={st.id}
                  type="button"
                  title={st.label[lang]}
                  aria-label={st.label[lang]}
                  aria-pressed={tool.k === 'stamp' && tool.t === st.id}
                  onClick={() => setTool({ k: 'stamp', t: st.id })}
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center gap-1 border bg-[#efe2c2] p-1.5 hover:border-gold/70',
                    tool.k === 'stamp' && tool.t === st.id ? 'border-gold ring-1 ring-gold' : 'border-border',
                    i === own.length && 'col-start-1',
                  )}
                >
                  <span className="block size-full" dangerouslySetInnerHTML={{ __html: stampPreview(st) }} />
                </button>
              ))}
            </div>
          </section>
        </aside>

        {/* The map (first on a phone, the tools under it) */}
        <div className="order-first flex min-w-0 flex-col gap-3 lg:order-none">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={undo} disabled={!past.length} title={t('Annuler (Ctrl+Z)')}><Undo2 /> {t('Annuler')}</Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={!future.length} title={t('Rétablir')}><Redo2 /> {t('Rétablir')}</Button>
            <span className="flex-1" />
            <div className="flex border border-border" role="group" aria-label={t('Version')}>
              <button type="button" aria-pressed={view === 'keeper'} onClick={() => setView('keeper')} className={cn('flex items-center gap-1.5 px-3 py-1 text-sm', view === 'keeper' ? 'bg-gold/15 text-gold' : 'text-muted-foreground')}>
                <Eye className="size-4" /> {t('Gardien')}
              </button>
              <button type="button" aria-pressed={view === 'players'} onClick={() => setView('players')} className={cn('flex items-center gap-1.5 px-3 py-1 text-sm', view === 'players' ? 'bg-gold/15 text-gold' : 'text-muted-foreground')}>
                <EyeOff className="size-4" /> {t('Joueurs')}
              </button>
            </div>
          </div>

          {/* Selection */}
          <div className={cn('flex min-h-11 flex-wrap items-center gap-2 border bg-card px-3 py-1.5 text-sm print:hidden', selItem || selLabel ? 'border-gold/50' : 'border-border')} data-testid="map-selection">
              {!selItem && !selLabel && <span className="text-muted-foreground">{hint(tool.k)}</span>}
              {selItem && (
                <>
                  <span className="font-heading text-base">{STAMPS[selItem.t]?.label[lang]}</span>
                  <Button variant="ghost" size="xs" onClick={() => editItem({ r: (((selItem.r ?? 0) + 1) % 4) as 0 | 1 | 2 | 3 })}><RotateCw /> {t('Tourner')}</Button>
                  <Button variant="ghost" size="xs" onClick={() => editItem({ s: Math.max(0.5, (selItem.s ?? 1) - 0.5) })} aria-label={t('Plus petit')}><Minus /></Button>
                  <span className="font-mono">×{selItem.s ?? 1}</span>
                  <Button variant="ghost" size="xs" onClick={() => editItem({ s: Math.min(MAP_LIMITS.maxScale, (selItem.s ?? 1) + 0.5) })} aria-label={t('Plus grand')}><Plus /></Button>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!selItem.secret} onChange={(e) => editItem({ secret: e.target.checked })} /> {t('Secret')}</label>
                  <Button variant="ghost" size="xs" onClick={() => editItem(null)}><Trash2 /> {t('Supprimer')}</Button>
                </>
              )}
              {selLabel && (
                <>
                  <Input className="h-7 w-56" value={selLabel.text} maxLength={MAP_LIMITS.label} onChange={(e) => editLabel({ text: e.target.value.replace(/[<>&"]/g, '') })} aria-label={t('Texte')} />
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!selLabel.secret} onChange={(e) => editLabel({ secret: e.target.checked })} /> {t('Secret')}</label>
                  <Button variant="ghost" size="xs" onClick={() => editLabel(null)}><Trash2 /> {t('Supprimer')}</Button>
                </>
              )}
          </div>

          {/* Printing keeps the drawing alone (src/tools/print.css). */}
          <div className="relative overflow-hidden border border-border select-none print:border-0 [&>div>svg]:block [&>div>svg]:h-auto [&>div>svg]:w-full">
            <div className="map-print" dangerouslySetInnerHTML={{ __html: svg }} data-testid="map-drawing" />
            <svg
              ref={overlay}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className={cn('absolute inset-0 size-full touch-none print:hidden', tool.k === 'select' ? 'cursor-default' : 'cursor-crosshair')}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerLeave={() => setHover(null)}
              data-testid="map-canvas"
              role="application"
              aria-label={t('Plan à dessiner')}
            >
              {drag && (
                <rect
                  x={layout.ox + Math.min(drag.x0, drag.x1) * CELL}
                  y={layout.oy + Math.min(drag.y0, drag.y1) * CELL}
                  width={(Math.abs(drag.x1 - drag.x0) + 1) * CELL}
                  height={(Math.abs(drag.y1 - drag.y0) + 1) * CELL}
                  fill="#c9a24a"
                  fillOpacity={0.15}
                  stroke="#c9a24a"
                  strokeWidth={3}
                  strokeDasharray="8 5"
                />
              )}
              {ghost}
              {selection}
            </svg>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button size="sm" onClick={exportPng}><ImageIcon /> {t('Image (PNG)')}</Button>
            <Button variant="outline" size="sm" onClick={exportSvg}><Download /> {t('Dessin (SVG)')}</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> {t('Imprimer')}</Button>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={exportJson}><FileJson /> {t('Enregistrer le plan')}</Button>
            <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}><Upload /> {t('Ouvrir un plan')}</Button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importJson(file)
                e.target.value = ''
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground print:hidden">
            {view === 'keeper'
              ? t('Version du gardien : les éléments secrets sont en rouge. Passe en version « Joueurs » pour le plan à leur montrer.')
              : t('Version des joueurs : sans rien de secret. C’est celle-ci qu’on télécharge pour la leur montrer.')}
          </p>
        </div>
      </div>
    </div>
  )
}
