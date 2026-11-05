import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useCharacters, type CharacterRow } from '@/characters/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import type { Json } from '@/lib/database.types'
import { supabase, type Tables } from '@/lib/supabase'
import { addMissingMembers, applyPoints, diffPoints, partyIds, pointsFromState, type PointsRow } from '@/play/companion'
import type { StoryForEngine } from '@/play/legacy/adapter'
import { engineGlobals, freshState, toLegacyCharacter, withAccountProgress } from '@/play/engineData'
import type { EngineApi, LegacyState, NotebookEntry } from '@/play/host'
import { sample } from '@/play/narrator'
import { gameKeys, useGame, type GameRow, type GameState } from './api'
import { TableLinksDialog, type TableMember } from './TableLinksDialog'
import { useT } from '@/i18n/t'

const SAVE_DELAY = 800
/** How often to look for the engine API in the iframe until its script has run. */
const ENGINE_POLL = 100
const localKey = (gameId: string) => `grimoire-game-${gameId}`

/** The newest of the account copy and the browser copy (the browser one survives a closed tab). */
function newest(remote: LegacyState | undefined, gameId: string): LegacyState | undefined {
  try {
    const raw = localStorage.getItem(localKey(gameId))
    const local = raw ? (JSON.parse(raw) as LegacyState) : undefined
    if (local && (!remote || Number(local.savedAt ?? 0) > Number(remote.savedAt ?? 0))) return local
  } catch {
    /* ignore a corrupt local copy */
  }
  return remote
}

type Tracked = ReturnType<typeof pointsFromState>
type PointsDbRow = Tables<'game_points'>

const toPointsRow = (r: PointsDbRow): PointsRow => ({
  characterId: r.character_id,
  pv: r.pv ?? 0,
  san: r.san ?? 0,
  chance: r.chance ?? 0,
  pm: r.pm ?? 0,
  checks: r.checks,
  source: r.source === 'phone' ? 'phone' : 'keeper',
  updatedAt: r.updated_at,
})

/** A `points` broadcast (Realtime adds keys such as `id`: only the ones used are checked). */
function asPointsEvent(p: Record<string, unknown>): PointsRow | null {
  const n = (k: string) => typeof p[k] === 'number'
  if (typeof p.characterId !== 'string' || !n('pv') || !n('san') || !n('chance') || !n('pm')) return null
  return {
    characterId: p.characterId,
    pv: p.pv as number,
    san: p.san as number,
    chance: p.chance as number,
    pm: p.pm as number,
    checks: Array.isArray(p.checks) ? p.checks.filter((c): c is string => typeof c === 'string') : [],
    source: p.source === 'phone' ? 'phone' : 'keeper',
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
  }
}

async function fetchNotes(characterIds: string[]): Promise<Record<string, NotebookEntry[]>> {
  const out: Record<string, NotebookEntry[]> = Object.fromEntries(characterIds.map((id) => [id, []]))
  if (!characterIds.length) return out
  const { data, error } = await supabase
    .from('character_notes')
    .select('id, character_id, body, created_at')
    .in('character_id', characterIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  for (const n of data) (out[n.character_id] ??= []).push({ id: n.id, body: n.body, createdAt: n.created_at })
  return out
}

/** What the live channel needs from the running game (set once the game has started). */
interface Live {
  /** Runs `fn` with the engine API, now or as soon as the engine has started. */
  withEngine: (fn: (e: EngineApi) => void) => void
  onPoints: (row: PointsRow) => void
  onNotes: (characterId: string) => void
  onMember: (characterId: string) => void
  /** After (re)subscribing: catch up on what happened while not listening. */
  catchUp: () => void
}

/**
 * The game screen: the legacy engine, full screen, in its own page (play.html), fed with this
 * game's story, investigators and saved state. Every change is saved to the account; players'
 * phones change points, write notebooks and join the party live (player companion).
 */
export function GamePage() {
  const t = useT()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const game = useGame(id)
  const characters = useCharacters()
  const [ready, setReady] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const [members, setMembers] = useState<TableMember[]>([])
  const iframe = useRef<HTMLIFrameElement>(null)
  const live = useRef<Live | null>(null)

  // Start once, from fresh data: a cached game could miss investigators who joined from a phone.
  // Later refetches (after every save) don't restart the game: the data it started from is kept.
  const [start, setStart] = useState<{ game: GameRow; characters: CharacterRow[] } | null>(null)
  if (!start && game.data?.story && characters.data && !game.isFetching && !characters.isFetching) {
    setStart({ game: game.data, characters: characters.data })
  }

  useEffect(() => {
    if (!start?.game.story) return
    const { game: g, characters: all } = start
    let disposed = false
    const story = start.game.story.content as unknown as StoryForEngine
    const storyId = story.meta.id
    const party: CharacterRow[] = g.state.party
      .map((p) => all.find((c) => c.id === p.characterId))
      .filter((c): c is CharacterRow => !!c)
    const accountIds = new Set(party.map((c) => c.id))
    const toMember = (c: CharacterRow): TableMember => ({ id: c.id, name: c.data.name, player: c.player?.name ?? undefined })

    // Points last written to (or received from) game_points, per account investigator.
    let lastWritten: Tracked = new Map()
    // Newest game_points update seen per investigator, to catch up after (re)subscribing.
    const seen = new Map<string, string>()
    let notebooks: Record<string, NotebookEntry[]> = {}

    // The engine API appears in the iframe once its script has run: queue calls until then.
    const queue: Array<(e: EngineApi) => void> = []
    const engine = () => iframe.current?.contentWindow?.GRIMOIRE_ENGINE
    const withEngine = (fn: (e: EngineApi) => void) => {
      const e = engine()
      if (e && !queue.length) fn(e)
      else queue.push(fn)
    }
    const poll = setInterval(() => {
      const e = engine()
      if (!e) return
      clearInterval(poll)
      for (const fn of queue.splice(0)) fn(e)
    }, ENGINE_POLL)

    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: LegacyState | null = null
    // Last progression written per investigator, to only write what changed.
    const written = new Map(party.map((c) => [c.id, JSON.stringify(c.data.progress ?? null)]))
    const saveProgress = (legacy: LegacyState) => {
      const prog = (legacy.prog ?? {}) as Record<string, Record<string, unknown>>
      for (const c of party) {
        const { player: _p, owner: _o, ...progress } = prog[c.id] ?? {}
        const json = JSON.stringify(progress)
        if (written.get(c.id) === json) continue
        written.set(c.id, json)
        void supabase
          .from('characters')
          .update({ data: { ...c.data, progress } as unknown as Json })
          .eq('id', c.id)
          .then(({ error }) => error && console.error('Progress save failed', error))
      }
    }
    /** Account investigators' points in this state (in-game investigators have no game_points row). */
    const accountPoints = (legacy: LegacyState): Tracked => {
      const ids = new Set(partyIds(legacy, storyId, accountIds))
      return new Map([...pointsFromState(legacy, storyId)].filter(([cid]) => ids.has(cid)))
    }
    const savePoints = (legacy: LegacyState) => {
      const now = accountPoints(legacy)
      const changed = diffPoints(now, lastWritten)
      lastWritten = now
      if (!changed.length) return
      const at = new Date().toISOString()
      void supabase
        .from('game_points')
        .upsert(changed.map((p) => ({
          game_id: g.id, character_id: p.characterId, pv: p.pv, san: p.san, chance: p.chance, pm: p.pm,
          checks: p.checks, source: 'keeper', updated_at: at,
        })))
        .then(({ error }) => error && console.error('Points save failed', error))
    }
    const flush = () => {
      if (!pending) return
      const legacy = pending
      pending = null
      saveProgress(legacy)
      savePoints(legacy)
      const scen = (legacy.scen as Record<string, { scene?: string; done?: Record<string, boolean> }>)[storyId] ?? {}
      const state: GameState = {
        ...g.state,
        scene: scen.scene ?? g.state.scene,
        done: Object.entries(scen.done ?? {}).filter(([, v]) => v).map(([k]) => k),
        // The engine's party is the truth: investigators removed in the game leave, phone ones stay.
        party: partyIds(legacy, storyId, accountIds).map((characterId) => ({ characterId })),
        legacy,
      }
      void supabase
        .from('games')
        .update({ state: state as unknown as Json })
        .eq('id', g.id)
        .then(({ error }) => {
          if (error) console.error('Game save failed', error)
          else qc.invalidateQueries({ queryKey: gameKeys.all })
        })
    }

    const notePoints = (r: PointsRow) => {
      const before = seen.get(r.characterId)
      if (!before || Date.parse(r.updatedAt) > Date.parse(before)) seen.set(r.characterId, r.updatedAt)
    }
    /** Phone values into the engine, recorded as written so the next save doesn't send them back as the keeper's. */
    const applyPhone = (r: PointsRow) => {
      notePoints(r)
      withEngine((e) => {
        const v = { pv: r.pv, san: r.san, chance: r.chance, pm: r.pm }
        if (accountIds.has(r.characterId)) {
          lastWritten.set(r.characterId, { ...v, checks: lastWritten.get(r.characterId)?.checks ?? r.checks })
        }
        e.setPoints(r.characterId, v)
      })
    }
    const refreshNotes = (characterId: string) => {
      fetchNotes([characterId])
        .then((n) => {
          if (disposed) return
          notebooks = { ...notebooks, ...n }
          withEngine((e) => e.setNotebooks(notebooks))
        })
        .catch((error) => console.error('Notebook load failed', error))
    }
    const joining = new Set<string>()
    const addMember = async (characterId: string) => {
      if (accountIds.has(characterId) || joining.has(characterId)) return
      joining.add(characterId)
      try {
        const [c, p] = await Promise.all([
          supabase.from('characters').select('*, player:players(id, name)').eq('id', characterId).single(),
          supabase.from('game_points').select('*').eq('game_id', g.id).eq('character_id', characterId).maybeSingle(),
        ])
        if (c.error) throw c.error
        if (disposed || accountIds.has(characterId)) return
        const row = c.data as unknown as CharacterRow
        party.push(row)
        accountIds.add(characterId)
        written.set(row.id, JSON.stringify(row.data.progress ?? null))
        setMembers((m) => [...m, toMember(row)])
        withEngine((e) => e.addMember(toLegacyCharacter(row.id, row.data), row.player?.name ?? '', row.data.progress))
        if (p.data) applyPhone(toPointsRow(p.data))
        refreshNotes(characterId)
      } catch (error) {
        console.error('New investigator load failed', error)
      } finally {
        joining.delete(characterId)
      }
    }
    const catchUp = async () => {
      const [gs, ps] = await Promise.all([
        supabase.from('games').select('state').eq('id', g.id).single(),
        supabase.from('game_points').select('*').eq('game_id', g.id).eq('source', 'phone'),
      ])
      if (disposed) return
      const ids = ((gs.data?.state as unknown as GameState | undefined)?.party ?? []).map((m) => m.characterId)
      for (const cid of ids) if (!accountIds.has(cid)) void addMember(cid)
      for (const r of (ps.data ?? []).map(toPointsRow)) {
        const before = seen.get(r.characterId)
        if (accountIds.has(r.characterId) && (!before || Date.parse(r.updatedAt) > Date.parse(before))) applyPhone(r)
      }
    }

    const onHide = () => {
      clearTimeout(timer)
      flush()
    }

    void (async () => {
      const ids = party.map((c) => c.id)
      const [points, notes] = await Promise.all([
        supabase.from('game_points').select('*').eq('game_id', g.id),
        fetchNotes(ids).catch((error) => {
          console.error('Notebook load failed', error)
          return {}
        }),
      ])
      if (disposed) return
      if (points.error) console.error('Points load failed', points.error)
      const rows = (points.data ?? []).map(toPointsRow)
      rows.forEach(notePoints)
      notebooks = notes
      withEngine((e) => e.setNotebooks(notebooks))

      window.__grimoirePlay = {
        data: engineGlobals(story),
        loadState: (f) => {
          const list = party.map((c) => ({ id: c.id, data: c.data, player: c.player?.name }))
          const saved = newest(g.state.legacy, g.id)
          let S = saved ? withAccountProgress(saved, list) : freshState(f, { storyId, party: list })
          S = addMissingMembers(S, f, storyId, list)
          S = applyPoints(S, storyId, rows, Number(saved?.savedAt ?? 0))
          lastWritten = accountPoints(S)
          return S
        },
        save: (s) => {
          const copy = JSON.parse(JSON.stringify(s)) as LegacyState
          try {
            localStorage.setItem(localKey(g.id), JSON.stringify(copy))
          } catch {
            /* storage full or blocked: the account copy still goes through */
          }
          pending = copy
          clearTimeout(timer)
          timer = setTimeout(flush, SAVE_DELAY)
        },
        quit: () => {
          clearTimeout(timer)
          flush()
          navigate('/')
        },
        openTable: () => setTableOpen(true),
        sample,
      }
      live.current = {
        withEngine,
        onPoints: (r) => {
          if (r.source === 'phone') applyPhone(r)
          else notePoints(r)
        },
        onNotes: (cid) => accountIds.has(cid) && refreshNotes(cid),
        onMember: (cid) => void addMember(cid),
        catchUp: () => void catchUp().catch((error) => console.error('Catch-up failed', error)),
      }
      setMembers(party.map(toMember))
      window.addEventListener('pagehide', onHide)
      setReady(true)
    })()

    return () => {
      disposed = true
      clearInterval(poll)
      window.removeEventListener('pagehide', onHide)
      onHide()
      live.current = null
      delete window.__grimoirePlay
      setReady(false)
    }
  }, [start, navigate, qc])

  // Live changes from the players' phones. The channel changes when a link is revoked.
  const channel = game.data?.channel
  useEffect(() => {
    if (!ready || !channel) return
    const ch = supabase
      .channel(`companion:${channel}`)
      .on('broadcast', { event: 'points' }, ({ payload }) => {
        const r = asPointsEvent(payload as Record<string, unknown>)
        if (r) live.current?.onPoints(r)
      })
      .on('broadcast', { event: 'notes' }, ({ payload }) => {
        const cid = (payload as Record<string, unknown>).characterId
        if (typeof cid === 'string') live.current?.onNotes(cid)
      })
      .on('broadcast', { event: 'member' }, ({ payload }) => {
        const cid = (payload as Record<string, unknown>).characterId
        if (typeof cid === 'string') live.current?.onMember(cid)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') live.current?.catchUp()
      })
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [ready, channel])

  if (game.error) {
    return (
      <Alert variant="destructive" className="m-8 w-auto">
        <AlertDescription>{t('Partie introuvable.')}</AlertDescription>
      </Alert>
    )
  }
  if (game.data && !game.data.story) {
    return (
      <Alert variant="destructive" className="m-8 w-auto">
        <AlertDescription>{t("L'histoire de cette partie n'est plus disponible.")}</AlertDescription>
      </Alert>
    )
  }
  if (!ready || !id) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  return (
    <>
      <iframe ref={iframe} src="/play.html" title={t('Partie')} className="fixed inset-0 h-svh w-full border-0" />
      <TableLinksDialog gameId={id} party={members} open={tableOpen} onOpenChange={setTableOpen} />
    </>
  )
}
