import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth'
import type { Json } from '@/lib/database.types'
import { supabase, type Tables } from '@/lib/supabase'
import type { LegacyState } from '@/play/host'
import type { StoryContent } from '@/stories/api'

/** Saved game state: ids only, never story text (STORY_FORMAT §9), so stories can be edited between sessions. */
export interface GameState {
  scene: string
  done: string[]
  party: Array<{ characterId: string }>
  /** The game engine's own state (legacy engine), saved as is. */
  legacy?: LegacyState
  /** Server time (ms) of the last save_game_state: phone points written after it are newer than `legacy`. */
  serverSavedAt?: number
}

export type GameRow = Omit<Tables<'games'>, 'state'> & {
  state: GameState
  story: { id: string; content: StoryContent } | null
}

export const gameKeys = {
  all: ['games'] as const,
  mine: (userId: string | undefined) => [...gameKeys.all, 'mine', userId] as const,
  one: (id: string) => [...gameKeys.all, 'one', id] as const,
}

const SELECT = '*, story:stories(id, content)'
const asGame = (row: unknown) => row as GameRow

export function useMyGames() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: gameKeys.mine(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select(SELECT)
        .is('finished_at', null)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data.map(asGame)
    },
  })
}

export function useGame(id: string | undefined) {
  return useQuery({
    queryKey: gameKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('games').select(SELECT).eq('id', id!).single()
      if (error) throw error
      return asGame(data)
    },
  })
}

export function useStartGame() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ story, characterIds }: { story: { id: string; content: StoryContent }; characterIds: string[] }) => {
      const firstScene = story.content.acts[0]?.scenes[0]?.id
      if (!firstScene) throw new Error('Cette histoire n’a encore aucune scène.')
      const state: GameState = { scene: firstScene, done: [], party: characterIds.map((characterId) => ({ characterId })) }
      const { data, error } = await supabase
        .from('games')
        .insert({ story_id: story.id, state: state as unknown as Json })
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: gameKeys.all }),
  })
}

export function useUpdateGameState() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, state }: { id: string; state: GameState }) => {
      const { error } = await supabase.from('games').update({ state: state as unknown as Json }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: gameKeys.one(id) })
      qc.invalidateQueries({ queryKey: gameKeys.all })
    },
  })
}
