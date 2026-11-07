#!/usr/bin/env node
// Screenshots of the drawn décors (src/screen/Places.tsx) for reviewing them by eye: each place at both
// ends of its parallax drift, where shapes drawn at different depths are furthest apart. Needs the dev
// server (`pnpm dev`): it opens the dev gallery, /dev/places.
//
//   pnpm decor:shots harbour                      one place, night, both drift ends
//   pnpm decor:shots harbour,street --time night,day
//   pnpm decor:shots library --crop 640,80,560,600   also a 2× zoom of that region (frame px)
//   pnpm decor:shots all --clean                  every place, without fog, grain and particles
//
// Options: --time night,dusk,day · --preset <id> · --crop x,y,w,h · --clean · --out <dir>
// (default decor-review, gitignored) · --url <dev server> (default http://localhost:5173).
// Files: <out>/<place>-<time>-a.png (drift start), -b.png (drift end), -a-zoom.png / -b-zoom.png.
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const PLACES = ['church', 'graveyard', 'crypt', 'castle', 'manor', 'library', 'police', 'forest', 'harbour', 'street']

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const flag = (name) => args.includes(`--${name}`)
const first = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'all'
const places = first === 'all' ? PLACES : first.split(',')
for (const p of places) if (!PLACES.includes(p)) throw new Error(`Unknown place "${p}" (${PLACES.join(', ')})`)
const times = opt('time', 'night').split(',')
const preset = opt('preset')
const crop = opt('crop')?.split(',').map(Number)
const out = opt('out', 'decor-review')
const url = opt('url', 'http://localhost:5173')
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: crop ? 2 : 1 })
const written = []
for (const place of places) {
  for (const time of times) {
    for (const end of [false, true]) {
      const q = new URLSearchParams({ place, time, ...(preset ? { preset } : {}) })
      await page.goto(`${url}/dev/places?${q}`)
      await page.locator('.scr-place svg.scr-par').first().waitFor()
      if (flag('clean')) await page.addStyleTag({ content: '.scr-fogs,.scr-grain,.scr-particles{display:none!important}' })
      // Every animation paused; the parallax drifts set to their start or their end (read from the
      // page itself, so this stays right whatever the durations in screen.css).
      await page.evaluate((atEnd) => {
        for (const a of document.getAnimations()) {
          const name = a.animationName ?? ''
          const timing = a.effect.getTiming()
          // One-off animations (the scene fading in) run to their end; loops pause where they are.
          if (timing.iterations !== Infinity) {
            a.finish()
            continue
          }
          a.pause()
          if (name.startsWith('scr-par')) a.currentTime = atEnd ? Number(timing.duration) - 1 : 0
        }
      }, end)
      await page.waitForTimeout(300)
      const base = `${out}/${place}-${time}-${end ? 'b' : 'a'}`
      await page.screenshot({ path: `${base}.png`, scale: 'css' })
      written.push(`${base}.png`)
      if (crop) {
        const [x, y, width, height] = crop
        await page.screenshot({ path: `${base}-zoom.png`, clip: { x, y, width, height } })
        written.push(`${base}-zoom.png`)
      }
    }
  }
}
await browser.close()
console.log(written.join('\n'))
