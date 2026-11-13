import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPhoto } from '@/characters/photo'
import { PORTRAIT_SUBJECTS } from './portraits'
import { checkDraft } from '@/engine/creation'
import { PROFILE_FIELDS } from '@/rules/d100'
import { FORBIDDEN_NAMES } from '../../../supabase/functions/_shared/create-prompt'
import { hasMarkup, SHEET_LIMITS } from '@/characters/character'
import { PREGENS, pregenData, pregenDraft } from './pregens'

describe('pre-generated investigators', () => {
  it('are a dozen, with distinct ids and names', () => {
    expect(PREGENS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(PREGENS.map((p) => p.id)).size).toBe(PREGENS.length)
    expect(new Set(PREGENS.map((p) => p.name)).size).toBe(PREGENS.length)
  })

  it.each(PREGENS.map((p) => [p.id, p] as const))('%s follows the creation rules, in both languages', (_, p) => {
    for (const lang of ['fr', 'en'] as const) {
      const { issues, warnings } = checkDraft(pregenDraft(p, lang))
      expect(issues).toEqual([])
      expect(warnings).toEqual([])
      const data = pregenData(p, lang)
      expect(data.name).toBe(p.name)
      expect(Object.keys(data.skills)).toHaveLength(new Set([...p.skills, ...p.interests, 'dodge', 'credit-rating']).size)
      for (const f of PROFILE_FIELDS) {
        const text = data.profile?.[f.id] ?? ''
        expect(text.length, `${lang} ${f.id}`).toBeGreaterThan(0)
        expect(text.length).toBeLessThanOrEqual(SHEET_LIMITS.profile)
      }
    }
  })

  it('every skill that needs a specialty has one', () => {
    for (const p of PREGENS) {
      for (const key of Object.keys(pregenData(p, 'fr').skills)) {
        const [id, specialty] = key.split(/:(.*)/)
        if (['art-craft', 'language-other', 'pilot', 'science', 'science-2', 'survival'].includes(id)) {
          expect(specialty?.trim(), `${p.id} ${id}`).toBeTruthy()
        }
      }
    }
  })

  it('names and texts are safe and original', () => {
    for (const p of PREGENS) {
      expect(hasMarkup(p.name)).toBe(false)
      const all = JSON.stringify(p.text).toLowerCase() + p.name.toLowerCase()
      for (const n of FORBIDDEN_NAMES) expect(all, `${p.id}: ${n}`).not.toContain(n.toLowerCase())
    }
  })

  it('each has a portrait prompt; every shipped portrait is a photo the database accepts', () => {
    expect(Object.keys(PORTRAIT_SUBJECTS).sort()).toEqual(PREGENS.map((p) => p.id).sort())
    const dir = join(import.meta.dirname, 'portraits')
    for (const file of readdirSync(dir).filter((f) => !f.startsWith('.'))) {
      const id = file.replace(/\.jpg$/, '')
      expect(PREGENS.some((p) => p.id === id), `${file} names a pregen`).toBe(true)
      expect(isPhoto(`data:image/jpeg;base64,${readFileSync(join(dir, file)).toString('base64')}`), file).toBe(true)
    }
  })
})
