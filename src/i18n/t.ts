import { createContext, useContext } from 'react'
import { SKILL_BY_ID } from '@/rules/d100'
import { useLang, type Lang } from '@/settings/lang'
import { EN } from './en'

export type Vars = Record<string, string | number>

/**
 * The app is written in French: the French text is the key, `en.ts` has its English version.
 * `{name}` placeholders are filled from vars. Text with no English version (a story's own words,
 * a name typed by the keeper) is shown as is.
 */
export function translate(lang: Lang, fr: string, vars?: Vars): string {
  const text = lang === 'en' ? (EN[fr] ?? fr) : fr
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text
}

export type T = ((fr: string, vars?: Vars) => string) & {
  lang: Lang
  /** "{n} investigateur" / "{n} investigateurs", picked by n. */
  n: (n: number, one: string, many: string) => string
  /** Date in the current language. */
  date: (d: string | number | Date, opts?: Intl.DateTimeFormatOptions) => string
}

export function makeT(lang: Lang): T {
  const t = ((fr: string, vars?: Vars) => translate(lang, fr, vars)) as T
  t.lang = lang
  // French: 0 and 1 are singular. English: only 1.
  t.n = (n, one, many) => translate(lang, (lang === 'en' ? n === 1 : n <= 1) ? one : many, { n })
  t.date = (d, opts = { day: 'numeric', month: 'short' }) =>
    new Date(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', opts)
  return t
}

const cache = { fr: makeT('fr'), en: makeT('en') }

/**
 * A page whose language comes from its address (the free tools, one address per language) sets it
 * for everything inside, without changing the visitor's own setting.
 */
export const PageLang = createContext<Lang | null>(null)

/** Translation function for the current language; components re-render when it changes. */
export function useT(): T {
  const setting = useLang((s) => s.lang)
  return cache[useContext(PageLang) ?? setting]
}

/** Outside React (mutations, helpers): the current language, read once. */
export const currentT = (): T => cache[useLang.getState().lang]

/**
 * A message built elsewhere (errors, warnings): translated whole when it is a known text, else its
 * "Label : detail" label is translated and the detail (a path, a server message) kept as is.
 */
export function tMsg(t: T, msg: string): string {
  if (t(msg) !== msg) return t(msg)
  const i = msg.indexOf(' : ')
  return i > 0 ? t('{label} : {detail}', { label: t(msg.slice(0, i)), detail: msg.slice(i + 3) }) : msg
}

/**
 * A skill's French label in the current language. Skills have their own entries ("compétence:…"),
 * since some labels are also ordinary words with another meaning (Bibliothèque, Lancer).
 */
export function skillText(t: T, label: string): string {
  const key = `${SKILL_PREFIX}${label}`
  const text = t(key)
  return text === key ? label : text
}
export const SKILL_PREFIX = 'compétence:'

/** A skill's name in the current language, with its specialty: "Arts et métiers (Photographie)". */
export function skillName(t: T, id: string, specialty?: string): string {
  const def = SKILL_BY_ID.get(id)
  if (!def) return id
  return specialty?.trim() ? `${skillText(t, def.label.replace(' (autre)', ''))} (${t(specialty.trim())})` : skillText(t, def.label)
}
