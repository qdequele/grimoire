// AI import: book pages / notes screenshots → private Grimoire story.
//
// The browser uploads page images to the private `import-pages` bucket (under <user id>/), then
// calls this function once per small batch of pages with the same importId. Each call:
//   1. checks the caller and their monthly page quota,
//   2. reads the batch's images and deletes them from storage straight away,
//   3. asks Claude for an ImportDraft (plain JSON, coerced by normalizeDraft; see _shared/import-draft.ts),
//   4. merges it into the import's draft, converts to story.json, validates against the spec,
//   5. saves the result as the caller's private story and returns it.
//
// Batches stay small so a call fits in the Edge Function wall-clock limit.
//
// Secrets: ANTHROPIC_API_KEY (required). Optional: IMPORT_MONTHLY_PAGE_LIMIT (default 60),
// IMPORT_MAX_PAGES_PER_CALL (default 4). SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

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
const MAX_PAGES_PER_CALL = Number(Deno.env.get('IMPORT_MAX_PAGES_PER_CALL') ?? 4)
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

  try {
    // ---- quota
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', userId).single()
    if (!profile?.is_admin) {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)
      const { data: rows, error } = await admin
        .from('story_imports')
        .select('page_count')
        .eq('owner_id', userId)
        .gte('created_at', monthStart.toISOString())
      if (error) throw error
      const used = (rows ?? []).reduce((n, r) => n + (r.page_count as number), 0)
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
    await admin.from('story_imports').update({ status: 'running', error: null }).eq('id', importRow.id)

    // ---- read the pages
    const images: Anthropic.ImageBlockParam[] = []
    for (const path of input.pagePaths) {
      const { data, error } = await admin.storage.from('import-pages').download(path)
      if (error || !data) return fail(400, 'page_missing', `Page not found: ${path.split('/').pop()}`)
      const mediaType = (MEDIA_TYPES as readonly string[]).includes(data.type) ? (data.type as MediaType) : 'image/png'
      images.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: encodeBase64(new Uint8Array(await data.arrayBuffer())) },
      })
    }

    // ---- ask Claude for this batch's draft
    const accumulated = importRow.draft ?? emptyDraft()
    const last = input.firstPage + input.pagePaths.length - 1
    const client = new Anthropic({ apiKey })
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
    })
    const message = await stream.finalMessage()

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
    if (e instanceof Anthropic.RateLimitError) return fail(429, 'busy', 'The AI service is busy. Try again in a minute.')
    if (e instanceof Anthropic.APIError) return fail(502, 'ai_error', `AI service error (${e.status ?? 'network'}).`)
    return fail(500, 'internal', 'Import failed.')
  } finally {
    await removePages()
  }
})

async function markFailed(admin: SupabaseClient<Database>, id: string, error: string) {
  await admin.from('story_imports').update({ status: 'failed', error, finished_at: new Date().toISOString() }).eq('id', id)
}
