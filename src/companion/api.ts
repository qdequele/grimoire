// Server state of the player companion: everything goes through the link token (no account).
import { useMutation, useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { CharacterData } from '@/characters/character'
import { photoOr } from '@/characters/photo'
import { currentT } from '@/i18n/t'
import { asHeld, clampUses, sortHeld, type HeldItem } from '@/items/item'
import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { Points, PointsRow } from '@/play/companion'
import { asRoll, subjectKey, type Roll, type RollSubject } from './rolls'
import { clampPoints } from './sheet'

export interface CompanionNote { id: string; characterId: string; body: string; createdAt: string }
export interface CompanionMember {
  id: string
  data: CharacterData
  player: string | null
  /** Data URL (checked), null when the investigator has none. */
  photo: string | null
}

export interface CompanionView {
  game: { id: string; channel: string; title: string }
  /** The personal link's investigator, null for a table link. */
  focus: string | null
  canCreate: boolean
  party: CompanionMember[]
  points: PointsRow[]
  /** Newest first. */
  notes: CompanionNote[]
  /** The party's items, in display order. */
  items: HeldItem[]
  /**
   * Investigators whose shown points come from a `points` broadcast since the server was last read.
   * Anyone with a link can send on the topic, so these values are for display only: a tap reads the
   * server before it builds on them.
   */
  hinted: string[]
}

export type CompanionErrorCode = 'link_invalid' | 'not_in_game' | 'bad_value' | 'party_full' | 'network'
const CODES: CompanionErrorCode[] = ['link_invalid', 'not_in_game', 'bad_value', 'party_full']

export class CompanionError extends Error {
  code: CompanionErrorCode
  constructor(code: CompanionErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'CompanionError'
    this.code = code
  }
}

/** The RPCs raise their code as the message; anything else (fetch failure, server error) is `network`. */
function asError(e: unknown): CompanionError {
  if (e instanceof CompanionError) return e
  const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  const code = CODES.find((c) => c === message.trim())
  return new CompanionError(code ?? 'network', message)
}

async function call<T>(run: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  let res: { data: T | null; error: unknown }
  try {
    res = await run()
  } catch (e) {
    throw asError(e)
  }
  if (res.error) throw asError(res.error)
  return res.data as T
}

export const companionKeys = {
  all: ['companion'] as const,
  one: (token: string) => [...companionKeys.all, token] as const,
}
const pointsMutationKey = (token: string) => [...companionKeys.one(token), 'points'] as const

// ------------------------------------------------------------------ remembered investigator

const rememberKey = (token: string) => `grimoire-companion-${token}`

/** The investigator this device picked from a table link, if any. */
export function rememberedCharacter(token: string): string | null {
  try {
    return localStorage.getItem(rememberKey(token))
  } catch {
    return null
  }
}
export function rememberCharacter(token: string, characterId: string): void {
  try {
    localStorage.setItem(rememberKey(token), characterId)
  } catch {
    /* private mode: the pick just isn't remembered */
  }
}
export function forgetCharacter(token: string): void {
  try {
    localStorage.removeItem(rememberKey(token))
  } catch {
    /* nothing to forget */
  }
}

// ------------------------------------------------------------------ reading

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const objects = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []

/** A `points` row or broadcast (Realtime adds keys such as `id`: only the ones used are checked). */
export function asPointsRow(p: Record<string, unknown>): PointsRow | null {
  const pv = num(p.pv), san = num(p.san), chance = num(p.chance), pm = num(p.pm)
  if (typeof p.characterId !== 'string' || pv === null || san === null || chance === null || pm === null) return null
  return {
    characterId: p.characterId,
    pv, san, chance, pm,
    checks: strings(p.checks),
    source: p.source === 'phone' ? 'phone' : 'keeper',
    updatedAt: str(p.updatedAt, new Date().toISOString()),
  }
}

function asView(raw: unknown): CompanionView {
  if (!raw || typeof raw !== 'object') throw new CompanionError('network', 'empty response')
  const r = raw as Record<string, unknown>
  const game = (r.game ?? {}) as Record<string, unknown>
  return {
    game: { id: str(game.id), channel: str(game.channel), title: str(game.title) },
    focus: typeof r.focus === 'string' ? r.focus : null,
    canCreate: r.canCreate === true,
    party: objects(r.party)
      .filter((m) => typeof m.id === 'string' && !!m.data && typeof m.data === 'object')
      .map((m) => ({
        id: m.id as string,
        data: m.data as CharacterData,
        player: typeof m.player === 'string' ? m.player : null,
        photo: photoOr(m.photo),
      })),
    points: objects(r.points).map(asPointsRow).filter((p): p is PointsRow => !!p),
    notes: objects(r.notes)
      .filter((n) => typeof n.id === 'string' && typeof n.characterId === 'string')
      .map((n) => ({ id: n.id as string, characterId: n.characterId as string, body: str(n.body), createdAt: str(n.createdAt) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    items: sortHeld(objects(r.items).map(asHeld).filter((h): h is HeldItem => !!h)),
    hinted: [],
  }
}

/** Current points of an investigator: the live row, else the sheet's (same defaults as the game screen). */
export function pointsOf(view: CompanionView | undefined, member: CompanionMember): PointsRow {
  const row = view?.points.find((p) => p.characterId === member.id)
  if (row) return row
  const d = member.data
  const progressSan = num((d.progress as { san?: unknown } | undefined)?.san)
  return {
    characterId: member.id,
    pv: d.hp ?? 10,
    san: progressSan ?? d.san ?? 50,
    chance: d.luck ?? 50,
    pm: d.mp ?? 10,
    checks: [],
    source: 'keeper',
    updatedAt: '',
  }
}

const isLinkInvalid = (e: unknown) => e instanceof CompanionError && e.code === 'link_invalid'

const openView = async (token: string): Promise<CompanionView> =>
  asView(await call(() => supabase.rpc('companion_open', { p_token: token })))

export function useCompanion(token: string): UseQueryResult<CompanionView, CompanionError> {
  return useQuery<CompanionView, CompanionError>({
    queryKey: companionKeys.one(token),
    // Taps still running keep what they show: this answer may predate their writes.
    queryFn: async () => withTaps(await openView(token), token, tapBook),
    // A revoked link stays revoked; network errors get the usual retries.
    retry: (count, e) => !isLinkInvalid(e) && count < 2,
    // Phones sleep and wake: refetch to catch up on what the channel missed.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

// ------------------------------------------------------------------ writing

/** A failed write on a revoked link: refetch, so the layout shows the invalid-link state. */
function onWriteError(qc: QueryClient, token: string, e: CompanionError) {
  if (e.code === 'link_invalid') {
    forgetCharacter(token)
    void qc.invalidateQueries({ queryKey: companionKeys.one(token) })
    return
  }
  const t = currentT()
  toast.error(e.code === 'network' ? t('Connexion impossible. Réessaie.') : t('Modification refusée par le serveur.'))
}

function patchPoints(view: CompanionView, row: PointsRow): CompanionView {
  const i = view.points.findIndex((p) => p.characterId === row.characterId)
  const points = [...view.points]
  if (i < 0) points.push(row)
  else points[i] = row
  return { ...view, points }
}

// One write at a time per investigator: taps reach the server in the order they were made.
const queues = new Map<string, Promise<unknown>>()
function enqueue<T>(key: string, run: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(run)
  queues.set(key, next)
  void next.finally(() => {
    if (queues.get(key) === next) queues.delete(key)
  }).catch(() => undefined)
  return next
}

export interface PointTap {
  characterId: string
  field: keyof Points
  /** +1 / −1 from the tile's buttons. */
  delta: number
}

const POINT_FIELDS: Array<keyof Points> = ['pv', 'san', 'chance', 'pm']

/**
 * The taps of one investigator that the server hasn't answered yet. Kept apart from the query cache:
 * a refetch (a hint on the channel, a resubscribe, the window's focus) replaces the cache at any time,
 * also with an answer older than a write in flight, and a tap sent from it would be lost.
 */
export interface Taps {
  /** The server's values: as this phone knew them at the first tap, then as each write was accepted. */
  base: Points
  maxHp: number
  /** What the phone shows for the tapped fields. */
  shown: Partial<Points>
  /** Taps not settled. */
  running: number
  /** `base` may hold a broadcast's values, or miss a change one announced: read the server before sending. */
  unsure: boolean
}
export type TapBook = Map<string, Taps>

const tapBook: TapBook = new Map()
export const tapKey = (token: string, characterId: string) => `${token}:${characterId}`

/**
 * Counts a tap and says what its field now shows (`applied` is what the tap really changed, 0 against
 * a bound). Null when the investigator isn't in the view and has no tap running: nothing is counted.
 */
export function startTap(book: TapBook, key: string, view: CompanionView | undefined, tap: PointTap): { shown: number; applied: number } | null {
  let taps = book.get(key)
  if (!taps) {
    const member = view?.party.find((m) => m.id === tap.characterId)
    if (!member) return null
    const cur = pointsOf(view, member)
    taps = {
      base: { pv: cur.pv, san: cur.san, chance: cur.chance, pm: cur.pm },
      maxHp: member.data.hp ?? 10,
      shown: {},
      running: 0,
      unsure: view?.hinted.includes(tap.characterId) ?? false,
    }
    book.set(key, taps)
  }
  taps.running += 1
  const before = taps.shown[tap.field] ?? taps.base[tap.field]
  const shown = clampPoints({ ...taps.base, [tap.field]: before + tap.delta }, taps.maxHp)[tap.field]
  taps.shown[tap.field] = shown
  return { shown, applied: shown - before }
}

/** The value a tap sends when its turn comes: what the server holds, plus this tap. */
export function tapTarget(taps: Taps, field: keyof Points, delta: number): number {
  return clampPoints({ ...taps.base, [field]: taps.base[field] + delta }, taps.maxHp)[field]
}

/** A refused tap no longer shows; the taps after it still do. */
export function undoTap(taps: Taps, field: keyof Points, applied: number): number {
  const shown = (taps.shown[field] ?? taps.base[field]) - applied
  taps.shown[field] = shown
  return shown
}

/**
 * A tap is through, accepted or not. After the investigator's last one, returns the values the server
 * accepted for the tapped fields (what the sheet shows until the refetch) and forgets the taps;
 * null while others are still running.
 */
export function endTap(book: TapBook, key: string): Partial<Points> | null {
  const taps = book.get(key)
  if (!taps) return {}
  taps.running -= 1
  if (taps.running > 0) return null
  book.delete(key)
  return Object.fromEntries(POINT_FIELDS.filter((f) => taps.shown[f] !== undefined).map((f) => [f, taps.base[f]]))
}

function patchFields(view: CompanionView, characterId: string, values: Partial<Points>): CompanionView {
  const member = view.party.find((m) => m.id === characterId)
  if (!member) return view
  // Server time comes with the refetch: keep the last known one so keeper changes still compare.
  return patchPoints(view, { ...pointsOf(view, member), ...values, source: 'phone' })
}

/**
 * The view once an investigator's last tap is through: the tapped fields show what the server accepted.
 * `unsure`: a broadcast came in after the server was last read, so the next tap reads it again.
 */
export function afterTaps(view: CompanionView, characterId: string, accepted: Partial<Points>, unsure: boolean): CompanionView {
  const next = patchFields(view, characterId, accepted)
  return unsure && !next.hinted.includes(characterId) ? { ...next, hinted: [...next.hinted, characterId] } : next
}

/** A view from the server, with what the running taps show on top (other fields are the server's). */
export function withTaps(view: CompanionView, token: string, book: TapBook): CompanionView {
  let out = view
  for (const m of view.party) {
    const taps = book.get(tapKey(token, m.id))
    if (taps) out = patchFields(out, m.id, taps.shown)
  }
  return out
}

/**
 * One tap on an investigator's HP / SAN / Luck / MP. The sheet changes at once (only that field); a
 * refused tap is taken back with a toast. Taps are queued per investigator and each sends only its
 * field, so a keeper change to another field is never undone. What a tap sends comes from the tap
 * book (the last value the server accepted, plus the tap), never from the cache; when the sheet shows
 * a broadcast's values, the tap first reads the server's.
 */
export function useSetPoints(token: string) {
  const qc = useQueryClient()
  const key = companionKeys.one(token)
  return useMutation<void, CompanionError, PointTap, { applied: number | null }>({
    mutationKey: pointsMutationKey(token),
    mutationFn: ({ characterId, field, delta }) =>
      enqueue(tapKey(token, characterId), async () => {
        const taps = tapBook.get(tapKey(token, characterId))
        if (!taps) throw new CompanionError('not_in_game')
        if (taps.unsure) {
          // No write of this investigator is in flight here (one at a time): the answer is current.
          taps.unsure = false
          try {
            const fresh = await openView(token)
            const member = fresh.party.find((m) => m.id === characterId)
            if (!member) throw new CompanionError('not_in_game')
            const cur = pointsOf(fresh, member)
            taps.base = { pv: cur.pv, san: cur.san, chance: cur.chance, pm: cur.pm }
            taps.maxHp = member.data.hp ?? 10
            qc.setQueryData<CompanionView>(key, withTaps(fresh, token, tapBook))
          } catch (e) {
            taps.unsure = true
            throw e
          }
        }
        const value = tapTarget(taps, field, delta)
        await call(() => supabase.rpc('companion_set_point', { p_token: token, p_character: characterId, p_field: field, p_value: value }))
        taps.base = { ...taps.base, [field]: value }
      }),
    onMutate: async (tap) => {
      await qc.cancelQueries({ queryKey: key })
      const view = qc.getQueryData<CompanionView>(key)
      const started = startTap(tapBook, tapKey(token, tap.characterId), view, tap)
      if (view && started) qc.setQueryData<CompanionView>(key, patchFields(view, tap.characterId, { [tap.field]: started.shown }))
      return { applied: started ? started.applied : null }
    },
    onError: (e, { characterId, field }, ctx) => {
      const taps = tapBook.get(tapKey(token, characterId))
      const view = qc.getQueryData<CompanionView>(key)
      if (taps && view && ctx?.applied != null) {
        qc.setQueryData<CompanionView>(key, patchFields(view, characterId, { [field]: undoTap(taps, field, ctx.applied) }))
      }
      onWriteError(qc, token, e)
    },
    onSettled: (_d, _e, { characterId }, ctx) => {
      const unsure = tapBook.get(tapKey(token, characterId))?.unsure === true
      const accepted = ctx?.applied != null ? endTap(tapBook, tapKey(token, characterId)) : {}
      if (!accepted) return
      // The investigator's last tap is through: show what the server accepted, then fetch its values.
      const view = qc.getQueryData<CompanionView>(key)
      if (view) qc.setQueryData<CompanionView>(key, afterTaps(view, characterId, accepted, unsure))
      void qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useAddNote(token: string) {
  const qc = useQueryClient()
  return useMutation<string, CompanionError, { characterId: string; body: string }>({
    mutationFn: ({ characterId, body }) =>
      call(() => supabase.rpc('companion_add_note', { p_token: token, p_character: characterId, p_body: body })),
    onError: (e) => onWriteError(qc, token, e),
    onSettled: () => qc.invalidateQueries({ queryKey: companionKeys.one(token) }),
  })
}

/**
 * Sets (a data URL from photoFromFile) or removes (null) an investigator's photo. The view is updated
 * at once on success; the server's `photo` hint refetches the other phones.
 */
export function useSetPhoto(token: string) {
  const qc = useQueryClient()
  const key = companionKeys.one(token)
  return useMutation<void, CompanionError, { characterId: string; photo: string | null }>({
    mutationFn: ({ characterId, photo }) =>
      call(() => supabase.rpc('companion_set_photo', { p_token: token, p_character: characterId, p_photo: photo ?? '' })),
    onSuccess: (_d, { characterId, photo }) => {
      const view = qc.getQueryData<CompanionView>(key)
      if (view) qc.setQueryData<CompanionView>(key, { ...view, party: view.party.map((m) => (m.id === characterId ? { ...m, photo } : m)) })
    },
    onError: (e) => onWriteError(qc, token, e),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

/**
 * A player creates their investigator from a table link: it joins the game at once. On success this
 * device remembers it and the view is refetched (awaited, so its sheet exists when navigating to it).
 * Errors are left to the page (each code has its own message); `link_invalid` refetches like other writes.
 */
export function useCreateCharacter(token: string) {
  const qc = useQueryClient()
  return useMutation<string, CompanionError, { data: CharacterData; playerName: string }>({
    mutationFn: ({ data, playerName }) =>
      call(() => supabase.rpc('companion_create_character', { p_token: token, p_data: data as unknown as Json, p_player_name: playerName })),
    onSuccess: async (id) => {
      rememberCharacter(token, id)
      await qc.invalidateQueries({ queryKey: companionKeys.one(token) })
    },
    onError: (e) => {
      if (e.code === 'link_invalid') {
        forgetCharacter(token)
        void qc.invalidateQueries({ queryKey: companionKeys.one(token) })
      }
    },
  })
}

// ------------------------------------------------------------------ items

function patchItem(view: CompanionView, id: string, uses: number, updatedAt?: string): CompanionView {
  return { ...view, items: view.items.map((i) => (i.id === id ? { ...i, uses, ...(updatedAt === undefined ? {} : { updatedAt }) } : i)) }
}

// Uses of an item this phone has sent and not heard back about.
const itemTaps = new Map<string, number>()
const itemKey = (token: string, id: string) => `${token}:${id}`

/**
 * A use spent (−1) or regained (+1). The card changes at once; the server's count wins: the view is
 * read again once, after the item's last queued use (not after each).
 */
export function useUseItem(token: string) {
  const qc = useQueryClient()
  const key = companionKeys.one(token)
  return useMutation<number, CompanionError, { item: HeldItem; delta: number }, { before: number | null }>({
    mutationFn: ({ item, delta }) =>
      enqueue(`${token}:item:${item.id}`, () => call(() => supabase.rpc('companion_use_item', { p_token: token, p_item: item.id, p_delta: delta }))),
    onMutate: async ({ item, delta }) => {
      itemTaps.set(itemKey(token, item.id), (itemTaps.get(itemKey(token, item.id)) ?? 0) + 1)
      await qc.cancelQueries({ queryKey: key })
      const view = qc.getQueryData<CompanionView>(key)
      const cur = view?.items.find((i) => i.id === item.id)
      if (view && cur?.uses != null && cur.card.uses !== undefined) {
        qc.setQueryData<CompanionView>(key, patchItem(view, item.id, Math.max(0, Math.min(cur.card.uses, cur.uses + delta))))
      }
      return { before: cur?.uses ?? null }
    },
    onError: (e, { item }, ctx) => {
      const view = qc.getQueryData<CompanionView>(key)
      if (view && ctx?.before != null) qc.setQueryData<CompanionView>(key, patchItem(view, item.id, ctx.before))
      onWriteError(qc, token, e)
    },
    onSettled: (_d, _e, { item }) => {
      const left = (itemTaps.get(itemKey(token, item.id)) ?? 1) - 1
      if (left > 0) return void itemTaps.set(itemKey(token, item.id), left)
      itemTaps.delete(itemKey(token, item.id))
      void qc.invalidateQueries({ queryKey: key })
    },
  })
}

/** Reload a weapon from its matching ammunition; resolves to the rounds moved. */
export function useReloadItem(token: string) {
  const qc = useQueryClient()
  return useMutation<number, CompanionError, HeldItem>({
    mutationFn: (item) => call(() => supabase.rpc('companion_reload_item', { p_token: token, p_weapon: item.id })),
    onError: (e) => onWriteError(qc, token, e),
    onSettled: () => qc.invalidateQueries({ queryKey: companionKeys.one(token) }),
  })
}

// ------------------------------------------------------------------ rolls

/** The server's roll, checked (a malformed answer reads as a network error). */
function rolled(raw: unknown): Roll {
  const roll = asRoll(raw)
  if (!roll) throw new CompanionError('network', 'bad roll')
  return roll
}

export interface CheckRequest { characterId: string; subject: RollSubject; target: number; net: number }
export interface DiceRequest { characterId: string; count: number; sides: number; modifier: number }

/** A d100 check rolled by the server, which tells the keeper's game screen. */
export function useRollCheck(token: string) {
  const qc = useQueryClient()
  return useMutation<Roll, CompanionError, CheckRequest>({
    mutationFn: async ({ characterId, subject, target, net }) =>
      rolled(await call(() => supabase.rpc('companion_roll_check', {
        p_token: token, p_character: characterId, p_subject: subjectKey(subject), p_target: target, p_net: net,
      }))),
    onError: (e) => onWriteError(qc, token, e),
  })
}

/** Free dice (damage…) rolled by the server, which tells the keeper's game screen. */
export function useRollDice(token: string) {
  const qc = useQueryClient()
  return useMutation<Roll, CompanionError, DiceRequest>({
    mutationFn: async ({ characterId, count, sides, modifier }) =>
      rolled(await call(() => supabase.rpc('companion_roll_dice', {
        p_token: token, p_character: characterId, p_count: count, p_sides: sides, p_modifier: modifier,
      }))),
    onError: (e) => onWriteError(qc, token, e),
  })
}

// ------------------------------------------------------------------ live

/** A phone's clock may run a little behind the server's: a payload stamped further ahead is not the server's. */
export const HINT_SKEW_MS = 2 * 60_000

/**
 * A `points` broadcast applied to the view, for display only, or null when it is to be ignored. The
 * topic is public, so nothing in the payload is trusted: values are clamped, the investigator is
 * marked `hinted` (taps then read the server instead of building on these values), and a payload
 * stamped later than now plus a small skew is dropped, or it would hide every real one after it.
 */
export function applyPointsHint(view: CompanionView, payload: unknown, now: number, taps?: Taps): CompanionView | null {
  if (!payload || typeof payload !== 'object') return null
  const row = asPointsRow(payload as Record<string, unknown>)
  if (!row) return null
  // Echoes of our own taps in flight would undo the taps made since: the refetch after the last one settles it.
  if (row.source === 'phone' && taps) return null
  const member = view.party.find((m) => m.id === row.characterId)
  if (!member) return null
  const stamp = Date.parse(row.updatedAt)
  if (!(stamp <= now + HINT_SKEW_MS)) return null
  const current = view.points.find((p) => p.characterId === row.characterId)
  if (current?.updatedAt && stamp < Date.parse(current.updatedAt)) return null
  // A keeper change arriving mid-taps keeps what the tapped fields show (it may predate them).
  const next = patchPoints(view, { ...row, ...clampPoints(row, member.data.hp ?? 10), ...taps?.shown })
  return next.hinted.includes(row.characterId) ? next : { ...next, hinted: [...next.hinted, row.characterId] }
}

/** What the channel's `points` handler does with a payload. */
export function receivePoints(qc: QueryClient, token: string, payload: unknown, now = Date.now()): void {
  const key = companionKeys.one(token)
  const view = qc.getQueryData<CompanionView>(key)
  if (!view || !payload || typeof payload !== 'object') return
  const taps = tapBook.get(tapKey(token, String((payload as { characterId?: unknown }).characterId)))
  const next = applyPointsHint(view, payload, now, taps)
  if (!next) return
  // Taps already queued were counted on older values: the next one reads the server first.
  if (taps) taps.unsure = true
  qc.setQueryData<CompanionView>(key, next)
}

/**
 * An `items` broadcast: the view with the item's new count when the hint carries one for a card this
 * phone knows (the server sends `{ characterId, itemId, uses, updatedAt }` when only the uses changed),
 * 'refetch' for anything else (a card given, taken, edited, or a hint it cannot place), null to ignore
 * it (older than what is shown, or `busy`: the echo of uses this phone is still sending). The topic is
 * public: the count is clamped to the card and only shown, uses are spent with a delta the server applies.
 */
export function applyItemHint(view: CompanionView, payload: unknown, now: number, busy: boolean): CompanionView | 'refetch' | null {
  if (!payload || typeof payload !== 'object') return 'refetch'
  const p = payload as Record<string, unknown>
  const item = typeof p.itemId === 'string' ? view.items.find((i) => i.id === p.itemId) : undefined
  if (!item || item.characterId !== p.characterId || item.uses === null) return 'refetch'
  if (typeof p.uses !== 'number' || !Number.isInteger(p.uses)) return 'refetch'
  const uses = clampUses(item.card, p.uses)
  const stamp = typeof p.updatedAt === 'string' ? Date.parse(p.updatedAt) : NaN
  if (uses === null || !(stamp <= now + HINT_SKEW_MS)) return 'refetch'
  if (busy) return null
  if (item.updatedAt && stamp < Date.parse(item.updatedAt)) return null
  return patchItem(view, item.id, uses, p.updatedAt as string)
}

/** What the channel's `items` handler does with a payload. */
export function receiveItems(qc: QueryClient, token: string, payload: unknown, now = Date.now()): void {
  const key = companionKeys.one(token)
  const view = qc.getQueryData<CompanionView>(key)
  const itemId = payload && typeof payload === 'object' ? (payload as { itemId?: unknown }).itemId : undefined
  const next = view ? applyItemHint(view, payload, now, typeof itemId === 'string' && itemTaps.has(itemKey(token, itemId))) : 'refetch'
  if (next === 'refetch') void qc.invalidateQueries({ queryKey: key })
  else if (next) qc.setQueryData<CompanionView>(key, next)
}

/**
 * Listens to the game's channel: `points` (keeper or phone) are shown at once but never written back
 * (`applyPointsHint`: anyone with a link can send on this public topic), a use spent on an item is
 * shown from its hint (`applyItemHint`), `notes`, `member`, `photo` and other `items` hints refetch. Returns true while subscribed (the "live" badge).
 * A revoke sends `rotate` on the old topic before moving the game: refetching gives a still-valid
 * link the new channel (this hook resubscribes) and a revoked one the invalid-link state.
 */
export function useCompanionLive(token: string, channel: string | undefined): boolean {
  const qc = useQueryClient()
  const [live, setLive] = useState(false)
  useEffect(() => {
    if (!channel) return
    const key = companionKeys.one(token)
    const ch = supabase
      .channel(`companion:${channel}`)
      .on('broadcast', { event: 'points' }, ({ payload }) => receivePoints(qc, token, payload))
      .on('broadcast', { event: 'notes' }, () => void qc.invalidateQueries({ queryKey: key }))
      .on('broadcast', { event: 'member' }, () => void qc.invalidateQueries({ queryKey: key }))
      .on('broadcast', { event: 'photo' }, () => void qc.invalidateQueries({ queryKey: key }))
      .on('broadcast', { event: 'items' }, ({ payload }) => receiveItems(qc, token, payload))
      .on('broadcast', { event: 'rotate' }, () => void qc.invalidateQueries({ queryKey: key }))
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
        // Changes made while we were not listening.
        if (status === 'SUBSCRIBED') void qc.invalidateQueries({ queryKey: key })
      })
    return () => {
      setLive(false)
      void supabase.removeChannel(ch)
    }
  }, [qc, token, channel])
  return live
}
