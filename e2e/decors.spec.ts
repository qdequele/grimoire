// The drawn décors (src/screen/Places.tsx) checked for mismatched joins between shapes, place by
// place, from the dev gallery (/dev/places). Two rules, measured on the SVG geometry itself:
//
// 1. A light sits on a shape of its own depth. The layers drift at different speeds (parallax): a
//    lamp's glass drawn in the mid lit layer over a post in the near layer slides off the post.
//    Every light (lit-far / lit / lit-near / pulse layers) must touch a silhouette of the layer that
//    drifts with it, or another light that does (a flame on its candle on its stand).
// 2. Nothing floats. Every solid piece of a silhouette layer touches another shape of its layer or of
//    the layer behind it (a spar on its mast, a chimney in its roof, a stone in the ground).
// 3. No light edge runs along a shape that drifts differently. A moonlight shaft drawn from a window
//    (back layer) but drifting with the mid layer slides past the window's frame: the window looks
//    wider than its arch. Any light with a hard edge (all but round, fading halos) fails when, where it
//    shows, its outline runs along an upright or sloped edge of a shape in a differently drifting layer
//    for more than EDGE units, or shares a corner with one. (The drift is sideways: a shared horizontal
//    edge stays lined up.)
// 5. Feet on the ground. A shape marked `data-ground` (buildings, grass) rests its lowest edge on a
//    shape of its own layer or of the layer in front (the ground covering its foot), or on the frame's
//    bottom: never on the scenery behind. A police station stopped 10 units above the curb, the city
//    showing under it; grass planted on a straight line over a wavy ridge stood on air.
//
// Measured in screen space (a 1600×900 viewport), in three states: the layers at rest, and at the start
// and end of their drift (their slide and the near layers' zoom). Rules 1, 2 and 5 run in all three
// (measured at rest only, the check missed a near ground pushed 9 units down by the zoom). Rules 3 and
// 4 run at rest: they are about what was drawn to line up, not about edges crossing for a moment as
// the layers slide past each other.
//
// 4. No accidental holes. A path holding several shapes fills their overlaps only when they wind the
//    same way: under the default nonzero rule, a desk top drawn anticlockwise over its clockwise body
//    leaves the band where they overlap empty, and the books behind show through. (Paths with
//    fill-rule evenodd cut their holes on purpose: skipped.)
//
// "Touches" = within TOUCH user units (the 1600×900 frame). Pieces meant to hang in the sky (the moon
// and sun, stars, birds) carry `data-free`. Round halos fade to nothing, they have no edge: skipped.
// Glows with a hard edge (shafts, rays, beams) are checked by rule 3 only.
import { expect, test } from '@playwright/test'

const PLACES = ['church', 'graveyard', 'crypt', 'castle', 'manor', 'library', 'police', 'forest', 'harbour', 'street']
const TOUCH = 3
// A shared edge shorter than this is a coincidence nobody sees (a faint shaft parallel to a far fir for a few units).
const EDGE = 96

interface Problem { layer: string; piece: string; rule: 'light' | 'floating' | 'edge' | 'hole' | 'ground' }

for (const place of PLACES) {
  test(`décor ${place}: lights on their own depth, nothing floating, no edge across depths, no holes, feet on the ground`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto(`/dev/places?place=${place}&time=night`)
    await page.locator('.scr-place svg.scr-par').first().waitFor()
    const all: Problem[] = []
    for (const state of ['rest', 'drift start', 'drift end'] as const) {
    // At rest: no drift at all. At a drift end: loops paused there. One-off animations (the fade-in) finished.
    await page.evaluate((st) => {
      document.getElementById('decor-rest')?.remove()
      if (st === 'rest') {
        const style = document.createElement('style')
        style.id = 'decor-rest'
        style.textContent = '.scr-par { animation: none !important; }'
        document.head.append(style)
      }
      for (const a of document.getAnimations()) {
        const timing = a.effect!.getTiming()
        if (timing.iterations !== Infinity) a.finish()
        else {
          a.pause()
          if (((a as CSSAnimation).animationName ?? '').startsWith('scr-par')) a.currentTime = st === 'drift end' ? Number(timing.duration) - 1 : 0
        }
      }
    }, state)
    const problems: Problem[] = await page.evaluate(([touch, edge, atRest]) => {
      const depthOf = (svg: SVGSVGElement) => [...svg.classList].find((c) => c.startsWith('scr-par-'))!.slice(8)
      const layers = [...document.querySelectorAll<SVGSVGElement>('.scr-place svg.scr-par')]
      const harbour = document.querySelector('.scr-place')?.getAttribute('data-place') === 'harbour'
      // Which silhouette layer a light layer drifts with (screen.css: same keyframes). Keep in step with screen.css.
      const motion: Record<string, string> = { far: 'far', mid: 'mid', 'mid-front': 'mid', near: 'near', lit: 'mid', 'lit-far': 'far', 'lit-near': 'near', pulse: harbour ? 'far' : 'near', 'pulse-mid': 'mid', water: 'water' }
      const order = ['far', 'mid', 'near']
      // A silhouette layer's rank, back to front (`mid-front` drifts with mid, drawn after its lights).
      const rank = (layer: string) => order.indexOf(motion[layer] ?? layer)
      const isLight = (d: string) => d.startsWith('lit') || d.startsWith('pulse')

      type Piece = { el: SVGGeometryElement; local: SVGGeometryElement; layer: string; label: string; box: DOMRect; ctm: DOMMatrix; glow?: boolean; outline?: boolean }
      const halo = /halo|moon|sun/
      const glow = /beam|ray|shaft|sheen/
      const pieces: Piece[] = []
      // Every outline, fills and strokes alike (a transom drawn as a stroke is an edge too), for rule 3.
      const outlines: Piece[] = []
      for (const svg of layers) {
        const layer = depthOf(svg)
        if (layer === 'water') continue
        for (const el of svg.querySelectorAll<SVGGeometryElement>('path, circle, ellipse, rect, polygon')) {
          // The moon and sun discs float; a moonlight shaft in their group is checked like any light.
          if (el.closest('[data-free]') || (el.closest('.scr-moon, .scr-sun') && !glow.test(el.getAttribute('fill') ?? ''))) continue
          const fill = el.getAttribute('fill') ?? ''
          if (halo.test(fill)) continue
          const cs = getComputedStyle(el)
          if (cs.display === 'none') continue
          const stroked = fill === 'none' || cs.fill === 'none'
          const glowing = glow.test(fill)
          // Each subpath of a path is a piece of its own (a path often holds many windows or stones).
          const subs = el.tagName === 'path' ? (el.getAttribute('d') ?? '').split(/(?=M)/).map((s) => s.trim()).filter(Boolean) : [null]
          // The element's user space → the screen, with the layer's drift (CSS transform) included.
          const ctm = el.getScreenCTM()!
          subs.forEach((d, k) => {
            let local = el
            if (d !== null && subs.length > 1) {
              local = document.createElementNS('http://www.w3.org/2000/svg', 'path') as SVGPathElement
              local.setAttribute('d', d)
              local.setAttribute('fill-rule', el.getAttribute('fill-rule') ?? 'nonzero')
              el.parentNode!.insertBefore(local, el)
            }
            const b = local.getBBox()
            if (b.width + b.height < 2) return
            const p1 = new DOMPoint(b.x, b.y).matrixTransform(ctm)
            const p2 = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(ctm)
            const box = new DOMRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y))
            // Off the frame entirely (drawn wider than the screen): nothing to see.
            if (box.right < -60 || box.left > 1660 || box.bottom < -20 || box.top > 920) return
            const piece: Piece = { el, local, layer, label: `${el.tagName}${d ? ` "${d.slice(0, 48)}"` : ''}${subs.length > 1 ? ` (#${k})` : ''}`, box, ctm, glow: glowing, outline: stroked }
            outlines.push(piece)
            if (!stroked && !glowing) pieces.push(piece)
          })
        }
      }
      // Is a frame point inside piece q's fill?
      const inside = (q: Piece, x: number, y: number) => {
        const p = new DOMPoint(x, y).matrixTransform(q.ctm.inverse())
        return q.local.isPointInFill(p)
      }
      // Points on a piece's own shape: a grid over its box, finer for small pieces (a grass blade, a spar).
      const samples = new Map<Piece, Array<[number, number]>>()
      const pointsOf = (a: Piece) => {
        let pts = samples.get(a)
        if (pts) return pts
        pts = []
        const A = a.box
        const nx = Math.min(24, Math.max(4, Math.ceil(A.width / 2)))
        const ny = Math.min(24, Math.max(4, Math.ceil(A.height / 2)))
        for (let i = 0; i <= nx; i++) {
          for (let j = 0; j <= ny; j++) {
            const x = A.left + (A.width * i) / nx
            const y = A.top + (A.height * j) / ny
            if (inside(a, x, y)) pts.push([x, y])
          }
        }
        samples.set(a, pts)
        return pts
      }
      const nudges: Array<[number, number]> = [[0, 0]]
      for (let k = 0; k < 8; k++) nudges.push([Math.round(Math.cos((k * Math.PI) / 4) * touch), Math.round(Math.sin((k * Math.PI) / 4) * touch)])
      // Does piece a touch piece b? Some point of a, moved by up to `touch`, inside b's fill.
      const touches = (a: Piece, b: Piece) => {
        const g = touch
        const A = a.box
        if (A.right + g < b.box.left || b.box.right < A.left - g || A.bottom + g < b.box.top || b.box.bottom < A.top - g) return false
        for (const [x, y] of pointsOf(a)) {
          if (x < b.box.left - g || x > b.box.right + g || y < b.box.top - g || y > b.box.bottom + g) continue
          for (const [dx, dy] of nudges) if (inside(b, x + dx, y + dy)) return true
        }
        return false
      }

      const out: Array<{ layer: string; piece: string; rule: 'light' | 'floating' | 'edge' | 'hole' | 'ground' }> = []
      // Rule 1: lights, propagated (a light touching a held light is held too).
      const lights = pieces.filter((p) => isLight(p.layer))
      const held = new Set<Piece>()
      let grew = true
      while (grew) {
        grew = false
        for (const l of lights) {
          if (held.has(l)) continue
          const ok = pieces.some((p) => (!isLight(p.layer) && motion[p.layer] === motion[l.layer] && touches(l, p)) || (held.has(p) && p.layer === l.layer && touches(l, p)))
          if (ok) {
            held.add(l)
            grew = true
          }
        }
      }
      for (const l of lights) if (!held.has(l)) out.push({ layer: l.layer, piece: l.label, rule: 'light' })
      // Rule 2: silhouettes. The frame's bottom edge is the ground for the farthest things.
      for (const p of pieces) {
        if (isLight(p.layer)) continue
        if (p.box.bottom >= 896 || p.box.top <= 2 || p.box.left <= 2 || p.box.right >= 1598) continue
        const lvl = rank(p.layer)
        // Held by a shape of its layer or the one behind, or resting on a light that drifts with it (a lamp's cap on its glass).
        const ok = pieces.some((q) => q !== p && (isLight(q.layer) ? held.has(q) && motion[q.layer] === motion[p.layer] : rank(q.layer) <= lvl && rank(q.layer) >= lvl - 1) && touches(p, q))
        if (!ok) out.push({ layer: p.layer, piece: p.label, rule: 'floating' })
      }
      // Rule 3 (at rest): a light's hard edge must not line up with a shape that drifts differently. The drift is
      // sideways, so a shared horizontal edge stays lined up; what breaks is a shared upright or sloped
      // edge (a shaft's side down a window's jamb) or a shared corner (a spill's corner on a sill's).
      const width = (q: Piece) => (q.outline ? parseFloat(getComputedStyle(q.el).strokeWidth) || 1 : 0) + 2 * touch
      // An outline as frame points every ~2 units, with the corners (turns sharper than 30°) marked.
      const trace = (a: Piece) => {
        const len = a.local.getTotalLength()
        const n = Math.max(2, Math.ceil(len / 2))
        const pts = Array.from({ length: n + 1 }, (_, i) => a.local.getPointAtLength((len * i) / n).matrixTransform(a.ctm))
        const corners: DOMPoint[] = []
        for (let i = 1; i < n; i++) {
          const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)
          const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x)
          let turn = Math.abs(a2 - a1)
          if (turn > Math.PI) turn = 2 * Math.PI - turn
          if (turn > Math.PI / 6) corners.push(pts[i])
        }
        return { pts, corners, step: len / n }
      }
      const traces = new Map<Piece, ReturnType<typeof trace>>()
      const traced = (a: Piece) => traces.get(a) ?? traces.set(a, trace(a)).get(a)!
      const visible = (l: Piece, p: DOMPoint) => {
        // Off the frame (not on screen), or hidden: inside a shape that drifts with the light or is in front of it.
        if (p.y >= 897 || p.y <= 3 || p.x <= 3 || p.x >= 1597) return false
        const lvl = rank(l.layer)
        return !pieces.some((c) => !isLight(c.layer) && rank(c.layer) >= lvl && [[0, 0], [touch, 0], [-touch, 0], [0, touch], [0, -touch]].every(([dx, dy]) => inside(c, p.x + dx, p.y + dy)))
      }
      for (const l of atRest ? outlines : []) {
        if (!isLight(l.layer) || l.outline) continue
        const lt = traced(l)
        if (lt.pts.length < 3) continue
        const shown = lt.pts.map((p) => visible(l, p))
        for (const q of outlines) {
          if (isLight(q.layer) || q.layer === 'water' || motion[q.layer] === motion[l.layer]) continue
          if (l.box.right < q.box.left - touch || q.box.right < l.box.left - touch || l.box.bottom < q.box.top - touch || q.box.bottom < l.box.top - touch) continue
          const w = q.local.style.strokeWidth
          q.local.style.strokeWidth = `${width(q)}px`
          let run = 0
          let best = 0
          for (let i = 1; i < lt.pts.length; i++) {
            const p = lt.pts[i]
            const dx = Math.abs(p.x - lt.pts[i - 1].x)
            const dy = Math.abs(p.y - lt.pts[i - 1].y)
            const along = shown[i] && dy > 0.3 * dx && q.local.isPointInStroke(p.matrixTransform(q.ctm.inverse()))
            run = along ? run + lt.step : 0
            best = Math.max(best, run)
          }
          q.local.style.strokeWidth = w
          // Corners of tiny shapes (a grass blade) are coincidences too.
          const qc = q.box.width > 12 && q.box.height > 12 ? traced(q).corners : []
          const shared = lt.corners.filter((c) => visible(l, c) && qc.some((k) => Math.hypot(k.x - c.x, k.y - c.y) <= touch))
          if (best > edge || shared.length > 0) {
            const why = best > edge ? `runs ${Math.round(best)} units along` : `shares the corner (${Math.round(shared[0].x)}, ${Math.round(shared[0].y)}) of`
            out.push({ layer: l.layer, piece: `${l.label} ${why} ${q.layer}: ${q.label}`, rule: 'edge' })
            break
          }
        }
      }
      // Rule 4 (at rest): a point inside one shape of a path must be filled by the whole path.
      for (const p of atRest ? outlines : []) {
        if (p.local === p.el || p.outline || (p.el.getAttribute('fill-rule') ?? getComputedStyle(p.el).fillRule) === 'evenodd') continue
        const wholeCtm = p.ctm
        const holes = pointsOf(p).filter(([x, y]) => !p.el.isPointInFill(new DOMPoint(x, y).matrixTransform(wholeCtm.inverse())))
        if (holes.length > 0) out.push({ layer: p.layer, piece: `${p.label}: unfilled at (${Math.round(holes[0][0])}, ${Math.round(holes[0][1])}), a shape overlapping it winds the other way`, rule: 'hole' })
      }
      // Rule 5: grounded shapes rest their foot on something in their own layer or the one in front (the
      // ground covering a wall's foot), never on the scenery behind. `data-ground="each"`: every piece
      // (grass blades, which can't stand on each other); otherwise the group's lowest pieces (a wall, not
      // the roof resting on it).
      const groupOf = (q: Piece) => q.el.closest('[data-ground]')
      const bottoms = new Map<Element, number>()
      for (const q of pieces) {
        const g = groupOf(q)
        if (g) bottoms.set(g, Math.max(bottoms.get(g) ?? -Infinity, q.box.bottom))
      }
      for (const p of pieces) {
        const g = groupOf(p)
        if (!g) continue
        if (g.getAttribute('data-ground') !== 'each' && p.box.bottom < bottoms.get(g)! - 4) continue
        const feet = pointsOf(p).filter(([, y]) => y >= p.box.bottom - 2)
        const lvl = rank(p.layer)
        const loose = feet.filter(([x, y]) => y + touch < 898 && !pieces.some((q) => groupOf(q) !== g && !isLight(q.layer) && rank(q.layer) >= lvl && rank(q.layer) <= lvl + 1 && inside(q, x, y + touch)))
        if (loose.length > 0) out.push({ layer: p.layer, piece: `${p.label}: its foot at (${Math.round(loose[0][0])}, ${Math.round(loose[0][1])}) stands on nothing`, rule: 'ground' })
      }
      for (const p of outlines) if (p.local !== p.el) p.local.remove()
      return out
    }, [TOUCH, EDGE, state === 'rest'] as const)
    for (const p of problems) {
      if (!all.some((q) => q.piece.startsWith(p.piece) && q.rule === p.rule)) all.push({ ...p, piece: `${p.piece} [${state}]` })
    }
    }
    expect(all, all.map((p) => `${p.rule} in ${p.layer}: ${p.piece}`).join('\n')).toEqual([])
  })
}
