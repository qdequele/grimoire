// The text-generation function the game engine's narrator expects (it used claude.ai's
// claude.use("sample")): same contract, backed by the narrate Edge Function.
//   sample(messages, { signal, onText }) → Promise<{ text }>
//   errors carry .code (the narrator's messages: sampling_disabled, rate_limited, refused,
//   session_expired, cancelled) and .text (what was written before the error).
import { supabase } from '@/lib/supabase'

export interface SampleMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SampleOptions {
  signal?: AbortSignal
  onText?: (update: { text: string }) => void
  cache?: boolean
}

class SampleError extends Error {
  readonly code: string
  readonly text: string
  constructor(code: string, message: string, text = '') {
    super(message)
    this.code = code
    this.text = text
  }
}

const URL_ = import.meta.env.VITE_SUPABASE_URL as string
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** HTTP error from the function → the narrator's error codes. */
function httpError(status: number, body: { error?: { code?: string; message?: string } }): SampleError {
  const message = body.error?.message ?? 'Réponse interrompue.'
  if (status === 401) return new SampleError('session_expired', message)
  if (status === 503) return new SampleError('sampling_disabled', message)
  if (body.error?.code === 'quota_exceeded') return new SampleError('quota', message, message)
  if (status === 429) return new SampleError('rate_limited', message)
  return new SampleError('error', message)
}

export async function sample(messages: SampleMessage[], opts: SampleOptions = {}): Promise<{ text: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new SampleError('session_expired', 'Not signed in.')

  let res: Response
  try {
    res = await fetch(`${URL_}/functions/v1/narrate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: opts.signal,
    })
  } catch {
    if (opts.signal?.aborted) throw new SampleError('cancelled', 'Cancelled.')
    throw new SampleError('error', 'Network error.')
  }
  if (!res.ok || !res.body) {
    throw httpError(res.status, (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } })
  }

  let text = ''
  let buffer = ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let cut: number
      while ((cut = buffer.indexOf('\n\n')) >= 0) {
        const line = buffer.slice(0, cut).trim()
        buffer = buffer.slice(cut + 2)
        if (!line.startsWith('data:')) continue
        const event = JSON.parse(line.slice(5)) as { text?: string; done?: boolean; error?: { code: string; message: string } }
        if (event.text) {
          text += event.text
          opts.onText?.({ text })
        }
        if (event.error) throw new SampleError(event.error.code, event.error.message, text)
      }
    }
  } catch (e) {
    if (e instanceof SampleError) throw e
    if (opts.signal?.aborted) throw new SampleError('cancelled', 'Cancelled.', text)
    throw new SampleError('error', 'Réponse interrompue.', text)
  }
  return { text }
}
