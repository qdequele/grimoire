import { describe, expect, it } from 'vitest'
import { publicPages, TOOL_PATHS } from './pages'
import { render } from './prerender'
import { STORY_METAS } from './scenarios/stories'

// What search engines get from the free tool pages (scripts/prerender.mjs writes them at build time).

describe('free tool pages', () => {
  const pages = publicPages()

  it('lists every tool in both languages and every story, each at its own address', () => {
    expect(pages.length).toBe(Object.keys(TOOL_PATHS).length * 2 + STORY_METAS.length)
    expect(new Set(pages.map((p) => p.path)).size).toBe(pages.length)
  })

  it('gives each page a search-friendly title and description', () => {
    for (const p of pages) {
      expect(p.title.length, p.path).toBeGreaterThan(10)
      expect(`${p.title} · Grimoire`.length, p.path).toBeLessThanOrEqual(100)
      expect(p.description.length, p.path).toBeGreaterThan(50)
    }
  })

  it('pairs each tool page with its translation, both ways', () => {
    for (const p of pages.filter((x) => x.alternate)) {
      const other = pages.find((x) => x.path === p.alternate!.path)
      expect(other?.lang, p.path).toBe(p.alternate!.lang)
      expect(other?.alternate?.path, p.path).toBe(p.path)
    }
  })

  it('renders every page to static HTML with one title, in its language', async () => {
    for (const p of pages) {
      const html = await render(p.path)
      expect(html.match(/<h1[\s>]/g)?.length, p.path).toBe(1)
      expect(html, p.path).toContain(`lang="${p.lang}"`)
    }
  })
})
