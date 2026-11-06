// Players' notebooks, as the keeper sees them: owner RLS, so the keeper reads, edits and deletes the
// notes written on phones about their own investigators.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth'
import { supabase, type Tables } from '@/lib/supabase'

export type NoteRow = Tables<'character_notes'>

/** Same bounds as the database (`character_notes_body_length`). */
export const MAX_NOTE = 2000

export const noteKeys = {
  all: ['character_notes'] as const,
  counts: (userId: string | undefined) => [...noteKeys.all, 'counts', userId] as const,
  character: (characterId: string) => [...noteKeys.all, 'character', characterId] as const,
}

/** One investigator's notebook, newest first. */
export function useNotes(characterId: string | undefined) {
  return useQuery({
    queryKey: noteKeys.character(characterId ?? ''),
    enabled: !!characterId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('character_notes')
        .select('*')
        .eq('character_id', characterId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Number of notes of each of the keeper's investigators, counted by the database in one query. */
export function useNoteCounts() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: noteKeys.counts(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('characters').select('id, character_notes(count)')
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data) counts[row.id] = row.character_notes[0]?.count ?? 0
      return counts
    },
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from('character_notes').update({ body: body.trim() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('character_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  })
}
