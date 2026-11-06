// Story creator: the keeper's answers → an original, playable private story.
//
// One function, three actions (they share auth, quotas, the cached system prompt and the brief):
//   - "ideas":   "Inspire me" fills the empty questionnaire fields (small call, effort low).
//   - "outline": writes (or rewrites) the story's outline: secret, acts, scenes, NPCs. Starts a new
//                creation (counted against the monthly limit) or revises the current one.
//   - "write":   writes the next few scenes of the outline in full (the same ImportDraft shape as
//                the AI import), merges them, converts with draftToStory, validates against the
//                spec and saves the private story + its story.json. The browser calls it until
//                `remaining` is 0. Scenes go a few at a time to stay within the wall-clock limit.
//
// Secrets: ANTHROPIC_API_KEY (required). Optional: STORY_CREATE_MONTHLY_LIMIT (default 10 new
// stories), STORY_OUTLINES_PER_STORY (default 5), STORY_SCENES_PER_CALL (default 2),
// STORY_IDEAS_MONTHLY_LIMIT (default 50).

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { Ajv2020 } from 'npm:ajv@8.20.0/dist/2020.js'
import { importDraftSchema, mergeDraft, type ImportDraft } from '../_shared/import-draft.ts'
import type { Database, Json } from '../_shared/database.types.ts'
import { createSystemPrompt, ideasUserPrompt, outlineUserPrompt, scenesUserPrompt } from '../_shared/create-prompt.ts'
import { SOUNDS, STORY_SCHEMA } from '../_shared/spec-bundle.ts'
import { forbiddenNamesIn } from '../_shared/story-mcp.ts'
import { existingStory, saveStory } from '../_shared/story-save.ts'
import {
  createdStory,
  IDEA_FIELDS,
  ideasSchema,
  nextBatch,
  onlyScenes,
  orderLikeOutline,
  outlineScenes,
  outlineSchema,
  outlineToDraft,
  parseBrief,
  parseOutline,
  pickIdeas,
  storyMetaId,
  writtenSceneIds,
  type IdeaField,
  type StoryBrief,
} from '../_shared/story-create.ts'

const MODEL = 'claude-opus-5-5'
const MONTHLY_LIMIT = Number(Deno.env.get('STORY_CREATE_MONTHLY_LIMIT') ?? 10)
const OUTLINES_PER_STORY = Number(Deno.env.get('STORY_OUTLINES_PER_STORY') ?? 5)
const SCENES_PER_CALL = Number(Deno.env.get('STORY_SCENES_PER_CALL') ?? 2)
const IDEAS_MONTHLY_LIMIT = Number(Deno.env.get('STORY_IDEAS_MONTHLY_LIMIT') ?? 50)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status)

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateStory = ajv.compile(STORY_SCHEMA)
const SYSTEM = [{ type: 'text' as const, text: createSystemPrompt(), cache_control: { type: 'ephemeral' as const } }]
const OUTLINE_FORMAT = { type: 'json_schema' as const, schema: outlineSchema() }
const IDEAS_FORMAT = { type: 'json_schema' as const, schema: ideasSchema() }
const SCENES_FORMAT = {
  type: 'json_schema' as const,
  schema: importDraftSchema({
    ambience: SOUNDS.ambience.filter((s) => s.status !== 'planned').map((s) => s.id),
    sfx: SOUNDS.sfx.filter((s) => s.status !== 'planned').map((s) => s.id),
  }),
}

type Admin = SupabaseClient<Database>
type CreationRow = Database['public']['Tables']['story_creations']['Row']

/** A failure to report as is (status, code, message), from anywhere below. */
class Failure extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
  }
}

const monthStart = () => {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/** One structured call to Claude: the parsed JSON and the usage. */
async function ask(
  apiKey: string,
  opts: { format: { type: 'json_schema'; schema: Record<string, unknown> }; effort: 'low' | 'medium'; text: string; maxTokens: number },
) {
  const client = new Anthropic({ apiKey })
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: opts.effort, format: opts.format },
    system: SYSTEM,
    messages: [{ role: 'user', content: opts.text }],
  })
  const message = await stream.finalMessage()
  const usage = {
    input: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0),
    output: message.usage.output_tokens,
  }
  if (message.stop_reason === 'refusal') throw new Failure(422, 'refused', 'Cette histoire ne peut pas être écrite. Change quelques réponses et réessaie.')
  if (message.stop_reason === 'max_tokens') throw new Failure(422, 'too_long', 'Réponse trop longue. Réessaie.')
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  try {
    return { output: JSON.parse(text) as unknown, usage }
  } catch {
    throw new Failure(502, 'invalid_output', 'Réponse de l’IA illisible. Réessaie.')
  }
}

async function isAdmin(admin: Admin, userId: string) {
  const { data } = await admin.from('profiles').select('is_admin').eq('id', userId).single()
  return !!data?.is_admin
}

async function loadCreation(admin: Admin, id: unknown, userId: string): Promise<CreationRow> {
  if (typeof id !== 'string') throw new Failure(400, 'bad_request', 'creationId is required.')
  const { data } = await admin.from('story_creations').select('*').eq('id', id).maybeSingle()
  if (!data || data.owner_id !== userId) throw new Failure(404, 'not_found', 'Création introuvable.')
  return data
}

// ------------------------------------------------------------------ actions

async function ideas(apiKey: string, admin: Admin, userId: string, body: Record<string, unknown>) {
  const brief = parseBrief(body.brief)
  if (typeof brief === 'string') throw new Failure(400, 'bad_request', brief)
  const field = body.field === undefined ? undefined : (body.field as IdeaField)
  if (field !== undefined && !IDEA_FIELDS.includes(field)) throw new Failure(400, 'bad_request', `field must be one of ${IDEA_FIELDS.join(', ')}.`)
  if (!(await isAdmin(admin, userId))) {
    const { count, error } = await admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('kind', 'story-ideas')
      .gte('created_at', monthStart())
    if (error) throw error
    if ((count ?? 0) >= IDEAS_MONTHLY_LIMIT) throw new Failure(429, 'quota_exceeded', `Limite mensuelle atteinte (${IDEAS_MONTHLY_LIMIT} suggestions).`)
  }
  const { output, usage } = await ask(apiKey, { format: IDEAS_FORMAT, effort: 'low', text: ideasUserPrompt(brief, field), maxTokens: 4000 })
  await admin.from('ai_usage').insert({ owner_id: userId, kind: 'story-ideas', input_tokens: usage.input, output_tokens: usage.output })
  return { ideas: pickIdeas(brief, (output ?? {}) as Record<string, unknown>, field) }
}

async function outline(apiKey: string, admin: Admin, userId: string, body: Record<string, unknown>) {
  let row: CreationRow | null = null
  let brief: StoryBrief | string
  if (body.creationId !== undefined) {
    row = await loadCreation(admin, body.creationId, userId)
    if (row.status !== 'outlined' && row.status !== 'failed') throw new Failure(409, 'already_writing', 'Les scènes sont déjà en cours d’écriture.')
    if (row.story_id) throw new Failure(409, 'already_writing', 'Les scènes sont déjà en cours d’écriture.')
    if (row.outline_count >= OUTLINES_PER_STORY) throw new Failure(429, 'too_many_outlines', `Pas plus de ${OUTLINES_PER_STORY} plans par histoire.`)
    // The keeper may have changed their answers between two outlines.
    brief = parseBrief(body.brief ?? row.brief)
  } else {
    brief = parseBrief(body.brief)
    if (!(await isAdmin(admin, userId))) {
      const { count, error } = await admin
        .from('story_creations')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .eq('source', 'web') // creations from the MCP connector have their own limit
        .gte('created_at', monthStart())
      if (error) throw error
      if ((count ?? 0) >= MONTHLY_LIMIT) throw new Failure(429, 'quota_exceeded', `Limite mensuelle atteinte (${MONTHLY_LIMIT} histoires créées).`)
    }
  }
  if (typeof brief === 'string') throw new Failure(400, 'bad_request', brief)

  // Revising: start from the keeper's edited outline when they send it, else the stored one.
  const previous = row?.outline ? parseOutline(body.outline ?? row.outline) : null
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1500) : ''
  const revise = previous && typeof previous !== 'string' ? { previous, notes } : undefined
  const { output, usage } = await ask(apiKey, { format: OUTLINE_FORMAT, effort: 'medium', text: outlineUserPrompt(brief, revise), maxTokens: 32000 })
  const parsed = parseOutline(output)
  if (typeof parsed === 'string') throw new Failure(502, 'invalid_output', 'Le plan reçu est incomplet. Réessaie.')

  const fields = {
    brief: brief as unknown as Json,
    outline: parsed as unknown as Json,
    status: 'outlined',
    error: null,
    updated_at: new Date().toISOString(),
  }
  if (row) {
    const { error } = await admin
      .from('story_creations')
      .update({
        ...fields,
        outline_count: row.outline_count + 1,
        input_tokens: row.input_tokens + usage.input,
        output_tokens: row.output_tokens + usage.output,
      })
      .eq('id', row.id)
    if (error) throw error
    return { creationId: row.id, outline: parsed, outlinesLeft: OUTLINES_PER_STORY - row.outline_count - 1 }
  }
  const { data, error } = await admin
    .from('story_creations')
    .insert({ ...fields, owner_id: userId, outline_count: 1, input_tokens: usage.input, output_tokens: usage.output })
    .select('id')
    .single()
  if (error) throw error
  return { creationId: data.id, outline: parsed, outlinesLeft: OUTLINES_PER_STORY - 1 }
}

async function write(apiKey: string, admin: Admin, userId: string, body: Record<string, unknown>) {
  const row = await loadCreation(admin, body.creationId, userId)
  const brief = parseBrief(row.brief)
  if (typeof brief === 'string') throw new Failure(500, 'internal', brief)

  // Before the first scene, the keeper's edits to the outline (titles, summaries, removed scenes).
  let outlineInput: unknown = row.outline
  if (body.outline !== undefined && !row.story_id) outlineInput = body.outline
  const outline = parseOutline(outlineInput)
  if (typeof outline === 'string') throw new Failure(409, 'no_outline', 'Écris d’abord le plan de l’histoire.')
  let draft: ImportDraft = row.story_id && row.draft ? (row.draft as unknown as ImportDraft) : outlineToDraft(outline, brief)

  const total = outlineScenes(outline).length
  const batch = nextBatch(outline, draft, SCENES_PER_CALL)
  if (!batch.length) return { creationId: row.id, storyId: row.story_id, written: total, total, remaining: 0, validationErrors: [] }

  await admin
    .from('story_creations')
    .update({ status: 'writing', outline: outline as unknown as Json, error: null, updated_at: new Date().toISOString() })
    .eq('id', row.id)

  let output: unknown
  let usage: { input: number; output: number }
  try {
    ;({ output, usage } = await ask(apiKey, { format: SCENES_FORMAT, effort: 'medium', text: scenesUserPrompt(brief, outline, draft, batch), maxTokens: 64000 }))
  } catch (e) {
    await admin.from('story_creations').update({ status: 'failed', error: e instanceof Failure ? e.code : 'ai_error' }).eq('id', row.id)
    throw e
  }
  const scenes = onlyScenes(output as ImportDraft, batch)
  const before = writtenSceneIds(draft).size
  draft = orderLikeOutline(mergeDraft(draft, scenes), outline)
  const written = writtenSceneIds(draft).size
  if (written === before) {
    await admin.from('story_creations').update({ status: 'failed', error: 'invalid_output' }).eq('id', row.id)
    throw new Failure(502, 'invalid_output', 'Les scènes demandées manquent dans la réponse de l’IA. Réessaie.')
  }

  // ---- convert, validate, save (story + pack story.json)
  const target = await existingStory(admin, row.story_id, storyMetaId(outline.title, row.id))
  const story = createdStory(draft, outline, brief, target.metaId)
  const valid = validateStory(story)
  const validationErrors = valid
    ? []
    : (validateStory.errors ?? []).slice(0, 50).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim())
  // The prompt forbids these names; here they're only reported, the keeper can fix them in the editor.
  const forbidden = forbiddenNamesIn(story)
  if (forbidden.length) validationErrors.push(`forbidden names: ${forbidden.join(', ')}`)
  const storyId = await saveStory(admin, userId, target.storyId, story)

  const remaining = total - written
  await admin
    .from('story_creations')
    .update({
      status: remaining ? 'writing' : 'succeeded',
      draft: draft as unknown as Json,
      story_id: storyId,
      input_tokens: row.input_tokens + usage.input,
      output_tokens: row.output_tokens + usage.output,
      updated_at: new Date().toISOString(),
      finished_at: remaining ? null : new Date().toISOString(),
    })
    .eq('id', row.id)

  return { creationId: row.id, storyId, written, total, remaining, validationErrors }
}

// ------------------------------------------------------------------ entry point

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.')

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return fail(503, 'not_configured', "L'aide IA n'est pas configurée sur ce serveur.")

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const asUser = createClient<Database>(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData, error: userError } = await asUser.auth.getUser()
  if (userError || !userData.user) return fail(401, 'unauthorized', 'Connecte-toi pour utiliser l’aide IA.')
  const userId = userData.user.id
  const admin = createClient<Database>(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let body: Record<string, unknown>
  try {
    const raw = await req.json()
    if (!raw || typeof raw !== 'object') throw new Error()
    body = raw as Record<string, unknown>
  } catch {
    return fail(400, 'bad_request', 'Body must be a JSON object.')
  }

  try {
    if (body.action === 'ideas') return json(await ideas(apiKey, admin, userId, body))
    if (body.action === 'outline') return json(await outline(apiKey, admin, userId, body))
    if (body.action === 'write') return json(await write(apiKey, admin, userId, body))
    return fail(400, 'bad_request', 'action must be one of ideas, outline, write.')
  } catch (e) {
    if (e instanceof Failure) return fail(e.status, e.code, e.message)
    console.error('create-story failed', e)
    if (e instanceof Anthropic.RateLimitError) return fail(429, 'busy', "Le service d'IA est occupé. Réessaie dans une minute.")
    if (e instanceof Anthropic.APIError) return fail(502, 'ai_error', `Erreur du service d'IA (${e.status ?? 'réseau'}).`)
    return fail(500, 'internal', 'Création impossible.')
  }
})
