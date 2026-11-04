import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useCharacters } from '@/characters/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { StoryForEngine } from '@/play/legacy/adapter'
import { engineGlobals, freshState, withAccountProgress } from '@/play/engineData'
import type { LegacyState } from '@/play/host'
import { gameKeys, useGame, type GameState } from './api'

const SAVE_DELAY = 800
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

/**
 * The game screen: the legacy engine, full screen, in its own page (play.html), fed with this
 * game's story, investigators and saved state. Every change is saved to the account.
 */
export function GamePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const game = useGame(id)
  const characters = useCharacters()
  const [ready, setReady] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    const g = game.data
    if (started.current || !g?.story || !characters.data) return
    started.current = true
    const story = g.story.content as unknown as StoryForEngine
    const storyId = story.meta.id
    const party = g.state.party
      .map((p) => characters.data!.find((c) => c.id === p.characterId))
      .filter((c): c is NonNullable<typeof c> => !!c)

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
    const flush = () => {
      if (!pending) return
      const legacy = pending
      pending = null
      saveProgress(legacy)
      const scen = (legacy.scen as Record<string, { scene?: string; done?: Record<string, boolean> }>)[storyId] ?? {}
      const state: GameState = {
        ...g.state,
        scene: scen.scene ?? g.state.scene,
        done: Object.entries(scen.done ?? {}).filter(([, v]) => v).map(([k]) => k),
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

    window.__grimoirePlay = {
      data: engineGlobals(story),
      loadState: (f) => {
        const members = party.map((c) => ({ id: c.id, data: c.data }))
        const saved = newest(g.state.legacy, g.id)
        return saved ? withAccountProgress(saved, members) : freshState(f, { storyId, party: members })
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
    }
    setReady(true)

    const onHide = () => {
      clearTimeout(timer)
      flush()
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      onHide()
      delete window.__grimoirePlay
    }
  }, [game.data, characters.data, navigate, qc])

  if (game.error) {
    return (
      <Alert variant="destructive" className="m-8 w-auto">
        <AlertDescription>Partie introuvable.</AlertDescription>
      </Alert>
    )
  }
  if (game.data && !game.data.story) {
    return (
      <Alert variant="destructive" className="m-8 w-auto">
        <AlertDescription>L'histoire de cette partie n'est plus disponible.</AlertDescription>
      </Alert>
    )
  }
  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  return <iframe src="/play.html" title="Partie" className="fixed inset-0 h-svh w-full border-0" />
}
