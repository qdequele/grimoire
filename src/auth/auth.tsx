import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, type Tables } from '@/lib/supabase'
import { useLang } from '@/settings/lang'

interface AuthState {
  session: Session | null
  /** false until the stored session has been read, to avoid flashing the login page. */
  ready: boolean
}

const AuthContext = createContext<AuthState>({ session: null, ready: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, ready: false })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, ready: true }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, ready: true })
      // Accounts made with Google skip the sign-up form, which records the keeper's
      // language for the e-mails (supabase/templates read user_metadata.lang): record it now.
      // Deferred: Auth calls made inside this callback deadlock.
      if (session && !session.user.user_metadata?.lang)
        setTimeout(() => void supabase.auth.updateUser({ data: { lang: useLang.getState().lang } }))
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Tables<'profiles'>> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      if (error) throw error
      return data
    },
  })
}
