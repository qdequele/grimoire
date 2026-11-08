// MCP connector: keepers create and revise their stories, and make investigators, from ChatGPT or Claude.
//
// A remote MCP server (Streamable HTTP, stateless, JSON responses). The chat app's model does the
// writing; these tools guide it, then check, convert and save what it sends (logic and tool
// definitions in _shared/story-mcp.ts, investigator rules in _shared/investigator.ts). No Claude API
// call here: nothing to pay per token.
//
// Sign-in is OAuth 2.1 through Supabase Auth's OAuth server: an unauthenticated request gets a 401
// pointing to this resource's metadata, which names Supabase Auth as the authorization server; the
// client registers itself (dynamic registration), the keeper approves it on /oauth/consent, and the
// access token is an ordinary Supabase user JWT. Stories, pack files, investigators and players are
// then read and written with that token (RLS: the keeper's own rows only); the service role only
// writes story_creations and ai_usage, like create-story.
//
// Env: MCP_PUBLIC_URL (this endpoint as clients see it; default: the function's URL),
// MCP_AUTH_SERVER (default SUPABASE_URL/auth/v1), APP_URL (story links, default the production
// site), MCP_STORIES_MONTHLY_LIMIT (default 30 new stories), MCP_EDITS_DAILY_LIMIT (default 500),
// MCP_IMAGES_DAILY_LIMIT (default 100 SVG pictures stored or replaced; each save_image call is also an edit).
// save_investigator calls count as edits too.

import { Server } from 'npm:@modelcontextprotocol/sdk@1.32.2/server/index.js'
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.32.2/server/webStandardStreamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolRequest } from 'npm:@modelcontextprotocol/sdk@1.32.2/types.js'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { Ajv2020 } from 'npm:ajv@8.20.0/dist/2020.js'
import { mergeDraft, type ImportDraft } from '../_shared/import-draft.ts'
import type { Database, Json } from '../_shared/database.types.ts'
import { STORY_SCHEMA } from '../_shared/spec-bundle.ts'
import {
  createdStory,
  nextBatch,
  orderLikeOutline,
  outlineScenes,
  outlineToDraft,
  parseBrief,
  parseOutline,
  storyMetaId,
  writtenSceneIds,
} from '../_shared/story-create.ts'
import {
  applyEdits,
  attachImage,
  detachImage,
  forbiddenNamesIn,
  GUIDE_TOPICS,
  guideText,
  imageUses,
  MCP_LIMITS,
  normalizeDraft,
  parseImageRequest,
  SERVER_INSTRUCTIONS,
  STORY_PARTS,
  storyPart,
  ToolError,
  toolDefinitions,
  usesImage,
  type GuideTopic,
  type StoryPart,
} from '../_shared/story-mcp.ts'
import { choicesOf, investigatorSheet, investigatorView, parseInvestigator, type ParsedInvestigator } from '../_shared/investigator.ts'
import { existingStory, saveStory, writePackJson } from '../_shared/story-save.ts'
import { sanitizeSvg, SvgError } from '../_shared/svg-safe.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const PUBLIC_URL = Deno.env.get('MCP_PUBLIC_URL') ?? `${SUPABASE_URL}/functions/v1/mcp`
const AUTH_SERVER = Deno.env.get('MCP_AUTH_SERVER') ?? `${SUPABASE_URL}/auth/v1`
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://www.legrimoire.quest').replace(/\/$/, '')
const STORIES_MONTHLY_LIMIT = Number(Deno.env.get('MCP_STORIES_MONTHLY_LIMIT') ?? 30)
const EDITS_DAILY_LIMIT = Number(Deno.env.get('MCP_EDITS_DAILY_LIMIT') ?? 500)
const IMAGES_DAILY_LIMIT = Number(Deno.env.get('MCP_IMAGES_DAILY_LIMIT') ?? 100)
const PACK_BUCKET = 'story-packs'
/** Scene ids suggested for the next write_scenes call. */
const NEXT_BATCH = 3

const RESOURCE_METADATA_URL = `${PUBLIC_URL}/.well-known/oauth-protected-resource`
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id, last-event-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'www-authenticate, mcp-session-id',
}

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateStory = ajv.compile(STORY_SCHEMA)
const schemaErrors = (story: unknown) =>
  validateStory(story) ? [] : (validateStory.errors ?? []).slice(0, 50).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim())

type Db = SupabaseClient<Database>
type CreationRow = Database['public']['Tables']['story_creations']['Row']
interface Ctx {
  userId: string
  /** Acting as the keeper (their token): RLS applies. */
  db: Db
  /** Service role: story_creations and ai_usage only. */
  admin: Db
}

const since = (unit: 'month' | 'day') => {
  const d = new Date()
  if (unit === 'month') d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}
const storyUrl = (id: string) => `${APP_URL}/stories/${id}`
const characterUrl = (id: string) => `${APP_URL}/characters/${id}`
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

async function isAdmin(ctx: Ctx) {
  const { data } = await ctx.admin.from('profiles').select('is_admin').eq('id', ctx.userId).single()
  return !!data?.is_admin
}

async function loadCreation(ctx: Ctx, id: unknown): Promise<CreationRow> {
  if (!str(id)) throw new ToolError('bad_request', 'creationId is required.')
  const { data } = await ctx.admin.from('story_creations').select('*').eq('id', str(id)).maybeSingle()
  if (!data || data.owner_id !== ctx.userId) throw new ToolError('not_found', 'No creation with this id. Start one with save_outline.')
  return data
}

function refuseForbidden(value: unknown, alreadyThere: string[] = []) {
  const names = forbiddenNamesIn(value).filter((n) => !alreadyThere.includes(n))
  if (names.length) {
    throw new ToolError('forbidden_names', `These names come from published games or fiction and can't be used: ${names.join(', ')}. Invent your own and send it again.`)
  }
}

function refuseTooBig(story: unknown) {
  if (JSON.stringify(story).length > MCP_LIMITS.story) throw new ToolError('too_large', 'The story would be too large. Make scenes shorter.')
}

// ------------------------------------------------------------------ tools

async function saveOutline(ctx: Ctx, args: Record<string, unknown>) {
  const brief = parseBrief(args.brief)
  if (typeof brief === 'string') throw new ToolError('bad_request', brief)
  const outline = parseOutline(args.outline)
  if (typeof outline === 'string') throw new ToolError('bad_request', outline)
  refuseForbidden(outline)

  const fields = { brief: brief as unknown as Json, outline: outline as unknown as Json, status: 'outlined', error: null, updated_at: new Date().toISOString() }
  let creationId: string
  if (args.creationId !== undefined) {
    const row = await loadCreation(ctx, args.creationId)
    if (row.story_id || row.draft) throw new ToolError('already_writing', 'Scenes are already written for this creation: its outline is final. Change the story with edit_story once it is finished.')
    const { error } = await ctx.admin.from('story_creations').update({ ...fields, outline_count: row.outline_count + 1 }).eq('id', row.id)
    if (error) throw error
    creationId = row.id
  } else {
    if (!(await isAdmin(ctx))) {
      const { count, error } = await ctx.admin
        .from('story_creations')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ctx.userId)
        .eq('source', 'mcp')
        .gte('created_at', since('month'))
      if (error) throw error
      if ((count ?? 0) >= STORIES_MONTHLY_LIMIT) throw new ToolError('quota_exceeded', `Monthly limit reached (${STORIES_MONTHLY_LIMIT} new stories). It resets on the 1st.`)
    }
    const { data, error } = await ctx.admin
      .from('story_creations')
      .insert({ ...fields, owner_id: ctx.userId, outline_count: 1, source: 'mcp' })
      .select('id')
      .single()
    if (error) throw error
    creationId = data.id
  }
  const scenes = outline.acts.flatMap((a) => a.scenes.map((s) => ({ id: s.id, act: a.id, title: s.title })))
  return {
    creationId,
    title: outline.title,
    // parseOutline may have changed ids (kebab-case, unique): these are the ones to use.
    acts: outline.acts.map((a) => ({ id: a.id, title: a.title })),
    scenes,
    npcs: outline.npcs.map((n) => ({ id: n.id, name: n.name })),
    total: scenes.length,
    next: scenes.slice(0, NEXT_BATCH).map((s) => s.id),
  }
}

async function writeScenes(ctx: Ctx, args: Record<string, unknown>) {
  const row = await loadCreation(ctx, args.creationId)
  if (row.status === 'succeeded') throw new ToolError('finished', 'This story is finished. Change it with get_story and edit_story.')
  const brief = parseBrief(row.brief)
  if (typeof brief === 'string') throw new ToolError('internal', brief)
  const outline = parseOutline(row.outline)
  if (typeof outline === 'string') throw new ToolError('no_outline', 'Save the outline first (save_outline).')

  const batch: ImportDraft = { ...normalizeDraft(args.draft), title: '', summary: '', era: '', setting: '', duration: '' }
  // The outline's title, pitch and overview stay as approved: only acts, NPCs and handouts merge.
  batch.overview = { secret: '', steps: [], mustNotMiss: [], branches: [], ifStuck: [], keeperTips: [] }
  const count = batch.acts.reduce((n, a) => n + a.scenes.length, 0)
  if (count > MCP_LIMITS.scenesPerCall) throw new ToolError('bad_request', `At most ${MCP_LIMITS.scenesPerCall} scenes per call (you sent ${count}).`)
  const sent = [...writtenSceneIds(batch)]
  const known = new Set(outlineScenes(outline).map((s) => s.id))
  const unknown = sent.filter((id) => !known.has(id))
  if (unknown.length) throw new ToolError('bad_request', `Scenes not in the outline: ${unknown.join(', ')}. Use the outline's scene ids: ${[...known].join(', ')}.`)
  if (!sent.length && !batch.npcs.length && !batch.handouts.length) throw new ToolError('bad_request', 'The draft has no scene, NPC or handout.')

  const before = (row.draft as unknown as ImportDraft | null) ?? outlineToDraft(outline, brief)
  const draft = orderLikeOutline(mergeDraft(before, batch), outline)
  const target = await existingStory(ctx.db, row.story_id, storyMetaId(outline.title, row.id))
  const story = createdStory(draft, outline, brief, target.metaId)
  refuseForbidden(story)
  refuseTooBig(story)
  const validationErrors = schemaErrors(story)
  const storyId = await saveStory(ctx.db, ctx.userId, target.storyId, story)

  const total = outlineScenes(outline).length
  const written = writtenSceneIds(draft).size
  const remaining = total - written
  const { error } = await ctx.admin
    .from('story_creations')
    .update({
      status: remaining ? 'writing' : 'succeeded',
      draft: draft as unknown as Json,
      story_id: storyId,
      error: null,
      updated_at: new Date().toISOString(),
      finished_at: remaining ? null : new Date().toISOString(),
    })
    .eq('id', row.id)
  if (error) throw error
  return { creationId: row.id, storyId, url: storyUrl(storyId), written, total, remaining, next: nextBatch(outline, draft, NEXT_BATCH), validationErrors }
}

async function listMyStories(ctx: Ctx) {
  const { data, error } = await ctx.db
    .from('stories')
    .select('id, title, lang, summary, updated_at')
    .eq('owner_id', ctx.userId)
    .eq('visibility', 'private')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) throw error
  // Creations not finished yet: their story can't be edited, write_scenes continues them.
  const { data: open } = await ctx.admin
    .from('story_creations')
    .select('id, status, story_id, outline, updated_at')
    .eq('owner_id', ctx.userId)
    .in('status', ['outlined', 'writing'])
    .order('updated_at', { ascending: false })
    .limit(20)
  const writing = new Set((open ?? []).map((c) => c.story_id).filter(Boolean))
  return {
    stories: (data ?? []).map((s) => ({ id: s.id, title: s.title, lang: s.lang, summary: s.summary, updatedAt: s.updated_at, beingWritten: writing.has(s.id), url: storyUrl(s.id) })),
    unfinishedCreations: (open ?? []).map((c) => ({
      creationId: c.id,
      title: (c.outline as { title?: string } | null)?.title ?? '',
      status: c.status,
      storyId: c.story_id,
      updatedAt: c.updated_at,
    })),
  }
}

async function loadOwnStory(ctx: Ctx, storyId: unknown) {
  const id = str(storyId)
  if (!id) throw new ToolError('bad_request', 'storyId is required.')
  const { data } = await ctx.db
    .from('stories')
    .select('id, content, updated_at, pack_files')
    .eq('id', id)
    .eq('owner_id', ctx.userId)
    .eq('visibility', 'private')
    .maybeSingle()
  if (!data) throw new ToolError('not_found', 'No private story of yours with this id (list_my_stories lists them).')
  return data
}

/** A creation still writing this story: its next batch would overwrite an edit. */
async function creationWriting(ctx: Ctx, storyId: string) {
  const { data } = await ctx.admin.from('story_creations').select('id').eq('story_id', storyId).in('status', ['outlined', 'writing']).limit(1)
  return data?.[0]?.id as string | undefined
}

async function getStory(ctx: Ctx, args: Record<string, unknown>) {
  const story = await loadOwnStory(ctx, args.storyId)
  const part = (STORY_PARTS as readonly string[]).includes(args.part as string) ? (args.part as StoryPart) : 'summary'
  const sceneIds = Array.isArray(args.sceneIds) ? args.sceneIds.filter((x): x is string => typeof x === 'string') : []
  const writing = await creationWriting(ctx, story.id)
  return {
    storyId: story.id,
    version: story.updated_at,
    url: storyUrl(story.id),
    ...(writing ? { beingWrittenBy: writing } : {}),
    ...storyPart(story.content, part, sceneIds),
    // Pictures in the pack (save_image) and where the story uses them.
    images: imageUses(story.content, story.pack_files),
  }
}

/**
 * Edits (edit_story and save_image calls) per day, counted in ai_usage as 'mcp-edit'. A save_image
 * call that stores an SVG records its size in input_tokens, so pictures are counted apart too
 * (the ai_usage kinds are a DB constraint; no new kind needed).
 */
async function checkEditQuota(ctx: Ctx, image: boolean) {
  if (await isAdmin(ctx)) return
  const today = () =>
    ctx.admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('owner_id', ctx.userId).eq('kind', 'mcp-edit').gte('created_at', since('day'))
  const { count, error } = await today()
  if (error) throw error
  if ((count ?? 0) >= EDITS_DAILY_LIMIT) throw new ToolError('quota_exceeded', `Daily limit reached (${EDITS_DAILY_LIMIT} edits).`)
  if (!image) return
  const { count: images, error: imageError } = await today().gt('input_tokens', 0)
  if (imageError) throw imageError
  if ((images ?? 0) >= IMAGES_DAILY_LIMIT) throw new ToolError('quota_exceeded', `Daily limit reached (${IMAGES_DAILY_LIMIT} pictures).`)
}

const CONFLICT = 'The story changed since you read it. Call get_story again and redo the edit on the new version.'

/** The keeper's story, at the version the model read, and not being written by a creation. */
async function storyToEdit(ctx: Ctx, args: Record<string, unknown>) {
  const version = str(args.version)
  if (!version) throw new ToolError('bad_request', 'version is required (from get_story).')
  const current = await loadOwnStory(ctx, args.storyId)
  if (current.updated_at !== version) throw new ToolError('conflict', CONFLICT)
  const writing = await creationWriting(ctx, current.id)
  if (writing) throw new ToolError('busy', `A creation is still writing this story (${writing}). Finish it with write_scenes first.`)
  return { current, version }
}

/** The edited story must not have more schema errors than before (it may already have some). */
function refuseNewSchemaErrors(before: unknown, story: unknown) {
  const was = schemaErrors(before)
  const validationErrors = schemaErrors(story)
  if (validationErrors.length > was.length) {
    throw new ToolError('invalid_story', `The edit doesn't fit the story format (nothing was changed):\n${validationErrors.filter((e) => !was.includes(e)).join('\n')}`)
  }
  return validationErrors
}

async function editStory(ctx: Ctx, args: Record<string, unknown>) {
  if (!str(args.version)) throw new ToolError('bad_request', 'version is required (from get_story).')
  await checkEditQuota(ctx, false)
  const { current, version } = await storyToEdit(ctx, args)

  const story = applyEdits(current.content, args.ops)
  // Private stories converted from books the keeper owns may already carry such names: only new ones are refused.
  refuseForbidden(story, forbiddenNamesIn(current.content))
  refuseTooBig(story)
  const validationErrors = refuseNewSchemaErrors(current.content, story)

  const { data, error } = await ctx.db
    .from('stories')
    .update({ content: story as Json })
    .eq('id', current.id)
    .eq('owner_id', ctx.userId)
    .eq('updated_at', version)
    .select('updated_at')
  if (error) throw error
  if (!data?.length) throw new ToolError('conflict', CONFLICT)
  await writePackJson(ctx.db, ctx.userId, current.id, story)
  await ctx.admin.from('ai_usage').insert({ owner_id: ctx.userId, kind: 'mcp-edit', input_tokens: 0, output_tokens: 0 })
  return { storyId: current.id, version: data[0].updated_at, url: storyUrl(current.id), validationErrors }
}

/**
 * Store, replace, attach or remove an SVG picture of a story's pack. The file, stories.pack_files,
 * stories.content and the pack's story.json change together: the row update is conditional on the
 * version, and a file uploaded for a refused update is removed again (a replaced file can't be
 * restored, but the story still points at a valid picture under the same name).
 */
async function saveImage(ctx: Ctx, args: Record<string, unknown>) {
  if (!str(args.version)) throw new ToolError('bad_request', 'version is required (from get_story).')
  const req = parseImageRequest(args)
  let safe: ReturnType<typeof sanitizeSvg> | null = null
  if (req.svg !== undefined) {
    try {
      safe = sanitizeSvg(req.svg)
    } catch (e) {
      if (e instanceof SvgError) throw new ToolError('unsafe_svg', `${e.message} Nothing was saved: fix the SVG and send it again.`)
      throw e
    }
  }
  await checkEditQuota(ctx, !!safe)
  const { current, version } = await storyToEdit(ctx, args)

  const files = current.pack_files
  const stored = files.includes(req.path)
  if (safe && !stored && files.filter((f) => f.startsWith('images/')).length >= MCP_LIMITS.imagesPerStory) {
    throw new ToolError('too_many_images', `This story already has ${MCP_LIMITS.imagesPerStory} pictures: remove one (remove: true) or replace one (same name).`)
  }
  if (!safe && !req.remove && !stored) throw new ToolError('not_found', `No picture ${req.path} in this story: send svg to create it.`)
  if (req.remove && !stored && !usesImage(current.content, req.path)) throw new ToolError('not_found', `No picture ${req.path} in this story.`)

  const story = req.remove ? detachImage(current.content, req.path) : req.attach ? attachImage(current.content, req.path, req.attach) : (current.content as Record<string, unknown>)
  const changed = JSON.stringify(story) !== JSON.stringify(current.content)
  if (changed) {
    refuseTooBig(story)
    refuseNewSchemaErrors(current.content, story)
  }
  const packFiles = req.remove ? files.filter((f) => f !== req.path) : stored ? files : [...files, req.path]
  const objectPath = `${ctx.userId}/${current.id}/${req.path}`
  const bucket = ctx.db.storage.from(PACK_BUCKET)

  if (safe) {
    const { error } = await bucket.upload(objectPath, new Blob([safe.svg], { type: 'image/svg+xml' }), { upsert: true, contentType: 'image/svg+xml' })
    if (error) throw error
  }
  const { data, error } = await ctx.db
    .from('stories')
    .update({ content: story as Json, pack_files: packFiles })
    .eq('id', current.id)
    .eq('owner_id', ctx.userId)
    .eq('updated_at', version)
    .select('updated_at')
  if (error || !data?.length) {
    if (safe && !stored) await bucket.remove([objectPath])
    if (error) throw error
    throw new ToolError('conflict', CONFLICT)
  }
  if (req.remove && stored) {
    const { error: removeError } = await bucket.remove([objectPath])
    if (removeError) console.error('pack picture remove failed', removeError)
  }
  if (changed) await writePackJson(ctx.db, ctx.userId, current.id, story)
  await ctx.admin.from('ai_usage').insert({ owner_id: ctx.userId, kind: 'mcp-edit', input_tokens: safe?.bytes ?? 0, output_tokens: 0 })
  return {
    storyId: current.id,
    version: data[0].updated_at,
    url: storyUrl(current.id),
    path: req.path,
    ...(req.remove ? { removed: true } : { attachedTo: req.attach ?? null }),
    ...(safe ? { bytes: safe.bytes, replaced: stored } : {}),
    images: imageUses(story, packFiles),
  }
}

// ------------------------------------------------------------------ investigators

/** The checked choices, or a ToolError listing every problem (nothing saved). */
function checkedInvestigator(args: Record<string, unknown>): ParsedInvestigator & { draft: NonNullable<ParsedInvestigator['draft']> } {
  const parsed = parseInvestigator(args.investigator)
  if (!parsed.draft) {
    throw new ToolError('invalid_investigator', `The sheet breaks the creation rules (nothing was saved). Fix these and send it again:\n- ${parsed.problems.join('\n- ')}`)
  }
  return parsed as ParsedInvestigator & { draft: NonNullable<ParsedInvestigator['draft']> }
}

/** check_investigator: the rules' verdict and the sheet Grimoire would save. No database. */
function checkInvestigator(args: Record<string, unknown>) {
  const parsed = parseInvestigator(args.investigator)
  if (!parsed.draft) return { ok: false, problems: parsed.problems, warnings: parsed.warnings }
  return { ok: true, warnings: parsed.warnings, sheet: investigatorView(investigatorSheet(parsed.draft)) }
}

/** The keeper's player with this first name (case-insensitive, as the companion does), or a new one. */
async function playerNamed(ctx: Ctx, name: string): Promise<string> {
  const find = async () => {
    const { data, error } = await ctx.db.from('players').select('id, name').eq('owner_id', ctx.userId)
    if (error) throw error
    return data.find((p) => p.name.trim().toLowerCase() === name.toLowerCase())?.id
  }
  const found = await find()
  if (found) return found
  const { data, error } = await ctx.db.from('players').insert({ owner_id: ctx.userId, name }).select('id').single()
  if (!error) return data.id
  // Created at the same moment by another call (unique name per keeper).
  const again = error.code === '23505' ? await find() : undefined
  if (again) return again
  throw error
}

async function loadOwnCharacter(ctx: Ctx, characterId: unknown) {
  const id = str(characterId)
  if (!id) throw new ToolError('bad_request', 'characterId is required.')
  const { data } = await ctx.db
    .from('characters')
    .select('id, data, updated_at, player_id, player:players(name)')
    .eq('id', id)
    .eq('owner_id', ctx.userId)
    .maybeSingle()
  if (!data) throw new ToolError('not_found', 'No investigator of yours with this id (list_my_investigators lists them).')
  return data as typeof data & { player: { name: string } | null }
}

const INVESTIGATOR_CONFLICT = 'The investigator changed since you read it. Call get_investigator again and redo the change on the new version.'

async function saveInvestigator(ctx: Ctx, args: Record<string, unknown>) {
  const { draft, player, warnings } = checkedInvestigator(args)
  const replacing = args.characterId !== undefined && args.characterId !== null && args.characterId !== ''
  const version = str(args.version)
  if (replacing && !version) throw new ToolError('bad_request', 'version is required to change an investigator (from get_investigator).')
  await checkEditQuota(ctx, false)
  const current = replacing ? await loadOwnCharacter(ctx, args.characterId) : null
  if (current && current.updated_at !== version) throw new ToolError('conflict', INVESTIGATOR_CONFLICT)

  // player left out on a change: the investigator keeps its player.
  const playerId = player === undefined ? (current?.player_id ?? null) : player === '' ? null : await playerNamed(ctx, player)
  const sheet = investigatorSheet({ ...draft, playerId: playerId ?? '' })
  // What the investigator gained in play stays, as when the keeper edits the sheet in the wizard.
  const progress = (current?.data as { progress?: unknown } | undefined)?.progress
  const data = { ...sheet, ...(progress ? { progress } : {}) } as unknown as Json

  const saved = current
    ? await ctx.db.from('characters').update({ data, player_id: playerId }).eq('id', current.id).eq('owner_id', ctx.userId).eq('updated_at', version).select('id, updated_at')
    : await ctx.db.from('characters').insert({ owner_id: ctx.userId, data, player_id: playerId }).select('id, updated_at')
  if (saved.error) throw saved.error
  const row = saved.data?.[0]
  if (!row) throw new ToolError('conflict', INVESTIGATOR_CONFLICT)
  await ctx.admin.from('ai_usage').insert({ owner_id: ctx.userId, kind: 'mcp-edit', input_tokens: 0, output_tokens: 0 })
  return {
    characterId: row.id,
    version: row.updated_at,
    url: characterUrl(row.id),
    player: player === undefined ? (current?.player?.name ?? null) : player || null,
    ...(current ? { replaced: true, keptPlayProgress: !!progress } : {}),
    warnings,
    sheet: investigatorView(sheet),
  }
}

async function listMyInvestigators(ctx: Ctx) {
  const { data, error } = await ctx.db
    .from('characters')
    .select('id, data, updated_at, player:players(name)')
    .eq('owner_id', ctx.userId)
    .order('name')
    .limit(200)
  if (error) throw error
  return {
    investigators: (data ?? []).map((c) => {
      const d = (c.data ?? {}) as { name?: string; occupation?: string; age?: number }
      const p = c.player as { name: string } | null
      return { characterId: c.id, name: d.name ?? '', occupation: d.occupation ?? '', age: d.age, player: p?.name ?? null, updatedAt: c.updated_at, url: characterUrl(c.id) }
    }),
  }
}

async function getInvestigator(ctx: Ctx, args: Record<string, unknown>) {
  const c = await loadOwnCharacter(ctx, args.characterId)
  const choices = choicesOf(c.data, c.player?.name ?? null)
  return {
    characterId: c.id,
    version: c.updated_at,
    url: characterUrl(c.id),
    player: c.player?.name ?? null,
    sheet: investigatorView(c.data),
    hasPlayProgress: !!(c.data as { progress?: unknown } | null)?.progress,
    choices,
    ...(choices ? {} : { note: 'This investigator was not made with the creation rules (no saved choices). To change it with save_investigator, send complete choices: the sheet is rebuilt from them.' }),
  }
}

async function callTool(ctx: Ctx, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'grimoire_guide': {
      const topic = (GUIDE_TOPICS as readonly string[]).includes(args.topic as string) ? (args.topic as GuideTopic) : 'workflow'
      return guideText(topic)
    }
    case 'save_outline':
      return await saveOutline(ctx, args)
    case 'write_scenes':
      return await writeScenes(ctx, args)
    case 'list_my_stories':
      return await listMyStories(ctx)
    case 'get_story':
      return await getStory(ctx, args)
    case 'edit_story':
      return await editStory(ctx, args)
    case 'save_image':
      return await saveImage(ctx, args)
    case 'check_investigator':
      return checkInvestigator(args)
    case 'save_investigator':
      return await saveInvestigator(ctx, args)
    case 'list_my_investigators':
      return await listMyInvestigators(ctx)
    case 'get_investigator':
      return await getInvestigator(ctx, args)
    default:
      throw new ToolError('bad_request', `Unknown tool ${name}.`)
  }
}

function buildServer(ctx: Ctx) {
  const server = new Server(
    { name: 'grimoire', title: 'Grimoire', version: '1.0.0', websiteUrl: APP_URL },
    { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS },
  )
  const tools = toolDefinitions()
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }))
  server.setRequestHandler(CallToolRequestSchema, async (req: CallToolRequest) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>
    try {
      const out = await callTool(ctx, req.params.name, args)
      return { content: [{ type: 'text' as const, text: typeof out === 'string' ? out : JSON.stringify(out, null, 1) }] }
    } catch (e) {
      if (e instanceof ToolError) return { isError: true, content: [{ type: 'text' as const, text: `${e.code}: ${e.message}` }] }
      console.error(`mcp ${req.params.name} failed`, e)
      return { isError: true, content: [{ type: 'text' as const, text: 'internal: Grimoire could not do this. Try again in a moment.' }] }
    }
  })
  return server
}

// ------------------------------------------------------------------ HTTP

const withCors = (res: Response) => {
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } })
const unauthorized = (description: string, error?: string) =>
  json({ error: error ?? 'unauthorized', error_description: description }, 401, {
    'WWW-Authenticate': `Bearer resource_metadata="${RESOURCE_METADATA_URL}"${error ? `, error="${error}", error_description="${description}"` : ''}`,
  })

Deno.serve(async (req) => {
  const { pathname } = new URL(req.url)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // RFC 9728: which authorization server issues tokens for this resource.
  if (pathname.endsWith('/.well-known/oauth-protected-resource')) {
    return json({
      resource: PUBLIC_URL,
      authorization_servers: [AUTH_SERVER],
      bearer_methods_supported: ['header'],
      resource_name: 'Grimoire',
      resource_documentation: `${APP_URL}/settings`,
    })
  }
  // Stateless server: no standalone SSE stream, no session to delete.
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST, OPTIONS' })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return unauthorized('Sign in to Grimoire to use these tools.')
  const db = createClient<Database>(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await db.auth.getUser(token)
  if (userError || !userData.user) return unauthorized('The token is invalid or expired.', 'invalid_token')

  const raw = await req.text()
  if (raw.length > MCP_LIMITS.body) return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request too large.' } }, 413)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } }, 400)
  }

  const ctx: Ctx = {
    userId: userData.user.id,
    db,
    admin: createClient<Database>(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } }),
  }
  const server = buildServer(ctx)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    return withCors(await transport.handleRequest(req, { parsedBody: body }))
  } finally {
    // One server per request: nothing to keep once the answer is sent (JSON responses, no stream).
    void server.close()
  }
})
