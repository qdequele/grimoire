import { create } from 'zustand'

export type Lang = 'fr' | 'en'

export const LANG_LABEL: Record<Lang, string> = { fr: 'Français', en: 'English' }

// The game engine reads this same key (its own language switch writes it too), so the choice made
// here is the game screen's language.
const KEY = 'gardien-lang'

function initialLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'fr'
  } catch {
    return 'fr'
  }
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLang = create<LangState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(KEY, lang)
    } catch {
      /* private mode: not remembered */
    }
    setHtmlLang(lang)
    set({ lang })
  },
}))

function setHtmlLang(lang: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}
setHtmlLang(useLang.getState().lang)
