import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth'
import type { Json } from '@/lib/database.types'
import { supabase, type Tables } from '@/lib/supabase'
import type { CharacterData } from './character'

/** An investigator, with the player who plays them (players have no account, just a name). */
export type CharacterRow = Omit<Tables<'characters'>, 'data'> & {
  data: CharacterData
  player: { id: string; name: string } | null
}
export type PlayerRow = Tables<'players'>

export const characterKeys = {
  all: ['characters'] as const,
  mine: (userId: string | undefined) => [...characterKeys.all, 'mine', userId] as const,
  one: (id: string) => [...characterKeys.all, 'one', id] as const,
}
export const playerKeys = {
  all: ['players'] as const,
  mine: (userId: string | undefined) => [...playerKeys.all, 'mine', userId] as const,
}

const SELECT = '*, player:players(id, name)'
const asCharacter = (row: unknown): CharacterRow => row as CharacterRow

export function useCharacters() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: characterKeys.mine(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select(SELECT).order('name')
      if (error) throw error
      return data.map(asCharacter)
    },
  })
}

export function useCharacter(id: string | undefined) {
  return useQuery({
    queryKey: characterKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select(SELECT).eq('id', id!).single()
      if (error) throw error
      return asCharacter(data)
    },
  })
}

export function useSaveCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data, playerId }: { id?: string; data: CharacterData; playerId: string | null }) => {
      const payload = { data: data as unknown as Json, player_id: playerId }
      const { data: row, error } = id
        ? await supabase.from('characters').update(payload).eq('id', id).select(SELECT).single()
        : await supabase.from('characters').insert(payload).select(SELECT).single()
      if (error) throw error
      return asCharacter(row)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.all })
      qc.invalidateQueries({ queryKey: playerKeys.all })
    },
  })
}

/** Give an investigator to a player, or to nobody (null). */
export function useAssignPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ characterId, playerId }: { characterId: string; playerId: string | null }) => {
      const { error } = await supabase.from('characters').update({ player_id: playerId }).eq('id', characterId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.all }),
  })
}

export function useDeleteCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('characters').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.all }),
  })
}

// ------------------------------------------------------------------ players

export function usePlayers() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: playerKeys.mine(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('players').select('*').order('name')
      if (error) throw error
      return data
    },
  })
}

const nameTaken = (e: { code?: string }) =>
  e.code === '23505' ? new Error('Tu as déjà un joueur avec ce prénom.') : (e as Error)

export function useAddPlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('players').insert({ name: name.trim() }).select('*').single()
      if (error) throw nameTaken(error)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: playerKeys.all }),
  })
}

export function useRenamePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('players').update({ name: name.trim() }).eq('id', id)
      if (error) throw nameTaken(error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: playerKeys.all })
      qc.invalidateQueries({ queryKey: characterKeys.all })
    },
  })
}

/** Remove a player. Their investigators stay, "without player". */
export function useDeletePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('players').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: playerKeys.all })
      qc.invalidateQueries({ queryKey: characterKeys.all })
    },
  })
}
