// Converts the private legacy dump (private/legacy-dump/*.json) into story packs in private/stories/,
// and optionally uploads them to an account as PRIVATE stories (replacing earlier uploads).
//
//   node scripts/convert-legacy.ts                     # write private/stories/<id>/story.json
//   node scripts/convert-legacy.ts --upload you@x.com  # …and add them to that account (local Supabase)
//
// Upload needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see `supabase status -o env`).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { legacyToStories } from '../src/play/legacy/convert.ts'
import { SKILLS } from '../src/rules/d100.ts'

const DUMP = 'private/legacy-dump'
const OUT = 'private/stories'

const dump: Record<string, unknown> = {}
for (const f of readdirSync(DUMP)) dump[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(`${DUMP}/${f}`, 'utf8'))

const labelToId = Object.fromEntries(SKILLS.map((s) => [s.label, s.id]))
const engineData = existsSync('private/engine-data.json') ? JSON.parse(readFileSync('private/engine-data.json', 'utf8')) : {}
const stories = legacyToStories(dump as never, labelToId, engineData.I18N?.ui ?? {})

for (const story of stories) {
  const id = (story.meta as { id: string }).id
  mkdirSync(`${OUT}/${id}`, { recursive: true })
  writeFileSync(`${OUT}/${id}/story.json`, JSON.stringify(story, null, 2) + '\n')
  console.log(`${OUT}/${id}/story.json`)
}

const i = process.argv.indexOf('--upload')
if (i > 0) {
  const email = process.argv[i + 1]
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!email || !url || !key) throw new Error('Usage: --upload <email>, with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set')
  const admin = createClient(url, key, { auth: { persistSession: false } })
  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  const user = users.users.find((u) => u.email === email)
  if (!user) throw new Error(`No account for ${email}`)
  for (const story of stories) {
    const metaId = (story.meta as { id: string }).id
    // Replace an earlier upload of the same scenario (matched on meta.id), keeping its games.
    const { data: existing } = await admin
      .from('stories')
      .select('id')
      .eq('owner_id', user.id)
      .eq('content->meta->>id', metaId)
      .maybeSingle()
    const { data: saved, error: e } = existing
      ? await admin.from('stories').update({ content: story }).eq('id', existing.id).select('id').single()
      : await admin.from('stories').insert({ owner_id: user.id, visibility: 'private', content: story }).select('id').single()
    if (e) throw e
    // …and its pack in Storage, like every story.
    const { error: pe } = await admin.storage
      .from('story-packs')
      .upload(`${user.id}/${saved.id}/story.json`, new Blob([JSON.stringify(story, null, 2) + '\n'], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
    if (pe) throw pe
    console.log(`${existing ? 'updated' : 'added'} "${(story.meta as { title: string }).title}" for ${email}`)
  }
}
