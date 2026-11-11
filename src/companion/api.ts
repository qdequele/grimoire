// Server state of the player companion: everything goes through the link token (no account).
import { useMutation, useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { CharacterData } from '@/characters/character'
import { photoOr } from '@/characters/photo'
import { currentT } from '@/i18n/t'
import { asHeld, sortHeld, type HeldItem } from '@/items/item'
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

export function useCompanion(token: string): UseQueryResult<CompanionView, CompanionError> {
  return useQuery<CompanionView, CompanionError>({
    queryKey: companionKeys.one(token),
    queryFn: async () => asView(await call(() => supabase.rpc('companion_open', { p_token: token }))),
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

/** The tapped field's value from the latest cache (keeper changes included), plus delta, clamped. */
function tappedValue(view: CompanionView | undefined, characterId: string, field: keyof Points, delta: number): number | null {
  const member = view?.party.find((m) => m.id === characterId)
  if (!member) return null
  const cur = pointsOf(view, member)
  const base: Points = { pv: cur.pv, san: cur.san, chance: cur.chance, pm: cur.pm }
  return clampPoints({ ...base, [field]: base[field] + delta }, member.data.hp ?? 10)[field]
}

function patchField(view: CompanionView, characterId: string, field: keyof Points, value: number): CompanionView {
  const member = view.party.find((m) => m.id === characterId)
  if (!member) return view
  const cur = pointsOf(view, member)
  // Server time comes with the refetch: keep the last known one so keeper changes still compare.
  return patchPoints(view, { ...cur, [field]: value, source: 'phone' })
}

/** Points writes of this link still running for one investigator. */
const pointsInFlight = (qc: QueryClient, token: string, characterId: string): number =>
  qc.isMutating({
    mutationKey: pointsMutationKey(token),
    predicate: (m) => (m.state.variables as PointTap | undefined)?.characterId === characterId,
  })

/** Fields with a tap still running for one investigator. */
const tappedFields = (qc: QueryClient, token: string, characterId: string): Set<keyof Points> =>
  new Set(
    qc.getMutationCache()
      .findAll({ mutationKey: pointsMutationKey(token), status: 'pending' })
      .map((m) => m.state.variables as PointTap | undefined)
      .filter((v): v is PointTap => v?.characterId === characterId)
      .map((v) => v.field),
  )

/**
 * One tap on an investigator's HP / SAN / Luck / MP. The cache changes at once (only that field),
 * rolled back with a toast if the server refuses. Taps are queued per investigator; each sends only
 * its field, with the cache's value when it runs, so a keeper change to another field is never undone.
 */
export function useSetPoints(token: string) {
  const qc = useQueryClient()
  const key = companionKeys.one(token)
  return useMutation<void, CompanionError, PointTap, { before: number | null }>({
    mutationKey: pointsMutationKey(token),
    mutationFn: ({ characterId, field }) =>
      enqueue(`${token}:${characterId}`, async () => {
        // The optimistic value (this tap and the ones before it), on top of what the keeper set since.
        const value = tappedValue(qc.getQueryData<CompanionView>(key), characterId, field, 0)
        if (value === null) throw new CompanionError('not_in_game')
        await call(() => supabase.rpc('companion_set_point', { p_token: token, p_character: characterId, p_field: field, p_value: value }))
      }),
    onMutate: async ({ characterId, field, delta }) => {
      await qc.cancelQueries({ queryKey: key })
      const view = qc.getQueryData<CompanionView>(key)
      const member = view?.party.find((m) => m.id === characterId)
      const before = view && member ? pointsOf(view, member)[field] : null
      const next = tappedValue(view, characterId, field, delta)
      if (view && next !== null) qc.setQueryData<CompanionView>(key, patchField(view, characterId, field, next))
      return { before }
    },
    onError: (e, { characterId, field }, ctx) => {
      const view = qc.getQueryData<CompanionView>(key)
      if (view && ctx?.before != null) qc.setQueryData<CompanionView>(key, patchField(view, characterId, field, ctx.before))
      onWriteError(qc, token, e)
    },
    onSettled: (_d, _e, { characterId }) => {
      // Once this investigator's last tap is through, fetch the server's values (this one still counts as running).
      if (pointsInFlight(qc, token, characterId) <= 1) void qc.invalidateQueries({ queryKey: key })
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

function patchItem(view: CompanionView, id: string, uses: number): CompanionView {
  return { ...view, items: view.items.map((i) => (i.id === id ? { ...i, uses } : i)) }
}

/** A use spent (−1) or regained (+1). The card changes at once; the server's count wins. */
export function useUseItem(token: string) {
  const qc = useQueryClient()
  const key = companionKeys.one(token)
  return useMutation<number, CompanionError, { item: HeldItem; delta: number }, { before: number | null }>({
    mutationFn: ({ item, delta }) =>
      enqueue(`${token}:item:${item.id}`, () => call(() => supabase.rpc('companion_use_item', { p_token: token, p_item: item.id, p_delta: delta }))),
    onMutate: async ({ item, delta }) => {
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
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
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

/**
 * Listens to the game's channel: `points` (keeper or phone) go straight into the cache, clamped to
 * what the server accepts (anyone with a link can send on this public topic; writes are re-checked
 * by the RPCs), `notes`, `member`, `photo` and `items` refetch. Returns true while subscribed (the "live" badge).
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
      .on('broadcast', { event: 'points' }, ({ payload }) => {
        const row = asPointsRow((payload ?? {}) as Record<string, unknown>)
        if (!row) return
        // Echoes of our own taps in flight would undo the taps made since: the refetch after the last one settles it.
        if (row.source === 'phone' && pointsInFlight(qc, token, row.characterId) > 0) return
        const view = qc.getQueryData<CompanionView>(key)
        if (!view || !view.party.some((m) => m.id === row.characterId)) return
        const current = view.points.find((p) => p.characterId === row.characterId)
        if (current?.updatedAt && row.updatedAt && Date.parse(row.updatedAt) < Date.parse(current.updatedAt)) return
        // A keeper change arriving mid-taps keeps the tapped fields' pending values (it may predate them).
        const member = view.party.find((m) => m.id === row.characterId)!
        const mine = pointsOf(view, member)
        const merged = { ...row, ...clampPoints(row, member.data.hp ?? 10) }
        for (const f of tappedFields(qc, token, row.characterId)) merged[f] = mine[f]
        qc.setQueryData<CompanionView>(key, patchPoints(view, merged))
      })
      .on('broadcast', { event: 'notes' }, () => void qc.invalidateQueries({ queryKey: key }))
      .on('broadcast', { event: 'member' }, () => void qc.invalidateQueries({ queryKey: key }))
      .on('broadcast', { event: 'photo' }, () => void qc.invalidateQueries({ queryKey: key }))
      .on('broadcast', { event: 'items' }, () => void qc.invalidateQueries({ queryKey: key }))
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
