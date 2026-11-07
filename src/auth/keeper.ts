import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth, useProfile } from './auth'
import { gravatarUrl } from './gravatar'

/**
 * What the keeper's round head shows: their name, their own photo (profiles.photo) and, when they
 * have none, their Gravatar's address (which may not exist: Avatar then shows the initials).
 */
export function useKeeperAvatar() {
  const { session } = useAuth()
  const profile = useProfile()
  const email = session?.user.email ?? ''
  const photo = profile.data?.photo ?? null
  const gravatar = useQuery({
    queryKey: ['gravatar', email],
    enabled: !!email && !photo,
    staleTime: Infinity,
    queryFn: () => gravatarUrl(email),
  })
  return {
    name: profile.data?.display_name || email,
    email,
    photo,
    url: photo ? null : (gravatar.data ?? null),
  }
}

/** Saves (or, with null, removes) the keeper's own photo. */
export function useSetKeeperPhoto() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user.id
  return useMutation({
    mutationFn: async (photo: string | null) => {
      const { error } = await supabase.from('profiles').update({ photo }).eq('id', userId!)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['profile', userId] }),
  })
}
