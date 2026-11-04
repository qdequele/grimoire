import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth'
import type { Json } from '@/lib/database.types'
import { supabase, type Tables } from '@/lib/supabase'
import type { CharacterData } from './character'

export type CharacterRow = Omit<Tables<'characters'>, 'data'> & { data: CharacterData }

export const characterKeys = {
  all: ['characters'] as const,
  mine: (userId: string | undefined) => [...characterKeys.all, 'mine', userId] as const,
  one: (id: string) => [...characterKeys.all, 'one', id] as const,
}

const asCharacter = (row: Tables<'characters'>): CharacterRow => ({ ...row, data: row.data as unknown as CharacterData })

export function useCharacters() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: characterKeys.mine(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select('*').order('name')
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
      const { data, error } = await supabase.from('characters').select('*').eq('id', id!).single()
      if (error) throw error
      return asCharacter(data)
    },
  })
}

export function useSaveCharacter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: CharacterData }) => {
      const payload = data as unknown as Json
      const { data: row, error } = id
        ? await supabase.from('characters').update({ data: payload }).eq('id', id).select('*').single()
        : await supabase.from('characters').insert({ data: payload }).select('*').single()
      if (error) throw error
      return asCharacter(row)
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
