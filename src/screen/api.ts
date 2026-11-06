// Server state of the ambiance screen: everything goes through the screen link's token (no account).
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseScreen, type ScreenState } from './state'

export interface ScreenView {
  /** Realtime topic is `screen:<channel>`; it changes when the link is revoked. */
  channel: string
  screen: ScreenState
}

/** `link_invalid` (revoked or unknown link) or `network`. */
export class ScreenError extends Error {
  code: 'link_invalid' | 'network'
  constructor(code: 'link_invalid' | 'network', message?: string) {
    super(message ?? code)
    this.name = 'ScreenError'
    this.code = code
  }
}

export const screenKeys = {
  one: (token: string) => ['screen', token] as const,
}

/** How often the screen checks in without any broadcast (TV asleep, network blip, revoked link). */
const REFRESH_MS = 60_000

export function useScreenView(token: string): UseQueryResult<ScreenView, ScreenError> {
  return useQuery<ScreenView, ScreenError>({
    queryKey: screenKeys.one(token),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('screen_open', { p_token: token })
      if (error) throw new ScreenError(error.message.trim() === 'link_invalid' ? 'link_invalid' : 'network', error.message)
      const o = (data ?? {}) as { channel?: unknown; screen?: unknown }
      if (typeof o.channel !== 'string') throw new ScreenError('network', 'empty response')
      return { channel: o.channel, screen: parseScreen(o.screen) }
    },
    retry: (count, e) => e.code !== 'link_invalid' && count < 3,
    refetchInterval: (q) => (q.state.error?.code === 'link_invalid' ? false : REFRESH_MS),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Keep showing the last picture through a network blip.
    staleTime: 0,
  })
}

/**
 * Listens to the screen's topic: every change the keeper makes arrives whole and replaces the cache.
 * Returns true while subscribed.
 */
export function useScreenLive(token: string, channel: string | undefined): boolean {
  const qc = useQueryClient()
  const [live, setLive] = useState(false)
  useEffect(() => {
    if (!channel) return
    const key = screenKeys.one(token)
    const ch = supabase
      .channel(`screen:${channel}`)
      .on('broadcast', { event: 'screen' }, ({ payload }) => {
        const view = qc.getQueryData<ScreenView>(key)
        if (view) qc.setQueryData<ScreenView>(key, { ...view, screen: parseScreen(payload) })
      })
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
        // What changed while we were not listening.
        if (status === 'SUBSCRIBED') void qc.invalidateQueries({ queryKey: key })
      })
    return () => {
      setLive(false)
      void supabase.removeChannel(ch)
    }
  }, [qc, token, channel])
  return live
}
