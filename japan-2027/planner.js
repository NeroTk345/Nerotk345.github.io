/* =====================================================================
   Reisplanner-wizard: de familie vult wensen in, Claude bouwt het plan
   ===================================================================== */
const INTERESTS = [['cultuur','⛩️','Tempels & cultuur'],['natuur','🏞️','Natuur & wandelen'],['eten','🍜','Eten & streetfood'],['anime','🎮','Anime, games & pop'],['shoppen','🛍️','Shoppen & mode'],['nacht','🌃','Nachtleven & neon'],['onsen','♨️','Onsen & ontspannen'],['pretpark','🎢','Pretparken'],['kunst','🖼️','Musea & kunst'],['geschiedenis','🏯','Kastelen & geschiedenis'],['foto','📸','Fotografie & uitzicht'],['stil','🍃','Rust & verborgen plekken'],['strand','🏝️','Strand & eilanden'],['sport','🚴','Actief & sportief']];
const PLACES = ['Tokyo','Kyoto','Osaka','Hakone','Nara','Hiroshima','Miyajima','Kanazawa','Takayama','Shirakawa-go','Nikko','Kawaguchiko (Fuji)','Kamakura','Naoshima','Kumano Kodo','Koyasan','Himeji','Kiso-vallei','Fukuoka','Nagasaki','Okinawa','Hokkaido / Sapporo','Sendai','Matsumoto'];
const HCLASS = [
 {id:'budget', e:'💶', t:'Voordelig', s:'2–3★ businesshotels', ex:'Bijv. Toyoko Inn, APA, Sotetsu Fresa Inn', pr:'± € 100–180 per nacht (2 kamers)', d:'Klein maar brandschoon, vaak naast het station.'},
 {id:'comfort', e:'🏨', t:'Comfort', s:'3–4★ moderne hotels', ex:'Bijv. Mitsui Garden, Hotel Gracery, Tokyu Stay', pr:'± € 180–350 per nacht (2 kamers)', d:'Ruimer, centraal, vaak met grootbad of ontbijtbuffet.'},
 {id:'luxe', e:'✨', t:'Luxe', s:'4–5★ topklasse', ex:'Bijv. Park Hyatt, Imperial Hotel, The Ritz-Carlton', pr:'± € 450–1.000+ per nacht (2 kamers)', d:'Grote kamers, uitzicht, service en spa.'},
 {id:'mix', e:'♨️', t:'Mix met ryokans', s:'Hotels + traditionele ryokans', ex:'Bijv. comforthotels in steden, ryokan in Hakone/Takayama', pr:'Ryokan ± € 400–900 per nacht incl. diner', d:'Futons, yukata, onsen en kaiseki-diner – onvergetelijk.'}];
let W = null, planPreview = null, genCtl = null;

function wDefault(){
  const m = S.meta||{};
  return { country: m.country||'Japan', start: m.start||'2027-05-04', days: dayList().length||21, home: m.home?.name||'Amsterdam (Schiphol)',
    travellers: m.travellers || [{n:'Vader',a:52},{n:'Moeder',a:47},{n:'Zoon 1',a:19},{n:'Zoon 2',a:17}],
    interests: m.prefs?.interests || ['cultuur','eten','anime','natuur','onsen','stil'], pace: m.prefs?.pace||'gemiddeld', mix: m.prefs?.mix ?? 60,
    places: m.prefs?.places || ['Tokyo','Kyoto','Osaka','Hakone'], letChoose: m.prefs?.letChoose ?? true, wishes: m.prefs?.wishes||'',
    hclass: m.prefs?.hclass||'mix', rooms: m.prefs?.rooms||2, ryokan: m.prefs?.ryokan ?? 3, budget: m.budgetMax||35000, transport: m.prefs?.transport||'trein', step:0 };
}
const STEPS = ['Reis','Wie gaan er mee','Wat vinden jullie leuk','Plekken','Hotels & budget','Overzicht'];

function renderPlanner(){
  if (!ONLINE){ $('#plannerBody').innerHTML = `<p class="kicker">Planner</p><h2 class="title">Reisplanner</h2><p class="sub">De planner werkt alleen in de claude.ai-versie van de app.</p>`; return; }
  if (!Store.canWrite){ $('#plannerBody').innerHTML = `<p class="kicker">Planner</p><h2 class="title">Reisplanner</h2><p class="sub">Je kunt deze app alleen bekijken. Vraag de eigenaar om je als Editor uit te nodigen om een nieuw plan te maken.</p>`; return; }
  if (!W) W = wDefault();
  if (planPreview) return renderPreview();
  const st = W.step;
  $('#plannerBody').innerHTML = `<p class="kicker">✨ Reisplanner</p><h2 class="title">Stel jullie droomreis samen</h2>
    <p class="sub">Vul in wat jullie willen. Claude bouwt daarna een compleet plan met dagen, plekken, eten en hotels. Je ziet het eerst als voorbeeld voordat het huidige plan wordt vervangen.</p>
    <div class="wsteps">${STEPS.map((s,i)=>`<button class="ws ${i===st?'on':''} ${i<st?'done':''}" data-go="${i}"><b>${i<st?'✓':i+1}</b><span>${s}</span></button>`).join('')}</div>
    <div class="card wcard">${wStep(st)}</div>
    <div class="wnav"><button class="btn ghost2" id="wPrev" ${st===0?'style="visibility:hidden"':''}>← Vorige</button><span style="flex:1"></span>
      ${st<STEPS.length-1?`<button class="btn primary" id="wNext">Volgende →</button>`:`<button class="btn primary big2" id="wGo">✨ Maak ons reisplan</button>`}</div>
    ${S.meta.backup?`<p class="muted" style="margin-top:18px">Eerder plan bewaard van ${esc(S.meta.backupAt||'')}. <button class="mini" id="wRestore">↺ Vorig plan terugzetten</button></p>`:''}`;
  bindStep(st);
  $$('.ws').forEach(b=>b.onclick=()=>{ readStep(W.step); W.step=+b.dataset.go; renderPlanner(); });
  const p=$('#wPrev'); if(p) p.onclick=()=>{ readStep(W.step); W.step--; renderPlanner(); };
  const n=$('#wNext'); if(n) n.onclick=()=>{ readStep(W.step); W.step++; renderPlanner(); $('#v-planner').scrollTop=0; };
  const g=$('#wGo'); if(g) g.onclick=generatePlan;
  const r=$('#wRestore'); if(r) r.onclick=restoreBackup;
}
function wStep(st){
  if (st===0) return `<h3>🗺️ De reis</h3><div class="wgrid">
    <div class="fld m"><label>Land</label><input id="wCountry" value="${esc(W.country)}"></div>
    <div class="fld m"><label>Vertrek vanaf</label><input id="wHome" value="${esc(W.home)}"></div>
    <div class="fld m"><label>Vertrekdatum</label><input id="wStart" type="date" value="${esc(W.start)}"></div>
    <div class="fld m"><label>Hoe lang? <small id="wDaysL">${W.days} dagen (± ${(W.days/7).toFixed(1).replace('.',',')} weken)</small></label><input id="wDays" type="range" min="5" max="35" value="${W.days}"></div>
    <div class="fld full"><label>Snel kiezen</label><div class="chips">${[[7,'1 week'],[10,'10 dagen'],[14,'2 weken'],[21,'3 weken'],[28,'4 weken']].map(o=>`<button class="chip2 ${W.days==o[0]?'on':''}" data-days="${o[0]}">${o[1]}</button>`).join('')}</div></div></div>
    <p class="muted" style="margin-top:12px">💡 In Japan is Golden Week (29 april – 5 mei) druk en duur. Vanaf ongeveer 7 mei is het rustiger.</p>`;
  if (st===1) return `<h3>👨‍👩‍👦‍👦 Wie gaan er mee?</h3><div id="wTrav">${W.travellers.map((t,i)=>travRow(t,i)).join('')}</div>
    <button class="mini" id="wAddT" style="margin-top:10px">＋ Reiziger toevoegen</button>
    <p class="muted" style="margin-top:14px">De leeftijden gebruikt de planner voor passende activiteiten, bijvoorbeeld pretparken, nachtleven of rustige ochtenden, en voor regels zoals alcohol pas vanaf 20 in Japan.</p>`;
  if (st===2) return `<h3>❤️ Wat vinden jullie leuk?</h3><div class="chips big">${INTERESTS.map(i=>`<button class="chip2 ${W.interests.includes(i[0])?'on':''}" data-int="${i[0]}">${i[1]} ${i[2]}</button>`).join('')}</div>
    <div class="wgrid" style="margin-top:20px">
      <div class="fld full"><label>Tempo</label><div class="seg">${[['rustig','🐢 Rustig','2–3 dingen per dag'],['gemiddeld','🚶 Gemiddeld','4–5 dingen per dag'],['vol','🏃 Vol','zoveel mogelijk zien']].map(o=>`<button class="segb ${W.pace===o[0]?'on':''}" data-pace="${o[0]}"><b>${o[1]}</b><small>${o[2]}</small></button>`).join('')}</div></div>
      <div class="fld full"><label>Bekend of verborgen? <small id="wMixL">${mixLabel(W.mix)}</small></label><input id="wMix" type="range" min="0" max="100" value="${W.mix}"><div class="rangeL"><span>Alleen de toppers</span><span>Vooral verborgen parels</span></div></div></div>`;
  if (st===3) return `<h3>📍 Welke plekken willen jullie zeker zien?</h3><div class="chips">${PLACES.map(p=>`<button class="chip2 ${W.places.includes(p)?'on':''}" data-pl="${esc(p)}">${esc(p)}</button>`).join('')}</div>
    <label class="rc" style="margin-top:16px"><input type="checkbox" id="wLet" ${W.letChoose?'checked':''}> Laat de planner zelf nog leuke plekken toevoegen</label>
    <div class="fld full" style="margin-top:14px"><label>Overige wensen <small>Bijv. "1 dag Universal Studios", "geen lange busritten", "een sumo-training zien", "verjaardag op 15 mei"</small></label><textarea id="wWish" rows="3">${esc(W.wishes)}</textarea></div>`;
  if (st===4) return `<h3>🏨 Wat voor hotels?</h3><div class="hgrid">${HCLASS.map(h=>`<button class="hcard ${W.hclass===h.id?'on':''}" data-hc="${h.id}"><span class="he">${h.e}</span><b>${h.t}</b><small>${h.s}</small><p>${h.d}</p><em>${h.ex}</em><strong>${h.pr}</strong></button>`).join('')}</div>
    <div class="wgrid" style="margin-top:20px">
      <div class="fld s"><label>Aantal kamers</label><input id="wRooms" type="number" min="1" max="6" value="${W.rooms}"></div>
      <div class="fld s"><label>Nachten in een ryokan</label><input id="wRyo" type="number" min="0" max="14" value="${W.ryokan}"></div>
      <div class="fld s"><label>Totaal budget (€)</label><input id="wBud" type="number" min="1000" step="500" value="${W.budget}"></div>
      <div class="fld full"><label>Vervoer</label><div class="seg">${[['trein','🚄 Trein & OV'],['mix','🚗 Trein + soms huurauto'],['auto','🚙 Vooral huurauto']].map(o=>`<button class="segb ${W.transport===o[0]?'on':''}" data-tr="${o[0]}"><b>${o[1]}</b></button>`).join('')}</div></div></div>
    <p class="muted" style="margin-top:12px">De planner stelt bekende hotels voor met een geschatte prijs. Daarna kun je per plek met <b>Zoek live prijzen</b> de echte prijzen ophalen via LetsFG.</p>`;
  const H = HCLASS.find(h=>h.id===W.hclass);
  return `<h3>✅ Klopt dit?</h3><div class="sumg">
    <div><small>Reis</small><b>${esc(W.country)} · ${W.days} dagen</b><span>vanaf ${esc(W.start)} uit ${esc(W.home)}</span></div>
    <div><small>Reizigers</small><b>${W.travellers.length} personen</b><span>${W.travellers.map(t=>`${esc(t.n||'?')} (${esc(t.a)})`).join(', ')}</span></div>
    <div><small>Interesses</small><b>${W.interests.length} gekozen</b><span>${W.interests.map(k=>INTERESTS.find(i=>i[0]===k)?.[2]).filter(Boolean).join(', ')}</span></div>
    <div><small>Tempo & mix</small><b>${esc(W.pace)}</b><span>${mixLabel(W.mix)}</span></div>
    <div><small>Plekken</small><b>${W.places.length} zeker</b><span>${W.places.map(esc).join(', ')}${W.letChoose?' + suggesties':''}</span></div>
    <div><small>Hotels & budget</small><b>${H.e} ${H.t} · € ${(+W.budget).toLocaleString('nl-NL')}</b><span>${W.rooms} kamers · ${W.ryokan} ryokan-nachten · ${esc(W.transport)}</span></div>
    ${W.wishes?`<div style="grid-column:1/-1"><small>Wensen</small><span>${esc(W.wishes)}</span></div>`:''}</div>
    <p class="muted" style="margin-top:16px">Het maken duurt 1 tot 3 minuten. Claude gebruikt hiervoor jouw Claude-account; de eerste keer vraagt claude.ai om toestemming. Het huidige plan blijft bewaard en kun je terugzetten.</p>`;
}
const mixLabel = v => v<25?'Vooral de bekende toppers':v<50?'Meer bekend dan verborgen':v<75?'Mix van bekend en verborgen':'Vooral verborgen parels';
const travRow = (t,i) => `<div class="trow"><input data-tn="${i}" value="${esc(t.n)}" placeholder="Naam"><input data-ta="${i}" type="number" min="0" max="110" value="${esc(t.a)}" placeholder="Leeftijd"><span class="muted">jaar</span><button class="ib del" data-tr-rm="${i}">✕</button></div>`;
function bindStep(st){
  if (st===0){ const r=$('#wDays'); r.oninput=()=>{ W.days=+r.value; $('#wDaysL').textContent=`${W.days} dagen (± ${(W.days/7).toFixed(1).replace('.',',')} weken)`; $$('[data-days]').forEach(b=>b.classList.toggle('on',+b.dataset.days===W.days)); };
    $$('[data-days]').forEach(b=>b.onclick=()=>{ readStep(0); W.days=+b.dataset.days; renderPlanner(); }); }
  if (st===1){ $('#wAddT').onclick=()=>{ readStep(1); W.travellers.push({n:'',a:''}); renderPlanner(); }; $$('[data-tr-rm]').forEach(b=>b.onclick=()=>{ readStep(1); W.travellers.splice(+b.dataset.trRm,1); renderPlanner(); }); }
  if (st===2){ $$('[data-int]').forEach(b=>b.onclick=()=>{ const k=b.dataset.int; W.interests=W.interests.includes(k)?W.interests.filter(x=>x!==k):[...W.interests,k]; b.classList.toggle('on'); });
    $$('[data-pace]').forEach(b=>b.onclick=()=>{ W.pace=b.dataset.pace; $$('[data-pace]').forEach(x=>x.classList.toggle('on',x===b)); });
    const m=$('#wMix'); m.oninput=()=>{ W.mix=+m.value; $('#wMixL').textContent=mixLabel(W.mix); }; }
  if (st===3){ $$('[data-pl]').forEach(b=>b.onclick=()=>{ const k=b.dataset.pl; W.places=W.places.includes(k)?W.places.filter(x=>x!==k):[...W.places,k]; b.classList.toggle('on'); }); }
  if (st===4){ $$('[data-hc]').forEach(b=>b.onclick=()=>{ W.hclass=b.dataset.hc; $$('[data-hc]').forEach(x=>x.classList.toggle('on',x===b)); });
    $$('[data-tr]').forEach(b=>b.onclick=()=>{ W.transport=b.dataset.tr; $$('[data-tr]').forEach(x=>x.classList.toggle('on',x===b)); }); }
}
function readStep(st){
  if (st===0){ W.country=$('#wCountry').value.trim()||'Japan'; W.home=$('#wHome').value.trim(); W.start=$('#wStart').value||W.start; W.days=+$('#wDays').value; }
  if (st===1){ W.travellers = W.travellers.map((t,i)=>({n:$(`[data-tn="${i}"]`)?.value.trim()||'', a:$(`[data-ta="${i}"]`)?.value||''})); }
  if (st===3){ W.letChoose=$('#wLet').checked; W.wishes=$('#wWish').value.trim(); }
  if (st===4){ W.rooms=+$('#wRooms').value||2; W.ryokan=+$('#wRyo').value||0; W.budget=+$('#wBud').value||W.budget; }
}

/* ---------- Generation ---------- */
function brief(){
  const H=HCLASS.find(h=>h.id===W.hclass);
  return `REISWENSEN VAN DE FAMILIE
- Land: ${W.country}
- Vertrek vanaf: ${W.home}; eerste reisdag (vertrekdag uit huis): ${W.start}; totaal ${W.days} dagen inclusief vertrek- en terugreisdag
- Reizigers (${W.travellers.length}): ${W.travellers.map(t=>`${t.n||'reiziger'} ${t.a} jaar`).join(', ')}
- Interesses: ${W.interests.map(k=>INTERESTS.find(i=>i[0]===k)?.[2]).filter(Boolean).join(', ')||'geen voorkeur'}
- Tempo: ${W.pace}
- Bekend vs. verborgen: ${W.mix}/100 (${mixLabel(W.mix)})
- Zeker bezoeken: ${W.places.join(', ')||'geen voorkeur'}${W.letChoose?' — vul aan met andere passende plekken':' — voeg geen andere overnachtingsplekken toe'}
- Overige wensen: ${W.wishes||'geen'}
- Hotels: ${H.t} (${H.s}; ${H.ex}); ${W.rooms} kamers; ongeveer ${W.ryokan} nachten in een ryokan
- Totaal budget: € ${W.budget} voor alles (vluchten, hotels, vervoer, eten, activiteiten)
- Vervoer: ${W.transport}`;
}
const SKEL = (b) => `Je bent een ervaren reisplanner. Maak het SKELET van een rondreis op basis van deze wensen. Schrijf alle tekst in natuurlijk Nederlands.

${b}

REGELS
- Precies ${W.days} dagen. Dag 1 is de vertrekdag uit ${W.home}; de laatste dag is de terugreis. Hou rekening met tijdzones en lange vluchten.
- Logische route zonder onnodig heen-en-weer reizen, realistische reistijden, niet elke dag verkassen (meestal 2–4 nachten per plek).
- Echte, bestaande plekken. Coördinaten [lengtegraad, breedtegraad] moeten kloppen.
- Houd rekening met de leeftijden (alcohol mag in Japan pas vanaf 20).
- "stops": de overnachtingsplekken en belangrijke dagtrips in reisvolgorde. Geef elke stop een korte id (kleine letters, alleen a-z en cijfers, uniek; gebruik een tweede id als je aan het eind terugkeert naar een stad, bv. "tokyo2").
- Elke dag: "city" = id van de stop waar je die dag vooral bent; "sleep" = id van de stop waar je die nacht slaapt, of "" in het vliegtuig. Op de eerste dag is city "home".
- "move" alleen op dagen dat je reist: {"mode": één emoji uit ✈️ 🚄 🚆 🚌 ⛴️ 🚗, "from", "to", "how", "dur"}; anders null.
- Kleuren c1/c2: twee mooie hex-kleuren per stop die bij de sfeer passen (verschillend per stop).
- "kanji": 1–4 tekens in de lokale schrijfwijze, of een passend teken als het land geen eigen schrift heeft.
- Begroting in euro voor de hele groep, realistisch, samen niet boven het budget tenzij het echt niet anders kan.
- "mapCountry": de Engelse landnaam zoals op een wereldkaart (bv. "Japan").

Antwoord met ALLEEN dit JSON-object:
{"title":"korte titel","summary":"2-3 zinnen over de reis","mapCountry":"Japan","home":{"name":"Amsterdam","coord":[4.76,52.31]},
 "flight":{"airline":"advies maatschappij/route","out":"heenvlucht in woorden","back":"terugvlucht in woorden","price":5200},
 "stops":[{"id":"tokyo","name":"Tokyo","jp":"東京","kanji":"東京","coord":[139.70,35.69],"c1":"#e8402a","c2":"#ff7a59","tag":"Neon & tempels","temp":"± 23°","intro":"3 zinnen"}],
 "days":[{"city":"home","sleep":"","title":"Vertrek","sub":"korte ondertitel","move":{"mode":"✈️","from":"Amsterdam","to":"Tokyo","how":"KLM","dur":"± 14 uur"}}],
 "budget":[{"n":"Vluchten","v":5200},{"n":"Hotels & ryokans","v":9000},{"n":"Treinen & vervoer","v":2000},{"n":"Eten & drinken","v":4000},{"n":"Activiteiten","v":1800},{"n":"Overig","v":2000}]}`;
const DETAIL_STOPS = (b, sk, ids) => `Je bent een ervaren reisplanner. Hieronder de wensen en de route. Werk de stops ${ids.join(', ')} verder uit. Schrijf in natuurlijk Nederlands.

${b}

ROUTE: ${sk.stops.map(s=>`${s.id}=${s.name}`).join(', ')}
NACHTEN PER STOP: ${ids.map(id=>`${id}: ${sk.days.filter(d=>d.sleep===id).length}`).join(', ')}

Per stop:
- "todo": 4–7 bezienswaardigheden/activiteiten {"e":emoji,"h":naam,"d":1-2 zinnen met tip,"q":zoekterm voor Google (Engels, plek + stad)}
- "gems": 2–4 minder bekende plekken in hetzelfde formaat (passend bij de mix bekend/verborgen)
- "food": 2–4 gerechten of adressen {"e","h","d"}
- "hotels": 2–3 ECHTE, bestaande hotels/ryokans passend bij de gekozen hotelklasse (de eerste is de aanrader), alleen als er een nacht geslapen wordt, anders []. Formaat {"tag":"Aanrader/Luxe/Voordelig/Ryokan…","n":"exacte naam","s":"4★","x":"1 zin waarom","p":geschatte totaalprijs in euro voor alle nachten en ${W.rooms} kamers (getal),"hb":true als diner+ontbijt inbegrepen,"q":"naam + stad"}

Antwoord met ALLEEN JSON: {"stops":{"<id>":{"todo":[],"gems":[],"food":[],"hotels":[]}}}`;
const DETAIL_DAYS = (b, sk, from, to) => `Je bent een ervaren reisplanner. Hieronder de wensen en het reisskelet. Maak het dagprogramma voor dag ${from} t/m ${to}. Schrijf in natuurlijk Nederlands.

${b}

SKELET:
${sk.days.map((d,i)=>`Dag ${i+1}: ${d.title} | plaats ${d.city} | slapen ${d.sleep||'vliegtuig'}${d.move?` | reis ${d.move.from}→${d.move.to} (${d.move.how}, ${d.move.dur})`:''}`).join('\n')}
STOPS: ${sk.stops.map(s=>`${s.id}=${s.name}`).join(', ')}

Per dag: "items" = ${W.pace==='rustig'?'3–4':W.pace==='vol'?'6–7':'4–6'} programmapunten in tijdsvolgorde {"t":"09:00","k":"see|eat|go|rest","h":titel,"d":1-2 zinnen met praktische tip,"q":zoekterm voor Google (Engels) of ""}, en een "tip" van 1-2 zinnen. Herhaal geen activiteiten van andere dagen. Houd rekening met reistijd op reisdagen.

Antwoord met ALLEEN JSON: {"days":[{"n":${from},"items":[],"tip":""}]}`;

function genUI(msg, pct, log){
  $('#plannerBody').innerHTML = `<p class="kicker">✨ Reisplanner</p><h2 class="title">Jullie reis wordt gemaakt…</h2>
  <div class="card gen"><div class="genbar"><div style="width:${pct}%"></div></div><div class="loading" style="margin-top:16px"><span class="spin"></span><b>${esc(msg)}</b></div>
  <ul class="glog">${log.map(l=>`<li>${l}</li>`).join('')}</ul><button class="btn ghost2" id="gStop" style="margin-top:14px">Stoppen</button></div>`;
  $('#gStop').onclick=()=>genCtl&&genCtl.abort();
}
async function generatePlan(){
  readStep(W.step);
  const sample = await window.claude.use('sample').catch(()=>null);
  if (!sample){ toast('De planner kan Claude hier niet bereiken'); return; }
  genCtl = new AbortController(); const sig = genCtl.signal; const log=[]; const b = brief();
  try{
    genUI('Route en dagindeling bedenken… (dit kan 1–2 minuten duren)', 5, log);
    const sk = await sample.json(SKEL(b), {signal:sig, cache:false});
    if (!sk || !Array.isArray(sk.stops) || !Array.isArray(sk.days) || !sk.stops.length) throw {code:'invalid_json'};
    sk.stops.forEach(s=>{ s.id = String(s.id||s.name).toLowerCase().replace(/[^a-z0-9]/g,'') || uid('s'); });
    log.push(`✓ Route: ${sk.stops.map(s=>esc(s.name)).join(' → ')}`); log.push(`✓ ${sk.days.length} dagen ingedeeld`);
    const jobs = [];
    const sids = sk.stops.map(s=>s.id); for (let i=0;i<sids.length;i+=3) jobs.push({kind:'stops', ids:sids.slice(i,i+3)});
    for (let i=1;i<=sk.days.length;i+=4) jobs.push({kind:'days', from:i, to:Math.min(sk.days.length,i+3)});
    let done=0; const total=jobs.length;
    genUI(`Details uitwerken (0/${total})…`, 25, log);
    const run = async j => {
      const r = await sample.json(j.kind==='stops'?DETAIL_STOPS(b,sk,j.ids):DETAIL_DAYS(b,sk,j.from,j.to), {signal:sig, cache:false});
      if (j.kind==='stops' && r?.stops) for (const [id,v] of Object.entries(r.stops)){ const s=sk.stops.find(x=>x.id===id); if(s) Object.assign(s, v); }
      if (j.kind==='days' && Array.isArray(r?.days)) r.days.forEach(x=>{ const d=sk.days[(+x.n||0)-1]; if(d){ d.items=x.items||[]; d.tip=x.tip||''; } });
      done++; log.push(j.kind==='stops'?`✓ Tips, eten en hotels: ${j.ids.map(id=>esc(sk.stops.find(s=>s.id===id)?.name||id)).join(', ')}`:`✓ Programma dag ${j.from}–${j.to}`);
      genUI(`Details uitwerken (${done}/${total})…`, 25+Math.round(done/total*72), log);
    };
    let k=0; const worker = async () => { while(k<jobs.length){ const j=jobs[k++]; try{ await run(j); }catch(e){ if(e?.code==='cancelled') throw e; done++; log.push(`⚠️ ${j.kind==='stops'?'Stops '+j.ids.join(', '):'Dag '+j.from+'–'+j.to} kon niet worden uitgewerkt; die kun je zelf aanvullen`); } } };
    await Promise.all([worker(), worker()]);
    planPreview = sk; genCtl=null; renderPlanner(); $('#v-planner').scrollTop=0;
  }catch(e){
    genCtl=null; const c=e?.code;
    const msg = {cancelled:'Gestopt.', not_granted:'Je hebt de app geen toestemming gegeven om Claude te gebruiken.', sampling_disabled:'Claude is niet beschikbaar voor dit account.', rate_limited:'Je hebt je gebruikslimiet bereikt of er liepen te veel verzoeken. Probeer het later opnieuw.', invalid_json:'Het plan kwam niet goed door. Probeer het nog eens, eventueel met wat minder dagen of plekken.', refused:'Claude kon dit verzoek niet uitvoeren. Pas je wensen aan en probeer opnieuw.', session_expired:'Log opnieuw in op claude.ai en probeer het nog eens.'}[c] || 'Er ging iets mis bij het maken van het plan. Probeer het opnieuw.';
    $('#plannerBody').innerHTML = `<p class="kicker">✨ Reisplanner</p><h2 class="title">Niet gelukt</h2><div class="card"><p class="muted">${esc(msg)}</p><div style="display:flex;gap:10px;margin-top:14px"><button class="btn primary" id="gAgain">Opnieuw proberen</button><button class="btn ghost2" id="gBack">Terug naar wensen</button></div></div>`;
    $('#gAgain').onclick=generatePlan; $('#gBack').onclick=()=>renderPlanner();
  }
}
function renderPreview(){
  const p = planPreview; const tot=(p.budget||[]).reduce((a,x)=>a+(+x.v||0),0);
  $('#plannerBody').innerHTML = `<p class="kicker">✨ Voorstel</p><h2 class="title">${esc(p.title||'Jullie nieuwe reis')}</h2><p class="sub">${esc(p.summary||'')}</p>
  <div class="sumg" style="margin-top:20px"><div><small>Dagen</small><b>${p.days.length}</b></div><div><small>Stops</small><b>${p.stops.length}</b></div><div><small>Begroting</small><b>${eur(tot)}</b><span>budget ${eur(W.budget)}</span></div><div><small>Vlucht</small><b>${esc(p.flight?.airline||'—')}</b></div></div>
  <div class="pvroute">${p.stops.map((s,i)=>`<div class="pvs" style="${cvars(s)}"><span class="dot">${i+1}</span><div><b>${esc(s.name)}</b><small>${p.days.filter(d=>d.sleep===s.id).length} nachten · ${esc(s.tag||'')}</small></div></div>`).join('<span class="arr">→</span>')}</div>
  <div class="card" style="margin-top:20px"><h3>📅 Dagen</h3><div class="pvdays">${p.days.map((d,i)=>`<div class="pvd"><span>Dag ${i+1}</span><b>${esc(d.title)}</b><small>${esc((p.stops.find(s=>s.id===d.city)||{name:p.home?.name||'Onderweg'}).name)} · ${(d.items||[]).length} punten</small></div>`).join('')}</div></div>
  <div class="wnav"><button class="btn ghost2" id="pvBack">← Wensen aanpassen</button><button class="btn ghost2" id="pvAgain">🔄 Nieuw voorstel</button><span style="flex:1"></span><button class="btn primary big2" id="pvApply">✓ Dit plan gebruiken</button></div>
  <p class="muted" style="margin-top:10px">Bij "Dit plan gebruiken" wordt het huidige plan vervangen voor iedereen. Het oude plan wordt bewaard en kun je terugzetten. Hotelprijzen zijn schattingen; check ze per plek met <b>Zoek live prijzen</b>.</p>`;
  $('#pvBack').onclick=()=>{ planPreview=null; renderPlanner(); };
  $('#pvAgain').onclick=()=>{ planPreview=null; generatePlan(); };
  $('#pvApply').onclick=async()=>{ const b=$('#pvApply'); if(!b.dataset.sure){ b.dataset.sure=1; b.textContent='Zeker? Klik nogmaals om te vervangen'; return; } b.disabled=true; b.textContent='Toepassen…'; await applyPlan(p); };
}
async function applyPlan(p){
  const backup = { stops:clone(S.stops), days:clone(S.days), meta:{...clone(S.meta), backup:undefined} };
  const stops = {}; if (S.stops.ams) stops.ams = {...S.stops.ams, name:p.home?.name||'Thuis', coord:p.home?.coord||S.stops.ams.coord};
  else stops.ams = {name:p.home?.name||'Thuis', jp:'', kanji:'旅', coord:p.home?.coord||[4.76,52.31], c1:'#4f6bff', c2:'#9b7bff', tag:'Vertrek', intro:'Vertrek', todo:[],gems:[],food:[],hotels:[],chosen:0};
  p.stops.forEach(s=>{ stops[s.id] = { name:s.name, jp:s.jp||'', kanji:s.kanji||s.name.slice(0,2), coord:Array.isArray(s.coord)?s.coord.map(Number):[0,0], c1:s.c1||'#3f5bd8', c2:s.c2||'#8fa5ff', tag:s.tag||'', temp:s.temp||'', intro:s.intro||'',
    todo:(s.todo||[]).map(x=>({e:x.e||'📍',h:x.h||'',d:x.d||'',q:x.q||''})), gems:(s.gems||[]).map(x=>({e:x.e||'💎',h:x.h||'',d:x.d||'',q:x.q||''})), food:(s.food||[]).map(x=>({e:x.e||'🍜',h:x.h||'',d:x.d||''})),
    hotels:(s.hotels||[]).map(h=>({tag:h.tag||'',n:h.n||'',s:h.s||'',r:'',rc:'',p:+h.p||0,pb:'',f:false,hb:!!h.hb,est:true,x:(h.x||'')+' (prijs is een schatting)',q:h.q||h.n})), chosen:0 }; });
  const days = p.days.map((d,i)=>({ id:'d'+String(i+1).padStart(2,'0'), order:i+1, city: d.city==='home'?'ams':(stops[d.city]?d.city:p.stops[0].id), sleep: stops[d.sleep]?d.sleep:'', sleepTxt: d.sleep?'':'In het vliegtuig',
    title:d.title||`Dag ${i+1}`, sub:d.sub||'', tip:d.tip||'', move:d.move&&d.move.from?d.move:null, items:(d.items||[]).map(x=>({t:x.t||'',k:['see','eat','go','rest'].includes(x.k)?x.k:'see',h:x.h||'',d:x.d||'',q:x.q||''})) }));
  const meta = { ...S.meta, start:W.start, order:p.stops.map(s=>s.id), country:W.country, mapCountry:p.mapCountry||W.country, title:p.title||'', summary:p.summary||'', home:{name:p.home?.name||W.home, coord:stops.ams.coord},
    travellers:W.travellers, prefs:{interests:W.interests,pace:W.pace,mix:W.mix,places:W.places,letChoose:W.letChoose,wishes:W.wishes,hclass:W.hclass,rooms:W.rooms,ryokan:W.ryokan,transport:W.transport},
    budgetMax:+W.budget, budget:(p.budget||[]).map((x,i)=>({n:x.n,v:+x.v||0,c:['#6d8cff','#e8402a','#1f9d74','#f2b544','#c2185b','#7b4dff','#0a84c6'][i%7]})),
    flight:{ airline:p.flight?.airline||'', out:p.flight?.out||'', back:p.flight?.back||'', price:+p.flight?.price||0, booked:false, link:LETSFG_TRIP },
    backup, backupAt:new Date().toLocaleString('nl-NL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) };
  await replaceAll(stops, days, meta);
  planPreview=null; W=null; toast('Nieuw plan toegepast ✓'); location.hash='dagen';
}
async function replaceAll(stops, days, meta){
  const oldStops = Object.keys(S.stops), oldDays = S.days.map(d=>d.id);
  S.stops = stops; S.days = days; S.meta = meta;
  if (Store.mode==='db'){
    try{
      await Store.saveMeta();
      for (const k of Object.keys(stops)) await Store.saveStop(k);
      for (const d of days) await Store.saveDay(d);
      for (const k of oldStops) if(!stops[k]) await Store.deleteStop(k);
      for (const id of oldDays) if(!days.find(d=>d.id===id)) await Store.deleteDay(id);
    }catch(e){ toast('Niet alles kon worden opgeslagen. Probeer het opnieuw.'); }
  } else Store.local();
}
async function restoreBackup(){
  const b = S.meta.backup; if(!b) return;
  const btn=$('#wRestore'); if(!btn.dataset.sure){ btn.dataset.sure=1; btn.textContent='Zeker? Klik nogmaals'; return; }
  await replaceAll(b.stops, b.days, {...b.meta}); W=null; toast('Vorig plan teruggezet'); location.hash='dagen';
}
