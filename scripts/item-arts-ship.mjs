#!/usr/bin/env node
// Ships the QuiverAI card pictures (decor-review/quiver/, from item-arts-quiver.mjs) into the app:
// src/items/pictures/<catalogue id>.svg, which ItemCard shows instead of the line drawing.
//
//   node scripts/item-arts-ship.mjs              every generated card (sandbox placeholders are skipped)
//   node scripts/item-arts-ship.mjs crowbar,rope these only
//
// Each picture is:
//   1. checked by the connector's strict SVG allowlist (supabase/functions/_shared/svg-safe.ts: no
//      scripts, links, raster images or external references; rebuilt from the parsed tree), refused
//      otherwise;
//   2. cleaned of a background panel: despite the prompt, Quiver sometimes starts with a light
//      rectangle covering the whole canvas; a <rect> among the first shapes that covers 90% of it
//      or more is removed;
//   3. trimmed to what is drawn: Quiver places the object anywhere in its square, so the outline is
//      measured in a headless browser (getBBox) and the viewBox set around it with an even margin.
//      The card then centres the object itself, and wide objects (rifles) fill the card's wide window;
//   4. checked again, and written.
// Needs Node 23+ (it imports svg-safe.ts directly) and Playwright's Chromium (pnpm e2e installs it).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { sanitizeSvg } from '../supabase/functions/_shared/svg-safe.ts'

const SRC = 'decor-review/quiver'
const OUT = 'src/items/pictures'
/** Margin around the drawing, as a share of its larger side (outlines are drawn half outside the measured box). */
const MARGIN = 0.05

const catalogIds = [...readFileSync('src/items/catalog.ts', 'utf8').matchAll(/\bid: '([a-z0-9-]+)'/g)].map((m) => m[1])
const manifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'))
const first = process.argv.slice(2).find((a) => !a.startsWith('--'))
const ids = (first ? first.split(',') : readdirSync(SRC).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)))
  .filter((id) => {
    if (!catalogIds.includes(id)) return console.warn(`${id}: not in the catalogue, skipped`), false
    if (!existsSync(join(SRC, `${id}.svg`))) return console.warn(`${id}: not generated yet, skipped`), false
    if (manifest.cards[id]?.sandbox) return console.warn(`${id}: sandbox placeholder, skipped (regenerate with a live key)`), false
    return true
  })

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()
const fmt = (n) => String(Math.round(n * 100) / 100)

for (const id of ids) {
  let safe
  try {
    safe = sanitizeSvg(readFileSync(join(SRC, `${id}.svg`), 'utf8'))
  } catch (e) {
    console.error(`${id}: REFUSED by the SVG check: ${e.message}`)
    continue
  }
  await page.setContent(safe.svg)
  const { box, svg, dropped } = await page.evaluate(() => {
    const root = document.querySelector('svg')
    const [vx, vy, vw, vh] = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
    let dropped = 0
    for (const el of [...root.children].slice(0, 4)) {
      if (el.tagName.toLowerCase() !== 'rect') continue
      const b = el.getBBox()
      if (b.width >= vw * 0.9 && b.height >= vh * 0.9 && b.x <= vx + vw * 0.05 && b.y <= vy + vh * 0.05) {
        el.remove()
        dropped++
      }
    }
    const b = root.getBBox()
    return { box: { x: b.x, y: b.y, w: b.width, h: b.height }, svg: dropped ? root.outerHTML : null, dropped }
  })
  // Without its background panel the drawing is re-checked from the browser's serialisation.
  if (svg) safe = sanitizeSvg(svg)
  if (!(box.w > 0 && box.h > 0)) {
    console.error(`${id}: nothing drawn, skipped`)
    continue
  }
  const pad = Math.max(box.w, box.h) * MARGIN
  const vb = [box.x - pad, box.y - pad, box.w + 2 * pad, box.h + 2 * pad].map(fmt)
  // The root tag only: its viewBox, width and height (svg-safe sets width/height from the viewBox).
  const trimmed = safe.svg.replace(/^<svg\b[^>]*>/, (tag) =>
    tag
      .replace(/\sviewBox="[^"]*"/, ` viewBox="${vb.join(' ')}"`)
      .replace(/\swidth="[^"]*"/, ` width="${vb[2]}"`)
      .replace(/\sheight="[^"]*"/, ` height="${vb[3]}"`),
  )
  const final = sanitizeSvg(trimmed)
  writeFileSync(join(OUT, `${id}.svg`), final.svg)
  console.log(`${id}: ${(final.bytes / 1024).toFixed(1)} KB, viewBox ${vb.join(' ')} (was ${safe.viewBox.join(' ')})${dropped ? ', background panel removed' : ''}`)
}
await browser.close()
console.log(`${ids.length} considered. ItemCard shows src/items/pictures/<id>.svg for catalogue cards that have one.`)
