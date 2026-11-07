// Story lists' language filter. A story keeps its own language (meta.lang); the lists show the
// app's language first and let the keeper pick another one, or all of them.

/** Filter value that shows every story. */
export const ALL_LANGS = 'all'

/** "fr-FR", " FR " → "fr": stories are matched on the primary language subtag. */
export function langCode(lang: string | undefined): string {
  return (lang ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? ''
}

/** The languages the stories are written in: the app's language first, then by code. */
export function storyLanguages(stories: Array<{ content: { meta: { lang: string } } }>, appLang: string): string[] {
  const codes = new Set(stories.map((s) => langCode(s.content.meta.lang)).filter(Boolean))
  return [...codes].sort((a, b) => Number(b === appLang) - Number(a === appLang) || a.localeCompare(b))
}

/**
 * The filter to apply: the keeper's choice when there is one, else the app's language, unless no
 * story is written in it (then every story, rather than an empty list).
 */
export function pickLanguage(chosen: string | null, langs: string[], appLang: string): string {
  if (chosen) return chosen === ALL_LANGS ? ALL_LANGS : langCode(chosen)
  return langs.includes(appLang) ? appLang : ALL_LANGS
}

export function filterByLanguage<S extends { content: { meta: { lang: string } } }>(stories: S[], lang: string): S[] {
  return lang === ALL_LANGS ? stories : stories.filter((s) => langCode(s.content.meta.lang) === lang)
}

/** "en" → "English" / "Anglais", in the app's language; the code itself when unknown. */
export function languageName(code: string, uiLang: string): string {
  let name: string | undefined
  try {
    name = new Intl.DisplayNames([uiLang], { type: 'language' }).of(code)
  } catch {
    /* not a valid language code */
  }
  if (!name || name.toLowerCase() === code) return code.toUpperCase()
  return name.charAt(0).toLocaleUpperCase(uiLang) + name.slice(1)
}
