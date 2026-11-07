// Engine patches for the game screen's 3D dice (applied last by extract-engine.mjs, each must match
// exactly once). The engine still rolls and words every result itself; it only remembers which dice
// it rolled and hands them to window.GRIMOIRE_DICE (src/play/dice.tsx), which throws them before the
// number shows. Without GRIMOIRE_DICE, or for dice it can't draw, the engine behaves as before.
//
// Kept apart so they can be applied to the current public/play/engine.js too (the patches target the
// engine as the earlier patches leave it, which is that file): node scripts/engine-dice.mjs --apply

/** [from, to, why] */
export const DICE_PATCHES = [
  // ---------------------------------------------------------------- what was rolled
  [
    'let LASTD=null;',
    `let LASTD=null,LASTF=null;
/* Grimoire: the dice behind a shown number, for the 3D dice (src/play/dice.tsx): the last d100 or
   formula roll, if it is the number shown and was rolled in the last 2.5 s (like the tiles). */
function diceRec(big){const now=Date.now(),D=LASTD,F=LASTF;
  const d=D&&now-D.at<2500&&String(D.r)===String(big)?D:null,f=F&&now-F.at<2500&&String(F.tot)===String(big)?F:null;
  return d&&f?(d.at>=f.at?d:f):d||f;}`,
    'remember the dice behind a result, for the 3D dice',
  ],
  ['LASTD={tens,u,net,used:vals.indexOf(r),at:Date.now()};', 'LASTD={tens,u,net,used:vals.indexOf(r),r,at:Date.now()};', 'a d100 roll remembers its result'],
  ['function rollFormula(f){\n  const parts=', 'function rollFormula(f){const fr=[];\n  const parts=', 'a formula roll remembers its dice'],
  ['rs.push(x);tot+=sg*x;}', 'rs.push(x);fr.push([f2,x]);tot+=sg*x;}', 'a formula roll remembers its dice (each die)'],
  ['return {tot,det:det.join(" ")};', 'LASTF={rolls:fr,tot,at:Date.now()};return {tot,det:det.join(" ")};', 'a formula roll remembers its dice (record)'],

  // ---------------------------------------------------------------- dice panel result
  [
    'openDice();const R=$("#result");clearTimeout(rollT);',
    'openDice();const R=$("#result");clearTimeout(rollT);if(R._dice){R._dice();R._dice=null;}let dEl=null;',
    'a new result removes the last dice',
  ],
  [
    'const final=()=>{R.className="result"+(fx?" fx-"+fx:"");const tiles=diceTiles();',
    'const final=()=>{R.className="result"+(fx?" fx-"+fx:"")+(dEl?" has-dice":"");const tiles=dEl?\'<span class="r-slot"></span>\':diceTiles();',
    'the thrown dice replace the flat tiles',
  ],
  [
    '<div class="det">${esc(det)}</div>`;\n    if(fx&&!reduce){',
    '<div class="det">${esc(det)}</div>`;if(dEl)R.querySelector(".r-slot").replaceWith(dEl);\n    if(fx&&!reduce){',
    'the dice stay next to the number once it shows',
  ],
  [
    'if(reduce){final();return;}',
    `if(window.GRIMOIRE_DICE){const rec=diceRec(big);if(rec){dEl=document.createElement("div");dEl.className="r-dice";R.className="result rolling has-dice";R.innerHTML="";R.appendChild(dEl);
    const stop=GRIMOIRE_DICE.throw(dEl,rec,final,60);if(stop){R._dice=stop;LASTD=LASTF=null;return;}dEl=null;R.className="result";}}
  if(reduce){final();return;}`,
    'the dice are thrown, then the number shows (instead of a spinning number)',
  ],

  // ---------------------------------------------------------------- roll picker lines
  ['const x=d100(P.B,P.M),L=level(x.r,v);', 'const x=d100(P.B,P.M),L=level(x.r,v),dz=LASTD;', 'a skill test line keeps its dice'],
  ['res.push({n:c.n,txt,cls:ok?"ok":"bad"});', 'res.push({n:c.n,txt,cls:ok?"ok":"bad",dz});', 'a skill test line keeps its dice (result)'],
  ['const x=d100(0,0);const ok=x.r<=sl.san;', 'const x=d100(0,0),dz=LASTD;const ok=x.r<=sl.san;', 'a SAN test line keeps its dice'],
  ['res.push({n:c.n,txt,cls});', 'res.push({n:c.n,txt,cls,dz});', 'a SAN test line keeps its dice (result)'],
  ['const x=rollFormula(P.val);const v=Math.max(0,x.tot);', 'const x=rollFormula(P.val),dz=LASTF;const v=Math.max(0,x.tot);', 'a damage line keeps its dice'],
  ['res.push({n:c.n,txt,cls:"bad"});', 'res.push({n:c.n,txt,cls:"bad",dz});', 'a damage line keeps its dice (result)'],
  ['const x=rollFormula(P.val);res.push({n:P.label,', 'const x=rollFormula(P.val),dz=LASTF;res.push({dz,n:P.label,', 'damage without a target keeps its dice'],
  [
    '<li class="${r.cls}"><b>${esc(r.n)}</b> ${esc(r.txt)}</li>',
    '<li class="${r.cls}${r.dz&&!r.shown?" pk-wait":""}"><span class="pk-dice"></span><span class="pk-txt"><b>${esc(r.n)}</b> ${esc(r.txt)}</span></li>',
    'room for the dice on each result line; its text waits for them',
  ],
  [
    'function rollPick(){const P=PICK,st=ST();const res=[];PICK_BUSY=true;',
    `/* Grimoire: each result line of the picker throws its dice, its text shows once they rest. */
function pickDice(){const P=PICK;if(!P||!P.res)return;const lis=document.querySelectorAll("#pickBox .pres li");
  P.res.forEach((r,i)=>{const li=lis[i];if(!li||!r.dz||r.shown)return;r.shown=1;const show=()=>li.classList.remove("pk-wait");
    const stop=window.GRIMOIRE_DICE&&GRIMOIRE_DICE.throw(li.querySelector(".pk-dice"),r.dz,show,34);if(!stop)show();});}
function rollPick(){const P=PICK,st=ST();const res=[];PICK_BUSY=true;`,
    'the picker throws each line\'s dice',
  ],
  ['PICK_BUSY=false;P.res=res;save();renderPick();', 'PICK_BUSY=false;P.res=res;save();renderPick();pickDice();', 'the picker throws its dice after showing the lines'],
]

/** Applies the patches to engine source text (each must match exactly once). */
export function applyDicePatches(js) {
  for (const [from, to, why] of DICE_PATCHES) {
    const n = js.split(from).length - 1
    if (n !== 1) throw new Error(`Patch "${why}" matched ${n} times`)
    js = js.replace(from, () => to)
  }
  return js
}

if (process.argv.includes('--apply')) {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const file = 'public/play/engine.js'
  writeFileSync(file, applyDicePatches(readFileSync(file, 'utf8')))
  console.log(`${DICE_PATCHES.length} dice patches applied to ${file}`)
}
