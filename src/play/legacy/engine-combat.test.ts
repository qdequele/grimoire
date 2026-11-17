// Weapon cards in the game engine's combat helper (scripts/engine-ui): the generated engine, run in
// a real page, with the cards as the app pushes them (toEngineItem). Runs in Chromium
// (enginePage.ts); skipped where it isn't installed.
import type { Browser } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CharacterData } from '@/characters/character'
import { currentT } from '@/i18n/t'
import { toEngineItem } from '@/items/engine'
import { isDamage, type Condition, type ItemCard } from '@/items/item'
import { engineGlobals } from '../engineData'
import type { StoryForEngine } from './adapter'
import { hasBrowser, launchBrowser, openEngine } from './enginePage'

// Structure only: no story text.
const story: StoryForEngine = {
  meta: { id: 's', title: 'S', lang: 'fr' },
  acts: [{ id: 'a', title: 'A', scenes: [{ id: 'one', title: 'One' }] }],
  pregens: [{ id: 'p1', name: 'Shooter' }],
  defaultParty: ['p1'],
}
const shooter: CharacterData = { name: 'Shooter', characteristics: {}, skills: { 'firearms-handgun': 95 } }

interface Shot {
  /** The big result, its level line and its detail line. */
  big: string
  level: string
  detail: string
  /** The Journal's newest line. */
  journal: string
  /** Rounds the engine asked the app to spend. */
  spent: number
  errors: string[]
}

describe.skipIf(!hasBrowser)('game engine: weapon cards in combat', { timeout: 30_000 }, () => {
  let browser: Browser
  beforeAll(async () => {
    browser = await launchBrowser()
  }, 60_000)
  afterAll(() => browser?.close())

  /** The investigator attacks with this card, and the d100 comes up `roll`. */
  async function shoot(card: ItemCard, roll: number, condition: Condition = 'clean'): Promise<Shot> {
    const item = toEngineItem(
      currentT(),
      { id: 'w1', characterId: 'p1', card, uses: card.uses ?? null, condition, source: { kind: 'keeper' }, position: 0, updatedAt: '' },
      shooter,
    )
    const { page, errors, close } = await openEngine(browser, engineGlobals(story))
    try {
      await page.evaluate(({ item, roll }) => {
        const g = eval as (s: string) => unknown
        const w = window as unknown as { GRIMOIRE_ENGINE: { setItems: (m: object) => void }; __roll: number }
        w.GRIMOIRE_ENGINE.setItems({ p1: [item] })
        w.__roll = roll
        g('d100=function(){return {r:window.__roll,det:String(window.__roll)}}')
        g('openCombat()')
        g('startCombat()')
        const attack = [...document.querySelectorAll<HTMLElement>('#cbtBody [data-atk]')].find((b) => b.textContent?.includes(item.n))
        if (!attack) throw new Error('no attack button for the card')
        attack.click()
      }, { item, roll })
      // The result shows after a short spinning number; an attack that threw never shows one.
      await page.waitForFunction(() => !!document.querySelector('#result .det') && !document.querySelector('#result.rolling'), null, { timeout: 3000 }).catch(() => {})
      const shot = await page.evaluate(() => {
        const g = eval as (s: string) => unknown
        const text = (sel: string) => document.querySelector(sel)?.textContent ?? ''
        const journal = (g('ST().journal') as Array<{ t: string }> | undefined) ?? []
        const calls = (window as unknown as { __hostCalls: unknown[][] }).__hostCalls
        return {
          big: text('#result .big'), level: text('#result .lvl'), detail: text('#result .det'),
          journal: journal[0]?.t ?? '',
          spent: calls.filter((c) => c[0] === 'useItem' && c[2] === -1).length,
        }
      })
      return { ...shot, errors }
    } finally {
      await close()
    }
  }

  const pistol: ItemCard = { name: 'Pistol', kind: 'weapon', uses: 6, ammo: '.38', weapon: { skill: 'firearms-handgun', damage: '1D10' } }

  it('rolls a hit with its damage, and spends a round', async () => {
    const shot = await shoot(pistol, 50)
    expect(shot.errors).toEqual([])
    expect(shot.big).toMatch(/^\d+ dég\.$/)
    expect(shot.journal).toMatch(/^Shooter Pistol → 50 .* · \d+ dégâts$/)
    expect(shot.spent).toBe(1)
  })

  it('still shows the hit of a weapon whose damage it cannot read, with "?" for the damage', async () => {
    // A card saved before damage was checked as dice (what "1D6+DB" became in the form).
    const shot = await shoot({ ...pistol, weapon: { ...pistol.weapon!, damage: '1D6+D' } }, 50)
    expect(shot.errors).toEqual([])
    expect(shot.big).toBe('? dég.')
    expect(shot.detail).toContain('1D6+D = ?')
    expect(shot.journal).toMatch(/^Shooter Pistol → 50 .* · \? dégâts$/)
    expect(shot.spent).toBe(1)
  })

  it('halves nothing it could not roll (a damaged weapon)', async () => {
    const shot = await shoot({ ...pistol, weapon: { ...pistol.weapon!, damage: '2D' } }, 20, 'damaged')
    expect(shot.errors).toEqual([])
    expect(shot.big).toBe('? dég.')
  })

  it('rolls every damage a card may be saved with', async () => {
    const samples = ['1D10', '2D6+4', '1d6', 'D6', '1D6+1D4', '1D8 + 1', '1D3-1', '5', '4D6/2D6/1D6', '1D10 / 1D6+2']
    expect(samples.filter((s) => !isDamage(s))).toEqual([])
    const { page, errors, close } = await openEngine(browser, engineGlobals(story))
    try {
      const unread = await page.evaluate((samples) => {
        const g = eval as (s: string) => unknown
        const roll = g('rollFormula') as (f: string) => unknown
        return samples.flatMap((s) => s.split('/')).filter((band) => !roll(band))
      }, samples)
      expect(unread).toEqual([])
      expect(errors).toEqual([])
    } finally {
      await close()
    }
  })
})
