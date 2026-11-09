/* =====================================================================
   Japan 2027 – reisapp (v3: bewerken + synchronisatie + LetsFG)
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const eur = n => '€ ' + Math.round(+n||0).toLocaleString('nl-NL');
const clone = o => JSON.parse(JSON.stringify(o));
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const BK = (h,ci,co) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(h.n||'')}&checkin=${h.ci||ci||''}&checkout=${h.co||co||''}&group_adults=4&no_rooms=2`;
const GM = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q||'')}`;
const IMG = q => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q||'')}`;
const LETSFG_TRIP = 'https://letsfg.co/t/0f2da6f17d34';
const LETSFG_SERVER = 'LetsFG | Book the best flights or hotels';
const MONTH = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const DOW = ['Zo','Ma','Di','Wo','Do','Vr','Za'];
const cvars = s => `--c:${s?.c1||'#888'};--c2:${s?.c2||'#bbb'}`;
const EVI = {see:'📍', eat:'🍜', go:'🚆', rest:'🛏️'};
const ls = { get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} } };
function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('on'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('on'),2600); }

/* ============ STATE ============ */
function defaults(){
  const stops = {};
  for (const [k,s] of Object.entries(STOPS)){
    const o = clone(s);
    o.todo = (o.todo||[]).map(a=>({e:a[0],h:a[1],d:a[2],q:a[3]||''}));
    o.gems = (o.gems||[]).map(a=>({e:a[0],h:a[1],d:a[2],q:a[3]||''}));
    o.food = (o.food||[]).map(a=>({e:a[0],h:a[1],d:a[2]}));
    o.hotels = o.hotels||[]; o.chosen = 0; stops[k]=o;
  }
  const days = DAYS.map((d,i)=>({ id:'d'+String(i+1).padStart(2,'0'), order:i+1, city:d.city, sleep:d.sleep||'', sleepTxt:d.sleepTxt||'',
    title:d.title, sub:d.sub, tip:d.tip, move:d.move||null, items:d.items.map(a=>({t:a[0],h:a[1],d:a[2],q:a[3]||'',k:a[4]||'see'})) }));
  return { stops, days, meta:{ start:'2027-05-04', order:clone(ORDER), budgetMax:35000, budget:BUDGET.map(b=>({n:b[0],v:b[1],c:b[2]})),
    flight:{ airline:'Emirates via Dubai', out:'Di 4 mei 22:00 Schiphol → Wo 5 mei 22:20 Tokyo Haneda', back:'Ma 24 mei 21:30 Tokyo Narita → Di 25 mei 11:00 Schiphol', price:5268, booked:false, link:LETSFG_TRIP } },
    check:{ done:{}, custom:{} } };
}
let S = ls.get('jp27-state-v3', null) || defaults();
const dayList = () => [...S.days].sort((a,b)=>a.order-b.order);
const stopIds = () => (S.meta.order||[]).filter(k=>S.stops[k]);
const dateOf = i => { const d = new Date(S.meta.start+'T12:00:00'); d.setDate(d.getDate()+i); return d; };
const iso = d => d.toISOString().slice(0,10);
const fmt = d => `${d.getDate()} ${MONTH[d.getMonth()]}`;
function stopRange(k){ const L=dayList(); const idx=L.map((d,i)=>d.sleep===k?i:-1).filter(i=>i>=0);
  if(!idx.length){ const v=L.map((d,i)=>d.city===k?i:-1).filter(i=>i>=0); return v.length?{nights:0,label:fmt(dateOf(v[0]))+(v.length>1?' – '+fmt(dateOf(v[v.length-1])):''),ci:iso(dateOf(v[0])),co:iso(dateOf(v[0]+1))}:{nights:0,label:'—'}; }
  const a=idx[0], b=idx[idx.length-1]+1; return {nights:idx.length,label:`${fmt(dateOf(a))} – ${fmt(dateOf(b))}`,ci:iso(dateOf(a)),co:iso(dateOf(b))}; }
const chosen = k => { const s=S.stops[k]; if(!s||!s.hotels?.length) return null; return s.hotels[Math.min(+s.chosen||0, s.hotels.length-1)]; };
const hotelPrice = h => h ? (+h.pb && !h.hb ? +h.pb : +h.p||0) : 0;

/* ============ STORAGE ADAPTER (db of lokaal) ============ */
const Store = {
  mode:'local', db:null, canWrite:true, ready:false,
  async saveStop(k){ if(this.mode==='db') return this.w(this.db.doc('stops/'+k).set(clone(S.stops[k]))); this.local(); },
  async deleteStop(k){ if(this.mode==='db') return this.w(this.db.doc('stops/'+k).delete()); this.local(); },
  async saveDay(d){ if(this.mode==='db') return this.w(this.db.doc('days/'+d.id).set(clone(d))); this.local(); },
  async deleteDay(id){ if(this.mode==='db') return this.w(this.db.doc('days/'+id).delete()); this.local(); },
  async saveMeta(){ if(this.mode==='db') return this.w(this.db.doc('trip/meta').set(clone(S.meta))); this.local(); },
  async saveCheck(){ if(this.mode==='db') return this.w(this.db.doc('trip/check').set(clone(S.check))); this.local(); },
  local(){ ls.set('jp27-state-v3', S); rerender(); },
  async w(p){ try{ await p; }catch(e){ if(e&&e.code==='invalid_argument'){ this.canWrite=false; setEditing(false); updateBadge(); toast('Je hebt geen bewerkrechten voor deze app'); }
    else if(e&&e.code==='quota_exceeded') toast('Opslag vol: verwijder iets en probeer opnieuw'); else toast('Opslaan lukte niet, probeer het nog eens'); throw e; } }
};
async function connectDb(){
  if (!window.claude || typeof window.claude.use!=='function'){ updateBadge(); return; }
  let db=null, user=null;
  try{ [db,user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); }catch(e){}
  if (!db){ updateBadge(); return; }
  Store.mode='db'; Store.db=db; Store.status='connecting'; updateBadge();
  try{ const c = user ? await user.can('data.write') : null; Store.canWrite = c!==false; }catch(e){}
  const got = {stops:false,days:false,meta:false,check:false};
  const timer = setTimeout(()=>{ if(!Store.ready){ Store.status='slow'; updateBadge(); } }, 10000);
  const done = () => { if(Object.values(got).every(Boolean)){ clearTimeout(timer); if(!Store.ready){ Store.ready=true; Store.status='live'; updateBadge(); } rerender(); } };
  const err = () => { clearTimeout(timer); Store.status='error'; updateBadge(); };
  let fresh = {stops:null,days:null};
  db.collection('stops').onSnapshot(q=>{ if(!q.empty){ const o={}; q.docs.forEach(d=>o[d.id]=clone(d.data())); S.stops=o; } got.stops=true; done(); }, err);
  db.collection('days').onSnapshot(q=>{ if(!q.empty){ S.days=q.docs.map(d=>({...clone(d.data()), id:d.id})); } got.days=true; done(); }, err);
  db.doc('trip/meta').onSnapshot(d=>{ if(d.exists) S.meta=clone(d.data()); got.meta=true; done(); }, err);
  db.doc('trip/check').onSnapshot(d=>{ if(d.exists) S.check=clone(d.data()); got.check=true; done(); }, err);
}
function updateBadge(){
  document.body.classList.toggle('dbmode', Store.mode==='db');
  const b=$('#sync'); if(!b) return;
  const m = Store.mode==='db' ? ({connecting:['⏳','Verbinden…','wait'],slow:['⚠️','Nog niet bereikt','warn'],error:['⚠️','Geen verbinding','warn'],live:[Store.canWrite?'☁️':'👁️',Store.canWrite?'Live gedeeld':'Alleen bekijken','ok']}[Store.status]||['⏳','Verbinden…','wait'])
                                  : ['💾','Alleen dit apparaat','loc'];
  b.className='sync '+m[2]; b.innerHTML=`<span>${m[0]}</span><em>${m[1]}</em>`;
  b.title = Store.mode==='db' ? 'Wijzigingen worden direct gedeeld met iedereen die deze app via claude.ai opent' : 'Wijzigingen worden alleen in deze browser bewaard. Open de app via claude.ai om te synchroniseren.';
  $('#bEdit').style.display = Store.canWrite ? '' : 'none';
}

/* ============ EDIT MODE ============ */
let editing = false, modalOpen = false, pendingRender = false;
function setEditing(v){ editing = v && Store.canWrite; document.body.classList.toggle('editing', editing); $('#bEdit').classList.toggle('on', editing);
  $('#bEdit').innerHTML = editing ? '✓ <span>Klaar</span>' : '✏️ <span>Bewerken</span>'; rerender(); }
function rerender(){ if(modalOpen){ pendingRender=true; return; } renderRoute(true); }

/* ---- generic form modal ---- */
function field(f, v){
  const id='f_'+f.k; const val = v ?? f.def ?? '';
  const lab = `<label for="${id}">${esc(f.l)}${f.hint?`<small>${esc(f.hint)}</small>`:''}</label>`;
  if (f.t==='textarea') return `<div class="fld ${f.w||''}">${lab}<textarea id="${id}" data-k="${f.k}" rows="${f.rows||3}">${esc(val)}</textarea></div>`;
  if (f.t==='select') return `<div class="fld ${f.w||''}">${lab}<select id="${id}" data-k="${f.k}">${f.o.map(o=>`<option value="${esc(o[0])}" ${String(o[0])===String(val)?'selected':''}>${esc(o[1])}</option>`).join('')}</select></div>`;
  if (f.t==='check') return `<div class="fld chkf ${f.w||''}"><label><input type="checkbox" data-k="${f.k}" ${val?'checked':''}> ${esc(f.l)}</label></div>`;
  if (f.t==='list') return `<div class="fld full"><div class="lhead"><b>${esc(f.l)}</b><button type="button" class="mini" data-add="${f.k}">＋ Toevoegen</button></div><div class="lrows" data-list="${f.k}">${(val||[]).map((r,i)=>listRow(f,r)).join('')}</div></div>`;
  return `<div class="fld ${f.w||''}">${lab}<input id="${id}" data-k="${f.k}" type="${f.t||'text'}" value="${esc(val)}" ${f.t==='number'?'step="any"':''} placeholder="${esc(f.ph||'')}"></div>`;
}
function listRow(f, r){ r = r||{};
  return `<div class="lrow">${f.f.map(sf=>{ const v=r[sf.k]??sf.def??'';
    if(sf.t==='select') return `<select data-sk="${sf.k}" class="${sf.w||''}" title="${esc(sf.l)}">${sf.o.map(o=>`<option value="${esc(o[0])}" ${String(o[0])===String(v)?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`;
    if(sf.t==='check') return `<label class="rc ${sf.w||''}"><input type="checkbox" data-sk="${sf.k}" ${v?'checked':''}>${esc(sf.l)}</label>`;
    if(sf.t==='textarea') return `<textarea data-sk="${sf.k}" class="${sf.w||''}" rows="2" placeholder="${esc(sf.l)}">${esc(v)}</textarea>`;
    return `<input data-sk="${sf.k}" class="${sf.w||''}" type="${sf.t||'text'}" ${sf.t==='number'?'step="any"':''} value="${esc(v)}" placeholder="${esc(sf.l)}" title="${esc(sf.l)}">`; }).join('')}
    <div class="ract"><button type="button" class="ib" data-mv="-1" title="Omhoog">↑</button><button type="button" class="ib" data-mv="1" title="Omlaag">↓</button><button type="button" class="ib del" data-rm title="Verwijderen">✕</button></div></div>`; }
function openForm({title, sub, fields, data, onSave, extra, danger}){
  modalOpen = true;
  const m = $('#modal');
  m.innerHTML = `<div class="mbox" role="dialog" aria-modal="true"><div class="mhead"><div><h3>${esc(title)}</h3>${sub?`<p>${esc(sub)}</p>`:''}</div><button class="ib x" data-close>✕</button></div>
    <form class="mbody">${fields.map(f=>field(f, data[f.k])).join('')}</form>
    <div class="mfoot">${danger?`<button class="btn dangerb" data-danger>${esc(danger.l)}</button>`:''}<span style="flex:1"></span>${extra||''}<button class="btn ghost2" data-close>Annuleren</button><button class="btn primary" data-save>Opslaan</button></div></div>`;
  m.classList.add('on');
  const form = m.querySelector('form');
  form.addEventListener('click', e=>{
    const add = e.target.closest('[data-add]'); if(add){ const f=fields.find(x=>x.k===add.dataset.add); form.querySelector(`[data-list="${f.k}"]`).insertAdjacentHTML('beforeend', listRow(f,{})); return; }
    const row = e.target.closest('.lrow'); if(!row) return;
    if(e.target.closest('[data-rm]')) row.remove();
    const mv = e.target.closest('[data-mv]'); if(mv){ const d=+mv.dataset.mv; if(d<0&&row.previousElementSibling) row.parentNode.insertBefore(row,row.previousElementSibling); if(d>0&&row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling,row); }
  });
  const close = () => { m.classList.remove('on'); m.innerHTML=''; modalOpen=false; if(pendingRender){ pendingRender=false; renderRoute(true); } };
  m.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
  m.onclick = e => { if(e.target===m) close(); };
  if (danger) m.querySelector('[data-danger]').onclick = async () => { const b=m.querySelector('[data-danger]'); if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Zeker weten? Klik nogmaals'; return; } close(); await danger.fn(); };
  m.querySelector('[data-save]').onclick = async () => {
    const out = {};
    fields.forEach(f=>{
      if (f.t==='list'){ out[f.k] = [...form.querySelectorAll(`[data-list="${f.k}"] .lrow`)].map(r=>{ const o={}; f.f.forEach(sf=>{ const el=r.querySelector(`[data-sk="${sf.k}"]`); o[sf.k] = sf.t==='check'?el.checked: sf.t==='number'?(el.value===''?'':+el.value): el.value.trim(); }); return o; }).filter(o=>Object.values(o).some(v=>v!==''&&v!==false)); }
      else { const el=form.querySelector(`[data-k="${f.k}"]`); out[f.k] = f.t==='check'?el.checked : f.t==='number'?(el.value===''?'':+el.value) : el.value.trim(); }
    });
    const btn=m.querySelector('[data-save]'); btn.disabled=true; btn.textContent='Opslaan…';
    try{ await onSave(out); close(); toast(Store.mode==='db'?'Opgeslagen en gedeeld ☁️':'Opgeslagen op dit apparaat'); }catch(e){ btn.disabled=false; btn.textContent='Opslaan'; }
  };
}
const stopOpts = (none) => [...(none?[['',none]]:[]), ...stopIds().map(k=>[k,S.stops[k].name+(k==='tokyo2'?' (laatste nacht)':'')]), ...(S.stops.ams?[['ams','Amsterdam']]:[])];
const itemFields = [{k:'t',l:'Tijd',w:'s'},{k:'k',l:'Soort',t:'select',w:'s',o:[['see','📍 Bezienswaardig'],['eat','🍜 Eten'],['go','🚆 Vervoer'],['rest','🛏️ Rust']]},{k:'h',l:'Titel',w:'m'},{k:'d',l:'Uitleg',t:'textarea',w:'l'},{k:'q',l:'Zoekterm foto/kaart',w:'m'}];
const spotFields = [{k:'e',l:'Emoji',w:'xs'},{k:'h',l:'Titel',w:'m'},{k:'d',l:'Uitleg',t:'textarea',w:'l'},{k:'q',l:'Zoekterm foto/kaart',w:'m'}];
const hotelFields = [{k:'tag',l:'Label (bv. Aanrader)',w:'m'},{k:'n',l:'Naam hotel',w:'l'},{k:'s',l:'Sterren (bv. 4★)',w:'s'},{k:'r',l:'Score (bv. 4,5)',w:'s'},{k:'rc',l:'Aantal reviews',w:'s'},{k:'p',l:'Prijs totaal €',t:'number',w:'s'},{k:'pb',l:'Prijs met ontbijt €',t:'number',w:'s'},{k:'f',l:'Gratis annuleren',t:'check',w:'s'},{k:'booked',l:'✅ Geboekt',t:'check',w:'s'},{k:'x',l:'Omschrijving',t:'textarea',w:'l'},{k:'q',l:'Zoekterm Google Maps',w:'m'},{k:'url',l:'Eigen link (boeking)',w:'m'}];

/* ---- editors ---- */
function editDay(d){
  const L=dayList(), i=L.findIndex(x=>x.id===d.id);
  openForm({ title:`Dag ${i+1} bewerken`, sub:`${DOW[dateOf(i).getDay()]} ${fmt(dateOf(i))}`,
    fields:[{k:'title',l:'Titel',w:'l'},{k:'sub',l:'Ondertitel',w:'l'},{k:'city',l:'Plaats',t:'select',o:stopOpts(),w:'m'},{k:'sleep',l:'Slapen in',t:'select',o:stopOpts('✈️ Geen hotel / vliegtuig'),w:'m'},
      {k:'mode',l:'Vervoer vandaag',t:'select',w:'s',o:[['','— geen —'],['🚄','🚄 Shinkansen/trein'],['🚆','🚆 Trein'],['🚌','🚌 Bus'],['⛴️','⛴️ Boot'],['✈️','✈️ Vliegtuig'],['🚗','🚗 Auto/taxi']]},{k:'from',l:'Van',w:'s'},{k:'to',l:'Naar',w:'s'},{k:'how',l:'Hoe (bv. Romancecar)',w:'s'},{k:'dur',l:'Duur',w:'s'},
      {k:'tip',l:'Tip van de dag',t:'textarea',w:'full'},{k:'items',l:'Programma',t:'list',f:itemFields}],
    data:{...d, mode:d.move?.mode||'', from:d.move?.from||'', to:d.move?.to||'', how:d.move?.how||'', dur:d.move?.dur||''},
    danger:{l:'🗑️ Dag verwijderen', fn:async()=>{ S.days=S.days.filter(x=>x.id!==d.id); await Store.deleteDay(d.id); const n=Math.min(i+1, dayList().length); location.hash='dag-'+n; toast('Dag verwijderd'); }},
    onSave: async o => { const nd = {...d, title:o.title, sub:o.sub, city:o.city, sleep:o.sleep, tip:o.tip, items:o.items, move: o.mode||o.from||o.to ? {mode:o.mode||'🚆',from:o.from,to:o.to,how:o.how,dur:o.dur} : null};
      S.days = S.days.map(x=>x.id===d.id?nd:x); await Store.saveDay(nd); }
  });
}
async function insertDay(afterIdx){
  const L=dayList(); const a=L[afterIdx], b=L[afterIdx+1];
  const order = a ? (b ? (a.order+b.order)/2 : a.order+1) : (b ? b.order-1 : 1);
  const base = a || b;
  const nd = { id:uid('d'), order, city:base?.city||stopIds()[0], sleep:base?.sleep||'', sleepTxt:'', title:'Nieuwe dag', sub:'Vrije dag – vul zelf in', tip:'', move:null, items:[] };
  S.days.push(nd); await Store.saveDay(nd); location.hash='dag-'+(afterIdx+2); toast('Dag toegevoegd – de datums schuiven automatisch op'); setTimeout(()=>editDay(nd),300);
}
async function moveDay(idx, dir){
  const L=dayList(), a=L[idx], b=L[idx+dir]; if(!a||!b) return;
  [a.order,b.order]=[b.order,a.order]; await Store.saveDay(a); await Store.saveDay(b); location.hash='dag-'+(idx+dir+1);
}
function editStop(k){
  const s = S.stops[k]; const isNew = !s;
  const d = s || { name:'', jp:'', kanji:'', tag:'', intro:'', temp:'', c1:'#3f5bd8', c2:'#8fa5ff', coord:[135,35], todo:[], gems:[], food:[], hotels:[], chosen:0 };
  openForm({ title: isNew?'Nieuwe plaats toevoegen':`${s.name} bewerken`, sub: isNew?'Na het opslaan kun je dagen aan deze plaats koppelen.':'Alles wat je hier aanpast zie je meteen in de app.',
    fields:[{k:'name',l:'Naam',w:'m'},{k:'jp',l:'Japanse naam',w:'s',ph:'京都'},{k:'kanji',l:'Groot teken op achtergrond',w:'s',ph:'京都'},{k:'tag',l:'Korte typering',w:'m',ph:'Tempels & geisha'},
      {k:'temp',l:'Temperatuur mei',w:'s',ph:'± 22°'},{k:'c1',l:'Kleur 1',t:'color',w:'xs'},{k:'c2',l:'Kleur 2',t:'color',w:'xs'},
      {k:'lat',l:'Breedtegraad',t:'number',w:'s',hint:'Google Maps → rechtsklik op de plek → kopieer het eerste getal'},{k:'lng',l:'Lengtegraad',t:'number',w:'s',hint:'…en het tweede getal'},
      {k:'intro',l:'Introductie',t:'textarea',w:'full',rows:3},
      {k:'todo',l:'🎯 Wat te doen',t:'list',f:spotFields},{k:'gems',l:'💎 Minder bekende parels',t:'list',f:spotFields},{k:'food',l:'🍜 Eten & drinken',t:'list',f:spotFields.slice(0,3)},
      {k:'hotels',l:'🏨 Hotels',t:'list',f:hotelFields}],
    data:{...d, lat:d.coord?.[1], lng:d.coord?.[0]},
    danger: isNew?null:{l:'🗑️ Plaats verwijderen', fn:async()=>{ delete S.stops[k]; S.meta.order=S.meta.order.filter(x=>x!==k); await Store.saveMeta(); await Store.deleteStop(k); location.hash='plaatsen'; toast('Plaats verwijderd'); }},
    onSave: async o => {
      const id = isNew ? uid('s') : k;
      const ns = {...d, name:o.name||'Nieuwe plaats', jp:o.jp, kanji:o.kanji||o.name.slice(0,2), tag:o.tag, temp:o.temp, c1:o.c1, c2:o.c2, intro:o.intro,
        coord:[+o.lng||d.coord[0], +o.lat||d.coord[1]], todo:o.todo, gems:o.gems, food:o.food, hotels:o.hotels.map(h=>({...h, p:+h.p||0, pb:+h.pb||'' })), chosen:Math.min(+d.chosen||0, Math.max(0,o.hotels.length-1))};
      S.stops[id]=ns; await Store.saveStop(id);
      if(isNew){ S.meta.order=[...S.meta.order.filter(x=>x!=='tokyo2'), id, ...(S.meta.order.includes('tokyo2')?['tokyo2']:[])]; await Store.saveMeta(); location.hash='plaats-'+id; }
    }
  });
}
async function moveStop(k, dir){ const o=[...S.meta.order]; const i=o.indexOf(k), j=i+dir; if(j<0||j>=o.length) return; [o[i],o[j]]=[o[j],o[i]]; S.meta.order=o; await Store.saveMeta(); }
function editFlight(){
  const f=S.meta.flight||{};
  openForm({ title:'Vluchten bewerken', fields:[{k:'airline',l:'Maatschappij / route',w:'l'},{k:'out',l:'Heenvlucht',w:'full'},{k:'back',l:'Terugvlucht',w:'full'},{k:'price',l:'Prijs totaal €',t:'number',w:'s'},{k:'booked',l:'✅ Geboekt',t:'check',w:'s'},{k:'ref',l:'Boekingsnummer',w:'m'},{k:'link',l:'Link (LetsFG of airline)',w:'l'}],
    data:f, onSave: async o => { S.meta.flight=o; const b=S.meta.budget.find(x=>/vlucht/i.test(x.n)); if(b&&o.price) b.v=+o.price; await Store.saveMeta(); } });
}
function editBudget(){
  openForm({ title:'Budget bewerken', sub:'De hotelregel wordt automatisch berekend uit de gekozen hotels.',
    fields:[{k:'budgetMax',l:'Totaal budget €',t:'number',w:'s'},{k:'budget',l:'Posten',t:'list',f:[{k:'n',l:'Omschrijving',w:'l'},{k:'v',l:'Bedrag €',t:'number',w:'s'},{k:'c',l:'Kleur',t:'color',w:'xs'}]}],
    data:{budgetMax:S.meta.budgetMax, budget:S.meta.budget}, onSave: async o => { S.meta.budgetMax=+o.budgetMax||35000; S.meta.budget=o.budget.map(b=>({...b, v:+b.v||0, c:b.c||'#888'})); await Store.saveMeta(); } });
}

/* ============ LIVE HOTELPRIJZEN (LetsFG via claude.ai) ============ */
let mcpP = null; const getMcp = () => mcpP || (mcpP = (window.claude && typeof window.claude.use==='function') ? window.claude.use('mcp').catch(()=>null) : Promise.resolve(null));
async function liveHotels(k){
  const box = $('#live'); const s = S.stops[k]; const r = stopRange(k);
  const mcp = await getMcp();
  if (!mcp){ box.innerHTML = `<p class="muted">Live prijzen werken alleen als je de app opent via claude.ai én LetsFG gekoppeld hebt. Je kunt ook <a href="${LETSFG_TRIP}" target="_blank" rel="noopener">LetsFG openen</a> of bij Claude in de chat vragen om opnieuw te zoeken.</p>`; return; }
  if (!r.ci){ box.innerHTML = `<p class="muted">Koppel eerst een dag aan deze plaats (bij "Slapen in"), dan weet de app voor welke data hij moet zoeken.</p>`; return; }
  box.innerHTML = `<div class="loading"><span class="spin"></span> LetsFG zoekt hotels in ${esc(s.name)} voor ${esc(r.label)} (2 kamers, 4 personen). Dit duurt 30 seconden tot 2 minuten…</div>`;
  try{
    const st = await mcp.callTool(LETSFG_SERVER, 'search_hotels', { location:s.name+', Japan', checkin:r.ci, checkout:r.co, rooms:[{adults:2},{adults:2}], currency:'EUR', language:'nl', max_results:6 }, {cache:false});
    const sid = st?.payload?.search_id; if(!sid) throw {code:'tool_error', message:'Geen zoek-id ontvangen'};
    let res=null;
    for (let i=0;i<8;i++){ const g = await mcp.callTool(LETSFG_SERVER, 'get_hotel_results', { search_id:sid, max_results:6, response_mode:'full' }, {cache:false});
      res = g?.payload; if (res && res.status!=='running') break; }
    const hs = (res && Array.isArray(res.hotels)) ? res.hotels : [];
    if (!hs.length){ box.innerHTML = `<p class="muted">LetsFG gaf deze keer geen beschikbaarheid terug. Dat betekent niet dat alles vol is. <button class="mini" id="liveAgain">Opnieuw zoeken</button></p>`; $('#liveAgain').onclick=()=>liveHotels(k); return; }
    const rows = hs.map(h=>{ const offs=(h.offers||[]).filter(o=>typeof o.price==='number'); const c=offs.length?offs.reduce((a,b)=>a.price<b.price?a:b):null;
      const bf=offs.filter(o=>/breakfast|half|ontbijt/i.test(o.board||'')); const b=bf.length?bf.reduce((a,x)=>a.price<x.price?a:x):null;
      return { tag:'Live via LetsFG', n:h.name, s:h.stars?h.stars+'★':'', r:h.guest_rating?String(h.guest_rating).replace('.',','):'', rc:h.review_count?String(h.review_count):'', p:c?Math.round(c.price):0, pb:b?Math.round(b.price):'', f:!!c?.refundable, x:c?`${c.room} · ${c.board}`:'', q:`${h.name} ${s.name}` }; }).filter(h=>h.p);
    box.innerHTML = `<p class="muted" style="margin-bottom:10px">Gevonden op ${new Date().toLocaleString('nl-NL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · totaalprijs voor ${r.nights||1} ${r.nights>1?'nachten':'nacht'}, 2 kamers</p>` +
      rows.map((h,i)=>`<div class="hotel live"><div class="row"><div><div class="tg">${h.f?'✓ Gratis annuleren':'Niet annuleerbaar'}</div><b>${esc(h.n)}</b><div class="sc">${h.r?`<em>${esc(h.r)}</em>`:''}${h.rc?esc(h.rc)+' reviews':''}${h.s?' · '+esc(h.s):''}</div></div><div class="pr"><b>${eur(h.p)}</b><small>${h.pb?eur(h.pb)+' met ontbijt':'alleen kamer'}</small></div></div><p>${esc(h.x)}</p>
        <div class="fl"><a href="${GM(h.q)}" target="_blank" rel="noopener">Google Maps →</a><a href="${IMG(h.q)}" target="_blank" rel="noopener">📸 Foto's</a>${Store.canWrite?`<button class="mini addh" data-i="${i}">＋ Toevoegen aan plan</button>`:''}</div></div>`).join('') +
      `<p class="muted" style="margin-top:10px">Boeken gaat via LetsFG: vraag het aan Claude in de chat, of open <a href="${LETSFG_TRIP}" target="_blank" rel="noopener">LetsFG</a>.</p>`;
    box.querySelectorAll('.addh').forEach(b=>b.onclick=async()=>{ const h=rows[+b.dataset.i]; h.ci=r.ci; h.co=r.co; S.stops[k].hotels=[...(S.stops[k].hotels||[]), h]; await Store.saveStop(k); toast('Hotel toegevoegd aan het plan'); });
  }catch(e){
    const c = e?.code; const msg = {server_not_connected:'LetsFG is niet gekoppeld bij jouw account. Voeg het toe in claude.ai → Instellingen → Connectors.', needs_reauth:'Je LetsFG-koppeling is verlopen. Koppel opnieuw in claude.ai → Instellingen → Connectors.', not_in_manifest:'Je hebt deze app geen toestemming gegeven om LetsFG te gebruiken.', approval_required:'Deze zoekopdracht heeft jouw toestemming nodig. Klik nogmaals en kies "Toestaan".', blocked_by_policy:'LetsFG is voor jouw account geblokkeerd.', server_unavailable:'LetsFG is even niet bereikbaar. Probeer het zo nog eens.'}[c] || 'Het zoeken lukte niet. Probeer het later opnieuw of vraag het aan Claude in de chat.';
    box.innerHTML = `<p class="muted">${esc(msg)} <button class="mini" id="liveAgain">Opnieuw proberen</button></p>`; $('#liveAgain').onclick=()=>liveHotels(k);
  }
}

/* ============ STARS & COUNTDOWN ============ */
(function(){ const c=$('#stars'), x=c.getContext('2d');
  function draw(){ const dpr=devicePixelRatio||1; c.width=innerWidth*dpr; c.height=innerHeight*dpr; x.clearRect(0,0,c.width,c.height);
    for(let i=0;i<500;i++){ x.globalAlpha=Math.random()*.8+.1; x.fillStyle=Math.random()<.08?'#ffd7a8':'#fff'; x.beginPath(); x.arc(Math.random()*c.width,Math.random()*c.height,Math.random()*1.2*dpr,0,7); x.fill(); } }
  draw(); addEventListener('resize', draw); })();
function tick(){ const dep=new Date(S.meta.start+'T22:00:00+02:00'); const d=Math.max(0, Math.ceil((dep-new Date())/864e5)); $('#cdD').textContent=d; const e=$('#cdD2'); if(e) e.textContent=d; }
setInterval(tick, 60000);

/* ============ GLOBE ============ */
let globe=null, spinning=true, tourTimer=null, globeSig='';
const DXB=[55.36,25.25];
function globeSeries(){
  const ids=stopIds(); const legs=[]; for(let i=0;i<ids.length-1;i++) legs.push({coords:[S.stops[ids[i]].coord, S.stops[ids[i+1]].coord]});
  const pts = ids.filter(k=>k!=='tokyo2').map(k=>({name:S.stops[k].name, id:k, value:[...S.stops[k].coord,0]}));
  const ams = S.stops.ams?.coord || [4.76,52.31];
  return [
    { type:'lines3D', coordinateSystem:'globe', blendMode:'lighter', lineStyle:{width:2,color:'#7d9bff',opacity:.4}, effect:{show:true,period:4,trailWidth:4,trailLength:.25,trailOpacity:1,trailColor:'#cdd9ff'},
      data:[{coords:[ams,DXB]},{coords:[DXB,[139.78,35.55]]},{coords:[[140.39,35.77],DXB]},{coords:[DXB,ams]}] },
    { type:'lines3D', coordinateSystem:'globe', blendMode:'lighter', lineStyle:{width:3,color:'#f2b544',opacity:.6}, effect:{show:true,period:2.4,trailWidth:5,trailLength:.35,trailOpacity:1,trailColor:'#fff3cf'}, data:legs },
    { type:'scatter3D', coordinateSystem:'globe', symbolSize:9, blendMode:'lighter', itemStyle:{color:'#fff'}, label:{show:true,position:'right',distance:4,formatter:p=>p.name,textStyle:{color:'#fff',fontSize:13,fontWeight:'bold',backgroundColor:'rgba(11,16,32,.78)',padding:[3,7],borderRadius:4}}, data:pts },
    { type:'scatter3D', coordinateSystem:'globe', symbolSize:8, itemStyle:{color:'#7d9bff'}, label:{show:true,position:'right',formatter:p=>p.name,textStyle:{color:'#dfe6ff',fontSize:12,backgroundColor:'rgba(11,16,32,.78)',padding:[3,7],borderRadius:4}}, data:[{name:'Amsterdam',value:[...ams,0]},{name:'Dubai',value:[...DXB,0]}] }];
}
function initGlobe(){
  try{
    if(!window.echarts || !echarts.getMap('world')) throw 0;
    const tex=echarts.init(document.createElement('canvas'),null,{width:4096,height:2048});
    tex.setOption({ backgroundColor:'#0a1a38', geo:{ type:'map', map:'world', top:0,left:0,right:0,bottom:0, boundingCoords:[[-180,90],[180,-90]], silent:true, itemStyle:{areaColor:'#1b3358',borderColor:'#36598a',borderWidth:1.2},
      regions:[{name:'Japan',itemStyle:{areaColor:'#e8402a',borderColor:'#ffd9cf',borderWidth:2.5}},{name:'Netherlands',itemStyle:{areaColor:'#f2b544',borderColor:'#fff1c9'}}] } });
    globe=echarts.init($('#globe'));
    globe.setOption({ globe:{ baseTexture:tex, shading:'lambert', globeRadius:100, ...(innerWidth>1000?{left:'28%',width:'72%',top:0,height:'100%'}:{left:0,width:'100%',top:'-12%',height:'100%'}),
        light:{ambient:{intensity:.6},main:{intensity:1.2,alpha:28,beta:-30}},
        viewControl:{autoRotate:true,autoRotateSpeed:5,autoRotateAfterStill:1e6,distance:220,minDistance:8,maxDistance:400,targetCoord:[60,35],animation:true,animationDurationUpdate:1800,animationEasingUpdate:'cubicInOut'},
        postEffect:{enable:true,bloom:{enable:true,bloomIntensity:.22}} }, series:globeSeries() });
    globeSig=JSON.stringify(stopIds().map(k=>S.stops[k].coord));
    globe.on('click', p=>{ if(p.data&&p.data.id) location.hash='plaats-'+p.data.id; });
    addEventListener('resize', ()=>globe&&globe.resize());
    setTimeout(()=>{ if(curView==='reis'&&!tourTimer) flyTo([136.5,35.8],75); }, 3800);
  }catch(e){ $('#globeFallback').style.display='block'; }
}
function refreshGlobe(){ if(!globe) return; const sig=JSON.stringify(stopIds().map(k=>S.stops[k].coord)); if(sig!==globeSig){ globeSig=sig; globe.setOption({series:globeSeries()}, {replaceMerge:['series']}); } }
function flyTo(coord,dist){ if(!globe) return; spinning=false; $('#gSpin').classList.remove('on'); globe.setOption({globe:{viewControl:{targetCoord:coord,distance:dist,autoRotate:false}}}); }
$('#gWorld').onclick=()=>{ stopTour(); globe&&globe.setOption({globe:{viewControl:{targetCoord:[60,35],distance:220}}}); };
$('#gJapan').onclick=()=>{ stopTour(); flyTo([136.5,35.8],55); };
$('#gSpin').onclick=()=>{ spinning=!spinning; $('#gSpin').classList.toggle('on',spinning); globe&&globe.setOption({globe:{viewControl:{autoRotate:spinning}}}); };
function renderStrip(){ $('#strip').innerHTML = stopIds().map((k,i)=>{ const s=S.stops[k]; return `<a class="chipstop" href="#plaats-${k}" data-k="${k}" style="${cvars(s)}"><span class="dot">${i+1}</span><span><b>${esc(s.name)}</b><small>${esc(stopRange(k).label)}</small></span></a>`; }).join('');
  const L=dayList(); $('#stDays').textContent=L.length; $('#stNights').textContent=L.filter(d=>d.sleep).length; $('#stStops').textContent=new Set(L.map(d=>d.sleep).filter(Boolean)).size; tick(); }
function showTourCard(k){ const s=S.stops[k]||{name:'Amsterdam',kanji:'旅',c1:'#4f6bff',c2:'#9b7bff',intro:'Vertrek vanaf Schiphol.'};
  $('#tourCard').innerHTML=`<div class="tc-hero" style="background:linear-gradient(135deg,${s.c1},${s.c2})"><div class="k">${esc(s.kanji)}</div><small style="font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px">${esc(k==='ams'?'4 mei':stopRange(k).label)}</small><h3>${esc(s.name)}</h3></div><div class="tc-b">${esc(s.intro)}${k!=='ams'?`<br><a href="#plaats-${k}">Bekijk ${esc(s.name)} →</a>`:''}</div>`;
  $('#tourCard').classList.add('on'); $$('.chipstop').forEach(c=>c.classList.toggle('on',c.dataset.k===k)); const a=document.querySelector(`.chipstop[data-k="${k}"]`); a&&a.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}); }
function stopTour(){ if(tourTimer){ clearInterval(tourTimer); tourTimer=null; } $('#bTour').classList.remove('on'); $('#bTour').textContent='▶ Speel de reis af'; }
$('#bTour').onclick=()=>{ if(tourTimer){ stopTour(); return; } $('#bTour').classList.add('on'); $('#bTour').textContent='⏸ Pauze';
  const seq=['ams',...stopIds()]; let i=0;
  const step=()=>{ const k=seq[i]; const c=(S.stops[k]||{coord:[4.76,52.31]}).coord; flyTo(c,k==='ams'?140:22); showTourCard(k); i++; if(i>=seq.length){ stopTour(); setTimeout(()=>{ flyTo([136.5,35.8],55); $('#tourCard').classList.remove('on'); },6000); } };
  step(); tourTimer=setInterval(step,6000); };

/* ============ MINI MAP ============ */
const maps=[];
function miniMap(el, focus){
  if(!el) return; if(!window.echarts||!echarts.getMap('world')){ el.innerHTML='<p style="color:#9aa3ba;padding:20px">Kaart niet beschikbaar</p>'; return; }
  const ch=echarts.init(el); maps.push(ch); const ids=stopIds(); const legs=[]; for(let i=0;i<ids.length-1;i++) legs.push({coords:[S.stops[ids[i]].coord,S.stops[ids[i+1]].coord]});
  const f=S.stops[focus]||S.stops[ids[0]];
  ch.setOption({ backgroundColor:'#0f1a33', geo:{ map:'world', roam:true, center:f?f.coord:[136,36], zoom:14, silent:true, scaleLimit:{min:4,max:60}, itemStyle:{areaColor:'#24365e',borderColor:'#3d5a8f'}, regions:[{name:'Japan',itemStyle:{areaColor:'#2f4677',borderColor:'#6e8fd0'}}] },
    series:[ { type:'lines', coordinateSystem:'geo', zlevel:1, lineStyle:{color:'#f2b544',width:2,opacity:.55,curveness:.15}, data:legs },
      { type:'lines', coordinateSystem:'geo', zlevel:2, effect:{show:true,period:4,trailLength:.3,color:'#fff3cf',symbolSize:4}, lineStyle:{width:0,curveness:.15}, data:legs },
      { type:'scatter', coordinateSystem:'geo', zlevel:3, symbolSize:7, itemStyle:{color:'#fff'}, label:{show:true,position:'right',formatter:'{b}',color:'#dfe6ff',fontSize:11}, data:ids.filter(k=>k!=='tokyo2'&&k!==focus).map(k=>({name:S.stops[k].name,value:S.stops[k].coord})) },
      { type:'effectScatter', coordinateSystem:'geo', zlevel:4, symbolSize:13, rippleEffect:{scale:3.5,brushType:'stroke'}, itemStyle:{color:'#e8402a'}, label:{show:true,position:'right',formatter:'{b}',color:'#fff',fontWeight:'bold',fontSize:13,backgroundColor:'rgba(232,64,42,.9)',padding:[3,6],borderRadius:4}, data:f?[{name:f.name,value:f.coord}]:[] } ] });
}
function clearMaps(){ while(maps.length){ try{ maps.pop().dispose(); }catch(e){} } }
addEventListener('resize',()=>maps.forEach(m=>m.resize()));

/* ============ COMPONENTS ============ */
function hotelCard(h, k, i, nights){
  const r = stopRange(k); const isChosen = (+S.stops[k].chosen||0)===i;
  const price = h.hb ? `${eur(h.p)}<small>incl. diner & ontbijt</small>` : `${h.est?'± ':''}${eur(h.p)}<small>${+h.pb?`${eur(h.pb)} met ontbijt`:'alleen kamer'}</small>`;
  return `<div class="hotel ${isChosen?'pick':''}"><div class="row"><div><div class="tg">${h.booked?'✅ Geboekt':esc(h.tag)}${isChosen?' · ⭐ jullie keuze':''}</div><b>${esc(h.n)}</b>
    <div class="sc">${h.r?`<em>${esc(h.r)}</em>`:''}${h.rc?esc(h.rc)+' reviews':''}${h.s?` · ${esc(h.s)}`:''}</div></div><div class="pr"><b>${price}</b></div></div>
    ${h.x?`<p>${esc(h.x)}</p>`:''}<div class="fl"><span class="pill">${h.f?'✓ Gratis annuleren':'Niet annuleerbaar'}</span><span class="pill">${nights||1} ${nights>1?'nachten':'nacht'} · 2 kamers</span></div>
    <div class="fl" style="margin-top:10px">${h.url?`<a href="${esc(h.url)}" target="_blank" rel="noopener">Boeking →</a>`:''}<a href="${BK(h,r.ci,r.co)}" target="_blank" rel="noopener">Booking.com →</a><a href="${GM(h.q||h.n)}" target="_blank" rel="noopener">Google Maps →</a><a href="${IMG(h.q||h.n)}" target="_blank" rel="noopener">📸 Foto's</a>
    ${!isChosen && Store.canWrite?`<button class="mini pickb" data-k="${k}" data-i="${i}">Kies dit hotel</button>`:''}</div></div>`;
}
const spot = i => `<div class="spot"><div class="e">${esc(i.e||'📍')}</div><div><b>${esc(i.h)}</b>${i.d?`<p>${esc(i.d)}</p>`:''}${i.q?`<a href="${IMG(i.q)}" target="_blank" rel="noopener">📸 Foto's</a> &nbsp; <a href="${GM(i.q)}" target="_blank" rel="noopener">🗺️ Kaart</a>`:''}</div></div>`;
function bindPick(){ $$('.pickb').forEach(b=>b.onclick=async()=>{ const k=b.dataset.k; S.stops[k].chosen=+b.dataset.i; await Store.saveStop(k); toast('Hotelkeuze opgeslagen'); }); }
const editBtn = (id, label) => `<button class="ebtn" id="${id}">✏️ ${esc(label)}</button>`;

/* ============ VIEWS ============ */
function renderDagen(){
  const L=dayList(); const cities=[...new Set(L.map(d=>d.city))].filter(k=>S.stops[k]&&k!=='tokyo2');
  $('#dagenBody').innerHTML = `<p class="kicker">Planning</p><div class="th"><h2 class="title">${L.length} dagen, dag voor dag</h2>${editing?`<button class="ebtn" id="addEnd">＋ Dag toevoegen aan het eind</button>`:''}</div>
    <p class="sub">Klik op een dag voor het volledige programma. ${Store.canWrite?'Zet rechtsboven <b>Bewerken</b> aan om dagen toe te voegen, te verplaatsen of aan te passen.':''}</p>
    <div class="legend">${cities.map(k=>`<span style="${cvars(S.stops[k])}"><i></i>${esc(S.stops[k].name)}</span>`).join('')}</div>
    <div class="daygrid">${L.map((d,i)=>{ const s=S.stops[d.city]||{}; const dt=dateOf(i);
      return `<a class="dcard" href="#dag-${i+1}" style="${cvars(s)}"><div class="top"><div class="k">${esc(s.kanji||'')}</div><div class="num">Dag ${i+1} · ${DOW[dt.getDay()]}</div><div class="dt">${fmt(dt)}</div></div>
      <div class="bd"><h3>${esc(d.title)}</h3><p>${esc(d.sub)}</p><div class="meta"><span class="pill">📍 ${esc(s.name||'?')}</span>${d.move?`<span class="pill">${esc(d.move.mode)} ${esc(d.move.dur||'')}</span>`:''}<span class="pill">${(d.items||[]).length} punten</span></div></div></a>`; }).join('')}</div>`;
  const a=$('#addEnd'); if(a) a.onclick=()=>insertDay(L.length-1);
}
function renderDag(n){
  const L=dayList(); const d=L[n-1]; if(!d){ location.hash='dagen'; return; }
  const s=S.stops[d.city]||{name:'?'}, sl=d.sleep?S.stops[d.sleep]:null, h=d.sleep?chosen(d.sleep):null; const dt=dateOf(n-1);
  const firstNight = d.sleep && L.findIndex(x=>x.sleep===d.sleep)===n-1; const prev=L[n-2], next=L[n]; const r=d.sleep?stopRange(d.sleep):{};
  $('#dagBody').innerHTML = `
  <div class="dstrip">${L.map((x,i)=>`<a href="#dag-${i+1}" class="${i+1===n?'on':''}" style="${cvars(S.stops[x.city])}"><small>${DOW[dateOf(i).getDay()]}</small><b>${dateOf(i).getDate()}</b><i></i></a>`).join('')}</div>
  <div class="dhero" style="${cvars(s)}"><div class="k">${esc(s.kanji||'')}</div><div class="in">
    ${editing?`<div class="etools">${editBtn('eDay','Dag bewerken')}<button class="ebtn" id="mvL" ${n<2?'disabled':''}>← Eerder</button><button class="ebtn" id="mvR" ${n>=L.length?'disabled':''}>Later →</button><button class="ebtn" id="insA">＋ Dag erna invoegen</button></div>`:''}
    <div class="stamp"><small>Dag</small><b>${n}</b></div>
    <div class="when">${DOW[dt.getDay()]} ${fmt(dt)} ${dt.getFullYear()} · ${esc(s.name)} ${s.jp?`<span style="font-family:var(--serif)">${esc(s.jp)}</span>`:''}</div>
    <h2>${esc(d.title)}</h2><p>${esc(d.sub)}</p>
    <div class="meta">${s.temp?`<span>🌤️ gemiddeld ${esc(s.temp)}</span>`:''}<span>🛏️ ${esc(h?h.n:(sl?sl.name:(d.sleepTxt||'In het vliegtuig')))}</span>${d.move?`<span>${esc(d.move.mode)} ${esc(d.move.from)} → ${esc(d.move.to)}</span>`:''}<span>📌 ${(d.items||[]).length} programmapunten</span></div>
  </div></div>
  <div class="dgrid">
    <div class="card"><h3>🗓️ Programma</h3>${(d.items||[]).length?`<div class="tl">${d.items.map(it=>`<div class="ev ${it.k||'see'}" style="${cvars(s)}"><div class="t">${esc(it.t)}</div><div class="dot">${EVI[it.k||'see']}</div>
      <div><h4>${esc(it.h)}</h4>${it.d?`<p>${esc(it.d)}</p>`:''}${it.q?`<div class="lk"><a href="${IMG(it.q)}" target="_blank" rel="noopener">📸 Foto's</a><a href="${GM(it.q)}" target="_blank" rel="noopener">🗺️ Kaart</a></div>`:''}</div></div>`).join('')}</div>`:`<p class="muted">Nog geen programma. ${Store.canWrite?'Zet <b>Bewerken</b> aan en klik op "Dag bewerken" om iets toe te voegen.':''}</p>`}</div>
    <div class="side">
      <div class="card" style="padding:12px"><div class="map" id="dmap"></div></div>
      ${d.move?`<div class="card"><h3>🚆 Vandaag onderweg</h3><div class="move"><div class="ic">${esc(d.move.mode)}</div><div><b>${esc(d.move.from)} → ${esc(d.move.to)}</b><small>${esc(d.move.how||'')}${d.move.dur?' · '+esc(d.move.dur):''}</small></div></div></div>`:''}
      ${d.tip?`<div class="tip card"><h3 style="color:#a07a12">💡 Tip van de dag</h3><p>${esc(d.tip)}</p></div>`:''}
      <div class="card"><h3>🛏️ Slapen</h3>${h ? (firstNight ? hotelCard(h, d.sleep, +sl.chosen||0, r.nights) : `<div class="hotel"><div class="tg">Zelfde hotel als gisteren</div><b>${esc(h.n)}</b><div class="fl" style="margin-top:8px"><a href="${GM(h.q||h.n)}" target="_blank" rel="noopener">Google Maps →</a></div></div>`) + `<p class="muted" style="margin-top:10px">Ander hotel? Kies er een bij <a href="#plaats-${d.sleep}">${esc(sl.name)}</a>.</p>` : sl ? `<p class="muted">Nog geen hotel gekozen in ${esc(sl.name)}.</p>` : `<p class="muted">${esc(d.sleepTxt||'In het vliegtuig')} ✈️</p>`}</div>
      ${S.stops[d.city]&&d.city!=='ams'?`<div class="card"><h3>📍 Meer over ${esc(s.name)}</h3><p class="muted" style="font-size:14px;line-height:1.5">${esc(s.intro)}</p><a class="btn primary" style="margin-top:14px;padding:10px 16px;font-size:14px" href="#plaats-${d.city}">Bekijk ${esc(s.name)} →</a></div>`:''}
    </div>
  </div>
  <div class="pn"><a class="${prev?'':'empty'}" href="#dag-${n-1}"><small>← Dag ${n-1}</small><b>${prev?esc(prev.title):''}</b></a><a class="nx ${next?'':'empty'}" href="#dag-${n+1}"><small>Dag ${n+1} →</small><b>${next?esc(next.title):''}</b></a></div>`;
  const on=document.querySelector('.dstrip a.on'); on&&on.scrollIntoView({inline:'center',block:'nearest'});
  if(editing){ $('#eDay').onclick=()=>editDay(d); $('#mvL').onclick=()=>moveDay(n-1,-1); $('#mvR').onclick=()=>moveDay(n-1,1); $('#insA').onclick=()=>insertDay(n-1); }
  bindPick(); setTimeout(()=>miniMap($('#dmap'), d.city==='ams'?stopIds()[0]:d.city),30);
}
function renderPlaatsen(){
  const ids=stopIds();
  $('#plaatsenBody').innerHTML = `<p class="kicker">Route</p><div class="th"><h2 class="title">${ids.length} stops door Japan</h2>${editing?`<button class="ebtn" id="addStop">＋ Nieuwe plaats</button>`:''}</div>
  <p class="sub">Per plek vind je wat je er kunt doen, minder bekende plekken, eten en hotels.${editing?' Met de pijltjes verander je de volgorde van de route.':''}</p>
  <div class="pgrid">${ids.map((k,i)=>{ const s=S.stops[k], r=stopRange(k);
    return `<div class="pwrap">${editing?`<div class="pord"><button class="ib" data-mv="-1" data-k="${k}" ${i===0?'disabled':''}>←</button><button class="ib" data-mv="1" data-k="${k}" ${i===ids.length-1?'disabled':''}>→</button></div>`:''}<a class="pcard" href="#plaats-${k}" style="${cvars(s)}"><div class="ph"><div class="k">${esc(s.kanji)}</div><div class="n">${i+1}</div><h3>${esc(s.name)}</h3></div>
    <div class="bd"><p>${esc(s.intro)}</p><div class="meta">${s.tag?`<span class="pill dark">${esc(s.tag)}</span>`:''}<span class="pill">📅 ${esc(r.label)}</span>${r.nights?`<span class="pill">🛏️ ${r.nights} ${r.nights>1?'nachten':'nacht'}</span>`:''}</div></div></a></div>`; }).join('')}</div>`;
  const a=$('#addStop'); if(a) a.onclick=()=>editStop(null);
  $$('.pord .ib').forEach(b=>b.onclick=()=>moveStop(b.dataset.k,+b.dataset.mv));
}
function renderPlaats(k){
  const s=S.stops[k]; if(!s||k==='ams'){ location.hash='plaatsen'; return; }
  const ids=stopIds(), idx=ids.indexOf(k), prev=ids[idx-1], next=ids[idx+1], r=stopRange(k);
  const L=dayList(); const days=L.map((d,i)=>({d,i})).filter(x=>x.d.city===k||x.d.sleep===k);
  $('#plaatsBody').innerHTML = `
  <div class="dhero" style="${cvars(s)}"><div class="k">${esc(s.kanji)}</div><div class="in">
    ${editing?`<div class="etools">${editBtn('eStop','Plaats, tips & hotels bewerken')}</div>`:''}
    <div class="stamp"><small>Stop</small><b>${idx+1}</b></div>
    <div class="when">${esc(r.label)}${r.nights?` · ${r.nights} ${r.nights>1?'nachten':'nacht'}`:''}${s.temp?` · gemiddeld ${esc(s.temp)} in mei`:''}</div>
    <h2>${esc(s.name)} <span style="font-family:var(--serif);opacity:.8">${esc(s.jp||'')}</span></h2><p style="max-width:720px;line-height:1.5">${esc(s.intro)}</p>
  </div></div>
  <div class="dgrid">
    <div style="display:flex;flex-direction:column;gap:20px">
      ${s.todo?.length?`<div class="card"><h3>🎯 Wat te doen</h3>${s.todo.map(spot).join('')}</div>`:''}
      ${s.gems?.length?`<div class="card"><h3>💎 Minder bekende parels</h3>${s.gems.map(spot).join('')}</div>`:''}
      <div class="card"><h3>🏨 Hotels · 2 kamers voor 4 personen</h3>${(s.hotels||[]).length?s.hotels.map((h,i)=>hotelCard(h,k,i,r.nights)).join(''):'<p class="muted">Nog geen hotels.</p>'}
        <p class="muted" style="margin-top:12px">Prijzen zijn een momentopname en kunnen veranderen.</p></div>
      <div class="card livec"><h3>⚡ Live hotelprijzen via LetsFG</h3><div id="live"><p class="muted">Zoek actuele hotels en prijzen voor ${esc(r.label)} (2 kamers, 4 personen).</p><button class="btn primary" id="goLive" style="margin-top:12px">🔎 Zoek live prijzen</button></div></div>
    </div>
    <div class="side">
      <div class="card" style="padding:12px"><div class="map" id="pmap"></div></div>
      <div class="card"><h3>📅 Jullie dagen hier</h3>${days.length?`<div class="daylinks">${days.map(x=>`<a href="#dag-${x.i+1}" style="${cvars(s)}"><span class="s">${x.i+1}</span><span><b>${esc(x.d.title)}</b><small>${DOW[dateOf(x.i).getDay()]} ${fmt(dateOf(x.i))}</small></span></a>`).join('')}</div>`:'<p class="muted">Nog geen dagen gekoppeld. Kies deze plaats bij een dag onder "Plaats" of "Slapen in".</p>'}</div>
      ${s.food?.length?`<div class="card"><h3>🍜 Eten & drinken</h3>${s.food.map(spot).join('')}</div>`:''}
    </div>
  </div>
  <div class="pn"><a class="${prev?'':'empty'}" href="#plaats-${prev}"><small>← Vorige stop</small><b>${prev?esc(S.stops[prev].name):''}</b></a><a class="nx ${next?'':'empty'}" href="#plaats-${next}"><small>Volgende stop →</small><b>${next?esc(S.stops[next].name):''}</b></a></div>`;
  if(editing) $('#eStop').onclick=()=>editStop(k);
  $('#goLive').onclick=()=>liveHotels(k); bindPick();
  setTimeout(()=>miniMap($('#pmap'),k),30);
}
function renderBudget(){
  const ids=stopIds(); const hotelTotal=ids.reduce((a,k)=>a+hotelPrice(chosen(k)),0);
  const rows=(S.meta.budget||[]).map(r=>/hotel/i.test(r.n)?{...r,v:hotelTotal}:r); const total=rows.reduce((a,r)=>a+(+r.v||0),0), max=+S.meta.budgetMax||35000; const f=S.meta.flight||{};
  $('#budgetBody').innerHTML = `<p class="kicker">Geld</p><div class="th"><h2 class="title">Budget voor 4 personen</h2>${editing?`<button class="ebtn" id="eBud">✏️ Posten bewerken</button>`:''}</div>
  <p class="sub">Kies per stop een hotel: het totaal en de grafiek passen zich direct aan${Store.mode==='db'?' – voor iedereen tegelijk':''}.</p>
  <div class="bgrid">
    <div style="display:flex;flex-direction:column;gap:20px">
    <div class="card"><h3>💴 Totaal geschat</h3><div class="big">${eur(total)}</div>
      <div class="bar2"><div style="width:${Math.min(100,total/max*100)}%;${total>max?'background:var(--shu)':''}"></div></div>
      <p class="muted" style="font-size:14px">${total<=max?`<b style="color:var(--sumi)">${eur(max-total)}</b> over van ${eur(max)}`:`<b style="color:var(--shu)">${eur(total-max)}</b> boven het budget van ${eur(max)}`} · ± ${eur(total/4)} per persoon</p>
      <div id="donut"></div>
      ${rows.map(r=>`<div class="brow" style="--c:${esc(r.c)}"><i></i><span>${esc(r.n)}</span><b>${eur(r.v)}</b></div>`).join('')}</div>
    <div class="card"><h3>✈️ Vluchten ${editing?`<button class="mini" id="eFl" style="margin-left:auto">✏️ Bewerken</button>`:''}</h3>
      <div class="hotel ${f.booked?'pick':''}"><div class="row"><div><div class="tg">${f.booked?'✅ Geboekt'+(f.ref?' · '+esc(f.ref):''):'Nog niet geboekt'}</div><b>${esc(f.airline)}</b></div><div class="pr"><b>${eur(f.price)}</b><small>4 personen</small></div></div>
      <p>🛫 ${esc(f.out)}<br>🛬 ${esc(f.back)}</p><div class="fl"><a href="${esc(f.link||LETSFG_TRIP)}" target="_blank" rel="noopener">Bekijk vluchten in LetsFG →</a></div></div>
      <p class="muted" style="margin-top:10px">Vluchten en hotels boeken gaat via de LetsFG-app, of vraag het aan Claude in de chat.</p></div>
    </div>
    <div class="card"><h3>🏨 Kies je hotels</h3><div class="hsel">${ids.filter(k=>S.stops[k].hotels?.length).map(k=>{ const s=S.stops[k], ci=Math.min(+s.chosen||0,s.hotels.length-1);
      return `<div class="hs" style="${cvars(s)}"><div class="pl"><i></i>${esc(s.name)}</div><div class="opts">${s.hotels.map((h,i)=>`<button data-k="${k}" data-i="${i}" class="${i===ci?'on':''}" ${Store.canWrite?'':'disabled'}><b>${h.booked?'✅ ':''}${esc((h.n||'').length>24?h.n.slice(0,22)+'…':h.n)}</b>${eur(hotelPrice(h))}</button>`).join('')}</div></div>`; }).join('')}</div>
      <p class="muted" style="margin-top:14px">Hotelprijzen zijn inclusief ontbijt waar dat kan. Een JR Pass van 21 dagen kost ¥100.000 p.p. en is voor deze route waarschijnlijk duurder dan losse kaartjes.</p></div>
  </div>`;
  $$('.hs button').forEach(b=>b.onclick=async()=>{ const k=b.dataset.k; S.stops[k].chosen=+b.dataset.i; await Store.saveStop(k); toast('Hotelkeuze opgeslagen'); });
  const e1=$('#eBud'); if(e1) e1.onclick=editBudget; const e2=$('#eFl'); if(e2) e2.onclick=editFlight;
  if(window.echarts){ const ch=echarts.init($('#donut')); maps.push(ch);
    ch.setOption({ tooltip:{trigger:'item',formatter:p=>`${p.name}<br><b>${eur(p.value)}</b> (${p.percent}%)`}, series:[{ type:'pie', radius:['58%','82%'], label:{show:true,position:'center',formatter:()=>`{a|${eur(total)}}\n{b|totaal}`,rich:{a:{fontSize:22,fontWeight:800,color:'#1d1a16'},b:{fontSize:12,color:'#8f877a',padding:[4,0,0,0]}}}, labelLine:{show:false}, itemStyle:{borderColor:'#fffdf8',borderWidth:3,borderRadius:6}, data:rows.map(r=>({name:r.n,value:+r.v||0,itemStyle:{color:r.c}})) }] }); }
}
function renderGids(){
  const done=S.check.done||{}, custom=S.check.custom||{};
  const groups=Object.fromEntries(Object.entries(CHECK).map(([g,a])=>[g,[...a.map(t=>({t,c:false})), ...(custom[g]||[]).map(t=>({t,c:true}))]]));
  const all=Object.values(groups).flat(); const cnt=all.filter(x=>done[x.t]).length;
  $('#gidsBody').innerHTML = `<p class="kicker">Voorbereiding</p><h2 class="title">Checklist & reisgids</h2>
  <p class="sub">Vink af wat geregeld is${Store.mode==='db'?' – iedereen ziet het direct':' (bewaard op dit apparaat)'}. Daaronder staan handige zinnetjes, apps en etiquette.</p>
  <div class="card" style="margin-top:24px"><h3>✅ Voortgang <span class="prog">${cnt} van ${all.length} klaar</span></h3><div class="bar2" style="margin:0"><div style="width:${all.length?cnt/all.length*100:0}%"></div></div></div>
  <div class="ggrid">${Object.entries(groups).map(([g,items])=>`<div class="card chk"><h3>${g==='Boeken'?'🧾':g==='Inpakken'?'🎒':g==='Vóór vertrek'?'🛂':'🎟️'} ${esc(g)} <span class="prog">${items.filter(i=>done[i.t]).length}/${items.length}</span></h3>
    ${items.map(i=>`<label><input type="checkbox" data-t="${esc(i.t)}" ${done[i.t]?'checked':''} ${Store.canWrite?'':'disabled'}><span>${esc(i.t)}</span>${i.c&&editing?`<button class="ib del rmc" data-g="${esc(g)}" data-t="${esc(i.t)}" title="Verwijderen">✕</button>`:''}</label>`).join('')}
    ${Store.canWrite?`<form class="addc" data-g="${esc(g)}"><input placeholder="＋ Eigen punt toevoegen…" maxlength="80"><button class="mini">Toevoegen</button></form>`:''}</div>`).join('')}
    <div class="card"><h3>🗣️ Handige zinnetjes</h3>${PHRASES.map(p=>`<div class="phr"><b>${esc(p[0])}</b><span class="jp">${p[1]}</span><small>${esc(p[2])}</small></div>`).join('')}</div>
    <div class="card"><h3>📱 Apps voor onderweg</h3>${APPS.map(a=>`<div class="spot"><div class="e">${a[0]}</div><div><b>${esc(a[1])}</b><p>${esc(a[2])}</p></div></div>`).join('')}</div>
    <div class="card" style="grid-column:1/-1"><h3>🎌 Etiquette & goed om te weten</h3><div class="pgrid2">${RULES.map(a=>`<div class="spot"><div class="e">${a[0]}</div><div><b>${esc(a[1])}</b><p>${esc(a[2])}</p></div></div>`).join('')}</div></div>
  </div>`;
  $$('.chk input[type=checkbox]').forEach(c=>c.onchange=async()=>{ S.check.done={...(S.check.done||{}), [c.dataset.t]:c.checked}; await Store.saveCheck(); if(c.checked) toast('Afgevinkt ✓'); });
  $$('.addc').forEach(f=>f.onsubmit=async e=>{ e.preventDefault(); const v=f.querySelector('input').value.trim(); if(!v) return; const g=f.dataset.g; S.check.custom={...(S.check.custom||{}), [g]:[...((S.check.custom||{})[g]||[]), v]}; await Store.saveCheck(); toast('Toegevoegd'); });
  $$('.rmc').forEach(b=>b.onclick=async e=>{ e.preventDefault(); const g=b.dataset.g; S.check.custom[g]=(S.check.custom[g]||[]).filter(x=>x!==b.dataset.t); await Store.saveCheck(); });
}

/* ============ ROUTER ============ */
let curView='';
function renderRoute(keepScroll){
  const h=(location.hash||'#reis').slice(1); let v=h, arg=null;
  if(/^dag-\d+$/.test(h)){ v='dag'; arg=+h.slice(4); } else if(/^plaats-[A-Za-z0-9]+$/.test(h)){ v='plaats'; arg=h.slice(7); }
  if(!['reis','dagen','dag','plaatsen','plaats','budget','gids'].includes(v)) v='reis';
  const sameView = keepScroll && v===curView; const sc = sameView ? $('#v-'+v).scrollTop : 0;
  clearMaps(); $$('.view').forEach(e=>e.classList.remove('on')); $('#v-'+v).classList.add('on');
  const navKey=v==='dag'?'dagen':v==='plaats'?'plaatsen':v; $$('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===navKey));
  const changed = curView!==v; curView=v; renderStrip();
  if(v==='reis'){ if(!globe) initGlobe(); else { globe.resize(); refreshGlobe(); if(changed) globe.setOption({globe:{viewControl:{autoRotate:spinning}}}); } }
  else { if(globe&&changed) globe.setOption({globe:{viewControl:{autoRotate:false}}}); stopTour(); }
  if(v==='dagen') renderDagen(); if(v==='dag') renderDag(arg); if(v==='plaatsen') renderPlaatsen(); if(v==='plaats') renderPlaats(arg); if(v==='budget') renderBudget(); if(v==='gids') renderGids();
  if(v!=='reis') $('#v-'+v).scrollTop = sc;
}
addEventListener('hashchange',()=>renderRoute(false));
addEventListener('keydown',e=>{ if(modalOpen){ if(e.key==='Escape') $('#modal [data-close]')?.click(); return; } if(curView!=='dag'||/input|textarea|select/i.test(e.target.tagName)) return; const n=+location.hash.slice(5), L=dayList().length;
  if(e.key==='ArrowRight'&&n<L) location.hash='dag-'+(n+1); if(e.key==='ArrowLeft'&&n>1) location.hash='dag-'+(n-1); });
(function(){ let x0=null,y0=null; const el=$('#v-dag');
  el.addEventListener('touchstart',e=>{ if(e.target.closest('.map,.dstrip')) return; x0=e.touches[0].clientX; y0=e.touches[0].clientY; },{passive:true});
  el.addEventListener('touchend',e=>{ if(x0===null) return; const dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0; x0=null;
    if(Math.abs(dx)>80&&Math.abs(dx)>Math.abs(dy)*1.8){ const n=+location.hash.slice(5), L=dayList().length; if(dx<0&&n<L) location.hash='dag-'+(n+1); if(dx>0&&n>1) location.hash='dag-'+(n-1); } },{passive:true}); })();
$('#bEdit').onclick=()=>setEditing(!editing);
$('#bReset').onclick=()=>{ if(Store.mode==='db') return; if(!$('#bReset').dataset.sure){ $('#bReset').dataset.sure=1; $('#bReset').textContent='Zeker? Klik nogmaals'; return; } S=defaults(); ls.set('jp27-state-v3',S); $('#bReset').dataset.sure=''; $('#bReset').textContent='↺ Herstel origineel'; renderRoute(true); toast('Origineel plan hersteld'); };
updateBadge(); renderRoute(false); connectDb();
