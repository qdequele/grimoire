// Test helper: the generated game engine (public/play/engine.js) running in a real page, started the
// way boot.ts starts it, with a host that only opens a game of the story. No server: play.html and
// the engine are served from disk. Needs Playwright's Chromium (`pnpm exec playwright install
// chromium`): tests that use it are skipped where it isn't installed (`hasBrowser`).
import { existsSync, readFileSync } from 'node:fs'
import { chromium, type Browser, type Page } from '@playwright/test'
import type { EngineGlobals } from '../host'

export const hasBrowser = (() => {
  try {
    return existsSync(chromium.executablePath())
  } catch {
    return false
  }
})()

export const launchBrowser = (): Promise<Browser> => chromium.launch()

export interface EnginePage {
  page: Page
  /** Uncaught errors of the page, as they come. */
  errors: string[]
  close: () => Promise<void>
}

/**
 * A page with the engine loaded on this data, in a game of its story.
 * `current` is the story id the app starts the game with (GamePage uses the story's own); by default
 * the one the engine data carries. `lang` is the interface language (`gardien-lang`).
 */
export async function openEngine(browser: Browser, data: EngineGlobals, opts: { lang?: string; current?: string } = {}): Promise<EnginePage> {
  const html = readFileSync('play.html', 'utf8').replace(/<script type="module"[^>]*><\/script>/, '')
  const engine = readFileSync('public/play/engine.js', 'utf8')
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/*', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/play.html') return route.fulfill({ contentType: 'text/html', body: html })
    if (path === '/play/engine.js') return route.fulfill({ contentType: 'text/javascript', body: engine })
    return route.fulfill({ status: 404, body: '' })
  })
  await page.addInitScript((l) => localStorage.setItem('gardien-lang', l), opts.lang ?? 'fr')
  await page.goto('http://engine.test/play.html')
  await page.evaluate(async ({ data, current }) => {
    const w = window as unknown as Record<string, unknown>
    const storyId = (data.SCENARIOS[0] as { id: string }).id
    // What boot.ts does (src/play/boot.ts).
    w.GRIMOIRE_DATA = {
      ...data,
      NPCS: data.NPC_TABLE ? { [storyId]: { p: data.NPC_TABLE.p, note: data.NPC_TABLE.note, rows: () => data.NPC_ROWS } } : {},
    }
    /** What the engine asked of the app: [method, ...arguments]. */
    const calls: unknown[][] = []
    w.__hostCalls = calls
    const note = (name: string) => (...args: unknown[]) => {
      calls.push([name, ...args])
      return true
    }
    w.GRIMOIRE_HOST = {
      data,
      loadState: (f: { fresh: () => Record<string, unknown> }) => ({ ...f.fresh(), view: 'jouer', cur: current ?? storyId }),
      save: () => {}, quit: () => {},
      giveItem: note('giveItem'), showHandout: note('showHandout'), openItems: note('openItems'), useItem: note('useItem'),
    }
    const ritual = data.RITUAL as { title: string; max: number; add: string; sub: string; help: string } | null
    if (ritual) {
      const set = (id: string, text: string) => {
        const el = document.getElementById(id)
        if (el) el.textContent = text
      }
      set('ritTitle', ritual.title)
      set('ritMax', String(ritual.max))
      set('pmAdd', ritual.add)
      set('pmSub', ritual.sub)
      const help = document.getElementById('ritHelp')
      if (help) help.innerHTML = ritual.help
    }
    history.replaceState(null, '', `#${storyId}`)
    await new Promise((ok, ko) => {
      const s = document.createElement('script')
      s.src = '/play/engine.js'
      s.onload = ok
      s.onerror = ko
      document.body.appendChild(s)
    })
  }, { data, current: opts.current })
  return { page, errors, close: () => context.close() }
}
