// Held cards as the game screen's engine shows them (GRIMOIRE_ENGINE.setItems): names in the keeper's
// language, and for weapons the investigator's value in the weapon's skill (their sheet's, else the
// skill's base value), so the combat helper rolls against it.
import type { CharacterData } from '@/characters/character'
import type { T } from '@/i18n/t'
import type { EngineItem } from '@/play/host'
import { SKILL_BY_ID } from '@/rules/d100'
import { CONDITION_LABEL, conditionEffects, parseCard, type HeldItem, type ItemCard } from './item'
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
          ...(item.condition !== 'clean' ? { c: engineCondition(t, item) } : {}),
        },
      }
      : {}),
  }
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

/** A story's items as cards to give (the ones that check out; the story's id and scene are not part of the card). */
export function storyCards(items: unknown): Array<{ itemId: string; card: ItemCard }> {
  if (!Array.isArray(items)) return []
  return items.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const { id, scene: _scene, ...rest } = raw as Record<string, unknown>
    const parsed = parseCard(rest)
    return typeof id === 'string' && parsed.card ? [{ itemId: id, card: parsed.card }] : []
  })
}
