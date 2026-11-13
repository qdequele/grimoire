// The generated game engine (public/play/engine.js), run in a real page on a story whose every text
// carries markup (hostileStory.ts): none of it may become an element, and none may show with its
// escaping doubled (&amp;). This is the check of the whole path: what the adapter hands over, and how
// each of the engine's renders writes it. No server: the page's files are served from disk.
// Needs Playwright's Chromium (`pnpm exec playwright install chromium`); skipped where it isn't installed.
import { existsSync, readFileSync } from 'node:fs'
import { chromium, type Browser } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { engineGlobals } from '../engineData'
import type { EngineGlobals } from '../host'
import { hostileStory, RAN } from './hostileStory'

const hasBrowser = (() => {
  try {
    return existsSync(chromium.executablePath())
  } catch {
    return false
  }
})()

interface Outcome {
  /** Markers whose element ran its handler. */
  ran: string[]
  /** Markers whose element was built in the page. */
  built: string[]
  /** Markers shown with their escaping doubled. */
  doubled: string[]
  /** Markers shown as the text they are. */
  shown: string[]
  /** Engine steps that threw (the test must exercise every render). */
  errors: string[]
}

/**
 * Loads play.html and the engine on this data, opens every scene and panel, and says what became of
 * the markers. `current` is the story id the app starts the game with (the story's own, as GamePage does).
 */
async function play(browser: Browser, data: EngineGlobals, lang: string, current: string): Promise<Outcome> {
  const html = readFileSync('play.html', 'utf8').replace(/<script type="module"[^>]*><\/script>/, '')
  const engine = readFileSync('public/play/engine.js', 'utf8')
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await page.route('**/*', (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === '/play.html') return route.fulfill({ contentType: 'text/html', body: html })
      if (path === '/play/engine.js') return route.fulfill({ contentType: 'text/javascript', body: engine })
      return route.fulfill({ status: 404, body: '' })
    })
    await page.addInitScript((l) => localStorage.setItem('gardien-lang', l), lang)
    await page.goto('http://engine.test/play.html')
    const outcome = await page.evaluate(async ({ data, RAN, current }) => {
      const w = window as unknown as Record<string, unknown>
      const storyId = (data.SCENARIOS[0] as { id: string }).id
      // What boot.ts does (src/play/boot.ts), with a host that only starts a game of this story.
      w.GRIMOIRE_DATA = {
        ...data,
        NPCS: data.NPC_TABLE ? { [storyId]: { p: data.NPC_TABLE.p, note: data.NPC_TABLE.note, rows: () => data.NPC_ROWS } } : {},
      }
      w.GRIMOIRE_HOST = {
        data,
        loadState: (f: { fresh: () => Record<string, unknown> }) => ({ ...f.fresh(), view: 'jouer', cur: current }),
        save: () => {}, quit: () => {}, giveItem: () => true, showHandout: () => true, openItems: () => true,
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

      // The engine's own globals (a classic script).
      const g = eval as (s: string) => unknown
      const call = (fn: string, ...args: unknown[]) => (g(fn) as (...a: unknown[]) => unknown)(...args)
      const errors: string[] = []
      const built: string[] = []
      let text = ''
      /** What the page holds now, hidden parts included. */
      const look = () => {
        text += `\n${document.body.textContent}`
        for (const img of document.querySelectorAll('img[src="x"]')) built.push(/F\d+/.exec(img.getAttribute('onerror') ?? '')?.[0] ?? '?')
      }
      const step = (name: string, f: () => void) => {
        try {
          f()
        } catch (e) {
          errors.push(`${name}: ${String(e)}`)
        }
        look()
      }
      const click = (selector: string) => document.querySelectorAll<HTMLElement>(selector).forEach((b) => b.click())

      let scenes: Array<{ id: string }> = []
      step('scenes', () => {
        scenes = g('scenesOf(SC())') as Array<{ id: string }>
      })
      for (const s of scenes) {
        step(`scene ${s.id}`, () => call('go', s.id))
        step(`rolls of ${s.id}`, () => {
          for (const chip of document.querySelectorAll<HTMLElement>('#scene .chip')) {
            chip.click()
            look()
          }
        })
      }
      step('who knows what', () => {
        g('view="who"')
        call('renderInv')
      })
      step('investigators', () => {
        g('view="inv"')
        g('ST().party.forEach(p=>openInv.add(p.cid))')
        call('renderInv')
      })
      step('NPC table', () => call('openNpc'))
      step('scene NPCs', () => call('renderNpcPanel'))
      step('combat: choosing', () => {
        call('openCombat')
        call('renderCombat')
      })
      step('combat: fighting', () => {
        g('beastsOf().forEach(b=>cbt().pick[b.id]=2)')
        call('startCombat')
      })
      step('combat: attacks', () => click('#cbtBody [data-atk]'))
      step('combat: damage', () => click('#cbtBody [data-dmg]'))
      step('combat: dodges', () => click('#cbtBody [data-esq]'))
      step('documents', () => Object.keys(data.HANDOUTS).forEach((id) => call('openHd', id)))
      step('home', () => call('renderHome'))
      step('stories', () => call('renderStory'))
      step('game setup', () => call('openSetup', g('S.cur'), true))
      step('tracker', () => click('#pmAdd, #ritStart'))
      step('journal', () => {
        call('jlog', 'x', 'scene')
        call('renderJournal')
      })
      step('narrator context', () => call('narrContext'))
      step('navigation', () => {
        call('renderNav')
        call('renderCtx')
      })
      // An element's handler runs after its picture fails to load.
      await new Promise((ok) => setTimeout(ok, 300))
      look()
      const markers = (re: RegExp) => [...new Set([...text.matchAll(re)].map((m) => m[1]))]
      return {
        ran: [...new Set((w[RAN] as string[] | undefined) ?? [])],
        built: [...new Set(built)],
        doubled: markers(/(F\d+) (?:&amp;|& &quot;|& "q" &lt;)/g),
        shown: markers(/(F\d+) & "q" <img/g),
        errors,
      }
    }, { data, RAN, current })
    return { ...outcome, errors: [...outcome.errors, ...pageErrors] }
  } finally {
    await context.close()
  }
}

describe.skipIf(!hasBrowser)('game engine: story text is never markup', () => {
  let browser: Browser
  beforeAll(async () => {
    browser = await chromium.launch()
  }, 60_000)
  afterAll(() => browser?.close())

  for (const lang of ['fr', 'en']) {
    it(`writes a story's texts as text on every screen (${lang})`, async () => {
      const { story, fields } = hostileStory(lang)
      const out = await play(browser, engineGlobals(story), lang, story.meta.id)
      const names = (markers: string[]) => [...new Set(markers.map((k) => fields[k] ?? k))].sort()

      expect(out.errors).toEqual([])
      expect(names(out.ran)).toEqual([])
      expect(names(out.built)).toEqual([])
      expect(names(out.doubled)).toEqual([])
      // Every text is on a screen these steps open, but for the few the engine doesn't show: numbers
      // (replaced by their defaults), an item's kind, the hint in brackets of a step's sanity roll,
      // and a scene's skill rolls when it has a flow (the flow's own roll lines replace them).
      const hidden = Object.keys(fields).filter((k) => !out.shown.includes(k))
      expect(names(hidden)).toEqual([
        'item.kind',
        'npc.armor',
        'npc.attack.skill',
        'npc.characteristics.DEX',
        'npc.dodge',
        'npc.hp',
        'pregen.attack.skill',
        'pregen.characteristics.DEX',
        'pregen.dodge',
        'pregen.hp',
        'pregen.luck',
        'pregen.mp',
        'pregen.san',
        'roll.label (san)',
        'scene roll.label (skill)',
        'tracker.max',
        'tracker.step',
      ])
    }, 60_000)
  }

  it('writes ids that carry markup as harmless ones, and still opens every screen', async () => {
    const { story, fields } = hostileStory('fr', { ids: true })
    const out = await play(browser, engineGlobals(story), 'fr', story.meta.id)
    expect(out.errors).toEqual([])
    expect(out.ran.map((k) => fields[k])).toEqual([])
    expect(out.built.map((k) => fields[k])).toEqual([])
  }, 60_000)

  it('runs nothing from a story id that carries markup (the game does not open)', async () => {
    const { story, fields } = hostileStory('fr', { ids: true, storyId: true })
    const out = await play(browser, engineGlobals(story), 'fr', story.meta.id)
    expect(out.ran.map((k) => fields[k])).toEqual([])
    expect(out.built.map((k) => fields[k])).toEqual([])
  }, 60_000)
})
