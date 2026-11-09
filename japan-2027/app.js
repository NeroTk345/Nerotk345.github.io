/* ============ HELPERS ============ */
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const eur = n => '€ ' + Math.round(n).toLocaleString('nl-NL');
const BK = h => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(h.n)}&checkin=${h.ci}&checkout=${h.co}&group_adults=4&no_rooms=2`;
const GM = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const IMG = q => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
const MONTH = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const dnum = d => +d.slice(8,10);
const fmtDate = d => `${dnum(d)} ${MONTH[+d.slice(5,7)-1]}`;
const cvars = s => `--c:${s.c1};--c2:${s.c2}`;
const store = { get(k,d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
                set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('on'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('on'),2400); }
const EVI = {see:'📍', eat:'🍜', go:'🚆', rest:'🛏️'};
const placeNum = id => ORDER.filter(k => STOPS[k].nights>0 || k==='shirakawa' || k==='nara').indexOf(id)+1;

/* hotel choice per stop (budget page) */
let choice = store.get('jp27-hotels', {});
const chosen = id => { const s = STOPS[id]; if (!s.hotels || !s.hotels.length) return null; return s.hotels[Math.min(choice[id]||0, s.hotels.length-1)]; };

/* ============ STARS & COUNTDOWN ============ */
(function(){
  const c = $('#stars'), x = c.getContext('2d');
  function draw(){ const dpr=devicePixelRatio||1; c.width=innerWidth*dpr; c.height=innerHeight*dpr; x.clearRect(0,0,c.width,c.height);
    for(let i=0;i<500;i++){ x.globalAlpha=Math.random()*.8+.1; x.fillStyle=Math.random()<.08?'#ffd7a8':'#fff';
      x.beginPath(); x.arc(Math.random()*c.width,Math.random()*c.height,Math.random()*1.2*dpr,0,7); x.fill(); } }
  draw(); addEventListener('resize', draw);
})();
const DEPART = new Date('2027-05-04T22:00:00+02:00');
function tick(){ const d = Math.max(0, Math.ceil((DEPART - new Date())/864e5)); $('#cdD').textContent = d; $('#cdD2').textContent = d; }
tick(); setInterval(tick, 60000);

/* ============ GLOBE ============ */
let globe = null, spinning = true, tourTimer = null;
const route = ORDER.map(k => STOPS[k]);
const DXB = [55.36,25.25];
function initGlobe(){
  try{
    if (!window.echarts || !echarts.getMap('world')) throw 0;
    const tex = echarts.init(document.createElement('canvas'), null, {width:4096, height:2048});
    tex.setOption({ backgroundColor:'#0a1a38', geo:{ type:'map', map:'world', top:0,left:0,right:0,bottom:0, boundingCoords:[[-180,90],[180,-90]], silent:true,
      itemStyle:{ areaColor:'#1b3358', borderColor:'#36598a', borderWidth:1.2 },
      regions:[{name:'Japan', itemStyle:{areaColor:'#e8402a', borderColor:'#ffd9cf', borderWidth:2.5}},{name:'Netherlands', itemStyle:{areaColor:'#f2b544', borderColor:'#fff1c9'}}] } });
    const legs=[]; for(let i=0;i<route.length-1;i++) legs.push({coords:[route[i].coord, route[i+1].coord]});
    const pts = ORDER.filter(k=>k!=='tokyo2').map(k => ({ name:STOPS[k].name, id:k, value:[...STOPS[k].coord, 0] }));
    globe = echarts.init($('#globe'));
    globe.setOption({
      globe:{ baseTexture:tex, shading:'lambert', globeRadius:100, ...(innerWidth>1000?{left:'28%',width:'72%',top:0,height:'100%'}:{left:0,width:'100%',top:'-12%',height:'100%'}),
        light:{ ambient:{intensity:.6}, main:{intensity:1.2, alpha:28, beta:-30} },
        viewControl:{ autoRotate:true, autoRotateSpeed:5, autoRotateAfterStill:1e6, distance:220, minDistance:8, maxDistance:400, targetCoord:[60,35],
          animation:true, animationDurationUpdate:1800, animationEasingUpdate:'cubicInOut' },
        postEffect:{ enable:true, bloom:{ enable:true, bloomIntensity:.22 } } },
      series:[
        { type:'lines3D', coordinateSystem:'globe', blendMode:'lighter', lineStyle:{width:2,color:'#7d9bff',opacity:.4},
          effect:{show:true,period:4,trailWidth:4,trailLength:.25,trailOpacity:1,trailColor:'#cdd9ff'},
          data:[{coords:[STOPS.ams.coord,DXB]},{coords:[DXB,[139.78,35.55]]},{coords:[[140.39,35.77],DXB]},{coords:[DXB,STOPS.ams.coord]}] },
        { type:'lines3D', coordinateSystem:'globe', blendMode:'lighter', lineStyle:{width:3,color:'#f2b544',opacity:.6},
          effect:{show:true,period:2.4,trailWidth:5,trailLength:.35,trailOpacity:1,trailColor:'#fff3cf'}, data:legs },
        { type:'scatter3D', coordinateSystem:'globe', symbolSize:9, blendMode:'lighter', itemStyle:{color:'#fff'},
          label:{ show:true, position:'right', distance:4, formatter:p=>p.name, textStyle:{color:'#fff',fontSize:13,fontWeight:'bold',backgroundColor:'rgba(11,16,32,.78)',padding:[3,7],borderRadius:4} },
          data:pts },
        { type:'scatter3D', coordinateSystem:'globe', symbolSize:8, itemStyle:{color:'#7d9bff'},
          label:{ show:true, position:'right', formatter:p=>p.name, textStyle:{color:'#dfe6ff',fontSize:12,backgroundColor:'rgba(11,16,32,.78)',padding:[3,7],borderRadius:4} },
          data:[{name:'Amsterdam',value:[...STOPS.ams.coord,0]},{name:'Dubai',value:[...DXB,0]}] }
      ]});
    globe.on('click', p => { if (p.data && p.data.id) location.hash = 'plaats-' + p.data.id; });
    addEventListener('resize', () => globe && globe.resize());
    setTimeout(() => { if (curView==='reis' && !tourTimer) flyTo([136.5,35.8], 75); }, 3800);
  }catch(e){ $('#globeFallback').style.display='block'; }
}
function flyTo(coord, dist){ if(!globe) return; spinning=false; $('#gSpin').classList.remove('on');
  globe.setOption({globe:{viewControl:{targetCoord:coord, distance:dist, autoRotate:false}}}); }
$('#gWorld').onclick = () => { stopTour(); if(!globe) return; globe.setOption({globe:{viewControl:{targetCoord:[60,35],distance:220}}}); };
$('#gJapan').onclick = () => { stopTour(); flyTo([136.5,35.8], 55); };
$('#gSpin').onclick = () => { spinning=!spinning; $('#gSpin').classList.toggle('on',spinning); globe && globe.setOption({globe:{viewControl:{autoRotate:spinning}}}); };

/* strip */
$('#strip').innerHTML = ORDER.map((k,i) => { const s=STOPS[k];
  return `<a class="chipstop" href="#plaats-${k}" data-k="${k}" style="${cvars(s)}"><span class="dot">${i+1}</span><span><b>${esc(s.name)}</b><small>${esc(s.dates)}</small></span></a>`; }).join('');

/* tour */
function showTourCard(k){ const s=STOPS[k];
  $('#tourCard').innerHTML = `<div class="tc-hero" style="background:linear-gradient(135deg,${s.c1},${s.c2})"><div class="k">${s.kanji}</div><small style="font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px">${esc(s.dates)}</small><h3>${esc(s.name)}</h3></div>
    <div class="tc-b">${esc(s.intro)}<br><a href="#plaats-${k}">Bekijk ${esc(s.name)} →</a></div>`;
  $('#tourCard').classList.add('on');
  document.querySelectorAll('.chipstop').forEach(c => c.classList.toggle('on', c.dataset.k===k));
  const a=document.querySelector(`.chipstop[data-k="${k}"]`); a && a.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
}
function stopTour(){ if(tourTimer){ clearInterval(tourTimer); tourTimer=null; } $('#bTour').classList.remove('on'); $('#bTour').textContent='▶ Speel de reis af'; }
$('#bTour').onclick = () => {
  if (tourTimer){ stopTour(); return; }
  $('#bTour').classList.add('on'); $('#bTour').textContent='⏸ Pauze';
  const seq = ['ams', ...ORDER]; let i = 0;
  const step = () => { const k = seq[i]; const s = STOPS[k];
    flyTo(s.coord, k==='ams'?140:22); showTourCard(k); i++;
    if (i>=seq.length){ stopTour(); setTimeout(()=>{ flyTo([136.5,35.8],55); $('#tourCard').classList.remove('on'); }, 6000); } };
  step(); tourTimer = setInterval(step, 6000);
};

/* ============ MINI MAP ============ */
const maps = [];
function miniMap(el, focusIds, highlight){
  if (!window.echarts || !echarts.getMap('world')) { el.innerHTML='<p style="color:#9aa3ba;padding:20px">Kaart niet beschikbaar</p>'; return; }
  const ch = echarts.init(el); maps.push(ch);
  const legs=[]; for(let i=0;i<route.length-1;i++) legs.push({coords:[route[i].coord, route[i+1].coord]});
  const f = focusIds.map(k => STOPS[k].coord);
  const cx = f.reduce((a,c)=>a+c[0],0)/f.length, cy = f.reduce((a,c)=>a+c[1],0)/f.length;
  ch.setOption({
    backgroundColor:'#0f1a33',
    geo:{ map:'world', roam:true, center:[cx,cy], zoom: focusIds.length>1 ? 9 : 14, silent:true, scaleLimit:{min:4,max:60},
      itemStyle:{ areaColor:'#24365e', borderColor:'#3d5a8f' }, regions:[{name:'Japan', itemStyle:{areaColor:'#2f4677', borderColor:'#6e8fd0'}}] },
    series:[
      { type:'lines', coordinateSystem:'geo', zlevel:1, lineStyle:{ color:'#f2b544', width:2, opacity:.55, curveness:.15 }, data:legs },
      { type:'lines', coordinateSystem:'geo', zlevel:2, effect:{show:true, period:4, trailLength:.3, color:'#fff3cf', symbolSize:4}, lineStyle:{width:0, curveness:.15}, data:legs },
      { type:'scatter', coordinateSystem:'geo', zlevel:3, symbolSize:7, itemStyle:{color:'#fff'},
        label:{ show:true, position:'right', formatter:'{b}', color:'#dfe6ff', fontSize:11 },
        data: ORDER.filter(k=>k!=='tokyo2' && !highlight.includes(k)).map(k=>({name:STOPS[k].name, value:STOPS[k].coord})) },
      { type:'effectScatter', coordinateSystem:'geo', zlevel:4, symbolSize:13, rippleEffect:{scale:3.5, brushType:'stroke'},
        itemStyle:{ color:'#e8402a' }, label:{ show:true, position:'right', formatter:'{b}', color:'#fff', fontWeight:'bold', fontSize:13, backgroundColor:'rgba(232,64,42,.9)', padding:[3,6], borderRadius:4 },
        data: highlight.map(k=>({name:STOPS[k].name, value:STOPS[k].coord})) }
    ]});
}
function clearMaps(){ while(maps.length){ try{ maps.pop().dispose(); }catch(e){} } }
addEventListener('resize', () => maps.forEach(m => m.resize()));

/* ============ COMPONENTS ============ */
function hotelCard(h, nights){
  const price = h.hb ? `${eur(h.p)}<small>incl. diner & ontbijt</small>` : `${h.est?'± ':''}${eur(h.p)}<small>${h.pb?`${eur(h.pb)} met ontbijt`:'alleen kamer'}</small>`;
  return `<div class="hotel"><div class="row"><div><div class="tg">${esc(h.tag)}</div><b>${esc(h.n)}</b>
    <div class="sc"><em>${esc(h.r)}</em>${esc(h.rc)} reviews${h.s?` · ${esc(h.s)}`:''}</div></div>
    <div class="pr"><b>${price}</b></div></div>
    <p>${esc(h.x)}</p>
    <div class="fl"><span class="pill">${h.f?'✓ Gratis annuleren':'Niet annuleerbaar'}</span><span class="pill">${nights} ${nights>1?'nachten':'nacht'} · 2 kamers</span></div>
    <div class="fl" style="margin-top:10px"><a href="${BK(h)}" target="_blank" rel="noopener">Booking.com →</a><a href="${GM(h.q)}" target="_blank" rel="noopener">Google Maps →</a><a href="${IMG(h.q)}" target="_blank" rel="noopener">📸 Foto's</a></div></div>`;
}
const spot = i => `<div class="spot"><div class="e">${i[0]}</div><div><b>${esc(i[1])}</b><p>${esc(i[2])}</p>${i[3]?`<a href="${IMG(i[3])}" target="_blank" rel="noopener">📸 Foto's</a> &nbsp; <a href="${GM(i[3])}" target="_blank" rel="noopener">🗺️ Kaart</a>`:''}</div></div>`;

/* ============ VIEWS ============ */
function renderDagen(){
  const cities = [...new Set(DAYS.map(d=>d.city))].filter(k=>k!=='tokyo2');
  $('#dagenBody').innerHTML = `<p class="kicker">Planning</p><h2 class="title">21 dagen, dag voor dag</h2>
    <p class="sub">Klik op een dag voor het volledige programma met tijden, vervoer, hotel, eten en een tip van de dag.</p>
    <div class="legend">${cities.map(k=>`<span style="${cvars(STOPS[k])}"><i></i>${esc(STOPS[k].name)}</span>`).join('')}</div>
    <div class="daygrid">${DAYS.map((d,i)=>{ const s=STOPS[d.city];
      return `<a class="dcard" href="#dag-${i+1}" style="${cvars(s)}"><div class="top"><div class="k">${s.kanji}</div><div class="num">Dag ${i+1} · ${d.dow}</div><div class="dt">${fmtDate(d.date)}</div></div>
      <div class="bd"><h3>${esc(d.title)}</h3><p>${esc(d.sub)}</p><div class="meta"><span class="pill">📍 ${esc(s.name)}</span>${d.move?`<span class="pill">${d.move.mode} ${esc(d.move.dur)}</span>`:''}</div></div></a>`; }).join('')}</div>`;
}

function renderDag(n){
  const d = DAYS[n-1]; if(!d){ location.hash='dagen'; return; }
  const s = STOPS[d.city], sl = d.sleep ? STOPS[d.sleep] : null, h = d.sleep ? chosen(d.sleep) : null;
  const firstNight = d.sleep && DAYS.findIndex(x=>x.sleep===d.sleep) === n-1;
  const prev = DAYS[n-2], next = DAYS[n];
  $('#dagBody').innerHTML = `
  <div class="dstrip">${DAYS.map((x,i)=>`<a href="#dag-${i+1}" class="${i+1===n?'on':''}" style="${cvars(STOPS[x.city])}"><small>${x.dow}</small><b>${dnum(x.date)}</b><i></i></a>`).join('')}</div>
  <div class="dhero" style="${cvars(s)}"><div class="k">${s.kanji}</div><div class="in">
    <div class="stamp"><small>Dag</small><b>${n}</b></div>
    <div class="when">${d.dow} ${fmtDate(d.date)} 2027 · ${esc(s.name)} ${s.jp?`<span style="font-family:var(--serif)">${s.jp}</span>`:''}</div>
    <h2>${esc(d.title)}</h2><p>${esc(d.sub)}</p>
    <div class="meta">${s.temp?`<span>🌤️ gemiddeld ${s.temp}</span>`:''}<span>🛏️ ${esc(h ? h.n : (sl ? sl.name : d.sleepTxt))}</span>${d.move?`<span>${d.move.mode} ${esc(d.move.from)} → ${esc(d.move.to)}</span>`:''}<span>📌 ${d.items.length} programmapunten</span></div>
  </div></div>
  <div class="dgrid">
    <div class="card"><h3>🗓️ Programma</h3><div class="tl">${d.items.map(it=>`<div class="ev ${it[4]||'see'}" style="${cvars(s)}"><div class="t">${esc(it[0])}</div><div class="dot">${EVI[it[4]||'see']}</div>
      <div><h4>${esc(it[1])}</h4><p>${esc(it[2])}</p>${it[3]?`<div class="lk"><a href="${IMG(it[3])}" target="_blank" rel="noopener">📸 Foto's</a><a href="${GM(it[3])}" target="_blank" rel="noopener">🗺️ Kaart</a></div>`:''}</div></div>`).join('')}</div></div>
    <div class="side">
      <div class="card" style="padding:12px"><div class="map" id="dmap"></div></div>
      ${d.move?`<div class="card"><h3>🚆 Vandaag onderweg</h3><div class="move"><div class="ic">${d.move.mode}</div><div><b>${esc(d.move.from)} → ${esc(d.move.to)}</b><small>${esc(d.move.how)} · ${esc(d.move.dur)}</small></div></div></div>`:''}
      <div class="tip card"><h3 style="color:#a07a12">💡 Tip van de dag</h3><p>${esc(d.tip)}</p></div>
      <div class="card"><h3>🛏️ Slapen</h3>${h ? (firstNight ? hotelCard(h, sl.nights) : `<div class="hotel"><div class="tg">Zelfde hotel als gisteren</div><b>${esc(h.n)}</b><div class="fl" style="margin-top:8px"><a href="${GM(h.q)}" target="_blank" rel="noopener">Google Maps →</a></div></div>`) + `<p style="font-size:12.5px;color:var(--sumi3);margin-top:10px">Ander hotel kiezen? Ga naar <a href="#budget" style="color:var(--shu);font-weight:700">Budget</a> of <a href="#plaats-${d.sleep}" style="color:var(--shu);font-weight:700">${esc(sl.name)}</a>.</p>` : `<p style="color:var(--sumi2)">${esc(d.sleepTxt)} ✈️</p>`}</div>
      <div class="card"><h3>📍 Meer over ${esc(s.name)}</h3><p style="font-size:14px;color:var(--sumi2);line-height:1.5">${esc(s.intro)}</p><a class="btn primary" style="margin-top:14px;padding:10px 16px;font-size:14px" href="#plaats-${d.city}">Bekijk ${esc(s.name)} →</a></div>
    </div>
  </div>
  <div class="pn"><a class="${prev?'':'empty'}" href="#dag-${n-1}"><small>← Dag ${n-1}</small><b>${prev?esc(prev.title):''}</b></a><a class="nx ${next?'':'empty'}" href="#dag-${n+1}"><small>Dag ${n+1} →</small><b>${next?esc(next.title):''}</b></a></div>`;
  $('#v-dag').scrollTop = 0;
  const on = document.querySelector('.dstrip a.on'); on && on.scrollIntoView({inline:'center',block:'nearest'});
  const hl = d.city==='ams' ? ['tokyo'] : [d.city];
  setTimeout(()=>miniMap($('#dmap'), d.move && d.city!=='ams' && d.city!=='tokyo' && d.city!=='tokyo2' ? [d.city] : hl, hl), 30);
}

function renderPlaatsen(){
  $('#plaatsenBody').innerHTML = `<p class="kicker">Route</p><h2 class="title">Elf stops door Japan</h2>
  <p class="sub">Van noord naar zuid en weer terug. Per plek vind je wat je er kunt doen, minder bekende plekken, eten en hotels.</p>
  <div class="pgrid">${ORDER.map((k,i)=>{ const s=STOPS[k];
    return `<a class="pcard" href="#plaats-${k}" style="${cvars(s)}"><div class="ph"><div class="k">${s.kanji}</div><div class="n">${i+1}</div><h3>${esc(s.name)}</h3></div>
    <div class="bd"><p>${esc(s.intro)}</p><div class="meta"><span class="pill dark">${esc(s.tag)}</span><span class="pill">📅 ${esc(s.dates)}</span>${s.nights?`<span class="pill">🛏️ ${s.nights} ${s.nights>1?'nachten':'nacht'}</span>`:''}</div></div></a>`; }).join('')}</div>`;
}

function renderPlaats(k){
  const s = STOPS[k]; if(!s || k==='ams'){ location.hash='plaatsen'; return; }
  const idx = ORDER.indexOf(k), prev = ORDER[idx-1], next = ORDER[idx+1];
  const days = DAYS.map((d,i)=>({d,i})).filter(x => x.d.city===k || x.d.sleep===k);
  $('#plaatsBody').innerHTML = `
  <div class="dhero" style="${cvars(s)}"><div class="k">${s.kanji}</div><div class="in">
    <div class="stamp"><small>Stop</small><b>${idx+1}</b></div>
    <div class="when">${esc(s.dates)}${s.nights?` · ${s.nights} ${s.nights>1?'nachten':'nacht'}`:''}${s.temp?` · gemiddeld ${s.temp} in mei`:''}</div>
    <h2>${esc(s.name)} <span style="font-family:var(--serif);opacity:.8">${s.jp}</span></h2><p style="max-width:720px;line-height:1.5">${esc(s.intro)}</p>
  </div></div>
  <div class="dgrid">
    <div style="display:flex;flex-direction:column;gap:20px">
      <div class="card"><h3>🎯 Wat te doen</h3>${s.todo.map(spot).join('')}</div>
      ${s.gems.length?`<div class="card"><h3>💎 Minder bekende parels</h3>${s.gems.map(spot).join('')}</div>`:''}
      ${s.hotels.length?`<div class="card"><h3>🏨 Hotels · 2 kamers voor 4 personen</h3>${s.hotels.map(h=>hotelCard(h, s.nights)).join('')}<p style="font-size:12.5px;color:var(--sumi3);margin-top:12px">Prijzen live gezocht op 9 nov 2026 via LetsFG, voor de hele periode. Ze kunnen nog veranderen.</p></div>`:''}
    </div>
    <div class="side">
      <div class="card" style="padding:12px"><div class="map" id="pmap"></div></div>
      <div class="card"><h3>📅 Jullie dagen hier</h3><div class="daylinks">${days.map(x=>`<a href="#dag-${x.i+1}" style="${cvars(s)}"><span class="s">${x.i+1}</span><span><b>${esc(x.d.title)}</b><small>${x.d.dow} ${fmtDate(x.d.date)}</small></span></a>`).join('')}</div></div>
      ${s.food.length?`<div class="card"><h3>🍜 Eten & drinken</h3>${s.food.map(f=>`<div class="spot"><div class="e">${f[0]}</div><div><b>${esc(f[1])}</b><p>${esc(f[2])}</p></div></div>`).join('')}</div>`:''}
    </div>
  </div>
  <div class="pn"><a class="${prev?'':'empty'}" href="#plaats-${prev}"><small>← Vorige stop</small><b>${prev?esc(STOPS[prev].name):''}</b></a><a class="nx ${next?'':'empty'}" href="#plaats-${next}"><small>Volgende stop →</small><b>${next?esc(STOPS[next].name):''}</b></a></div>`;
  $('#v-plaats').scrollTop = 0;
  setTimeout(()=>miniMap($('#pmap'), [k], [k]), 30);
}

function renderBudget(){
  const hotelTotal = ORDER.reduce((a,k)=>{ const h=chosen(k); return a + (h? (h.pb && !h.hb ? h.pb : h.p) : 0); }, 0);
  const rows = BUDGET.map(r => r[0].startsWith('Hotels') ? [r[0], hotelTotal, r[2]] : r);
  const total = rows.reduce((a,r)=>a+r[1],0), max = 35000;
  $('#budgetBody').innerHTML = `<p class="kicker">Geld</p><h2 class="title">Budget voor 4 personen</h2>
  <p class="sub">Kies per stop een hotel: het totaal en de grafiek passen zich direct aan. Hotelprijzen zijn inclusief ontbijt waar dat kan.</p>
  <div class="bgrid">
    <div class="card"><h3>💴 Totaal geschat</h3><div class="big">${eur(total)}</div>
      <div class="bar2"><div style="width:${Math.min(100,total/max*100)}%"></div></div>
      <p style="font-size:14px;color:var(--sumi2)"><b style="color:var(--sumi)">${eur(max-total)}</b> over van het budget van € 35.000 · ± ${eur(total/4)} per persoon</p>
      <div id="donut"></div>
      ${rows.map(r=>`<div class="brow" style="--c:${r[2]}"><i></i><span>${esc(r[0])}</span><b>${eur(r[1])}</b></div>`).join('')}
    </div>
    <div class="card"><h3>🏨 Kies je hotels</h3><div class="hsel">${ORDER.filter(k=>STOPS[k].hotels.length).map(k=>{ const s=STOPS[k], ci=Math.min(choice[k]||0, s.hotels.length-1);
      return `<div class="hs" style="${cvars(s)}"><div class="pl"><i></i>${esc(s.name)}</div><div class="opts">${s.hotels.map((h,i)=>`<button data-k="${k}" data-i="${i}" class="${i===ci?'on':''}"><b>${esc(h.n.length>24?h.n.slice(0,22)+'…':h.n)}</b>${eur(h.pb && !h.hb ? h.pb : h.p)}</button>`).join('')}</div></div>`; }).join('')}</div>
      <p style="font-size:12.5px;color:var(--sumi3);margin-top:14px">Vluchten: Emirates via Dubai (± € 5.268). Treinen op losse kaartjes; een JR Pass van 21 dagen kost ¥100.000 p.p. en is voor deze route waarschijnlijk duurder.</p>
    </div>
  </div>`;
  document.querySelectorAll('.hs button').forEach(b => b.onclick = () => { choice[b.dataset.k] = +b.dataset.i; store.set('jp27-hotels', choice); renderBudget(); toast('Hotel aangepast · totaal bijgewerkt'); });
  if (window.echarts){ const ch = echarts.init($('#donut')); maps.push(ch);
    ch.setOption({ tooltip:{ trigger:'item', formatter:p=>`${p.name}<br><b>${eur(p.value)}</b> (${p.percent}%)` },
      series:[{ type:'pie', radius:['58%','82%'], avoidLabelOverlap:true, label:{ show:true, position:'center', formatter:()=>`{a|${eur(total)}}\n{b|totaal}`, rich:{a:{fontSize:22,fontWeight:800,color:'#1d1a16'},b:{fontSize:12,color:'#8f877a',padding:[4,0,0,0]}} },
        emphasis:{ label:{ show:true } }, labelLine:{show:false}, itemStyle:{ borderColor:'#fffdf8', borderWidth:3, borderRadius:6 },
        data: rows.map(r=>({name:r[0], value:r[1], itemStyle:{color:r[2]}})) }] }); }
}

function renderGids(){
  const done = store.get('jp27-check', {});
  const all = Object.values(CHECK).flat().length, cnt = Object.values(done).filter(Boolean).length;
  $('#gidsBody').innerHTML = `<p class="kicker">Voorbereiding</p><h2 class="title">Checklist & reisgids</h2>
  <p class="sub">Vink af wat geregeld is (dit wordt op dit apparaat onthouden). Daaronder handige zinnetjes, apps en etiquette.</p>
  <div class="card" style="margin-top:24px"><h3>✅ Voortgang <span class="prog">${cnt} van ${all} klaar</span></h3><div class="bar2" style="margin:0"><div style="width:${cnt/all*100}%"></div></div></div>
  <div class="ggrid">${Object.entries(CHECK).map(([g,items])=>`<div class="card chk"><h3>${g==='Boeken'?'🧾':g==='Inpakken'?'🎒':g==='Vóór vertrek'?'🛂':'🎟️'} ${esc(g)} <span class="prog">${items.filter(i=>done[g+'|'+i]).length}/${items.length}</span></h3>
    ${items.map(i=>`<label><input type="checkbox" data-id="${esc(g+'|'+i)}" ${done[g+'|'+i]?'checked':''}><span>${esc(i)}</span></label>`).join('')}</div>`).join('')}
    <div class="card"><h3>🗣️ Handige zinnetjes</h3>${PHRASES.map(p=>`<div class="phr"><b>${esc(p[0])}</b><span class="jp">${p[1]}</span><small>${esc(p[2])}</small></div>`).join('')}</div>
    <div class="card"><h3>📱 Apps voor onderweg</h3>${APPS.map(a=>`<div class="spot"><div class="e">${a[0]}</div><div><b>${esc(a[1])}</b><p>${esc(a[2])}</p></div></div>`).join('')}</div>
    <div class="card" style="grid-column:1/-1"><h3>🎌 Etiquette & goed om te weten</h3><div class="pgrid2">${RULES.map(a=>`<div class="spot"><div class="e">${a[0]}</div><div><b>${esc(a[1])}</b><p>${esc(a[2])}</p></div></div>`).join('')}</div></div>
  </div>`;
  document.querySelectorAll('.chk input').forEach(c => c.onchange = () => { done[c.dataset.id] = c.checked; store.set('jp27-check', done); renderGids(); if (c.checked) toast('Afgevinkt ✓'); });
}

/* ============ ROUTER ============ */
let curView = '';
function route_(){
  const h = (location.hash||'#reis').slice(1);
  let v = h, arg = null;
  if (/^dag-\d+$/.test(h)){ v='dag'; arg=+h.slice(4); }
  else if (/^plaats-[a-z0-9]+$/.test(h)){ v='plaats'; arg=h.slice(7); }
  if (!['reis','dagen','dag','plaatsen','plaats','budget','gids'].includes(v)) v='reis';
  clearMaps();
  document.querySelectorAll('.view').forEach(e => e.classList.remove('on'));
  $('#v-'+v).classList.add('on');
  const navKey = v==='dag' ? 'dagen' : v==='plaats' ? 'plaatsen' : v;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v===navKey));
  curView = v;
  if (v==='reis'){ if (!globe) initGlobe(); else { globe.resize(); globe.setOption({globe:{viewControl:{autoRotate:spinning}}}); } }
  else { if (globe) globe.setOption({globe:{viewControl:{autoRotate:false}}}); stopTour(); }
  if (v==='dagen') renderDagen();
  if (v==='dag') renderDag(arg);
  if (v==='plaatsen') renderPlaatsen();
  if (v==='plaats') renderPlaats(arg);
  if (v==='budget') renderBudget();
  if (v==='gids') renderGids();
  if (v!=='reis') $('#v-'+v).scrollTop = 0;
}
addEventListener('hashchange', route_);
addEventListener('keydown', e => {
  if (curView!=='dag') return; const n = +location.hash.slice(5);
  if (e.key==='ArrowRight' && n<DAYS.length) location.hash='dag-'+(n+1);
  if (e.key==='ArrowLeft' && n>1) location.hash='dag-'+(n-1);
});
/* swipe on day pages */
(function(){ let x0=null,y0=null; const el=$('#v-dag');
  el.addEventListener('touchstart', e=>{ if(e.target.closest('.map,.dstrip')) return; x0=e.touches[0].clientX; y0=e.touches[0].clientY; }, {passive:true});
  el.addEventListener('touchend', e=>{ if(x0===null) return; const dx=e.changedTouches[0].clientX-x0, dy=e.changedTouches[0].clientY-y0; x0=null;
    if (Math.abs(dx)>80 && Math.abs(dx)>Math.abs(dy)*1.8){ const n=+location.hash.slice(5); if(dx<0&&n<DAYS.length) location.hash='dag-'+(n+1); if(dx>0&&n>1) location.hash='dag-'+(n-1); } }, {passive:true});
})();
route_();
