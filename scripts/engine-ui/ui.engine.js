/* Grimoire UI (scripts/engine-ui.mjs): scene flow with choices, the scene's documents, the ambiance
   screen's preview, investigator sheets, a toolbar that stays on top. Plain engine code (sloppy
   script, same globals as the rest of engine.js), inserted just before the first route(). */

/* ---------- Scene flow: a step's choices ----------
   A step with `br` (the story's step.branch, or a title starting with "Si …"/"If …") is one of the
   choices of the step before it: shown under that step as lettered options (A, B, C), so the
   keeper sees at a glance what happens for each choice the players make.
   The engine renders a first time before this code runs: functions only here (hoisted), state in
   `var`s (no temporal dead zone). */
function flowHTML(fl){if(!fl||!fl.length)return "";
  const body=s=>`${s.txt?`<p>${s.txt}</p>`:""}${s.test?ftHTML(s.test):""}${s.ok?`<div class="fb ok"><span class="lab">Réussi</span> ${s.ok}</div>`:""}${s.ko?`<div class="fb ko"><span class="lab">Raté</span> ${s.ko}</div>`:""}${s.fail?`<div class="fb fx">${s.fail}</div>`:""}${s.extra?`<p class="fe">${s.extra}</p>`:""}`;
  const groups=[];fl.forEach(s=>{if(s.br&&groups.length)groups[groups.length-1].br.push(s);else groups.push({s,br:[]});});
  const choice=(b,j)=>`<li data-l="${String.fromCharCode(65+j%26)}"><div class="fh"><span class="br-if">${b.br}</span></div>${b.h&&b.h!==b.br?`<div class="br-t">${b.h}</div>`:""}${body(b)}</li>`;
  return `<div class="sec flow"><ol class="flw">${groups.map(({s,br})=>`<li${br.length?' class="has-br"':""}><div class="fh">${s.h||s.br||""}</div>${body(s)}${br.length?`<div class="flb-l">Selon le choix des joueurs</div><ol class="flb">${br.map(choice).join("")}</ol>`:""}</li>`).join("")}</ol></div>`;}

/* ---------- The ambiance screen's background for this scene ----------
   A small live preview (the TV's own drawing, /screen-preview in an iframe) next to the scene's
   sounds; a click opens the ambiance screen dialog. The host says what to show
   (GRIMOIRE_HOST.screenPreview(sceneId) → {src,label}). */
function scrPrevHTML(s){return window.GRIMOIRE_HOST&&GRIMOIRE_HOST.screenPreview?`<button type="button" class="scr-prev" data-scrprev="${esc(s.id)}" title="Écran d'ambiance"><span class="scr-frame"></span><span class="scr-lbl">Écran d'ambiance</span></button>`:"";}
var SCRP={id:null,src:"",lbl:""};
function fillScrPrev(){const b=document.querySelector("#scene [data-scrprev]");if(!b)return;const id=b.dataset.scrprev;
  const put=el=>{const f=el.querySelector(".scr-frame");if(!f||!SCRP.src)return;
    if(!f.firstChild){const fr=document.createElement("iframe");fr.src=SCRP.src;fr.tabIndex=-1;fr.title="";fr.setAttribute("aria-hidden","true");f.appendChild(fr);}
    el.querySelector(".scr-lbl").textContent=SCRP.lbl;el.title=SCRP.lbl;};
  if(SCRP.id===id){put(b);return;}
  SCRP={id,src:"",lbl:""};
  Promise.resolve(GRIMOIRE_HOST.screenPreview(id)).then(p=>{if(SCRP.id!==id||!p||!p.src)return;SCRP.src=String(p.src);SCRP.lbl=String(p.label||"");
    const cur=document.querySelector("#scene [data-scrprev]");if(cur&&cur.dataset.scrprev===id)put(cur);}).catch(e=>console.error(e));}
{const _rsU=renderScene;renderScene=function(){_rsU();fillScrPrev();};}
$("#scene").addEventListener("click",e=>{if(e.target.closest("[data-scrprev]")&&GRIMOIRE_HOST.openScreen)GRIMOIRE_HOST.openScreen();});

/* ---------- The scene's documents (letters, diaries, maps…) ----------
   Listed under the sounds, and linked where the scene flow mentions them: a click opens the
   document on paper, from where the keeper can show it on the ambiance screen. */
function hdIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4"/></svg>';}
function hdRowHTML(s){const H=GRIMOIRE_DATA.HANDOUTS||{};const ids=(s.hd||[]).filter(id=>H[id]);if(!ids.length)return "";
  return `<div class="hd-row"><span class="hd-lbl">Documents</span>${ids.map(id=>`<button type="button" class="hdc" data-hd="${esc(id)}">${hdIcon()}<span>${esc(H[id].t)}</span></button>`).join("")}</div>`;}
document.body.insertAdjacentHTML("beforeend",`<div class="pickdlg" id="hdDlg" hidden role="dialog" aria-modal="true" aria-labelledby="hdTitle"><div class="pick-box hd-box"><div class="pk-head"><span class="gm-eyebrow">Document</span><h3 id="hdTitle"></h3></div><div class="hd-paper"><div class="hd-img" hidden></div><div class="hd-txt"></div></div><div class="addrow"><button class="btn prim" id="hdShow">Montrer sur l'écran</button><button class="btn" id="hdClose">Fermer</button></div></div></div>`);
var HD=null,hdBack=null;
function openHd(id){const h=(GRIMOIRE_DATA.HANDOUTS||{})[id];if(!h)return;HD=id;hdBack=document.activeElement;
  $("#hdTitle").textContent=h.t;const tx=$("#hdDlg .hd-txt");tx.innerHTML=h.txt||"";tx.hidden=!h.txt;
  const im=$("#hdDlg .hd-img");im.innerHTML="";im.hidden=true;
  if(h.img&&GRIMOIRE_HOST.handoutImage)Promise.resolve(GRIMOIRE_HOST.handoutImage(id)).then(u=>{if(HD!==id||!u)return;const i=new Image();i.src=String(u);i.alt=h.t;im.appendChild(i);im.hidden=false;}).catch(e=>console.error(e));
  $("#hdShow").hidden=!GRIMOIRE_HOST.showHandout;$("#hdDlg").hidden=false;$("#hdClose").focus();}
function closeHd(){$("#hdDlg").hidden=true;HD=null;if(hdBack&&hdBack.focus)try{hdBack.focus();}catch{}hdBack=null;}
$("#scene").addEventListener("click",e=>{const b=e.target.closest("[data-hd]");if(!b)return;e.preventDefault();openHd(b.dataset.hd);});
$("#hdDlg").addEventListener("click",e=>{if(e.target.id==="hdDlg"||e.target.id==="hdClose"){closeHd();return;}
  if(e.target.id==="hdShow"&&HD){const ok=GRIMOIRE_HOST.showHandout(HD);if(ok!==false)toast("Document montré sur l'écran d'ambiance.");}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#hdDlg").hidden){closeHd();e.stopImmediatePropagation();}},true);

/* ---------- Investigator sheets ----------
   The name on an investigator card opens the account investigator's full presentation sheet
   (GRIMOIRE_HOST.openSheet, a dialog above the game); others just unfold their card. */
$("#invView").addEventListener("click",e=>{const b=e.target.closest("[data-sheet]");if(!b)return;const id=b.dataset.sheet;
  const ok=GRIMOIRE_HOST.openSheet&&GRIMOIRE_HOST.openSheet(id);
  if(!ok){openInv.has(id)?openInv.delete(id):openInv.add(id);renderInv();}});

/* ---------- Toolbar always on top ----------
   Its height, for what sticks below it (combat bar, dice pool) when the page scrolls. */
{const top=$("header.top");if(top&&window.ResizeObserver)new ResizeObserver(()=>document.documentElement.style.setProperty("--top-h",top.offsetHeight+"px")).observe(top);}
