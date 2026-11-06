import { describe, expect, it } from 'vitest'
import type { Bilingual, Block } from './doc'
import { HELP } from './help'
import { LEGAL } from './info'
import { LEGAL_PATHS } from './paths'
import { PRIVACY } from './privacy'
import { TERMS } from './terms'

const DOCS: Record<string, Bilingual> = { PRIVACY, TERMS, HELP }
const texts = (blocks: Block[]) => blocks.flat()
const allTexts = (d: Bilingual['fr']) => [d.title, ...texts(d.intro), ...d.sections.flatMap((s) => [s.title, ...texts(s.blocks)])]
const internal = new Set(Object.values(LEGAL_PATHS).flatMap((p) => Object.values(p)))

describe.each(Object.entries(DOCS))('%s', (_, doc) => {
  it('has the same outline in French and English', () => {
    const shape = (d: Bilingual['fr']) => [d.intro.length, ...d.sections.map((s) => s.blocks.map((b) => (typeof b === 'string' ? 's' : b.length)).join())]
    expect(shape(doc.en)).toEqual(shape(doc.fr))
  })

  it('uses only known placeholders and links to real pages', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const text of allTexts(doc[lang])) {
        for (const [, name] of text.matchAll(/\{(\w+)\}/g)) expect(['contact', 'publisher', 'site', 'mcp', 'claudeAdd'], text).toContain(name)
        for (const [, href] of text.matchAll(/\]\(([^)]+)\)/g)) {
          if (href.startsWith('/')) expect(internal, href).toContain(href)
          else if (href !== '{claudeAdd}') expect(href, text).toMatch(/^https:\/\//)
        }
      }
    }
  })

  it('links internally in its own language', () => {
    for (const lang of ['fr', 'en'] as const) {
      const own = new Set(Object.values(LEGAL_PATHS).map((p) => p[lang]))
      for (const text of allTexts(doc[lang])) for (const [, href] of text.matchAll(/\]\((\/[^)]*)\)/g)) expect(own, `${lang}: ${href}`).toContain(href)
    }
  })
})

describe('LEGAL', () => {
  it('has the details the directories ask for', () => {
    expect(LEGAL.contact).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/)
    expect(LEGAL.site).toMatch(/^https:\/\//)
    expect(LEGAL.publisher).not.toBe('')
    expect(LEGAL.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
