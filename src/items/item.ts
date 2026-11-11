// Investigators' items (« Objets »): what they carry from one game to the next, drawn as cards.
// A card is the item's description (name, type, stats, rules text); a row of character_items is one
// card in one investigator's hands, with its uses left (bullets loaded, bandages, matches…).
// Pure code: the database check (item_card_ok), the phones' RPCs and the story format follow these limits.
import { hasMarkup } from '@/characters/character'
import { SKILL_BY_ID } from '@/rules/d100'
import { ARTS, type ArtId } from './arts'

/** Item types, like a card game's "energies": each has its colour and default illustration. */
export const ITEM_KINDS = ['weapon', 'ammo', 'light', 'tool', 'medical', 'document', 'occult', 'gear', 'key'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

export const KIND_LABEL: Record<ItemKind, string> = {
  weapon: 'Arme',
  ammo: 'Munitions',
  light: 'Lumière',
  tool: 'Outil',
  medical: 'Soins',
  document: 'Document',
  occult: 'Occulte',
  gear: 'Équipement',
  key: 'Clé',
}

/** The illustration of an item that names none. */
export const KIND_ART: Record<ItemKind, ArtId> = {
  weapon: 'revolver',
  ammo: 'bullets',
  light: 'lantern',
  tool: 'toolkit',
  medical: 'medkit',
  document: 'notebook',
  occult: 'amulet',
  gear: 'backpack',
  key: 'key',
}

/** What an item's uses count. */
export const USE_UNITS = ['balles', 'cartouches', 'charges', 'utilisations', 'doses', 'allumettes', 'bougies', 'plaques', 'gorgées', 'heures'] as const
export type UseUnit = (typeof USE_UNITS)[number]

/** Singular of each unit, for "1 balle". */
export const UNIT_ONE: Record<UseUnit, string> = {
  balles: 'balle',
  cartouches: 'cartouche',
  charges: 'charge',
  utilisations: 'utilisation',
  doses: 'dose',
  allumettes: 'allumette',
  bougies: 'bougie',
  plaques: 'plaque',
  gorgées: 'gorgée',
  heures: 'heure',
}

/** Skills a weapon can be used with. */
export const WEAPON_SKILLS = ['firearms-handgun', 'firearms-rifle', 'fighting-brawl', 'throw'] as const

export interface WeaponStats {
  /** Skill id (WEAPON_SKILLS). */
  skill: string
  /** Dice, as on a sheet: "1D10", "2D6+4", "4D6/2D6/1D6" (by range band). */
  damage: string
  /** Adds the wielder's damage bonus (melee and thrown weapons). */
  db?: boolean
  /** "15 m", "contact". */
  range?: string
  /** Attacks per round: "1", "1 (3)". */
  rate?: string
  /** A roll at or above this jams the weapon (firearms). */
  malfunction?: number
  /** Can impale on an extreme success (blades, bullets). */
  impale?: boolean
}

export interface ItemCard {
  name: string
  kind: ItemKind
  /** Illustration; the kind's when absent. */
  art?: ArtId
  /** Rules or flavour text, as written (catalogue texts are translated). */
  text?: string
  weapon?: WeaponStats
  /** How many uses a full item holds (a revolver's cylinder, a box of cartridges, a first-aid kit). */
  uses?: number
  unit?: UseUnit
  /** A weapon: the ammunition it takes; an ammunition card: the one it is (".38", "12"). Reload matches them. */
  ammo?: string
  /** A skill the item helps with (descriptive: the keeper decides the bonus). */
  bonus?: { skill: string; note?: string }
  /** 1 common · 2 uncommon · 3 rare (catalogue); the card's corner diamonds. */
  rarity?: 1 | 2 | 3
  /**
   * A document's full text (a letter, a diary, a plan's legend): story rich text (**bold**, *italic*,
   * line breaks), read on paper from the card. Copied when given, so it stays with the investigator.
   */
  document?: string
}

/**
 * A held weapon's condition (character_items.condition), set by the keeper. It belongs to that copy
 * of the weapon, not to the card: the same revolver can be clean in one investigator's hands and
 * rusty in another's.
 */
export const CONDITIONS = ['clean', 'dirty', 'rusty', 'damaged', 'broken'] as const
export type Condition = (typeof CONDITIONS)[number]

export const CONDITION_LABEL: Record<Condition, string> = {
  clean: 'Propre',
  dirty: 'Sale',
  rusty: 'Rouillée',
  damaged: 'Abîmée',
  broken: 'Hors d’usage',
}

/** What a condition does to a weapon in play. */
export interface WeaponEffects {
  /** Penalty dice on the attack roll. */
  penalty: number
  /** Taken off the damage rolled (never below 0). */
  minus: number
  /** Damage rolled is halved (rounded down), after `minus`. */
  half: boolean
  /** A firearm's attack roll at or above this jams it (the card's own value at best). */
  malfunction?: number
  /** Can't attack at all. */
  broken: boolean
}

export const isFirearm = (c: ItemCard) => !!c.weapon?.skill.startsWith('firearms')

/**
 * The rules of each condition (the keeper's table, shown on the card and applied by the combat helper):
 * - sale: firearms jam from 95; blades, clubs and thrown weapons −1 damage;
 * - rouillée: one penalty die, −1 damage; firearms jam from 90;
 * - abîmée: one penalty die, half damage; firearms jam from 90;
 * - hors d'usage: can't attack.
 */
export function conditionEffects(card: ItemCard, condition: Condition = 'clean'): WeaponEffects {
  const firearm = isFirearm(card)
  const jam = (n: number) => (firearm ? Math.min(card.weapon?.malfunction ?? 100, n) : undefined)
  switch (condition) {
    case 'dirty':
      return firearm ? { penalty: 0, minus: 0, half: false, malfunction: jam(95), broken: false } : { penalty: 0, minus: 1, half: false, broken: false }
    case 'rusty':
      return { penalty: 1, minus: 1, half: false, malfunction: jam(90), broken: false }
    case 'damaged':
      return { penalty: 1, minus: 0, half: true, malfunction: jam(90), broken: false }
    case 'broken':
      return { penalty: 0, minus: 0, half: false, malfunction: card.weapon?.malfunction, broken: true }
    default:
      return { penalty: 0, minus: 0, half: false, malfunction: card.weapon?.malfunction, broken: false }
  }
}

/** Damage after a condition: rolled `n`, then −minus (≥ 0), then halved (rounded down). */
export const conditionDamage = (n: number, e: WeaponEffects) => {
  const d = Math.max(0, n - e.minus)
  return e.half ? Math.floor(d / 2) : d
}

/** A condition is only for weapons; anything else read from a row is clean. */
export const conditionOf = (card: ItemCard, v: unknown): Condition =>
  card.kind === 'weapon' ? (CONDITIONS.find((c) => c === v) ?? 'clean') : 'clean'

/** Where a card came from. */
export type ItemSource = { kind: 'catalog'; id: string } | { kind: 'story'; storyId: string; itemId: string } | { kind: 'keeper' }

/** One card in an investigator's hands (a character_items row). */
export interface HeldItem {
  id: string
  characterId: string
  card: ItemCard
  /** Uses left, null when the card has none. */
  uses: number | null
  /** A weapon's condition ('clean' for anything else). */
  condition: Condition
  source: ItemSource
  position: number
  updatedAt: string
}

export const ITEM_LIMITS = {
  name: 60,
  text: 400,
  damage: 24,
  range: 20,
  rate: 12,
  ammo: 16,
  note: 120,
  document: 8000,
  uses: 99,
  /** Cards one investigator can hold (the database counts them too). */
  perCharacter: 60,
} as const

const DAMAGE = /^[0-9Dd+\-/ ]+$/
const AMMO = /^[\p{L}\p{N} .-]+$/u

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const int = (v: unknown): number | undefined => (typeof v === 'number' && Number.isInteger(v) ? v : undefined)

/**
 * A card from untrusted JSON (the database, a story, a form), or the list of what's wrong with it.
 * Nothing is repaired: a bad value is a problem, so a story or a form says exactly what to fix.
 */
export function parseCard(raw: unknown): { card: ItemCard; problems: [] } | { card: null; problems: string[] } {
  const problems: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { card: null, problems: ['not an object'] }
  const r = raw as Record<string, unknown>
  const name = str(r.name)
  if (!name) problems.push('name: missing')
  else if (name.length > ITEM_LIMITS.name) problems.push(`name: over ${ITEM_LIMITS.name} characters`)
  else if (hasMarkup(name)) problems.push('name: < > & " are not allowed')
  const kind = ITEM_KINDS.find((k) => k === r.kind)
  if (!kind) problems.push(`kind: one of ${ITEM_KINDS.join(', ')}`)
  const card: ItemCard = { name: name ?? '', kind: kind ?? 'gear' }

  if (r.art !== undefined) {
    if (typeof r.art === 'string' && r.art in ARTS) card.art = r.art as ArtId
    else problems.push('art: unknown illustration')
  }
  if (r.text !== undefined) {
    const text = typeof r.text === 'string' ? r.text.trim() : null
    if (text === null) problems.push('text: must be text')
    else if (text.length > ITEM_LIMITS.text) problems.push(`text: over ${ITEM_LIMITS.text} characters`)
    else if (text) card.text = text
  }
  if (r.weapon !== undefined) {
    const w = r.weapon as Record<string, unknown> | null
    if (!w || typeof w !== 'object') problems.push('weapon: must be an object')
    else {
      const skill = str(w.skill)
      const damage = str(w.damage)
      if (!skill || !(WEAPON_SKILLS as readonly string[]).includes(skill)) problems.push(`weapon.skill: one of ${WEAPON_SKILLS.join(', ')}`)
      if (!damage || damage.length > ITEM_LIMITS.damage || !DAMAGE.test(damage) || !/\d/.test(damage)) problems.push('weapon.damage: dice such as 1D10 or 2D6+4')
      const weapon: WeaponStats = { skill: skill ?? '', damage: damage ?? '' }
      if (w.db !== undefined) weapon.db = w.db === true
      for (const [key, max] of [['range', ITEM_LIMITS.range], ['rate', ITEM_LIMITS.rate]] as const) {
        if (w[key] === undefined) continue
        const v = str(w[key])
        if (!v || v.length > max || hasMarkup(v)) problems.push(`weapon.${key}: short text`)
        else weapon[key] = v
      }
      if (w.malfunction !== undefined) {
        const m = int(w.malfunction)
        if (m === undefined || m < 90 || m > 100) problems.push('weapon.malfunction: a number from 90 to 100')
        else weapon.malfunction = m
      }
      if (w.impale !== undefined) weapon.impale = w.impale === true
      card.weapon = weapon
    }
  }
  if (r.uses !== undefined) {
    const u = int(r.uses)
    if (u === undefined || u < 1 || u > ITEM_LIMITS.uses) problems.push(`uses: a whole number from 1 to ${ITEM_LIMITS.uses}`)
    else card.uses = u
  }
  if (r.unit !== undefined) {
    const unit = USE_UNITS.find((x) => x === r.unit)
    if (!unit) problems.push(`unit: one of ${USE_UNITS.join(', ')}`)
    else card.unit = unit
  }
  if (r.ammo !== undefined) {
    const a = str(r.ammo)
    if (!a || a.length > ITEM_LIMITS.ammo || !AMMO.test(a)) problems.push('ammo: a short calibre such as .38')
    else card.ammo = a
  }
  if (r.bonus !== undefined) {
    const b = r.bonus as Record<string, unknown> | null
    const skill = b && typeof b === 'object' ? str(b.skill) : undefined
    if (!skill || !SKILL_BY_ID.has(skill)) problems.push('bonus.skill: a skill id')
    else {
      const note = str(b!.note)
      if (note && (note.length > ITEM_LIMITS.note || hasMarkup(note))) problems.push(`bonus.note: at most ${ITEM_LIMITS.note} characters`)
      card.bonus = note ? { skill, note } : { skill }
    }
  }
  if (r.document !== undefined) {
    const doc = typeof r.document === 'string' ? r.document.trim() : null
    if (doc === null) problems.push('document: must be text')
    else if (doc.length > ITEM_LIMITS.document) problems.push(`document: over ${ITEM_LIMITS.document} characters`)
    else if (doc) card.document = doc
  }
  if (r.rarity !== undefined) {
    if (r.rarity === 1 || r.rarity === 2 || r.rarity === 3) card.rarity = r.rarity
    else problems.push('rarity: 1, 2 or 3')
  }
  return problems.length ? { card: null, problems } : { card, problems: [] }
}

/** A card read from the database: checked, or a plain gear card named after it (never throws). */
export function cardOr(raw: unknown): ItemCard {
  const p = parseCard(raw)
  if (p.card) return p.card
  const name = raw && typeof raw === 'object' ? str((raw as Record<string, unknown>).name) : undefined
  return { name: name && !hasMarkup(name) ? name.slice(0, ITEM_LIMITS.name) : '?', kind: 'gear' }
}

export const artOf = (c: ItemCard): ArtId => c.art ?? KIND_ART[c.kind]
export const unitOf = (c: ItemCard): UseUnit => c.unit ?? (c.kind === 'weapon' || c.kind === 'ammo' ? 'balles' : c.kind === 'medical' ? 'doses' : 'utilisations')

/** The uses a new card starts with: full. */
export const fullUses = (c: ItemCard): number | null => c.uses ?? null

/** Uses after a −/+ tap, within the card's bounds. */
export const clampUses = (c: ItemCard, n: number): number | null =>
  c.uses === undefined ? null : Math.max(0, Math.min(c.uses, Math.round(n)))

/** A firearm that takes ammunition: can be reloaded from a matching ammunition card. */
export const reloadable = (c: ItemCard): boolean => c.kind === 'weapon' && !!c.ammo && c.uses !== undefined

/** The investigator's ammunition card a weapon reloads from: same calibre, with uses left (fullest first). */
export function ammoFor(weapon: HeldItem, held: HeldItem[]): HeldItem | undefined {
  if (!reloadable(weapon.card)) return undefined
  return held
    .filter((h) => h.card.kind === 'ammo' && h.card.ammo === weapon.card.ammo && (h.uses ?? 0) > 0)
    .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0))[0]
}

/**
 * Reloading moves rounds from the ammunition card into the weapon, up to its capacity. Same rule as
 * the database's reload_item. Null when there is nothing to do.
 */
export function reloadPlan(weapon: HeldItem, held: HeldItem[]): { ammo: HeldItem; moved: number } | null {
  const ammo = ammoFor(weapon, held)
  if (!ammo || weapon.card.uses === undefined) return null
  const moved = Math.min(weapon.card.uses - (weapon.uses ?? 0), ammo.uses ?? 0)
  return moved > 0 ? { ammo, moved } : null
}

/** Cards in the order they are shown: weapons first, then by kind, then as given. */
export function sortHeld(items: HeldItem[]): HeldItem[] {
  const rank = (k: ItemKind) => ITEM_KINDS.indexOf(k)
  return [...items].sort((a, b) => rank(a.card.kind) - rank(b.card.kind) || a.position - b.position || a.updatedAt.localeCompare(b.updatedAt))
}

/** A row from the database (character_items, or companion_open's items), checked. */
export function asHeld(row: Record<string, unknown>): HeldItem | null {
  const id = row.id, characterId = row.character_id ?? row.characterId
  if (typeof id !== 'string' || typeof characterId !== 'string') return null
  const card = cardOr(row.card)
  const n = typeof row.uses === 'number' && Number.isFinite(row.uses) ? row.uses : null
  const catalog = row.catalog_id ?? row.catalogId
  const storyId = row.story_id ?? row.storyId
  const storyItem = row.story_item ?? row.storyItem
  const source: ItemSource =
    typeof catalog === 'string' ? { kind: 'catalog', id: catalog }
      : typeof storyId === 'string' && typeof storyItem === 'string' ? { kind: 'story', storyId, itemId: storyItem }
        : { kind: 'keeper' }
  return {
    id,
    characterId,
    card,
    uses: card.uses === undefined ? null : clampUses(card, n ?? card.uses),
    condition: conditionOf(card, row.condition),
    source,
    position: typeof row.position === 'number' ? row.position : 0,
    updatedAt: typeof (row.updated_at ?? row.updatedAt) === 'string' ? String(row.updated_at ?? row.updatedAt) : '',
  }
}
