// The in-game narrator (legacy engine's "Narrateur" panel). The engine sends the conversation the way
// it sent it to claude.ai: a first user message holding its instructions, the rules summary and the
// current game context, then the chat turns. Pure TypeScript, unit-tested with Vitest.

export interface NarrateMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_MESSAGES = 30
const MAX_TOTAL_CHARS = 200_000
/** Where the engine's stable instructions end and the per-turn game context begins. */
export const CONTEXT_MARKER = '\n\nCONTEXTE ACTUEL DE LA PARTIE :\n'

/** Validate the conversation sent by the browser. Returns an error message or the messages. */
export function parseNarrateRequest(body: unknown): NarrateMessage[] | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.'
  const messages = (body as { messages?: unknown }).messages
  if (!Array.isArray(messages) || !messages.length) return 'messages must be a non-empty list.'
  if (messages.length > MAX_MESSAGES) return `At most ${MAX_MESSAGES} messages.`
  let total = 0
  for (const m of messages) {
    if (!m || typeof m !== 'object') return 'Each message must be an object.'
    const { role, content } = m as Record<string, unknown>
    if (role !== 'user' && role !== 'assistant') return 'role must be user or assistant.'
    if (typeof content !== 'string' || !content.trim()) return 'content must be non-empty text.'
    total += content.length
  }
  if (total > MAX_TOTAL_CHARS) return 'Conversation too long.'
  if ((messages[0] as NarrateMessage).role !== 'user') return 'The first message must come from the user.'
  return messages as NarrateMessage[]
}

export type ContentBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }

/**
 * The first message starts with the same instructions and rules on every turn: split it there so
 * that part is served from the prompt cache, and only the game context is new each time.
 */
export function toApiMessages(messages: NarrateMessage[]): Array<{ role: 'user' | 'assistant'; content: string | ContentBlock[] }> {
  return messages.map((m, i) => {
    if (i !== 0) return { role: m.role, content: m.content }
    const at = m.content.indexOf(CONTEXT_MARKER)
    if (at <= 0) return { role: m.role, content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] }
    return {
      role: m.role,
      content: [
        { type: 'text', text: m.content.slice(0, at), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: m.content.slice(at) },
      ],
    }
  })
}
