#!/usr/bin/env node
// Portraits of the pre-generated investigators (src/characters/pregens/): OpenAI's image model draws
// each one as a 1920s sepia studio photograph (one shared look, `portraitPrompt` in portraits.ts), then
// a headless Chromium turns it into the photo an investigator carries: a centred square, 192 px, JPEG,
// small enough for `characters.photo` (≤ 60,000 characters as a data URL, see src/characters/photo.ts).
// Only that small JPEG is shipped (src/characters/pregens/portraits/<id>.jpg).
//
//   OPENAI_API_KEY=sk-… node scripts/pregen-portraits.mjs                 every portrait not drawn yet
//   OPENAI_API_KEY=sk-… node scripts/pregen-portraits.mjs harlan-moss --force   this one, again
//   node scripts/pregen-portraits.mjs --ship-only                         re-make the JPEGs from the drawings
//
// Options: --model <id> (default: the newest gpt-image model the key can use, asked from the API) · --quality low|medium|high (default medium, a few cents
// an image; high costs several times more) · --force (redraw ones already there: each call costs
// credit) · --ship-only (no API call) · --out <dir> (full-size drawings and manifest, default
// decor-review/pregens, gitignored).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { PORTRAIT_SUBJECTS, portraitPrompt } from '../src/characters/pregens/portraits.ts'

const SIZE = 192
const MAX = 60_000
const SHIP_DIR = 'src/characters/pregens/portraits'
/**
 * The part of the drawing kept: a square ZOOM of its width, TOP from the top edge. The model frames a
 * whole bust; the round head shows the face, so the photo keeps head and shoulders.
 */
const ZOOM = 0.72
const TOP = 0.05
/** Drawings asked for at once (image models have low per-minute limits on new accounts). */
const PARALLEL = 3

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const valued = ['--out', '--model', '--quality']
const out = opt('out', 'decor-review/pregens')
let model = opt('model', null)
const quality = opt('quality', 'medium')
const force = args.includes('--force')
const shipOnly = args.includes('--ship-only')
const named = args.filter((a, i) => !a.startsWith('--') && !valued.includes(args[i - 1]))
const ids = named.length && named[0] !== 'all' ? named.flatMap((a) => a.split(',')) : Object.keys(PORTRAIT_SUBJECTS)
for (const id of ids) if (!PORTRAIT_SUBJECTS[id]) throw new Error(`Unknown pregen: ${id}`)

mkdirSync(out, { recursive: true })
mkdirSync(SHIP_DIR, { recursive: true })
const manifestPath = join(out, 'manifest.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { portraits: {} }
const drawing = (id) => join(out, `${id}.png`)

let stop = false

/** The newest gpt-image model this key can use (the API lists the models, with their creation date). */
async function newestImageModel(key) {
  const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`Listing the models failed (${res.status}): ${JSON.stringify(body?.error ?? body).slice(0, 300)}`)
  const all = (body?.data ?? []).filter((m) => typeof m?.id === 'string')
  const images = all.filter((m) => /^gpt-image/.test(m.id)).sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
  if (!images.length) {
    const hint = all.map((m) => m.id).filter((id) => /image|dall/i.test(id)).join(', ') || 'none'
    throw new Error(`No gpt-image model on this key. Image-like models: ${hint}. Pass one with --model.`)
  }
  return images[0].id
}

async function draw(id, key) {
  const prompt = portraitPrompt(PORTRAIT_SUBJECTS[id])
  console.log(`${id}: drawing…`)
  const started = Date.now()
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024', quality }),
    signal: AbortSignal.timeout(300_000),
  })
  const body = await res.json().catch(() => null)
  const b64 = body?.data?.[0]?.b64_json
  if (!res.ok || typeof b64 !== 'string') {
    console.error(`${id}: failed (${res.status}) ${JSON.stringify(body?.error ?? body).slice(0, 300)}`)
    // A wrong model or parameter fails every portrait the same way: stop instead of trying the rest.
    if (res.status === 400 || res.status === 401 || res.status === 403) stop = true
    return
  }
  writeFileSync(drawing(id), Buffer.from(b64, 'base64'))
  manifest.portraits[id] = { model, quality, prompt, usage: body.usage ?? null, createdAt: new Date().toISOString() }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`${id}: drawn in ${Math.round((Date.now() - started) / 1000)} s`)
}

if (!shipOnly) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('Set OPENAI_API_KEY (or pass --ship-only)')
  const todo = ids.filter((id) => {
    if (!force && existsSync(drawing(id)) && manifest.portraits[id]) {
      console.log(`${id}: already drawn (--force to redraw)`)
      return false
    }
    return true
  })
  if (todo.length && !model) model = await newestImageModel(key)
  console.log(`${todo.length} portrait(s) to draw with ${model}, ${PARALLEL} at a time (about a minute each)…`)
  const queue = [...todo]
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    for (let id = queue.shift(); id && !stop; id = queue.shift()) await draw(id, key)
  }))
  if (stop) {
    console.error('Stopped: fix the error above (or pass --model <id>), then run again. Portraits already drawn are kept.')
    process.exit(1)
  }
}

// Drawing → square JPEG: head and shoulders (ZOOM, TOP), shrunk once; quality lowered until the data
// URL fits.
const browser = await chromium.launch()
const page = await browser.newPage()
for (const id of ids) {
  if (!existsSync(drawing(id))) {
    console.log(`${id}: no drawing yet`)
    continue
  }
  const src = `data:image/png;base64,${readFileSync(drawing(id)).toString('base64')}`
  const url = await page.evaluate(async ({ src, size, max, zoom, top }) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const side = Math.min(img.naturalWidth, img.naturalHeight) * zoom
    const sx = (img.naturalWidth - side) / 2, sy = img.naturalHeight * top
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
    for (let q = 0.9; q > 0.3; q -= 0.05) {
      const u = canvas.toDataURL('image/jpeg', q)
      if (u.length <= max) return u
    }
    return null
  }, { src, size: SIZE, max: MAX - 2_000, zoom: ZOOM, top: TOP })
  if (!url) {
    console.error(`${id}: too big even at low quality`)
    continue
  }
  writeFileSync(join(SHIP_DIR, `${id}.jpg`), Buffer.from(url.split(',')[1], 'base64'))
  console.log(`${id}: shipped (${url.length} characters)`)
}
await browser.close()
