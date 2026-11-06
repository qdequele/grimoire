/**
 * Long documents (privacy policy, terms, connector help) are written whole in each language, like a
 * story's text, instead of sentence by sentence through t(): a legal text must read as one piece and
 * its two versions are reviewed side by side. The page around them (titles, links) still uses t().
 *
 * Inline markup: **bold**, [text](https://… or /path or mailto:…), and the placeholders {contact},
 * {publisher}, {site}, {mcp}, and {claudeAdd} as a link target (filled by LegalPage).
 */

/** A paragraph, or a bullet list. */
export type Block = string | string[]

export interface LegalSection {
  title: string
  blocks: Block[]
}

export interface LegalDoc {
  title: string
  intro: Block[]
  sections: LegalSection[]
}

export type Bilingual = { fr: LegalDoc; en: LegalDoc }
