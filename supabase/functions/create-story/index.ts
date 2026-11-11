// Story creator: the keeper's answers → an original, playable private story.
//
// One function, four actions (they share auth, quotas, the cached system prompt and the brief):
//   - "ideas":           "Inspire me" fills the empty questionnaire fields (Haiku, effort low).
//   - "outline":         writes (or rewrites) the outline's frame: title, secret, scenes, NPCs.
//                        Starts a new creation (counted against the monthly limit) or revises the
//                        current one.
//   - "outline-details": completes the frame: each scene's clues, NPCs and next scenes, and the
//                        keeper's overview. The browser calls it right after "outline".
//   - "write":           writes the next scene of the outline in full (the same ImportDraft shape
//                        as the AI import), merges it, converts with draftToStory, validates against
//                        the spec and saves the private story + its story.json. The browser calls
//                        it until `remaining` is 0.
//   - "map":             composes a map (floor plan, crypt, village) from the keeper's description,
//                        as a MapDoc the app's map editor opens (map kit in _shared/maps/). Counted in
//                        ai_usage (kind "map"), MAP_MONTHLY_LIMIT a month.
//   - "scene-map":       once every scene is written, draws the map of the next scene that asked for
//                        one (draft mapKind, at most STORY_MAPS_PER_STORY): the players' and the
//                        keeper's copies as SVG in the pack, two handouts of that scene. The browser
//                        calls it until `remaining` is 0. Part of the creation, not the map quota.
//
// Every call must end before the Edge Function's wall-clock limit (150 s): that is why the outline
// takes two calls, scenes go one at a time, the writing is done by Sonnet, and each Claude call is
// cut at AI_DEADLINE_MS with a clean "try again" instead of the function being killed.
//
// Secrets: ANTHROPIC_API_KEY (required). Optional: STORY_CREATE_MONTHLY_LIMIT (default 10 new
// stories), STORY_OUTLINES_PER_STORY (default 5), STORY_SCENES_PER_CALL (default 1),
// STORY_IDEAS_MONTHLY_LIMIT (default 50), MAP_MONTHLY_LIMIT (default 30), AI_DEADLINE_MS (default 130000, from the request's start).

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { Ajv2020 } from 'npm:ajv@8.20.0/dist/2020.js'
import { mergeDraft, normalizeDraft, parseJsonAnswer, type ImportDraft } from '../_shared/import-draft.ts'
import type { Database, Json } from '../_shared/database.types.ts'
import { createSystemPrompt, ideasUserPrompt, outlineDetailsPrompt, outlineUserPrompt, scenesUserPrompt } from '../_shared/create-prompt.ts'
import { STORY_SCHEMA } from '../_shared/spec-bundle.ts'
import { forbiddenNamesIn } from '../_shared/story-mcp.ts'
import { existingStory, savePackFile, saveStory } from '../_shared/story-save.ts'
import { mapFiles, sceneMapRequest, scenesWithoutMap, withSceneMap } from '../_shared/story-maps.ts'
import { renderMap } from '../_shared/maps/render.ts'
import { sanitizeSvg } from '../_shared/svg-safe.ts'
import { mapSchema, mapSystemPrompt, mapUserPrompt, parseMapRequest, type MapRequest } from '../_shared/map-prompt.ts'
import { mapProblems, parseMapDoc } from '../_shared/maps/model.ts'
import {
  createdStory,
  frameToOutline,
  IDEA_FIELDS,
  ideasSchema,
  nextBatch,
  onlyScenes,
  orderLikeOutline,
  outlineDetailsSchema,
  outlineFrameSchema,
  outlineScenes,
  outlineToDraft,
  parseBrief,
  parseOutline,
  pickIdeas,
  storyMetaId,
  withDetails,
  writtenSceneIds,
  type IdeaField,
  type StoryBrief,
} from '../_shared/story-create.ts'

/** Haiku for the quick suggestions, Sonnet for the outline and the scenes (fast enough for the time limit). */
const IDEAS_MODEL = 'claude-haiku-5-5'
const WRITER_MODEL = 'claude-sonnet-5-5'
const MONTHLY_LIMIT = Number(Deno.env.get('STORY_CREATE_MONTHLY_LIMIT') ?? 10)
const OUTLINES_PER_STORY = Number(Deno.env.get('STORY_OUTLINES_PER_STORY') ?? 5)
const SCENES_PER_CALL = Number(Deno.env.get('STORY_SCENES_PER_CALL') ?? 1)
const IDEAS_MONTHLY_LIMIT = Number(Deno.env.get('STORY_IDEAS_MONTHLY_LIMIT') ?? 50)
const MAP_MONTHLY_LIMIT = Number(Deno.env.get('MAP_MONTHLY_LIMIT') ?? 30)
/** Claude must have answered this long after the request started (the function is killed at 150 s). */
const AI_DEADLINE_MS = Number(Deno.env.get('AI_DEADLINE_MS') ?? 130_000)

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
const FRAME_FORMAT = { type: 'json_schema' as const, schema: outlineFrameSchema() }
const DETAILS_FORMAT = { type: 'json_schema' as const, schema: outlineDetailsSchema() }
const IDEAS_FORMAT = { type: 'json_schema' as const, schema: ideasSchema() }
const MAP_SYSTEM = [{ type: 'text' as const, text: mapSystemPrompt(), cache_control: { type: 'ephemeral' as const } }]
const MAP_FORMAT = { type: 'json_schema' as const, schema: mapSchema() }
// The scenes have no structured output: the draft schema's grammar is too large for the API. The
// prompt carries the schema as text and normalizeDraft() coerces the answer (see import-draft.ts).

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

/**
 * One call to Claude: the JSON it answered and the usage. With a format, a structured output; without,
 * plain JSON read with parseJsonAnswer. Cut at `deadline` (epoch ms) so the function can still answer.
 */
async function ask(
  apiKey: string,
  deadline: number,
  opts: {
    model: typeof IDEAS_MODEL | typeof WRITER_MODEL
    format?: { type: 'json_schema'; schema: Record<string, unknown> }
    effort: 'low' | 'medium'
    text: string
    maxTokens: number
    /** The story creator's system prompt unless told otherwise (maps have their own). */
    system?: typeof SYSTEM
  },
) {
  const left = deadline - Date.now()
  if (left < 10_000) throw new Failure(504, 'timeout', 'L’IA a mis trop de temps à répondre. Réessaie.')
  const client = new Anthropic({ apiKey })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), left)
  const started = Date.now()
  let message: Anthropic.Beta.BetaMessage
  try {
    const stream = client.beta.messages.stream(
      {
        model: opts.model,
        max_tokens: opts.maxTokens,
        // Server-side fallbacks on refusals: Sonnet has them, Haiku doesn't.
        ...(opts.model === WRITER_MODEL ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        output_config: { effort: opts.effort, ...(opts.format ? { format: opts.format } : {}) },
        system: opts.system ?? SYSTEM,
        messages: [{ role: 'user', content: opts.text }],
      },
      { signal: controller.signal },
    )
    message = await stream.finalMessage()
  } catch (e) {
    if (controller.signal.aborted) {
      console.warn(JSON.stringify({ fn: 'create-story', model: opts.model, timeout: true, ms: Date.now() - started }))
      throw new Failure(504, 'timeout', 'L’IA a mis trop de temps à répondre. Réessaie.')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
  const usage = {
    input: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0),
    output: message.usage.output_tokens,
  }
  // Durations, to tune models, effort and batch sizes against the time limit.
  console.log(JSON.stringify({ fn: 'create-story', model: message.model, ms: Date.now() - started, ...usage, stop: message.stop_reason }))
  if (message.stop_reason === 'refusal') throw new Failure(422, 'refused', 'Cette histoire ne peut pas être écrite. Change quelques réponses et réessaie.')
  if (message.stop_reason === 'max_tokens') throw new Failure(422, 'too_long', 'Réponse trop longue. Réessaie.')
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  const output = opts.format ? tryParse(text) : parseJsonAnswer(text)
  if (output === null || typeof output !== 'object') throw new Failure(502, 'invalid_output', 'Réponse de l’IA illisible. Réessaie.')
  return { output, usage }
}

const tryParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
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

async function ideas(apiKey: string, deadline: number, admin: Admin, userId: string, body: Record<string, unknown>) {
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
  const { output, usage } = await ask(apiKey, deadline, { model: IDEAS_MODEL, format: IDEAS_FORMAT, effort: 'low', text: ideasUserPrompt(brief, field), maxTokens: 4000 })
  await admin.from('ai_usage').insert({ owner_id: userId, kind: 'story-ideas', input_tokens: usage.input, output_tokens: usage.output })
  return { ideas: pickIdeas(brief, (output ?? {}) as Record<string, unknown>, field) }
}

async function outline(apiKey: string, deadline: number, admin: Admin, userId: string, body: Record<string, unknown>) {
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
  const { output, usage } = await ask(apiKey, deadline, { model: WRITER_MODEL, format: FRAME_FORMAT, effort: 'medium', text: outlineUserPrompt(brief, revise), maxTokens: 32000 })
  const parsed = frameToOutline(output)
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

/** The outline's second half: clues, NPCs present and next scenes for each scene, and the overview. */
async function outlineDetails(apiKey: string, deadline: number, admin: Admin, userId: string, body: Record<string, unknown>) {
  const row = await loadCreation(admin, body.creationId, userId)
  if ((row.status !== 'outlined' && row.status !== 'failed') || row.story_id) throw new Failure(409, 'already_writing', 'Les scènes sont déjà en cours d’écriture.')
  const brief = parseBrief(row.brief)
  if (typeof brief === 'string') throw new Failure(500, 'internal', brief)
  const frame = parseOutline(body.outline ?? row.outline)
  if (typeof frame === 'string') throw new Failure(409, 'no_outline', 'Écris d’abord le plan de l’histoire.')

  const { output, usage } = await ask(apiKey, deadline, { model: WRITER_MODEL, format: DETAILS_FORMAT, effort: 'medium', text: outlineDetailsPrompt(brief, frame), maxTokens: 32000 })
  const full = withDetails(frame, output)
  if (typeof full === 'string') throw new Failure(502, 'invalid_output', 'Le plan reçu est incomplet. Réessaie.')
  const { error } = await admin
    .from('story_creations')
    .update({
      outline: full as unknown as Json,
      status: 'outlined',
      error: null,
      input_tokens: row.input_tokens + usage.input,
      output_tokens: row.output_tokens + usage.output,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
  if (error) throw error
  return { creationId: row.id, outline: full, outlinesLeft: OUTLINES_PER_STORY - row.outline_count }
}

async function write(apiKey: string, deadline: number, admin: Admin, userId: string, body: Record<string, unknown>) {
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
    ;({ output, usage } = await ask(apiKey, deadline, { model: WRITER_MODEL, effort: 'medium', text: scenesUserPrompt(brief, outline, draft, batch), maxTokens: 64000 }))
  } catch (e) {
    await admin.from('story_creations').update({ status: 'failed', error: e instanceof Failure ? e.code : 'ai_error' }).eq('id', row.id)
    throw e
  }
  const scenes = onlyScenes(normalizeDraft(output), batch)
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

/** Claude composes a map; the kit coerces it and says what looks wrong. */
async function composeMap(apiKey: string, deadline: number, req: MapRequest) {
  const { output, usage } = await ask(apiKey, deadline, { model: WRITER_MODEL, format: MAP_FORMAT, effort: 'medium', text: mapUserPrompt(req), maxTokens: 24000, system: MAP_SYSTEM })
  const { doc, problems } = parseMapDoc(output)
  return { map: doc, problems: [...problems, ...mapProblems(doc)], usage }
}

async function map(apiKey: string, deadline: number, admin: Admin, userId: string, body: Record<string, unknown>) {
  const req = parseMapRequest(body)
  if (typeof req === 'string') throw new Failure(400, 'bad_request', req)
  if (!(await isAdmin(admin, userId))) {
    const { count, error } = await admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('kind', 'map')
      .gte('created_at', monthStart())
    if (error) throw error
    if ((count ?? 0) >= MAP_MONTHLY_LIMIT) throw new Failure(429, 'quota_exceeded', `Limite mensuelle atteinte (${MAP_MONTHLY_LIMIT} plans).`)
  }
  const { map: doc, problems, usage } = await composeMap(apiKey, deadline, req)
  await admin.from('ai_usage').insert({ owner_id: userId, kind: 'map', input_tokens: usage.input, output_tokens: usage.output })
  return { map: doc, problems }
}

async function sceneMap(apiKey: string, deadline: number, admin: Admin, userId: string, body: Record<string, unknown>) {
  const row = await loadCreation(admin, body.creationId, userId)
  const brief = parseBrief(row.brief)
  if (typeof brief === 'string') throw new Failure(500, 'internal', brief)
  const outline = parseOutline(row.outline)
  if (typeof outline === 'string') throw new Failure(409, 'no_outline', 'Écris d’abord le plan de l’histoire.')
  if (row.status !== 'succeeded' || !row.story_id || !row.draft) throw new Failure(409, 'not_written', 'Les scènes ne sont pas encore toutes écrites.')
  let draft = row.draft as unknown as ImportDraft
  const todo = scenesWithoutMap(draft)
  if (!todo.length) return { creationId: row.id, storyId: row.story_id, scene: null, remaining: 0, problems: [] }

  const scene = todo[0]
  const lang = brief.lang === 'en' ? 'en' : 'fr'
  const { map: doc, problems, usage } = await composeMap(apiKey, deadline, sceneMapRequest(scene, lang))
  const target = await existingStory(admin, row.story_id, storyMetaId(outline.title, row.id))
  if (!target.storyId) throw new Failure(404, 'not_found', 'Histoire introuvable.')
  const files = mapFiles(scene.id)
  // The renderer's output always passes sanitizeSvg (a unit test checks it); checked again before it is stored.
  await savePackFile(admin, userId, target.storyId, files.players.image, sanitizeSvg(renderMap(doc, { audience: 'players', lang })).svg, 'image/svg+xml')
  await savePackFile(admin, userId, target.storyId, files.keeper.image, sanitizeSvg(renderMap(doc, { audience: 'keeper', lang })).svg, 'image/svg+xml')

  draft = withSceneMap(draft, scene.id, doc.title, lang)
  await saveStory(admin, userId, target.storyId, createdStory(draft, outline, brief, target.metaId))
  await admin
    .from('story_creations')
    .update({
      draft: draft as unknown as Json,
      input_tokens: row.input_tokens + usage.input,
      output_tokens: row.output_tokens + usage.output,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
  return { creationId: row.id, storyId: target.storyId, scene: scene.id, remaining: todo.length - 1, problems }
}

// ------------------------------------------------------------------ entry point

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.')
  const deadline = Date.now() + AI_DEADLINE_MS

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
    if (body.action === 'ideas') return json(await ideas(apiKey, deadline, admin, userId, body))
    if (body.action === 'outline') return json(await outline(apiKey, deadline, admin, userId, body))
    if (body.action === 'outline-details') return json(await outlineDetails(apiKey, deadline, admin, userId, body))
    if (body.action === 'write') return json(await write(apiKey, deadline, admin, userId, body))
    if (body.action === 'map') return json(await map(apiKey, deadline, admin, userId, body))
    if (body.action === 'scene-map') return json(await sceneMap(apiKey, deadline, admin, userId, body))
    return fail(400, 'bad_request', 'action must be one of ideas, outline, outline-details, write, map, scene-map.')
  } catch (e) {
    if (e instanceof Failure) return fail(e.status, e.code, e.message)
    console.error('create-story failed', e)
    if (e instanceof Anthropic.RateLimitError) return fail(429, 'busy', "Le service d'IA est occupé. Réessaie dans une minute.")
    if (e instanceof Anthropic.APIError) return fail(502, 'ai_error', `Erreur du service d'IA (${e.status ?? 'réseau'}).`)
    return fail(500, 'internal', 'Création impossible.')
  }
})
