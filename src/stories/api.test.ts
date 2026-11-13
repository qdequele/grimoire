import { describe, expect, it, vi } from 'vitest'

// CI runs the unit tests without Supabase keys: the real client throws at import.
vi.mock('@/lib/supabase', () => ({ supabase: {}, supabaseUrl: '', supabaseAnonKey: '' }))
const { sceneCount, storyContent } = await import('./api')

const meta = { id: 'x', title: 'X', lang: 'fr' }

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
