// Calls to the create-story Edge Function (supabase/functions/create-story) and the keeper's
// creations (story_creations, read-only for the browser).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth'
import { supabase } from '@/lib/supabase'
import { storyKeys } from '../api'
import type { Brief, IdeaField, Outline } from './brief'

export interface OutlineResult {
  creationId: string
  outline: Outline
  outlinesLeft: number
}

export interface WriteResult {
  creationId: string
  storyId: string | null
  written: number
  total: number
  remaining: number
  validationErrors: string[]
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('create-story', { body })
  if (error) throw error
  return data as T
}

export const creationKeys = {
  all: ['story-creations'] as const,
  month: (userId: string | undefined) => [...creationKeys.all, 'month', userId] as const,
  one: (id: string) => [...creationKeys.all, 'one', id] as const,
}

/** Stories started this month (the monthly limit counts these). */
export function useCreationsThisMonth() {
  const { session } = useAuth()
  return useQuery({
    queryKey: creationKeys.month(session?.user.id),
    enabled: !!session,
    queryFn: async () => {
      const start = new Date()
      start.setUTCDate(1)
      start.setUTCHours(0, 0, 0, 0)
      const { count, error } = await supabase
        .from('story_creations')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'web') // creations from ChatGPT or Claude (MCP connector) have their own limit
        .gte('created_at', start.toISOString())
      if (error) throw error
      return count ?? 0
    },
  })
}

/** A creation saved on the server: to resume after a reload. */
export function useCreation(id: string | null) {
  return useQuery({
    queryKey: creationKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_creations')
        .select('id, status, outline, outline_count, story_id')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data && { ...data, outline: data.outline as unknown as Outline | null }
    },
  })
}

export function useSuggestIdeas() {
  return useMutation({
    mutationFn: ({ brief, field }: { brief: Brief; field?: IdeaField }) =>
      call<{ ideas: Partial<Record<IdeaField, string>> }>({ action: 'ideas', brief, field }),
  })
}

export function useWriteOutline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { brief: Brief; creationId?: string; outline?: Outline; notes?: string }) =>
      call<OutlineResult>({ action: 'outline', ...args }),
    onSettled: () => qc.invalidateQueries({ queryKey: creationKeys.all }),
  })
}

/** The outline's second call: clues, NPCs present and next scenes, and the keeper's overview. */
export function useCompleteOutline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { creationId: string; outline?: Outline }) => call<OutlineResult>({ action: 'outline-details', ...args }),
    onSettled: () => qc.invalidateQueries({ queryKey: creationKeys.all }),
  })
}

/** One batch of scenes. The page calls it until nothing remains. */
export function useWriteScenes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { creationId: string; outline?: Outline }) => call<WriteResult>({ action: 'write', ...args }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: creationKeys.all })
      qc.invalidateQueries({ queryKey: storyKeys.all })
    },
  })
}
