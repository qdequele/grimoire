import { FunctionsHttpError } from '@supabase/supabase-js'

/** The human message an Edge Function returned ({ error: { message } }), or a generic one. */
export async function functionErrorMessage(e: unknown, fallback: string): Promise<string> {
  if (e instanceof FunctionsHttpError) {
    try {
      const body = (await e.context.json()) as { error?: { message?: string } }
      if (body.error?.message) return body.error.message
    } catch {
      /* not JSON */
    }
  }
  return e instanceof Error ? e.message : fallback
}
