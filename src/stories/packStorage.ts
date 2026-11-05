// Story packs in Supabase Storage (bucket "story-packs"): <owner id | marketplace>/<story id>/…
// stories.content is what the app reads; the pack holds the same story.json plus the pack's files.
import { supabase } from '@/lib/supabase'
import { zipPack, type PackFile } from './pack'

const BUCKET = 'story-packs'

export interface PackRow {
  id: string
  owner_id: string | null
  pack_files: string[]
}

export const packFolder = (row: PackRow) => `${row.owner_id ?? 'marketplace'}/${row.id}`

const storyJson = (story: unknown) =>
  new Blob([JSON.stringify(story, null, 2) + '\n'], { type: 'application/json' })

/** Write the pack's story.json (after any change to the story). */
export async function writeStoryJson(row: PackRow, story: unknown) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${packFolder(row)}/story.json`, storyJson(story), { upsert: true, contentType: 'application/json' })
  if (error) throw error
}

/**
 * Store a whole pack: story.json and every file, replacing an earlier version (files the new pack
 * no longer has are removed). Records the file list on the story.
 */
export async function writePack(row: PackRow, story: unknown, files: PackFile[], onProgress?: (done: number, total: number) => void) {
  const folder = packFolder(row)
  const total = files.length + 1
  await writeStoryJson(row, story)
  onProgress?.(1, total)
  for (const [i, f] of files.entries()) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${folder}/${f.path}`, new Blob([f.data as BlobPart], { type: f.type }), { upsert: true, contentType: f.type })
    if (error) throw new Error(`${f.path} : ${error.message}`)
    onProgress?.(i + 2, total)
  }
  const kept = new Set(files.map((f) => f.path))
  const stale = row.pack_files.filter((p) => !kept.has(p)).map((p) => `${folder}/${p}`)
  if (stale.length) await supabase.storage.from(BUCKET).remove(stale)
  const { error } = await supabase.from('stories').update({ pack_files: [...kept] }).eq('id', row.id)
  if (error) throw error
}

/** Copy a pack's files to another story's folder (copying a marketplace story keeps its images). */
export async function copyPackFiles(from: PackRow, to: PackRow) {
  for (const p of from.pack_files) {
    const { error } = await supabase.storage.from(BUCKET).copy(`${packFolder(from)}/${p}`, `${packFolder(to)}/${p}`)
    if (error) throw new Error(`${p} : ${error.message}`)
  }
  if (from.pack_files.length) await supabase.from('stories').update({ pack_files: from.pack_files }).eq('id', to.id)
}

/** The pack as a .zip: the story as the app has it, plus every stored file. */
export async function downloadPack(row: PackRow & { content: unknown }): Promise<Blob> {
  const folder = packFolder(row)
  const files = await Promise.all(
    row.pack_files.map(async (path) => {
      const { data, error } = await supabase.storage.from(BUCKET).download(`${folder}/${path}`)
      if (error || !data) throw new Error(`${path} : ${error?.message ?? 'introuvable'}`)
      return { path, data: new Uint8Array(await data.arrayBuffer()) }
    }),
  )
  return new Blob([zipPack(row.content, files) as BlobPart], { type: 'application/zip' })
}

/** Remove a story's pack (with the story). */
export async function deletePack(row: PackRow) {
  const folder = packFolder(row)
  await supabase.storage.from(BUCKET).remove([`${folder}/story.json`, ...row.pack_files.map((p) => `${folder}/${p}`)])
}
