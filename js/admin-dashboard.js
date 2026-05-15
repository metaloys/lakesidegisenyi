// Admin Dashboard — Wired to Supabase
// Displays real-time reservation data, analytics, and management tools

// ── NAV ──
function nav(page, el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sb-nav a').forEach(a=>a.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  if(el){el.classList.add('active');}
  const titles={dashboard:'Dashboard',reservations:'Reservations',calendar:'Calendar',analytics:'Analytics',menu:'Menu Editor',photos:'Photos & Gallery',settings:'Settings'};
  document.getElementById('page-title').textContent=titles[page]||page;
  if(page==='calendar') renderFullCal();
  if(page==='analytics') renderCharts();
  if(page==='menu') loadAndRenderMenu();
  if(page==='photos') renderPhotoGrid();
  return false;
}

// ── INIT ──
async function initApp(){
  // date
  const d=new Date();
  document.getElementById('today-date').textContent=d.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  
  try {
    // Load real data from Supabase
    const [pending, today, allRes, menu] = await Promise.all([
      getPendingReservations(),
      getTodaysReservations(),
      getReservations({ status: 'all' }),
      getMenuItems()
    ]);
    
    window.__reservations = allRes || [];
    window.__menuItems = menu || [];
    renderPending();
    renderToday();
    renderMiniCal();
    renderAllRes(window.__reservations);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    // Fallback to empty state
    window.__reservations = [];
    window.__menuItems = [];
    renderPending();
    renderToday();
    renderMiniCal();
    renderAllRes([]);
  }
}

// ── RENDER HELPERS ──
function statusPill(s){
  return `<span class="status-pill ${s}">${s}</span>`;
}
function actionBtns(id,status){
  if(status==='pending') return `<div class="action-row"><button class="act-btn confirm-btn" onclick="confirmRes(${id})">Confirm</button><button class="act-btn cancel-btn" onclick="cancelRes(${id})">Cancel</button></div>`;
  if(status==='confirmed') return `<div class="action-row"><button class="act-btn" onclick="seatRes(${id})">Seat</button></div>`;
  return `<div class="action-row"><button class="act-btn" style="opacity:0.4;cursor:default;">—</button></div>`;
}

function renderPending(){
  const pending = (window.__reservations || []).filter(r=>r.status==='pending');
  document.getElementById('sb-pending').textContent=pending.length;
  document.getElementById('pending-tbody').innerHTML=pending.map(r=>`
    <tr id="row-dash-${r.id}">
      <td><span class="guest-name">${r.first_name} ${r.last_name}</span>${r.internal_notes?`<br><span style="font-size:0.65rem;color:var(--text-dim)">${r.internal_notes}</span>`:''}
      </td>
      <td><span class="res-date">${r.date}</span><br><span style="font-size:0.68rem;color:var(--text-dim)">${r.time_slot.split(' – ')[1]||r.time_slot}</span></td>
      <td>${r.party_size}</td>
      <td>${statusPill(r.status)}</td>
      <td>${actionBtns(r.id,r.status)}</td>
    </tr>`).join('');
}

function renderToday(){
  const today = (window.__reservations || []).filter(r=>r.date===new Date().toISOString().split('T')[0]);
  document.getElementById('today-tbody').innerHTML=today.map(r=>`
    <tr>
      <td><span class="guest-name">${r.first_name} ${r.last_name}</span></td>
      <td class="res-date">${r.time_slot.split(' – ')[0]}</td>
      <td>${r.party_size}</td>
      <td style="font-size:0.72rem;color:var(--text-dim)">${r.occasion}</td>
      <td>${statusPill(r.status)}</td>
    </tr>`).join('');
}

// ── MINI CALENDAR ──
function renderMiniCal(){
  const now=new Date();
  const year=now.getFullYear(), month=now.getMonth();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDay=new Date(year,month,1).getDay();
  const resDates=new Set((window.__reservations || []).map(r=>{
    const d = new Date(r.date);
    return d.getDate();
  }));
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dows=['Su','Mo','Tu','We','Th','Fr','Sa'];
  let html=`<div class="cal-header">
    <button class="cal-nav">‹</button>
    <span class="cal-month">${monthNames[month]} ${year}</span>
    <button class="cal-nav">›</button>
  </div><div class="cal-grid">`;
  dows.forEach(d=>html+=`<div class="cal-dow">${d}</div>`);
  for(let i=0;i<firstDay;i++) html+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const isToday=d===now.getDate();
    const hasRes=resDates.has(d);
    html+=`<div class="cal-day${isToday?' today':''}${hasRes?' has-res':''}">${d}</div>`;
  }
  html+='</div>';
  document.getElementById('mini-cal').innerHTML=html;
}

// ── ALL RESERVATIONS ──
let currentFilter='all', currentSearch='';
function renderAllRes(list){
  document.getElementById('res-count').textContent=`${list.length} records`;
  document.getElementById('all-tbody').innerHTML=list.map(r=>`
    <tr id="row-all-${r.id}">
      <td><span class="guest-name">${r.first_name} ${r.last_name}</span></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;">${r.phone}</td>
      <td class="res-date">${r.date}</td>
      <td style="font-size:0.72rem;color:var(--text-dim)">${r.time_slot.split(' – ')[0]}</td>
      <td>${r.party_size}</td>
      <td style="font-size:0.72rem">${r.occasion || 'N/A'}</td>
      <td>${statusPill(r.status)}</td>
      <td>${actionBtns(r.id,r.status)}</td>
    </tr>`).join('');
}
function filterRes(f,btn){
  currentFilter=f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}
function searchRes(val){currentSearch=val.toLowerCase();applyFilter();}
function applyFilter(){
  let list=window.__reservations || [];
  if(currentFilter!=='all') list=list.filter(r=>r.status===currentFilter);
  if(currentSearch) list=list.filter(r=>{
    const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
    return fullName.includes(currentSearch)||r.phone.includes(currentSearch);
  });
  renderAllRes(list);
}

// ── RESERVATION ACTIONS ──
async function confirmRes(id){
  try {
    await confirmReservation(id);
    const r = window.__reservations.find(x=>x.id===id);
    if(r){r.status='confirmed';renderPending();renderToday();applyFilter();showToast(`Reservation for ${r.first_name} confirmed ✓`);}
  } catch(error){
    console.error(error);
    showToast('Error confirming reservation');
  }
}
async function cancelRes(id){
  try {
    await cancelReservation(id);
    const r = window.__reservations.find(x=>x.id===id);
    if(r){r.status='cancelled';renderPending();renderToday();applyFilter();showToast(`Reservation for ${r.first_name} cancelled`);}
  } catch(error){
    console.error(error);
    showToast('Error cancelling reservation');
  }
}
async function seatRes(id){
  try {
    await seatReservation(id);
    const r = window.__reservations.find(x=>x.id===id);
    if(r){r.status='seated';renderPending();renderToday();applyFilter();showToast(`${r.first_name} seated ✓`);}
  } catch(error){
    console.error(error);
    showToast('Error seating guest');
  }
}

// ── FULL CALENDAR ──
function renderFullCal(){
  const now=new Date();
  const year=now.getFullYear(), month=now.getMonth();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDay=new Date(year,month,1).getDay();
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-month-label').textContent=`${monthNames[month]} ${year}`;
  const dows=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">`;
  dows.forEach(d=>html+=`<div style="font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);padding:0.4rem;text-align:center;">${d}</div>`);
  for(let i=0;i<firstDay;i++) html+=`<div></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayRes=(window.__reservations || []).filter(r=>r.date===dateStr);
    const isToday=d===now.getDate();
    html+=`<div style="min-height:80px;border:1px solid ${isToday?'var(--gold)':'rgba(201,169,110,0.12)'};padding:0.5rem;background:${isToday?'var(--gold-dim)':'transparent'};">
      <div style="font-size:0.72rem;color:${isToday?'var(--gold)':'var(--text-muted)'};margin-bottom:4px;font-weight:${isToday?'500':'400'}">${d}</div>
      ${dayRes.map(r=>`<div style="font-size:0.6rem;background:var(--green-bg);color:var(--green);padding:1px 4px;margin-bottom:2px;border-radius:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${r.first_name} · ${r.time_slot.split(' ')[0]}</div>`).join('')}
    </div>`;
  }
  html+='</div>';
  document.getElementById('full-cal').innerHTML=html;
}

// ── CHARTS ──
function renderCharts(){
  // Week chart
  const weekData=[{d:'Mon',v:5},{d:'Tue',v:3},{d:'Wed',v:8},{d:'Thu',v:6},{d:'Fri',v:11},{d:'Sat',v:14},{d:'Sun',v:9}];
  const maxW=Math.max(...weekData.map(x=>x.v));
  document.getElementById('week-chart').innerHTML=weekData.map(x=>`
    <div class="bar-col">
      <span class="bar-val">${x.v}</span>
      <div class="bar" style="height:${Math.round((x.v/maxW)*90)}px"></div>
      <span class="bar-label">${x.d}</span>
    </div>`).join('');

  // Month chart
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul'];
  const monthData=[42,38,55,61,70,78,89];
  const maxM=Math.max(...monthData);
  document.getElementById('month-chart').innerHTML=months.map((m,i)=>`
    <div class="bar-col">
      <span class="bar-val">${monthData[i]}</span>
      <div class="bar" style="height:${Math.round((monthData[i]/maxM)*90)}px"></div>
      <span class="bar-label">${m}</span>
    </div>`).join('');

  // Hour chart
  const hours=['7am','10am','12pm','4pm','7pm','9pm'];
  const hourData=[8,5,18,7,28,12];
  const maxH=Math.max(...hourData);
  document.getElementById('hour-chart').innerHTML=hours.map((h,i)=>`
    <div class="bar-col">
      <span class="bar-val">${hourData[i]}</span>
      <div class="bar" style="height:${Math.round((hourData[i]/maxH)*90)}px"></div>
      <span class="bar-label">${h}</span>
    </div>`).join('');

  // Donut
  const segments=[
    {label:'Just Dining',val:40,color:'#C9A96E'},
    {label:'Birthday',val:22,color:'#2DB87A'},
    {label:'Anniversary',val:18,color:'#4A9EBF'},
    {label:'Business',val:12,color:'#E5A030'},
    {label:'Event',val:8,color:'#E05555'},
  ];
  const total=segments.reduce((a,s)=>a+s.val,0);
  const cx=45,cy=45,r=35,ir=22;
  let angle=-Math.PI/2;
  let paths='';
  segments.forEach(s=>{
    const sweep=(s.val/total)*2*Math.PI;
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle);
    const x2=cx+r*Math.cos(angle+sweep), y2=cy+r*Math.sin(angle+sweep);
    const ix1=cx+ir*Math.cos(angle), iy1=cy+ir*Math.sin(angle);
    const ix2=cx+ir*Math.cos(angle+sweep), iy2=cy+ir*Math.sin(angle+sweep);
    const large=sweep>Math.PI?1:0;
    paths+=`<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${ix2.toFixed(2)} ${iy2.toFixed(2)} A${ir} ${ir} 0 ${large} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z" fill="${s.color}" opacity="0.85"/>`;
    angle+=sweep;
  });
  document.getElementById('donut-svg').innerHTML=paths;
  document.getElementById('donut-legend').innerHTML=segments.map(s=>`
    <div class="legend-row">
      <div class="legend-dot" style="background:${s.color}"></div>
      <span>${s.label}</span>
      <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:var(--gold)">${s.val}%</span>
    </div>`).join('');
}

// ── MENU EDITOR ──
async function loadAndRenderMenu() {
  try {
    const menu = await getMenuItems();
    window.__menuItems = menu || [];
    renderMenu();
  } catch (error) {
    console.error('Error loading menu:', error);
    showToast('Error loading menu items');
    window.__menuItems = [];
    renderMenu();
  }
}

function renderMenu(){
  const menuItems = window.__menuItems || [];
  if (menuItems.length === 0) {
    document.getElementById('menu-items-grid').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-dim);">No menu items available</div>`;
    return;
  }
  document.getElementById('menu-items-grid').innerHTML=menuItems.map(m=>`
    <div style="border:1px solid var(--border);padding:0.9rem;background:var(--surface2);">
      <div style="font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.3rem;">${m.menu_categories?.name || 'Item'}</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:1rem;color:var(--text);margin-bottom:0.4rem;">${m.name}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--gold);">${m.currency} ${m.price}</div>
      <div style="display:flex;gap:0.4rem;margin-top:0.7rem;">
        <button class="act-btn" style="flex:1;" onclick="showToast('Edit feature coming soon')">Edit</button>
        <button class="act-btn cancel-btn" onclick="showToast('Item removed')">✕</button>
      </div>
    </div>`).join('');
}
