// "Describe a place → map": the create-story Edge Function's "map" action (Claude composes, the map
// kit checks). The app only: the public map maker has no AI.
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseMapDoc, type MapDoc, type MapKind } from './kit/model.ts'

export interface ComposeMapInput {
  description: string
  kind?: MapKind
  lang: 'fr' | 'en'
}

export interface ComposedMap {
  map: MapDoc
  /** What the map kit corrected or found wrong (English, for the curious: the map is usable). */
  problems: string[]
}

export function useComposeMap() {
  return useMutation({
    mutationFn: async (input: ComposeMapInput): Promise<ComposedMap> => {
      const { data, error } = await supabase.functions.invoke<{ map: unknown; problems?: string[] }>('create-story', { body: { action: 'map', ...input } })
      if (error) throw error
      // The server already checked it; read it again so a stale or odd answer can't break the editor.
      return { map: parseMapDoc(data?.map).doc, problems: data?.problems ?? [] }
    },
  })
}
