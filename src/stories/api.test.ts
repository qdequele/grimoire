import { describe, expect, it, vi } from 'vitest'

// CI runs the unit tests without Supabase keys: the real client throws at import.
vi.mock('@/lib/supabase', () => ({ supabase: {}, supabaseUrl: '', supabaseAnonKey: '' }))
const { importPack, sceneCount, storyContent } = await import('./api')
type PackStore = import('./api').PackStore
type Row = Awaited<ReturnType<PackStore['insert']>>

const meta = { id: 'x', title: 'X', lang: 'fr' }

/** A keeper's stories and Storage folder in memory; uploads fail from the file named `failAt`. */
function fakeStore(rows: Row[] = [], objects: string[] = [], failAt?: string) {
  const state = { rows: rows.map((r) => ({ ...r })), objects: new Set(objects), storyJson: new Map<string, unknown>() }
  const row = (id: string) => state.rows.find((r) => r.id === id)!
  const store: PackStore = {
    find: async (owner, metaId) => state.rows.find((r) => r.owner_id === owner && (r.content as { meta: { id: string } }).meta.id === metaId) ?? null,
    insert: async (owner, content) => {
      const created: Row = {
        id: `story-${state.rows.length + 1}`, owner_id: owner, content, pack_files: [], visibility: 'private', copied_from: null,
        created_at: '', updated_at: '', published_at: null, lang: null, summary: null, title: null,
      }
      state.rows.push(created)
      return { ...created }
    },
    setContent: async (id, content) => ({ ...Object.assign(row(id), { content }) }),
    setPackFiles: async (id, files) => { row(id).pack_files = files },
    remove: async (id) => { state.rows = state.rows.filter((r) => r.id !== id) },
    writeStoryJson: async (r, story) => { state.storyJson.set(r.id, story) },
    // Same order as the real one: story.json, each file, stale files removed, then the list.
    writePack: async (r, story, files, onProgress) => {
      state.storyJson.set(r.id, story)
      onProgress?.(1, files.length + 1)
      for (const [i, f] of files.entries()) {
        if (f.path === failAt) throw new Error(`${f.path} : refused`)
        state.objects.add(`${r.id}/${f.path}`)
        onProgress?.(i + 2, files.length + 1)
      }
      const kept = files.map((f) => f.path)
      for (const p of r.pack_files) if (!kept.includes(p)) state.objects.delete(`${r.id}/${p}`)
      row(r.id).pack_files = kept
    },
    deletePack: async (r) => {
      state.storyJson.delete(r.id)
      for (const p of r.pack_files) state.objects.delete(`${r.id}/${p}`)
    },
  }
  return { store, state }
}

const file = (path: string) => ({ path, data: new Uint8Array([1]), type: 'image/png' })
const storyOf = (title: string) => ({ format: 'grimoire-story/1', meta: { ...meta, title }, acts: [] })

describe('importPack', () => {
  it('creates a private story with its files', async () => {
    const { store, state } = fakeStore()
    const { row, replaced } = await importPack(store, 'keeper', storyOf('New'), [file('images/a.png')])
    expect(replaced).toBe(false)
    expect(row.pack_files).toEqual(['images/a.png'])
    expect(state.rows).toHaveLength(1)
    expect([...state.objects]).toEqual(['story-1/images/a.png'])
  })

  it('leaves nothing behind when a new story’s upload fails', async () => {
    const { store, state } = fakeStore([], [], 'images/b.png')
    await expect(importPack(store, 'keeper', storyOf('New'), [file('images/a.png'), file('images/b.png')])).rejects.toThrow('images/b.png : refused')
    expect(state.rows).toEqual([])
    expect([...state.objects]).toEqual([])
    expect(state.storyJson.size).toBe(0)
  })

  const saved: Row = {
    id: 'old', owner_id: 'keeper', content: storyOf('Old'), pack_files: ['images/old.png'], visibility: 'private', copied_from: null,
    created_at: '', updated_at: '', published_at: null, lang: null, summary: null, title: null,
  }

  it('updates the story with the same meta.id: content and file list together', async () => {
    const { store, state } = fakeStore([saved], ['old/images/old.png'])
    const { row, replaced } = await importPack(store, 'keeper', storyOf('Edited'), [file('images/new.png')])
    expect(replaced).toBe(true)
    expect(row.id).toBe('old')
    expect(state.rows[0]).toMatchObject({ content: storyOf('Edited'), pack_files: ['images/new.png'] })
    expect([...state.objects]).toEqual(['old/images/new.png'])
  })

  it('keeps the saved story when a re-import’s upload fails, and lists what was uploaded', async () => {
    const { store, state } = fakeStore([saved], ['old/images/old.png'], 'images/b.png')
    await expect(importPack(store, 'keeper', storyOf('Edited'), [file('images/a.png'), file('images/b.png')])).rejects.toThrow('images/b.png : refused')
    // The story is still the one the keeper had, in the database and in its pack.
    expect(state.rows[0].content).toEqual(storyOf('Old'))
    expect(state.storyJson.get('old')).toEqual(storyOf('Old'))
    // Nothing in Storage is unlisted: deleting the story or importing again cleans it up.
    expect([...state.objects].sort()).toEqual(['old/images/a.png', 'old/images/old.png'])
    expect(state.rows[0].pack_files.sort()).toEqual(['images/a.png', 'images/old.png'])
  })
})

describe('storyContent', () => {
  it('gives every act its scenes, so a damaged saved story still shows', () => {
    const saved = { format: 'grimoire-story/1', meta, acts: [{ id: 'a1', title: 'I', scenes: [{ id: 's1', title: 'S' }, null] }, { id: 'a2', title: 'II' }, null] }
    const story = storyContent(saved)
    expect(story.acts).toEqual([{ id: 'a1', title: 'I', scenes: [{ id: 's1', title: 'S' }] }, { id: 'a2', title: 'II', scenes: [] }])
    expect(sceneCount(story)).toBe(1)
  })

  it('reads a story without acts as an empty one', () => {
    expect(storyContent({ format: 'grimoire-story/1', meta }).acts).toEqual([])
    expect(sceneCount(storyContent({ format: 'grimoire-story/1', meta, acts: 'oops' }))).toBe(0)
  })

  it('leaves a well-formed story as it is', () => {
    const saved = { format: 'grimoire-story/1', meta, acts: [{ id: 'a1', title: 'I', scenes: [{ id: 's1', title: 'S', lead: 'L' }] }], npcs: [{ id: 'n', name: 'N' }] }
    expect(storyContent(saved)).toEqual(saved)
  })
})
