// Starts the legacy game engine inside play.html (the iframe of the game page).
// The engine (public/play/engine.js) is a classic script, run as is: it reads its content from
// GRIMOIRE_DATA and talks to the app through GRIMOIRE_HOST (see host.ts).
import { engineDiceApi } from './dice'
import type { PlayHost } from './host'

const MENU_VIEWS = new Set(['accueil', 'menu', 'histoire', 'parties'])

function fail(message: string) {
  document.body.innerHTML = `<p style="padding:2rem;font-family:sans-serif">${message}</p>`
}

const host: PlayHost | undefined = window.parent !== window ? window.parent.__grimoirePlay : undefined

if (!host) {
  fail('Cette page s’ouvre depuis une partie de Grimoire.')
} else {
  const data = host.data
  const storyId = (data.SCENARIOS[0] as { id: string }).id
  window.GRIMOIRE_HOST = host
  window.GRIMOIRE_DICE = engineDiceApi
  window.GRIMOIRE_DATA = {
    ...data,
    // The legacy NPCS entry has rows as a function.
    NPCS: data.NPC_TABLE ? { [storyId]: { p: data.NPC_TABLE.p, note: data.NPC_TABLE.note, rows: () => data.NPC_ROWS } } : {},
  }

  // Texts neutralised in the public markup: the original when private data has it, else neutral.
  // The marker spans are unwrapped so the page matches the original markup exactly.
  for (const el of document.querySelectorAll<HTMLElement>('[data-t]')) {
    const text = data.TEXTS?.[el.dataset.t ?? ''] ?? el.textContent ?? ''
    el.replaceWith(document.createTextNode(text))
  }
  // Ritual panel texts were taken out of the markup: put the story's back.
  const ritual = data.RITUAL as { title: string; max: number; add: string; sub: string; help: string } | null
  if (ritual) {
    const set = (id: string, text: string) => {
      const el = document.getElementById(id)
      if (el) el.textContent = text
    }
    set('ritTitle', ritual.title)
    set('ritMax', String(ritual.max))
    set('pmAdd', ritual.add)
    set('pmSub', ritual.sub)
    const help = document.getElementById('ritHelp')
    if (help) help.innerHTML = ritual.help
  }
  // Drop the placeholder markers so the panel's markup is the original one.
  document.getElementById('ritTitle')?.removeAttribute('id')
  document.getElementById('ritHelp')?.removeAttribute('id')
  const max = document.getElementById('ritMax')
  max?.replaceWith(document.createTextNode(max.textContent ?? ''))

  // Start straight in this story's game.
  if (location.hash !== `#${storyId}`) history.replaceState(null, '', `#${storyId}`)

  const script = document.createElement('script')
  script.src = '/play/engine.js'
  script.onload = () => {
    // Going back to the menu leaves the game screen for the app's menu. The players view (where the
    // legacy app runs the improvement phase) stays in the engine.
    const w = window as unknown as { show: (v: string) => void }
    const show = w.show
    w.show = function (v: string) {
      if (MENU_VIEWS.has(v)) return host.quit()
      return show.call(this, v)
    }
  }
  script.onerror = () => fail('Impossible de charger le moteur de jeu.')
  document.body.appendChild(script)
}
