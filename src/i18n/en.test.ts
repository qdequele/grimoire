import { describe, expect, it } from 'vitest'
import { EN } from './en'
import { dataKeys, literalKeys } from './keys'
import { makeT, tMsg } from './t'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('English translation', () => {
  const keys = [...new Set([...literalKeys(), ...dataKeys()])]

  it('covers every French text of the app', () => {
    expect(keys.length).toBeGreaterThan(200)
    expect(keys.filter((k) => !(k in EN))).toEqual([])
  })

  it('keeps the same {placeholders} and **bold** parts', () => {
    const bad = keys.filter((k) => k in EN && (
      placeholders(k).join() !== placeholders(EN[k]).join() || (k.match(/\*\*/g) ?? []).length !== (EN[k].match(/\*\*/g) ?? []).length
    ))
    expect(bad).toEqual([])
  })

  it('has no leftover entries', () => {
    expect(Object.keys(EN).filter((k) => !keys.includes(k))).toEqual([])
  })
})

describe('t()', () => {
  const en = makeT('en')
  const fr = makeT('fr')

  it('fills placeholders and picks the plural form', () => {
    expect(fr('Bonsoir, {name}', { name: 'Ada' })).toBe('Bonsoir, Ada')
    expect(fr.n(1, '{n} joueur', '{n} joueurs')).toBe('1 joueur')
    expect(fr.n(3, '{n} joueur', '{n} joueurs')).toBe('3 joueurs')
    expect(en('Bonsoir, {name}', { name: 'Ada' })).toBe(EN['Bonsoir, {name}'].replace('{name}', 'Ada'))
  })

  it('shows unknown text (story words, names) as is', () => {
    expect(en('La Lumière silencieuse')).toBe('La Lumière silencieuse')
  })

  it('translates the label of a "Label : detail" message and keeps the detail', () => {
    expect(tMsg(en, 'Ignoré (hors du dossier de l’histoire) : ../x.png')).toBe(`${EN['Ignoré (hors du dossier de l’histoire)']}: ../x.png`)
  })
})
