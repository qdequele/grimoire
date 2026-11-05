// Makes sure every story exists as a pack in Storage: writes story-packs/<owner|marketplace>/<id>/story.json
// from stories.content. Safe to re-run (other pack files are left alone). Run after `pnpm db:reset`
// (the seed can't write Storage) and once on existing data:
//
//   pnpm packs:sync        (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, see package.json)
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
const admin = createClient(url, key, { auth: { persistSession: false } })

const { data: stories, error } = await admin.from('stories').select('id, owner_id, content, title')
if (error) throw error
let written = 0
for (const s of stories) {
  const path = `${s.owner_id ?? 'marketplace'}/${s.id}/story.json`
  const { error: e } = await admin.storage
    .from('story-packs')
    .upload(path, new Blob([JSON.stringify(s.content, null, 2) + '\n'], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
  if (e) console.error(`${s.title}: ${e.message}`)
  else written++
}
console.log(`${written}/${stories.length} story packs written`)
