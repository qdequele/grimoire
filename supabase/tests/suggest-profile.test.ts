// suggest-profile Edge Function against the local stack, with a fake Claude API on ANTHROPIC_BASE_URL.
// Run with `pnpm test:import` (needs `supabase functions serve --env-file supabase/tests/functions.env`).
import { createServer, type Server } from 'node:http'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/lib/database.types'

const url = process.env.SUPABASE_URL!
const anonKey = process.env.SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const MOCK_PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010)

const PROFILE = {
  description: 'Grande, imperméable usé, carnet à la main',
  ideology: 'Ceci ne doit PAS remplacer le texte du gardien',
  significantPeople: 'Son frère, Tom, docker à Boston',
  meaningfulLocations: 'La salle de rédaction du Globe',
  treasuredPossessions: 'Un Kodak Brownie offert par son père',
  traits: 'Têtue, curieuse',
}
const requests: Array<Record<string, unknown>> = []

let mock: Server
let user: SupabaseClient<Database>
let userId: string
const service = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })

beforeAll(async () => {
  mock = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      requests.push(JSON.parse(raw || '{}'))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify(PROFILE) }],
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 600, output_tokens: 120 },
      }))
    })
  })
  await new Promise<void>((r) => mock.listen(MOCK_PORT, '0.0.0.0', r))
  user = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await user.auth.signUp({ email: `profile-${crypto.randomUUID()}@example.com`, password: 'correct-horse-battery' })
  if (error) throw error
  userId = data.user!.id
})

afterAll(() => new Promise<void>((r) => mock.close(() => r())))

async function invoke(client: SupabaseClient<Database>, body: Record<string, unknown>) {
  const { data, error } = await client.functions.invoke('suggest-profile', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    return { status: ctx?.status ?? 0, body: ctx ? await ctx.json() : null }
  }
  return { status: 200, body: data }
}

const investigator = {
  name: 'Ada Lark', occupation: 'Journaliste', age: 31, link: 'Ancienne étudiante',
  characteristics: { APP: 80, POW: 40 }, skills: ['Bibliothèque 70'],
}

describe('suggest-profile', () => {
  it('fills the empty fields and never touches what the keeper wrote', async () => {
    const res = await invoke(user, { ...investigator, profile: { ideology: 'La vérité finit par sortir' } })
    expect(res.status).toBe(200)
    expect(res.body.suggestions).not.toHaveProperty('ideology')
    expect(res.body.suggestions).toMatchObject({ significantPeople: PROFILE.significantPeople })
    expect(Object.keys(res.body.suggestions)).toHaveLength(5)

    const sent = requests.at(-1)!
    expect(sent.model).toBe('claude-opus-5-5')
    expect((sent.output_config as { format: { type: string } }).format.type).toBe('json_schema')
    expect(sent.fallbacks).toBe('default')
    expect(JSON.stringify(sent.messages)).toContain('Journaliste')

    const { data } = await service.from('ai_usage').select('kind, input_tokens').eq('owner_id', userId)
    expect(data).toEqual([{ kind: 'profile', input_tokens: 600 }])
  })

  it('returns only the field asked for with ↻', async () => {
    const res = await invoke(user, { ...investigator, profile: {}, field: 'traits' })
    expect(res.body.suggestions).toEqual({ traits: PROFILE.traits })
  })

  it('rejects requests without a session', async () => {
    const anon = createClient<Database>(url, anonKey, { auth: { persistSession: false } })
    expect((await invoke(anon, investigator)).status).toBe(401)
  })

  it('enforces the monthly limit', async () => {
    await service.from('ai_usage').insert(Array.from({ length: 50 }, () => ({ owner_id: userId, kind: 'profile' })))
    const res = await invoke(user, investigator)
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('quota_exceeded')
  })
})
