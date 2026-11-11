import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import storySchema from '../../spec/story.schema.json'
import { sanitizeSvg } from '../../supabase/functions/_shared/svg-safe'
import { currentT } from '@/i18n/t'
import { ART_IDS, ARTS } from './arts'
import { CATALOG, CATALOG_BY_ID, catalogNumber } from './catalog'
import { skillValue, storyCards, toEngineItem } from './engine'
import { ITEM_KINDS, ITEM_LIMITS, USE_UNITS, WEAPON_SKILLS, ammoFor, asHeld, clampUses, conditionDamage, conditionEffects, conditionOf, parseCard, reloadPlan, sortHeld, type HeldItem, type ItemCard } from './item'
import { conditionDamageText, conditionNotes } from './text'

const held = (id: string, card: ItemCard, uses: number | null, position = 0): HeldItem => ({
  id, characterId: 'c1', card, uses, condition: 'clean', source: { kind: 'keeper' }, position, updatedAt: '',
})
const revolver: ItemCard = { name: 'Revolver', kind: 'weapon', uses: 6, ammo: '.38', weapon: { skill: 'firearms-handgun', damage: '1D10' } }
const box: ItemCard = { name: 'Box', kind: 'ammo', uses: 20, ammo: '.38' }

describe('parseCard', () => {
  it('accepts every catalogue card as it is', () => {
    for (const c of CATALOG) expect(parseCard(c.card), c.id).toEqual({ card: c.card, problems: [] })
  })

  it('lists every problem instead of repairing', () => {
    const r = parseCard({ name: 'A <b>', kind: 'spell', uses: 0, art: 'unicorn', weapon: { skill: 'occult', damage: 'lots' }, ammo: '<38>' })
    expect(r.card).toBeNull()
    expect(r.problems.map((p) => p.split(':')[0])).toEqual(['name', 'kind', 'art', 'weapon.skill', 'weapon.damage', 'uses', 'ammo'])
  })

  it('keeps names and texts within the limits the database checks', () => {
    expect(parseCard({ name: 'x'.repeat(ITEM_LIMITS.name), kind: 'tool' }).card).not.toBeNull()
    expect(parseCard({ name: 'x'.repeat(ITEM_LIMITS.name + 1), kind: 'tool' }).card).toBeNull()
    expect(parseCard({ name: 'x', kind: 'tool', text: 'y'.repeat(ITEM_LIMITS.text + 1) }).card).toBeNull()
    expect(parseCard({ name: 'x', kind: 'tool', uses: 100 }).card).toBeNull()
  })
})

describe('the catalogue', () => {
  it('has unique ids the database accepts, and cards it accepts (item_card_ok)', () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length)
    for (const c of CATALOG) {
      expect(c.id).toMatch(/^[a-z0-9-]{1,60}$/)
      expect(JSON.stringify(c.card).length).toBeLessThan(4000)
      expect(c.card.name).not.toMatch(/[<>&"]/)
    }
  })

  it('draws every card with an existing picture, and numbers them like a set', () => {
    for (const c of CATALOG) if (c.card.art) expect(ARTS[c.card.art], c.id).toBeDefined()
    expect(catalogNumber(CATALOG[0].id)).toBe(`1/${CATALOG.length}`)
    expect(catalogNumber('nope')).toBeNull()
  })

  it('gives every catalogue firearm ammunition that reloads it', () => {
    for (const w of CATALOG.filter((c) => c.card.ammo && c.card.kind === 'weapon')) {
      expect(CATALOG.some((c) => c.card.kind === 'ammo' && c.card.ammo === w.card.ammo), w.id).toBe(true)
    }
  })
})

describe('the story format', () => {
  const item = (storySchema as { $defs: { item: { properties: Record<string, { enum?: string[]; properties?: Record<string, { enum?: string[] }> }> } } }).$defs.item.properties
  it("lists the app's kinds, pictures, units and weapon skills", () => {
    expect(item.kind.enum).toEqual([...ITEM_KINDS])
    expect(item.art.enum).toEqual(ART_IDS)
    expect(item.unit.enum).toEqual([...USE_UNITS])
    expect(item.weapon.properties!.skill.enum).toEqual([...WEAPON_SKILLS])
  })
})

describe('uses and reloading', () => {
  it('keeps uses within the card', () => {
    expect(clampUses(revolver, 9)).toBe(6)
    expect(clampUses(revolver, -2)).toBe(0)
    expect(clampUses(box, 3.4)).toBe(3)
    expect(clampUses({ name: 'Rope', kind: 'tool' }, 3)).toBeNull()
  })

  it('reloads from the fullest box of the same calibre, up to the capacity', () => {
    const gun = held('gun', revolver, 1)
    const small = held('small', box, 3)
    const big = held('big', box, 12)
    const shells = held('shells', { name: 'Shells', kind: 'ammo', uses: 10, ammo: '12' }, 10)
    expect(reloadPlan(gun, [gun, small, big, shells])).toEqual({ ammo: big, moved: 5 })
    expect(reloadPlan(held('gun', revolver, 4), [small])).toEqual({ ammo: small, moved: 2 })
    expect(reloadPlan(held('gun', revolver, 6), [big])).toBeNull()
    expect(reloadPlan(gun, [shells, held('empty', box, 0)])).toBeNull()
    expect(ammoFor(held('rope', { name: 'Rope', kind: 'tool' }, null), [big])).toBeUndefined()
  })
})

describe('reading rows', () => {
  it('checks a row and clamps its uses; a broken card becomes plain gear', () => {
    expect(asHeld({ id: 'i', character_id: 'c', card: revolver, uses: 40, catalog_id: 'revolver-38', position: 2 })).toMatchObject({
      uses: 6, source: { kind: 'catalog', id: 'revolver-38' }, position: 2,
    })
    expect(asHeld({ id: 'i', characterId: 'c', card: box, uses: 3, storyId: 's', storyItem: 'key' })?.source).toEqual({ kind: 'story', storyId: 's', itemId: 'key' })
    expect(asHeld({ id: 'i', character_id: 'c', card: { name: 'Odd', kind: '?' } })?.card).toEqual({ name: 'Odd', kind: 'gear' })
    expect(asHeld({ id: 1, character_id: 'c', card: box })).toBeNull()
  })

  it('shows weapons first, then by kind, then as given', () => {
    const list = sortHeld([held('a', box, 1, 1), held('b', { name: 'Rope', kind: 'tool' }, null, 0), held('c', revolver, 6, 5)])
    expect(list.map((h) => h.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('the game screen', () => {
  it("rolls a weapon against the investigator's skill, else the skill's base", () => {
    expect(skillValue({ name: 'A', characteristics: {}, skills: { 'firearms-handgun': 55 } }, 'firearms-handgun')).toBe(55)
    expect(skillValue({ name: 'A', characteristics: {}, skills: {} }, 'firearms-rifle')).toBe(25)
    const e = toEngineItem(currentT(), { ...held('gun', revolver, 4), source: { kind: 'keeper' } }, { name: 'A', characteristics: {}, skills: {} })
    expect(e).toEqual({ id: 'gun', n: 'Revolver', k: 'weapon', uses: 4, cap: 6, w: { sk: 'firearms-handgun', v: 20, dmg: '1D10', db: false, imp: false } })
    expect(toEngineItem(currentT(), held('rope', { name: 'Rope', kind: 'tool' }, null), undefined)).toEqual({ id: 'rope', n: 'Rope', k: 'tool' })
  })

  it("reads a story's items as cards, leaving out its id and scene, and skipping broken ones", () => {
    expect(storyCards([
      { id: 'key', name: 'Crypt key', kind: 'key', scene: 'crypt' },
      { id: 'bad', name: 'No kind' },
      { name: 'No id', kind: 'tool' },
    ])).toEqual([{ itemId: 'key', card: { name: 'Crypt key', kind: 'key' } }])
    expect(storyCards(undefined)).toEqual([])
  })
})

describe('the catalogue pictures (src/items/pictures, scripts/item-arts-ship.mjs)', () => {
  const dir = new URL('./pictures/', import.meta.url)
  const files = readdirSync(dir).filter((f) => f.endsWith('.svg'))

  it('are each named after a catalogue card', () => {
    for (const f of files) expect(CATALOG_BY_ID.has(f.slice(0, -4)), f).toBe(true)
  })

  it('pass the strict SVG check unchanged, and are trimmed (not a square sandbox placeholder)', () => {
    for (const f of files) {
      const svg = readFileSync(new URL(f, dir), 'utf8')
      expect(sanitizeSvg(svg).svg, f).toBe(svg)
      expect(svg, f).not.toContain('sandbox')
      expect(svg.length, f).toBeLessThan(60_000)
    }
  })
})

describe("a weapon's condition", () => {
  const knife: ItemCard = { name: 'Knife', kind: 'weapon', weapon: { skill: 'fighting-brawl', damage: '1D6', db: true } }
  const gun = { ...revolver, weapon: { ...revolver.weapon!, malfunction: 100 } }

  it('follows the keeper’s table', () => {
    expect(conditionEffects(gun, 'clean')).toEqual({ penalty: 0, minus: 0, half: false, malfunction: 100, broken: false })
    expect(conditionEffects(gun, 'dirty')).toEqual({ penalty: 0, minus: 0, half: false, malfunction: 95, broken: false })
    expect(conditionEffects(knife, 'dirty')).toEqual({ penalty: 0, minus: 1, half: false, broken: false })
    expect(conditionEffects(gun, 'rusty')).toEqual({ penalty: 1, minus: 1, half: false, malfunction: 90, broken: false })
    expect(conditionEffects(knife, 'damaged')).toEqual({ penalty: 1, minus: 0, half: true, broken: false })
    expect(conditionEffects(gun, 'broken').broken).toBe(true)
    // A gun that already jams early keeps its own, worse value.
    expect(conditionEffects({ ...gun, weapon: { ...gun.weapon, malfunction: 88 } }, 'dirty').malfunction).toBe(88)
  })

  it('changes the damage dealt, never below 0', () => {
    expect(conditionDamage(7, conditionEffects(knife, 'dirty'))).toBe(6)
    expect(conditionDamage(0, conditionEffects(knife, 'rusty'))).toBe(0)
    expect(conditionDamage(7, conditionEffects(knife, 'damaged'))).toBe(3)
  })

  it('says it on the card', () => {
    const t = currentT()
    expect(conditionDamageText(t, knife.weapon!, knife, 'rusty')).toBe('1D6 + Impact −1')
    expect(conditionDamageText(t, gun.weapon!, gun, 'damaged')).toBe('½ (1D10)')
    expect(conditionNotes(t, gun, 'rusty')).toEqual(['dé de malus', '−1 aux dégâts', 's’enraye sur 90+'])
    expect(conditionNotes(t, knife, 'broken')).toEqual(['ne peut pas attaquer'])
  })

  it('is only for weapons, and unknown values read as clean', () => {
    expect(conditionOf(gun, 'rusty')).toBe('rusty')
    expect(conditionOf(gun, 'shiny')).toBe('clean')
    expect(conditionOf(box, 'rusty')).toBe('clean')
  })

  it('reaches the game screen only when it does something', () => {
    const t = currentT()
    expect(toEngineItem(t, { ...held('gun', gun, 6), condition: 'rusty' }, undefined).w?.c).toEqual({ label: 'Rouillée', pen: 1, minus: 1, half: false, jam: 90, broken: false })
    expect(toEngineItem(t, held('gun', gun, 6), undefined).w?.c).toBeUndefined()
  })
})

