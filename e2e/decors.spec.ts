// The drawn décors (src/screen/Places.tsx) checked for mismatched joins between shapes, place by
// place, from the dev gallery (/dev/places). Two rules, measured on the SVG geometry itself:
//
// 1. A light sits on a shape of its own depth. The layers drift at different speeds (parallax): a
//    lamp's glass drawn in the mid lit layer over a post in the near layer slides off the post.
//    Every light (lit-far / lit / lit-near / pulse layers) must touch a silhouette of the layer that
//    drifts with it, or another light that does (a flame on its candle on its stand).
// 2. Nothing floats. Every solid piece of a silhouette layer touches another shape of its layer or of
//    the layer behind it (a spar on its mast, a chimney in its roof, a stone in the ground).
//
// "Touches" = within TOUCH user units (the 1600×900 frame). Pieces meant to hang in the sky (the moon
// and sun, stars, birds) carry `data-free`; glows (halos, beams, reflections, gradients) are skipped.
import { expect, test } from '@playwright/test'

const PLACES = ['church', 'graveyard', 'crypt', 'castle', 'manor', 'library', 'police', 'forest', 'harbour', 'street']
const TOUCH = 3

interface Problem { layer: string; piece: string; rule: 'light' | 'floating' }

for (const place of PLACES) {
  test(`décor ${place}: lights on their own depth, nothing floating`, async ({ page }) => {
    await page.goto(`/dev/places?place=${place}&time=night`)
    await page.locator('.scr-place svg.scr-par').first().waitFor()
    const problems: Problem[] = await page.evaluate((touch) => {
      const depthOf = (svg: SVGSVGElement) => [...svg.classList].find((c) => c.startsWith('scr-par-'))!.slice(8)
      const layers = [...document.querySelectorAll<SVGSVGElement>('.scr-place svg.scr-par')]
      const harbour = document.querySelector('.scr-place')?.getAttribute('data-place') === 'harbour'
      // Which silhouette layer a light layer drifts with (screen.css: same keyframes). Keep in step with screen.css.
      const motion: Record<string, string> = { far: 'far', mid: 'mid', near: 'near', lit: 'mid', 'lit-far': 'far', 'lit-near': 'near', pulse: harbour ? 'far' : 'near', 'pulse-mid': 'mid', water: 'water' }
      const order = ['far', 'mid', 'near']
      const isLight = (d: string) => d.startsWith('lit') || d.startsWith('pulse')

      type Piece = { el: SVGGeometryElement; local: SVGGeometryElement; layer: string; label: string; box: DOMRect; ctm: DOMMatrix }
      const glow = /halo|beam|ray|shaft|sheen|moon|sun/
      const pieces: Piece[] = []
      for (const svg of layers) {
        const layer = depthOf(svg)
        if (layer === 'water') continue
        for (const el of svg.querySelectorAll<SVGGeometryElement>('path, circle, ellipse, rect, polygon')) {
          if (el.closest('[data-free], .scr-moon, .scr-sun')) continue
          const fill = el.getAttribute('fill') ?? ''
          if (glow.test(fill) || fill === 'none') continue
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.fill === 'none') continue
          // Each subpath of a path is a piece of its own (a path often holds many windows or stones).
          const subs = el.tagName === 'path' ? (el.getAttribute('d') ?? '').split(/(?=M)/).map((s) => s.trim()).filter(Boolean) : [null]
          // The element's user space → the frame's (both layers share the 1600×900 viewBox).
          const ref = svg.getCTM()!.inverse()
          const ctm = ref.multiply(el.getCTM()!)
          subs.forEach((d, k) => {
            let local = el
            if (d !== null && subs.length > 1) {
              local = document.createElementNS('http://www.w3.org/2000/svg', 'path') as SVGPathElement
              local.setAttribute('d', d)
              local.setAttribute('fill-rule', el.getAttribute('fill-rule') ?? 'nonzero')
              el.parentNode!.insertBefore(local, el)
            }
            const b = local.getBBox()
            if (b.width * b.height < 1) return
            const p1 = new DOMPoint(b.x, b.y).matrixTransform(ctm)
            const p2 = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(ctm)
            const box = new DOMRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y))
            // Off the frame entirely (drawn wider than the screen): nothing to see.
            if (box.right < -60 || box.left > 1660 || box.bottom < -20 || box.top > 920) return
            pieces.push({ el, local, layer, label: `${el.tagName}${d ? ` "${d.slice(0, 48)}"` : ''}${subs.length > 1 ? ` (#${k})` : ''}`, box, ctm })
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

      const out: Array<{ layer: string; piece: string; rule: 'light' | 'floating' }> = []
      // Rule 1: lights, propagated (a light touching a held light is held too).
      const lights = pieces.filter((p) => isLight(p.layer))
      const held = new Set<Piece>()
      let grew = true
      while (grew) {
        grew = false
        for (const l of lights) {
          if (held.has(l)) continue
          const ok = pieces.some((p) => (!isLight(p.layer) && p.layer === motion[l.layer] && touches(l, p)) || (held.has(p) && p.layer === l.layer && touches(l, p)))
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
        if (p.box.bottom >= 896 || p.box.top <= 2 || p.box.left <= -38 || p.box.right >= 1638) continue
        const lvl = order.indexOf(p.layer)
        // Held by a shape of its layer or the one behind, or resting on a light that drifts with it (a lamp's cap on its glass).
        const ok = pieces.some((q) => q !== p && (isLight(q.layer) ? held.has(q) && motion[q.layer] === p.layer : order.indexOf(q.layer) <= lvl && order.indexOf(q.layer) >= lvl - 1) && touches(p, q))
        if (!ok) out.push({ layer: p.layer, piece: p.label, rule: 'floating' })
      }
      for (const p of pieces) if (p.local !== p.el) p.local.remove()
      return out
    }, TOUCH)
    expect(problems, problems.map((p) => `${p.rule} in ${p.layer}: ${p.piece}`).join('\n')).toEqual([])
  })
}
