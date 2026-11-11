// Saving a story written by the creator (website or MCP connector): the stories row and the pack's
// story.json in Storage, which every code path that saves stories.content must keep in step
// (CLAUDE.md, "Story packs in Storage").
//
// The client is the caller's: the service role in create-story (with explicit owner checks), the
// keeper's own token in the mcp function (RLS: private stories and pack files of their own only).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import type { Database, Json } from './database.types.ts'

type Db = SupabaseClient<Database>

/**
 * The story an earlier batch saved and the meta.id it carries, so a story keeps its id across
 * batches. A story the keeper deleted meanwhile starts over (null).
 */
export async function existingStory(db: Db, storyId: string | null, fallbackMetaId: string) {
  if (!storyId) return { storyId: null, metaId: fallbackMetaId }
  const { data } = await db.from('stories').select('content').eq('id', storyId).maybeSingle()
  if (!data) return { storyId: null, metaId: fallbackMetaId }
  const metaId = (data.content as { meta?: { id?: string } } | null)?.meta?.id ?? fallbackMetaId
  return { storyId, metaId }
}

/** Write the pack's story.json. A failure is logged, not fatal: `pnpm packs:sync` can rewrite it. */
export async function writePackJson(db: Db, ownerId: string, storyId: string, story: unknown) {
  const { error } = await db.storage
    .from('story-packs')
    .upload(`${ownerId}/${storyId}/story.json`, new Blob([JSON.stringify(story, null, 2) + '\n'], { type: 'application/json' }), {
      upsert: true,
      contentType: 'application/json',
    })
  if (error) console.error('story pack write failed', error)
}

/** Insert (no storyId) or update the keeper's private story, then its story.json. Returns the story id. */
export async function saveStory(db: Db, ownerId: string, storyId: string | null, story: unknown): Promise<string> {
  let id = storyId
  if (id) {
    const { error } = await db.from('stories').update({ content: story as Json }).eq('id', id).eq('owner_id', ownerId)
    if (error) throw error
  } else {
    const { data, error } = await db
      .from('stories')
      .insert({ owner_id: ownerId, visibility: 'private', content: story as Json })
      .select('id')
      .single()
    if (error) throw error
    id = data.id
  }
  await writePackJson(db, ownerId, id, story)
  return id
}

/**
 * Upload one file of the pack (a picture) and list it in stories.pack_files: a picture missing from
 * pack_files is never shown (src/games/screen.ts, packImage).
 */
export async function savePackFile(db: Db, ownerId: string, storyId: string, path: string, body: string, contentType: string) {
  const { error } = await db.storage.from('story-packs').upload(`${ownerId}/${storyId}/${path}`, new Blob([body], { type: contentType }), { upsert: true, contentType })
  if (error) throw error
  const { data, error: readError } = await db.from('stories').select('pack_files').eq('id', storyId).eq('owner_id', ownerId).single()
  if (readError) throw readError
  const files = data.pack_files ?? []
  if (!files.includes(path)) {
    const { error: writeError } = await db.from('stories').update({ pack_files: [...files, path] }).eq('id', storyId).eq('owner_id', ownerId)
    if (writeError) throw writeError
  }
}
