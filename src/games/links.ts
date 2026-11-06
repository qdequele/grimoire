import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Tables } from '@/lib/supabase'
import { gameKeys } from './api'

/** A link players open on their phone: the whole table (character_id null) or one investigator. */
export type TableLink = Tables<'table_links'>

export const linkKeys = {
  all: ['table_links'] as const,
  game: (gameId: string) => [...linkKeys.all, 'game', gameId] as const,
}

/** What players open (QR code or copied link). */
export const linkUrl = (token: string): string => `${location.origin}/t/${token}`

/** Active links of a game (not revoked). */
export function useGameLinks(gameId: string) {
  return useQuery({
    queryKey: linkKeys.game(gameId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('table_links')
        .select('*')
        .eq('game_id', gameId)
        .is('revoked_at', null)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useCreateLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ gameId, characterId }: { gameId: string; characterId?: string }) => {
      const { data, error } = await supabase
        .from('table_links')
        .insert({ game_id: gameId, character_id: characterId ?? null })
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, { gameId }) => qc.invalidateQueries({ queryKey: linkKeys.game(gameId) }),
  })
}

/** Revokes a link. The game moves to a new realtime channel, so the game is refetched too. */
export function useRevokeLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ linkId }: { linkId: string; gameId: string }) => {
      const { error } = await supabase.rpc('revoke_table_link', { p_link: linkId })
      if (error) throw error
    },
    onSuccess: (_d, { gameId }) => {
      qc.invalidateQueries({ queryKey: linkKeys.game(gameId) })
      qc.invalidateQueries({ queryKey: gameKeys.one(gameId) })
    },
  })
}
