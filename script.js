// ==========================================================================
// AURIS — SCRIPT.JS  (iOS 18 design rewrite, logic preserved)
// ==========================================================================

// ── DOM ────────────────────────────────────────────────
const DOM = {
  appContent:  document.getElementById('appContent'),
  pageContent: document.getElementById('pageContent'),
  skelScreen:  document.getElementById('skelScreen'),
  errorCard:   document.getElementById('errorCard'),
  errorMsg:    document.getElementById('errorMsg'),
  headerTitle: document.getElementById('headerTitle'),
  headerSub:   document.getElementById('headerSub'),
  kmBadge:     document.getElementById('kmBadge'),
  kmBadgeVal:  document.getElementById('kmBadgeVal'),
  tabs:        document.querySelectorAll('.tab'),
};

// ── CONSTANTS ──────────────────────────────────────────
const TITLE_MAP = {
  home:     'Главная',
  fuel:     'Топливо',
  service:  'Обслуживание',
  addfuel:  'Добавить запись',
  settings: 'Настройки',
};

const GAS_BASE_URL = 'https://script.google.com/macros/s/AKfycbxLYT5b2qCLXK8iLtSz-48kimWcjGYfI6r31s3sJMjPJljrVMuJqmuNIswJ7RnjiTmG/exec';

// ── UTILS ──────────────────────────────────────────────
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function parseCustomDate(ds) {
  if (!ds) return new Date(NaN);
  const p = ds.trim().split('.');
  if (p.length !== 3) return new Date(NaN);
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}

function formatDate(ds) {
  if (!ds) return '—';
  const m = { '01':'ЯНВ','02':'ФЕВ','03':'МАР','04':'АПР','05':'МАЯ','06':'ИЮН',
               '07':'ИЮЛ','08':'АВГ','09':'СЕН','10':'ОКТ','11':'НОЯ','12':'ДЕК' };
  try {
    const [d, mo, y] = ds.split('.');
    return `${d} ${m[mo] || mo} ${y}`;
  } catch { return ds; }
}

function getWeekStart(date, weeksBack = 0) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) - weeksBack * 7;
  const ws = new Date(date); ws.setDate(diff); ws.setHours(0,0,0,0);
  return ws;
}

function isDateInRange(ds, s, e) {
  if (!ds) return false;
  try {
    const [d, m, y] = ds.split('.');
    const dt = new Date(+y, +m-1, +d); dt.setHours(23,59,59,999);
    return dt >= s && dt <= e;
  } catch { return false; }
}

function groupByMonth(data) {
  const groups = {};
  [...data].sort((a,b) => parseCustomDate(b.date) - parseCustomDate(a.date))
    .forEach(item => {
      const date = parseCustomDate(item.date);
      if (isNaN(date)) return;
      const key = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
  return groups;
}

// SVG chevron helper
const CHV = `<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="1 1 7 7 1 13"/></svg>`;

// ── UI STATE ───────────────────────────────────────────
function showSkeleton() {
  DOM.skelScreen.classList.remove('hidden');
  DOM.pageContent.style.opacity = '0';
  DOM.errorCard.style.display = 'none';
}

function hideSkeleton() {
  DOM.skelScreen.classList.add('hidden');
  DOM.pageContent.style.opacity = '1';
}

function showError(msg) {
  DOM.skelScreen.classList.add('hidden');
  DOM.errorCard.style.display = 'flex';
  DOM.errorMsg.textContent = msg;
}

function setActiveTab(page) {
  const p = page || 'home';
  DOM.tabs.forEach(t => t.classList.remove('active'));
  const active = document.querySelector(`.tab[data-page="${p}"]`);
  if (active) active.classList.add('active');

  DOM.headerTitle.textContent = TITLE_MAP[p] || p;
}

// ── LOAD DATA ──────────────────────────────────────────
async function loadData() {
  const page = getQueryParam('page') || 'home';
  setActiveTab(page);
  DOM.kmBadge.style.display = 'none';

  // Destroy old chart if navigating away
  if (typeof destroyFuelChart === 'function') destroyFuelChart();

  const cacheKey = `cache_v2_${page}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      const data = JSON.parse(cached);
      hideSkeleton();
      renderByPage(page, data);
    } catch(e) { showSkeleton(); }
  } else {
    showSkeleton();
  }

  try {
    const res = await fetch(`${GAS_BASE_URL}?page=${page}`);
    if (!res.ok) throw new Error(`Ошибка ${res.status}`);
    const data = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify(data));
    hideSkeleton();
    renderByPage(page, data);
  } catch(err) {
    if (!cached) showError(err.message);
    else hideSkeleton(); // keep showing cached
  }
}

function renderByPage(page, data) {
  DOM.errorCard.style.display = 'none';
  const map = {
    home:     renderHome,
    fuel:     renderFuel,
    addfuel:  renderAddFuel,
    service:  renderService,
    settings: renderSettings,
  };
  DOM.pageContent.innerHTML = '';
  (map[page] || renderPlaceholder)(data);
}

// ── HOME ───────────────────────────────────────────────
function renderHome(data) {
  if (!data || typeof data !== 'object') return;

  // Show km in header
  if (data.endKm) {
    DOM.kmBadge.style.display = 'flex';
    DOM.kmBadgeVal.textContent = Number(data.endKm).toLocaleString('ru') + ' км';
  }

  const urgency = (km) => {
    if (!km) return 'accent';
    const n = parseInt(km);
    if (n < 1000) return 'red';
    if (n < 3000) return 'orange';
    return 'green';
  };

  const oilKm = data.nextOilChange;
  const diagKm = data.nextDiagnostic;
  const insur  = data.insuranceEnds;
  const gboKm  = data.gasServiceDue;

  DOM.pageContent.innerHTML = `
    <div class="anim">

      <!-- Hero -->
      <div class="hero blue">
        <div class="hero-lbl">Текущий пробег</div>
        <div class="hero-val">${data.endKm ? Number(data.endKm).toLocaleString('ru') : '—'} <span class="hero-unit">км</span></div>
        <div class="hero-sub">за период наблюдения ${data.distance || '—'} км</div>
        <div class="hero-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </div>
      </div>

      <!-- Mini stats -->
      <div class="mini-grid">
        <div class="mini">
          <div class="mini-lbl">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            До ТО
          </div>
          <div class="mini-val">${data.nextDiagnostic || '—'}<span class="u"> км</span></div>
          <div class="mini-sub">следующая диагностика</div>
        </div>
        <div class="mini">
          <div class="mini-lbl">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            Топливо / нед.
          </div>
          <div class="mini-val">${data.weeklyFuelCost || '—'}<span class="u"> zł</span></div>
          <div class="mini-sub">${data.weeklyFuelPeriod || 'текущая неделя'}</div>
        </div>
        <div class="mini">
          <div class="mini-lbl">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg>
            Всего расходов
          </div>
          <div class="mini-val">${data.totalCost !== undefined ? String(data.totalCost).replace(/\s*zł\s*$/i,'') : '—'}<span class="u"> zł</span></div>
          <div class="mini-sub">за всё время</div>
        </div>
        <div class="mini" onclick="location.href='?page=fuel'" style="cursor:pointer">
          <div class="mini-lbl">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.5" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
            Последняя заправка
          </div>
          <div class="mini-val" id="homeLastFuelVal">—</div>
          <div class="mini-sub" id="homeLastFuelSub">загрузка…</div>
        </div>
      </div>

      <!-- Reminders -->
      <div class="slbl">Ближайшие сроки</div>
      <div class="group" style="padding: 16px">
        <div class="reminders-row">
          <div class="reminder-item">
            <div class="reminder-circle ${urgency(oilKm)}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3h18v4H3z"/><path d="M3 7l2 14h14l2-14"/><path d="M12 11v6"/><path d="M9 11v6"/><path d="M15 11v6"/></svg>
            </div>
            <div class="reminder-val">${oilKm || '—'} км</div>
            <div class="reminder-name">Масло</div>
          </div>
          <div class="reminder-item">
            <div class="reminder-circle ${urgency(diagKm)}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div class="reminder-val">${diagKm || '—'} км</div>
            <div class="reminder-name">Диагностика</div>
          </div>
          <div class="reminder-item">
            <div class="reminder-circle ${insur && parseInt(insur) < 30 ? 'red' : insur && parseInt(insur) < 60 ? 'orange' : 'green'}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="reminder-val">${insur || '—'} дн.</div>
            <div class="reminder-name">Страховка</div>
          </div>
          <div class="reminder-item">
            <div class="reminder-circle ${urgency(gboKm)}">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-gas-station"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0v-7l-3 -3" /><path d="M4 20v-14a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v14" /><path d="M3 20l12 0" /><path d="M18 7v1a1 1 0 0 0 1 1h1" /><path d="M4 11l10 0" /></svg>
            </div>
            <div class="reminder-val">${gboKm || '—'} км</div>
            <div class="reminder-name">ГБО</div>
          </div>
          <div class="reminder-item">
            <div class="reminder-circle accent">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            </div>
            <div class="reminder-val">${data.nextGearboxOilChange || '—'} км</div>
            <div class="reminder-name">КПП</div>
          </div>
        </div>
      </div>

      <!-- Sparkline: 7 последних газовых записей -->
      <div class="slbl">Тренд расхода газа · 7 заправок</div>
      <div class="group" style="padding:14px 16px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:12px;color:var(--text2)">последние 7 газовых заправок</span>
          <span style="font-size:12px;color:var(--text2);font-weight:600" id="homeSparkAvg"></span>
        </div>
        <div id="homeSparkWrap" style="position:relative">
          <svg id="homeSparkSvg" width="100%" height="80" style="display:block;overflow:visible"></svg>
          <div id="homeSparkEmpty" style="display:none;text-align:center;padding:20px 0;font-size:13px;color:var(--text2)">Нет данных о расходе</div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="slbl">Быстрый доступ</div>
      <div class="group">
        <div class="row" onclick="location.href='?page=addfuel'" style="cursor:pointer">
          <div class="row-icon" style="background:var(--accent-bg)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <div class="row-body"><div class="row-title">Добавить заправку</div></div>
          <div class="row-right"><div class="chevron">${CHV}</div></div>
        </div>
        <div class="row" onclick="location.href='?page=fuel'" style="cursor:pointer">
          <div class="row-icon" style="background:var(--orange-bg)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 22h18"/><path d="M7 14h4"/><path d="M7 10h4"/></svg>
          </div>
          <div class="row-body"><div class="row-title">История заправок</div></div>
          <div class="row-right"><div class="chevron">${CHV}</div></div>
        </div>
        <div class="row" onclick="location.href='?page=service'" style="cursor:pointer">
          <div class="row-icon" style="background:var(--green-bg)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <div class="row-body"><div class="row-title">Обслуживание и ремонт</div></div>
          <div class="row-right"><div class="chevron">${CHV}</div></div>
        </div>
      </div>

    </div>
  `;

  _populateHomeFromFuelCache();
}

// ── HOME HELPERS ──────────────────────────────────────────────
function n(val) {
  if (val === null || val === undefined || val === '') return NaN;
  return parseFloat(String(val).replace(',', '.'));
}

function _populateHomeFromFuelCache() {
  try {
    const raw = localStorage.getItem('cache_v2_fuel');
    if (!raw) return;
    const fuelData = JSON.parse(raw);
    if (!Array.isArray(fuelData) || !fuelData.length) return;

    const sorted = [...fuelData].sort((a,b) => parseCustomDate(b.date) - parseCustomDate(a.date));
    const last   = sorted[0];
    const valEl  = document.getElementById('homeLastFuelVal');
    const subEl  = document.getElementById('homeLastFuelSub');
    if (valEl && last) {
      const isGas = (last.fuelType||'').toLowerCase().includes('газ');
      valEl.innerHTML = (last.fuelAmount || '—') + '<span class="u"> л</span>';
      valEl.style.color = isGas ? 'var(--orange)' : 'var(--red)';
      if (subEl) subEl.textContent = formatDate(last.date) + ' · ' + (last.totalCost || '—') + ' zł';
    }

    _drawHomeSparkline(fuelData);
  } catch(err) { console.warn('home cache:', err); }
}

function _drawHomeSparkline(fuelData) {
  const svgEl   = document.getElementById('homeSparkSvg');
  const emptyEl = document.getElementById('homeSparkEmpty');
  const avgEl   = document.getElementById('homeSparkAvg');
  if (!svgEl) return;

  const gasAll = fuelData
    .filter(function(e) { return (e.fuelType||'').toLowerCase().includes('газ') && n(e.fuelConsumption) > 0; })
    .sort(function(a,b) { return parseCustomDate(a.date) - parseCustomDate(b.date); });

  if (gasAll.length < 2) {
    svgEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  const last7  = gasAll.slice(-7);
  const points = last7.map(function(e) { return n(e.fuelConsumption); });
  const avg    = points.reduce(function(a,b){return a+b;}, 0) / points.length;
  const minPt  = Math.min.apply(null, points);
  const maxPt  = Math.max.apply(null, points);

  if (avgEl) avgEl.textContent = 'ср. ' + avg.toFixed(2) + ' л/100';

  const wrap = svgEl.parentElement;
  const W  = (wrap && wrap.clientWidth > 0 ? wrap.clientWidth : 280);
  const H  = 80, pL = 6, pR = 6, pT = 14, pB = 22;
  const cW = W - pL - pR, cH = H - pT - pB;
  const yPad = (maxPt - minPt) < 0.2 ? 0.5 : 0.3;
  const minV = minPt - yPad, maxV = maxPt + yPad;
  const xS = function(i) { return pL + (last7.length < 2 ? cW/2 : i / (last7.length-1) * cW); };
  const yS = function(v)  { return pT + cH - ((v - minV) / (maxV - minV)) * cH; };

  const ns = 'http://www.w3.org/2000/svg';
  const mk = function(tag, at) {
    var el = document.createElementNS(ns, tag);
    Object.keys(at).forEach(function(k){ el.setAttribute(k, at[k]); });
    return el;
  };

  svgEl.innerHTML = '';
  svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svgEl.setAttribute('width', W);

  // Gradient
  var defs = document.createElementNS(ns, 'defs');
  var grad = document.createElementNS(ns, 'linearGradient');
  grad.id = 'hsg'; grad.setAttribute('x1','0'); grad.setAttribute('y1','0');
  grad.setAttribute('x2','0'); grad.setAttribute('y2','1');
  [['0%','0.20'],['100%','0']].forEach(function(pair) {
    var s = document.createElementNS(ns,'stop');
    s.setAttribute('offset', pair[0]); s.setAttribute('stop-color','var(--accent)');
    s.setAttribute('stop-opacity', pair[1]); grad.appendChild(s);
  });
  defs.appendChild(grad); svgEl.appendChild(defs);

  // Area
  var aD = 'M' + xS(0) + ',' + yS(minV) + ' ' +
    points.map(function(v,i){ return 'L' + xS(i) + ',' + yS(v); }).join(' ') +
    ' L' + xS(last7.length-1) + ',' + yS(minV) + ' Z';
  svgEl.appendChild(mk('path', {d: aD, fill: 'url(#hsg)'}));

  // Avg dashed
  svgEl.appendChild(mk('line', {x1:pL, x2:W-pR, y1:yS(avg), y2:yS(avg),
    stroke:'var(--orange)', 'stroke-width':'1.2', 'stroke-dasharray':'4 3', opacity:'0.7'}));

  // Line
  svgEl.appendChild(mk('polyline', {
    points: points.map(function(v,i){ return xS(i)+','+yS(v); }).join(' '),
    fill:'none', stroke:'var(--accent)', 'stroke-width':'2',
    'stroke-linecap':'round', 'stroke-linejoin':'round'
  }));

  // Dots + labels + dates
  last7.forEach(function(entry, i) {
    var cx = xS(i), cy = yS(points[i]), val = points[i];
    var dotColor = val < 6.3 ? 'var(--green)' : val < 7.5 ? 'var(--accent)' : 'var(--red)';

    svgEl.appendChild(mk('circle', {cx:cx, cy:cy, r:'5',
      fill:dotColor, stroke:'var(--grouped)', 'stroke-width':'2.5'}));

    var lblY = i % 2 === 0 ? cy - 8 : cy + 17;
    var lbl = mk('text', {x:cx, y:lblY, fill:dotColor, 'font-size':'9.5',
      'text-anchor':'middle', 'font-family':'-apple-system', 'font-weight':'600'});
    lbl.textContent = val.toFixed(1);
    svgEl.appendChild(lbl);

    var shortDate = entry.date ? entry.date.slice(0,5) : '';
    var dateLbl = mk('text', {x:cx, y:H-4, fill:'var(--text2)', 'font-size':'8.5',
      'text-anchor':'middle', 'font-family':'-apple-system'});
    dateLbl.textContent = shortDate;
    svgEl.appendChild(dateLbl);
  });
}

// ── FUEL ───────────────────────────────────────────────
function renderFuel(data) {
  if (!Array.isArray(data)) return;
  const sorted = [...data].reverse();
  const latest = sorted[0] || {};
  const avgGas = calculateAverageConsumption(sorted);

  // ── Compute stats from raw data ──────────────────────
  // Total fuel cost (all records)
  const totalFuelCost = data.reduce((s, e) => s + (parseFloat(e.totalCost) || 0), 0);
  const totalFills    = data.length;

  // Weekly fuel cost
  const now    = new Date();
  const ws     = getWeekStart(now);
  const we     = new Date(ws); we.setDate(ws.getDate()+6); we.setHours(23,59,59,999);
  const weekFills = data.filter(e => isDateInRange(e.date, ws, we));
  const weekCost  = weekFills.reduce((s,e) => s + (parseFloat(e.totalCost)||0), 0);

  // Prev week fallback
  let weekCostDisplay = weekCost > 0 ? weekCost.toFixed(0) : null;
  let weekLabel = 'текущая неделя';
  if (!weekCostDisplay) {
    const ps = getWeekStart(now, 1);
    const pe = new Date(ps); pe.setDate(ps.getDate()+6); pe.setHours(23,59,59,999);
    const prevFills = data.filter(e => isDateInRange(e.date, ps, pe));
    const prevCost  = prevFills.reduce((s,e) => s + (parseFloat(e.totalCost)||0), 0);
    weekCostDisplay = prevCost > 0 ? prevCost.toFixed(0) : '—';
    weekLabel = 'прошлая неделя';
  }

  // Cost per km: gas vs petrol
  const gasData    = data.filter(e => (e.fuelType||'').toLowerCase().includes('газ'));
  const petrolData = data.filter(e => (e.fuelType||'').toLowerCase().includes('бензин') || (e.fuelType||'').toLowerCase().includes('petrol'));

  // Avg gas consumption (last 5 with valid consumption)
  const gasWithCons = gasData.filter(e => parseFloat(e.fuelConsumption) > 0);
  const last5gas    = gasWithCons.slice(-5);
  const avgGasCons  = last5gas.length
    ? (last5gas.reduce((s,e) => s + parseFloat(e.fuelConsumption), 0) / last5gas.length)
    : null;

  // Avg petrol consumption (last entries with valid consumption)
  const petrolWithCons = petrolData.filter(e => parseFloat(e.fuelConsumption) > 0);
  const last5petrol    = petrolWithCons.slice(-5);
  const avgPetrolCons  = last5petrol.length
    ? (last5petrol.reduce((s,e) => s + parseFloat(e.fuelConsumption), 0) / last5petrol.length)
    : 9.5; // reasonable default if no petrol consumption data

  // Price per litre: gas (avg last 5 fills)
  const last5gasFills = gasData.slice(-5);
  const avgGasPrice   = last5gasFills.length
    ? (last5gasFills.reduce((s,e) => s + (parseFloat(e.pricePerLiter)||0), 0) / last5gasFills.filter(e => parseFloat(e.pricePerLiter) > 0).length)
    : null;

  // Price per litre: petrol (avg last 5 fills)
  const last5petrolFills = petrolData.slice(-5);
  const petrolPrices = last5petrolFills.filter(e => parseFloat(e.pricePerLiter) > 0);
  const avgPetrolPrice = petrolPrices.length
    ? (petrolPrices.reduce((s,e) => s + parseFloat(e.pricePerLiter), 0) / petrolPrices.length)
    : null;

  // Cost per 100 km
  const costGasPer100    = (avgGasCons && avgGasPrice)
    ? (avgGasCons * avgGasPrice).toFixed(2) : null;
  const costPetrolPer100 = avgPetrolCons
    ? (avgPetrolCons * (avgPetrolPrice || 6.0)).toFixed(2) : null;

  // Cost per km
  const costPerKmGas    = costGasPer100    ? (parseFloat(costGasPer100) / 100).toFixed(2)    : '0.17';
  const costPerKmPetrol = costPetrolPer100 ? (parseFloat(costPetrolPer100) / 100).toFixed(2) : '0.35';

  // Savings per 100 km
  const savings = (costGasPer100 && costPetrolPer100)
    ? (parseFloat(costPetrolPer100) - parseFloat(costGasPer100)).toFixed(2)
    : null;

  DOM.pageContent.innerHTML = `
    <div class="anim">

      <!-- ① HERO: Всего на топливо -->
      <div class="hero orange">
        <div class="hero-lbl">Всего на топливо</div>
        <div class="hero-val">${Math.round(totalFuelCost).toLocaleString('ru')} <span class="hero-unit">zł</span></div>
        <div class="hero-sub">${totalFills} заправок за весь период</div>
        <div class="hero-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M17 12h1a2 2 0 0 1 2 2v1a2 2 0 0 0 4 0V9l-3-3"/><path d="M3 22h18"/><path d="M7 14h4"/><path d="M7 10h4"/></svg>
        </div>
      </div>

      <!-- ② ROW 1: Последняя заправка + Топливо за неделю -->
      <div class="mini-grid">
        <div class="mini">
          <div class="mini-lbl">Последняя заправка</div>
          <div class="mini-val">${latest.fuelAmount || '—'}<span class="u"> л</span></div>
          <div class="mini-sub">${formatDate(latest.date)} · ${latest.totalCost || '—'} zł</div>
        </div>
        <div class="mini">
          <div class="mini-lbl">Топливо / нед.</div>
          <div class="mini-val">${weekCostDisplay}<span class="u"> zł</span></div>
          <div class="mini-sub">${weekLabel}</div>
        </div>
      </div>

      <!-- ③ ROW 2: Средний расход газ + 1 км на газе -->
      <div class="mini-grid">
        <div class="mini">
          <div class="mini-lbl">Средний расход (газ)</div>
          <div class="mini-val">${avgGas}<span class="u"> л/100</span></div>
          <div class="mini-sub">последние заправки</div>
        </div>
        <div class="mini">
          <div class="mini-lbl">1 км на газе</div>
          <div class="mini-val">${costPerKmGas}<span class="u"> zł</span></div>
          <div class="mini-sub">vs ${costPerKmPetrol} zł на бензине</div>
        </div>
      </div>

      <!-- ④ ROW 3: Запас хода + Всего заправок -->
      <div class="mini-grid">
        <div class="mini">
          <div class="mini-lbl">Запас хода</div>
          <div class="mini-val"><span id="fuelRangeKm">—</span><span class="u"> км</span></div>
          <div class="mini-sub" id="fuelRangeDetails">при полном баке (34 л)</div>
        </div>
        <div class="mini">
          <div class="mini-lbl">Всего заправок</div>
          <div class="mini-val">${totalFills}<span class="u"> шт</span></div>
          <div class="mini-sub">газ: ${gasData.length} · бензин: ${petrolData.length}</div>
        </div>
      </div>

      <!-- ⑤ ТРЕНД: SVG chart как в Auris iOS -->
      <div class="slbl">Средний расход л/100 км по месяцам</div>
      <div class="group" style="padding:16px">
        <div class="chart-wrap" id="svgChartWrap">
          <svg class="chart-svg" id="svgConsChart" height="160"></svg>
          <div class="chart-tooltip" id="svgChartTip"></div>
        </div>
        <div class="chart-legend" style="margin-top:10px;padding-top:10px;border-top:0.5px solid var(--sep);display:flex;gap:18px">
          <div class="cl"><div class="cl-sw" style="background:var(--accent)"></div>Расход л/100 км</div>
          <div class="cl"><div class="cl-sw" style="background:var(--orange);opacity:.7"></div><span id="avgLegendLabel">Среднее</span></div>
        </div>
      </div>

      <!-- ⑥ ГБО ЭКОНОМИЯ -->
      <div class="slbl">Газ vs Бензин</div>
      <div class="group">
        <div class="row">
          <div class="row-icon" style="background:var(--green-bg)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg>
          </div>
          <div class="row-body">
            <div class="row-title">Экономия на 100 км</div>
            <div class="row-sub">газ против бензина</div>
          </div>
          <div class="row-right">
            <div class="row-val green">${savings ? '+' + savings + ' zł' : '—'}</div>
          </div>
        </div>
        <div class="row">
          <div class="row-icon" style="background:var(--red-bg)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 22h18"/><path d="M7 14h4"/><path d="M7 10h4"/></svg>
          </div>
          <div class="row-body"><div class="row-title">Расход бензин</div></div>
          <div class="row-right">
            <div class="row-val">${avgPetrolCons ? avgPetrolCons.toFixed(1) : '—'} л/100</div>
          </div>
        </div>
        <div class="row">
          <div class="row-icon" style="background:var(--orange-bg)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
          </div>
          <div class="row-body"><div class="row-title">Расход газ (средний)</div></div>
          <div class="row-right">
            <div class="row-val">${avgGas} л/100</div>
          </div>
        </div>
      </div>

      <!-- ⑦ ИСТОРИЯ -->
      <div class="slbl">История заправок</div>

      <!-- Строка поиска по дате -->
      <div class="search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="historySearch" placeholder="Поиск по дате… напр. 03.2025" oninput="_applyHistoryFilters()">
        <svg id="historySearchClear" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linecap="round" style="cursor:pointer;display:none" onclick="document.getElementById('historySearch').value='';_applyHistoryFilters()"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>

      <!-- Фильтр по периоду -->
      <div class="chips" id="periodChips">
        <div class="chip active" data-period="week">Неделя</div>
        <div class="chip" data-period="month">Месяц</div>
        <div class="chip" data-period="year">Год</div>
        <div class="chip" data-period="all">Вся история</div>
      </div>

      <!-- Фильтр по типу + расходу -->
      <div class="chips" id="sortChips">
        <div class="chip active" data-sort="all">Все</div>
        <div class="chip" data-sort="gas">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
          Газ
        </div>
        <div class="chip" data-sort="petrol">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 22h18"/></svg>
          Бензин
        </div>
        <div class="chip" data-sort="high">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
          Высокий
        </div>
        <div class="chip" data-sort="low">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          Низкий
        </div>
      </div>

      <div class="group" id="historyList">
        ${buildFillRows(filterDataByPeriod(sorted, 'week'))}
      </div>

    </div>
  `;

  // ── Состояние фильтров ─────────────────────────────────
  // Сохраняем данные глобально для доступа из oninput
  window._fuelSorted   = sorted;
  window._activePeriod = 'week';
  window._activeSort   = 'all';

  // Период chips
  document.querySelectorAll('#periodChips .chip').forEach(chip => {
    chip.addEventListener('click', function() {
      document.querySelectorAll('#periodChips .chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      window._activePeriod = this.dataset.period;
      _applyHistoryFilters();
    });
  });

  // Sort chips
  document.querySelectorAll('#sortChips .chip').forEach(chip => {
    chip.addEventListener('click', function() {
      document.querySelectorAll('#sortChips .chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      window._activeSort = this.dataset.sort;
      _applyHistoryFilters();
    });
  });

  // SVG chart (built from fuelChart data pipeline)
  setTimeout(() => buildSVGFuelChart(data), 80);

  // Range card
  if (typeof updateFuelRangeDisplay === 'function') updateFuelRangeDisplay(data);
}

// ── SVG FUEL CHART (like Auris iOS v4) ─────────────────
function buildSVGFuelChart(rawData) {
  // All gas data over entire period (no 6-month filter)
  let monthlyData = [];
  if (typeof calculateMonthlyAverages === 'function' && typeof sortMonthlyData === 'function') {
    // Filter only gas with valid consumption — no date restriction
    const gasAll = Array.isArray(rawData) ? rawData.filter(e => {
      const isGas = e.fuelType && e.fuelType.toString().toLowerCase().includes('газ');
      const hasCons = e.fuelConsumption && !isNaN(parseFloat(e.fuelConsumption)) && parseFloat(e.fuelConsumption) > 0;
      return isGas && hasCons;
    }) : [];
    const monthly = calculateMonthlyAverages(gasAll);
    monthlyData   = sortMonthlyData(monthly);
  }

  const svg = document.getElementById('svgConsChart');
  const wrap = document.getElementById('svgChartWrap');
  const tip  = document.getElementById('svgChartTip');
  if (!svg || !wrap) return;

  if (!monthlyData || monthlyData.length < 2) {
    svg.style.display = 'none';
    wrap.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--text2);font-size:14px">Недостаточно данных за 6 месяцев</div>';
    return;
  }

  const W = wrap.clientWidth || 320;
  const H = 160, pL = 30, pR = 8, pT = 12, pB = 26;
  const cW = W - pL - pR, cH = H - pT - pB;
  const vals = monthlyData.map(d => d.average);
  const minV = Math.min(...vals) - 0.4;
  const maxV = Math.max(...vals) + 0.4;
  const avg  = vals.reduce((a,b) => a+b, 0) / vals.length;

  const ns  = 'http://www.w3.org/2000/svg';
  const xS  = i => pL + (i / (monthlyData.length - 1)) * cW;
  const yS  = v => pT + cH - ((v - minV) / (maxV - minV)) * cH;
  const mk  = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  svg.innerHTML = '';
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Gradient defs
  const defs = mk('defs', {});
  const grad = mk('linearGradient', { id:'fcg', x1:'0', y1:'0', x2:'0', y2:'1' });
  grad.appendChild(mk('stop', { offset:'0%', 'stop-color':'var(--accent)', 'stop-opacity':'0.18' }));
  grad.appendChild(mk('stop', { offset:'100%', 'stop-color':'var(--accent)', 'stop-opacity':'0.01' }));
  defs.appendChild(grad); svg.appendChild(defs);

  // Grid lines
  const gridVals = [];
  const step = (maxV - minV) / 4;
  for (let i = 0; i <= 4; i++) gridVals.push(+(minV + step * i).toFixed(1));
  gridVals.forEach(v => {
    const y = yS(v);
    svg.appendChild(mk('line', { x1:pL, x2:W-pR, y1:y, y2:y, stroke:'var(--sep)', 'stroke-width':'.5' }));
    const t = mk('text', { x:pL-4, y:y+3.5, fill:'var(--text2)', 'font-size':'9', 'text-anchor':'end', 'font-family':'-apple-system' });
    t.textContent = v.toFixed(1); svg.appendChild(t);
  });

  // Area fill
  const areaD = `M${xS(0)},${yS(minV)} ` + monthlyData.map((d,i) => `L${xS(i)},${yS(d.average)}`).join(' ') + ` L${xS(monthlyData.length-1)},${yS(minV)} Z`;
  svg.appendChild(mk('path', { d:areaD, fill:'url(#fcg)' }));

  // Average dashed line
  svg.appendChild(mk('line', { x1:pL, x2:W-pR, y1:yS(avg), y2:yS(avg), stroke:'var(--orange)', 'stroke-width':'1.5', 'stroke-dasharray':'5 3', opacity:'0.7' }));

  // Update legend label
  const ll = document.getElementById('avgLegendLabel');
  if (ll) ll.textContent = `Ср. ${avg.toFixed(2)}`;

  // Main polyline
  const pts = monthlyData.map((d,i) => `${xS(i)},${yS(d.average)}`).join(' ');
  svg.appendChild(mk('polyline', { points:pts, fill:'none', stroke:'var(--accent)', 'stroke-width':'2', 'stroke-linecap':'round', 'stroke-linejoin':'round' }));

  // Dots + x-labels + tooltips
  monthlyData.forEach((d, i) => {
    const cx = xS(i), cy = yS(d.average);
    const dot = mk('circle', { cx, cy, r:'4', fill:'var(--accent)', stroke:'var(--grouped)', 'stroke-width':'2.5' });
    dot.style.cursor = 'pointer';
    dot.addEventListener('click', () => {
      tip.style.display = 'block';
      tip.innerHTML = `<b>${d.average.toFixed(2)} л/100</b><span>${d.monthName}</span>`;
      let left = cx - 60; left = Math.max(0, Math.min(W - 130, left));
      tip.style.left = left + 'px'; tip.style.top = (cy - 70) + 'px';
      setTimeout(() => tip.style.display = 'none', 2200);
    });
    svg.appendChild(dot);

    // X labels: first, last, and every N months depending on density
    const step = monthlyData.length > 14 ? 4 : monthlyData.length > 8 ? 3 : 2;
    if (i === 0 || i === monthlyData.length - 1 || i % step === 0) {
      const lbl = mk('text', { x:cx, y:H-4, fill:'var(--text2)', 'font-size':'9', 'text-anchor':'middle', 'font-family':'-apple-system' });
      lbl.textContent = d.monthName; svg.appendChild(lbl);
    }
  });
}



function buildFillRows(data) {
  if (!data || data.length === 0) {
    return '<div class="empty-state">Нет заправок за выбранный период</div>';
  }
  const GAS_ICO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`;
  const PETROL_ICO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 22h18"/><path d="M7 14h4"/><path d="M7 10h4"/></svg>`;

  return data.map(r => {
    const isGas = (r.fuelType || '').toLowerCase().includes('газ');
    const cons = parseFloat(r.fuelConsumption);
    const consClass = !cons ? '' : cons < 6.3 ? 'good' : cons < 7.5 ? 'mid' : 'bad';
    const consIco = !cons ? '' : cons < 6.3
      ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`
      : cons < 7.5
      ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`
      : `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>`;

    return `
      <div class="fill-row">
        <div class="fill-badge ${isGas ? 'gas' : 'petrol'}">${isGas ? GAS_ICO : PETROL_ICO}</div>
        <div class="fill-body">
          <div class="fill-top">
            <span class="fill-date">${formatDate(r.date)}</span>
            <span class="fill-cost">${r.totalCost || '—'} zł</span>
          </div>
          <div class="fill-meta">
            <span class="fill-chip">${r.fuelType || 'Топливо'}</span>
            ${r.fuelAmount ? `<span class="fill-chip"><b>${r.fuelAmount}</b> л</span>` : ''}
            ${r.pricePerLiter ? `<span class="fill-chip"><b>${r.pricePerLiter}</b> zł/л</span>` : ''}
            ${r.distance ? `<span class="fill-chip"><b>${r.distance}</b> км</span>` : ''}
          </div>
          <div class="fill-km">${r.mileage ? r.mileage.toLocaleString('ru') + ' км на одометре' : ''}</div>
          ${cons ? `<span class="cons-badge ${consClass}">${consIco} ${cons.toFixed(2)} л/100</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── FUEL HELPERS ───────────────────────────────────────
function calculateAverageConsumption(data) {
  if (!data || !data.length) return '—';
  const gasData = [...data].filter(e => (e.fuelType||'').toLowerCase().includes('газ'))
    .sort((a,b) => parseCustomDate(b.date) - parseCustomDate(a.date));
  if (!gasData.length) return '—';

  let weekData = [];
  for (let wb = 0; wb < 8; wb++) {
    const ws = getWeekStart(new Date(), wb);
    const we = new Date(ws); we.setDate(ws.getDate()+6); we.setHours(23,59,59,999);
    weekData = gasData.filter(e => isDateInRange(e.date, ws, we));
    if (weekData.length) break;
  }
  if (!weekData.length) weekData = gasData.slice(0, 5);

  let total = 0, count = 0;
  weekData.forEach(e => { const v = parseFloat(e.fuelConsumption); if (!isNaN(v)) { total += v; count++; } });
  return count ? (total/count).toFixed(1) : '—';
}

function filterDataByPeriod(data, period) {
  const now = new Date();
  switch(period) {
    case 'week': {
      const ws = getWeekStart(now);
      const we = new Date(ws); we.setDate(ws.getDate()+6); we.setHours(23,59,59,999);
      return data.filter(e => isDateInRange(e.date, ws, we));
    }
    case 'month': {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      const me = new Date(now.getFullYear(), now.getMonth()+1, 0); me.setHours(23,59,59,999);
      return data.filter(e => isDateInRange(e.date, ms, me));
    }
    case 'year': {
      const ys = new Date(now.getFullYear(), 0, 1);
      const ye = new Date(now.getFullYear(), 11, 31); ye.setHours(23,59,59,999);
      return data.filter(e => isDateInRange(e.date, ys, ye));
    }
    default: return data;
  }
}

// ── ADD FUEL ───────────────────────────────────────────
function renderAddFuel(data) {
  const lastKm = data && data.endKm ? data.endKm : '';
  window._lastKnownKm = lastKm;
  DOM.pageContent.innerHTML = `
    <div class="anim">

      <div class="form-section-label">Данные заправки</div>
      <div class="form-group-box">
        <div class="form-row">
          <label class="form-lbl" for="fuelMileage">Пробег <span style="color:var(--red)">*</span></label>
          <input class="form-inp" type="number" id="fuelMileage" placeholder="км" value="${lastKm}" min="0">
        </div>
        <div class="form-row">
          <label class="form-lbl" for="fuelType">Тип топлива <span style="color:var(--red)">*</span></label>
          <select class="form-select" id="fuelType">
            <option value="">Выбрать</option>
            <option value="газ">Газ</option>
            <option value="бензин">Бензин</option>
            <option value="дизель">Дизель</option>
          </select>
        </div>
        <div class="form-row">
          <label class="form-lbl" for="fuelAmount">Объём <span style="color:var(--red)">*</span></label>
          <input class="form-inp" type="number" step="0.01" id="fuelAmount" placeholder="литры" min="0.01">
        </div>
        <div class="form-row">
          <label class="form-lbl" for="fuelCost">Стоимость <span style="color:var(--red)">*</span></label>
          <input class="form-inp" type="number" step="0.01" id="fuelCost" placeholder="PLN" min="0.01">
        </div>
        <div class="form-row">
          <label class="form-lbl" for="fuelDistance">Расстояние</label>
          <input class="form-inp" type="number" id="fuelDistance" placeholder="км от прошлой" min="0">
        </div>
      </div>
      <p class="form-hint">* обязательно · Расстояние — от предыдущей заправки</p>

      <div class="form-section-label" style="margin-top:16px">Комментарий <span style="color:var(--text2);font-size:12px">(необязательно)</span></div>
      <div class="form-group-box">
        <div class="form-row">
          <input class="form-inp" type="text" id="fuelComment" placeholder="Заправка на трассе, полный бак…" style="text-align:left">
        </div>
      </div>

      <button class="ios-btn-primary" id="submitFuelBtn" onclick="submitFuel(event)">Добавить заправку</button>
      <div id="formMessage" style="display:none"></div>

    </div>
  `;
}

const GAS_POST_URL = 'https://script.google.com/macros/s/AKfycbyI8Wopp--leJCvpPEu7vDLjPG52rc03ZRikOxWsqLa7WuRCiZzUeTR02Q9KnnpTGBb/exec';

async function submitFuel(e) {
  e.preventDefault();
  const btn = document.getElementById('submitFuelBtn');
  const msg = document.getElementById('formMessage');

  // ── Валидация ──────────────────────────────────────
  const mileageVal  = parseFloat(document.getElementById('fuelMileage').value);
  const fuelTypeVal = document.getElementById('fuelType').value.trim();
  const amountVal   = parseFloat(document.getElementById('fuelAmount').value);
  const costVal     = parseFloat(document.getElementById('fuelCost').value);
  const distVal     = parseFloat(document.getElementById('fuelDistance').value) || 0;
  const commentVal  = (document.getElementById('fuelComment')?.value || '').trim();

  const errors = [];
  if (!fuelTypeVal)                         errors.push('выберите тип топлива');
  if (isNaN(mileageVal) || mileageVal <= 0) errors.push('введите корректный пробег');
  if (isNaN(amountVal)  || amountVal  <= 0) errors.push('объём > 0');
  if (isNaN(costVal)    || costVal    <= 0) errors.push('стоимость > 0');
  if (distVal < 0)                          errors.push('расстояние не может быть отрицательным');

  if (errors.length) {
    msg.style.display = 'block';
    msg.className = 'form-message error';
    msg.textContent = '✕ ' + errors.join(', ');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Отправка...';
  msg.style.display = 'none';

  const params = new URLSearchParams({
    mileage:    mileageVal,
    fuelType:   fuelTypeVal,
    fuelAmount: amountVal,
    fuelCost:   costVal,
    distance:   distVal || '',
    comment:    commentVal,
  });

  try {
    const res = await fetch(GAS_POST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params.toString()
    });
    if (!res.ok) throw new Error('Ошибка сети: ' + res.status);
    const result = await res.json();

    msg.style.display = 'block';
    msg.className = 'form-message ' + (result.success ? 'success' : 'error');
    msg.textContent = (result.success ? '✓ ' : '✕ ') + result.message;

    if (result.success) {
      // Пробег оставляем (последний известный), остальное чистим
      document.getElementById('fuelMileage').value  = window._lastKnownKm || '';
      document.getElementById('fuelType').value     = '';
      document.getElementById('fuelAmount').value   = '';
      document.getElementById('fuelCost').value     = '';
      document.getElementById('fuelDistance').value = '';
      if (document.getElementById('fuelComment'))
        document.getElementById('fuelComment').value = '';
      // Инвалидируем кэш — при следующем открытии fuel/home данные обновятся
      localStorage.removeItem('cache_v2_fuel');
      localStorage.removeItem('cache_v2_home');
    }
  } catch(err) {
    msg.style.display = 'block';
    msg.className = 'form-message error';
    msg.textContent = '✕ ' + err.message;
  }

  btn.disabled = false;
  btn.textContent = 'Добавить заправку';
}

// ── SERVICE ────────────────────────────────────────────
function getServiceIconSVG(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('масло') || t.includes('то') || t.includes('обслуживание') || t.includes('расходник'))
    return { svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3h18v4H3z"/><path d="M3 7l2 14h14l2-14"/><path d="M12 11v6"/></svg>`, cls: 'b' };
  if (t.includes('ремонт') || t.includes('замен'))
    return { svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`, cls: 'r' };
  if (t.includes('шин') || t.includes('резин') || t.includes('переобув'))
    return { svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`, cls: 'o' };
  if (t.includes('газ') || t.includes('гбо'))
    return { svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`, cls: 'g' };
  if (t.includes('покупка') || t.includes('запча'))
    return { svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`, cls: 'i' };
  return { svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`, cls: 'b' };
}

function renderService(data) {
  if (!Array.isArray(data)) return;

  // ── Base stats ─────────────────────────────────────────
  const totalSpent = data.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const avgCost    = data.length ? totalSpent / data.length : 0;
  const curYear    = new Date().getFullYear();
  const curMonth   = new Date().getMonth() + 1;

  const yearData     = data.filter(i => { try { return parseCustomDate(i.date).getFullYear() === curYear; } catch { return false; } });
  const lastYearData = data.filter(i => { try { return parseCustomDate(i.date).getFullYear() === curYear - 1; } catch { return false; } });
  const yearTotal    = yearData.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const monthlyAvg   = yearData.length ? (yearData.length / curMonth).toFixed(1) : '0.0';

  // Trend vs last year
  let trendHTML = '—';
  if (lastYearData.length > 0 && yearData.length > 0) {
    const pct = Math.round(((yearData.length - lastYearData.length) / lastYearData.length) * 100);
    const cls = pct > 0 ? 'trend-up' : pct < 0 ? 'trend-down' : '';
    trendHTML = `<span class="${cls}">${pct > 0 ? '↑' : pct < 0 ? '↓' : '→'}${Math.abs(pct)}%</span>`;
  }

  // Last visit
  let lastVisit = '—';
  if (data.length) {
    const lastDate = data.reduce((latest, item) => {
      const d = parseCustomDate(item.date);
      return d > latest ? d : latest;
    }, new Date(0));
    if (!isNaN(lastDate)) {
      const diff = Math.floor((new Date() - lastDate) / 86400000);
      lastVisit = diff === 0 ? 'сегодня' : `${diff} дн. назад`;
    }
  }

  // Most common type
  const typeCounts = {};
  data.forEach(i => {
    const t = (i.type || 'другое').toLowerCase().trim();
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const mostCommon = Object.entries(typeCounts).sort((a,b) => b[1]-a[1])[0]?.[0]?.toUpperCase() || '—';

  // ── Cost distribution by category ─────────────────────
  const cats = { to: 0, repair: 0, consumables: 0, tires: 0, other: 0 };
  let catTotal = 0;
  data.forEach(i => {
    const t = (i.type || '').toLowerCase();
    const c = parseFloat(i.total) || 0;
    if (!c) return;
    catTotal += c;
    if (t.includes('то') || t.includes('обслуживание') || t.includes('плановое'))   cats.to += c;
    else if (t.includes('ремонт') || t.includes('замена'))                           cats.repair += c;
    else if (t.includes('расходник') || t.includes('фильтр') || t.includes('масло')) cats.consumables += c;
    else if (t.includes('шин') || t.includes('резин') || t.includes('переобув'))     cats.tires += c;
    else                                                                               cats.other += c;
  });
  const pct = k => catTotal > 0 ? Math.round((cats[k] / catTotal) * 100) : 0;

  const distRows = [
    { lbl:'ТО',        key:'to',          color:'var(--accent)' },
    { lbl:'Ремонты',   key:'repair',       color:'var(--red)' },
    { lbl:'Расходники',key:'consumables',  color:'var(--green)' },
    { lbl:'Шины',      key:'tires',        color:'var(--orange)' },
    { lbl:'Прочее',    key:'other',        color:'var(--indigo)' },
  ].filter(d => pct(d.key) > 0);

  function buildDonut() {
    if (!distRows.length) return '<div class="empty-state" style="padding:20px 0">Нет данных</div>';
    var OX = 75, OY = 75, OR = 58, IR = 36;
    var toRad = function(d) { return d * Math.PI / 180; };
    var GAP = 2.8;
    function arc(s, e) {
      var sa = s + GAP/2, ea = e - GAP/2;
      var x1 = OX + OR*Math.cos(toRad(sa)), y1 = OY + OR*Math.sin(toRad(sa));
      var x2 = OX + OR*Math.cos(toRad(ea)), y2 = OY + OR*Math.sin(toRad(ea));
      var x3 = OX + IR*Math.cos(toRad(ea)), y3 = OY + IR*Math.sin(toRad(ea));
      var x4 = OX + IR*Math.cos(toRad(sa)), y4 = OY + IR*Math.sin(toRad(sa));
      var lg = (ea - sa) > 180 ? 1 : 0;
      return 'M'+x1+' '+y1+' A'+OR+' '+OR+' 0 '+lg+' 1 '+x2+' '+y2
            +' L'+x3+' '+y3+' A'+IR+' '+IR+' 0 '+lg+' 0 '+x4+' '+y4+' Z';
    }
    var segs = '', angle = -90;
    distRows.forEach(function(d) {
      var sw = pct(d.key) * 3.6;
      segs += '<path d="'+arc(angle, angle+sw)+'" fill="'+d.color+'" opacity="0.9"/>';
      angle += sw;
    });
    var top = distRows[0];
    var centre =
      '<text x="'+OX+'" y="'+(OY-6)+'" text-anchor="middle" font-size="15" font-weight="700"'
      +' fill="var(--text)" font-family="-apple-system">'+pct(top.key)+'%</text>'
      +'<text x="'+OX+'" y="'+(OY+12)+'" text-anchor="middle" font-size="10"'
      +' fill="var(--text2)" font-family="-apple-system">'+top.lbl+'</text>';
    var rows = '';
    distRows.forEach(function(d, i) {
      var mb = i < distRows.length-1 ? 'margin-bottom:10px;' : '';
      rows +=
        '<div style="display:flex;align-items:center;gap:8px;'+mb+'">'
        +'<div style="width:10px;height:10px;border-radius:3px;flex-shrink:0;background:'+d.color+'"></div>'
        +'<span style="font-size:13px;color:var(--text);flex:1">'+d.lbl+'</span>'
        +'<span style="font-size:13px;font-weight:600;color:'+d.color+'">'+pct(d.key)+'%</span>'
        +'</div>';
    });
    return '<div style="display:flex;align-items:center;gap:16px">'
      +'<svg width="150" height="150" viewBox="0 0 150 150" style="flex-shrink:0">'+segs+centre+'</svg>'
      +'<div style="flex:1">'+rows+'</div>'
      +'</div>';
  }
  const distHTML = buildDonut();

  // ── Timeline ───────────────────────────────────────────
  // ── Timeline builder (вызывается при фильтрации) ──────
  function buildTimelineHTML(list) {
    if (!list.length) return '<div class="empty-state" style="padding:24px 0;text-align:center;color:var(--text2);font-size:14px">Ничего не найдено</div>';
    const grp = groupByMonth(list);
    let html = '';
    Object.keys(grp).forEach(month => {
      html += '<div class="month-header">' + (month.charAt(0) + month.slice(1).toLowerCase()) + '</div>';
      html += '<div class="group" style="padding: 0 16px">';
      grp[month].forEach(s => {
        const { svg, cls } = getServiceIconSVG(s.type);
        html += `
          <div class="tl-row">
            <div class="tl-icon ${cls}">${svg}</div>
            <div class="tl-body">
              <div class="tl-title">${s.description || s.type || 'Обслуживание'}</div>
              <div class="tl-meta">${s.date || '—'} · ${s.mileage || '—'} км · ${s.type || ''}</div>
            </div>
            <div class="tl-price">${s.total ? s.total + ' zł' : '—'}</div>
          </div>`;
      });
      html += '</div>';
    });
    return html;
  }

  // Категории для чипов
  const svcCategories = [
    { key: 'all',          lbl: 'Все' },
    { key: 'плановое',     lbl: 'Плановое ТО' },
    { key: 'ремонт',       lbl: 'Ремонт' },
    { key: 'расходник',    lbl: 'Расходники' },
    { key: 'переобувка',   lbl: 'Переобувка' },
    { key: 'покупка',      lbl: 'Покупка запчастей' },
    { key: 'мойка',        lbl: 'Мойка' },
  ];

  const timelineHTML = buildTimelineHTML(data);

  // ── Hero ───────────────────────────────────────────────
  DOM.pageContent.innerHTML = `
    <div class="anim">

      <!-- HERO: всего потрачено -->
      <div class="hero indigo">
        <div class="hero-lbl">Всего на обслуживание</div>
        <div class="hero-val">${Math.round(totalSpent).toLocaleString('ru')} <span class="hero-unit">zł</span></div>
        <div class="hero-sub">${data.length} записей за всё время</div>
        <div class="hero-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        </div>
      </div>

      <!-- ROW 1: За год + Средний чек -->
      <div class="stat-cards-row">
        <div class="stat-card-ios">
          <div class="sc-label">За ${curYear} год</div>
          <div class="sc-value">${Math.round(yearTotal).toLocaleString('ru')}<span class="u"> zł</span></div>
          <div class="sc-sub">${yearData.length} визитов</div>
        </div>
        <div class="stat-card-ios">
          <div class="sc-label">Средний чек</div>
          <div class="sc-value">${Math.round(avgCost).toLocaleString('ru')}<span class="u"> zł</span></div>
          <div class="sc-sub">за одну запись</div>
        </div>
      </div>

      <!-- ROW 2: Среднее в мес + Последний визит -->
      <div class="stat-cards-row">
        <div class="stat-card-ios">
          <div class="sc-label">В месяц (${curYear})</div>
          <div class="sc-value">${monthlyAvg}<span class="u">×</span></div>
          <div class="sc-sub">тренд vs прошлый год: ${trendHTML}</div>
        </div>
        <div class="stat-card-ios">
          <div class="sc-label">Последний визит</div>
          <div class="sc-value" style="font-size:17px;letter-spacing:-.3px">${lastVisit}</div>
          <div class="sc-sub">чаще всего: ${mostCommon}</div>
        </div>
      </div>

      <!-- Распределение расходов -->
      <div class="slbl">Распределение расходов</div>
      <div class="group" style="padding:16px">
        ${distHTML || '<div class="empty-state" style="padding:20px 0">Нет данных</div>'}
      </div>

      <!-- Timeline -->
      <!-- Timeline -->
      <div class="slbl">История работ</div>

      <div class="search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="svcSearch" placeholder="Поиск по описанию, типу…" oninput="_applySvcFilters()">
        <svg id="svcSearchClear" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linecap="round" style="cursor:pointer;display:none" onclick="document.getElementById('svcSearch').value='';_applySvcFilters()"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>

      <div class="chips" id="svcChips">
        ${svcCategories.map((c,i) => '<div class="chip' + (i===0?' active':'') + '" data-svc="' + c.key + '">' + c.lbl + '</div>').join('')}
      </div>

      <div id="svcTimeline">
        ${timelineHTML}
      </div>

    </div>
  `;

  // Привязываем чипы — активируют глобальный фильтр
  window._svcData = data;
  window._activeSvcCat = 'all';

  document.querySelectorAll('#svcChips .chip').forEach(chip => {
    chip.addEventListener('click', function() {
      document.querySelectorAll('#svcChips .chip').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      window._activeSvcCat = this.dataset.svc;
      _applySvcFilters();
    });
  });
}

// ── FUEL FILTER GLOBAL ─────────────────────────────────
function _applyHistoryFilters() {
  const searchVal = (document.getElementById('historySearch')?.value || '').trim();
  const clearBtn  = document.getElementById('historySearchClear');
  if (clearBtn) clearBtn.style.display = searchVal ? 'block' : 'none';

  const sorted      = window._fuelSorted || [];
  const activePeriod = window._activePeriod || 'week';
  const activeSort   = window._activeSort   || 'all';

  let list = filterDataByPeriod(sorted, activePeriod);

  if (activeSort === 'gas')    list = list.filter(r => (r.fuelType||'').toLowerCase().includes('газ'));
  if (activeSort === 'petrol') list = list.filter(r => (r.fuelType||'').toLowerCase().includes('бензин'));
  if (activeSort === 'high')   list = list.filter(r => { const c = n(r.fuelConsumption); return !isNaN(c) && c >= 7.5; });
  if (activeSort === 'low')    list = list.filter(r => { const c = n(r.fuelConsumption); return !isNaN(c) && c < 6.3; });
  if (searchVal) list = list.filter(r => (r.date || '').includes(searchVal));

  const el = document.getElementById('historyList');
  if (el) el.innerHTML = buildFillRows(list);
}

// ── SERVICE FILTER GLOBALS ─────────────────────────────
function buildTimelineHTML(list) {
  if (!list || !list.length) return '<div class="empty-state" style="padding:24px 0;text-align:center;color:var(--text2);font-size:14px">Ничего не найдено</div>';
  const grp = groupByMonth(list);
  let html = '';
  Object.keys(grp).forEach(function(month) {
    html += '<div class="month-header">' + (month.charAt(0) + month.slice(1).toLowerCase()) + '</div>';
    html += '<div class="group" style="padding: 0 16px">';
    grp[month].forEach(function(s) {
      const { svg, cls } = getServiceIconSVG(s.type);
      html += '<div class="tl-row">'
        + '<div class="tl-icon ' + cls + '">' + svg + '</div>'
        + '<div class="tl-body">'
        + '<div class="tl-title">' + (s.description || s.type || 'Обслуживание') + '</div>'
        + '<div class="tl-meta">' + (s.date||'—') + ' · ' + (s.mileage||'—') + ' км · ' + (s.type||'') + '</div>'
        + '</div>'
        + '<div class="tl-price">' + (s.total ? s.total + ' zł' : '—') + '</div>'
        + '</div>';
    });
    html += '</div>';
  });
  return html;
}

function _applySvcFilters() {
  const q = (document.getElementById('svcSearch')?.value || '').trim().toLowerCase();
  const clearBtn = document.getElementById('svcSearchClear');
  if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

  const data = window._svcData || [];
  let list = [...data];

  const cat = window._activeSvcCat || 'all';
  if (cat !== 'all') {
    list = list.filter(s => (s.type || '').toLowerCase().includes(cat));
  }
  if (q) {
    list = list.filter(s =>
      (s.description || '').toLowerCase().includes(q) ||
      (s.type || '').toLowerCase().includes(q)
    );
  }

  const el = document.getElementById('svcTimeline');
  if (el) el.innerHTML = buildTimelineHTML(list);
}

// ── SETTINGS ───────────────────────────────────────────
// ── HOME LAYOUT ────────────────────────────────────────
const HOME_LAYOUT_DEFAULTS = {
  reminders: [
    { id:'oil',   label:'Масло',        enabled:true },
    { id:'diag',  label:'Диагностика',  enabled:true },
    { id:'insur', label:'Страховка',    enabled:true },
    { id:'gbo',   label:'ГБО',          enabled:true },
    { id:'kpp',   label:'КПП',          enabled:true },
  ],
  minicards: [
    { id:'to',        label:'До ТО',              enabled:true },
    { id:'fuel_week', label:'Топливо / нед.',      enabled:true },
    { id:'total',     label:'Всего расходов',      enabled:true },
    { id:'last_fuel', label:'Последняя заправка',  enabled:true },
  ],
  sections: [
    { id:'spark', label:'Тренд расхода газа', enabled:true },
    { id:'quick', label:'Быстрый доступ',     enabled:true },
  ]
};

function getHomeLayout() {
  try {
    const s = localStorage.getItem('home_layout');
    if (!s) return JSON.parse(JSON.stringify(HOME_LAYOUT_DEFAULTS));
    const p = JSON.parse(s);
    ['reminders','minicards','sections'].forEach(function(g) {
      if (!p[g]) p[g] = JSON.parse(JSON.stringify(HOME_LAYOUT_DEFAULTS[g]));
    });
    return p;
  } catch(e) { return JSON.parse(JSON.stringify(HOME_LAYOUT_DEFAULTS)); }
}
function saveHomeLayout(layout) { localStorage.setItem('home_layout', JSON.stringify(layout)); }

// ── SETTINGS ───────────────────────────────────────────
function renderSettings(data) {
  const count = Array.isArray(data) ? data.length : (data ? Object.keys(data).length : 0);
  const layout = getHomeLayout();

  const COLORS = {
    oil:'#ff9500', diag:'#007aff', insur:'#ff3b30', gbo:'#34c759', kpp:'#5856d6',
    to:'#007aff', fuel_week:'#ff9500', total:'#34c759', last_fuel:'#ff6b00',
    spark:'#007aff', quick:'#34c759'
  };

  function buildGroup(title, items, gid, showReset) {
    let h = '<div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px">';
    h += '<div class="slbl" style="margin:0">' + title + '</div>';
    if (showReset) h += '<button class="layout-reset-btn" onclick="_layoutReset()">Сбросить всё</button>';
    h += '</div><div id="' + gid + '">';
    items.forEach(function(item) {
      const c = COLORS[item.id] || '#8e8e93';
      h += '<div class="layout-item" data-id="' + item.id + '">' +
        '<div class="layout-drag-handle" title="Перетащить">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>' +
        '</div>' +
        '<div class="layout-item-icon" style="background:' + c + '22">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="5"/></svg>' +
        '</div>' +
        '<div class="layout-item-name">' + item.label + '</div>' +
        '<label style="position:relative;display:inline-block;width:51px;height:31px;flex-shrink:0">' +
          '<input type="checkbox" class="ios-toggle layout-toggle" data-id="' + item.id + '" data-gid="' + gid + '"' + (item.enabled ? ' checked' : '') + '>' +
        '</label></div>';
    });
    return h + '</div>';
  }

  DOM.pageContent.innerHTML =
    '<div class="anim">' +
    '<div class="slbl">Автомобиль</div>' +
    '<div class="form-group-box"><div class="form-row">' +
      '<label class="form-lbl" for="currentMileage">Текущий пробег</label>' +
      '<input class="form-inp" type="number" id="currentMileage" placeholder="км">' +
    '</div></div>' +
    '<button class="ios-btn-primary" onclick="saveMileage()">Обновить пробег</button>' +

    '<div class="slbl" style="margin-top:24px">Настройка главной страницы</div>' +
    '<p style="font-size:13px;color:var(--text2);margin:0 0 4px;padding:0 4px">' +
      'Перетащите <b>⠿</b> для изменения порядка. Тоггл — скрыть/показать.</p>' +

    buildGroup('Ближайшие сроки', layout.reminders, 'lg-reminders', false) +
    buildGroup('Мини-карточки',   layout.minicards,  'lg-minicards',  false) +
    buildGroup('Секции',          layout.sections,   'lg-sections',   true)  +

    '<div class="slbl" style="margin-top:24px">О приложении</div>' +
    '<div class="group">' +
      '<div class="row"><div class="row-body"><div class="row-title">Версия</div></div><div class="row-right"><div class="row-val">1.0.0</div></div></div>' +
      '<div class="row"><div class="row-body"><div class="row-title">Записей обслуживания</div></div><div class="row-right"><div class="row-val">' + count + '</div></div></div>' +
      '<div class="row" style="cursor:pointer" onclick="_clearCache(event)"><div class="row-body"><div class="row-title" style="color:var(--red)">Очистить кэш</div></div><div class="row-right"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></div></div>' +
    '</div></div>';

  const saved = localStorage.getItem('currentMileage');
  if (saved) document.getElementById('currentMileage').value = saved;

  // Toggle listeners
  document.querySelectorAll('.layout-toggle').forEach(function(chk) {
    chk.addEventListener('change', function() {
      const layout = getHomeLayout();
      const gid = this.dataset.gid;
      const key  = gid === 'lg-reminders' ? 'reminders' : gid === 'lg-minicards' ? 'minicards' : 'sections';
      const item = layout[key].find(function(x){ return x.id === this.dataset.id; }, this);
      if (item) item.enabled = this.checked;
      saveHomeLayout(layout);
    });
  });

  // Init drag for each group
  ['lg-reminders','lg-minicards','lg-sections'].forEach(function(gid) {
    _initDragGroup(document.getElementById(gid));
  });
}

function saveMileage() {
  const v = parseInt(document.getElementById('currentMileage').value);
  if (isNaN(v) || v < 0) return alert('Введите корректный пробег');
  localStorage.setItem('currentMileage', v);
  const btn = event.target;
  btn.textContent = '✓ Сохранено';
  setTimeout(function(){ btn.textContent = 'Обновить пробег'; }, 1500);
}

function saveIntervals() {
  const btn = event.target;
  btn.textContent = '✓ Сохранено';
  setTimeout(function(){ btn.textContent = 'Сохранить интервалы'; }, 1500);
}

function _clearCache(e) {
  ['cache_v2_home','cache_v2_fuel','cache_v2_service','cache_v2_settings'].forEach(function(k){
    localStorage.removeItem(k);
  });
  const title = e.currentTarget.querySelector('.row-title');
  if (title) {
    title.textContent = '✓ Кэш очищен';
    setTimeout(function(){ title.textContent = 'Очистить кэш'; }, 1500);
  }
}

function _layoutReset() {
  saveHomeLayout(JSON.parse(JSON.stringify(HOME_LAYOUT_DEFAULTS)));
  loadData();
}

// ── DRAG AND DROP (mouse + touch) ──────────────────────
function _initDragGroup(container) {
  if (!container) return;
  const gid    = container.id;
  const gKey   = gid === 'lg-reminders' ? 'reminders' : gid === 'lg-minicards' ? 'minicards' : 'sections';
  let dragEl   = null;
  let placeholder = null;

  function getY(e)    { return e.touches ? e.touches[0].clientY : e.clientY; }
  function getItems() { return Array.from(container.querySelectorAll('.layout-item')); }

  function onStart(e) {
    if (!e.target.closest('.layout-drag-handle')) return;
    dragEl = e.target.closest('.layout-item');
    if (!dragEl) return;

    // Create placeholder (ghost slot)
    placeholder = document.createElement('div');
    placeholder.style.cssText = 'height:' + dragEl.offsetHeight + 'px;' +
      'border-radius:12px;background:var(--sep);margin-bottom:6px;transition:none';
    dragEl.parentNode.insertBefore(placeholder, dragEl.nextSibling);

    dragEl.style.cssText = 'position:fixed;z-index:999;width:' + dragEl.offsetWidth + 'px;' +
      'left:' + dragEl.getBoundingClientRect().left + 'px;' +
      'top:' + dragEl.getBoundingClientRect().top + 'px;' +
      'box-shadow:0 10px 30px rgba(0,0,0,0.22);transition:none;touch-action:none;' +
      'background:var(--grouped);border-radius:12px;opacity:0.97';

    dragEl._startY    = getY(e);
    dragEl._offsetTop = dragEl.getBoundingClientRect().top;

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onEnd);
    document.addEventListener('touchmove', onMove, { passive:false });
    document.addEventListener('touchend',  onEnd);
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragEl) return;
    if (e.cancelable) e.preventDefault();
    const y    = getY(e);
    const dy   = y - dragEl._startY;
    dragEl.style.top = (dragEl._offsetTop + dy) + 'px';

    // Find insertion point
    const items = getItems().filter(function(el){ return el !== dragEl; });
    let insertBefore = null;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { insertBefore = items[i]; break; }
    }
    if (insertBefore) {
      container.insertBefore(placeholder, insertBefore);
    } else {
      container.appendChild(placeholder);
    }
  }

  function onEnd(e) {
    if (!dragEl) return;
    // Snap to placeholder position
    dragEl.style.cssText = '';
    container.insertBefore(dragEl, placeholder);
    placeholder.remove();
    placeholder = null;

    // Save new order
    const newOrder = getItems().map(function(el){ return el.dataset.id; });
    const layout   = getHomeLayout();
    layout[gKey].sort(function(a,b){ return newOrder.indexOf(a.id) - newOrder.indexOf(b.id); });
    saveHomeLayout(layout);

    dragEl = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onEnd);
  }

  container.addEventListener('mousedown',  onStart);
  container.addEventListener('touchstart', onStart, { passive:false });
}

// ── PLACEHOLDER ────────────────────────────────────────
function renderPlaceholder() {
  DOM.pageContent.innerHTML = `<div class="empty-state" style="padding:60px 20px">Раздел в разработке</div>`;
}

// ── INIT ───────────────────────────────────────────────
window.addEventListener('load', loadData);
window.addEventListener('popstate', loadData);
