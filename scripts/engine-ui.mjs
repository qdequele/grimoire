// Game screen UI patches (applied by extract-engine.mjs after the dice patches; each must match
// exactly once, or the number of times it says): the scene flow's choices, the scene's documents and
// items, the ambiance screen's preview, investigator sheets and items (combat included), a toolbar
// that stays on top, and the escaping of the story's plain texts where the engine writes them as HTML.
// The new engine code is scripts/engine-ui/ui.engine.js
// (inserted before the first route()), its styles scripts/engine-ui/ui.css (appended to legacy.css).
//
// Like engine-dice.mjs, the patches target the engine as the earlier patches leave it:
// node scripts/engine-ui.mjs --apply applies them to the generated files as they were before any UI
// patch, which is their last commit without the "Grimoire UI" mark:
//   git checkout 5cfde22 -- public/play/engine.js public/play/legacy.css && node scripts/engine-ui.mjs --apply
import { readFileSync } from 'node:fs'

const here = (f) => new URL(`./engine-ui/${f}`, import.meta.url)
export const UI_JS = readFileSync(here('ui.engine.js'), 'utf8')
export const UI_CSS = readFileSync(here('ui.css'), 'utf8')

/** [from, to, why, times it must match (1 unless given: the engine declares a few functions twice)] */
export const UI_PATCHES = [
  ['function flowHTML(fl){', 'function flowHTML0(fl){', 'the scene flow is drawn by ui.engine.js (choices under their step)'],
  // Story text is untrusted (a shared pack, an AI import, the chat connector). Rich text reaches the
  // engine already inert (toHtml in src/play/legacy/adapter.ts); titles stay plain text, which the
  // engine also reads as text (Journal, narrator, toasts), so it escapes them where it writes HTML.
  ['<h3>${s.t}</h3><div class="meta">', '<h3>${esc(s.t)}</h3><div class="meta">', 'story text: the story\'s title in the story lists', 3],
  ['<h2>${sc.t}</h2>', '<h2>${esc(sc.t)}</h2>', 'story text: the story\'s title in the game setup'],
  ['<span class="t">${s.t}</span>', '<span class="t">${esc(s.t)}</span>', 'story text: scene titles in the navigation'],
  [
    '<h2>${s.t}</h2>${s.p?`<span class="page">Livret ${s.p}</span>`:""}',
    '<h2>${esc(s.t)}</h2>${s.p?`<span class="page">Livret ${esc(s.p)}</span>`:""}',
    'story text: the scene\'s title and page reference',
  ],
  ['← ${prev.t}</button>', '← ${esc(prev.t)}</button>', 'story text: the previous scene\'s title'],
  ['${next.t} →</button>', '${esc(next.t)} →</button>', 'story text: the next scene\'s title'],
  ['<h4>${x.h}</h4>', '<h4>${esc(x.h)}</h4>', 'story text: the titles of a scene\'s notes'],
  ['<div class="fh">${s.h}</div>', '<div class="fh">${esc(s.h)}</div>', 'story text: step titles in the original scene flow (no longer called)'],
  [
    '${r.note?`<div class="note2">${esc(r.note)}</div>`:""}',
    '${r.note?`<div class="note2">${esc(htmlText(r.note))}</div>`:""}',
    'story text: an opponent\'s note is HTML: its text in combat, not its source',
  ],
  ['id="st-${S.cur}-${s.cid}"', 'id="st-${esc(S.cur)}-${s.cid}"', 'story text: the story\'s id in an attribute (state select)'],
  ['id="nt-${S.cur}-${s.cid}"', 'id="nt-${esc(S.cur)}-${s.cid}"', 'story text: the story\'s id in an attribute (note field)'],
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
    'const x=d100(B,M),L=level(x.r,a[1]);',
    'const x=d100(B,M+itemPen(a)),L=itemJam(a,x.r)||level(x.r,a[1]);',
    "a weapon's condition: penalty die on the attack, and a firearm jams from its malfunction value",
  ],
  [
    'else{const f=rollFormula(a[2]);dmg=Math.max(0,f.tot);dd=f.det;}}',
    'else{const f=rollFormula(a[2]);if(f){dmg=Math.max(0,f.tot);dd=f.det;}else{dmg="?";dd="?";}}}if(hit)({dmg,dd}=itemDmg(a,dmg,dd));',
    'a damage the engine can\'t read (an old card, an opponent\'s "special") shows as "?" instead of throwing away the hit; a damaged weapon deals half damage',
  ],
  [
    '<button class="a" data-atk="${i}" data-j="${j}">${esc(a[0])} ${a[1]} %</button>',
    '<button class="a" data-atk="${i}" data-j="${j}">${esc(a[0])}${a[5]!=null?`<small class="itm-ammo">${esc(a[5])}/${esc(a[6])}</small>`:""}${a[7]?`<small class="itm-cond">${esc(a[7].label)}</small>`:""} ${a[1]} %</button>',
    'rounds left and condition of a weapon card, on its attack button',
  ],
  [
    'const openOver=()=>["#npcDlg","#pick","#saveDlg","#gmMenu"]',
    'const openOver=()=>["#npcDlg","#pick","#saveDlg","#gmMenu","#hdDlg"]',
    'no shortcuts while a document is open',
  ],
  // The table (players at a computer) sees the rolls the keeper makes for an investigator.
  [
    'res.push({n:c.n,txt,cls,dz});jlog(`${c.n} · SAN ${P.label} : ${txt}`,"san");}',
    'res.push({n:c.n,txt,cls,dz});jlog(`${c.n} · SAN ${P.label} : ${txt}`,"san");tblRoll(sl.cid,{kind:"check",subject:"san",target:from,net:0,dice:{tens:dz.tens,units:dz.u},result:x.r,level:tblLevel(x.r,from),effect:{field:"san",delta:sl.san-from,from,to:sl.san,formula:String(f)}});}',
    'table rolls: a SAN roll the keeper makes for an investigator, with the SAN it cost',
  ],
  [
    'res.push({n:c.n,txt,cls:ok?"ok":"bad",dz});jlog(`${c.n} · ${P.label} : ${txt}`,"test");}',
    'res.push({n:c.n,txt,cls:ok?"ok":"bad",dz});jlog(`${c.n} · ${P.label} : ${txt}`,"test");tblRoll(sl.cid,{kind:"check",subject:tblSubject(P.label),target:v,net:Math.max(-2,Math.min(2,P.B-P.M)),dice:{tens:dz.tens,units:dz.u},result:x.r,level:tblLevel(x.r,v)});}',
    'table rolls: a skill or characteristic test the keeper makes for an investigator',
  ],
  [
    'res.push({n:c.n,txt,cls:"bad",dz});jlog(`${c.n} · ${P.label} : ${txt}`,"pv");}',
    'res.push({n:c.n,txt,cls:"bad",dz});jlog(`${c.n} · ${P.label} : ${txt}`,"pv");tblRoll(sl.cid,{kind:"damage",subject:tblSubject(P.label),dice:{formula:String(P.val),total:v},result:v,effect:{field:"pv",delta:sl.pv-from,from,to:sl.pv}});}',
    'table rolls: damage the keeper rolls on an investigator, with the HP it cost',
  ],
]

const MARK = '/* Grimoire UI (scripts/engine-ui.mjs)'

/** Applies the patches and inserts the new engine code (before the first route()). */
export function applyUiPatches(js) {
  if (js.includes(MARK)) throw new Error('UI patches already applied')
  for (const [from, to, why, times = 1] of UI_PATCHES) {
    const n = js.split(from).length - 1
    if (n !== times) throw new Error(`Patch "${why}" matched ${n} times, not ${times}`)
    js = js.split(from).join(to)
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
