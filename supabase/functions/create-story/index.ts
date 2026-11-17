// Story creator: the keeper's answers → an original, playable private story.
//
// One function, four actions (they share auth, quotas, the cached system prompt and the brief):
//   - "ideas":           "Inspire me" fills the empty questionnaire fields (Haiku, effort low).
//   - "outline":         writes (or rewrites) the outline's frame: title, secret, scenes, NPCs.
//                        Starts a new creation (reserved against the monthly limit before Claude
//                        is asked: reserve_story_creation) or revises the current one (outline_count
//                        taken first, at most STORY_OUTLINES_PER_STORY).
//   - "outline-details": completes the frame: each scene's clues, NPCs and next scenes, and the
//                        keeper's overview. The browser calls it right after "outline". Counted per
//                        creation (details_count), at most STORY_DETAILS_PER_STORY calls.
//   - "write":           writes the next scene of the outline in full (the same ImportDraft shape
//                        as the AI import), merges it, converts with draftToStory, validates against
//                        the spec and saves the private story + its story.json. The browser calls
//                        it until `remaining` is 0.
//   - "map":             composes a map (floor plan, crypt, village) from the keeper's description,
//                        as a MapDoc the app's map editor opens (map kit in _shared/maps/). Counted in
//                        ai_usage (kind "map"), MAP_MONTHLY_LIMIT a month.
// "ideas" and "map" reserve their ai_usage row before Claude is asked (_shared/ai-usage.ts): calls
// made at once can't pass the limit, and a call that fails after Claude started is counted.
//   - "scene-map":       once every scene is written, draws the map of the next scene that asked for
//                        one (draft mapKind, at most STORY_MAPS_PER_STORY): the players' and the
//                        keeper's copies as SVG in the pack, two handouts of that scene. The browser
//                        calls it until `remaining` is 0. Part of the creation, not the map quota:
//                        counted per creation (map_attempts), at most twice STORY_MAPS_PER_STORY calls.
//                        The map is added to the story as it is stored then (the keeper may have
//                        edited it since the last scene), under a condition on its updated_at.
// The creation's own counters (outline_count, details_count, map_attempts) move before the Claude
// call, and are given back only when the AI service refused the call over HTTP.
//
// Every call must end before the Edge Function's wall-clock limit (150 s): that is why the outline
// takes two calls, scenes go one at a time, the writing is done by Sonnet, and each Claude call is
// cut at AI_DEADLINE_MS with a clean "try again" instead of the function being killed.
//
// Secrets: ANTHROPIC_API_KEY (required). Optional: STORY_CREATE_MONTHLY_LIMIT (default 10 new
// stories), STORY_OUTLINES_PER_STORY (default 5), STORY_DETAILS_PER_STORY (default 10), STORY_SCENES_PER_CALL (default 1),
// STORY_IDEAS_MONTHLY_LIMIT (default 50), MAP_MONTHLY_LIMIT (default 30), AI_DEADLINE_MS (default 130000, from the request's start).

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { Ajv2020 } from 'npm:ajv@8.20.0/dist/2020.js'
import { mergeDraft, normalizeDraft, parseJsonAnswer, type ImportDraft } from '../_shared/import-draft.ts'
import type { Database, Json } from '../_shared/database.types.ts'
import { createSystemPrompt, ideasUserPrompt, outlineDetailsPrompt, outlineUserPrompt, scenesUserPrompt } from '../_shared/create-prompt.ts'
import { STORY_SCHEMA } from '../_shared/spec-bundle.ts'
import { forbiddenNamesIn } from '../_shared/story-mcp.ts'
import { monthStart, recordUsage, refusedUpstream, releaseUsage, reserveUsage, type UsageKind } from '../_shared/ai-usage.ts'
import { existingStory, savePackFile, saveStory, writePackJson } from '../_shared/story-save.ts'
import { mapFiles, sceneMapRequest, scenesWithoutMap, STORY_MAPS_PER_STORY, withSceneMap } from '../_shared/story-maps.ts'
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
  withStoredSceneMap,
  writtenSceneIds,
  type IdeaField,
  type StoryBrief,
} from '../_shared/story-create.ts'

/** Haiku for the quick suggestions, Sonnet for the outline and the scenes (fast enough for the time limit). */
const IDEAS_MODEL = 'claude-haiku-5-5'
const WRITER_MODEL = 'claude-sonnet-5-5'
const MONTHLY_LIMIT = Number(Deno.env.get('STORY_CREATE_MONTHLY_LIMIT') ?? 10)
const OUTLINES_PER_STORY = Number(Deno.env.get('STORY_OUTLINES_PER_STORY') ?? 5)
/** "outline-details" calls per creation: one per outline, and as many retries after a timeout. */
const DETAILS_PER_STORY = Number(Deno.env.get('STORY_DETAILS_PER_STORY') ?? 2 * OUTLINES_PER_STORY)
/** "scene-map" calls per creation: one per map, and as many retries after a failure. */
const MAP_ATTEMPTS_PER_STORY = 2 * STORY_MAPS_PER_STORY
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
  // Creations started through the MCP connector are written by the keeper's chat app, never by
  // this function's paid model: they don't exist here (same answer as an unknown id).
  if (!data || data.owner_id !== userId || data.source !== 'web') throw new Failure(404, 'not_found', 'Création introuvable.')
  return data
}

type SlotCounter = 'outline_count' | 'details_count' | 'map_attempts'
const slotValue = (counter: SlotCounter, value: number) =>
  counter === 'outline_count' ? { outline_count: value } : counter === 'details_count' ? { details_count: value } : { map_attempts: value }

/**
 * Take one of a creation's counted calls BEFORE asking Claude, so calls that fail, time out or run
 * at the same time are counted too. The counter only moves from the value this request read: of
 * several requests that read the same value, one goes on and the others are told to try again.
 * Admins have no limit unless `adminsLimited` (the outlines per story, as before); their calls are
 * still counted.
 */
async function takeSlot(admin: Admin, userId: string, row: CreationRow, counter: SlotCounter, limit: number, refusal: Failure, adminsLimited = false) {
  if (row[counter] >= limit && (adminsLimited || !(await isAdmin(admin, userId)))) throw refusal
  const { data, error } = await admin
    .from('story_creations')
    .update(slotValue(counter, row[counter] + 1))
    .eq('id', row.id)
    .eq(counter, row[counter])
    .select('id')
  if (error) throw error
  if (!data.length) throw new Failure(409, 'busy', 'Une autre demande est déjà en cours pour cette histoire. Réessaie dans un instant.')
}

/**
 * Run a Claude call on a slot taken with takeSlot. When the AI service refused the call itself
 * (an HTTP error: nothing generated), the slot is given back, only if nobody moved the counter since.
 */
async function onSlot<T>(admin: Admin, row: CreationRow, counter: SlotCounter, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    if (refusedUpstream(e)) {
      const { error } = await admin.from('story_creations').update(slotValue(counter, row[counter])).eq('id', row.id).eq(counter, row[counter] + 1)
      if (error) console.error('story_creations slot release failed', error)
    }
    throw e
  }
}

/**
 * A call counted in ai_usage against a monthly limit: reserved first (refused with `refusal` when
 * the month is used up; admins have no limit), then `run`, then the tokens on the reserved row.
 * The reservation is given back only when the AI service refused the call itself (nothing was
 * generated); a timeout, or an answer that proved too long or unreadable, stays counted.
 */
async function counted<T extends { usage: { input: number; output: number } }>(admin: Admin, userId: string, kind: UsageKind, limit: number, refusal: Failure, run: () => Promise<T>): Promise<T> {
  const usageId = await reserveUsage(admin, userId, kind, (await isAdmin(admin, userId)) ? null : limit)
  if (!usageId) throw refusal
  let result: T
  try {
    result = await run()
  } catch (e) {
    if (refusedUpstream(e)) await releaseUsage(admin, usageId)
    throw e
  }
  await recordUsage(admin, usageId, result.usage)
  return result
}

// ------------------------------------------------------------------ actions

async function ideas(apiKey: string, deadline: number, admin: Admin, userId: string, body: Record<string, unknown>) {
  const brief = parseBrief(body.brief)
  if (typeof brief === 'string') throw new Failure(400, 'bad_request', brief)
  const field = body.field === undefined ? undefined : (body.field as IdeaField)
  if (field !== undefined && !IDEA_FIELDS.includes(field)) throw new Failure(400, 'bad_request', `field must be one of ${IDEA_FIELDS.join(', ')}.`)
  const { output } = await counted(admin, userId, 'story-ideas', IDEAS_MONTHLY_LIMIT, new Failure(429, 'quota_exceeded', `Limite mensuelle atteinte (${IDEAS_MONTHLY_LIMIT} suggestions).`), () =>
    ask(apiKey, deadline, { model: IDEAS_MODEL, format: IDEAS_FORMAT, effort: 'low', text: ideasUserPrompt(brief, field), maxTokens: 4000 }),
  )
  return { ideas: pickIdeas(brief, (output ?? {}) as Record<string, unknown>, field) }
}

async function outline(apiKey: string, deadline: number, admin: Admin, userId: string, body: Record<string, unknown>) {
  const tooMany = new Failure(429, 'too_many_outlines', `Pas plus de ${OUTLINES_PER_STORY} plans par histoire.`)
  let row: CreationRow | null = null
  let brief: StoryBrief | string
  if (body.creationId !== undefined) {
    row = await loadCreation(admin, body.creationId, userId)
    if (row.status !== 'outlined' && row.status !== 'failed') throw new Failure(409, 'already_writing', 'Les scènes sont déjà en cours d’écriture.')
    if (row.story_id) throw new Failure(409, 'already_writing', 'Les scènes sont déjà en cours d’écriture.')
    // The keeper may have changed their answers between two outlines.
    brief = parseBrief(body.brief ?? row.brief)
  } else {
    brief = parseBrief(body.brief)
  }
  if (typeof brief === 'string') throw new Failure(400, 'bad_request', brief)

  // Revising: start from the keeper's edited outline when they send it, else the stored one.
  const previous = row?.outline ? parseOutline(body.outline ?? row.outline) : null
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1500) : ''
  const revise = previous && typeof previous !== 'string' ? { previous, notes } : undefined
  const text = outlineUserPrompt(brief, revise)
  const askFrame = async () => {
    const { output, usage } = await ask(apiKey, deadline, { model: WRITER_MODEL, format: FRAME_FORMAT, effort: 'medium', text, maxTokens: 32000 })
    const parsed = frameToOutline(output)
    if (typeof parsed === 'string') throw new Failure(502, 'invalid_output', 'Le plan reçu est incomplet. Réessaie.')
    return { parsed, usage }
  }
  const fields = (parsed: unknown) => ({
    brief: brief as unknown as Json,
    outline: parsed as Json,
    status: 'outlined',
    error: null,
    updated_at: new Date().toISOString(),
  })

  if (row) {
    // The revision is taken before Claude is asked: revisions sent at once can't pass the limit.
    await takeSlot(admin, userId, row, 'outline_count', OUTLINES_PER_STORY, tooMany, true)
    const { parsed, usage } = await onSlot(admin, row, 'outline_count', askFrame)
    const { error } = await admin
      .from('story_creations')
      .update({ ...fields(parsed), input_tokens: row.input_tokens + usage.input, output_tokens: row.output_tokens + usage.output })
      .eq('id', row.id)
    if (error) throw error
    return { creationId: row.id, outline: parsed, outlinesLeft: OUTLINES_PER_STORY - row.outline_count - 1 }
  }

  // A new creation is reserved before Claude is asked (reserve_story_creation: counted and inserted
  // under a lock), so calls made at once can't pass the monthly limit.
  const { data: creationId, error: reserveError } = await admin.rpc('reserve_story_creation', {
    p_owner: userId,
    p_brief: brief as unknown as Json,
    p_since: monthStart(),
    ...((await isAdmin(admin, userId)) ? {} : { p_limit: MONTHLY_LIMIT }),
  })
  if (reserveError) throw reserveError
  if (!creationId) throw new Failure(429, 'quota_exceeded', `Limite mensuelle atteinte (${MONTHLY_LIMIT} histoires créées).`)
  let result: Awaited<ReturnType<typeof askFrame>>
  try {
    result = await askFrame()
  } catch (e) {
    // Refused by the AI service itself: nothing was generated, the creation is given back. Anything
    // else stays counted, as a failed creation with no outline (nothing to resume from).
    const { error } = refusedUpstream(e)
      ? await admin.from('story_creations').delete().eq('id', creationId)
      : await admin.from('story_creations').update({ status: 'failed', error: e instanceof Failure ? e.code : 'ai_error', updated_at: new Date().toISOString() }).eq('id', creationId)
    if (error) console.error('story_creations reservation update failed', error)
    throw e
  }
  const { error } = await admin
    .from('story_creations')
    .update({ ...fields(result.parsed), input_tokens: result.usage.input, output_tokens: result.usage.output })
    .eq('id', creationId)
  if (error) throw error
  return { creationId, outline: result.parsed, outlinesLeft: OUTLINES_PER_STORY - 1 }
}

/** The outline's second half: clues, NPCs present and next scenes for each scene, and the overview. */
async function outlineDetails(apiKey: string, deadline: number, admin: Admin, userId: string, body: Record<string, unknown>) {
  const row = await loadCreation(admin, body.creationId, userId)
  if ((row.status !== 'outlined' && row.status !== 'failed') || row.story_id) throw new Failure(409, 'already_writing', 'Les scènes sont déjà en cours d’écriture.')
  const brief = parseBrief(row.brief)
  if (typeof brief === 'string') throw new Failure(500, 'internal', brief)
  const frame = parseOutline(body.outline ?? row.outline)
  if (typeof frame === 'string') throw new Failure(409, 'no_outline', 'Écris d’abord le plan de l’histoire.')
  await takeSlot(admin, userId, row, 'details_count', DETAILS_PER_STORY, new Failure(429, 'too_many_details', `Le plan de cette histoire a déjà été complété ${DETAILS_PER_STORY} fois. Écris les scènes, ou commence une nouvelle histoire.`))

  const { output, usage } = await onSlot(admin, row, 'details_count', () =>
    ask(apiKey, deadline, { model: WRITER_MODEL, format: DETAILS_FORMAT, effort: 'medium', text: outlineDetailsPrompt(brief, frame), maxTokens: 32000 }),
  )
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
  const { map: doc, problems } = await counted(admin, userId, 'map', MAP_MONTHLY_LIMIT, new Failure(429, 'quota_exceeded', `Limite mensuelle atteinte (${MAP_MONTHLY_LIMIT} plans).`), () =>
    composeMap(apiKey, deadline, req),
  )
  return { map: doc, problems }
}

/**
 * Add a scene's map to the story as it is stored now (withStoredSceneMap), only if nobody changed
 * the story between the read and the write (updated_at), then to the pack's story.json. Tried
 * twice: an edit landing in between is kept, never overwritten.
 */
async function attachSceneMap(admin: Admin, userId: string, storyId: string, fresh: unknown, sceneId: string, handoutIds: string[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: stored, error } = await admin.from('stories').select('content, updated_at').eq('id', storyId).eq('owner_id', userId).maybeSingle()
    if (error) throw error
    if (!stored) throw new Failure(404, 'not_found', 'Histoire introuvable.')
    const story = withStoredSceneMap(stored.content, fresh, sceneId, handoutIds)
    if (!story) return // the keeper removed the scene: its map has nowhere to go
    const { data: saved, error: saveError } = await admin
      .from('stories')
      .update({ content: story as Json })
      .eq('id', storyId)
      .eq('owner_id', userId)
      .eq('updated_at', stored.updated_at)
      .select('id')
    if (saveError) throw saveError
    if (saved.length) return await writePackJson(admin, userId, storyId, story)
  }
  throw new Failure(409, 'conflict', 'L’histoire a changé pendant le dessin du plan. Réessaie.')
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
  // Nothing to draw on: checked before Claude is paid for a map.
  const target = await existingStory(admin, row.story_id, storyMetaId(outline.title, row.id))
  if (!target.storyId) throw new Failure(404, 'not_found', 'Histoire introuvable.')
  await takeSlot(admin, userId, row, 'map_attempts', MAP_ATTEMPTS_PER_STORY, new Failure(429, 'too_many_maps', 'Trop d’essais pour les plans de cette histoire. Elle est prête sans eux.'))
  const { map: doc, problems, usage } = await onSlot(admin, row, 'map_attempts', () => composeMap(apiKey, deadline, sceneMapRequest(scene, lang)))
  const files = mapFiles(scene.id)
  // The renderer's output always passes sanitizeSvg (a unit test checks it); checked again before it is stored.
  await savePackFile(admin, userId, target.storyId, files.players.image, sanitizeSvg(renderMap(doc, { audience: 'players', lang })).svg, 'image/svg+xml')
  await savePackFile(admin, userId, target.storyId, files.keeper.image, sanitizeSvg(renderMap(doc, { audience: 'keeper', lang })).svg, 'image/svg+xml')

  draft = withSceneMap(draft, scene.id, doc.title, lang)
  await attachSceneMap(admin, userId, target.storyId, createdStory(draft, outline, brief, target.metaId), scene.id, [files.players.handout, files.keeper.handout])
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
