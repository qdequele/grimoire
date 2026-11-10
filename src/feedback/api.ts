// Feedback the keeper sends from the app: one row in `feedback` (owner RLS for sending, admins read).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { Lang } from '@/settings/lang'
import type { FeedbackKind, STATUS_LABEL } from './kinds'

/** Same bounds as the database (`feedback_message_length`, `feedback_page_length`, `feedback_user_agent_length`). */
export const MAX_FEEDBACK = 4000
const MAX_META = 500

export interface FeedbackInput {
  kind: FeedbackKind
  message: string
  contactOk: boolean
  /** Where the keeper was: path + query, never the origin. */
  page: string
  lang: Lang
}

/** The row sent to the database, trimmed to its bounds. */
export function feedbackRow(input: FeedbackInput, userAgent: string) {
  return {
    kind: input.kind,
    message: input.message.trim(),
    contact_ok: input.contactOk,
    page: input.page.slice(0, MAX_META) || null,
    lang: input.lang,
    user_agent: userAgent.slice(0, MAX_META) || null,
  }
}

/** The trigger's daily cap (20 a day) answers with this message. */
export function isFeedbackLimit(error: unknown) {
  return error instanceof Error && error.message.includes('feedback_limit')
}

export function useSendFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: FeedbackInput) => {
      const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
      // No .select(): keepers can read their feedback, but nothing here needs it back.
      const { error } = await supabase.from('feedback').insert(feedbackRow(input, ua))
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: feedbackKeys.all }),
  })
}

// ---------------------------------------------------------------- admins' inbox

export const FEEDBACK_STATUSES = ['new', 'read', 'done'] as const satisfies readonly (keyof typeof STATUS_LABEL)[]
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export type InboxRow = Database['public']['Functions']['feedback_inbox']['Returns'][number]

export const feedbackKeys = {
  all: ['feedback'] as const,
  inbox: (status: FeedbackStatus | null, kind: FeedbackKind | null) => [...feedbackKeys.all, 'inbox', status, kind] as const,
  counts: () => [...feedbackKeys.all, 'counts'] as const,
}

/** Admins only (the function refuses anyone else): feedback, newest first, with its sender. */
export function useFeedbackInbox(status: FeedbackStatus | null, kind: FeedbackKind | null, enabled: boolean) {
  return useQuery({
    queryKey: feedbackKeys.inbox(status, kind),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('feedback_inbox', {
        ...(status ? { p_status: status } : {}),
        ...(kind ? { p_kind: kind } : {}),
        p_limit: 500,
      })
      if (error) throw new Error(error.message)
      return data
    },
  })
}

/** How many messages are in each status (admins read every row under RLS; head-only counts). */
export function useFeedbackCounts(enabled: boolean) {
  return useQuery({
    queryKey: feedbackKeys.counts(),
    enabled,
    queryFn: async () => {
      const counts = await Promise.all(
        FEEDBACK_STATUSES.map(async (s) => {
          const { count, error } = await supabase.from('feedback').select('id', { count: 'exact', head: true }).eq('status', s)
          if (error) throw new Error(error.message)
          return [s, count ?? 0] as const
        }),
      )
      return Object.fromEntries(counts) as Record<FeedbackStatus, number>
    },
  })
}

/** Moves a message through triage (admins may change the status only). */
export function useSetFeedbackStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FeedbackStatus }) => {
      const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: feedbackKeys.all }),
  })
}

/** A mailto: link answering the sender, when they agreed to it. */
export function replyLink(row: Pick<InboxRow, 'contact_ok' | 'email'>, subject: string) {
  if (!row.contact_ok || !row.email) return null
  return `mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(subject)}`
}
