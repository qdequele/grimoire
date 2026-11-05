import { create } from 'zustand'

export type Skin = 'deco' | 'classic'

export const SKIN_LABEL: Record<Skin, string> = { deco: 'Art déco', classic: 'Classique' }

// Same storage key as the legacy app, so the choice carries over. index.html applies it before
// first paint; this store keeps React and <html data-skin> in sync afterwards.
const KEY = 'gardien-skin'

function initialSkin(): Skin {
  const fromDom = document.documentElement.dataset.skin
  return fromDom === 'classic' ? 'classic' : 'deco'
}

interface SkinState {
  skin: Skin
  setSkin: (skin: Skin) => void
  toggle: () => void
}

export const useSkin = create<SkinState>((set, get) => ({
  skin: initialSkin(),
  toggle: () => get().setSkin(get().skin === 'deco' ? 'classic' : 'deco'),
  setSkin: (skin) => {
    document.documentElement.dataset.skin = skin
    try {
      localStorage.setItem(KEY, skin)
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    set({ skin })
  },
}))
