#!/usr/bin/env node
// Before / after of the drawn décors: renders the places as they are on another commit (default
// origin/main) and as they are in this checkout, then writes a page with a slider over each pair.
// Needs the dev server for "after" (`pnpm dev`); "before" runs in a temporary checkout of the ref (a git
// worktree under decor-review/, sharing this checkout's node_modules), on its own port, removed after.
//
//   pnpm decor:compare                         every place, night and day, both ends of the drift
//   pnpm decor:compare harbour,street --ref HEAD~3 --time night
//
// Options: --ref <commit> · --time night,dusk,day · --url <after dev server> (default
// http://localhost:5173) · --port <before port> (default 5198) · --out <dir> (default
// decor-review/compare, gitignored). With `pnpm dev` running the page is at
// http://localhost:5173/decor-review/compare/index.html.
import { spawn, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PLACES = ['church', 'graveyard', 'crypt', 'castle', 'manor', 'library', 'police', 'forest', 'harbour', 'street']
const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const first = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'all'
const places = first === 'all' ? PLACES : first.split(',')
const ref = opt('ref', 'origin/main')
const times = opt('time', 'night,day')
const afterUrl = opt('url', 'http://localhost:5173')
const port = Number(opt('port', '5198'))
const out = resolve(opt('out', 'decor-review/compare'))
const src = resolve('decor-review/before-src')
const label = execFileSync('git', ['log', '-1', '--format=%h %s', ref]).toString().trim()

const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: 'inherit', ...opts })
const shoot = (url, dir) => run('node', ['scripts/decor-shots.mjs', places.join(','), '--time', times, '--url', url, '--out', dir, '--clean'])
const waitFor = async (url) => {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No server at ${url}`)
}

mkdirSync(out, { recursive: true })
// After: this checkout, on the running dev server.
await waitFor(afterUrl)
shoot(afterUrl, `${out}/after`)

// Before: the ref in a temporary worktree, its own dev server.
if (existsSync(src)) run('git', ['worktree', 'remove', '--force', src])
run('git', ['worktree', 'add', '--detach', src, ref])
let server
try {
  symlinkSync(resolve('node_modules'), `${src}/node_modules`)
  if (existsSync('.env.local')) symlinkSync(resolve('.env.local'), `${src}/.env.local`)
  server = spawn(resolve('node_modules/.bin/vite'), ['--port', String(port), '--strictPort'], { cwd: src, stdio: 'ignore' })
  await waitFor(`http://localhost:${port}/`)
  shoot(`http://localhost:${port}`, `${out}/before`)
} finally {
  server?.kill()
  run('git', ['worktree', 'remove', '--force', src])
  rmSync(src, { recursive: true, force: true })
}

// The page: one slider per place, time of day and drift end.
const shots = places.flatMap((p) => times.split(',').flatMap((t) => ['a', 'b'].map((e) => ({ p, t, e, f: `${p}-${t}-${e}.png` }))))
writeFileSync(`${out}/index.html`, `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Décors: before / after</title>
<style>
  body { margin: 0; background: #0b0b0d; color: #d9d2c0; font: 14px/1.4 system-ui, sans-serif; }
  header { padding: 14px 20px; display: flex; gap: 18px; align-items: baseline; flex-wrap: wrap; }
  h1 { font-size: 16px; margin: 0; font-weight: 600; }
  .ref { opacity: .6; }
  nav { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 20px 10px; }
  nav button { background: #1b1b20; color: inherit; border: 1px solid #333; padding: 5px 10px; cursor: pointer; font: inherit; }
  nav button[aria-pressed=true] { background: #c9a35b; color: #111; border-color: #c9a35b; }
  .cmp { position: relative; max-width: 1600px; margin: 0 auto; aspect-ratio: 16 / 9; user-select: none; cursor: ew-resize; touch-action: none; }
  .cmp img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .cmp .after { clip-path: inset(0 0 0 var(--x, 50%)); }
  .cmp .bar { position: absolute; top: 0; bottom: 0; left: var(--x, 50%); width: 2px; background: #c9a35b; box-shadow: 0 0 6px #000; }
  .tag { position: absolute; top: 10px; padding: 3px 8px; background: #000a; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
  .tag.b { left: 10px; } .tag.a { right: 10px; }
  p.hint { text-align: center; opacity: .55; margin: 10px; }
</style>
<header><h1>Décors: before / after</h1><span class="ref">before = ${label.replace(/[<&]/g, '')} · after = this checkout</span></header>
<nav id="places"></nav><nav id="views"></nav>
<div class="cmp" id="cmp"><img class="before" id="before" alt=""><img class="after" id="after" alt=""><div class="bar"></div><span class="tag b">before</span><span class="tag a">after</span></div>
<p class="hint">Drag across the picture. Drift start / end: the layers at the two ends of their slow parallax, where shapes at different depths are furthest apart. Keys ← → change place.</p>
<script>
const shots = ${JSON.stringify(shots)}
const places = [...new Set(shots.map((s) => s.p))]
const views = [...new Set(shots.map((s) => s.t + '-' + s.e))]
let place = places[0], view = views[0]
const btn = (txt, on, pressed) => { const b = document.createElement('button'); b.textContent = txt; b.onclick = on; b.setAttribute('aria-pressed', pressed); return b }
const show = () => {
  const f = place + '-' + view + '.png'
  document.getElementById('before').src = 'before/' + f
  document.getElementById('after').src = 'after/' + f
  const P = document.getElementById('places'); P.replaceChildren(...places.map((p) => btn(p, () => { place = p; show() }, p === place)))
  const V = document.getElementById('views'); V.replaceChildren(...views.map((v) => { const [t, e] = v.split('-'); return btn(t + ' · drift ' + (e === 'a' ? 'start' : 'end'), () => { view = v; show() }, v === view) }))
}
const cmp = document.getElementById('cmp')
const move = (e) => { const r = cmp.getBoundingClientRect(); cmp.style.setProperty('--x', Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)) + '%') }
cmp.addEventListener('pointerdown', (e) => { cmp.setPointerCapture(e.pointerId); move(e) })
cmp.addEventListener('pointermove', (e) => { if (e.buttons) move(e) })
addEventListener('keydown', (e) => { const i = places.indexOf(place); if (e.key === 'ArrowRight') { place = places[(i + 1) % places.length]; show() } if (e.key === 'ArrowLeft') { place = places[(i + places.length - 1) % places.length]; show() } })
show()
</script>
`)
console.log(`${out}/index.html`)
