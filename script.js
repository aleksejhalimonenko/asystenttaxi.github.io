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
  kmBadge:        document.getElementById('kmBadge'),
  kmBadgeVal:     document.getElementById('kmBadgeVal'),
  addFuelBadge:   document.getElementById('addFuelBadge'),
  addServiceBadge:document.getElementById('addServiceBadge'),
  tabs:        document.querySelectorAll('.tab'),
};

// ── CONSTANTS ──────────────────────────────────────────
const TITLE_MAP = {
  home:       'Главная',
  fuel:       'Топливо',
  service:    'Обслуживание',
  addfuel:    'Добавить запись',
  addservice: 'Добавить сервис',
  settings:   'Настройки',
  tco:        'Стоимость владения',   // <-- добавьте это
};

const GAS_BASE_URL = 'https://script.google.com/macros/s/AKfycbwrKqSXxg0nNnTF0tvqWFRYyPiJ9yQyORsnsPz35iYpwMmNI8BSkHnF20iHePZbQIDf/exec';


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

// ── ACTION SHEET "Добавить" ───────────────────────────
function showAddSheet(e) {
  if (e) e.preventDefault();
  document.getElementById('addSheetOverlay').classList.add('visible');
  document.getElementById('addSheet').classList.add('visible');
}
function hideAddSheet() {
  document.getElementById('addSheetOverlay').classList.remove('visible');
  document.getElementById('addSheet').classList.remove('visible');
}
// Закрытие по Escape (десктоп)
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') hideAddSheet();
});

function setActiveTab(page) {
  const p = page || 'home';
  DOM.tabs.forEach(t => t.classList.remove('active'));
  // Для форм добавления подсвечиваем родительский раздел
  const tabPage = p === 'addfuel' ? 'fuel' : p === 'addservice' ? 'service' : p;
  const active = document.querySelector(`.tab[data-page="${tabPage}"]`);
  if (active) active.classList.add('active');

  DOM.headerTitle.textContent = TITLE_MAP[p] || p;
}

// ── LOAD DATA ──────────────────────────────────────────
// TTL для каждой страницы (в миллисекундах)
const CACHE_TTL = {
  home:     30 * 60 * 1000,   // 30 мин
  fuel:     60 * 60 * 1000,   // 1 час
  service:  120 * 60 * 1000,  // 2 часа
  tco:      60 * 60 * 1000,   // 1 час
  settings: 24 * 60 * 60 * 1000, // 24 часа
  addfuel:    0,                 // не кэшируем форму
  addservice: 0,                 // не кэшируем форму
};

// Читает кэш и проверяет TTL. Возвращает {data, stale} или null.
function readCache(page) {
  try {
    const raw = localStorage.getItem(`cache_v2_${page}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    // Старый формат (без обёртки) — считаем протухшим
    if (!entry._cachedAt) return { data: entry, stale: true };
    const ttl = CACHE_TTL[page] ?? 60 * 60 * 1000;
    const age = Date.now() - entry._cachedAt;
    return { data: entry._data, stale: age > ttl };
  } catch(e) { return null; }
}

// Сохраняет данные в кэш с меткой времени.
function writeCache(page, data) {
  if ((CACHE_TTL[page] ?? 1) === 0) return; // addfuel не кэшируем
  localStorage.setItem(`cache_v2_${page}`, JSON.stringify({
    _cachedAt: Date.now(),
    _data: data,
  }));
}

async function loadData() {
  const page = getQueryParam('page') || 'home';
  setActiveTab(page);
  DOM.kmBadge.style.display = 'none';
  DOM.addFuelBadge.style.display = 'none';
  DOM.addServiceBadge.style.display = 'none';
  if (page === 'fuel')    DOM.addFuelBadge.style.display = 'flex';
  if (page === 'service') DOM.addServiceBadge.style.display = 'flex';

  if (typeof destroyFuelChart === 'function') destroyFuelChart();

  // Статические формы не требуют данных от GAS — рендерим сразу
  if ((CACHE_TTL[page] ?? 1) === 0) {
    hideSkeleton();
    const homeCache = readCache('home');
    renderByPage(page, homeCache ? homeCache.data : {});
    return;
  }

  const cached = readCache(page);

  if (cached) {
    // Есть кэш — показываем мгновенно
    hideSkeleton();
    renderByPage(page, cached.data);

    if (!cached.stale) return; // свежий — больше ничего не делаем

    // Кэш протух — тихо обновляем в фоне
    try {
      const res = await fetch(`${GAS_BASE_URL}?page=${page}`);
      if (!res.ok) return; // ошибка сети — оставляем кэш
      const fresh = await res.json();
      const freshStr = JSON.stringify(fresh);
      // Обновляем только если данные реально изменились
      if (freshStr !== JSON.stringify(cached.data)) {
        writeCache(page, fresh);
        renderByPage(page, fresh);
        _showRefreshToast();
        // Если обновилось топливо — обновляем данные на главной
        if (page === 'fuel' && document.getElementById('homeLastFuelVal')) {
          _populateHomeFromFuelCache();
        }
      } else {
        writeCache(page, fresh); // обновляем _cachedAt даже если данные те же
      }
    } catch(e) { /* тихо игнорируем — кэш остаётся */ }

  } else {
    // Нет кэша — грузим с показом скелетона
    showSkeleton();
    try {
      const res = await fetch(`${GAS_BASE_URL}?page=${page}`);
      if (!res.ok) throw new Error(`Ошибка ${res.status}`);
      const data = await res.json();
      writeCache(page, data);
      hideSkeleton();
      renderByPage(page, data);
    } catch(err) {
      showError(err.message);
    }
  }
}

// Тост "данные обновлены" — появляется на 2 сек в нижней части экрана
function _showRefreshToast() {
  var t = document.getElementById('refresh-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'refresh-toast';
    t.className = 'refresh-toast';
    document.getElementById('app').appendChild(t);
  }
  t.textContent = '↻ Данные обновлены';
  t.classList.add('visible');
  clearTimeout(t._timer);
  t._timer = setTimeout(function(){ t.classList.remove('visible'); }, 2000);
}

function renderByPage(page, data) {
  DOM.errorCard.style.display = 'none';
  const map = {
    home:       renderHome,
    fuel:       renderFuel,
    addfuel:    renderAddFuel,
    addservice: renderAddService,
    service:    renderService,
    settings:   renderSettings,
  tco: renderTCO,   // <-- новая страница
  };
  DOM.pageContent.innerHTML = '';
  (map[page] || renderPlaceholder)(data);
}

// ── HOME ───────────────────────────────────────────────
// ── HOME LAYOUT ───────────────────────────────────────
const HOME_LAYOUT_DEFAULTS = {
  reminders: [
    {id:'oil',   label:'Масло',        enabled:true},
    {id:'diag',  label:'Диагностика',  enabled:true},
    {id:'insur', label:'Страховка',    enabled:true},
    {id:'gbo',   label:'ГБО',          enabled:true},
    {id:'kpp',   label:'КПП',          enabled:true},
  ],
  minicards: [
    {id:'to',        label:'До ТО',             enabled:true},
    {id:'fuel_week', label:'Топливо / нед.',     enabled:true},
    {id:'total',     label:'Всего расходов',     enabled:true},
    {id:'last_fuel', label:'Последняя заправка', enabled:true},
  ],
  sections: [
    {id:'spark', label:'Тренд расхода газа', enabled:true},
    {id:'quick', label:'Быстрый доступ',     enabled:true},
  ]
};
function getHomeLayout() {
  try {
    const s = localStorage.getItem('home_layout');
    if (!s) return JSON.parse(JSON.stringify(HOME_LAYOUT_DEFAULTS));
    const p = JSON.parse(s);
    ['reminders','minicards','sections'].forEach(function(g){
      if (!p[g]) p[g] = JSON.parse(JSON.stringify(HOME_LAYOUT_DEFAULTS[g]));
    });
    return p;
  } catch(e) { return JSON.parse(JSON.stringify(HOME_LAYOUT_DEFAULTS)); }
}
function saveHomeLayout(l) { localStorage.setItem('home_layout', JSON.stringify(l)); }

// ── TCO LAYOUT ─────────────────────────────────────────────────────────────────
var TCO_LAYOUT_DEFAULTS = [
  {id:'cards',     label:'Карточки статистики', enabled:true},
  {id:'chart',     label:'График расходов',      enabled:true},
  {id:'dist',      label:'Распределение',        enabled:true},
  {id:'insurance', label:'Страховка по годам',   enabled:true},
  {id:'yearcomp',  label:'Год к году',           enabled:true},
  {id:'insight',   label:'Инсайт',               enabled:true},
  {id:'cushion',   label:'Финансовая подушка',   enabled:true},
];
function getTcoLayout() {
  try {
    var s = localStorage.getItem('tco_layout');
    if (!s) return JSON.parse(JSON.stringify(TCO_LAYOUT_DEFAULTS));
    var saved = JSON.parse(s);
    TCO_LAYOUT_DEFAULTS.forEach(function(def) {
      if (!saved.find(function(x){ return x.id === def.id; })) saved.push(JSON.parse(JSON.stringify(def)));
    });
    return saved;
  } catch(e) { return JSON.parse(JSON.stringify(TCO_LAYOUT_DEFAULTS)); }
}
function saveTcoLayout(l) { localStorage.setItem('tco_layout', JSON.stringify(l)); }

function renderHome(data) {
  if (!data || typeof data !== 'object') return;

  if (data.endKm) {
    DOM.kmBadge.style.display = 'flex';
    DOM.kmBadgeVal.textContent = Number(data.endKm).toLocaleString('ru') + ' км';
  }

  const urgency = function(km) {
    if (!km) return 'accent';
    const v = parseInt(km);
    if (v < 1000) return 'red';
    if (v < 3000) return 'orange';
    return 'green';
  };

  const oilKm  = data.nextOilChange;
  const diagKm = data.nextDiagnostic;
  const insur  = data.insuranceEnds;
  const gboKm  = data.gasServiceDue;

  const layout = getHomeLayout();

  // ── Reminder data map ──────────────────────────────
  const REM = {
    oil:   {val: oilKm||'—',  unit:' км',  name:'Масло',       cls: urgency(oilKm),
      svg:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3h18v4H3z"/><path d="M3 7l2 14h14l2-14"/><path d="M12 11v6"/><path d="M9 11v6"/><path d="M15 11v6"/></svg>'},
    diag:  {val: diagKm||'—', unit:' км',  name:'Диагностика', cls: urgency(diagKm),
      svg:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'},
    insur: {val: insur||'—',  unit:' дн.', name:'Страховка',   cls: (insur && parseInt(insur)<30?'red':insur && parseInt(insur)<60?'orange':'green'),
      svg:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'},
    gbo:   {val: gboKm||'—',  unit:' км',  name:'ГБО',         cls: urgency(gboKm),
      svg:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0v-7l-3-3"/><path d="M4 20v-14a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14"/><path d="M3 20l12 0"/><path d="M18 7v1a1 1 0 0 0 1 1h1"/><path d="M4 11l10 0"/></svg>'},
    kpp:   {val: (data.nextGearboxOilChange||'—'), unit:' км', name:'КПП', cls: urgency(data.nextGearboxOilChange),
      svg:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>'},
  };

  // ── Mini-card map ──────────────────────────────────
  const MINI = {
    to:        '<div class="mini"><div class="mini-lbl"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> До ТО</div><div class="mini-val">'+(data.nextDiagnostic||'—')+'<span class="u"> км</span></div><div class="mini-sub">следующая диагностика</div></div>',
    fuel_week: '<div class="mini"><div class="mini-lbl"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> Топливо / нед.</div><div class="mini-val">'+(data.weeklyFuelCost||'—')+'<span class="u"> zł</span></div><div class="mini-sub">'+(data.weeklyFuelPeriod||'текущая неделя')+'</div></div>',
    total:     '<div class="mini"><div class="mini-lbl"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg> Всего расходов</div><div class="mini-val">'+(data.totalCost!==undefined?String(data.totalCost).replace(/\s*zł\s*$/i,''):'—')+'<span class="u"> zł</span></div><div class="mini-sub">за всё время</div></div>',
    last_fuel: '<div class="mini" onclick="location.href=\'?page=fuel\'" style="cursor:pointer"><div class="mini-lbl"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.5" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg> Последняя заправка</div><div class="mini-val" id="homeLastFuelVal">—</div><div class="mini-sub" id="homeLastFuelSub">загрузка…</div></div>',
  };

  // ── Build sections ─────────────────────────────────
  const activeRem  = layout.reminders.filter(function(r){return r.enabled;});
  const activeMini = layout.minicards.filter(function(m){return m.enabled;});
  const secMap     = {};
  layout.sections.forEach(function(s){secMap[s.id]=s.enabled;});

  let remHTML = '';
  if (activeRem.length) {
    remHTML = '<div class="slbl">Ближайшие сроки</div><div class="group" style="padding:16px"><div class="reminders-row">';
    activeRem.forEach(function(r){
      var d = REM[r.id]; if(!d) return;
      remHTML += '<div class="reminder-item"><div class="reminder-circle '+d.cls+'">'+d.svg+'</div><div class="reminder-val">'+d.val+d.unit+'</div><div class="reminder-name">'+d.name+'</div></div>';
    });
    remHTML += '</div></div>';
  }

  let miniHTML = '';
  if (activeMini.length) {
    miniHTML = '<div class="mini-grid">';
    activeMini.forEach(function(m){ miniHTML += (MINI[m.id]||''); });
    miniHTML += '</div>';
  }

  const sparkHTML = secMap['spark'] !== false ? `
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
    </div>` : '';

  const quickHTML = secMap['quick'] !== false ? `
    <div class="slbl">Быстрый доступ</div>
    <div class="group">
      <div class="row" onclick="location.href='?page=addfuel'" style="cursor:pointer">
        <div class="row-icon" style="background:var(--accent-bg)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
        <div class="row-body"><div class="row-title">Добавить заправку</div></div>
        <div class="row-right"><div class="chevron">${CHV}</div></div>
      </div>
      <div class="row" onclick="location.href='?page=fuel'" style="cursor:pointer">
        <div class="row-icon" style="background:var(--orange-bg)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 22h18"/><path d="M7 14h4"/><path d="M7 10h4"/></svg></div>
        <div class="row-body"><div class="row-title">История заправок</div></div>
        <div class="row-right"><div class="chevron">${CHV}</div></div>
      </div>
      <div class="row" onclick="location.href='?page=service'" style="cursor:pointer">
        <div class="row-icon" style="background:var(--green-bg)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
        <div class="row-body"><div class="row-title">Обслуживание и ремонт</div></div>
        <div class="row-right"><div class="chevron">${CHV}</div></div>
      </div>
	  <!-- 👇 Новая строка для TCO -->
	  <div class="row" onclick="location.href='?page=tco'" style="cursor:pointer">
  <div class="row-icon" style="background:var(--accent-bg)">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/>
    </svg>
  </div>
  <div class="row-body">
    <div class="row-title">Стоимость владения</div>
  </div>
  <div class="row-right"><div class="chevron">${CHV}</div></div>
</div>
	  
    </div>` : '';

  DOM.pageContent.innerHTML =
    '<div class="anim">' +
    '<div class="hero blue"><div class="hero-lbl">Текущий пробег</div>' +
    '<div class="hero-val">'+(data.endKm?Number(data.endKm).toLocaleString('ru'):'—')+' <span class="hero-unit">км</span></div>' +
    '<div class="hero-sub">за период наблюдения '+(data.distance||'—')+' км</div>' +
    '<div class="hero-icon"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>' +
    '</div>' +
    miniHTML + remHTML + sparkHTML + quickHTML +
    '</div>';

  _populateHomeFromFuelCache();

  // Если кэша топлива нет — грузим в фоне и сразу заполняем блоки
  if (!readCache('fuel')) {
    _loadFuelForHome();
  }
}

// Фоновая загрузка топлива для главной страницы
async function _loadFuelForHome() {
  try {
    const res = await fetch(GAS_BASE_URL + '?page=fuel');
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return;
    writeCache('fuel', data);
    // Заполняем блоки если ещё на главной
    if ((getQueryParam('page')||'home') === 'home') {
      _populateHomeFromFuelCache();
    }
  } catch(e) { /* тихо */ }
}

// ── HOME HELPERS ──────────────────────────────────────────────
function n(val) {
  if (val === null || val === undefined || val === '') return NaN;
  return parseFloat(String(val).replace(',', '.'));
}

function _populateHomeFromFuelCache() {
  try {
    const cached = readCache('fuel');
    if (!cached) return;
    const fuelData = cached.data;
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

  // Weekly km driven
  const weekKm = weekFills.reduce((s,e) => s + (parseFloat(e.distance)||0), 0);

  // Prev week fallback
  let weekCostDisplay = weekCost > 0 ? weekCost.toFixed(0) : null;
  let weekLabel = 'текущая неделя';
  let weekKmDisplay = weekKm > 0 ? Math.round(weekKm) : null;
  let weekKmLabel = 'текущая неделя';
  if (!weekCostDisplay) {
    const ps = getWeekStart(now, 1);
    const pe = new Date(ps); pe.setDate(ps.getDate()+6); pe.setHours(23,59,59,999);
    const prevFills = data.filter(e => isDateInRange(e.date, ps, pe));
    const prevCost  = prevFills.reduce((s,e) => s + (parseFloat(e.totalCost)||0), 0);
    const prevKm    = prevFills.reduce((s,e) => s + (parseFloat(e.distance)||0), 0);
    weekCostDisplay = prevCost > 0 ? prevCost.toFixed(0) : '—';
    weekLabel = 'прошлая неделя';
    if (!weekKmDisplay) {
      weekKmDisplay = prevKm > 0 ? Math.round(prevKm) : null;
      weekKmLabel = 'прошлая неделя';
    }
  }
  weekKmDisplay = weekKmDisplay || '—';

  // Cost per km: gas vs petrol
  const gasData    = data.filter(e => (e.fuelType||'').toLowerCase().includes('газ'));
  const petrolData = data.filter(e => (e.fuelType||'').toLowerCase().includes('бензин') || (e.fuelType||'').toLowerCase().includes('petrol'));

  // Avg gas consumption (last 5 with valid consumption)
  const gasWithCons = gasData.filter(e => parseFloat(e.fuelConsumption) > 0);
  const last5gas    = gasWithCons.slice(-5);
  const avgGasCons  = last5gas.length
    ? (last5gas.reduce((s,e) => s + parseFloat(e.fuelConsumption), 0) / last5gas.length)
    : null;

  // Порог: расход бензина < 2.5 л/100 = доп. бензин в режиме газа (прогрев)
  const PETROL_EXTRA_THRESHOLD = 2.5;

  const petrolWithCons = petrolData.filter(e => parseFloat(e.fuelConsumption) > 0);
  // Чистый бензин — машина едет только на бензине
  const petrolPureMode  = petrolWithCons.filter(e => parseFloat(e.fuelConsumption) >= PETROL_EXTRA_THRESHOLD);
  // Доп. бензин — небольшой расход пока работает газ (прогрев, переключение)
  const petrolExtraMode = petrolWithCons.filter(e => parseFloat(e.fuelConsumption) < PETROL_EXTRA_THRESHOLD);

  // Средний расход чистого бензина (для сравнения)
  const last5petrol   = petrolPureMode.slice(-5);
  const avgPetrolCons = last5petrol.length
    ? (last5petrol.reduce((s,e) => s + parseFloat(e.fuelConsumption), 0) / last5petrol.length)
    : null;

  // Средний доп. расход бензина в режиме газа
  const avgPetrolExtra = petrolExtraMode.length
    ? (petrolExtraMode.reduce((s,e) => s + parseFloat(e.fuelConsumption), 0) / petrolExtraMode.length)
    : null;

  // Price per litre: gas (avg last 5 fills)
  const last5gasFills = gasData.slice(-5);
  const avgGasPrice   = last5gasFills.length
    ? (last5gasFills.reduce((s,e) => s + (parseFloat(e.pricePerLiter)||0), 0) / last5gasFills.filter(e => parseFloat(e.pricePerLiter) > 0).length)
    : null;

  // Price per litre: petrol pure (avg last 5 pure fills)
  const last5petrolFills = petrolPureMode.slice(-5);
  const petrolPrices = last5petrolFills.filter(e => parseFloat(e.pricePerLiter) > 0);
  const avgPetrolPrice = petrolPrices.length
    ? (petrolPrices.reduce((s,e) => s + parseFloat(e.pricePerLiter), 0) / petrolPrices.length)
    : null;

  // Price per litre: extra petrol (avg all extra fills)
  const extraPrices = petrolExtraMode.filter(e => parseFloat(e.pricePerLiter) > 0);
  const avgPetrolExtraPrice = extraPrices.length
    ? (extraPrices.reduce((s,e) => s + parseFloat(e.pricePerLiter), 0) / extraPrices.length)
    : null;

  // Cost per 100 km — газ
  const costGasPer100 = (avgGasCons && avgGasPrice)
    ? (avgGasCons * avgGasPrice).toFixed(2) : null;

  // Cost per 100 km — реальный режим ГБО = газ + доп. бензин
  const costExtraPetrolPer100 = (avgPetrolExtra && avgPetrolExtraPrice)
    ? avgPetrolExtra * avgPetrolExtraPrice : 0;
  const costGboModePer100 = costGasPer100
    ? (parseFloat(costGasPer100) + costExtraPetrolPer100).toFixed(2) : null;

  // Cost per 100 km — чистый бензин (для сравнения)
  const costPetrolPer100 = (avgPetrolCons && avgPetrolPrice)
    ? (avgPetrolCons * avgPetrolPrice).toFixed(2) : null;

  // Cost per km
  const costPerKmGas    = costGboModePer100 ? (parseFloat(costGboModePer100) / 100).toFixed(2) : '0.17';
  const costPerKmPetrol = costPetrolPer100  ? (parseFloat(costPetrolPer100)  / 100).toFixed(2) : '0.35';

  // Экономия: реальный режим ГБО (газ + доп. бензин) vs чистый бензин
  const savings = (costGboModePer100 && costPetrolPer100)
    ? (parseFloat(costPetrolPer100) - parseFloat(costGboModePer100)).toFixed(2)
    : null;

  // Валюта
  var ccy='zł'; try{ccy=JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'zł';}catch(e){}

  // Тренд расхода: текущий месяц vs предыдущий (по газу)
  const nowM = new Date();
  const curMonthKey  = `${nowM.getFullYear()}-${String(nowM.getMonth()+1).padStart(2,'0')}`;
  const prevMonthKey = (function(){ const d=new Date(nowM); d.setMonth(d.getMonth()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
  const gasConsData  = gasData.filter(e=>parseFloat(e.fuelConsumption)>0);
  function avgConsForMonth(mk){ const rows=gasConsData.filter(e=>{const d=parseCustomDate(e.date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===mk;}); return rows.length?(rows.reduce((s,e)=>s+parseFloat(e.fuelConsumption),0)/rows.length):null; }
  const curMonthCons  = avgConsForMonth(curMonthKey);
  const prevMonthCons = avgConsForMonth(prevMonthKey);
  let consTrendHTML = '';
  if (curMonthCons && prevMonthCons) {
    const diff = curMonthCons - prevMonthCons;
    const sign = diff > 0 ? '+' : '';
    const cls  = diff > 0
      ? 'style="color:#fff;background:rgba(255,255,255,.22);padding:1px 7px;border-radius:6px;font-weight:600"'
      : 'style="color:#fff;background:rgba(255,255,255,.22);padding:1px 7px;border-radius:6px;font-weight:600"';
    const arrow = diff > 0 ? '↑' : '↓';
    consTrendHTML = `<span ${cls}>${arrow} ${sign}${diff.toFixed(1)} л/100 vs прошлый мес.</span>`;
  } else if (curMonthCons) {
    consTrendHTML = `<span style="color:rgba(255,255,255,.7)">Расход ${curMonthCons.toFixed(1)} л/100 в этом мес.</span>`;
  }

  DOM.pageContent.innerHTML = `
    <div class="anim">

      <!-- ① HERO: Всего на топливо -->
      <div class="hero orange">
        <div class="hero-lbl">Всего на топливо</div>
        <div class="hero-val">${Math.round(totalFuelCost).toLocaleString('ru')} <span class="hero-unit">zł</span></div>
        <div class="hero-sub">${totalFills} заправок · ${consTrendHTML || 'за весь период'}</div>
        <div class="hero-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M17 12h1a2 2 0 0 1 2 2v1a2 2 0 0 0 4 0V9l-3-3"/><path d="M3 22h18"/><path d="M7 14h4"/><path d="M7 10h4"/></svg>
        </div>
      </div>

      <!-- ② ROW 1: Пробег за неделю + Топливо за неделю -->
      <div class="mini-grid">
        <div class="mini">
          <div class="mini-lbl"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> Пробег / нед.</div>
          <div class="mini-val">${weekKmDisplay}<span class="u"> км</span></div>
          <div class="mini-sub">${weekKmLabel}</div>
        </div>
        <div class="mini">
          <div class="mini-lbl"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.5" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 22h18"/></svg> Топливо / нед.</div>
          <div class="mini-val">${weekCostDisplay}<span class="u"> zł</span></div>
          <div class="mini-sub">${weekLabel}</div>
        </div>
      </div>

      <!-- ③ ROW 2: Средний расход + Запас хода -->
      <div class="mini-grid">
        <div class="mini">
          <div class="mini-lbl"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg> Расход газа</div>
          <div class="mini-val">${avgGas}<span class="u"> л/100</span></div>
          <div class="mini-sub">среднее · 5 заправок</div>
        </div>
        <div class="mini">
          <div class="mini-lbl"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Запас хода</div>
          <div class="mini-val"><span id="fuelRangeKm">—</span><span class="u"> км</span></div>
          <div class="mini-sub" id="fuelRangeDetails">при полном баке (34 л)</div>
        </div>
      </div>

      <!-- ④ ROW 3: 1 км · ГБО + Последняя заправка -->
      <div class="mini-grid">
        <div class="mini" style="background:var(--green-bg);border:1px solid rgba(52,199,89,0.2)">
          <div class="mini-lbl" style="color:var(--green)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg> 1 км · ГБО</div>
          <div class="mini-val" style="color:var(--green)">${costPerKmGas}<span class="u" style="color:var(--green)"> zł</span></div>
          <div class="mini-sub">vs ${costPerKmPetrol} zł бензин</div>
        </div>
        <div class="mini">
          <div class="mini-lbl"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="2.5" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M17 12h1a2 2 0 0 1 2 2v1a2 2 0 0 0 4 0V9l-3-3"/><path d="M3 22h18"/><path d="M7 14h4"/><path d="M7 10h4"/></svg> Последняя</div>
          <div class="mini-val">${latest.fuelAmount || '—'}<span class="u"> л</span></div>
          <div class="mini-sub">${formatDate(latest.date)} · ${latest.totalCost || '—'} zł${latest.distance ? ' · ' + latest.distance + ' км' : ''}</div>
        </div>
      </div>

      <!-- ④b ROW 4: Газ vs Бензин сводка -->
      <div class="mini" style="margin:0 0 8px">
        <div class="mini-lbl" style="font-size:13px;font-weight:600;color:var(--text)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;margin-right:4px"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Сводка · ${totalFills} заправок</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <div style="background:var(--orange-bg);border-radius:10px;padding:10px 12px">
            <div style="font-size:11px;font-weight:600;color:var(--orange);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Газ · ${gasData.length} зап.</div>
            <div style="font-size:18px;font-weight:700;color:var(--text);line-height:1">${Math.round(gasData.reduce((s,e)=>s+(parseFloat(e.fuelAmount)||0),0))}<span style="font-size:12px;font-weight:400;color:var(--text2)"> л</span></div>
            <div style="font-size:12px;color:var(--text2);margin-top:3px">${Math.round(gasData.reduce((s,e)=>s+(parseFloat(e.totalCost)||0),0))} zł</div>
          </div>
          <div style="background:var(--red-bg);border-radius:10px;padding:10px 12px">
            <div style="font-size:11px;font-weight:600;color:var(--red);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Бензин · ${petrolData.length} зап.</div>
            <div style="font-size:18px;font-weight:700;color:var(--text);line-height:1">${Math.round(petrolData.reduce((s,e)=>s+(parseFloat(e.fuelAmount)||0),0))}<span style="font-size:12px;font-weight:400;color:var(--text2)"> л</span></div>
            <div style="font-size:12px;color:var(--text2);margin-top:3px">${Math.round(petrolData.reduce((s,e)=>s+(parseFloat(e.totalCost)||0),0))} zł</div>
          </div>
        </div>
      </div>

      <!-- ⑤ ТРЕНД: SVG chart как в Auris iOS -->
      <div class="slbl">Расход л/100 км · динамика</div>
      <div class="group" style="padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap">
          <div class="ios-seg" id="fuelChartSeg">
            <div class="ios-seg-btn active" data-fuel="gas">Газ</div>
            <div class="ios-seg-btn" data-fuel="petrol">Бензин ≥2.5</div>
            <div class="ios-seg-btn" data-fuel="gbo">ГБО режим</div>
          </div>
          <div class="chips" id="chartPeriodChips" style="margin-bottom:0">
            <div class="chip active" data-cperiod="fills5">5 запр.</div>
            <div class="chip" data-cperiod="3">3 мес</div>
            <div class="chip" data-cperiod="6">6 мес</div>
            <div class="chip" data-cperiod="12">Год</div>
            <div class="chip" data-cperiod="all">Всё</div>
          </div>
        </div>
        <div class="chart-wrap" id="svgChartWrap">
          <svg class="chart-svg" id="svgConsChart" height="160"></svg>
          <div class="chart-tooltip" id="svgChartTip"></div>
        </div>
        <div class="chart-legend" style="margin-top:10px;padding-top:10px;border-top:0.5px solid var(--sep);display:flex;gap:18px;flex-wrap:wrap">
          <div class="cl"><div class="cl-sw" id="chartLegendSw" style="background:var(--accent)"></div><span id="chartLegendMain">Расход л/100 км</span></div>
          <div class="cl" id="chartLegendExtra" style="display:none"><div class="cl-sw" style="background:var(--text3);height:2px;border-top:2px dashed var(--text3)"></div>Доп. бензин л/100 км</div>
          <div class="cl"><div class="cl-sw" style="background:var(--orange);opacity:.7"></div><span id="avgLegendLabel">Среднее</span></div>
        </div>
      </div>

      <!-- ⑥-pre: ПРОБЕГ ПО МЕСЯЦАМ -->
      ${(function(){
        var yearsSet = {};
        data.forEach(function(e){ try{ var y=parseCustomDate(e.date).getFullYear(); if(!isNaN(y)&&y>2000) yearsSet[y]=1; }catch(ex){} });
        var years = Object.keys(yearsSet).map(Number).sort(function(a,b){return b-a;});
        var curY = new Date().getFullYear();
        var yearChips = years.map(function(y){
          return '<div class="chip'+(y===curY?' active':'')+'" data-mileage-year="'+y+'">'+y+'</div>';
        }).join('');
        return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
          '<div class="slbl" style="margin:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-2px;margin-right:5px;color:var(--text2)"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Пробег по месяцам</div>'+
          '<div class="chips" id="mileageYearChips" style="margin:0">'+yearChips+'</div>'+
        '</div>'+
        '<div class="group" style="padding:14px 12px 10px" id="mileageChartWrap">'+
          _buildFuelMileageChart(data, curY)+
        '</div>';
      })()}

      <!-- ⑥ ГБО ЭКОНОМИЯ — карточка сравнения -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="slbl" style="margin:0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-2px;margin-right:5px;color:var(--text2)"><line x1="18" y1="6" x2="6" y2="18"/><line x1="8" y1="6" x2="18" y2="16"/></svg>Газ vs Бензин</div>
        <div class="chips" id="gvsbPeriodChips" style="margin:0">
          <div class="chip active" data-gvsb="5">5 запр.</div>
          <div class="chip" data-gvsb="3">3 мес</div>
          <div class="chip" data-gvsb="6">6 мес</div>
          <div class="chip" data-gvsb="12">Год</div>
          <div class="chip" data-gvsb="all">Всё</div>
        </div>
      </div>
      <div class="group" id="gvsbCard" style="padding:16px">

        <!-- Две колонки: режим ГБО | чистый бензин -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">

          <!-- Колонка: Режим ГБО -->
          <div style="background:var(--orange-bg);border-radius:12px;padding:12px">
            <div style="font-size:11px;font-weight:600;color:var(--orange);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">
              Режим ГБО
            </div>
            <div style="font-size:22px;font-weight:700;color:var(--text);letter-spacing:-0.5px;font-family:var(--font-r);line-height:1">
              ${costGboModePer100||'—'}
              <span style="font-size:12px;font-weight:400;color:var(--text2)">${ccy}/100км</span>
            </div>
            <div style="font-size:12px;color:var(--text2);margin-top:5px">газ ${avgGas} л/100</div>
            ${avgPetrolExtra ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">+ доп. бензин ${avgPetrolExtra.toFixed(2)} л/100</div>` : ''}
          </div>

          <!-- Колонка: Чистый бензин -->
          <div style="background:var(--red-bg);border-radius:12px;padding:12px">
            <div style="font-size:11px;font-weight:600;color:var(--red);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">
              Бензин
            </div>
            <div style="font-size:22px;font-weight:700;color:var(--text);letter-spacing:-0.5px;font-family:var(--font-r);line-height:1">
              ${costPetrolPer100||'—'}
              <span style="font-size:12px;font-weight:400;color:var(--text2)">${ccy}/100км</span>
            </div>
            <div style="font-size:12px;color:var(--text2);margin-top:5px">${avgPetrolCons?avgPetrolCons.toFixed(1):'—'} л/100</div>
          </div>
        </div>

        <!-- Экономия -->
        ${savings ? `
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--green-bg);border-radius:10px;padding:10px 14px">
          <div>
            <div style="font-size:12px;color:var(--green);font-weight:600;margin-bottom:1px">Экономия на 100 км</div>
            <div style="font-size:11px;color:var(--text2)">режим ГБО дешевле чистого бензина</div>
          </div>
          <div style="font-size:20px;font-weight:700;color:var(--green);font-family:var(--font-r);letter-spacing:-0.5px">
            +${savings} <span style="font-size:12px;font-weight:500">${ccy}</span>
          </div>
        </div>
        <div style="text-align:right;margin-top:6px;font-size:12px;color:var(--green);font-weight:600">
          ${Math.round(parseFloat(savings)/parseFloat(costPetrolPer100)*100)}% дешевле
        </div>` : ''}

      </div>

      <!-- ⑦ ИСТОРИЯ -->
      <div class="slbl"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-2px;margin-right:5px;color:var(--text2)"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>История заправок</div>

      <!-- Строка поиска по дате -->
      <div class="search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="historySearch" placeholder="Поиск по дате… напр. 03.2025" oninput="_applyHistoryFilters()">
        <svg id="historySearchClear" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linecap="round" style="cursor:pointer;display:none" onclick="document.getElementById('historySearch').value='';_applyHistoryFilters()"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>

      <!-- Фильтры: период + тип/расход в одном ряду -->
      <div class="chips" id="periodChips">
        <div class="chip" data-period="week">Неделя</div>
        <div class="chip active" data-period="month">Месяц</div>
        <div class="chip" data-period="year">Год</div>
        <div class="chip" data-period="all">Всё</div>
      </div>
      <div class="chips" id="sortChips" style="margin-top:2px">
        <div class="chip active" data-sort="all">Все типы</div>
        <div class="chip" data-sort="gas">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>Газ
        </div>
        <div class="chip" data-sort="petrol">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 22h18"/></svg>Бензин
        </div>
        <div class="chip" data-sort="high">↑ Высокий</div>
        <div class="chip" data-sort="low">↓ Низкий</div>
      </div>

      <div class="group" id="historyList">
        ${buildFillRows(filterDataByPeriod(sorted, 'month'))}
      </div>

    </div>
  `;

  // ── Состояние фильтров ─────────────────────────────────
  // Сохраняем данные глобально для доступа из oninput
  window._fuelSorted   = sorted;
  window._activePeriod = 'month';
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

  // SVG chart
  window._fuelRawData     = data;
  window._fuelChartMonths = 'fills5';
  window._fuelChartMode   = 'gas';
  setTimeout(() => {
    buildSVGFuelChart(data, 'fills5', 'gas');

    // Период
    document.querySelectorAll('#chartPeriodChips .chip').forEach(chip => {
      chip.addEventListener('click', function() {
        document.querySelectorAll('#chartPeriodChips .chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        const val = this.dataset.cperiod;
        window._fuelChartMonths = val;
        buildSVGFuelChart(window._fuelRawData, val, window._fuelChartMode);
      });
    });

    // Период Газ vs Бензин
    document.querySelectorAll('#gvsbPeriodChips .chip').forEach(chip => {
      chip.addEventListener('click', function() {
        document.querySelectorAll('#gvsbPeriodChips .chip').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        _updateGvsB(window._fuelRawData, this.dataset.gvsb);
      });
    });

    // Тип топлива
    document.querySelectorAll('#fuelChartSeg .ios-seg-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('#fuelChartSeg .ios-seg-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        window._fuelChartMode = this.dataset.fuel;
        buildSVGFuelChart(window._fuelRawData, window._fuelChartMonths, window._fuelChartMode);
      });
    });
  }, 80);

  // Mileage year chips
  document.querySelectorAll('#mileageYearChips .chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      document.querySelectorAll('#mileageYearChips .chip').forEach(function(c){ c.classList.remove('active'); });
      this.classList.add('active');
      var yr = parseInt(this.dataset.mileageYear);
      var wrap = document.getElementById('mileageChartWrap');
      if (wrap) wrap.innerHTML = _buildFuelMileageChart(window._fuelRawData, yr);
      _initFuelMileageClicks();
    });
  });
  setTimeout(function(){ _initFuelMileageClicks(); }, 120);

  // Range card
  if (typeof updateFuelRangeDisplay === 'function') updateFuelRangeDisplay(data);
}

// ── SVG FUEL CHART (like Auris iOS v4) ─────────────────
function buildSVGFuelChart(rawData, months, mode) {
  months = (months === undefined) ? (window._fuelChartMonths || 'fills5') : months;
  mode   = mode || window._fuelChartMode || 'gas';

  // Фильтр по периоду
  let periodData = rawData;
  if (months === 'fills5') {
    // Последние 5 заправок каждого типа — берём последние 5 газовых + 5 бензиновых
    const THRESHOLD = 2.5;
    const all = Array.isArray(rawData) ? rawData : [];
    const gasF    = all.filter(e => (e.fuelType||'').toLowerCase().includes('газ') && parseFloat(e.fuelConsumption) > 0);
    const petrolF = all.filter(e => { const t=(e.fuelType||'').toLowerCase(); return (t.includes('бензин')||t.includes('petrol')) && parseFloat(e.fuelConsumption) >= THRESHOLD; });
    const extraF  = all.filter(e => { const t=(e.fuelType||'').toLowerCase(); const c=parseFloat(e.fuelConsumption); return (t.includes('бензин')||t.includes('petrol')) && c > 0 && c < THRESHOLD; });
    // Берём ключи дат последних 5 из каждой группы, собираем в periodData
    const lastDates = new Set([
      ...gasF.slice(-5).map(e=>e.date),
      ...petrolF.slice(-5).map(e=>e.date),
      ...extraF.slice(-5).map(e=>e.date),
    ]);
    periodData = all.filter(e => lastDates.has(e.date));
  } else if (months !== 'all' && !isNaN(parseInt(months))) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - parseInt(months));
    cutoff.setDate(1); cutoff.setHours(0,0,0,0);
    periodData = Array.isArray(rawData) ? rawData.filter(e => {
      if (!e.date) return false;
      const d = parseCustomDate(e.date);
      return !isNaN(d.getTime()) && d >= cutoff;
    }) : [];
  }

  // Цвет зависит от режима
  const lineColor = mode === 'petrol' ? 'var(--red)' : mode === 'gbo' ? 'var(--orange)' : mode === 'all' ? 'var(--indigo)' : 'var(--accent)';
  const sw = document.getElementById('chartLegendSw');
  if (sw) sw.style.background = lineColor;

  // Легенда доп. бензина — только для ГБО режима
  const legendExtra = document.getElementById('chartLegendExtra');
  if (legendExtra) legendExtra.style.display = mode === 'gbo' ? 'flex' : 'none';
  const legendMain = document.getElementById('chartLegendMain');
  if (legendMain) legendMain.textContent = mode === 'gbo' ? 'Газ л/100 км' : 'Расход л/100 км';

  const CHART_PETROL_THRESHOLD = 2.5;

  // Для ГБО-режима нужно два набора данных
  let monthlyData = [];
  let monthlyDataExtra = []; // доп. бензин (только для gbo)

  if (typeof calculateMonthlyAverages === 'function' && typeof sortMonthlyData === 'function') {
    const makeFiltered = (predicate) => Array.isArray(periodData)
      ? periodData.filter(e => {
          const hasCons = e.fuelConsumption && !isNaN(parseFloat(e.fuelConsumption)) && parseFloat(e.fuelConsumption) > 0;
          return hasCons && predicate(e);
        })
      : [];

    const isGas    = e => (e.fuelType||'').toLowerCase().includes('газ');
    const isPetrol = e => { const t=(e.fuelType||'').toLowerCase(); return t.includes('бензин')||t.includes('petrol'); };
    const cons     = e => parseFloat(e.fuelConsumption);

    let primary;
    if (mode === 'gas')    primary = makeFiltered(isGas);
    else if (mode === 'petrol') primary = makeFiltered(e => isPetrol(e) && cons(e) >= CHART_PETROL_THRESHOLD);
    else if (mode === 'gbo')   { primary = makeFiltered(isGas); }
    else primary = makeFiltered(e => isGas(e) || (isPetrol(e) && cons(e) >= CHART_PETROL_THRESHOLD));

    monthlyData = sortMonthlyData(calculateMonthlyAverages(primary));

    // Доп. бензин для ГБО-режима
    if (mode === 'gbo') {
      const extra = makeFiltered(e => isPetrol(e) && cons(e) < CHART_PETROL_THRESHOLD);
      monthlyDataExtra = sortMonthlyData(calculateMonthlyAverages(extra));
    }
  }

  const svg = document.getElementById('svgConsChart');
  const wrap = document.getElementById('svgChartWrap');
  const tip  = document.getElementById('svgChartTip');
  if (!svg || !wrap) return;

  if (!monthlyData || monthlyData.length < 2) {
    // Убираем старое сообщение если было
    const oldMsg = wrap.querySelector('.chart-empty-msg');
    if (oldMsg) oldMsg.remove();
    svg.style.display = 'none';

    const isPetrolMode = mode === 'petrol';
    const isGboMode    = mode === 'gbo';
    const icon = isPetrolMode || isGboMode
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="1.5" stroke-linecap="round"><path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/><path d="M3 22h18"/><path d="M7 14h4"/><path d="M7 10h4"/></svg>'
      : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    const title = isPetrolMode ? 'Нет данных о чистом бензине'
      : isGboMode ? 'Нет данных о газе за период'
      : 'Нет данных за выбранный период';
    const sub = isPetrolMode
      ? 'Учитываются только заправки с расходом ≥ 2.5 л/100.<br>Доп. расход в режиме ГБО исключён.'
      : isGboMode ? 'Попробуйте выбрать более длинный период.'
      : 'Попробуйте выбрать более длинный период.';

    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'chart-empty-msg';
    emptyDiv.style.cssText = 'text-align:center;padding:28px 16px;color:var(--text2)';
    emptyDiv.innerHTML = `${icon}<div style="font-size:14px;font-weight:600;color:var(--text);margin:8px 0 4px">${title}</div><div style="font-size:12px;line-height:1.5">${sub}</div>`;
    wrap.appendChild(emptyDiv);
    return;
  }

  // Убираем сообщение если данные появились
  const oldMsg = wrap.querySelector('.chart-empty-msg');
  if (oldMsg) oldMsg.remove();
  svg.style.display = 'block';

  const W = wrap.clientWidth || 320;
  const H = 160, pL = 30, pR = 8, pT = 12, pB = 26;
  const cW = W - pL - pR, cH = H - pT - pB;

  // Объединяем оба набора для единого масштаба Y
  const allVals = [
    ...monthlyData.map(d => d.average),
    ...monthlyDataExtra.map(d => d.average)
  ];
  const vals = monthlyData.map(d => d.average);
  const minV = Math.min(...allVals) - 0.4;
  const maxV = Math.max(...allVals) + 0.4;
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
  grad.appendChild(mk('stop', { offset:'0%', 'stop-color':lineColor, 'stop-opacity':'0.18' }));
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
  svg.appendChild(mk('polyline', { points:pts, fill:'none', stroke:lineColor, 'stroke-width':'2', 'stroke-linecap':'round', 'stroke-linejoin':'round' }));

  // Вторая линия — доп. бензин (только для ГБО-режима)
  if (mode === 'gbo' && monthlyDataExtra.length >= 2) {
    // Строим маппинг месяц→x по основным данным
    const monthToX = {};
    monthlyData.forEach((d, i) => { monthToX[d.monthKey] = xS(i); });
    // Для доп. бензина используем те же x-позиции где есть совпадение, иначе линейную интерполяцию
    const extraPts = monthlyDataExtra
      .filter(d => d.average > 0)
      .map((d, i) => {
        // xS по индексу в extra-массиве, mapped на ту же ширину
        const x = pL + (i / (monthlyDataExtra.length - 1)) * cW;
        return `${x},${yS(d.average)}`;
      }).join(' ');
    if (extraPts) {
      svg.appendChild(mk('polyline', {
        points: extraPts, fill:'none', stroke:'var(--text3)',
        'stroke-width':'1.5', 'stroke-dasharray':'5 3',
        'stroke-linecap':'round', 'stroke-linejoin':'round'
      }));
      // Точки доп. бензина
      monthlyDataExtra.forEach((d, i) => {
        const cx = pL + (i / (monthlyDataExtra.length - 1)) * cW;
        const cy = yS(d.average);
        const dot = mk('circle', { cx, cy, r:'3', fill:'var(--text3)', stroke:'var(--grouped)', 'stroke-width':'2' });
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', () => {
          tip.style.display = 'block';
          tip.innerHTML = `<b>${d.average.toFixed(2)} л/100</b><span style="color:var(--text2)"> доп. бензин · ${d.monthName}</span>`;
          let left = cx - 60; left = Math.max(0, Math.min(W - 130, left));
          tip.style.left = left + 'px'; tip.style.top = (cy - 70) + 'px';
          setTimeout(() => tip.style.display = 'none', 2200);
        });
        svg.appendChild(dot);
      });
    }
  }

  // Dots + x-labels + tooltips
  monthlyData.forEach((d, i) => {
    const cx = xS(i), cy = yS(d.average);
    const dot = mk('circle', { cx, cy, r:'4', fill:lineColor, stroke:'var(--grouped)', 'stroke-width':'2.5' });
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



function _buildFuelMileageChart(rawData, yearSel) {
  if (!Array.isArray(rawData) || !rawData.length) return '<div class="empty-state" style="padding:20px 0">Нет данных</div>';

  var monthly = {};
  var RU_MON  = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  rawData.forEach(function(e) {
    try {
      var d = parseCustomDate(e.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== yearSel) return;
      var m   = d.getMonth()+1;
      var key = yearSel + '-' + String(m).padStart(2,'0');
      if (!monthly[key]) monthly[key] = {
        lbl:     RU_MON[m-1],
        fullLbl: d.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(' г.',''),
        km:0, cost:0, fills:0, month:m, year:yearSel
      };
      monthly[key].km   += parseFloat(e.distance)  || 0;
      monthly[key].cost += parseFloat(e.totalCost) || 0;
      monthly[key].fills++;
    } catch(ex) {}
  });

  var curYear = new Date().getFullYear(), curMonth = new Date().getMonth()+1;
  var maxMonth = (yearSel === curYear) ? curMonth : 12;
  for (var m = 1; m <= maxMonth; m++) {
    var k = yearSel + '-' + String(m).padStart(2,'0');
    if (!monthly[k]) monthly[k] = {lbl:RU_MON[m-1], fullLbl:RU_MON[m-1]+' '+yearSel, km:0, cost:0, fills:0, month:m, year:yearSel};
  }

  var keys   = Object.keys(monthly).sort();
  var vals   = keys.map(function(k){ return monthly[k].km; });
  var maxVal = Math.max.apply(null, vals) || 1;
  var n      = keys.length;

  var CHART_H = 100;
  var BAR_W   = Math.max(20, Math.min(40, Math.floor(300/n)-4));
  var GAP     = Math.max(4,  Math.floor(BAR_W * 0.25));

  var totalKm   = vals.reduce(function(s,v){return s+v;},0);
  var totalCost = keys.reduce(function(s,k){return s+monthly[k].cost;},0);
  var activeMon = vals.filter(function(v){return v>0;}).length;
  var avgKm     = activeMon ? Math.round(totalKm/activeMon) : 0;
  var ccy = 'zł'; try{ccy=JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'zł';}catch(e){}

  var barsHTML = '';
  keys.forEach(function(k, i) {
    var v      = monthly[k].km;
    var bh     = Math.max(4, Math.round((v/maxVal)*CHART_H));
    var isCur  = (monthly[k].month === curMonth && monthly[k].year === curYear);
    var isMax  = (v === maxVal && v > 0);
    var isEmpty = v === 0;

    var bg  = isEmpty ? 'var(--bg2)' : isCur ? 'var(--green)' : isMax ? 'var(--accent)' : 'var(--accent-bg)';
    var hov = isEmpty ? 'var(--bg2)' : isCur ? '#25a244'      : isMax ? '#0060d0'       : 'var(--indigo)';

    // Метка внутри столбца у верхней кромки — только если столбец достаточно высокий
    var MIN_BH_FOR_LABEL = 20;
    var insideLabel = '';
    if (v > 0 && bh >= MIN_BH_FOR_LABEL) {
      // белый для ярких, тёмный для приглушённых
      var txtClr = (isCur || isMax) ? '#fff' : 'var(--text2)';
      // bottom = 20 (отступ контейнера) + bh - 16 (16px от верха столбца вниз)
      var lblBottom = 20 + bh - 16;
      insideLabel = '<div style="position:absolute;bottom:'+lblBottom+'px;left:0;right:0;text-align:center;font-size:9px;font-weight:700;color:'+txtClr+';pointer-events:none;line-height:1">'+Math.round(v).toLocaleString('ru')+'</div>';
    }

    var showMonLbl = (n <= 12) || (i % 2 === 0);

    barsHTML +=
      '<div class="fuel-mile-col"'+
        ' data-month="'+monthly[k].fullLbl+'"'+
        ' data-monthkey="'+k+'"'+
        ' data-km="'+Math.round(v)+'"'+
        ' data-cost="'+Math.round(monthly[k].cost)+'"'+
        ' data-fills="'+monthly[k].fills+'"'+
        ' style="position:relative;display:inline-flex;flex-direction:column;align-items:center;width:'+BAR_W+'px;margin:0 '+(GAP/2)+'px;height:'+(CHART_H+20)+'px;vertical-align:bottom;cursor:pointer">'+
        '<div class="fuel-mile-inner" data-bg="'+bg+'" data-hover="'+hov+'"'+
          ' style="position:absolute;bottom:20px;width:100%;height:'+bh+'px;background:'+bg+';border-radius:4px 4px 2px 2px;transition:background .15s,transform .1s"></div>'+
        insideLabel+
        (showMonLbl ? '<div style="position:absolute;bottom:3px;font-size:9px;color:'+(isCur?'var(--green)':'var(--text2)')+';font-weight:'+(isCur?700:400)+'">'+monthly[k].lbl+'</div>' : '')+
      '</div>';
  });

  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">'+
      '<div style="display:flex;gap:16px">'+
        '<div><div style="font-size:11px;color:var(--text2)">Итого</div><div style="font-size:16px;font-weight:700;color:var(--text)">'+Math.round(totalKm).toLocaleString('ru')+'<span style="font-size:11px;font-weight:400;color:var(--text2)"> км</span></div></div>'+
        '<div><div style="font-size:11px;color:var(--text2)">Ср./мес.</div><div style="font-size:16px;font-weight:700;color:var(--text)">'+avgKm.toLocaleString('ru')+'<span style="font-size:11px;font-weight:400;color:var(--text2)"> км</span></div></div>'+
        '<div><div style="font-size:11px;color:var(--text2)">Топливо</div><div style="font-size:16px;font-weight:700;color:var(--orange)">'+Math.round(totalCost).toLocaleString('ru')+'<span style="font-size:11px;font-weight:400;color:var(--text2)"> '+ccy+'</span></div></div>'+
      '</div>'+
    '</div>'+
    '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">'+
      '<div id="fuelMileWrap" style="display:flex;align-items:flex-end;padding:8px 4px 0;min-width:'+((BAR_W+GAP)*n+GAP)+'px">'+barsHTML+'</div>'+
      '<div id="fuelMileTip" style="display:none;position:fixed;background:var(--grouped);border:0.5px solid var(--sep);border-radius:10px;padding:9px 13px;font-size:13px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:500;min-width:155px;"></div>'+
    '</div>'+
    '<div id="fuelWeekDrill" style="margin-top:12px"></div>';
}

function _buildFuelWeekChart(rawData, monthKey) {
  var parts = monthKey.split('-');
  var yr = parseInt(parts[0]), mo = parseInt(parts[1]);
  var ccy = 'zł'; try{ccy=JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'zł';}catch(e){}
  var RU_MON = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

  var weeks = {};
  rawData.forEach(function(e) {
    try {
      var d = parseCustomDate(e.date);
      if (isNaN(d.getTime()) || d.getFullYear()!==yr || d.getMonth()+1!==mo) return;
      var day = d.getDate();
      var wn  = Math.ceil(day/7);
      if (!weeks[wn]) weeks[wn] = {km:0, cost:0, fills:0, minDay:day, maxDay:day};
      weeks[wn].km   += parseFloat(e.distance)||0;
      weeks[wn].cost += parseFloat(e.totalCost)||0;
      weeks[wn].fills++;
      weeks[wn].minDay = Math.min(weeks[wn].minDay, day);
      weeks[wn].maxDay = Math.max(weeks[wn].maxDay, day);
    } catch(ex) {}
  });

  var wkeys = Object.keys(weeks).map(Number).sort();
  if (!wkeys.length) return '<div style="padding:10px 0;font-size:13px;color:var(--text2);text-align:center">Нет данных о пробеге</div>';

  var vals   = wkeys.map(function(w){ return weeks[w].km; });
  var maxVal = Math.max.apply(null, vals) || 1;
  var CHART_H = 100;
  var BAR_W   = Math.max(40, Math.min(60, Math.floor(280/wkeys.length)-8));
  var GAP     = 10;
  var curDay  = new Date().getDate(), curMo = new Date().getMonth()+1, curYr = new Date().getFullYear();

  var barsHTML = '';
  wkeys.forEach(function(w) {
    var v   = weeks[w].km;
    var bh  = Math.max(4, Math.round((v/maxVal)*CHART_H));
    var isCurWeek = (yr===curYr && mo===curMo && Math.ceil(curDay/7)===w);
    var isMax = (v === maxVal && v > 0);
    var bg  = isCurWeek ? 'var(--green)' : isMax ? 'var(--accent)' : 'var(--accent-bg)';
    var hov = isCurWeek ? '#25a244'      : isMax ? '#0060d0'       : 'var(--indigo)';

    var MIN_BH_FOR_LABEL = 20;
    var insideLabel = '';
    if (v > 0 && bh >= MIN_BH_FOR_LABEL) {
      var txtClr = (isCurWeek || isMax) ? '#fff' : 'var(--text2)';
      var lblBottom = 30 + bh - 16;
      insideLabel = '<div style="position:absolute;bottom:'+lblBottom+'px;left:0;right:0;text-align:center;font-size:10px;font-weight:700;color:'+txtClr+';pointer-events:none;line-height:1">'+Math.round(v)+' км</div>';
    }

    barsHTML +=
      '<div class="fuel-week-col"'+
        ' data-label="'+w+' нед. · '+weeks[w].minDay+'–'+weeks[w].maxDay+'"'+
        ' data-km="'+Math.round(v)+'"'+
        ' data-cost="'+Math.round(weeks[w].cost)+'"'+
        ' data-fills="'+weeks[w].fills+'"'+
        ' style="position:relative;display:inline-flex;flex-direction:column;align-items:center;width:'+BAR_W+'px;margin:0 '+(GAP/2)+'px;height:'+(CHART_H+32)+'px;vertical-align:bottom">'+
        '<div class="fuel-week-inner" data-bg="'+bg+'" data-hover="'+hov+'"'+
          ' style="position:absolute;bottom:30px;width:100%;height:'+bh+'px;background:'+bg+';border-radius:5px 5px 2px 2px;transition:background .15s"></div>'+
        insideLabel+
        '<div style="position:absolute;bottom:14px;font-size:10px;color:'+(isCurWeek?'var(--green)':'var(--text2)')+';font-weight:'+(isCurWeek?700:500)+'">'+w+' нед.</div>'+
        '<div style="position:absolute;bottom:2px;font-size:9px;color:var(--text3)">'+weeks[w].minDay+'–'+weeks[w].maxDay+'</div>'+
      '</div>';
  });

  var monTitle = (RU_MON[mo-1].charAt(0).toUpperCase()+RU_MON[mo-1].slice(1))+' '+yr;
  return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-top:12px;border-top:0.5px solid var(--sep)">'+
      '<div style="font-size:13px;font-weight:600;color:var(--text)">'+
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;margin-right:5px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'+
        monTitle+' — по неделям'+
      '</div>'+
      '<button onclick="document.getElementById(\'fuelWeekDrill\').innerHTML=\'\'" style="font-size:12px;color:var(--accent);background:none;border:none;cursor:pointer;padding:2px 4px">✕</button>'+
    '</div>'+
    '<div style="overflow-x:auto">'+
      '<div style="display:flex;align-items:flex-end;padding:8px 4px 0;min-width:'+((BAR_W+GAP)*wkeys.length)+'px">'+barsHTML+'</div>'+
    '</div>';
}

function _initFuelWeekClicks() {
  var cols = document.querySelectorAll('.fuel-week-col');
  if (!cols.length) return;
  var ccy = 'zł'; try{ccy=JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'zł';}catch(e){}

  // Создаём тултип если нет
  var tip = document.getElementById('fuelWeekTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'fuelWeekTip';
    tip.style.cssText = 'display:none;position:fixed;background:var(--grouped);border:0.5px solid var(--sep);border-radius:10px;padding:9px 13px;font-size:13px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:500;min-width:160px;';
    document.getElementById('app').appendChild(tip);
  }

  function showTip(col, x, y) {
    var km    = parseInt(col.dataset.km)   || 0;
    var cost  = parseInt(col.dataset.cost) || 0;
    var fills = parseInt(col.dataset.fills)|| 0;
    var cPerKm = (km > 0 && cost > 0) ? (cost/km).toFixed(2) : null;
    tip.innerHTML =
      '<div style="font-weight:600;color:var(--text);margin-bottom:5px">'+col.dataset.label+'</div>'+
      (km > 0
        ? '<div style="color:var(--text2)">Пробег: <b style="color:var(--text)">'+km.toLocaleString('ru')+' км</b></div>'
        : '<div style="color:var(--text3)">Нет данных о пробеге</div>')+
      (cost > 0
        ? '<div style="color:var(--text2)">Топливо: <b style="color:var(--orange)">'+cost.toLocaleString('ru')+' '+ccy+'</b></div>'
        : '')+
      (fills > 0
        ? '<div style="color:var(--text2)">Заправок: <b style="color:var(--text)">'+fills+'</b></div>'
        : '')+
      (cPerKm
        ? '<div style="color:var(--text2);margin-top:4px;padding-top:4px;border-top:0.5px solid var(--sep)">'+cPerKm+' '+ccy+'/км</div>'
        : '');
    tip.style.display = 'block';
    var tw = tip.offsetWidth || 170, vw = window.innerWidth;
    tip.style.left = Math.min(x+12, vw-tw-12) + 'px';
    tip.style.top  = (y - 130) + 'px';
    var bar = col.querySelector('.fuel-week-inner');
    if (bar) { bar.style.background = bar.dataset.hover; bar.style.transform = 'scaleY(1.05)'; }
  }
  function hideTip(col) {
    tip.style.display = 'none';
    if (col) { var bar = col.querySelector('.fuel-week-inner'); if (bar) { bar.style.background = bar.dataset.bg; bar.style.transform = ''; } }
  }

  cols.forEach(function(col) {
    col.addEventListener('touchstart', function(e){ e.preventDefault(); var t=e.touches[0]; showTip(col,t.clientX,t.clientY); }, {passive:false});
    col.addEventListener('touchend',   function(){ setTimeout(function(){ hideTip(col); }, 2000); });
    col.addEventListener('mouseenter', function(e){ showTip(col,e.clientX,e.clientY); });
    col.addEventListener('mousemove',  function(e){
      if (tip.style.display !== 'none') {
        var tw = tip.offsetWidth||170;
        tip.style.left = Math.min(e.clientX+12, window.innerWidth-tw-12)+'px';
        tip.style.top  = (e.clientY-130)+'px';
      }
    });
    col.addEventListener('mouseleave', function(){ hideTip(col); });
  });
  document.addEventListener('click', function(e){ if(!e.target.closest('.fuel-week-col')) hideTip(null); });
}

function _initFuelMileageClicks() {
  var cols = document.querySelectorAll('.fuel-mile-col');
  var tip  = document.getElementById('fuelMileTip');
  if (!tip || !cols.length) return;
  var ccy = 'zł'; try{ccy=JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'zł';}catch(e){}

  function showTip(col, x, y) {
    var km = col.dataset.km, cost = col.dataset.cost, fills = col.dataset.fills;
    var cPerKm = (km>0&&cost>0) ? (parseFloat(cost)/parseFloat(km)).toFixed(2) : null;
    tip.innerHTML =
      '<div style="font-weight:600;color:var(--text);margin-bottom:5px">'+col.dataset.month+'</div>'+
      (km>0 ? '<div style="color:var(--text2)">Пробег: <b style="color:var(--text)">'+parseInt(km).toLocaleString('ru')+' км</b></div>' : '<div style="color:var(--text3)">Нет данных о пробеге</div>')+
      (cost>0 ? '<div style="color:var(--text2)">Топливо: <b style="color:var(--orange)">'+parseInt(cost).toLocaleString('ru')+' '+ccy+'</b></div>' : '')+
      (fills>0 ? '<div style="color:var(--text2)">Заправок: <b style="color:var(--text)">'+fills+'</b></div>' : '')+
      (cPerKm ? '<div style="color:var(--text2);margin-top:4px;padding-top:4px;border-top:0.5px solid var(--sep)">'+cPerKm+' '+ccy+'/км</div>' : '')+
      (km>0 ? '<div style="margin-top:5px;font-size:11px;color:var(--accent)">тап → по неделям</div>' : '');
    tip.style.display = 'block';
    var tw=tip.offsetWidth||160, vw=window.innerWidth;
    tip.style.left = Math.min(x+12,vw-tw-12)+'px';
    tip.style.top  = (y-120)+'px';
    var bar = col.querySelector('.fuel-mile-inner');
    if (bar) { bar.style.background=bar.dataset.hover; bar.style.transform='scaleY(1.05)'; }
  }
  function hideTip(col) {
    tip.style.display = 'none';
    if (col) { var bar=col.querySelector('.fuel-mile-inner'); if(bar){bar.style.background=bar.dataset.bg;bar.style.transform='';} }
  }
  function drillDown(col) {
    if (parseInt(col.dataset.km) <= 0) return;
    var drill = document.getElementById('fuelWeekDrill');
    if (drill) { drill.innerHTML = _buildFuelWeekChart(window._fuelRawData, col.dataset.monthkey); drill.scrollIntoView({behavior:'smooth',block:'nearest'}); setTimeout(_initFuelWeekClicks, 50); }
  }

  cols.forEach(function(col) {
    col.addEventListener('touchstart', function(e){ e.preventDefault(); var t=e.touches[0]; showTip(col,t.clientX,t.clientY); }, {passive:false});
    col.addEventListener('touchend',   function(){ setTimeout(function(){ hideTip(col); drillDown(col); }, 200); });
    col.addEventListener('mouseenter', function(e){ showTip(col,e.clientX,e.clientY); });
    col.addEventListener('mousemove',  function(e){ if(tip.style.display!=='none'){var tw=tip.offsetWidth||160;tip.style.left=Math.min(e.clientX+12,window.innerWidth-tw-12)+'px';tip.style.top=(e.clientY-120)+'px';} });
    col.addEventListener('mouseleave', function(){ hideTip(col); });
    col.addEventListener('click',      function(){ hideTip(col); drillDown(col); });
  });
  document.addEventListener('click', function(e){ if(!e.target.closest('.fuel-mile-col')) hideTip(null); });
}

function buildFillRows(data) {
  if (!data || data.length === 0) {
    return '<div class="empty-state">Нет заправок за выбранный период</div>';
  }
  // Группировка по месяцам если больше одного
  const monthGroups = {}, monthOrder = [];
  data.forEach(r => {
    const d = parseCustomDate(r.date);
    const mk = isNaN(d.getTime()) ? '—' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
    if (!monthGroups[mk]) { monthGroups[mk]={label,rows:[]}; monthOrder.push(mk); }
    monthGroups[mk].rows.push(r);
  });
  if (monthOrder.length > 1) {
    let html = '';
    monthOrder.forEach(mk => {
      const g = monthGroups[mk];
      const cnt = g.rows.length;
      const tot = g.rows.reduce((s,r)=>s+(parseFloat(r.totalCost)||0),0);
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px 4px;border-bottom:.5px solid var(--sep)"><span style="font-size:14px;font-weight:600;color:var(--text)">${g.label}</span><span style="font-size:12px;color:var(--text2)">${cnt} шт · ${Math.round(tot)} ${(()=>{try{return JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'zł';}catch(e){return 'zł';}})()} </span></div>`;
      html += buildFillRowsFlat(g.rows);
    });
    return html;
  }
  return buildFillRowsFlat(data);
}

function buildFillRowsFlat(data) {
  if (!data || data.length === 0) return '';
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

const GAS_POST_URL = 'https://script.google.com/macros/s/AKfycbwrKqSXxg0nNnTF0tvqWFRYyPiJ9yQyORsnsPz35iYpwMmNI8BSkHnF20iHePZbQIDf/exec';

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
      localStorage.removeItem('cache_v2_home'); // инвалидируем кэш после новой заправки
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
  var t=(type||'').toLowerCase();
  if(t.includes('масло')||t.includes('то')||t.includes('обслуживание')||t.includes('расходник'))
    return {svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3h18v4H3z"/><path d="M3 7l2 14h14l2-14"/><path d="M12 11v6"/></svg>',cls:'b'};
  if(t.includes('ремонт')||t.includes('замен'))
    return {svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',cls:'r'};
  if(t.includes('шин')||t.includes('резин')||t.includes('переобув'))
    return {svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',cls:'o'};
  if(t.includes('газ')||t.includes('гбо'))
    return {svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>',cls:'g'};
  if(t.includes('покупка')||t.includes('запча'))
    return {svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',cls:'i'};
  return {svg:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>',cls:'b'};
}

// ── ADD SERVICE ───────────────────────────────────────
function renderAddService(data) {
  const lastKm = data && data.endKm ? data.endKm : '';
  const cur = (function(){ try { return JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'PLN'; } catch(e){ return 'PLN'; } })();
  const today = new Date().toISOString().slice(0,10);

  DOM.pageContent.innerHTML = `
    <div class="anim">

      <div class="form-section-label">Данные записи</div>
      <div class="form-group-box">
        <div class="form-row">
          <label class="form-lbl" for="svcType">Тип работ <span style="color:var(--red)">*</span></label>
          <select class="form-select" id="svcType">
            <option value="">Выбрать</option>
            <option value="Плановое ТО">Плановое ТО</option>
            <option value="Ремонт">Ремонт</option>
            <option value="Покупка запчастей">Покупка запчастей</option>
            <option value="Переобувка">Переобувка</option>
            <option value="Расходники">Расходники</option>
          </select>
        </div>
        <div class="form-row">
          <label class="form-lbl" for="svcDate">Дата <span style="color:var(--red)">*</span></label>
          <input class="form-inp" type="date" id="svcDate" value="${today}">
        </div>
        <div class="form-row">
          <label class="form-lbl" for="svcMileage">Пробег</label>
          <input class="form-inp" type="text" id="svcMileage" placeholder="км (необязательно)" value="${lastKm}">
        </div>
      </div>

      <div class="form-section-label" style="margin-top:16px">Описание <span style="color:var(--red)">*</span></div>
      <div class="form-group-box">
        <div class="form-row">
          <textarea class="form-inp" id="svcDesc" rows="3" placeholder="Перечень проведённых работ / установленных деталей…" style="text-align:left;resize:none;min-height:72px"></textarea>
        </div>
      </div>

      <div class="form-section-label" style="margin-top:16px">Стоимость</div>
      <div class="form-group-box">
        <div class="form-row">
          <label class="form-lbl" for="svcPartsCost">Детали <span style="color:var(--text2);font-size:12px">(${cur})</span></label>
          <input class="form-inp" type="number" step="0.01" id="svcPartsCost" placeholder="0" min="0" value="0">
        </div>
        <div class="form-row">
          <label class="form-lbl" for="svcDelivery">Доставка <span style="color:var(--text2);font-size:12px">(${cur})</span></label>
          <input class="form-inp" type="number" step="0.01" id="svcDelivery" placeholder="0" min="0" value="0">
        </div>
        <div class="form-row">
          <label class="form-lbl" for="svcWorkCost">Работы <span style="color:var(--text2);font-size:12px">(${cur})</span></label>
          <input class="form-inp" type="number" step="0.01" id="svcWorkCost" placeholder="0" min="0" value="0">
        </div>
        <div class="form-row" style="border-top:1px solid var(--sep);padding-top:10px;margin-top:2px">
          <label class="form-lbl" style="font-weight:600">Итого</label>
          <span class="form-inp" id="svcTotal" style="background:var(--accent-bg);color:var(--accent);font-weight:700;display:flex;align-items:center">0 ${cur}</span>
        </div>
      </div>
      <p class="form-hint">* обязательно · Итого = детали + доставка + работы</p>

      <button class="ios-btn-primary" id="submitSvcBtn" onclick="submitService(event)">Добавить запись</button>
      <div id="svcFormMessage" style="display:none"></div>

    </div>
  `;

  ['svcPartsCost','svcDelivery','svcWorkCost'].forEach(function(id) {
    document.getElementById(id).addEventListener('input', function() {
      const p = parseFloat(document.getElementById('svcPartsCost').value)||0;
      const d = parseFloat(document.getElementById('svcDelivery').value)||0;
      const w = parseFloat(document.getElementById('svcWorkCost').value)||0;
      document.getElementById('svcTotal').textContent = (p+d+w).toFixed(2).replace(/\.00$/,'') + ' ' + cur;
    });
  });
}

async function submitService(e) {
  e.preventDefault();
  const btn = document.getElementById('submitSvcBtn');
  const msg = document.getElementById('svcFormMessage');

  const typeVal  = document.getElementById('svcType').value.trim();
  const dateVal  = document.getElementById('svcDate').value;
  const descVal  = document.getElementById('svcDesc').value.trim();
  const kmRaw    = document.getElementById('svcMileage').value.trim();
  const mileage  = kmRaw ? kmRaw.replace(/\s/g,'').replace('км','').trim() : '';
  const parts    = parseFloat(document.getElementById('svcPartsCost').value)||0;
  const delivery = parseFloat(document.getElementById('svcDelivery').value)||0;
  const work     = parseFloat(document.getElementById('svcWorkCost').value)||0;
  const total    = parts + delivery + work;

  let dateFormatted = '';
  if (dateVal) {
    const [y,m,d] = dateVal.split('-');
    dateFormatted = d+'.'+m+'.'+y;
  }

  const errors = [];
  if (!typeVal)       errors.push('выберите тип работ');
  if (!descVal)       errors.push('введите описание');
  if (!dateFormatted) errors.push('укажите дату');

  if (errors.length) {
    msg.style.display = 'block';
    msg.className = 'form-message error';
    msg.textContent = '\u2715 ' + errors.join(', ');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Отправка...';
  msg.style.display = 'none';

  const params = new URLSearchParams({
    action:      'addService',
    type:        typeVal,
    description: descVal,
    mileage:     mileage,
    date:        dateFormatted,
    delivery:    delivery,
    partsCost:   parts,
    workCost:    work,
    total:       total,
  });

  try {
    const res = await fetch(GAS_POST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params.toString()
    });
    if (!res.ok) throw new Error('\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0442\u0438: ' + res.status);
    const result = await res.json();

    msg.style.display = 'block';
    msg.className = 'form-message ' + (result.success ? 'success' : 'error');
    msg.textContent = (result.success ? '\u2713 ' : '\u2715 ') + result.message;

    if (result.success) {
      document.getElementById('svcType').value      = '';
      document.getElementById('svcDesc').value      = '';
      document.getElementById('svcPartsCost').value = '0';
      document.getElementById('svcDelivery').value  = '0';
      document.getElementById('svcWorkCost').value  = '0';
      document.getElementById('svcTotal').textContent = '0';
      localStorage.removeItem('cache_v2_service');
      localStorage.removeItem('cache_v2_tco');
    }
  } catch(err) {
    msg.style.display = 'block';
    msg.className = 'form-message error';
    msg.textContent = '\u2715 ' + err.message;
  }

  btn.disabled = false;
  btn.textContent = '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c';
}


// ── GAS vs BENZIN CARD UPDATE ─────────────────────────────────────────────────
function _updateGvsB(data, period) {
  if (!data || !Array.isArray(data)) return;
  const card = document.getElementById('gvsbCard');
  if (!card) return;

  const THRESHOLD = 2.5;
  var ccy = 'zł'; try{ccy=JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'zł';}catch(e){}

  // Фильтруем по периоду
  let filtered = [...data];
  if (period !== 'all' && !isNaN(parseInt(period))) {
    const months = parseInt(period);
    // Если период <= 10 — это количество заправок, иначе месяцы
    if (months <= 10) {
      // последние N заправок газа
      // не фильтруем по дате, просто ограничим ниже через slice
    } else {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      cutoff.setDate(1); cutoff.setHours(0,0,0,0);
      filtered = filtered.filter(e => {
        const d = parseCustomDate(e.date);
        return !isNaN(d.getTime()) && d >= cutoff;
      });
    }
  }

  const gasData    = filtered.filter(e => (e.fuelType||'').toLowerCase().includes('газ'));
  const petrolData = filtered.filter(e => (e.fuelType||'').toLowerCase().includes('бензин') || (e.fuelType||'').toLowerCase().includes('petrol'));

  const gasWithCons    = gasData.filter(e => parseFloat(e.fuelConsumption) > 0);
  const petrolWithCons = petrolData.filter(e => parseFloat(e.fuelConsumption) > 0);
  const petrolPureMode  = petrolWithCons.filter(e => parseFloat(e.fuelConsumption) >= THRESHOLD);
  const petrolExtraMode = petrolWithCons.filter(e => parseFloat(e.fuelConsumption) < THRESHOLD);

  // N заправок или все за период
  const nFills = (period !== 'all' && parseInt(period) <= 10) ? parseInt(period) : 9999;
  const gasSlice    = gasWithCons.slice(-nFills);
  const petrolSlice = petrolPureMode.slice(-nFills);
  const extraSlice  = petrolExtraMode; // доп. бензин — все за период

  const avgGasCons = gasSlice.length
    ? gasSlice.reduce((s,e)=>s+parseFloat(e.fuelConsumption),0)/gasSlice.length : null;
  const avgPetrolCons = petrolSlice.length
    ? petrolSlice.reduce((s,e)=>s+parseFloat(e.fuelConsumption),0)/petrolSlice.length : null;
  const avgPetrolExtra = extraSlice.length
    ? extraSlice.reduce((s,e)=>s+parseFloat(e.fuelConsumption),0)/extraSlice.length : null;

  const gasPrices    = gasSlice.filter(e=>parseFloat(e.pricePerLiter)>0);
  const avgGasPrice  = gasPrices.length ? gasPrices.reduce((s,e)=>s+(parseFloat(e.pricePerLiter)||0),0)/gasPrices.length : null;
  const petrolPricesArr = petrolSlice.filter(e=>parseFloat(e.pricePerLiter)>0);
  const avgPetrolPrice  = petrolPricesArr.length ? petrolPricesArr.reduce((s,e)=>s+(parseFloat(e.pricePerLiter)||0),0)/petrolPricesArr.length : null;
  const extraPricesArr  = extraSlice.filter(e=>parseFloat(e.pricePerLiter)>0);
  const avgExtraPrice   = extraPricesArr.length ? extraPricesArr.reduce((s,e)=>s+(parseFloat(e.pricePerLiter)||0),0)/extraPricesArr.length : null;

  const avgGas = avgGasCons ? avgGasCons.toFixed(1) : '—';
  const costGasPer100 = (avgGasCons && avgGasPrice) ? (avgGasCons * avgGasPrice).toFixed(2) : null;
  const costExtraPer100 = (avgPetrolExtra && avgExtraPrice) ? avgPetrolExtra * avgExtraPrice : 0;
  const costGboModePer100 = costGasPer100 ? (parseFloat(costGasPer100) + costExtraPer100).toFixed(2) : null;
  const costPetrolPer100  = (avgPetrolCons && avgPetrolPrice) ? (avgPetrolCons * avgPetrolPrice).toFixed(2) : null;
  const savings = (costGboModePer100 && costPetrolPer100)
    ? (parseFloat(costPetrolPer100) - parseFloat(costGboModePer100)).toFixed(2) : null;

  card.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div style="background:var(--orange-bg);border-radius:12px;padding:12px">
        <div style="font-size:11px;font-weight:600;color:var(--orange);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Режим ГБО</div>
        <div style="font-size:22px;font-weight:700;color:var(--text);letter-spacing:-0.5px;font-family:var(--font-r);line-height:1">
          ${costGboModePer100||'—'}<span style="font-size:12px;font-weight:400;color:var(--text2)"> ${ccy}/100км</span>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:5px">газ ${avgGas} л/100</div>
        ${avgPetrolExtra ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">+ доп. бензин ${avgPetrolExtra.toFixed(2)} л/100</div>` : ''}
      </div>
      <div style="background:var(--red-bg);border-radius:12px;padding:12px">
        <div style="font-size:11px;font-weight:600;color:var(--red);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Бензин</div>
        <div style="font-size:22px;font-weight:700;color:var(--text);letter-spacing:-0.5px;font-family:var(--font-r);line-height:1">
          ${costPetrolPer100||'—'}<span style="font-size:12px;font-weight:400;color:var(--text2)"> ${ccy}/100км</span>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:5px">${avgPetrolCons?avgPetrolCons.toFixed(1):'—'} л/100</div>
      </div>
    </div>
    ${savings ? `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--green-bg);border-radius:10px;padding:10px 14px">
      <div>
        <div style="font-size:12px;color:var(--green);font-weight:600;margin-bottom:1px">Экономия на 100 км</div>
        <div style="font-size:11px;color:var(--text2)">режим ГБО дешевле чистого бензина</div>
      </div>
      <div style="font-size:20px;font-weight:700;color:var(--green);font-family:var(--font-r);letter-spacing:-0.5px">
        +${savings} <span style="font-size:12px;font-weight:500">${ccy}</span>
      </div>
    </div>
    <div style="text-align:right;margin-top:6px;font-size:12px;color:var(--green);font-weight:600">
      ${Math.round(parseFloat(savings)/parseFloat(costPetrolPer100)*100)}% дешевле
    </div>` : '<div style="text-align:center;padding:10px;color:var(--text2);font-size:13px">Недостаточно данных за выбранный период</div>'}
  `;
}


function renderService(data) {
  if(!Array.isArray(data)) return;
  window._svcData=data;
  window._activeSvcYear=window._activeSvcYear||'all';
  window._activeSvcCat=window._activeSvcCat||'all';
  var ccy='zł';
  try{ccy=JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'zł';}catch(e){}
  window._svcCcy=ccy;

  var yearsSet={};
  data.forEach(function(i){try{var y=parseCustomDate(i.date).getFullYear();if(!isNaN(y)&&y>2000)yearsSet[y]=1;}catch(e){} });
  var years=Object.keys(yearsSet).map(Number).sort(function(a,b){return b-a;});

  var yearChips='<div class="chip'+(window._activeSvcYear==='all'?' active':'')+'" data-year="all">Все</div>';
  years.forEach(function(y){yearChips+='<div class="chip'+(window._activeSvcYear==y?' active':'')+'" data-year="'+y+'">'+y+'</div>';});

  var svcCats=[{key:'all',lbl:'Все'},{key:'плановое',lbl:'Плановое ТО'},{key:'ремонт',lbl:'Ремонт'},
    {key:'расходник',lbl:'Расходники'},{key:'переобувка',lbl:'Переобувка'},{key:'покупка',lbl:'Запчасти'},{key:'мойка',lbl:'Мойка'}];
  var catChips=svcCats.map(function(c){return '<div class="chip'+(window._activeSvcCat===c.key?' active':'')+'" data-cat="'+c.key+'">'+c.lbl+'</div>';}).join('');

  var totalAll=data.reduce(function(s,i){return s+(parseFloat(i.total)||0);},0);

  DOM.pageContent.innerHTML=
    '<div class="anim">'+
    '<div class="hero indigo">'+
      '<div class="hero-lbl">Всего на обслуживание</div>'+
      '<div class="hero-val">'+Math.round(totalAll).toLocaleString('ru')+' <span class="hero-unit">'+ccy+'</span></div>'+
      '<div class="hero-sub">'+data.length+' записей за всё время</div>'+
      '<div class="hero-icon"><svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>'+
    '</div>'+
    '<div class="chips" id="svcYearChips" style="margin-bottom:4px">'+yearChips+'</div>'+
    '<div id="svcStatsArea"></div>'+
    '<div class="slbl" style="margin-top:20px">История записей</div>'+
    '<div class="search-wrap" style="margin-bottom:8px">'+
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
      '<input type="text" id="svcSearch" placeholder="Поиск по описанию, типу…" oninput="_applySvcFilters()">'+
      '<svg id="svcSearchClear" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" stroke-width="2.5" stroke-linecap="round" style="cursor:pointer;display:none" onclick="document.getElementById(\'svcSearch\').value=\'\';_applySvcFilters()"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'+
    '</div>'+
    '<div class="chips" id="svcCatChips">'+catChips+'</div>'+
    '<div id="svcTimeline"></div>'+
    '</div>';

  document.querySelectorAll('#svcYearChips .chip').forEach(function(chip){
    chip.addEventListener('click',function(){
      document.querySelectorAll('#svcYearChips .chip').forEach(function(c){c.classList.remove('active');});
      this.classList.add('active'); window._activeSvcYear=this.dataset.year;
      _updateSvcStats(); _applySvcFilters();
    });
  });
  document.querySelectorAll('#svcCatChips .chip').forEach(function(chip){
    chip.addEventListener('click',function(){
      document.querySelectorAll('#svcCatChips .chip').forEach(function(c){c.classList.remove('active');});
      this.classList.add('active'); window._activeSvcCat=this.dataset.cat; _applySvcFilters();
    });
  });
  _updateSvcStats(); _applySvcFilters();
}

function _updateSvcStats() {
  var data=window._svcData||[], ccy=window._svcCcy||'zł';
  var yearSel=window._activeSvcYear||'all';
  var curYear=new Date().getFullYear(), curMonth=new Date().getMonth()+1;

  var filtered=yearSel==='all'?data:data.filter(function(i){try{return parseCustomDate(i.date).getFullYear()===parseInt(yearSel);}catch(e){return false;}});
  var prevYear=yearSel==='all'?null:parseInt(yearSel)-1;
  var prevData=prevYear?data.filter(function(i){try{return parseCustomDate(i.date).getFullYear()===prevYear;}catch(e){return false;}}):[];

  var total=filtered.reduce(function(s,i){return s+(parseFloat(i.total)||0);},0);
  var prevTotal=prevData.reduce(function(s,i){return s+(parseFloat(i.total)||0);},0);
  var count=filtered.length, avgCost=count?total/count:0;

  var months=1;
  if(yearSel==='all'){var allY={};data.forEach(function(i){try{allY[parseCustomDate(i.date).getFullYear()]=1;}catch(e){}});months=Math.max(1,Object.keys(allY).length*12);}
  else{months=parseInt(yearSel)===curYear?Math.max(1,curMonth):12;}
  var perMonth=total/months;

  var trendSumHTML='—', trendVisHTML='—';
  if(prevTotal>0&&total>0){var ps=Math.round(((total-prevTotal)/prevTotal)*100);trendSumHTML='<span class="'+(ps>0?'trend-up':'trend-down')+'">'+(ps>0?'↑':'↓')+Math.abs(ps)+'%</span> vs '+prevYear;}
  else if(yearSel==='all'){trendSumHTML='<span style="color:var(--text2)">все годы</span>';}
  if(prevData.length>0&&count>0){var pv=Math.round(((count-prevData.length)/prevData.length)*100);trendVisHTML='<span class="'+(pv>0?'trend-up':'trend-down')+'">'+(pv>0?'↑':'↓')+Math.abs(pv)+'%</span> vs '+prevYear;}

  var lastVisit='—', mostExpStr='';
  if(filtered.length){
    var lastDate=filtered.reduce(function(l,i){var d=parseCustomDate(i.date);return d>l?d:l;},new Date(0));
    if(!isNaN(lastDate)){var diff=Math.floor((new Date()-lastDate)/86400000);lastVisit=diff===0?'сегодня':diff+' дн. назад';}
    var mostExp=filtered.reduce(function(mx,i){return (parseFloat(i.total)||0)>(parseFloat(mx.total)||0)?i:mx;},filtered[0]);
    if(mostExp) mostExpStr=Math.round(parseFloat(mostExp.total)||0).toLocaleString('ru')+' '+ccy+' — самый дорогой';
  }

  var mCounts={};
  filtered.forEach(function(i){try{var d=parseCustomDate(i.date);var k=d.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(' г.','');mCounts[k]=(mCounts[k]||0)+1;}catch(e){}});
  var busyMonth=Object.keys(mCounts).length?Object.entries(mCounts).sort(function(a,b){return b[1]-a[1];})[0]:null;

  var gaps=[],withKm=filtered.filter(function(i){return parseFloat(i.mileage)>0;}).sort(function(a,b){return parseFloat(a.mileage)-parseFloat(b.mileage);});
  for(var mi=1;mi<withKm.length;mi++){var g=parseFloat(withKm[mi].mileage)-parseFloat(withKm[mi-1].mileage);if(g>0&&g<50000)gaps.push(g);}
  var avgGap=gaps.length?Math.round(gaps.reduce(function(s,v){return s+v;},0)/gaps.length):null;

  var cats={to:0,repair:0,consumables:0,tires:0,other:0},catTotal=0;
  filtered.forEach(function(i){
    var t=(i.type||'').toLowerCase(),c=parseFloat(i.total)||0;if(!c)return;catTotal+=c;
    if(t.includes('то')||t.includes('обслуживание')||t.includes('плановое'))cats.to+=c;
    else if(t.includes('ремонт')||t.includes('замена'))cats.repair+=c;
    else if(t.includes('расходник')||t.includes('фильтр')||t.includes('масло'))cats.consumables+=c;
    else if(t.includes('шин')||t.includes('резин')||t.includes('переобув'))cats.tires+=c;
    else cats.other+=c;
  });
  var pct=function(k){return catTotal>0?Math.round(cats[k]/catTotal*100):0;};
  var distRows=[
    {lbl:'ТО',key:'to',color:'var(--accent)'},{lbl:'Ремонты',key:'repair',color:'var(--red)'},
    {lbl:'Расходники',key:'consumables',color:'var(--green)'},{lbl:'Шины',key:'tires',color:'var(--orange)'},
    {lbl:'Прочее',key:'other',color:'var(--indigo)'},
  ].filter(function(d){return pct(d.key)>0;}).map(function(d){return Object.assign({},d,{pct:pct(d.key),value:cats[d.key]});});

  var allYearsArr=[];
  var yearsInData={};
  data.forEach(function(i){try{yearsInData[parseCustomDate(i.date).getFullYear()]=1;}catch(e){}});
  Object.keys(yearsInData).map(Number).sort().forEach(function(y){
    var yD=data.filter(function(i){try{return parseCustomDate(i.date).getFullYear()===y;}catch(e){return false;}});
    var yT=yD.reduce(function(s,i){return s+(parseFloat(i.total)||0);},0);
    allYearsArr.push({year:y,total:yT,count:yD.length,avg:yD.length?yT/yD.length:0});
  });

  // Прогноз на текущий год
  var forecastHTML='';
  var curYD=data.filter(function(i){try{return parseCustomDate(i.date).getFullYear()===curYear;}catch(e){return false;}});
  var curYTotal=curYD.reduce(function(s,i){return s+(parseFloat(i.total)||0);},0);
  if(curMonth<12&&curYTotal>0){
    var projected=Math.round((curYTotal/curMonth)*12);
    var remaining=Math.round(projected-curYTotal);
    var pctDone=Math.round((curMonth/12)*100);
    forecastHTML='<div class="tco-insight" style="margin-top:10px">'+
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'+
      '<span>Прогноз на '+curYear+' год — около <b>'+projected.toLocaleString('ru')+' '+ccy+'</b>. '+
      'Потрачено '+Math.round(curYTotal).toLocaleString('ru')+' '+ccy+' ('+pctDone+'% года прошло). '+
      'Ещё ~<b>'+remaining.toLocaleString('ru')+' '+ccy+'</b>.</span></div>';
  }

  var fmt=function(v){return Math.round(v).toLocaleString('ru');};
  var periodLabel=yearSel==='all'?'за всё время':'за '+yearSel+' год';

  var html=
    '<div class="stat-cards-row">'+
      '<div class="stat-card-ios"><div class="sc-label">'+periodLabel+'</div><div class="sc-value">'+fmt(total)+'<span class="u"> '+ccy+'</span></div><div class="sc-sub">'+count+' визитов</div></div>'+
      '<div class="stat-card-ios"><div class="sc-label">Средний чек</div><div class="sc-value">'+fmt(avgCost)+'<span class="u"> '+ccy+'</span></div><div class="sc-sub">за визит</div></div>'+
    '</div>'+
    '<div class="stat-cards-row">'+
      '<div class="stat-card-ios"><div class="sc-label">В месяц</div><div class="sc-value">'+fmt(perMonth)+'<span class="u"> '+ccy+'</span></div><div class="sc-sub">среднее</div></div>'+
      '<div class="stat-card-ios"><div class="sc-label">Тренд расходов</div><div class="sc-value" style="font-size:18px">'+trendSumHTML+'</div><div class="sc-sub">'+trendVisHTML+' визитов</div></div>'+
    '</div>'+
    '<div class="stat-cards-row">'+
      '<div class="stat-card-ios"><div class="sc-label">Последний визит</div><div class="sc-value" style="font-size:18px">'+lastVisit+'</div><div class="sc-sub">'+mostExpStr+'</div></div>'+
      '<div class="stat-card-ios"><div class="sc-label">Активный месяц</div>'+
        (busyMonth?'<div class="sc-value" style="font-size:15px;letter-spacing:-0.3px">'+busyMonth[0]+'</div><div class="sc-sub">'+busyMonth[1]+' визитов</div>':'<div class="sc-value">—</div><div class="sc-sub"> </div>')+
      '</div>'+
    '</div>'+
    (avgGap?'<div class="stat-cards-row">'+
      '<div class="stat-card-ios"><div class="sc-label">Пробег между визитами</div><div class="sc-value">'+avgGap.toLocaleString('ru')+'<span class="u"> км</span></div><div class="sc-sub">среднее</div></div>'+
      '<div class="stat-card-ios"><div class="sc-label">Чаще всего</div><div class="sc-value" style="font-size:15px">'+_getMostCommonType(filtered)+'</div><div class="sc-sub">тип работ</div></div>'+
    '</div>':'')+
    '<div class="slbl" style="margin-top:4px">Расходы по месяцам</div>'+
    '<div class="group" style="padding:14px 12px 10px">'+_buildSvcBarChart(filtered,yearSel,ccy)+'</div>'+
    (distRows.length?'<div class="slbl">Распределение расходов</div><div class="group" style="padding:16px">'+_buildSvcDonut(distRows,catTotal,ccy)+'</div>':'')+
    (allYearsArr.length>1?'<div class="slbl">Год к году</div><div class="group" style="padding:0">'+_buildYearCompare(allYearsArr,ccy)+'</div>':'')+
    forecastHTML;

  var el=document.getElementById('svcStatsArea');
  if(el){el.innerHTML=html; _initBarChartClicks();}
}

function _getMostCommonType(data) {
  var c={};
  data.forEach(function(i){var t=(i.type||'другое').toLowerCase().trim();c[t]=(c[t]||0)+1;});
  var top=Object.entries(c).sort(function(a,b){return b[1]-a[1];})[0];
  return top?top[0].toUpperCase():'—';
}

// HTML-столбчатый график с тултипами
function _buildSvcBarChart(data, yearSel, ccy) {
  if(!data.length) return '<div class="empty-state" style="padding:20px 0">Нет данных</div>';

  var monthly={};
  data.forEach(function(i){
    try{
      var d=parseCustomDate(i.date);
      var key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      var lbl=d.toLocaleDateString('ru-RU',{month:'short'}).replace('.','');
      var fullLbl=d.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(' г.','');
      if(!monthly[key]) monthly[key]={lbl:lbl,fullLbl:fullLbl,total:0,count:0,year:d.getFullYear(),month:d.getMonth()+1};
      monthly[key].total+=parseFloat(i.total)||0;
      monthly[key].count++;
    }catch(e){}
  });

  var keys=Object.keys(monthly).sort();
  if(yearSel==='all'&&keys.length>18) keys=keys.slice(-18);
  if(!keys.length) return '<div class="empty-state" style="padding:20px 0">Нет данных</div>';

  var vals=keys.map(function(k){return monthly[k].total;});
  var maxVal=Math.max.apply(null,vals)||1;
  var n=keys.length;
  var curYear=new Date().getFullYear(), curMonth=new Date().getMonth()+1;

  var CHART_H=100, BAR_W=Math.max(20,Math.min(40,Math.floor(300/n)-4));
  var GAP=Math.max(4,Math.floor(BAR_W*0.25));

  var barsHTML='';
  keys.forEach(function(k,i){
    var v=monthly[k].total;
    var bh=Math.max(4,Math.round((v/maxVal)*CHART_H));
    var isCur=(monthly[k].year===curYear&&monthly[k].month===curMonth);
    var isMax=(v===maxVal);
    var bg=isCur?'var(--green)':(isMax?'var(--accent)':'var(--accent-bg)');
    var hoverBg=isCur?'#25a244':(isMax?'#0060d0':'var(--indigo)');
    var showLbl=(n<=12)||(i%2===0);

    // Цена над столбцом — всегда
    var topLabelColor=isCur?'var(--green)':(isMax?'var(--accent)':'var(--text2)');
    var topLabel='<div style="position:absolute;bottom:'+(bh+5)+'px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;font-weight:600;color:'+topLabelColor+'">'+Math.round(v).toLocaleString('ru')+'</div>';

    barsHTML+=
      '<div class="svc-bar-col"'+
        ' data-month="'+monthly[k].fullLbl+'"'+
        ' data-total="'+Math.round(v).toLocaleString('ru')+'"'+
        ' data-count="'+monthly[k].count+'"'+
        ' data-ccy="'+ccy+'"'+
        ' style="position:relative;display:inline-flex;flex-direction:column;align-items:center;width:'+BAR_W+'px;margin:0 '+(GAP/2)+'px;height:'+(CHART_H+20)+'px;vertical-align:bottom;cursor:pointer">'+
        topLabel+
        '<div class="svc-bar-inner" data-bg="'+bg+'" data-hover="'+hoverBg+'"'+
          ' style="position:absolute;bottom:20px;width:100%;height:'+bh+'px;background:'+bg+';border-radius:4px 4px 2px 2px;transition:background 0.15s,transform 0.1s"></div>'+
        (showLbl?'<div style="position:absolute;bottom:2px;width:140%;text-align:center;font-size:9px;color:var(--text2);left:50%;transform:translateX(-50%)">'+monthly[k].lbl+'</div>':'')+
      '</div>';
  });

  return '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">'+
    '<div id="svcBarWrap" style="display:flex;align-items:flex-end;padding:8px 4px 0;min-width:'+((BAR_W+GAP)*n+GAP)+'px">'+
      barsHTML+
    '</div>'+
    '<div id="svcBarTip" style="display:none;position:fixed;background:var(--grouped);border:0.5px solid var(--sep);border-radius:10px;padding:9px 13px;font-size:13px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:500;min-width:140px;"></div>'+
  '</div>';
}

// Touch/hover тултипы для столбчатого графика
function _initBarChartClicks() {
  var cols=document.querySelectorAll('.svc-bar-col');
  var tip=document.getElementById('svcBarTip');
  if(!tip||!cols.length) return;

  function showTip(col,x,y){
    tip.innerHTML=
      '<div style="font-weight:600;color:var(--text);margin-bottom:4px">'+col.dataset.month+'</div>'+
      '<div style="color:var(--text2)">Потрачено: <b style="color:var(--text)">'+col.dataset.total+' '+col.dataset.ccy+'</b></div>'+
      '<div style="color:var(--text2)">Визитов: <b style="color:var(--text)">'+col.dataset.count+'</b></div>';
    tip.style.display='block';
    var tw=tip.offsetWidth||150, vw=window.innerWidth;
    tip.style.left=Math.min(x+12,vw-tw-12)+'px';
    tip.style.top=(y-90)+'px';
    var bar=col.querySelector('.svc-bar-inner');
    if(bar){bar.style.background=bar.dataset.hover;bar.style.transform='scaleY(1.04)';}
  }
  function hideTip(col){
    tip.style.display='none';
    if(col){var bar=col.querySelector('.svc-bar-inner');if(bar){bar.style.background=bar.dataset.bg;bar.style.transform='';}}
  }

  cols.forEach(function(col){
    col.addEventListener('touchstart',function(e){
      e.preventDefault();var touch=e.touches[0];showTip(col,touch.clientX,touch.clientY);
    },{passive:false});
    col.addEventListener('touchend',function(){setTimeout(function(){hideTip(col);},1800);});
    col.addEventListener('mouseenter',function(e){showTip(col,e.clientX,e.clientY);});
    col.addEventListener('mousemove',function(e){
      if(tip.style.display!=='none'){
        var tw=tip.offsetWidth||150;
        tip.style.left=Math.min(e.clientX+12,window.innerWidth-tw-12)+'px';
        tip.style.top=(e.clientY-90)+'px';
      }
    });
    col.addEventListener('mouseleave',function(){hideTip(col);});
  });
  document.addEventListener('click',function(e){if(!e.target.closest('.svc-bar-col'))hideTip(null);});
}

function _buildSvcDonut(distRows, total, ccy) {
  var OX=75,OY=75,OR=58,IR=36,GAP=2.8;
  var toRad=function(d){return d*Math.PI/180;};
  function arc(s,e){var sa=s+GAP/2,ea=e-GAP/2;var x1=OX+OR*Math.cos(toRad(sa)),y1=OY+OR*Math.sin(toRad(sa));var x2=OX+OR*Math.cos(toRad(ea)),y2=OY+OR*Math.sin(toRad(ea));var x3=OX+IR*Math.cos(toRad(ea)),y3=OY+IR*Math.sin(toRad(ea));var x4=OX+IR*Math.cos(toRad(sa)),y4=OY+IR*Math.sin(toRad(sa));var lg=(ea-sa)>180?1:0;return 'M'+x1+' '+y1+' A'+OR+' '+OR+' 0 '+lg+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+IR+' '+IR+' 0 '+lg+' 0 '+x4+' '+y4+' Z';}
  var segs='',angle=-90;
  distRows.forEach(function(d){var sw=d.pct*3.6;segs+='<path d="'+arc(angle,angle+sw)+'" fill="'+d.color+'" opacity="0.9"/>';angle+=sw;});
  var top=distRows[0];
  var centre='<text x="'+OX+'" y="'+(OY-6)+'" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)" font-family="-apple-system">'+top.pct+'%</text><text x="'+OX+'" y="'+(OY+12)+'" text-anchor="middle" font-size="10" fill="var(--text2)" font-family="-apple-system">'+top.lbl+'</text>';
  var rows='';
  distRows.forEach(function(d,i){rows+='<div style="display:flex;align-items:center;gap:8px;'+(i<distRows.length-1?'margin-bottom:9px;':'')+'"><div style="width:9px;height:9px;border-radius:3px;flex-shrink:0;background:'+d.color+'"></div><span style="font-size:13px;color:var(--text);flex:1">'+d.lbl+'</span><span style="font-size:12px;color:var(--text2);margin-right:6px">'+Math.round(d.value).toLocaleString('ru')+' '+ccy+'</span><span style="font-size:13px;font-weight:600;color:'+d.color+';min-width:32px;text-align:right">'+d.pct+'%</span></div>';});
  return '<div style="display:flex;align-items:center;gap:16px"><svg width="150" height="150" viewBox="0 0 150 150" style="flex-shrink:0">'+segs+centre+'</svg><div style="flex:1">'+rows+'</div></div>';
}

function _buildYearCompare(yearsArr, ccy) {
  var maxT=Math.max.apply(null,yearsArr.map(function(y){return y.total;}))||1;
  var html='';
  yearsArr.slice().reverse().forEach(function(y){
    var bw=Math.round((y.total/maxT)*100);
    html+='<div style="display:flex;align-items:center;padding:11px 16px;gap:12px;border-bottom:0.5px solid var(--sep)">'+
      '<div style="font-size:15px;font-weight:600;color:var(--text);min-width:42px">'+y.year+'</div>'+
      '<div style="flex:1"><div style="height:5px;background:var(--bg2);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+bw+'%;background:var(--indigo);border-radius:3px"></div></div>'+
      '<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="font-size:11px;color:var(--text2)">'+y.count+' визит.</span><span style="font-size:11px;color:var(--text2)">ср. '+Math.round(y.avg).toLocaleString('ru')+' '+ccy+'</span></div></div>'+
      '<div style="font-size:15px;font-weight:600;color:var(--text);min-width:80px;text-align:right">'+Math.round(y.total).toLocaleString('ru')+' '+ccy+'</div></div>';
  });
  return html;
}

function buildTimelineHTML(list) {
  if(!list.length) return '<div class="empty-state" style="padding:24px 0;text-align:center;color:var(--text2);font-size:14px">Ничего не найдено</div>';
  var grp=groupByMonth(list),html='';
  Object.keys(grp).forEach(function(month){
    html+='<div class="month-header">'+(month.charAt(0)+month.slice(1).toLowerCase())+'</div><div class="group" style="padding:0 16px">';
    grp[month].forEach(function(s){var ic=getServiceIconSVG(s.type);html+='<div class="tl-row"><div class="tl-icon '+ic.cls+'">'+ic.svg+'</div><div class="tl-body"><div class="tl-title">'+(s.description||s.type||'Обслуживание')+'</div><div class="tl-meta">'+(s.date||'—')+' · '+(s.mileage||'—')+' км · '+(s.type||'')+'</div></div><div class="tl-price">'+(s.total?s.total+' '+(window._svcCcy||'zł'):'—')+'</div></div>';});
    html+='</div>';
  });
  return html;
}

function _applyHistoryFilters() {
  const q=(document.getElementById('historySearch')?.value||'').trim().toLowerCase();
  const clearBtn=document.getElementById('historySearchClear');
  if(clearBtn) clearBtn.style.display=q?'block':'none';

  // Источник данных — window._fuelSorted (назначается в renderFuel)
  const data=window._fuelSorted||[];
  let list=[...data];

  // Фильтр по периоду
  const period=window._activePeriod||'all';
  list=filterDataByPeriod(list,period);

  // Фильтр/сортировка по типу топлива и расходу (чипы: all/gas/petrol/high/low)
  const sort=window._activeSort||'all';
  if(sort==='gas')    list=list.filter(e=>(e.fuelType||'').toLowerCase().includes('газ'));
  if(sort==='petrol') list=list.filter(e=>{const t=(e.fuelType||'').toLowerCase();return t.includes('бензин')||t.includes('petrol');});
  if(sort==='high')   list=list.filter(e=>parseFloat(e.fuelConsumption)>=7.5);
  if(sort==='low')    list=list.filter(e=>{const c=parseFloat(e.fuelConsumption);return c>0&&c<6.3;});

  // Текстовый поиск по дате, типу топлива, комментарию
  if(q) list=list.filter(s=>(s.date||'').includes(q)||(s.fuelType||'').toLowerCase().includes(q)||(s.comment||'').toLowerCase().includes(q));

  // Рендер в правильный элемент
  const el=document.getElementById('historyList');
  if(el) el.innerHTML=buildFillRows(list);
}

function _applySvcFilters() {
  var q=(document.getElementById('svcSearch')?.value||'').trim().toLowerCase();
  var clearBtn=document.getElementById('svcSearchClear');if(clearBtn) clearBtn.style.display=q?'block':'none';
  var data=window._svcData||[],list=[...data];
  var yearSel=window._activeSvcYear||'all';
  if(yearSel!=='all') list=list.filter(function(s){try{return parseCustomDate(s.date).getFullYear()===parseInt(yearSel);}catch(e){return false;}});
  var cat=window._activeSvcCat||'all';
  if(cat!=='all') list=list.filter(function(s){return (s.type||'').toLowerCase().includes(cat);});
  if(q) list=list.filter(function(s){return (s.description||'').toLowerCase().includes(q)||(s.type||'').toLowerCase().includes(q);});
  var el=document.getElementById('svcTimeline');if(el) el.innerHTML=buildTimelineHTML(list);
}


// ── SETTINGS ───────────────────────────────────────────
function renderSettings(data) {
  const count  = Array.isArray(data) ? data.length : (data ? Object.keys(data).length : 0);
  const layout = getHomeLayout();

  // Цвета для layout-editor
  const COLORS = {
    oil:'#ff9500',diag:'#007aff',insur:'#ff3b30',gbo:'#34c759',kpp:'#5856d6',
    to:'#007aff',fuel_week:'#ff9500',total:'#34c759',last_fuel:'#ff6b00',
    spark:'#007aff',quick:'#34c759'
  };

  // Данные из кэша главной — для "осталось X км/дн"
  var home = {};
  try { const _hc = readCache('home'); home = (_hc && _hc.data) ? _hc.data : {}; } catch(e){}

  // Данные авто из кэша настроек
  var c = {};
  try { c = JSON.parse(localStorage.getItem('car_settings') || '{}'); } catch(e){}

  // ── Helpers ─────────────────────────────────────────

  // Цветной кружок с SVG (как в layout editor)
  function accIcon(color, svgPath) {
    return '<div style="width:34px;height:34px;border-radius:9px;background:' + color + '22;' +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="' + color + '" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + svgPath + '</svg></div>';
  }

  // Бейдж "осталось" — зелёный/оранжевый/красный
  function badge(val, unit) {
    if (!val && val !== 0) return '';
    var n = parseInt(val);
    var cls = n < 1000 ? 'red' : n < 3000 ? 'orange' : 'green';
    return ' <span class="acc-badge acc-badge-' + cls + '">' + val + unit + '</span>';
  }

  // Бейдж для дней страховки
  function badgeDays(val) {
    if (!val && val !== 0) return '';
    var n = parseInt(val);
    var cls = n < 30 ? 'red' : n < 60 ? 'orange' : 'green';
    return ' <span class="acc-badge acc-badge-' + cls + '">' + val + ' дн.</span>';
  }

  // Инпут — текст слева
  function inp(id, label, type, placeholder, val) {
    return '<div class="form-row">' +
      '<label class="form-lbl">' + label + '</label>' +
      '<input class="form-inp cs-inp" id="' + id + '" type="' + (type||'text') + '" ' +
      'placeholder="' + placeholder + '" value="' + (val||'') + '">' +
      '</div>';
  }

  // Инпут с кнопкой копирования
  function inpCopy(id, label, placeholder, val) {
    return '<div class="form-row cs-copy-row">' +
      '<label class="form-lbl" style="flex-shrink:0">' + label + '</label>' +
      '<div class="cs-copy-wrap">' +
        '<input class="form-inp cs-inp cs-copy-inp" id="' + id + '" type="text" ' +
        'placeholder="' + placeholder + '" value="' + (val||'') + '" readonly>' +
        '<button class="cs-copy-btn" onclick="_copyField(\'' + id + '\')" title="Скопировать">' +
          _copyIcon() +
        '</button>' +
      '</div></div>';
  }

  // Select
  function sel(id, label, options, selected) {
    var opts = options.map(function(o){
      return '<option value="' + o + '"' + (selected===o?' selected':'') + '>' + o + '</option>';
    }).join('');
    return '<div class="form-row"><label class="form-lbl">' + label + '</label>' +
      '<select class="cs-inp form-select" id="' + id + '">' + opts + '</select></div>';
  }

  // Аккордеон
  function acc(id, iconHtml, title, subHtml, fields) {
    return '<div class="acc-section" id="acc-' + id + '">' +
      '<div class="acc-header" onclick="_accToggle(\'' + id + '\')">' +
        iconHtml +
        '<div class="acc-title-wrap">' +
          '<div class="acc-title">' + title + '</div>' +
          '<div class="acc-sub" id="acc-sub-' + id + '">' + subHtml + '</div>' +
        '</div>' +
        '<svg class="acc-chevron" id="acc-chv-' + id + '" width="16" height="16" viewBox="0 0 24 24" ' +
        'fill="none" stroke="var(--text3)" stroke-width="2.5" stroke-linecap="round">' +
        '<polyline points="6 9 12 15 18 9"/></svg>' +
      '</div>' +
      '<div class="acc-body" id="acc-body-' + id + '" style="display:none">' +
        '<div class="form-group-box" style="margin:0">' + fields + '</div>' +
      '</div></div>';
  }

  // ── Иконки для секций ────────────────────────────────
  var ICONS = {
    car:  accIcon('#007aff', '<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),
    docs: accIcon('#5856d6', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    oil:  accIcon('#ff9500', '<path d="M3 3h18v4H3z"/><path d="M3 7l2 14h14l2-14"/><path d="M12 11v6"/><path d="M9 11v6"/><path d="M15 11v6"/>'),
    kpp:  accIcon('#ff6b00', '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>'),
    diag: accIcon('#34c759', '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
    gbo:  accIcon('#30b0c7', '<path d="M14 11h1a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0v-7l-3-3"/><path d="M4 20v-14a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14"/><path d="M3 20l12 0"/><path d="M4 11l10 0"/>'),
    cur:  accIcon('#ff3b30', '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/>'),
  };

  // ── Умные подзаголовки ───────────────────────────────
  function subCar() {
    return c.carName || '';
  }
  function subDocs() {
    var parts = [];
    if (c.insuranceEnd) parts.push('страховка до ' + c.insuranceEnd);
    if (home.insuranceEnds) parts.push('осталось ' + home.insuranceEnds + ' дн.');
    return parts.join(' · ');
  }
  function subOil() {
    var parts = [];
    if (c.oilLast) parts.push('замена ' + Number(c.oilLast).toLocaleString('ru') + ' км');
    if (home.nextOilChange) parts.push('осталось ' + Number(home.nextOilChange).toLocaleString('ru') + ' км');
    return parts.join(' · ');
  }
  function subKpp() {
    var parts = [];
    if (c.kppLast) parts.push('замена ' + Number(c.kppLast).toLocaleString('ru') + ' км');
    if (home.nextGearboxOilChange) parts.push('осталось ' + Number(home.nextGearboxOilChange).toLocaleString('ru') + ' км');
    return parts.join(' · ');
  }
  function subDiag() {
    var parts = [];
    if (c.diagLast) parts.push('диагн. ' + Number(c.diagLast).toLocaleString('ru') + ' км');
    if (home.nextDiagnostic) parts.push('осталось ' + Number(home.nextDiagnostic).toLocaleString('ru') + ' км');
    return parts.join(' · ');
  }
  function subGbo() {
    var parts = [];
    if (c.gboDate) parts.push('установлена ' + c.gboDate);
    if (home.gasServiceDue) parts.push('до обсл. ' + Number(home.gasServiceDue).toLocaleString('ru') + ' км');
    return parts.join(' · ');
  }
  function subCur() {
    return (c.currency||'PLN') + ' → ' + (c.currency2||'UAH');
  }

  // ── Layout drag-group builder ────────────────────────
  function buildGroup(title, items, gid, showReset) {
    var h = '<div class="layout-group-header">' +
      '<div class="slbl">' + title + '</div>' +
      (showReset ? '<button class="layout-reset-btn" onclick="_layoutReset()">Сбросить всё</button>' : '') +
      '</div><div class="layout-group-wrap"><div id="' + gid + '">';
    items.forEach(function(item) {
      var clr = COLORS[item.id] || '#8e8e93';
      h += '<div class="layout-item" data-id="' + item.id + '">' +
        '<div class="layout-drag-handle">⠿</div>' +
        '<div class="layout-item-icon" style="background:' + clr + '22">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="' + clr + '" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="5"/></svg>' +
        '</div>' +
        '<div class="layout-item-name">' + item.label + '</div>' +
        '<label style="position:relative;display:inline-block;width:51px;height:31px;flex-shrink:0">' +
          '<input type="checkbox" class="ios-toggle layout-toggle" data-id="' + item.id + '" data-gid="' + gid + '"' + (item.enabled ? ' checked' : '') + '>' +
        '</label></div>';
    });
    return h + '</div></div>';
  }

  // ── DOM ──────────────────────────────────────────────
  DOM.pageContent.innerHTML =
    '<div class="anim">' +
    '<div class="slbl">Данные автомобиля</div>' +
    '<div class="acc-list">' +

    acc('car',  ICONS.car,  'Автомобиль',          subCar(),
      inp('cs_carName',      'Название',              'text',   'Toyota Auris', c.carName) +
      inp('cs_purchaseDate', 'Дата покупки',           'text',   '16.05.2024',   c.purchaseDate) +
      inp('cs_startMileage', 'Пробег при покупке, км', 'number', '150000',       c.startMileage)) +

    acc('docs', ICONS.docs, 'Документы',            subDocs(),
      inpCopy('cs_vin',         'VIN-код',               'JTDKW923900…',  c.vin) +
      inpCopy('cs_regNum',      'Рег. номера',             'WN 12345',      c.regNum) +
      inpCopy('cs_insuranceNum','Номер полиса',            '№',             c.insuranceNum) +
      inp('cs_insuranceEnd', 'Страховка до',           'text',   '16.05.2026',    c.insuranceEnd)) +

    acc('oil',  ICONS.oil,  'Масло двигателя',      subOil(),
      inp('cs_oilLast',     'Последняя замена, км', 'number', '281664', c.oilLast) +
      inp('cs_oilInterval', 'Интервал, км',          'number', '12000',  c.oilInterval)) +

    acc('kpp',  ICONS.kpp,  'Масло КПП / АКПП',     subKpp(),
      inp('cs_kppLast',     'Последняя замена, км', 'number', '232078', c.kppLast) +
      inp('cs_kppInterval', 'Интервал, км',          'number', '80000',  c.kppInterval)) +

    acc('diag', ICONS.diag, 'Плановая диагностика', subDiag(),
      inp('cs_diagLast',     'Последняя, км', 'number', '283000', c.diagLast) +
      inp('cs_diagInterval', 'Интервал, км',  'number', '10000',  c.diagInterval)) +

    acc('gbo',  ICONS.gbo,  'ГБО',                  subGbo(),
      inp('cs_gboDate',     'Дата установки',      'text',   '14.06.2024', c.gboDate) +
      inp('cs_gboLast',     'Последнее обсл., км', 'number', '285250',     c.gboLast) +
      inp('cs_gboInterval', 'Интервал, км',         'number', '10000',      c.gboInterval)) +

    acc('cur',  ICONS.cur,  'Валюта',               subCur(),
      sel('cs_currency',  'Основная',        ['PLN','USD','EUR','UAH','RUB'], c.currency  || 'PLN') +
      sel('cs_currency2', 'Для конвертации', ['UAH','PLN','USD','EUR','RUB'], c.currency2 || 'UAH')) +

    '</div>' +
    '<div id="csMsg" class="cs-msg"></div>' +
    '<button class="ios-btn-primary" id="csSaveBtn" onclick="saveCarSettings()">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-3px;margin-right:6px">' +
        '<polyline points="20 6 9 17 4 12"/>' +
      '</svg>Применить изменения</button>' +

    '<div class="slbl" style="margin-top:28px">Настройка главной страницы</div>' +
    '<p class="settings-hint">Перетащите <b>⠿</b> чтобы изменить порядок · тоггл — скрыть/показать</p>' +
    buildGroup('Ближайшие сроки', layout.reminders, 'lg-reminders', false) +
    buildGroup('Мини-карточки',   layout.minicards,  'lg-minicards',  false) +
    buildGroup('Секции',          layout.sections,   'lg-sections',   true)  +

    '<div class="slbl" style="margin-top:28px">Настройка раздела Расходы</div>' +
    '<p class="settings-hint">Тоггл — скрыть/показать блок</p>' +
    (function() {
      var tcoLay = getTcoLayout();
      var h = '<div class="layout-group-wrap"><div class="layout-group-header"><span></span><button class="layout-reset-btn" onclick="_tcoLayoutReset()">Сбросить всё</button></div><div class="group" style="padding:0">';
      tcoLay.forEach(function(item, i) {
        h += '<div class="row">' +
          '<div class="row-body"><div class="row-title">' + item.label + '</div></div>' +
          '<div class="row-right">' +
            '<label style="position:relative;display:inline-block;width:51px;height:31px">' +
              '<input type="checkbox" class="ios-toggle tco-layout-toggle" data-id="' + item.id + '"' + (item.enabled ? ' checked' : '') + '>' +
            '</label>' +
          '</div></div>';
      });
      return h + '</div></div>';
    })() +

    '<div class="slbl" style="margin-top:24px">О приложении</div>' +
    '<div class="group">' +
      '<div class="row"><div class="row-body"><div class="row-title">Версия</div></div><div class="row-right"><div class="row-val">2.5.0</div></div></div>' +
      (function(){ var svc=readCache('service'); var n=svc&&Array.isArray(svc.data)?svc.data.length:'—'; return '<div class="row"><div class="row-body"><div class="row-title">Записей обслуживания</div></div><div class="row-right"><div class="row-val">'+n+'</div></div></div>'; })() +
      '<div class="row" style="cursor:pointer" onclick="_clearCacheConfirm(event)"><div class="row-body"><div class="row-title" style="color:var(--red)">Очистить кэш</div><div class="row-sub">Данные перезагрузятся при следующем открытии</div></div></div>' +
    '</div></div>';

  // Layout toggles
  document.querySelectorAll('.layout-toggle').forEach(function(chk) {
    chk.addEventListener('change', function() {
      var id=this.dataset.id, gid=this.dataset.gid;
      var key=gid==='lg-reminders'?'reminders':gid==='lg-minicards'?'minicards':'sections';
      var lay=getHomeLayout();
      var it=lay[key].find(function(x){return x.id===id;});
      if(it) it.enabled=this.checked;
      saveHomeLayout(lay);
    });
  });
  ['lg-reminders','lg-minicards','lg-sections'].forEach(function(gid){
    _initDragGroup(document.getElementById(gid));
  });

  // TCO layout toggles
  document.querySelectorAll('.tco-layout-toggle').forEach(function(chk) {
    chk.addEventListener('change', function() {
      var id = this.dataset.id;
      var lay = getTcoLayout();
      var item = lay.find(function(x){ return x.id === id; });
      if (item) item.enabled = this.checked;
      saveTcoLayout(lay);
      // Перерисовываем без перезагрузки — как на Главной
      _updateTcoStats();
      // Подушка рендерится отдельно — обновляем её тоже
      var cushionArea = document.getElementById('tcoSavingsArea');
      if (cushionArea && window._tcoData) {
        cushionArea.innerHTML = _buildSavingsCard(window._tcoData, window._tcoCcy || 'zł');
        setTimeout(function(){ _initCushionSeg(); _refreshCushionChips(window._tcoData, window._tcoCcy||'zł','week'); }, 100);
      }
    });
  });

  _loadCarSettingsFromSheet();
}

function renderTCO(data) {
  if (!data || !data.success) {
    DOM.pageContent.innerHTML =
      '<div class="error-card">'+
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
        '<p class="error-title">Ошибка загрузки</p>'+
        '<p class="error-sub">'+((data&&data.error)||'Нет данных')+'</p>'+
        '<button class="ios-btn-primary" onclick="loadData()">Повторить</button>'+
      '</div>';
    return;
  }

  // Старый кэш без byYear — сбрасываем
  if (!data.byYear || Object.keys(data.byYear).length === 0) {
    localStorage.removeItem('cache_v2_tco');
    loadData();
    return;
  }
  window._tcoData = data;
  window._activeTcoYear = window._activeTcoYear || 'all';

  var ccy = 'zł';
  try { ccy = JSON.parse(localStorage.getItem('car_settings')||'{}').currency||'zł'; } catch(e){}
  window._tcoCcy = ccy;

  var years = Object.keys(data.byYear||{}).map(Number).sort(function(a,b){return b-a;});
  var yearChips = '<div class="chip'+(window._activeTcoYear==='all'?' active':'')+'" data-year="all">Все</div>';
  years.forEach(function(y){
    yearChips += '<div class="chip'+(window._activeTcoYear==y?' active':'')+'" data-year="'+y+'">'+y+'</div>';
  });

  DOM.pageContent.innerHTML =
    '<div class="anim">'+
    _buildTcoHero(data, ccy)+
    '<div class="chips" id="tcoYearChips" style="margin-bottom:4px">'+yearChips+'</div>'+
    '<div id="tcoStatsArea"></div>'+
    '<div id="tcoSavingsArea">'+_buildSavingsCard(data, ccy)+'</div>'+
    '</div>';

  document.querySelectorAll('#tcoYearChips .chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      document.querySelectorAll('#tcoYearChips .chip').forEach(function(c){c.classList.remove('active');});
      this.classList.add('active');
      window._activeTcoYear = this.dataset.year;
      _updateTcoStats();
    });
  });

  _updateTcoStats();

  // Инициализируем сегмент Минимум/По пробегу
  setTimeout(function(){ _initCushionSeg(); }, 100);

  // Обработчик чипов динамической подушки
  setTimeout(function() {
    document.querySelectorAll('#cushionPeriodChips .chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        document.querySelectorAll('#cushionPeriodChips .chip').forEach(function(c){ c.classList.remove('active'); });
        this.classList.add('active');
        var period = this.dataset.cushion;
        var tcoData = window._tcoData || {};
        var ccy = window._tcoCcy || 'zł';
        // Пересчитываем стоимости 1 км
        var svcPerYear = tcoData.avgServicePerYear || 0;
        var insPerYear = tcoData.lastInsuranceCost || 0;
        var fuelPerKm = 0;
        try {
          var fc = readCache('fuel');
          if (fc && fc.data) {
            var THRESHOLD = 2.5;
            var gasD = fc.data.filter(function(e){ return (e.fuelType||'').toLowerCase().includes('газ'); });
            var extraD = fc.data.filter(function(e){
              var t=(e.fuelType||'').toLowerCase(); var c=parseFloat(e.fuelConsumption);
              return (t.includes('бензин')||t.includes('petrol')) && c>0 && c<THRESHOLD;
            });
            var l5g = gasD.filter(function(e){return parseFloat(e.fuelConsumption)>0;}).slice(-5);
            var l5e = extraD.slice(-5);
            var agc = l5g.length ? l5g.reduce(function(s,e){return s+parseFloat(e.fuelConsumption);},0)/l5g.length : null;
            var agp = (function(){ var p=l5g.filter(function(e){return parseFloat(e.pricePerLiter)>0;}); return p.length?p.reduce(function(s,e){return s+(parseFloat(e.pricePerLiter)||0);},0)/p.length:null; })();
            var aec = l5e.length ? l5e.reduce(function(s,e){return s+parseFloat(e.fuelConsumption);},0)/l5e.length : 0;
            var aep = (function(){ var p=l5e.filter(function(e){return parseFloat(e.pricePerLiter)>0;}); return p.length?p.reduce(function(s,e){return s+(parseFloat(e.pricePerLiter)||0);},0)/p.length:0; })();
            if (agc && agp) fuelPerKm = (agc*agp + aec*aep) / 100;
          }
        } catch(e) {}
        var allDist=0, firstDate=null;
        try {
          var fc2=readCache('fuel');
          if (fc2&&fc2.data) {
            allDist=fc2.data.reduce(function(s,e){return s+(parseFloat(e.distance)||0);},0);
            firstDate=fc2.data.reduce(function(mn,e){var d=parseCustomDate(e.date);return(!mn||d<mn)?d:mn;},null);
          }
        } catch(e) {}
        var avgYearKm = firstDate ? Math.round(allDist/((new Date()-firstDate)/(1000*60*60*24*30.4))*12) : 50000;
        var svcPerKm = avgYearKm>0 ? svcPerYear/avgYearKm : 0;
        var insPerKm = avgYearKm>0 ? insPerYear/avgYearKm : 0;
        var noFuelPerKm = svcPerKm + insPerKm;
        var withFuelPerKm = fuelPerKm + svcPerKm + insPerKm;
        var fmt = function(v){ return Math.round(v).toLocaleString('ru'); };
        var fmt2 = function(v){ return v.toFixed(2); };
        var body = document.getElementById('dynCushionBody');
        // Пересчитываем параметры и обновляем body
        var tcoD = window._tcoData || {};
        var byY = tcoD.byYear || {};
        var curY = new Date().getFullYear();
        var fullY = Object.keys(byY).map(Number).filter(function(y){return y<curY;}).sort().slice(-2);
        var avgSvc=0,avgTun=0,avgTax=0;
        if(fullY.length>0){fullY.forEach(function(y){var yd=byY[y]||{};avgSvc+=(yd.service||0);avgTun+=(yd.tuning||0);avgTax+=((yd.taxes||0)+(yd.penalties||0)+(yd.other||0));});avgSvc/=fullY.length;avgTun/=fullY.length;avgTax/=fullY.length;}
        var svcPKm2=avgYearKm>0?avgSvc/avgYearKm:0, tunPKm2=avgYearKm>0?avgTun/avgYearKm:0, taxPKm2=avgYearKm>0?avgTax/avgYearKm:0;
        var nonFuelPKm2=svcPKm2+tunPKm2+taxPKm2;
        var ins2=tcoD.lastInsuranceCost||0;
        if (body) body.innerHTML = _dynCushionBody(period, fuelPerKm, nonFuelPKm2, svcPKm2, tunPKm2, taxPKm2, ins2/52, ins2/12, ccy, fmt, fmt2);
      });
    });
  }, 200);
}

function _buildTcoHero(data, ccy) {
  var fmt = function(v){return Math.round(v).toLocaleString('ru');};
  return '<div class="hero blue">'+
    '<div class="hero-lbl">Стоимость 1 км</div>'+
    '<div class="hero-val">'+data.costPerKm+' <span class="hero-unit">'+ccy+'</span></div>'+
    '<div class="hero-sub">'+fmt(data.totalDistance||0)+' км · '+fmt(data.totalCost||0)+' '+ccy+' всего</div>'+
    '<div class="hero-icon"><svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></div>'+
  '</div>';
}

// ── ДИНАМИЧЕСКАЯ ФИНАНСОВАЯ ПОДУШКА ───────────────────────────────────────────
function _buildDynamicCushionInner(tcoData, ccy) {
  // Если кэша топлива нет — грузим фоново и пересчитываем подушку после загрузки
  if (!readCache('fuel')) {
    fetch(GAS_BASE_URL + '?page=fuel')
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (!Array.isArray(data) || !data.length) return;
        writeCache('fuel', data);
        // Пересчитываем тело подушки если блок ещё в DOM
        var body = document.getElementById('dynCushionBody');
        if (!body) return;
        var tcoD = window._tcoData || {};
        var ccyD = window._tcoCcy  || 'zł';
        var inner = _buildDynamicCushionInner ? _buildDynamicCushionInner(tcoD, ccyD) : '';
        var pane = document.getElementById('cushionMileagePane');
        if (pane && inner) pane.innerHTML = inner;
        // Перевешиваем обработчики сегмента и чипов
        _initCushionSeg();
        _refreshCushionChips(tcoD, ccyD, 'week');
        // Перевешиваем обработчики чипов
        var activeChip = document.querySelector('#cushionPeriodChips .chip.active');
        var period = activeChip ? activeChip.dataset.cushion : 'week';
        _refreshCushionChips(tcoD, ccyD, period);
      })
      .catch(function(){});
  }

  // ── Стоимость 1 км топлива (газ + доп. бензин, последние 5 заправок) ────────
  var fuelCostPerKm = 0;
  try {
    var fc = readCache('fuel');
    if (fc && fc.data && Array.isArray(fc.data)) {
      var THRESHOLD = 2.5;
      var gasD  = fc.data.filter(function(e){ return (e.fuelType||'').toLowerCase().includes('газ') && parseFloat(e.fuelConsumption)>0; });
      var extraD = fc.data.filter(function(e){
        var t=(e.fuelType||'').toLowerCase(); var c=parseFloat(e.fuelConsumption);
        return (t.includes('бензин')||t.includes('petrol')) && c>0 && c<THRESHOLD;
      });
      var l5g = gasD.slice(-5), l5e = extraD.slice(-5);
      var avgGC = l5g.length ? l5g.reduce(function(s,e){return s+parseFloat(e.fuelConsumption);},0)/l5g.length : null;
      var avgGP = (function(){ var p=l5g.filter(function(e){return parseFloat(e.pricePerLiter)>0;}); return p.length?p.reduce(function(s,e){return s+(parseFloat(e.pricePerLiter)||0);},0)/p.length:null; })();
      var avgEC = l5e.length ? l5e.reduce(function(s,e){return s+parseFloat(e.fuelConsumption);},0)/l5e.length : 0;
      var avgEP = (function(){ var p=l5e.filter(function(e){return parseFloat(e.pricePerLiter)>0;}); return p.length?p.reduce(function(s,e){return s+(parseFloat(e.pricePerLiter)||0);},0)/p.length:0; })();
      if (avgGC && avgGP) fuelCostPerKm = (avgGC*avgGP + avgEC*avgEP) / 100;
    }
  } catch(e) {}

  // ── Среднегодовой пробег из журнала заправок ─────────────────────────────────
  var avgYearKm = 50000;
  try {
    var fc2 = readCache('fuel');
    if (fc2 && fc2.data && Array.isArray(fc2.data)) {
      var allDist = fc2.data.reduce(function(s,e){ return s+(parseFloat(e.distance)||0); }, 0);
      var firstDate = fc2.data.reduce(function(mn,e){ var d=parseCustomDate(e.date); return (!mn||d<mn)?d:mn; }, null);
      if (firstDate && allDist > 0) {
        var months = (new Date()-firstDate)/(1000*60*60*24*30.4);
        if (months > 0) avgYearKm = Math.round(allDist/months*12);
      }
    }
  } catch(e) {}

  // ── Среднее за год по статьям (кроме топлива и страховки) ───────────────────
  // Берём из byYear: сервис + тюнинг + налоги — среднее за последние 2 полных года
  var byYear = tcoData.byYear || {};
  var curYear = new Date().getFullYear();
  var fullYears = Object.keys(byYear).map(Number).filter(function(y){ return y < curYear; }).sort().slice(-2);

  var avgSvcYear    = 0; // сервис
  var avgTuningYear = 0; // тюнинг
  var avgTaxesYear  = 0; // налоги+штрафы+прочее
  if (fullYears.length > 0) {
    fullYears.forEach(function(y) {
      var yd = byYear[y] || {};
      avgSvcYear    += (yd.service   || 0);
      avgTuningYear += (yd.tuning    || 0);
      avgTaxesYear  += ((yd.taxes||0) + (yd.penalties||0) + (yd.other||0));
    });
    avgSvcYear    /= fullYears.length;
    avgTuningYear /= fullYears.length;
    avgTaxesYear  /= fullYears.length;
  }

  // Стоимость 1 км по статьям (зависят от пробега)
  var svcPerKm    = avgYearKm > 0 ? avgSvcYear    / avgYearKm : 0;
  var tuningPerKm = avgYearKm > 0 ? avgTuningYear / avgYearKm : 0;
  var taxesPerKm  = avgYearKm > 0 ? avgTaxesYear  / avgYearKm : 0;
  var nonFuelPerKm = svcPerKm + tuningPerKm + taxesPerKm; // всё кроме топлива и страховки

  // ── Страховка — фиксированная, не зависит от пробега ─────────────────────────
  var insPerYear = tcoData.lastInsuranceCost || 0;
  var insPerWeek = insPerYear / 52;
  var insPerMonth = insPerYear / 12;

  var fmt  = function(v){ return Math.round(v).toLocaleString('ru'); };
  var fmt2 = function(v){ return v.toFixed(2); };

  return '<div style="display:flex;justify-content:flex-end;margin-bottom:14px">'+
        '<div class="chips" id="cushionPeriodChips" style="margin:0">'+
          '<div class="chip active" data-cushion="week">Эта нед.</div>'+
          '<div class="chip" data-cushion="prevweek">Прош. нед.</div>'+
          '<div class="chip" data-cushion="month">Месяц</div>'+
        '</div>'+
      '</div>'+
      '<div id="dynCushionBody">'+
        _dynCushionBody('week', fuelCostPerKm, nonFuelPerKm, svcPerKm, tuningPerKm, taxesPerKm, insPerWeek, insPerMonth, ccy, fmt, fmt2)+
      '</div>'+
      '<div style="font-size:11px;color:var(--text3);padding-top:8px;border-top:0.5px solid var(--sep);margin-top:8px">'+
        '* Пробег из журнала · страховка '+fmt(insPerYear)+' '+ccy+'/год (фикс.)'+
      '</div>';
}

// Инициализирует сегмент Минимум / По пробегу
function _initCushionSeg() {
  document.querySelectorAll('#cushionSeg .ios-seg-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#cushionSeg .ios-seg-btn').forEach(function(b){ b.classList.remove('active'); });
      this.classList.add('active');
      var seg = this.dataset.cseg;
      var minPane     = document.getElementById('cushionMinPane');
      var mileagePane = document.getElementById('cushionMileagePane');
      if (minPane)     minPane.style.display     = seg === 'min'     ? 'block' : 'none';
      if (mileagePane) mileagePane.style.display = seg === 'mileage' ? 'block' : 'none';
    });
  });
}

// Перевешивает обработчики чипов подушки после пересчёта
function _refreshCushionChips(tcoData, ccy, activePeriod) {
  setTimeout(function() {
    document.querySelectorAll('#cushionPeriodChips .chip').forEach(function(chip) {
      // Клонируем чтобы снять старые обработчики
      var newChip = chip.cloneNode(true);
      chip.parentNode.replaceChild(newChip, chip);
    });
    document.querySelectorAll('#cushionPeriodChips .chip').forEach(function(chip) {
      if (chip.dataset.cushion === activePeriod) chip.classList.add('active');
      chip.addEventListener('click', function() {
        document.querySelectorAll('#cushionPeriodChips .chip').forEach(function(c){ c.classList.remove('active'); });
        this.classList.add('active');
        var period = this.dataset.cushion;
        var fc = readCache('fuel');
        if (!fc) return;
        // Пересчитываем параметры
        var THRESHOLD = 2.5;
        var fd = fc.data;
        var gasD  = fd.filter(function(e){ return (e.fuelType||'').toLowerCase().includes('газ') && parseFloat(e.fuelConsumption)>0; });
        var extraD = fd.filter(function(e){ var t=(e.fuelType||'').toLowerCase();var c=parseFloat(e.fuelConsumption);return(t.includes('бензин')||t.includes('petrol'))&&c>0&&c<THRESHOLD; });
        var l5g=gasD.slice(-5),l5e=extraD.slice(-5);
        var agc=l5g.length?l5g.reduce(function(s,e){return s+parseFloat(e.fuelConsumption);},0)/l5g.length:null;
        var agp=(function(){var p=l5g.filter(function(e){return parseFloat(e.pricePerLiter)>0;});return p.length?p.reduce(function(s,e){return s+(parseFloat(e.pricePerLiter)||0);},0)/p.length:null;})();
        var aec=l5e.length?l5e.reduce(function(s,e){return s+parseFloat(e.fuelConsumption);},0)/l5e.length:0;
        var aep=(function(){var p=l5e.filter(function(e){return parseFloat(e.pricePerLiter)>0;});return p.length?p.reduce(function(s,e){return s+(parseFloat(e.pricePerLiter)||0);},0)/p.length:0;})();
        var fuelPerKm=(agc&&agp)?(agc*agp+aec*aep)/100:0;
        var allDist=fd.reduce(function(s,e){return s+(parseFloat(e.distance)||0);},0);
        var firstDate=fd.reduce(function(mn,e){var d=parseCustomDate(e.date);return(!mn||d<mn)?d:mn;},null);
        var avgYearKm=50000;
        if(firstDate&&allDist>0){var months=(new Date()-firstDate)/(1000*60*60*24*30.4);if(months>0)avgYearKm=Math.round(allDist/months*12);}
        var byY=tcoData.byYear||{},curY=new Date().getFullYear();
        var fullY=Object.keys(byY).map(Number).filter(function(y){return y<curY;}).sort().slice(-2);
        var avgSvc=0,avgTun=0,avgTax=0;
        if(fullY.length){fullY.forEach(function(y){var yd=byY[y]||{};avgSvc+=(yd.service||0);avgTun+=(yd.tuning||0);avgTax+=((yd.taxes||0)+(yd.penalties||0)+(yd.other||0));});avgSvc/=fullY.length;avgTun/=fullY.length;avgTax/=fullY.length;}
        var svcPKm=avgYearKm>0?avgSvc/avgYearKm:0,tunPKm=avgYearKm>0?avgTun/avgYearKm:0,taxPKm=avgYearKm>0?avgTax/avgYearKm:0;
        var nonFuelPKm=svcPKm+tunPKm+taxPKm;
        var ins=tcoData.lastInsuranceCost||0;
        var fmt=function(v){return Math.round(v).toLocaleString('ru');};
        var fmt2=function(v){return v.toFixed(2);};
        var body=document.getElementById('dynCushionBody');
        if(body) body.innerHTML=_dynCushionBody(period,fuelPerKm,nonFuelPKm,svcPKm,tunPKm,taxPKm,ins/52,ins/12,ccy,fmt,fmt2);
      });
    });
  }, 50);
}

function _dynCushionBody(period, fuelPerKm, nonFuelPerKm, svcPerKm, tuningPerKm, taxesPerKm, insPerWeek, insPerMonth, ccy, fmt, fmt2) {
  // Пробег за период
  var km = 0;
  try {
    var fc = readCache('fuel');
    if (fc && fc.data && Array.isArray(fc.data)) {
      var now = new Date();
      var dateFrom, dateTo;
      if (period === 'prevweek') {
        dateFrom = getWeekStart(now, 1);
        dateTo   = new Date(dateFrom); dateTo.setDate(dateTo.getDate()+6); dateTo.setHours(23,59,59,999);
      } else if (period === 'month') {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        dateTo   = new Date(); dateTo.setHours(23,59,59,999);
      } else { // week
        dateFrom = getWeekStart(now, 0);
        dateTo   = new Date(); dateTo.setHours(23,59,59,999);
      }
      km = fc.data
        .filter(function(e){ return isDateInRange(e.date, dateFrom, dateTo); })
        .reduce(function(s,e){ return s+(parseFloat(e.distance)||0); }, 0);
    }
  } catch(e) {}
  km = Math.round(km);

  // Страховка — фиксированная за период
  var insFixed = Math.round(period === 'month' ? insPerMonth : insPerWeek);

  // Остальные статьи — от пробега
  var fuelAmt   = Math.round(km * fuelPerKm);
  var svcAmt    = Math.round(km * svcPerKm);
  var tuningAmt = Math.round(km * tuningPerKm);
  var taxesAmt  = Math.round(km * taxesPerKm);
  var nonFuelAmt = svcAmt + tuningAmt + taxesAmt;

  var withFuel = fuelAmt + nonFuelAmt + insFixed;
  var noFuel   = nonFuelAmt + insFixed;

  if (km === 0 && insFixed === 0) {
    return '<div style="text-align:center;padding:16px 0;color:var(--text2);font-size:13px">'+
      'Нет данных о пробеге за выбранный период.<br>'+
      '<span style="font-size:11px">Заполняйте поле «Расстояние» при добавлении заправок.</span>'+
    '</div>';
  }

  return '<div style="font-size:13px;color:var(--text2);margin-bottom:12px">'+
      'Пробег: <b style="color:var(--text)">'+fmt(km)+' км</b>'+
      (insFixed>0?' · страховка (фикс.): <b style="color:var(--text)">'+fmt(insFixed)+' '+ccy+'</b>':'')+
    '</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'+
      '<div style="background:var(--accent-bg);border-radius:12px;padding:12px;text-align:center">'+
        '<div style="font-size:10px;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">С топливом</div>'+
        '<div style="font-size:24px;font-weight:700;color:var(--text);letter-spacing:-0.5px;font-family:var(--font-r);line-height:1">'+fmt(withFuel)+'</div>'+
        '<div style="font-size:12px;color:var(--accent);margin-top:2px">'+ccy+'</div>'+
      '</div>'+
      '<div style="background:var(--green-bg);border-radius:12px;padding:12px;text-align:center">'+
        '<div style="font-size:10px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Без топлива</div>'+
        '<div style="font-size:24px;font-weight:700;color:var(--text);letter-spacing:-0.5px;font-family:var(--font-r);line-height:1">'+fmt(noFuel)+'</div>'+
        '<div style="font-size:12px;color:var(--green);margin-top:2px">'+ccy+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="border-top:0.5px solid var(--sep);padding-top:10px">'+
      (fuelAmt>0?'<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">'+
        '<span style="color:var(--text2);display:flex;align-items:center"><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:#FF9500;margin-right:6px"></span>Топливо <span style="font-size:11px;color:var(--text3);margin-left:2px">('+fmt(km)+' км)</span></span>'+
        '<span style="font-weight:600;color:var(--text)">'+fmt(fuelAmt)+' '+ccy+'</span></div>':'')+
      (svcAmt>0?'<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">'+
        '<span style="color:var(--text2);display:flex;align-items:center"><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:#007AFF;margin-right:6px"></span>Сервис</span>'+
        '<span style="font-weight:600;color:var(--text)">'+fmt(svcAmt)+' '+ccy+'</span></div>':'')+
      (tuningAmt>0?'<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">'+
        '<span style="color:var(--text2);display:flex;align-items:center"><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:#5856D6;margin-right:6px"></span>Тюнинг</span>'+
        '<span style="font-weight:600;color:var(--text)">'+fmt(tuningAmt)+' '+ccy+'</span></div>':'')+
      (taxesAmt>0?'<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">'+
        '<span style="color:var(--text2);display:flex;align-items:center"><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:#30B0C7;margin-right:6px"></span>Налоги и штрафы</span>'+
        '<span style="font-weight:600;color:var(--text)">'+fmt(taxesAmt)+' '+ccy+'</span></div>':'')+
      (insFixed>0?'<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">'+
        '<span style="color:var(--text2);display:flex;align-items:center"><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:#34C759;margin-right:6px"></span>Страховка <span style="font-size:11px;color:var(--text3);margin-left:2px">(фикс.)</span></span>'+
        '<span style="font-weight:600;color:var(--text)">'+fmt(insFixed)+' '+ccy+'</span></div>':'')+
    '</div>';
}


function _buildSavingsCard(data, ccy) {
  var _tcoLay = getTcoLayout();
  var _cushionItem = _tcoLay.find(function(x){ return x.id === 'cushion'; });
  if (_cushionItem && !_cushionItem.enabled) return '';

  var ins  = data.lastInsuranceCost || 0;
  var svc  = data.avgServicePerYear || 0;
  var insY = data.lastInsuranceYear || '';
  if (!ins && !svc) return '';

  var yearTotal = ins + svc;
  var perMonth  = Math.round(yearTotal / 12);
  var perWeek   = Math.round(yearTotal / 52);
  var fmt = function(v){ return Math.round(v).toLocaleString('ru'); };
  var noteYear = insY || (new Date().getFullYear() - 1);

  // Вкладка «Минимум»
  var minContent =
    '<div style="display:flex;gap:8px;margin-bottom:14px">'+
      '<div style="flex:1;background:var(--green-bg);border-radius:12px;padding:12px;text-align:center">'+
        '<div style="font-size:11px;color:var(--green);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">В неделю</div>'+
        '<div style="font-size:26px;font-weight:700;color:var(--green);letter-spacing:-1px">'+fmt(perWeek)+'</div>'+
        '<div style="font-size:12px;color:var(--green)">'+ccy+'</div>'+
      '</div>'+
      '<div style="flex:1;background:var(--accent-bg);border-radius:12px;padding:12px;text-align:center">'+
        '<div style="font-size:11px;color:var(--accent);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">В месяц</div>'+
        '<div style="font-size:26px;font-weight:700;color:var(--accent);letter-spacing:-1px">'+fmt(perMonth)+'</div>'+
        '<div style="font-size:12px;color:var(--accent)">'+ccy+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="border-top:0.5px solid var(--sep);padding-top:12px">'+
      (ins?'<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">'+
        '<span style="color:var(--text2);display:flex;align-items:center"><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:#34C759;margin-right:6px"></span>Страховка</span>'+
        '<span style="font-weight:600;color:var(--text)">'+fmt(ins)+' '+ccy+'/год</span></div>':'')+
      (svc?'<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">'+
        '<span style="color:var(--text2);display:flex;align-items:center"><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:#007AFF;margin-right:6px"></span>Обслуживание</span>'+
        '<span style="font-weight:600;color:var(--text)">'+fmt(svc)+' '+ccy+'/год</span></div>':'')+
      '<div style="font-size:11px;color:var(--text3);padding-top:6px">'+
        'Данные за '+noteYear+' г. · минимум без топлива'+
      '</div>'+
    '</div>';

  // Вкладка «По пробегу» — контент из _buildDynamicCushion без внешней обёртки
  var mileageContent = _buildDynamicCushionInner(data, ccy);

  return '<div class="slbl" style="margin-top:10px">Финансовая подушка</div>'+
    '<div class="group" style="padding:16px">'+
      // Сегмент
      '<div style="display:flex;justify-content:center;margin-bottom:16px">'+
        '<div class="ios-seg" id="cushionSeg">'+
          '<div class="ios-seg-btn active" data-cseg="min">Минимум</div>'+
          '<div class="ios-seg-btn" data-cseg="mileage">По пробегу</div>'+
        '</div>'+
      '</div>'+
      '<div id="cushionMinPane">'+minContent+'</div>'+
      '<div id="cushionMileagePane" style="display:none">'+mileageContent+'</div>'+
    '</div>';
}

function _updateTcoStats() {
  var data    = window._tcoData || {};
  var ccy     = window._tcoCcy  || 'zł';
  var yearSel = window._activeTcoYear || 'all';
  var byYear  = data.byYear || {};
  var fmt     = function(v){ return Math.round(v).toLocaleString('ru'); };

  // ── Данные за период ─────────────────────────────────────
  var cat, total;
  if (yearSel === 'all') {
    cat   = data.categories || {};
    total = data.totalCost  || 0;
  } else {
    var yd = byYear[yearSel] || {};
    // byYear теперь содержит разбивку страховки/налогов/штрафов по годам
    cat = {
      fuel:       yd.fuel       || 0,
      service:    yd.service    || 0,
      tuning:     yd.tuning     || 0,
      insurance:  yd.insurance  || 0,
      taxes:      yd.taxes      || 0,
      penalties:  yd.penalties  || 0,
      other:      yd.other      || 0,
      fines:      yd.fines      || 0,
    };
    total = yd.total || 0;
  }

  // Категории для донат + прогресс-баров
  var chartCats = [
    {name:'Топливо',      value:cat.fuel      ||0, color:'#FF9500'},
    {name:'Обслуживание', value:cat.service   ||0, color:'#007AFF'},
    {name:'Тюнинг',       value:cat.tuning    ||0, color:'#5856D6'},
    {name:'Страховка',    value:cat.insurance ||0, color:'#34C759'},
    {name:'Налоги',       value:cat.taxes     ||0, color:'#30B0C7'},
    {name:'Штрафы',       value:cat.penalties ||0, color:'#FF3B30'},
    {name:'Прочее',       value:cat.other     ||0, color:'#8E8E93'},
  ].filter(function(c){ return c.value > 0.5; });

  // ── Тренд ────────────────────────────────────────────────
  var trendHTML = '—';
  if (yearSel !== 'all') {
    var prevYd = byYear[parseInt(yearSel)-1];
    if (prevYd && prevYd.total > 0) {
      var p = Math.round(((total-prevYd.total)/prevYd.total)*100);
      trendHTML = '<span class="'+(p>0?'trend-up':'trend-down')+'">'+(p>0?'↑':'↓')+Math.abs(p)+'%</span> vs '+(parseInt(yearSel)-1);
    }
  } else {
    var allYrs = Object.keys(byYear).map(Number).sort();
    if (allYrs.length >= 2) {
      var last2 = allYrs.slice(-2);
      var t0=byYear[last2[0]].total||0, t1=byYear[last2[1]].total||0;
      if (t0>0){var p2=Math.round(((t1-t0)/t0)*100);trendHTML='<span class="'+(p2>0?'trend-up':'trend-down')+'">'+(p2>0?'↑':'↓')+Math.abs(p2)+'%</span> vs '+last2[0];}
    }
  }

  var countYears  = Object.keys(byYear).length || 1;
  var perYearAvg  = yearSel==='all' ? total/countYears : total;
  var periodLabel = yearSel==='all' ? 'за всё время' : 'за '+yearSel+' год';
  var topCat      = chartCats.length ? chartCats.reduce(function(mx,c){return c.value>mx.value?c:mx;},chartCats[0]) : null;
  var fuelPct     = total>0 ? (cat.fuel||0)/total*100 : 0;

  var allYearsArr = Object.keys(byYear).map(Number).sort().map(function(y){
    var yd=byYear[y];
    return {year:y,total:yd.total||0,fuel:yd.fuel||0,service:yd.service||0,
            insurance:yd.insurance||0,taxes:yd.taxes||0,penalties:yd.penalties||0,
            tuning:yd.tuning||0,other:yd.other||0};
  });

  // ── Прогресс-бары ────────────────────────────────────────
  var progs = chartCats.map(function(c){
    var p=total>0?(c.value/total*100):0;
    return '<div class="tco-prog">'+
      '<div class="tco-prog-head">'+
        '<div class="tco-prog-dot" style="background:'+c.color+'"></div>'+
        '<span class="tco-prog-name">'+c.name+'</span>'+
        '<span class="tco-prog-val" style="color:'+c.color+'">'+fmt(c.value)+' '+ccy+'</span>'+
        '<span class="tco-prog-pct">'+p.toFixed(1)+'%</span>'+
      '</div>'+
      '<div class="tco-prog-track"><div class="tco-prog-fill" style="width:'+p.toFixed(1)+'%;background:'+c.color+'"></div></div>'+
    '</div>';
  }).join('');

  // ── Инсайт ───────────────────────────────────────────────
  var insight = topCat
    ? 'Главная статья — <b>'+topCat.name+'</b> ('+(topCat.value/total*100).toFixed(0)+'%). '+(fuelPct>50?'ГБО помогает снизить долю топлива.':'')
    : '';

  var el=document.getElementById('tcoStatsArea');
  if(el){
    var tcoLayout = getTcoLayout();
    var isOn = function(id){ var item=tcoLayout.find(function(x){return x.id===id;}); return !item||item.enabled; };

    var filteredHtml = '';

    if (isOn('cards'))
      filteredHtml +=
        '<div class="stat-cards-row">'+
          '<div class="stat-card-ios"><div class="sc-label">'+periodLabel+'</div><div class="sc-value">'+fmt(total)+'<span class="u"> '+ccy+'</span></div><div class="sc-sub">'+(yearSel==='all'?countYears+' лет учёта':(topCat?topCat.name.toLowerCase():''))+'</div></div>'+
          '<div class="stat-card-ios"><div class="sc-label">В месяц</div><div class="sc-value">'+fmt(Math.round(perYearAvg/12))+'<span class="u"> '+ccy+'</span></div><div class="sc-sub">среднее</div></div>'+
        '</div>'+
        '<div class="stat-cards-row">'+
          '<div class="stat-card-ios"><div class="sc-label">В неделю</div><div class="sc-value">'+fmt(Math.round(perYearAvg/52))+'<span class="u"> '+ccy+'</span></div><div class="sc-sub">среднее</div></div>'+
          '<div class="stat-card-ios"><div class="sc-label">Тренд</div><div class="sc-value" style="font-size:18px">'+trendHTML+'</div><div class="sc-sub">год к году</div></div>'+
        '</div>';

    if (isOn('chart'))
      filteredHtml +=
        '<div class="slbl">График расходов</div>'+
        '<div class="group" style="padding:0">'+
          '<div style="display:flex;border-bottom:0.5px solid var(--sep);padding:10px 16px 0;gap:0">'+
            '<button id="tcoSegMon" onclick="_tcoSegSwitch(\'mon\')" style="flex:1;padding:7px 0;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--accent)">По месяцам</button>'+
            '<button id="tcoSegYr"  onclick="_tcoSegSwitch(\'yr\')"  style="flex:1;padding:7px 0;font-size:13px;font-weight:500;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:var(--text2)">По годам</button>'+
          '</div>'+
          '<div id="tcoChartArea" style="padding:14px 12px 10px">'+_buildTcoMonthlyChart(data,yearSel,ccy)+'</div>'+
        '</div>';

    if (isOn('dist'))
      filteredHtml +=
        '<div class="slbl">Распределение</div>'+
        '<div class="group" style="padding:0">'+
          '<div style="display:flex;border-bottom:0.5px solid var(--sep);padding:10px 16px 0;gap:0">'+
            '<button id="tcoSegDonut" onclick="_tcoDistSwitch(\'donut\')" style="flex:1;padding:7px 0;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--accent)">Диаграмма</button>'+
            '<button id="tcoSegBars"  onclick="_tcoDistSwitch(\'bars\')"  style="flex:1;padding:7px 0;font-size:13px;font-weight:500;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:var(--text2)">Детализация</button>'+
          '</div>'+
          '<div id="tcoDistArea" style="padding:16px">'+buildDonutChart(chartCats,total)+'</div>'+
        '</div>';

    if (isOn('insurance'))
      filteredHtml += Object.keys(data.insuranceByYear||{}).length>0
        ? '<div class="slbl">Страховка по годам</div><div class="group" style="padding:0">'+_buildInsuranceRows(data.insuranceByYear,ccy)+'</div>' : '';

    if (isOn('yearcomp'))
      filteredHtml += allYearsArr.length>1
        ? '<div class="slbl">Год к году</div><div class="group" style="padding:0">'+_buildTcoYearCompare(allYearsArr,ccy,byYear)+'</div>' : '';

    if (isOn('insight'))
      filteredHtml += insight
        ? '<div class="tco-insight"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>'+insight+'</span></div>' : '';

    el.innerHTML=filteredHtml;
    // Сохраняем данные для переключателей
    window._tcoChartCats = chartCats;
    window._tcoChartTotal = total;
    window._tcoChartProgs = progs;
    window._tcoAllYears = allYearsArr;
    _initTcoBarClicks();
    // Восстанавливаем активный сегмент
    if(window._tcoDistSeg==='bars') _tcoDistSwitch('bars');
    if(window._tcoChartSeg==='yr')  _tcoSegSwitch('yr');
  }
}

// Переключает сегмент "По месяцам / По годам"
function _tcoSegSwitch(seg) {
  window._tcoChartSeg = seg;
  var monBtn = document.getElementById('tcoSegMon');
  var yrBtn  = document.getElementById('tcoSegYr');
  var area   = document.getElementById('tcoChartArea');
  if(!monBtn||!yrBtn||!area) return;

  var activeStyle   = 'flex:1;padding:7px 0;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--accent)';
  var inactiveStyle = 'flex:1;padding:7px 0;font-size:13px;font-weight:500;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:var(--text2)';

  if(seg==='mon') {
    monBtn.style.cssText=activeStyle; yrBtn.style.cssText=inactiveStyle;
    area.innerHTML = _buildTcoMonthlyChart(window._tcoData, window._activeTcoYear||'all', window._tcoCcy||'zł');
  } else {
    yrBtn.style.cssText=activeStyle; monBtn.style.cssText=inactiveStyle;
    area.innerHTML = window._tcoAllYears && window._tcoAllYears.length > 0
      ? '<div style="padding:4px 0">'+_buildTcoBarChart(window._tcoAllYears, window._tcoCcy||'zł', parseInt(window._activeTcoYear)||0)+'</div>'
      : '<div class="empty-state" style="padding:20px 0">Нет данных</div>';
    _initTcoBarClicks();
  }
}

// Переключает сегмент "Диаграмма / Детализация"
function _tcoDistSwitch(seg) {
  window._tcoDistSeg = seg;
  var donutBtn = document.getElementById('tcoSegDonut');
  var barsBtn  = document.getElementById('tcoSegBars');
  var area     = document.getElementById('tcoDistArea');
  if(!donutBtn||!barsBtn||!area) return;

  var activeStyle   = 'flex:1;padding:7px 0;font-size:13px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--accent)';
  var inactiveStyle = 'flex:1;padding:7px 0;font-size:13px;font-weight:500;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:var(--text2)';

  if(seg==='donut') {
    donutBtn.style.cssText=activeStyle; barsBtn.style.cssText=inactiveStyle;
    area.innerHTML = buildDonutChart(window._tcoChartCats||[], window._tcoChartTotal||0);
  } else {
    barsBtn.style.cssText=activeStyle; donutBtn.style.cssText=inactiveStyle;
    area.innerHTML = '<div style="padding:4px 0">'+(window._tcoChartProgs||'<div class="empty-state">Нет данных</div>')+'</div>';
  }
}

// Доnat-диаграмма для TCO
function buildDonutChart(categories, total) {
  if(!categories||!categories.length||!total) return '<div class="empty-state">Нет данных</div>';
  var OX=75,OY=75,OR=58,IR=36,GAP=2.8;
  var toRad=function(d){return d*Math.PI/180;};
  function arc(s,e){
    var sa=s+GAP/2,ea=e-GAP/2;
    var x1=OX+OR*Math.cos(toRad(sa)),y1=OY+OR*Math.sin(toRad(sa));
    var x2=OX+OR*Math.cos(toRad(ea)),y2=OY+OR*Math.sin(toRad(ea));
    var x3=OX+IR*Math.cos(toRad(ea)),y3=OY+IR*Math.sin(toRad(ea));
    var x4=OX+IR*Math.cos(toRad(sa)),y4=OY+IR*Math.sin(toRad(sa));
    var lg=(ea-sa)>180?1:0;
    return 'M'+x1+' '+y1+' A'+OR+' '+OR+' 0 '+lg+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+IR+' '+IR+' 0 '+lg+' 0 '+x4+' '+y4+' Z';
  }
  var segs='',angle=-90;
  categories.forEach(function(c){var sw=(c.value/total)*360;segs+='<path d="'+arc(angle,angle+sw)+'" fill="'+c.color+'" opacity="0.9"/>';angle+=sw;});
  var top=categories.reduce(function(mx,c){return c.value>mx.value?c:mx;},categories[0]);
  var topPct=((top.value/total)*100).toFixed(1);
  var centre='<text x="'+OX+'" y="'+(OY-6)+'" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)" font-family="-apple-system">'+topPct+'%</text>'+
    '<text x="'+OX+'" y="'+(OY+12)+'" text-anchor="middle" font-size="10" fill="var(--text2)" font-family="-apple-system">'+top.name+'</text>';
  var rows='';
  categories.forEach(function(c){
    var pct=((c.value/total)*100).toFixed(1),amt=Math.round(c.value).toLocaleString('ru');
    rows+='<div class="tco-legend-row"><div class="tco-legend-dot" style="background:'+c.color+'"></div>'+
      '<span class="tco-legend-name">'+c.name+'</span>'+
      '<span class="tco-legend-amt">'+amt+'</span>'+
      '<span class="tco-legend-pct" style="color:'+c.color+'">'+pct+'%</span></div>';
  });
  return '<div class="tco-donut-wrap"><svg width="150" height="150" viewBox="0 0 150 150" style="flex-shrink:0">'+segs+centre+'</svg><div style="flex:1">'+rows+'</div></div>';
}

// Кликабельный столбчатый график по годам
function _buildTcoBarChart(years, ccy, activYear) {
  if(!years.length) return '';
  var maxVal=Math.max.apply(null,years.map(function(y){return y.total;}))||1;
  var n=years.length;
  var BAR_W=Math.max(28,Math.min(52,Math.floor(280/n)-6));
  var GAP=Math.max(6,Math.floor(BAR_W*0.3));
  var CHART_H=100, curYear=new Date().getFullYear();
  var html='';
  years.forEach(function(y){
    var bh=Math.max(4,Math.round((y.total/maxVal)*CHART_H));
    var isCur=(y.year===curYear),isSel=(activYear&&y.year===activYear);
    var bg=isCur?'var(--green)':isSel?'var(--accent)':'var(--accent-bg)';
    var hover=isCur?'#25a244':isSel?'#0060d0':'var(--indigo)';
    var lc=isCur?'var(--green)':isSel?'var(--accent)':'var(--text2)';
    html+='<div class="tco-bar-col"'+
      ' data-year="'+y.year+'" data-total="'+Math.round(y.total).toLocaleString('ru')+'"'+
      ' data-fuel="'+Math.round(y.fuel).toLocaleString('ru')+'" data-service="'+Math.round(y.service).toLocaleString('ru')+'"'+
      ' data-ccy="'+ccy+'"'+
      ' style="position:relative;display:inline-flex;flex-direction:column;align-items:center;width:'+BAR_W+'px;margin:0 '+(GAP/2)+'px;height:'+(CHART_H+32)+'px;vertical-align:bottom;cursor:pointer">'+
      '<div style="position:absolute;bottom:'+(bh+20)+'px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;font-weight:600;color:'+lc+'">'+Math.round(y.total).toLocaleString('ru')+'</div>'+
      '<div class="tco-bar-inner" data-bg="'+bg+'" data-hover="'+hover+'"'+
        ' style="position:absolute;bottom:20px;width:100%;height:'+bh+'px;background:'+bg+';border-radius:4px 4px 2px 2px;transition:background 0.15s"></div>'+
      '<div style="position:absolute;bottom:2px;font-size:10px;font-weight:'+(isCur?'700':'400')+';color:'+(isCur?'var(--green)':'var(--text2)')+'">'+y.year+'</div>'+
    '</div>';
  });
  return '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">'+
    '<div id="tcoBarWrap" style="display:flex;align-items:flex-end;padding:8px 4px 0;min-width:'+((BAR_W+GAP)*n+GAP)+'px">'+html+'</div>'+
    '<div id="tcoBarTip" style="display:none;position:fixed;background:var(--grouped);border:0.5px solid var(--sep);border-radius:10px;padding:9px 13px;font-size:13px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:500;min-width:150px;"></div>'+
  '</div>';
}

// Тултипы + клик для TCO-графика
function _initTcoBarClicks() {
  var cols=document.querySelectorAll('.tco-bar-col');
  var tip=document.getElementById('tcoBarTip');
  if(!tip||!cols.length) return;
  function show(col,x,y){
    tip.innerHTML='<div style="font-weight:600;color:var(--text);margin-bottom:4px">'+col.dataset.year+' год</div>'+
      '<div style="color:var(--text2)">Итого: <b style="color:var(--text)">'+col.dataset.total+' '+col.dataset.ccy+'</b></div>'+
      '<div style="color:var(--text2)">Топливо: <b style="color:var(--text)">'+col.dataset.fuel+' '+col.dataset.ccy+'</b></div>'+
      '<div style="color:var(--text2)">Сервис: <b style="color:var(--text)">'+col.dataset.service+' '+col.dataset.ccy+'</b></div>';
    tip.style.display='block';
    var tw=tip.offsetWidth||160,vw=window.innerWidth;
    tip.style.left=Math.min(x+12,vw-tw-12)+'px';tip.style.top=(y-110)+'px';
    var bar=col.querySelector('.tco-bar-inner');if(bar)bar.style.background=bar.dataset.hover;
  }
  function hide(col){
    tip.style.display='none';
    if(col){var bar=col.querySelector('.tco-bar-inner');if(bar)bar.style.background=bar.dataset.bg;}
  }
  cols.forEach(function(col){
    col.addEventListener('touchstart',function(e){e.preventDefault();var t=e.touches[0];show(col,t.clientX,t.clientY);},{passive:false});
    col.addEventListener('touchend',function(){setTimeout(function(){hide(col);},2000);});
    col.addEventListener('mouseenter',function(e){show(col,e.clientX,e.clientY);});
    col.addEventListener('mousemove',function(e){if(tip.style.display!=='none'){var tw=tip.offsetWidth||160;tip.style.left=Math.min(e.clientX+12,window.innerWidth-tw-12)+'px';tip.style.top=(e.clientY-110)+'px';}});
    col.addEventListener('mouseleave',function(){hide(col);});
    col.addEventListener('click',function(){
      var y=col.dataset.year;
      document.querySelectorAll('#tcoYearChips .chip').forEach(function(c){c.classList.toggle('active',c.dataset.year===y);});
      window._activeTcoYear=y; _updateTcoStats();
    });
  });
  document.addEventListener('click',function(e){if(!e.target.closest('.tco-bar-col'))hide(null);});
}

// Строки страховки по годам
function _buildInsuranceRows(insYear, ccy) {
  var years=Object.keys(insYear).map(Number).sort().reverse();
  var maxVal=Math.max.apply(null,years.map(function(y){return insYear[y];}))||1;
  var fmt=function(v){return Math.round(v).toLocaleString('ru');};
  return years.map(function(y){
    var v=insYear[y],bw=Math.round((v/maxVal)*100);
    return '<div style="display:flex;align-items:center;padding:11px 16px;gap:12px;border-bottom:0.5px solid var(--sep)">'+
      '<div style="font-size:15px;font-weight:600;color:var(--text);min-width:42px">'+y+'</div>'+
      '<div style="flex:1"><div style="height:5px;background:var(--bg2);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+bw+'%;background:var(--green);border-radius:3px"></div></div>'+
      '<div style="font-size:11px;color:var(--text2);margin-top:3px">'+fmt(Math.round(v/52))+' '+ccy+'/нед</div></div>'+
      '<div style="font-size:15px;font-weight:600;color:var(--text);min-width:80px;text-align:right">'+fmt(v)+' '+ccy+'</div>'+
    '</div>';
  }).join('');
}

// Год к году — полная разбивка по статьям, без эмодзи
function _buildTcoYearCompare(yearsArr, ccy, byYear) {
  var fmt=function(v){return Math.round(v).toLocaleString('ru');};
  var maxT=Math.max.apply(null,yearsArr.map(function(y){return y.total;}))||1;
  var CATS=[
    {key:'fuel',      name:'Топливо',   color:'#FF9500'},
    {key:'service',   name:'Сервис',    color:'#007AFF'},
    {key:'insurance', name:'Страховка', color:'#34C759'},
    {key:'tuning',    name:'Тюнинг',    color:'#5856D6'},
    {key:'taxes',     name:'Налоги',    color:'#30B0C7'},
    {key:'penalties', name:'Штрафы',    color:'#FF3B30'},
    {key:'other',     name:'Прочее',    color:'#8E8E93'},
  ];
  return yearsArr.slice().reverse().map(function(y,i,arr){
    var prev=arr[i+1];
    var trend='';
    if(prev&&prev.total>0){
      var p=Math.round(((y.total-prev.total)/prev.total)*100);
      trend='<span class="'+(p>0?'trend-up':'trend-down')+'" style="font-size:12px;margin-left:4px">'+(p>0?'↑':'↓')+Math.abs(p)+'%</span>';
    }
    // Прогресс главного бара
    var bw=Math.round((y.total/maxT)*100);
    // Строки по статьям
    var catRows=CATS.filter(function(c){return (y[c.key]||0)>0.5;}).map(function(c){
      var v=y[c.key]||0;
      var cp=y.total>0?Math.round(v/y.total*100):0;
      var bwc=cp;
      return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0">'+
        '<div style="width:3px;height:12px;border-radius:2px;background:'+c.color+';flex-shrink:0"></div>'+
        '<span style="font-size:12px;color:var(--text2);min-width:68px">'+c.name+'</span>'+
        '<div style="flex:1;height:4px;background:var(--bg2);border-radius:2px;overflow:hidden">'+
          '<div style="height:100%;width:'+bwc+'%;background:'+c.color+';border-radius:2px"></div>'+
        '</div>'+
        '<span style="font-size:12px;color:var(--text);font-weight:500;min-width:72px;text-align:right">'+fmt(v)+' '+ccy+'</span>'+
        '<span style="font-size:11px;color:var(--text2);min-width:30px;text-align:right">'+cp+'%</span>'+
      '</div>';
    }).join('');
    return '<div style="padding:12px 16px;border-bottom:0.5px solid var(--sep)">'+
      // Заголовок года
      '<div style="display:flex;align-items:center;margin-bottom:8px">'+
        '<div style="font-size:16px;font-weight:700;color:var(--text)">'+y.year+trend+'</div>'+
        '<div style="flex:1;margin:0 12px;height:5px;background:var(--bg2);border-radius:3px;overflow:hidden">'+
          '<div style="height:100%;width:'+bw+'%;background:var(--indigo);border-radius:3px"></div>'+
        '</div>'+
        '<div style="font-size:16px;font-weight:700;color:var(--text)">'+fmt(y.total)+' '+ccy+'</div>'+
      '</div>'+
      // Строки статей
      catRows+
    '</div>';
  }).join('');
}

// График по месяцам
function _buildTcoMonthlyChart(data, yearSel, ccy) {
  var monthly=data.monthlyByYear||{};
  var keys=[];
  if(yearSel==='all'){
    keys=Object.keys(monthly).sort().slice(-12);
  } else {
    keys=Object.keys(monthly).filter(function(k){return k.startsWith(yearSel+'-');}).sort();
  }
  if(!keys.length) return '<div class="empty-state" style="padding:20px 0;text-align:center;color:var(--text2);font-size:14px">Нет данных за период</div>';

  var vals=keys.map(function(k){return monthly[k]||0;});
  var labels=keys.map(function(k){
    var p=k.split('-');
    return new Date(parseInt(p[0]),parseInt(p[1])-1,1).toLocaleDateString('ru-RU',{month:'short'}).replace('.','');
  });
  var maxVal=Math.max.apply(null,vals)||1;
  var n=keys.length;
  var curYear=new Date().getFullYear(),curMonth=new Date().getMonth()+1;
  var BAR_W=Math.max(20,Math.min(40,Math.floor(300/n)-4));
  var GAP=Math.max(4,Math.floor(BAR_W*0.25));
  var CHART_H=100;
  var html='';
  keys.forEach(function(k,i){
    var v=monthly[k]||0;
    var bh=Math.max(4,Math.round((v/maxVal)*CHART_H));
    var parts=k.split('-');
    var isKy=parseInt(parts[0]),isKm=parseInt(parts[1]);
    var isCur=(isKy===curYear&&isKm===curMonth),isMax=(v===maxVal);
    var bg=isCur?'var(--green)':isMax?'var(--accent)':'var(--accent-bg)';
    var hover=isCur?'#25a244':isMax?'#0060d0':'var(--indigo)';
    var lc=isCur?'var(--green)':isMax?'var(--accent)':'var(--text2)';
    var showLbl=(n<=12)||(i%2===0);
    html+='<div class="tco-mon-col"'+
      ' data-month="'+labels[i]+' '+parts[0]+'" data-total="'+Math.round(v).toLocaleString('ru')+'" data-ccy="'+ccy+'"'+
      ' style="position:relative;display:inline-flex;flex-direction:column;align-items:center;width:'+BAR_W+'px;margin:0 '+(GAP/2)+'px;height:'+(CHART_H+28)+'px;vertical-align:bottom;cursor:pointer">'+
      '<div style="position:absolute;bottom:'+(bh+18)+'px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;font-weight:600;color:'+lc+'">'+Math.round(v).toLocaleString('ru')+'</div>'+
      '<div class="tco-mon-inner" data-bg="'+bg+'" data-hover="'+hover+'"'+
        ' style="position:absolute;bottom:18px;width:100%;height:'+bh+'px;background:'+bg+';border-radius:4px 4px 2px 2px;transition:background 0.15s"></div>'+
      (showLbl?'<div style="position:absolute;bottom:2px;font-size:9px;color:var(--text2)">'+labels[i]+'</div>':'')+
    '</div>';
  });
  return '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">'+
    '<div id="tcoMonWrap" style="display:flex;align-items:flex-end;padding:8px 4px 0;min-width:'+((BAR_W+GAP)*n+GAP)+'px">'+html+'</div>'+
    '<div id="tcoMonTip" style="display:none;position:fixed;background:var(--grouped);border:0.5px solid var(--sep);border-radius:10px;padding:9px 13px;font-size:13px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:500;min-width:130px;"></div>'+
    '</div>';
}


// SVG иконка копирования (переиспользуется)
function _copyIcon() {
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
}

function saveMileage() {
  var v = parseInt(document.getElementById('currentMileage').value);
  if (isNaN(v)||v<0) return alert('Введите корректный пробег');
  localStorage.setItem('currentMileage', v);
  var btn = event.target;
  btn.textContent = '✓ Сохранено';
  setTimeout(function(){btn.textContent='Обновить пробег';},1500);
}

function saveIntervals() {
  var btn = event.target;
  btn.textContent = '✓ Сохранено';
  setTimeout(function(){btn.textContent='Сохранить интервалы';},1500);
}

// ── Accordion toggle ────────────────────────────────────
function _accToggle(id) {
  var body = document.getElementById('acc-body-' + id);
  var chv  = document.getElementById('acc-chv-'  + id);
  var sec  = document.getElementById('acc-'      + id);
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chv) chv.style.transform = open ? '' : 'rotate(180deg)';
  if (sec) sec.classList.toggle('acc-open', !open);
}

// ── Load settings from Sheet ────────────────────────────
async function _loadCarSettingsFromSheet() {
  try {
    var res = await fetch(GAS_BASE_URL + '?page=settings');
    if (!res.ok) return;
    var d = await res.json();
    if (d.error) return;
    localStorage.setItem('car_settings', JSON.stringify(d));
    var map = {
      cs_carName:d.carName, cs_purchaseDate:d.purchaseDate, cs_startMileage:d.startMileage,
      cs_vin:d.vin, cs_regNum:d.regNum, cs_insuranceNum:d.insuranceNum, cs_insuranceEnd:d.insuranceEnd,
      cs_oilLast:d.oilLast, cs_oilInterval:d.oilInterval, cs_kppLast:d.kppLast, cs_kppInterval:d.kppInterval,
      cs_diagLast:d.diagLast, cs_diagInterval:d.diagInterval,
      cs_gboDate:d.gboDate, cs_gboLast:d.gboLast, cs_gboInterval:d.gboInterval,
      cs_currency:d.currency, cs_currency2:d.currency2,
    };
    Object.keys(map).forEach(function(id) {
      var el = document.getElementById(id);
      if (el && map[id] !== undefined && String(map[id]) !== '') el.value = map[id];
    });
    // Обновляем подзаголовки через единую функцию (с данными из home-кэша)
    _updateAccSubs();
  } catch(e) {}
}

// ── Save car settings → Google Sheets ──────────────────
async function saveCarSettings() {
  var btn = document.getElementById('csSaveBtn');
  var msg = document.getElementById('csMsg');
  btn.disabled = true; btn.textContent = 'Сохранение…'; msg.style.display = 'none';
  var fields = {
    action:'updateCarSettings',
    carName:      document.getElementById('cs_carName').value.trim(),
    purchaseDate: document.getElementById('cs_purchaseDate').value.trim(),
    startMileage: document.getElementById('cs_startMileage').value.trim(),
    vin:          document.getElementById('cs_vin').value.trim(),
    regNum:       document.getElementById('cs_regNum').value.trim(),
    insuranceNum: document.getElementById('cs_insuranceNum').value.trim(),
    insuranceEnd: document.getElementById('cs_insuranceEnd').value.trim(),
    oilLast:      document.getElementById('cs_oilLast').value.trim(),
    oilInterval:  document.getElementById('cs_oilInterval').value.trim(),
    kppLast:      document.getElementById('cs_kppLast').value.trim(),
    kppInterval:  document.getElementById('cs_kppInterval').value.trim(),
    diagLast:     document.getElementById('cs_diagLast').value.trim(),
    diagInterval: document.getElementById('cs_diagInterval').value.trim(),
    gboDate:      document.getElementById('cs_gboDate').value.trim(),
    gboLast:      document.getElementById('cs_gboLast').value.trim(),
    gboInterval:  document.getElementById('cs_gboInterval').value.trim(),
    currency:     document.getElementById('cs_currency').value,
    currency2:    document.getElementById('cs_currency2').value,
  };
  var local = Object.assign({}, fields); delete local.action;
  localStorage.setItem('car_settings', JSON.stringify(local));
  try {
    var res = await fetch(GAS_POST_URL, {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
      body: new URLSearchParams(fields).toString()
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var result = await res.json();
    var ok = result.success;
    var el = document.getElementById('csMsg');
    if (el) {
      el.style.display = 'block';
      el.style.background = ok ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.12)';
      el.style.color      = ok ? 'var(--green)' : 'var(--red)';
      el.textContent      = ok ? '✓ Данные сохранены в таблицу' : '✕ ' + (result.message||'Ошибка');
    }
    if (ok) { localStorage.removeItem('cache_v2_home'); _updateAccSubs(); }
  } catch(err) {
    var el = document.getElementById('csMsg');
    if (el) { el.style.display='block'; el.style.background='rgba(255,59,48,0.12)'; el.style.color='var(--red)'; el.textContent='✕ '+err.message; }
  }
  btn.disabled = false; btn.textContent = '💾 Сохранить в таблицу';
}

// ── Обновляет подзаголовки аккордеонов ─────────────────
function _updateAccSubs() {
  var c = {}, h = {};
  try { c = JSON.parse(localStorage.getItem('car_settings') || '{}'); } catch(e){}
  try { const _hc2 = readCache('home'); h = (_hc2 && _hc2.data) ? _hc2.data : {}; } catch(e){}
  function km(v) { return v ? Number(v).toLocaleString('ru') + ' км' : ''; }
  function sub(parts) { return parts.filter(Boolean).join(' · '); }
  var subs = {
    'acc-sub-car':  c.carName || '',
    'acc-sub-docs': sub([c.insuranceEnd?'страховка до '+c.insuranceEnd:'', h.insuranceEnds?'осталось '+h.insuranceEnds+' дн.':'']),
    'acc-sub-oil':  sub([c.oilLast?'замена '+km(c.oilLast):'', h.nextOilChange?'осталось '+km(h.nextOilChange)+'':'']),
    'acc-sub-kpp':  sub([c.kppLast?'замена '+km(c.kppLast):'', h.nextGearboxOilChange?'осталось '+km(h.nextGearboxOilChange)+'':'']),
    'acc-sub-diag': sub([c.diagLast?'диагн. '+km(c.diagLast):'', h.nextDiagnostic?'осталось '+km(h.nextDiagnostic)+'':'']),
    'acc-sub-gbo':  sub([c.gboDate?'установлена '+c.gboDate:'', h.gasServiceDue?'до обсл. '+km(h.gasServiceDue)+'':'']),
    'acc-sub-cur':  (c.currency||'PLN')+' → '+(c.currency2||'UAH'),
  };
  Object.keys(subs).forEach(function(id){
    var el=document.getElementById(id); if(el) el.innerHTML=subs[id];
  });
}


function _clearCacheConfirm(e) {
  var t = e.currentTarget.querySelector('.row-title');
  if (t && t.textContent === 'Уверены? Нажмите ещё раз') {
    _clearCache(e);
    return;
  }
  if (t) {
    t.style.color = 'var(--red)';
    t.textContent = 'Уверены? Нажмите ещё раз';
    setTimeout(function() {
      if (t) t.textContent = 'Очистить кэш';
    }, 3000);
  }
}

function _clearCache(e) {
  ['cache_v2_home','cache_v2_fuel','cache_v2_service','cache_v2_settings','cache_v2_tco','cache_v2_addfuel'].forEach(function(k){localStorage.removeItem(k);});
  var t = e.currentTarget.querySelector('.row-title');
  if (t){t.textContent='✓ Кэш очищен';setTimeout(function(){t.textContent='Очистить кэш';},1500);}
}

function _layoutReset() {
  saveHomeLayout(JSON.parse(JSON.stringify(HOME_LAYOUT_DEFAULTS)));
  loadData();
}

function _tcoLayoutReset() {
  saveTcoLayout(JSON.parse(JSON.stringify(TCO_LAYOUT_DEFAULTS)));
  localStorage.removeItem('cache_v2_tco');
  loadData();
}

// ── DRAG AND DROP — mouse + touch ──────────────────────
function _initDragGroup(container) {
  if (!container) return;
  var gid  = container.id;
  var gKey = gid==='lg-reminders'?'reminders':gid==='lg-minicards'?'minicards':'sections';
  var dragEl=null, ph=null, startCY=0, startScrollY=0, origRect=null;

  function cy(e){return e.touches?e.touches[0].clientY:e.clientY;}
  function allItems(){return Array.from(container.querySelectorAll('.layout-item'));}

  function onStart(e) {
    if (!e.target.closest('.layout-drag-handle')) return;
    dragEl = e.target.closest('.layout-item');
    if (!dragEl) return;
    origRect   = dragEl.getBoundingClientRect();
    startCY    = cy(e);
    startScrollY = window.scrollY;

    // Dashed placeholder
    ph = document.createElement('div');
    ph.style.cssText = 'height:'+dragEl.offsetHeight+'px;margin-bottom:6px;border-radius:12px;'+
      'border:2px dashed var(--accent);opacity:0.4;box-sizing:border-box';
    dragEl.after(ph);

    // Float element
    dragEl.style.cssText =
      'position:fixed;left:'+origRect.left+'px;top:'+origRect.top+'px;'+
      'width:'+origRect.width+'px;z-index:9999;margin:0;'+
      'box-shadow:0 10px 30px rgba(0,0,0,0.22);border-radius:12px;'+
      'background:var(--grouped);pointer-events:none;transition:none;opacity:0.97';

    document.body.style.userSelect='none';
    document.body.style.webkitUserSelect='none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onEnd);
    document.addEventListener('touchmove', onMove, {passive:false});
    document.addEventListener('touchend',  onEnd);
    if (e.cancelable) e.preventDefault();
  }

  function onMove(e) {
    if (!dragEl||!ph) return;
    if (e.cancelable) e.preventDefault();
    var scrollDelta = window.scrollY - startScrollY;
    var dy = cy(e) - startCY;
    dragEl.style.top = (origRect.top + dy - scrollDelta)+'px';

    // Reposition placeholder
    var curY  = cy(e);
    var sibs  = allItems().filter(function(el){return el!==dragEl;});
    var target = null;
    for (var i=0;i<sibs.length;i++){
      var r=sibs[i].getBoundingClientRect();
      if (curY < r.top+r.height/2){target=sibs[i];break;}
    }
    if (target) container.insertBefore(ph, target);
    else        container.appendChild(ph);
  }

  function onEnd() {
    if (!dragEl||!ph) return;
    dragEl.style.cssText = '';
    ph.replaceWith(dragEl);
    ph = null;

    // Persist new order
    var order = allItems().map(function(el){return el.dataset.id;});
    var lay   = getHomeLayout();
    lay[gKey].sort(function(a,b){return order.indexOf(a.id)-order.indexOf(b.id);});
    saveHomeLayout(lay);

    dragEl = null;
    document.body.style.userSelect='';
    document.body.style.webkitUserSelect='';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onEnd);
  }

  container.addEventListener('mousedown',  onStart);
  container.addEventListener('touchstart', onStart, {passive:false});
}


// ── PLACEHOLDER ────────────────────────────────────────
function renderPlaceholder() {
  DOM.pageContent.innerHTML = `<div class="empty-state" style="padding:60px 20px">Раздел в разработке</div>`;
}

// ── INIT ───────────────────────────────────────────────
window.addEventListener('load', loadData);
window.addEventListener('popstate', loadData);
