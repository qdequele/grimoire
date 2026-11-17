// Held cards as the game screen's engine shows them (GRIMOIRE_ENGINE.setItems): names in the keeper's
// language, and for weapons the investigator's value in the weapon's skill (their sheet's, else the
// skill's base value), so the combat helper rolls against it.
import type { CharacterData } from '@/characters/character'
import type { T } from '@/i18n/t'
import type { EngineItem } from '@/play/host'
import { SKILL_BY_ID } from '@/rules/d100'
import { documentCard, documentItemId, type StoryNames } from './documents'
import { CONDITION_LABEL, conditionEffects, isFirearm, parseCard, type HeldItem, type ItemCard } from './item'
import { localCard } from './text'

/** The investigator's value in a skill: their sheet's, else the base (numeric bases only, which weapon skills have). */
export function skillValue(data: CharacterData | undefined, skill: string): number {
  const own = data?.skills?.[skill]
  if (typeof own === 'number' && Number.isFinite(own)) return own
  const base = SKILL_BY_ID.get(skill)?.base
  return typeof base === 'number' ? base : 0
}

export function toEngineItem(t: T, item: HeldItem, data: CharacterData | undefined): EngineItem {
  const c = item.card
  const jam = jamAt(item)
  return {
    id: item.id,
    n: localCard(t, c, item.source).name,
    k: c.kind,
    ...(c.uses !== undefined ? { uses: item.uses ?? c.uses, cap: c.uses } : {}),
    ...(c.weapon
      ? {
        w: {
          sk: c.weapon.skill,
          v: skillValue(data, c.weapon.skill),
          dmg: c.weapon.damage,
          db: !!c.weapon.db,
          imp: !!c.weapon.impale,
          ...(jam !== undefined ? { jam } : {}),
          ...(item.condition !== 'clean' ? { c: engineCondition(t, item) } : {}),
        },
      }
      : {}),
  }
}

/** The roll from which a firearm jams, in its condition (its card's, or the condition's when lower); none below 100. */
function jamAt(item: HeldItem): number | undefined {
  if (!isFirearm(item.card)) return undefined
  const m = conditionEffects(item.card, item.condition).malfunction
  return m !== undefined && m < 100 ? m : undefined
}

/** A weapon's condition as the engine applies it (EngineItem.w.c). */
function engineCondition(t: T, item: HeldItem) {
  const e = conditionEffects(item.card, item.condition)
  return {
    label: t(CONDITION_LABEL[item.condition]),
    pen: e.penalty,
    minus: e.minus,
    half: e.half,
    ...(e.malfunction !== undefined ? { jam: e.malfunction } : {}),
    broken: e.broken,
  }
}

/**
 * A story's documents (handouts) as document cards to give: the letter, diary or plan an investigator
 * keeps (documentCard), with an id that can't clash with the story's items (documentItemId).
 */
export function storyDocuments(content: unknown): Array<{ itemId: string; card: ItemCard }> {
  const s = (content && typeof content === 'object' ? content : {}) as {
    acts?: Array<{ scenes?: Array<{ id: string; title?: string }> }>
    npcs?: Array<{ id: string; name?: string }>
    handouts?: Array<{ id: string; title?: string; text?: string; image?: string }>
  }
  const handouts = (s.handouts ?? []).filter((h) => h && typeof h.id === 'string' && typeof h.title === 'string')
  const names: StoryNames = {
    scene: new Map((s.acts ?? []).flatMap((a) => (a.scenes ?? []).map((x) => [x.id, x.title ?? x.id] as const))),
    npc: new Map((s.npcs ?? []).map((n) => [n.id, n.name ?? n.id] as const)),
    handout: new Map(handouts.map((h) => [h.id, h.title!] as const)),
  }
  return handouts.map((h) => ({ itemId: documentItemId(h.id), card: documentCard({ ...h, title: h.title! }, names) }))
}

/**
 * A story's items as cards to give (the story's id and scene are not part of the card). The story
 * format lets through optional values a card refuses (a skill id the rules don't have, a calibre with
 * a comma, markup in a range): the card is given without them rather than not at all, since the scene
 * lists the item anyway. An item whose name, kind or weapon a card can't do without is left out.
 */
export function storyCards(items: unknown): Array<{ itemId: string; card: ItemCard }> {
  if (!Array.isArray(items)) return []
  return items.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const { id, scene: _scene, ...rest } = raw as Record<string, unknown>
    if (typeof id !== 'string') return []
    let parsed = parseCard(rest, { stored: true })
    if (!parsed.card) parsed = parseCard(withoutOptional(rest, parsed.problems), { stored: true })
    return parsed.card ? [{ itemId: id, card: parsed.card }] : []
  })
}

/** The optional values parseCard named in its problems, removed (a copy: the story is left as it is). */
function withoutOptional(raw: Record<string, unknown>, problems: string[]): Record<string, unknown> {
  const named = new Set(problems.map((p) => p.split(':')[0]))
  const out = { ...raw }
  const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : null)
  if (named.has('ammo')) delete out.ammo
  if (named.has('bonus.skill')) delete out.bonus
  else if (named.has('bonus.note')) {
    const b = obj(out.bonus)
    if (b) {
      delete b.note
      out.bonus = b
    }
  }
  const w = obj(out.weapon)
  if (w && (named.has('weapon.range') || named.has('weapon.rate'))) {
    if (named.has('weapon.range')) delete w.range
    if (named.has('weapon.rate')) delete w.rate
    out.weapon = w
  }
  return out
}
