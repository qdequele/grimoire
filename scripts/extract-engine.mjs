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
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'))

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

const engine =
  '// Generated by scripts/extract-engine.mjs from the legacy app. Game engine only: content is\n' +
  '// injected as GRIMOIRE_DATA by src/play/boot.ts. Edit with care, the legacy parity tests apply.\n' +
  js

// ------------------------------------------------------------------ markup
const bodyStart = html.indexOf('<header class="top bar2">')
let markup = scrubMarkup(html.slice(bodyStart, html.indexOf('<script>')))

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
