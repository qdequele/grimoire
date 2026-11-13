import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { Lang } from '@/settings/lang'
import { characterKeys, type CharacterRow } from '../api'
import { portraitPhoto } from './portrait'
import { pregenData, type Pregen } from './pregens'

/**
 * Copies a pre-generated investigator into the keeper's account (an ordinary investigator from then
 * on: editable in the wizard, played, progressed), its texts in `lang`, with its portrait.
 */
export function useAddPregen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pregen, lang }: { pregen: Pregen; lang: Lang }) => {
      const photo = await portraitPhoto(pregen.id)
      const { data, error } = await supabase
        .from('characters')
        .insert({ data: pregenData(pregen, lang) as unknown as Json, photo, player_id: null })
        .select('*, player:players(id, name)')
        .single()
      if (error) throw error
      return data as unknown as CharacterRow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.all }),
  })
}
