// Game screen UI patches (applied by extract-engine.mjs after the dice patches; each must match
// exactly once): the scene flow's choices, the scene's documents and items, the ambiance screen's
// preview, investigator sheets and items (combat included), a toolbar that stays on top. The new engine code is scripts/engine-ui/ui.engine.js
// (inserted before the first route()), its styles scripts/engine-ui/ui.css (appended to legacy.css).
//
// Like engine-dice.mjs, the patches target the engine as the earlier patches leave it, which is the
// current public/play/engine.js: node scripts/engine-ui.mjs --apply applies them to the generated files.
import { readFileSync } from 'node:fs'

const here = (f) => new URL(`./engine-ui/${f}`, import.meta.url)
export const UI_JS = readFileSync(here('ui.engine.js'), 'utf8')
export const UI_CSS = readFileSync(here('ui.css'), 'utf8')

/** [from, to, why] */
export const UI_PATCHES = [
  ['function flowHTML(fl){', 'function flowHTML0(fl){', 'the scene flow is drawn by ui.engine.js (choices under their step)'],
  [
    'h+=`<div class="chips scene-snd">${AMB_FOR[s.id]?',
    'h+=`<div class="chips scene-snd">${scrPrevHTML(s)}${AMB_FOR[s.id]?',
    'the ambiance screen preview, first in the sounds row',
  ],
  [
    '${fx.map(f=>`<button class="chip sfx" ${f.attr} title="Jouer le son">◗ ${esc(f.n)}</button>`).join("")}</div>`;}',
    '${fx.map(f=>`<button class="chip sfx" ${f.attr} title="Jouer le son">◗ ${esc(f.n)}</button>`).join("")}</div>`;}else if(scrPrevHTML(s))h+=`<div class="chips scene-snd">${scrPrevHTML(s)}</div>`;',
    'the ambiance screen preview, also for scenes without sounds',
  ],
  ['if(s.secsFirst)h+=secHTML(s.secs);', 'h+=hdRowHTML(s)+itRowHTML(s);if(s.secsFirst)h+=secHTML(s.secs);', 'the scene\'s documents and items under its sounds'],
  [
    '<span class="nm">${esc(b.n)}</span>',
    '<button type="button" class="nm nm-sheet" data-sheet="${esc(s.cid)}" title="Fiche de présentation">${esc(b.n)}</button>',
    'an investigator\'s name opens their sheet',
  ],
  [
    'return {esq:tot("Esquive"),atk:at};}',
    'return {esq:tot("Esquive"),atk:withItemAttacks(c,at,imp)};}',
    'an investigator\'s weapon cards are among their attacks',
  ],
  [
    'if(t.dataset.dmg){doFormula(a[2],`${r.name} · ${a[0]}`);return;}',
    'if(t.dataset.dmg){doFormula(a[2],`${r.name} · ${a[0]}`);return;}if(!itemFire(a))return;',
    'firing a weapon card spends a round; an empty one doesn\'t fire',
  ],
  ['if(EMPALE.test(a[0]))', 'if(a[4]||EMPALE.test(a[0]))', 'weapon cards say themselves whether they impale'],
  [
    '<button class="a" data-atk="${i}" data-j="${j}">${esc(a[0])} ${a[1]} %</button>',
    '<button class="a" data-atk="${i}" data-j="${j}">${esc(a[0])}${a[5]!=null?`<small class="itm-ammo">${esc(a[5])}/${esc(a[6])}</small>`:""} ${a[1]} %</button>',
    'rounds left in a weapon card, on its attack button',
  ],
  [
    'const openOver=()=>["#npcDlg","#pick","#saveDlg","#gmMenu"]',
    'const openOver=()=>["#npcDlg","#pick","#saveDlg","#gmMenu","#hdDlg"]',
    'no shortcuts while a document is open',
  ],
]

const MARK = '/* Grimoire UI (scripts/engine-ui.mjs)'

/** Applies the patches and inserts the new engine code (before the first route()). */
export function applyUiPatches(js) {
  if (js.includes(MARK)) throw new Error('UI patches already applied')
  for (const [from, to, why] of UI_PATCHES) {
    const n = js.split(from).length - 1
    if (n !== 1) throw new Error(`Patch "${why}" matched ${n} times`)
    js = js.replace(from, () => to)
  }
  const start = 'try{route()}catch(e){}'
  if (js.split(start).length !== 2) throw new Error('first route() not found')
  return js.replace(start, () => `${UI_JS}\n${start}`)
}

export function applyUiCss(css) {
  if (css.includes(MARK)) throw new Error('UI styles already applied')
  return css + UI_CSS
}

if (process.argv.includes('--apply')) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync('public/play/engine.js', applyUiPatches(readFileSync('public/play/engine.js', 'utf8')))
  writeFileSync('public/play/legacy.css', applyUiCss(readFileSync('public/play/legacy.css', 'utf8')))
  console.log(`${UI_PATCHES.length} UI patches applied to public/play/engine.js, styles to legacy.css`)
}
