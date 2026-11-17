// AI import: book pages / notes screenshots → private Grimoire story.
//
// The browser uploads page images to the private `import-pages` bucket (under <user id>/), then
// calls this function once per small batch of pages with the same importId. Each call:
//   1. checks the caller and their monthly page quota,
//   2. reads the batch's images and deletes them from storage straight away,
//   3. counts the batch's pages (story_import_batches), then asks Claude for an ImportDraft (plain
//      JSON, coerced by normalizeDraft; see _shared/import-draft.ts),
//   4. merges it into the import's draft, converts to story.json, validates against the spec,
//   5. saves the result as the caller's private story and returns it.
//
// Quota: pages are counted per call, at the call's date (import_pages_used in the database), so an
// import continued in a later month still counts. A call Claude answered counts even when the
// answer can't be used (refused, too long, unreadable, cut at the deadline): the tokens were spent.
// A call the AI service turned down (busy, error) is not counted.
//
// Batches stay small so a call fits in the Edge Function wall-clock limit (150 s, then the worker is
// killed). Claude is cut at AI_DEADLINE_MS from the request's start so the function can still mark
// the import failed and answer "try again", as create-story does.
//
// Secrets: ANTHROPIC_API_KEY (required). Optional: IMPORT_MONTHLY_PAGE_LIMIT (default 60),
// IMPORT_MAX_PAGES_PER_CALL (default 2), AI_DEADLINE_MS (default 130000, shared with create-story;
// IMPORT_AI_DEADLINE_MS overrides it here). SUPABASE_URL /
// SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { Ajv2020 } from 'npm:ajv@8.20.0/dist/2020.js'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import {
  draftAnswerFormat,
  draftContext,
  draftToStory,
  emptyDraft,
  mergeDraft,
  normalizeDraft,
  parseJsonAnswer,
  SOUND_IDS,
  type ImportDraft,
} from '../_shared/import-draft.ts'
import type { Database, Json } from '../_shared/database.types.ts'
import { importSystemPrompt, importUserText } from '../_shared/import-prompt.ts'
import { STORY_SCHEMA } from '../_shared/spec-bundle.ts'

const MODEL = 'claude-opus-5-5'
const MONTHLY_PAGE_LIMIT = Number(Deno.env.get('IMPORT_MONTHLY_PAGE_LIMIT') ?? 60)
const MAX_PAGES_PER_CALL = Number(Deno.env.get('IMPORT_MAX_PAGES_PER_CALL') ?? 2)
// IMPORT_AI_DEADLINE_MS lets the tests shorten this function's deadline alone.
const AI_DEADLINE_MS = Number(Deno.env.get('IMPORT_AI_DEADLINE_MS') ?? Deno.env.get('AI_DEADLINE_MS') ?? 130_000)
const TIMEOUT_MESSAGE = 'L’IA a mis trop de temps à répondre. Réessaie.'
const LANGS = ['fr', 'en']
const MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
type MediaType = (typeof MEDIA_TYPES)[number]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status)

interface ImportRequest {
  importId?: string
  pagePaths: string[]
  /** 1-based position of the first page of this batch in the whole import, for the prompt. */
  firstPage: number
  totalPages: number
  lang: string
  title?: string
}

function parseRequest(body: unknown): ImportRequest | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.'
  const b = body as Record<string, unknown>
  if (!Array.isArray(b.pagePaths) || !b.pagePaths.length || !b.pagePaths.every((p) => typeof p === 'string'))
    return 'pagePaths must be a non-empty list of storage paths.'
  if (b.pagePaths.length > MAX_PAGES_PER_CALL) return `At most ${MAX_PAGES_PER_CALL} pages per call.`
  if (typeof b.lang !== 'string' || !LANGS.includes(b.lang)) return `lang must be one of ${LANGS.join(', ')}.`
  if (b.importId !== undefined && typeof b.importId !== 'string') return 'importId must be a string.'
  const firstPage = Number(b.firstPage ?? 1)
  const totalPages = Number(b.totalPages ?? b.pagePaths.length)
  return {
    importId: b.importId as string | undefined,
    pagePaths: b.pagePaths as string[],
    firstPage,
    totalPages,
    lang: b.lang,
    title: typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 200) : undefined,
  }
}

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'story'

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateStory = ajv.compile(STORY_SCHEMA)
// No structured output: the draft schema's grammar is too large for the API. The schema goes in the
// prompt as text and normalizeDraft() coerces the answer (see import-draft.ts).
const ANSWER_FORMAT = draftAnswerFormat(SOUND_IDS)
const SYSTEM_PROMPT = importSystemPrompt()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.')
  const deadline = Date.now() + AI_DEADLINE_MS

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return fail(503, 'not_configured', 'The import is not configured on this server (missing ANTHROPIC_API_KEY).')

  // ---- who is calling
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const asUser = createClient<Database>(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await asUser.auth.getUser()
  if (userError || !userData.user) return fail(401, 'unauthorized', 'Log in to import a story.')
  const userId = userData.user.id
  // Service role: writes story_imports (users can't) and reads/deletes the uploaded pages.
  const admin = createClient<Database>(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let parsed: ImportRequest | string
  try {
    parsed = parseRequest(await req.json())
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON.')
  }
  if (typeof parsed === 'string') return fail(400, 'bad_request', parsed)
  const input = parsed
  if (!input.pagePaths.every((p) => p.startsWith(`${userId}/`) && !p.includes('..')))
    return fail(403, 'forbidden', 'Pages must be in your own upload folder.')

  // Pages are read once and never kept, whatever happens below.
  const removePages = () => admin.storage.from('import-pages').remove(input.pagePaths)
  // Known once the import row and this call's usage row exist: the catch below needs them.
  let importId: string | undefined
  let batchId: string | undefined
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    // ---- quota
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', userId).single()
    if (!profile?.is_admin) {
      const { data: used, error } = await admin.rpc('import_pages_used', { p_owner: userId })
      if (error) throw error
      if (used + input.pagePaths.length > MONTHLY_PAGE_LIMIT) {
        return fail(429, 'quota_exceeded', `Monthly import limit reached (${used}/${MONTHLY_PAGE_LIMIT} pages).`)
      }
    }

    // ---- the import this batch belongs to
    let importRow: { id: string; draft: ImportDraft | null; story_id: string | null; page_count: number }
    if (input.importId) {
      const { data, error } = await admin
        .from('story_imports')
        .select('id, draft, story_id, page_count, owner_id')
        .eq('id', input.importId)
        .single()
      if (error || !data || data.owner_id !== userId) return fail(404, 'not_found', 'Unknown import.')
      importRow = { ...data, draft: data.draft as unknown as ImportDraft | null }
    } else {
      const { data, error } = await admin
        .from('story_imports')
        .insert({ owner_id: userId, status: 'running', page_count: 0 })
        .select('id, draft, story_id, page_count')
        .single()
      if (error) throw error
      importRow = { ...data, draft: data.draft as unknown as ImportDraft | null }
    }
    importId = importRow.id
    await admin.from('story_imports').update({ status: 'running', error: null }).eq('id', importRow.id)

    // ---- read the pages
    const images: Anthropic.ImageBlockParam[] = []
    for (const path of input.pagePaths) {
      const { data, error } = await admin.storage.from('import-pages').download(path)
      if (error || !data) {
        await markFailed(admin, importRow.id, 'page_missing')
        return fail(400, 'page_missing', `Page not found: ${path.split('/').pop()}`)
      }
      const mediaType = (MEDIA_TYPES as readonly string[]).includes(data.type) ? (data.type as MediaType) : 'image/png'
      images.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: encodeBase64(new Uint8Array(await data.arrayBuffer())) },
      })
    }

    // The pages are in memory: nothing is left in storage if the worker is killed while Claude
    // answers. (The `finally` below still covers the early returns above.)
    await removePages()

    // ---- ask Claude for this batch's draft
    const left = deadline - Date.now()
    if (left < 10_000) {
      await markFailed(admin, importRow.id, 'timeout')
      return fail(504, 'timeout', TIMEOUT_MESSAGE)
    }
    // Counted before the call, so a batch whose answer can't be used still counts.
    const { data: usage, error: usageError } = await admin
      .from('story_import_batches')
      .insert({ owner_id: userId, import_id: importRow.id, pages: input.pagePaths.length })
      .select('id')
      .single()
    if (usageError) throw usageError
    batchId = usage.id

    const accumulated = importRow.draft ?? emptyDraft()
    const last = input.firstPage + input.pagePaths.length - 1
    const client = new Anthropic({ apiKey })
    timer = setTimeout(() => controller.abort(), left)
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            ...images,
            {
              type: 'text',
              text: importUserText({
                lang: input.lang,
                context: draftContext(accumulated),
                pageNumbers: `${input.firstPage}-${last} of ${input.totalPages}`,
                titleHint: input.title,
              }) + '\n\n' + ANSWER_FORMAT,
            },
          ],
        },
      ],
    }, { signal: controller.signal })
    const message = await stream.finalMessage()
    clearTimeout(timer)

    if (message.stop_reason === 'refusal') {
      await markFailed(admin, importRow.id, 'refused')
      return fail(422, 'refused', 'These pages could not be converted. Try other pages or a clearer photo.')
    }
    if (message.stop_reason === 'max_tokens') {
      await markFailed(admin, importRow.id, 'too_long')
      return fail(422, 'too_long', 'Too much content in one go. Send fewer pages per batch.')
    }
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const answer = parseJsonAnswer(text)
    if (!answer || typeof answer !== 'object') {
      await markFailed(admin, importRow.id, 'invalid_output')
      return fail(502, 'invalid_output', 'The AI answer could not be read. Try this batch again.')
    }
    const batch: ImportDraft = normalizeDraft(answer)

    // ---- merge, convert, validate, save
    const draft = mergeDraft(accumulated, batch)
    const storyMetaId = importRow.story_id
      ? undefined
      : `${slugify(input.title || draft.title)}-${importRow.id.slice(0, 6)}`
    let storyId = importRow.story_id
    let existingMetaId: string | undefined
    if (storyId) {
      const { data } = await admin.from('stories').select('content').eq('id', storyId).single()
      existingMetaId = (data?.content as { meta?: { id?: string } } | undefined)?.meta?.id
    }
    const story = draftToStory(draft, { id: existingMetaId ?? storyMetaId ?? 'imported-story', lang: input.lang })
    if (input.title) (story.meta as Record<string, unknown>).title = input.title
    const valid = validateStory(story)
    const validationErrors = valid
      ? []
      : (validateStory.errors ?? []).slice(0, 50).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim())

    if (storyId) {
      const { error } = await admin.from('stories').update({ content: story as Json }).eq('id', storyId).eq('owner_id', userId)
      if (error) throw error
    } else if ((story.acts as unknown[] | undefined)?.length) {
      const { data, error } = await admin
        .from('stories')
        .insert({ owner_id: userId, visibility: 'private', content: story as Json })
        .select('id')
        .single()
      if (error) throw error
      storyId = data.id
    }

    // Every story also lives as a pack in Storage (story-packs/<owner>/<story>/story.json).
    if (storyId) {
      const { error } = await admin.storage
        .from('story-packs')
        .upload(`${userId}/${storyId}/story.json`, new Blob([JSON.stringify(story, null, 2) + '\n'], { type: 'application/json' }), {
          upsert: true,
          contentType: 'application/json',
        })
      if (error) console.error('story pack write failed', error)
    }

    await admin.from('story_import_batches').update({ saved: true }).eq('id', batchId)
    await admin
      .from('story_imports')
      .update({
        status: 'succeeded',
        draft: draft as unknown as Json,
        story_id: storyId,
        page_count: importRow.page_count + input.pagePaths.length,
        input_tokens: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0),
        output_tokens: message.usage.output_tokens,
        finished_at: new Date().toISOString(),
      })
      .eq('id', importRow.id)

    return json({ importId: importRow.id, storyId, story, validationErrors })
  } catch (e) {
    console.error('import-story failed', e)
    if (controller.signal.aborted) {
      // Cut at the deadline: Claude was writing, the pages stay counted.
      if (importId) await markFailed(admin, importId, 'timeout')
      return fail(504, 'timeout', TIMEOUT_MESSAGE)
    }
    if (e instanceof Anthropic.APIError) {
      // The AI service gave no answer: this call is not counted.
      if (batchId) await admin.from('story_import_batches').delete().eq('id', batchId)
      const busy = e instanceof Anthropic.RateLimitError
      if (importId) await markFailed(admin, importId, busy ? 'busy' : 'ai_error')
      if (busy) return fail(429, 'busy', 'The AI service is busy. Try again in a minute.')
      return fail(502, 'ai_error', `AI service error (${e.status ?? 'network'}).`)
    }
    if (importId) await markFailed(admin, importId, 'internal')
    return fail(500, 'internal', 'Import failed.')
  } finally {
    clearTimeout(timer)
    await removePages()
  }
})

async function markFailed(admin: SupabaseClient<Database>, id: string, error: string) {
  await admin.from('story_imports').update({ status: 'failed', error, finished_at: new Date().toISOString() }).eq('id', id)
}
