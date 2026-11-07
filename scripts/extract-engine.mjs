// One-off extraction of the legacy app's game engine (legacy/index.html, private) into public files:
//   public/play/legacy.css   its stylesheet, verbatim
//   public/play/engine.js    its script, with every content constant replaced by injected data
//   play.html                its markup, as the iframe page of the new app's game screen
//
// Content (scenarios, rules, glossary, translations) never reaches these files: the parser finds
// each content constant and swaps its value for GRIMOIRE_DATA.<NAME>, filled at runtime from the
// story (src/play/legacy/adapter.ts) and from private/engine-data.json when present.
//
//   node scripts/extract-engine.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as acorn from 'acorn'

const html = readFileSync('legacy/index.html', 'utf8')

// ------------------------------------------------------------------ CSS
let css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'))

// ------------------------------------------------------------------ script
let js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))

/** Constants whose value is content. Value → what replaces it. */
const CONTENT = {
  // Story content: comes from the selected story.
  ACTS: '[]',
  LIVRES_ACTS: '[]',
  SCENARIOS: 'GRIMOIRE_DATA.SCENARIOS',
  FLOWS: '{}', // already merged into the scenes by the converter
  READS: '{}', // idem
  BEASTS: 'GRIMOIRE_DATA.BEASTS',
  INV0: 'GRIMOIRE_DATA.INV0',
  WEAPONS: 'GRIMOIRE_DATA.WEAPONS',
  AMB_FOR: 'GRIMOIRE_DATA.AMB_FOR',
  SFX_FOR: 'GRIMOIRE_DATA.SFX_FOR',
  NPC_X: 'GRIMOIRE_DATA.NPC_X',
  SCENE_NPC: 'GRIMOIRE_DATA.SCENE_NPC',
  PROFILES: 'GRIMOIRE_DATA.NPC_ROWS',
  LIVRES_PNJ: 'GRIMOIRE_DATA.NPC_ROWS',
  WHO: 'GRIMOIRE_DATA.WHO',
  NPCS: 'GRIMOIRE_DATA.NPCS',
  FR_EN_SCEN: 'null', // the English scenario is its own story now
  // Rules content and translations: private, optional.
  I18N: 'GRIMOIRE_DATA.I18N',
  RULES: 'GRIMOIRE_DATA.RULES',
  GLOSS: 'GRIMOIRE_DATA.GLOSS',
  FOLIES: 'GRIMOIRE_DATA.FOLIES',
  NARR_RULES: 'GRIMOIRE_DATA.NARR_RULES',
  NARR_QUICK: 'GRIMOIRE_DATA.NARR_QUICK',
  NAMES: 'GRIMOIRE_DATA.NAMES',
  OCCS: 'GRIMOIRE_DATA.OCCS',
  SKILLS: 'GRIMOIRE_DATA.SKILLS',
  CARS: 'GRIMOIRE_DATA.CARS',
}

const ast = acorn.parse(js, { ecmaVersion: 'latest' })
const edits = []
const found = new Set()
for (const node of ast.body) {
  if (node.type !== 'VariableDeclaration') continue
  for (const d of node.declarations) {
    if (d.id.type === 'Identifier' && d.init && CONTENT[d.id.name] !== undefined) {
      edits.push([d.init.start, d.init.end, CONTENT[d.id.name]])
      found.add(d.id.name)
    }
  }
}
const missing = Object.keys(CONTENT).filter((k) => !found.has(k))
if (missing.length) throw new Error(`Not found: ${missing.join(', ')}`)

// Top-level statements that only add content at runtime: the converter already has their result
// (the dump was taken after they ran), so they are removed whole.
let removed = 0
for (const node of ast.body) {
  if (node.type !== 'ExpressionStatement') continue
  const text = js.slice(node.start, node.end)
  // The legacy app emptied the scene ambiences, then refilled them with recorded sounds.
  const addsSceneSounds = text.startsWith('Object.assign(AMB_FOR,') || text.startsWith('Object.keys(AMB_FOR).forEach(k=>delete AMB_FOR[k])')
  const buildsEnglishScenario = text.includes('FR_EN_SCEN')
  if (addsSceneSounds || buildsEnglishScenario) {
    edits.push([node.start, node.end, '/* content removed by extract-engine.mjs */'])
    removed++
  }
}
if (removed !== 3) throw new Error(`Expected 3 content statements, found ${removed}`)
for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) js = js.slice(0, start) + value + js.slice(end)

/** Targeted code changes, each must match exactly once. */
function patch(from, to, why) {
  const n = js.split(from).length - 1
  if (n !== 1) throw new Error(`Patch "${why}" matched ${n} times`)
  js = js.replace(from, to)
}
/** Like patch, for a fragment that appears exactly `count` times (every one is changed). */
function patchAll(from, to, count, why) {
  const n = js.split(from).length - 1
  if (n !== count) throw new Error(`Patch "${why}" matched ${n} times, expected ${count}`)
  js = js.split(from).join(to)
}

patch(
  'try{S=JSON.parse(localStorage.getItem(KEY));}catch(e){S=null;}',
  'try{S=GRIMOIRE_HOST.loadState({fresh:()=>fresh(),mkSlot:c=>mkSlot(c),newScenState:sc=>newScenState(sc)});}catch(e){console.error(e);S=null;}',
  'state comes from the account',
)
patch(
  'function save(){S.savedAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}',
  'function save(){S.savedAt=Date.now();try{GRIMOIRE_HOST.save(S);}catch(e){console.error(e);}',
  'state is saved to the account',
)
patch('if(s.id==="rupert")h+=secHTML(s.secs);', 'if(s.secsFirst)h+=secHTML(s.secs);', 'notes-first scenes are data')
patch('if(s.id!=="rupert")h+=secHTML(s.secs);', 'if(!s.secsFirst)h+=secHTML(s.secs);', 'notes-first scenes are data')
patch(
  '.filter(x=>x&&!/Douglas/.test(x))',
  '.filter(x=>x&&!(GRIMOIRE_DATA.NPC_WORDS||[]).some(w=>x.includes(w)))',
  'opponent names in test lines come from the story',
)

// The "who knows what" footer named the pregens and creatures: it becomes story data.
const whoNote = js.match(/<div class="det" style="font-size:12px;color:var\(--mute\)">([^<]+)<\/div>`;return;}/)
if (!whoNote) throw new Error('who-knows-what footer not found')
writeFileSync('private/legacy-dump/WHO_NOTE.json', JSON.stringify(whoNote[1]))
patch(whoNote[0], '<div class="det" style="font-size:12px;color:var(--mute)">${GRIMOIRE_DATA.WHO_NOTE||""}</div>`;return;}', 'who-knows-what footer is data')

// The ritual panel was written for one scenario: its texts and numbers become the story's tracker.
const ritualToast = js.match(/if\(ST\(\)\.pmRit>=8\)toast\("([^"]+)"\);/)
if (!ritualToast) throw new Error('ritual toast not found')
const ritual = { full: ritualToast[1] }
patch(ritualToast[0], 'if(ST().pmRit>=RIT.max)toast(RIT.full);', 'ritual full message is data')
patch('$("#pmBar").style.width=Math.min(100,st.pmRit/8*100)+"%";', '$("#pmBar").style.width=Math.min(100,st.pmRit/RIT.max*100)+"%";', 'ritual max is data')
const startLabel = js.match(/\$\("#ritStart"\)\.textContent=st\.ritStart\?"([^"]+)":"([^"]+)";/)
if (!startLabel) throw new Error('ritual start label not found')
ritual.running = startLabel[1]
ritual.start = startLabel[2]
patch(startLabel[0], '$("#ritStart").textContent=st.ritStart?RIT.running:RIT.start;', 'ritual labels are data')
patch('ST().pmRit+=2;', 'ST().pmRit+=RIT.step;', 'ritual step is data')
patch('ST().pmRit=Math.max(0,ST().pmRit-2);', 'ST().pmRit=Math.max(0,ST().pmRit-RIT.step);', 'ritual step is data')
patch('function renderRit(){', 'const RIT=GRIMOIRE_DATA.RITUAL||{max:8,step:2,start:"",running:"",full:""};\nfunction renderRit(){', 'ritual data')

/**
 * Book references and setting names in interface texts. The public code shows neutral wording;
 * T(n, neutral) shows the original instead when private data provides it (GRIMOIRE_DATA.TEXTS),
 * so the keeper who owns the book sees exactly the original app.
 */
const SCRUB = [
  [/ \(Livre Deux, p\. [\d à-]+\)/g, ''],
  [/ du Livre Deux \(p\. [\d à-]+\)/g, ' des règles'],
  [/conforme au Livre Deux/g, 'conforme aux règles'],
  [/Résumé reformulé du Livre Deux, Règles de base\. Le livret fait foi\./g, 'Résumé reformulé des règles de base. Le livret fait foi.'],
  [/résumé du Livre Deux/g, 'résumé des règles'],
  [/Livre Deux, $/g, ''], // "<span class="page">Livre Deux, ${r.p}"
  [/\(Livre Deux, résumé\)/g, '(résumé)'],
  [/ \(par exemple avec le professeur [^)]+\)/g, ''],
  [/Boîte d'initiation · Arkham, années 1920/g, 'Années 1920'],
  [/L'Appel de Cthulhu/g, 'Écran du gardien'],
  [/Le Livre Deux utilise la répartition fixe\. Le Manuel du Gardien propose/g, 'Les règles simplifiées utilisent la répartition fixe. Les règles complètes proposent'],
  [/« Arkham dort sous la pluie\. Quelque part, une lettre attend d'être ouverte\. »/g, "« La lampe du phare s'est éteinte il y a trois nuits. Quelqu'un doit aller voir. »"],
  [/Ex\. « Ils entrent dans la grange, \S+ veut fouiller la charrette »/g, 'Ex. « Ils entrent dans la grange et veulent fouiller la charrette »'],
]
const TEXTS = {}
let textCount = 0

/** Split a text into [plain, {original, neutral}, plain, …] along the SCRUB matches. */
function splitScrub(text) {
  const marks = []
  for (const [re, neutral] of SCRUB) {
    for (const m of text.matchAll(re)) marks.push([m.index, m.index + m[0].length, m[0], m[0].replace(new RegExp(re.source), neutral)])
  }
  marks.sort((a, b) => a[0] - b[0])
  const parts = []
  let at = 0
  for (const [s0, e0, original, neutral] of marks) {
    if (s0 < at) continue
    parts.push(text.slice(at, s0), { original, neutral })
    at = e0
  }
  parts.push(text.slice(at))
  return parts
}
const tCall = (p) => {
  const n = textCount++
  TEXTS[n] = p.original
  return `T(${n},${JSON.stringify(p.neutral)})`
}

{
  const comments = []
  const tree = acorn.parse(js, { ecmaVersion: 'latest', onComment: comments })
  const rewrites = []
  ;(function walk(n) {
    if (!n || typeof n.type !== 'string') return
    if (n.type === 'TemplateElement' && SCRUB.some(([re]) => new RegExp(re.source).test(n.value.raw))) {
      const parts = splitScrub(n.value.raw)
      rewrites.push([n.start, n.end, parts.map((p) => (typeof p === 'string' ? p : '${' + tCall(p) + '}')).join('')])
    } else if (n.type === 'Literal' && typeof n.value === 'string' && SCRUB.some(([re]) => new RegExp(re.source).test(n.value))) {
      const parts = splitScrub(n.value)
      rewrites.push([n.start, n.end, '(' + parts.map((p) => (typeof p === 'string' ? JSON.stringify(p) : tCall(p))).join('+') + ')'])
    }
    for (const k of Object.keys(n)) {
      const v = n[k]
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v.type === 'string') walk(v)
    }
  })(tree)
  // Comments are only for maintainers: just drop the references.
  for (const c of comments) {
    if (/Livre (Deux|Trois)|Scénario 1/.test(c.value)) rewrites.push([c.start, c.end, c.type === 'Line' ? '//' : '/* (comment removed) */'])
  }
  for (const [s0, e0, text] of rewrites.sort((a, b) => b[0] - a[0])) js = js.slice(0, s0) + text + js.slice(e0)
  js = 'const T=(n,neutral)=>((typeof GRIMOIRE_DATA!=="undefined"&&GRIMOIRE_DATA.TEXTS&&GRIMOIRE_DATA.TEXTS[n])??neutral);\n' + js
}

/** Markup: the same texts become <span data-t="n">neutral</span>, unwrapped by boot.ts. */
const scrubMarkup = (m) =>
  splitScrub(m)
    .map((p) => {
      if (typeof p === 'string') return p
      const n = textCount++
      TEXTS[n] = p.original
      return `<span data-t="${n}">${p.neutral}</span>`
    })
    .join('')

// The engine renders the current scene once during startup, before SK_EN2FR is declared further
// down; typeof on a not-yet-initialised const throws. The original app never hit it because its
// scenarios open on a scene without roll lines. Tolerate the early render.
patch(
  '(typeof SK_EN2FR!=="undefined"&&SK_EN2FR[x.toLowerCase()])',
  '((()=>{try{return SK_EN2FR[x.toLowerCase()]}catch(e){return undefined}})())',
  'early render before SK_EN2FR exists',
)

// The narrator asked claude.ai for a text-generation function. The app provides one (the narrate
// Edge Function, through GRIMOIRE_HOST.sample) with the same contract. Only the narrator changes:
// the other claude.use() features keep their non-claude.ai path (the saves list loads only when
// window.claude is absent, so no global shim).
patch(
  '(async()=>{try{if(window.claude&&claude.use)sampleFn=await claude.use("sample");}catch(e){sampleFn=null;}renderNarr();})();',
  // Keep the await: it defers renderNarr() until the whole script has run (NARR_QUICK is declared later).
  '(async()=>{try{sampleFn=await Promise.resolve((typeof GRIMOIRE_HOST!=="undefined"&&GRIMOIRE_HOST.sample)||null);}catch(e){sampleFn=null;}renderNarr();})();',
  'narrator uses the app\'s Claude',
)

// ------------------------------------------------------------------ game screen layout
// The narrator is a floating window opened from the toolbar, like the dice and the sounds, instead
// of a panel in the right column. Its open state is kept in S.ui.narr (closed by default).
patch(
  'function toggleNarr(force){const p=$("#narrPanel");p.hidden=force===undefined?!p.hidden:!force;',
  'function toggleNarr(force){const p=$("#narrPanel");p.hidden=force===undefined?!p.hidden:!force;if(!S.ui)S.ui={};S.ui.narr=!p.hidden;save();',
  'narrator open state is remembered',
)
patch(
  '$("#narrPanel").addEventListener("submit",',
  '$("#qaNarr").onclick=()=>toggleNarr();$("#narrClose").onclick=()=>toggleNarr(false);\n$("#narrPanel").addEventListener("submit",',
  'narrator toolbar button and close button',
)
patch(
  'renderPlay=function(){_rp3();$("#narrPanel").hidden=false;',
  'renderPlay=function(){_rp3();$("#narrPanel").hidden=!(S.ui&&S.ui.narr);',
  'narrator opens only when asked',
)
patch(
  'if(!play)["#dicePanel","#sndPanel"].forEach(',
  'if(!play)["#dicePanel","#sndPanel","#narrPanel"].forEach(',
  'narrator window closes outside the game',
)
patch(
  'const open=["#dicePanel","#sndPanel"].filter(s=>$(s)&&!$(s).hidden);\n  if(open.length){open.forEach(s=>$(s).hidden=true);return;}',
  'const open=["#dicePanel","#sndPanel","#narrPanel"].filter(s=>$(s)&&!$(s).hidden);\n  if(open.length){open.forEach(s=>s==="#narrPanel"?toggleNarr(false):$(s).hidden=true);return;}',
  'Escape closes the narrator like the other floating windows',
)
patch(
  'if(s)$("#qaSnd").setAttribute("aria-pressed",String(!s.hidden));',
  'if(s)$("#qaSnd").setAttribute("aria-pressed",String(!s.hidden));const nw=$("#narrPanel");if(nw)$("#qaNarr").setAttribute("aria-pressed",String(!nw.hidden));',
  'narrator toolbar button shows its state',
)
patch(
  '   n:()=>togglePanel("notes"),',
  '   n:()=>togglePanel("notes"),\n   a:()=>toggleNarr(),',
  'A opens the narrator',
)
// Scene NPCs and investigators fold like the journal and the notes.
patch(
  '[["narrateur","#narrPanel"],["journal","#jPanel"],["notes",".panel.notes"]]',
  '[["pnj","#npcPanel"],["investigateurs","#invPanel"],["journal","#jPanel"],["notes",".panel.notes"]]',
  'collapsible scene NPCs and investigators',
)

// ------------------------------------------------------------------ escaping investigator values
// Investigators now come from the account, and a table link lets a player create one: the values the
// original engine trusted (its own wizard made them) are escaped where they go into innerHTML.
// esc() escapes & < > and the double quote, so it is also safe inside value="…" attributes.
// The app also coerces them (toLegacyCharacter), and the database validates phone sheets.
patchAll('<div class="v">${c.dex}</div>', '<div class="v">${esc(c.dex)}</div>', 2, 'escape DEX on the investigator sheets')
patchAll('<div class="v" style="font-size:13px">${c.imp}</div>', '<div class="v" style="font-size:13px">${esc(c.imp)}</div>', 2, 'escape damage bonus on the investigator sheets')
patchAll('<div class="v">${c.car[k[0]]}</div>', '<div class="v">${esc(c.car[k[0]])}</div>', 2, 'escape characteristics on the investigator sheets')
for (const k of ['pv', 'chance', 'pm']) {
  patchAll(`<div class="v">\${c.${k}}</div>`, `<div class="v">\${esc(c.${k})}</div>`, 2, `escape ${k} on the investigator sheets`)
}
patch('<div class="k">SAN</div><div class="v">${c.san}</div>', '<div class="k">SAN</div><div class="v">${esc(c.san)}</div>', 'escape SAN on the investigator sheet')
patchAll('${esc(n)} ${v}</button>', '${esc(n)} ${esc(v)}</button>', 2, 'escape skill values on the party cards (base values come from characteristics)')
patch('${esc(b.job)} · DEX ${b.dex}', '${esc(b.job)} · DEX ${esc(b.dex)}', 'escape DEX on the party cards')
patch('value="${carOf(b)[k]||""}"', 'value="${esc(carOf(b)[k]||"")}"', 'escape characteristics in the party cards\' inputs')
patch('${esc(c.n)} · DEX ${c.dex}', '${esc(c.n)} · DEX ${esc(c.dex)}', 'escape DEX in the combat picker')
patch('<div class="ini">${r.dex}<small>DEX</small></div>', '<div class="ini">${esc(r.dex)}<small>DEX</small></div>', 'escape DEX in the combat order')
// The dice result's detail line is plain text built with investigator and opponent names.
patch('<div class="det">${det}</div>', '<div class="det">${esc(det)}</div>', 'escape the dice result detail (names)')
// Its level line is plain text too, and carries the skill name ("… · <skill> cochée"): a phone-made
// investigator's skill names are free text. Every caller passes plain text; the one that escaped its
// group name itself stops doing so, or it would show "&amp;".
patch('<div class="lvl ${lvlCls}">${lvlTxt}</div>', '<div class="lvl ${lvlCls}">${esc(lvlTxt)}</div>', 'escape the dice result level line (skill names)')
patch('" · "+esc(grpOf(st.active).name)', '" · "+grpOf(st.active).name', 'the group SAN result\'s level line is escaped by showRes now')
// The multi-investigator roll results: same "· <skill> cochée" text.
patch('<b>${esc(r.n)}</b> ${r.txt}</li>', '<b>${esc(r.n)}</b> ${esc(r.txt)}</li>', 'escape the picker\'s roll results (skill names)')
// "Modifier la partie": the warnings name the players, and a phone chooses its player's first name.
patch('<span class="mut">${iss.join(" · ")}</span>', '<span class="mut">${esc(iss.join(" · "))}</span>', 'escape the game setup warnings (player names)')

// Investigators' photos (the player companion's "Photo"): in the round heads instead of the initials.
// The app pushes them with GRIMOIRE_ENGINE.setPhotos; they never enter S (not saved with the game).
// Only base64 image data URLs pass photoOf, so the value is safe in the style attribute.
patch(
  'function head(p,g){const c=charById(p.cid);if(!c)return"";return `<span class="head ${p.state==="mort"?"dead":""}" style="--gc:${GCOL[g.col%4]}" title="${esc(c.n)}${p.player?" · "+esc(p.player):""}">${initials(c.n)}</span>`;}',
  'var PHOTOS={};\n' +
  'const photoOf=cid=>{const v=PHOTOS[cid];return typeof v==="string"&&v.length<=60000&&/^data:image\\/(jpeg|png|webp);base64,[A-Za-z0-9+\\/]+=*$/.test(v)?v:"";};\n' +
  'function head(p,g){const c=charById(p.cid);if(!c)return"";const ph=photoOf(p.cid);return `<span class="head ${p.state==="mort"?"dead":""}${ph?" ph":""}" style="--gc:${GCOL[g.col%4]}${ph?";background-image:url("+ph+")":""}" title="${esc(c.n)}${p.player?" · "+esc(p.player):""}">${ph?"":esc(initials(c.n))}</span>`;}',
  'investigators\' photos in the round heads (and escaped initials)',
)

// ------------------------------------------------------------------ player companion
// Players' phones change points, write notebooks and roll dice; the app pushes them through GRIMOIRE_ENGINE.
// Nothing changes until setNotebooks/setPoints/addMember/logRoll/setPhotos are called (logRoll: a phone's
// roll, as a Journal line under Dés, Tests or Santé mentale; setPhotos: the round heads, see head()).
patch(
  'try{route()}catch(e){}',
  `/* Grimoire: API for the app (player companion). Types: EngineApi in src/play/host.ts. */
let NOTEBOOKS={};
const notesOf=cid=>NOTEBOOKS[cid]||[];
const openCarnets=new Set();
/* Re-render without the keeper losing the field they type in (phones update at any time). */
function keepFocus(fn){const a=document.activeElement,ok=a&&a.id&&/^(INPUT|TEXTAREA)$/.test(a.tagName),
  m=ok?{id:a.id,v:a.value,s:a.selectionStart,e:a.selectionEnd}:null;
  fn();
  if(m){const el=document.getElementById(m.id);if(el&&el!==document.activeElement){el.focus();}
    if(el){if(el.value!==m.v)el.value=m.v;try{el.setSelectionRange(m.s,m.e);}catch(e){}}}}
function fillCarnets(){
  document.querySelectorAll("#invView .inv").forEach(card=>{const t=card.querySelector("[data-tog]"),body=card.querySelector(".ibody");if(!t||!body)return;
    const old=body.querySelector("details.carnet");if(old)old.remove();
    const cid=t.dataset.tog,notes=notesOf(cid).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));if(!notes.length)return;
    const d=document.createElement("details");d.className="carnet";d.open=openCarnets.has(cid);
    d.addEventListener("toggle",()=>{d.open?openCarnets.add(cid):openCarnets.delete(cid);});
    d.innerHTML='<summary><span>Carnet</span> <span>('+notes.length+')</span></summary>'+notes.map(n=>'<div class="cnote"><small>'+esc(new Date(n.createdAt).toLocaleString(LANG==="en"?"en-GB":"fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}))+'</small> '+esc(n.body)+'</div>').join("");
    body.appendChild(d);});}
/* Points changed elsewhere (a phone), in the Journal as the keeper's own −/+ write them:
   "Name : PV 13 → 10", changes of one value within 20 s on one line. */
function jlogPoints(sl,old){const c=charById(sl.cid);if(!c)return;const now=Date.now();
  [["pv","PV"],["san","SAN"],["chance","Chance"],["pm","PM"]].forEach(([k,lab])=>{if(sl[k]===old[k])return;
    const base=sl["_j"+k]&&now-sl["_j"+k].at<20000?sl["_j"+k].from:old[k];sl["_j"+k]={from:base,at:now};
    jlog(c.n+" : "+lab+" "+base+" → "+sl[k],k==="san"?"san":k==="pv"?"pv":"partie",sl.cid+"-"+k);});}
window.GRIMOIRE_ENGINE={
  setPoints(cid,v){const sl=ST().party.find(p=>p.cid===cid);if(!sl)return;const old={pv:sl.pv,san:sl.san,chance:sl.chance,pm:sl.pm};
    const n=x=>{x=Number(x);return Number.isFinite(x)?Math.round(x):0};sl.pv=n(v.pv);sl.san=n(v.san);sl.chance=n(v.chance);sl.pm=n(v.pm);P_(cid).san=sl.san;
    jlogPoints(sl,old);save();keepFocus(()=>{renderInv();if(ST().mode==="combat")renderCombat();});},
  addMember(c,player,progress){if(!c||ST().party.some(p=>p.cid===c.id))return;
    if(!S.chars.some(x=>x.id===c.id))S.chars.push(c);
    const name=(player||"").trim(),pl=name?addPlayer(name):null;
    S.prog[c.id]={skills:{},checks:[],hist:[],...(progress||{}),player:name,owner:pl?pl.id:null};
    const sl=mkSlot(c);sl.player=name;if(pl)sl.pid=pl.id;ensureGroups();sl.grp=ST().active;
    ST().party.push(sl);save();keepFocus(()=>renderPlay());},
  setNotebooks(n){NOTEBOOKS=n||{};fillCarnets();},
  setPhotos(p){p=p&&typeof p==="object"?p:{};if(JSON.stringify(p)===JSON.stringify(PHOTOS))return;PHOTOS=p;
    try{keepFocus(()=>{renderNav();renderInv();});}catch(e){}},
  logRoll(txt,k){jlog(String(txt).slice(0,300),k==="san"||k==="test"?k:"de");},
};
try{route()}catch(e){}`,
  'API exposed to the app: live points (and their changes in the Journal), new party members, notebooks, phone rolls in the Journal, photos',
)
// Notebook section on the investigator cards (folded, newest first).
patch(
  '$("#invView").addEventListener("click",e=>{\n  const b=e.target.closest("button");if(!b)return;const P=ST().party;',
  `{const _riN=renderInv;renderInv=function(){_riN();fillCarnets();};}
$("#invView").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;const P=ST().party;`,
  'notebooks on the investigator cards',
)
// Narrator sees the notebooks.
patch(
  'NOTES DU GARDIEN : ${(st.notes||"").slice(-1500)||"aucune"}`;',
  'NOTES DU GARDIEN : ${(st.notes||"").slice(-1500)||"aucune"}\nCARNETS DES INVESTIGATEURS : ${(()=>{const t=st.party.map(p=>{const c=charById(p.cid),ns=notesOf(p.cid).slice().sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).slice(-5);return c&&ns.length?c.n+": "+ns.map(n=>n.body).join(" | "):""}).filter(Boolean).join("\\n");return t.slice(0,1500)||"aucun"})()}`;',
  'narrator reads the investigators\' notebooks',
)
// Toolbar: players at the table.
patch(
  '$("#qaNarr").onclick=()=>toggleNarr();',
  '$("#qaNarr").onclick=()=>toggleNarr();$("#qaTable").onclick=()=>{GRIMOIRE_HOST.openTable&&GRIMOIRE_HOST.openTable();};',
  'toolbar button opens the players-at-the-table dialog',
)
// Toolbar: the ambiance screen (TV link, handouts). The screen follows the scene through save().
patch(
  '$("#qaTable").onclick=()=>{GRIMOIRE_HOST.openTable&&GRIMOIRE_HOST.openTable();};',
  '$("#qaTable").onclick=()=>{GRIMOIRE_HOST.openTable&&GRIMOIRE_HOST.openTable();};$("#qaScreen").onclick=()=>{GRIMOIRE_HOST.openScreen&&GRIMOIRE_HOST.openScreen();};',
  'toolbar button opens the ambiance screen dialog',
)
// Game menu: grouped into sub-menus (markup below). Escape in a sub-menu goes back to the main list.
patch(
  'if(!$("#gMenu").hidden){closeMenu();return;}',
  'if(!$("#gMenu").hidden){if(gmPanel())gmShow("");else closeMenu();return;}',
  'Escape in a game sub-menu goes back',
)
patch(
  'function closeMenu(){const m=$("#gMenu");',
  `/* Grimoire: game menu sub-menus (Partie, Sauvegardes, Affichage). */
function gmPanel(){const p=document.querySelector("#gMenu [data-gm-panel]:not([hidden])");return p?p.dataset.gmPanel:"";}
function gmShow(name,quiet){const m=$("#gMenu"),from=gmPanel();m.querySelector(".gm-main").hidden=!!name;
  m.querySelectorAll("[data-gm-panel]").forEach(p=>p.hidden=p.dataset.gmPanel!==name);$("#gmSaves").hidden=true;
  if(quiet)return;const f=name?m.querySelector('[data-gm-panel="'+name+'"] .gm-item'):m.querySelector('[data-gm-go="'+from+'"]');if(f)f.focus();}
function closeMenu(){const m=$("#gMenu");`,
  'game sub-menus',
)
patch(
  '$("#gmSaves").hidden=true;tick();saveHint();$("#gMenu").hidden=false;',
  'gmShow("",true);tick();saveHint();$("#gMenu").hidden=false;',
  'game menu opens on its main list',
)
patch(
  '$("#gMenu").addEventListener("click",e=>{if(e.target.id==="gMenu")closeMenu();',
  '$("#gMenu").addEventListener("click",e=>{if(e.target.id==="gMenu")closeMenu();const g=e.target.closest("[data-gm-go]");if(g)gmShow(g.dataset.gmGo);if(e.target.closest("[data-gm-back]"))gmShow("");',
  'game sub-menus open and close',
)

const engine =
  '// Generated by scripts/extract-engine.mjs from the legacy app. Game engine only: content is\n' +
  '// injected as GRIMOIRE_DATA by src/play/boot.ts. Edit with care, the legacy parity tests apply.\n' +
  js

// ------------------------------------------------------------------ markup
const bodyStart = html.indexOf('<header class="top bar2">')
let markup = scrubMarkup(html.slice(bodyStart, html.indexOf('<script>')))

/** Markup and stylesheet changes, each must match exactly once. */
function patchText(text, from, to, why) {
  const n = text.split(from).length - 1
  if (n !== 1) throw new Error(`Patch "${why}" matched ${n} times`)
  return text.replace(from, to)
}
const NARR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>'
markup = patchText(markup,
  '<button class="btn ico" id="qaSnd"',
  `<button class="btn ico" id="qaNarr" aria-label="Narrateur" title="Narrateur (A)" aria-pressed="false">${NARR_ICON}</button>\n    <button class="btn ico" id="qaSnd"`,
  'narrator toolbar button')
const TABLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.2M18 14.3c1.9.7 3 2.4 3 5.2"/></svg>'
markup = patchText(markup,
  '<button class="btn ico" id="qaSnd"',
  `<button class="btn ico" id="qaTable" aria-label="Joueurs à la table" title="Joueurs à la table" aria-pressed="false">${TABLE_ICON}</button>\n    <button class="btn ico" id="qaSnd"`,
  'players-at-the-table toolbar button')
const SCREEN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4" width="19" height="12.5" rx="1"/><path d="M8.5 20.5h7M12 16.5v4"/><path d="M5.5 13.5l4-4 3 3 2-2 4 3"/></svg>'
markup = patchText(markup,
  '<button class="btn ico" id="qaSnd"',
  `<button class="btn ico" id="qaScreen" aria-label="Écran d'ambiance" title="Écran d'ambiance" aria-pressed="false">${SCREEN_ICON}</button>\n    <button class="btn ico" id="qaSnd"`,
  'ambiance screen toolbar button')
const narrPanel = markup.match(/\n\s*<section class="panel narr" id="narrPanel"[^\n]*<\/section>/)
if (!narrPanel) throw new Error('narrator panel markup not found')
markup = markup.replace(narrPanel[0], '')
markup = patchText(markup,
  '<button class="fab fab-l" id="sndFab"',
  '<section class="narr" id="narrPanel" hidden aria-label="Narrateur"><h3><span>Narrateur</span><button class="x" id="narrClose" aria-label="Fermer le narrateur">×</button></h3><div id="narrBody"></div></section>\n<button class="fab fab-l" id="sndFab"',
  'floating narrator window')
markup = patchText(markup,
  '<h3><span>PNJ de la scène</span> ',
  '<h3><button class="ptog" data-ptog="pnj" aria-expanded="true"><span class="chev"></span>PNJ de la scène</button> ',
  'collapsible scene NPCs')
markup = patchText(markup,
  '<section class="panel">\n      <h3>Investigateurs <span class="tabs">',
  '<section class="panel" id="invPanel">\n      <h3><button class="ptog" data-ptog="investigateurs" aria-expanded="true"><span class="chev"></span>Investigateurs</button> <span class="tabs">',
  'collapsible investigators')
// The game menu had twelve entries: the main list keeps the frequent ones, the rest move into
// sub-menus (every button keeps its id, so the engine's handlers are unchanged).
markup = patchText(markup,
  `    <div class="gm-list">
      <button class="gm-item prim" id="gmResume"><span class="gm-k">Échap</span>Reprendre la partie</button>
      <div class="gm-item-wrap"><button class="gm-item" id="gmEdit">Modifier la partie</button><span class="gm-meta">joueurs et personnages</span></div>
      <div class="gm-item-wrap"><button class="gm-item" id="btnClock">Démarrer la séance</button><span class="gm-meta" id="gmClock"></span></div>
      <div class="gm-item-wrap"><span id="saveZone"><button class="gm-item" id="btnSave">Sauvegarder la partie</button></span><span class="gm-meta" id="saveHint"></span></div>
      <div class="gm-item-wrap"><button class="gm-item" id="gmLoad">Charger une sauvegarde</button></div>
      <div id="gmSaves" class="gm-saves" hidden></div>
      <div class="gm-item-wrap"><span id="finZone"><button class="gm-item" id="btnFin">Terminer le scénario</button></span></div>
      <div class="gm-sep"></div>
      <button class="gm-item" id="gmRules">Règles du jeu</button>
      <div class="gm-item-wrap"><button class="gm-item" id="gmSkin">Thème : Art déco</button><span class="gm-meta">touche T</span></div>
      <div class="gm-item-wrap"><button class="gm-item" id="gmLang">Langue : Français</button><span class="gm-meta">touche L</span></div>
      <button class="gm-item" data-nav="menu" id="gmQuit">Quitter vers le menu principal</button>
      <div class="gm-item-wrap"><span id="resetZone"><button class="gm-item danger" id="btnReset">Réinitialiser ce scénario</button></span></div>
    </div>`,
  `    <div class="gm-list gm-main">
      <button class="gm-item prim" id="gmResume"><span class="gm-k">Échap</span>Reprendre la partie</button>
      <div class="gm-item-wrap"><button class="gm-item gm-go" data-gm-go="partie">Partie</button><span class="gm-meta">joueurs, chrono, fin du scénario</span></div>
      <div class="gm-item-wrap"><button class="gm-item gm-go" data-gm-go="sauvegardes">Sauvegardes</button><span class="gm-meta" id="saveHint"></span></div>
      <button class="gm-item" id="gmRules">Règles du jeu</button>
      <div class="gm-item-wrap"><button class="gm-item gm-go" data-gm-go="affichage">Affichage</button><span class="gm-meta">thème et langue</span></div>
      <div class="gm-sep"></div>
      <button class="gm-item" data-nav="menu" id="gmQuit">Quitter vers le menu principal</button>
    </div>
    <div class="gm-list" data-gm-panel="partie" hidden>
      <button class="gm-back" data-gm-back><span class="gm-k">Échap</span>Partie</button>
      <div class="gm-item-wrap"><button class="gm-item" id="gmEdit">Modifier la partie</button><span class="gm-meta">joueurs et personnages</span></div>
      <div class="gm-item-wrap"><button class="gm-item" id="btnClock">Démarrer la séance</button><span class="gm-meta" id="gmClock"></span></div>
      <div class="gm-item-wrap"><span id="finZone"><button class="gm-item" id="btnFin">Terminer le scénario</button></span></div>
      <div class="gm-sep"></div>
      <div class="gm-item-wrap"><span id="resetZone"><button class="gm-item danger" id="btnReset">Réinitialiser ce scénario</button></span></div>
    </div>
    <div class="gm-list" data-gm-panel="sauvegardes" hidden>
      <button class="gm-back" data-gm-back><span class="gm-k">Échap</span>Sauvegardes</button>
      <div class="gm-item-wrap"><span id="saveZone"><button class="gm-item" id="btnSave">Sauvegarder la partie</button></span></div>
      <div class="gm-item-wrap"><button class="gm-item" id="gmLoad">Charger une sauvegarde</button></div>
      <div id="gmSaves" class="gm-saves" hidden></div>
    </div>
    <div class="gm-list" data-gm-panel="affichage" hidden>
      <button class="gm-back" data-gm-back><span class="gm-k">Échap</span>Affichage</button>
      <div class="gm-item-wrap"><button class="gm-item" id="gmSkin">Thème : Art déco</button><span class="gm-meta">touche T</span></div>
      <div class="gm-item-wrap"><button class="gm-item" id="gmLang">Langue : Français</button><span class="gm-meta">touche L</span></div>
    </div>`,
  'game menu sub-menus')

// The legacy app had moved the narrator into the right column: back to a floating window, at the
// bottom right like the dice (beside them when both are open).
css = patchText(css,
  /#narrPanel\.narr\{position:static!important[^\n]*\n(#narrPanel[^\n]*\n)*/.exec(css)?.[0] ?? '(missing narrator column style)',
  '',
  'narrator column style removed')
css += `
/* Grimoire: notebooks on investigator cards */
.inv details.carnet{margin-top:8px;font-size:13px}
.inv details.carnet summary{cursor:pointer;color:var(--mute)}
.inv .cnote{padding:4px 0;border-top:1px solid var(--line,rgba(128,128,128,.25))}
.inv .cnote small{color:var(--mute);margin-right:6px}
/* Grimoire: floating narrator, collapsible side panels */
#narrPanel.narr{top:auto;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));width:min(440px,calc(100vw - 32px));height:min(640px,calc(100vh - 110px))}
@media (min-width:960px){body:has(#dicePanel:not([hidden])) #narrPanel.narr{right:calc(18px + min(440px,100vw - 32px) + 12px)}}
.npcp h3 .ptog,#invPanel h3 .ptog{margin-right:auto}
#invPanel h3{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.panel.collapsed .tabs{display:none}
/* Grimoire: game menu sub-menus */
.gm-box{display:grid;grid-template-columns:minmax(0,1fr);align-content:center;gap:18px}
.gm-box > .gm-list{grid-row:2;grid-column:1;align-self:start}
.gm-box > .gm-list[hidden]{display:flex!important;visibility:hidden}
.gm-go::after{content:"";position:absolute;right:16px;top:50%;width:7px;height:7px;margin-top:-4px;border:solid var(--mute);border-width:1.5px 1.5px 0 0;transform:rotate(45deg);box-sizing:border-box}
.gm-go:hover::after,.gm-go:focus-visible::after{border-color:var(--gold)}
.gm-back{display:flex;align-items:center;gap:12px;width:100%;margin-bottom:6px;padding:4px 14px 12px 20px;background:none;border:0;border-bottom:1px solid var(--line);font-size:11px;letter-spacing:.24em;text-transform:uppercase;text-align:left;color:var(--gold);cursor:pointer}
.gm-back::before{content:"";width:7px;height:7px;border:solid currentColor;border-width:0 0 1.5px 1.5px;transform:rotate(45deg);box-sizing:border-box;flex:none}
.gm-back:hover,.gm-back:focus-visible{color:var(--bone);outline:none}
.gm-back .gm-k{position:static;order:1;margin-left:auto;letter-spacing:0;text-transform:none}
html[data-skin="deco"] .gm-back{letter-spacing:.35em}
/* Grimoire: investigators' photos in the round heads */
.head.ph{background-color:var(--ink);background-size:cover;background-position:center}
.head.ph.dead{filter:grayscale(1)}
`

// Ritual panel texts → placeholders filled by boot.ts from the story's tracker.
const ritualMarkup = [
  [/<h3>([^<]+)<\/h3>(\s*<div class="line"><span>PM versés<\/span>)/, 'title', '<h3 id="ritTitle"></h3>$2'],
  [/<span>\/ (\d+)<\/span>/, 'max', '<span>/ <span id="ritMax"></span></span>'],
  [/<button class="btn" id="pmAdd">([^<]+)<\/button>/, 'add', '<button class="btn" id="pmAdd"></button>'],
  [/<button class="btn" id="pmSub">([^<]+)<\/button>/, 'sub', '<button class="btn" id="pmSub"></button>'],
  [/<button class="btn" id="ritStart">[^<]+<\/button>/, null, '<button class="btn" id="ritStart"></button>'],
  [/(<div class="det" style="font-size:12px;color:var\(--mute\);margin-top:6px">)([^<]+)(<\/div>\s*<\/section>\s*<section class="panel journal")/, 'help', '<div class="det" id="ritHelp" style="font-size:12px;color:var(--mute);margin-top:6px">$3'],
]
for (const [re, key, to] of ritualMarkup) {
  const m = markup.match(re)
  if (!m) throw new Error(`ritual markup not found: ${key}`)
  if (key === 'help') ritual.help = m[2]
  else if (key === 'max') ritual.max = Number(m[1])
  else if (key) ritual[key] = m[1]
  markup = markup.replace(re, to)
}
ritual.step = 2
writeFileSync('private/legacy-dump/RITUAL.json', JSON.stringify(ritual, null, 1))
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0]
const page = `<!doctype html>
<html lang="fr" data-skin="deco">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grimoire · Partie</title>
<!-- The game screen: the legacy engine, isolated in its own page (see src/play/boot.ts). -->
<script>try{var k=localStorage.getItem('gardien-skin');if(k)document.documentElement.dataset.skin=k}catch(e){}</script>
${fonts}
<link rel="stylesheet" href="/play/legacy.css">
</head>
<body>
${markup}<script type="module" src="/src/play/boot.ts"></script>
</body>
</html>
`

// Originals of the neutralised texts go to the private engine data, next to the rules content.
if (existsSync('private/engine-data.json')) {
  const data = JSON.parse(readFileSync('private/engine-data.json', 'utf8'))
  data.TEXTS = TEXTS
  writeFileSync('private/engine-data.json', JSON.stringify(data))
}

mkdirSync('public/play', { recursive: true })
writeFileSync('public/play/legacy.css', css)
writeFileSync('public/play/engine.js', engine)
writeFileSync('play.html', page)
console.log(`legacy.css ${css.length} · engine.js ${engine.length} · play.html ${page.length} bytes · ${edits.length} constants replaced`)
