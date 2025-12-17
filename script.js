// Получаем ссылки на DOM элементы один раз
const appContent = document.getElementById("appContent");
const spinnerOverlay = document.getElementById("spinnerOverlay"); // ⬅️ Ссылка на оверлей спиннера
const table = document.getElementById("dataTable");
const sectionTitle = document.getElementById("sectionTitle");
const cardElement = document.querySelector('.card');

// 🔥 НОВАЯ ФУНКЦИЯ для управления состоянием загрузки
function setLoadingState(isLoading) {
    if (isLoading) {
        appContent.style.display = 'none';    // Скрываем весь основной контент
        spinnerOverlay.style.display = 'flex'; // Показываем оверлей со спиннером
    } else {
        spinnerOverlay.style.display = 'none'; // Скрываем оверлей со спиннером
        appContent.style.display = 'block';    // Показываем весь основной контент
    }
}

// Функция для получения параметра из URL
/**
 * Получает параметр из адресной строки (URL).
 *
 * Эта функция смотрит на адрес страницы в браузере
 * (например, "мойсайт.ком/?страница=главная")
 * и позволяет "вытянуть" значение нужного вам параметра.
 *
 * @param {string} name - Имя параметра, значение которого нужно найти (например, "page" илиили "id").
 * @returns {string|null} - Значение параметра в виде текста, или null, если параметр не найден.
 */
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// Функция для установки активной вкладки и заголовка
function setActiveTab(page) {
  // Убираем класс 'active' со всех ссылок
  document.querySelectorAll("nav a").forEach(link => link.classList.remove("active"));

  const titleMap = {
    home: "Главная",
    fuel: "История заправок",
    service: "Обслуживание и ремонт",
	addfuel: "Добавить Запись",
    other: "Прочее",
    settings: "Настройки"
  };

  const tabClassMap = {
    home: ".home-tab",
    fuel: ".fuel-tab",
    service: ".service-tab",
	addfuel: ".add-tab",
    other: ".other-tab",
    settings: ".settings-tab"
  };

  const pageOrDefault = page || "home"; // Если page не задан, считаем что это 'home'
  const tabSelector = tabClassMap[pageOrDefault];
  const title = titleMap[pageOrDefault] || "Раздел"; // Заголовок по умолчанию

  // Устанавливаем заголовок секции
  sectionTitle.textContent = title;

  // Добавляем класс 'active' к нужной ссылке
  const activeTab = document.querySelector(tabSelector);
  if (activeTab) {
    activeTab.classList.add("active");
  }
}

// Функция для загрузки и отображения данных
/*функция загружает данные с Google Apps Script и отображает их на странице в зависимости от выбранной вкладки.*/
function loadData() {
  const page = getQueryParam("page") || "home"; // Вкладка по умолчанию 'home'
  setActiveTab(page);

  setLoadingState(true); // 🔥 ПОКАЗАТЬ СПИННЕР, СКРЫТЬ КОНТЕНТ
  table.style.display = "none";    // Скрыть таблицу по умолчанию
  // Очистить предыдущий динамический контент внутри .card (кроме h2 и spinner)
  const dynamicContent = cardElement.querySelectorAll(':scope > *:not(h2):not(.spinner):not(#dataTable)');
  dynamicContent.forEach(el => el.remove());
  
  // Уничтожить график, если он существует
if (typeof destroyFuelChart === 'function') {
    destroyFuelChart();
}
  
  // Очищаем таблицу на случай если она была видима
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  // 💡 Убедитесь, что URL вашего веб-приложения GAS верный
  const url = `https://script.google.com/macros/s/AKfycbxLYT5b2qCLXK8iLtSz-48kimWcjGYfI6r31s3sJMjPJljrVMuJqmuNIswJ7RnjiTmG/exec?page=${page}`;

  fetch(url)
    .then(res => {
      if (!res.ok) { // Проверка на ошибки HTTP (например, 404, 500)
        throw new Error(`Ошибка сети: ${res.status} ${res.statusText}`);
      }
      return res.json(); // Пытаемся распарсить JSON
    })
    .then(data => {
      setLoadingState(false); // 🔥 СКРЫТЬ СПИННЕР, ПОКАЗАТЬ КОНТЕНТ

      // Обработка данных в зависимости от страницы
      if (page === "service") {
        renderServiceData(data);
		
      } else if (page === "home") {
        renderHomeData(data);
		
      } else if (page === "fuel") {
        renderFuelData(data);
		
	} else if (page === "addfuel") {
         renderAddFuelData(data); // <-- Эту строку оставим без изменений, но убедимся, что функция renderAddFuelData теперь определена в addFuel.js
		
      } else {
        renderPlaceholder(page); // Для 'other', 'settings' и т.д.
      }
    })
    .catch(err => {
      setLoadingState(false); // 🔥 СКРЫТЬ СПИННЕР, ПОКАЗАТЬ КОНТЕНТ (с ошибкой)
      sectionTitle.textContent = "Ошибка загрузки"; // Установить заголовок ошибки
      // Показать сообщение об ошибке в карточке
      const errorDiv = document.createElement('div');
      errorDiv.style.color = 'red';
      errorDiv.style.marginTop = '20px';
      errorDiv.style.textAlign = 'center';
      errorDiv.innerHTML = `Не удалось загрузить данные 😢 <br><small>(${err.message})</small>`;
      // Удаляем старый контент перед добавлением ошибки
      const dynamicContent = cardElement.querySelectorAll(':scope > *:not(h2):not(.spinner):not(#dataTable)');
      dynamicContent.forEach(el => el.remove());
      cardElement.appendChild(errorDiv);
      console.error("Ошибка fetch:", err); // Вывести ошибку в консоль для отладки
    });
}




// --- Функции рендеринга страницы ---
/* Отображает данные об обслуживании и ремонте в виде таблицы*/
/* Позже нужно пофиксить баг двойной сортировки, на сайте работает как надо,но в коде две сортировки задействованные*/
function renderServiceData(data) {
  table.style.display = "none";
  
  const serviceContent = document.createElement('div');
  serviceContent.className = 'service-timeline';

  if (!Array.isArray(data)) {
      console.error("Данные для 'service' не являются массивом:", data);
      serviceContent.innerHTML = '<p style="color: red; text-align: center;">Ошибка формата данных.</p>';
      cardElement.appendChild(serviceContent);
      return;
  }

  if (data.length === 0) {
     serviceContent.innerHTML = '<p style="text-align: center; color: #666;">Нет данных об обслуживании</p>';
     cardElement.appendChild(serviceContent);
     return;
  }

  // 🔥 РАЗВЕРНИ ПОРЯДОК - от новых к старым
  const reversedData = [...data].reverse();
  const groupedByMonth = groupByMonth(reversedData);
  
  let timelineHTML = '';
  
  Object.keys(groupedByMonth).forEach(monthYear => {
    timelineHTML += `<h2 class="timeline-month">${monthYear}</h2>`;
    
    groupedByMonth[monthYear].forEach(service => {
      const icon = getServiceIcon(service.type);
      const typeClass = getServiceTypeClass(service.type);
      
timelineHTML += `
  <div class="timeline-entry ${typeClass}">
    <div class="entry-date-info">
      <span class="entry-date">${service.date || '—'}</span>
      <span class="entry-km">${service.mileage || '—'} км</span>
    </div>
    <div class="entry-content">
      <div class="entry-icon">${icon}</div>
      <div class="entry-text">
        <p class="entry-title">${service.type || 'ОБСЛУЖИВАНИЕ'}</p>
        <p class="entry-description">${service.description || '—'}</p>
      </div>
    </div>
  </div>
`;
    });
  });

  serviceContent.innerHTML = timelineHTML;
  cardElement.appendChild(serviceContent);
}

// Вспомогательные функции
function groupByMonth(data) {
  const groups = {};
  
  // Фильтруем только валидные даты и сортируем от новых к старым
  const validData = data.filter(item => {
    const date = parseCustomDate(item.date);
    return !isNaN(date); // Оставляем только валидные даты
  }).sort((a, b) => {
    const dateA = parseCustomDate(a.date);
    const dateB = parseCustomDate(b.date);
    return dateB - dateA; // От новых к старым
  });
  
  validData.forEach(item => {
    const date = parseCustomDate(item.date);
    const monthYear = date.toLocaleDateString('ru-RU', { 
      month: 'long', 
      year: 'numeric' 
    }).toUpperCase();
    
    if (!groups[monthYear]) groups[monthYear] = [];
    groups[monthYear].push(item);
  });

  return groups;
}

// 🔥 ДОБАВЬ ЭТУ ФУНКЦИЮ ДЛЯ ПРАВИЛЬНОГО ПАРСИНГА ДАТ
function parseCustomDate(dateString) {
  if (!dateString) return new Date(NaN);
  
  const parts = dateString.trim().split('.');
  if (parts.length !== 3) return new Date(NaN);
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Месяцы в JS: 0-11
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return new Date(NaN);
  }
  
  return new Date(year, month, day);
}

function getServiceIcon(type) {
  const icons = {
    'плановое то': '<img src="icons/tools.png" class="service-icon" alt="ТО">',
	'расходники': '<img src="icons/windshield.png" class="service-icon" alt="расходники">',
    'ремонт': '<img src="icons/damper.png" class="service-icon" alt="Ремонт">',
    'покупка запчатей': '<img src="icons/shop.png" class="service-icon" alt="ТО">',
    'переобувка': '<img src="icons/history_pereobuvka.png" class="service-icon" alt="колесо">'
	
  };
  
  const lowerType = type?.toLowerCase().trim() || '';
  
  // Прямое сравнение с основными типами
  if (icons[lowerType]) {
    return icons[lowerType];
  }
  
  // Резервный поиск по ключевым словам
  if (lowerType.includes('газ') || lowerType.includes('гбо')) return '⛽';
  if (lowerType.includes('шины') || lowerType.includes('резина') || lowerType.includes('переобувка')) return '🛞';
  if (lowerType.includes('масло') || lowerType.includes('фильтр')) return '🛢️';
  if (lowerType.includes('то') || lowerType.includes('обслуживание')) return '🔧';
  if (lowerType.includes('ремонт')) return '<img src="icons/free-icon-check-18307363.png" class="service-icon" alt="Ремонт">';
  
  return '<img src="icons/free-icon-eco-car-16775761.png" class="service-icon" alt="Дефолд">'; // иконка по умолчанию
}

function getServiceTypeClass(type) {
  const lowerType = type?.toLowerCase() || '';
  if (lowerType.includes('шины') || lowerType.includes('резина')) return 'entry--tyre';
  if (lowerType.includes('масло') || lowerType.includes('то')) return 'entry--maintenance';
  if (lowerType.includes('ремонт')) return 'entry--repair';
  if (lowerType.includes('газ')) return 'entry--gas';
  return 'entry--default';
}


function renderHomeData(data) {
  table.style.display = "none"; // Скрыть таблицу

  // Создаем контейнер для информации на главной
  const homeContent = document.createElement('div');
  homeContent.className = 'home-content-wrapper'; // Добавим класс для возможной стилизации

  // Проверяем, что data - это объект
  if (typeof data !== 'object' || data === null) {
      console.error("Данные для 'home' не являются объектом:", data);
      homeContent.innerHTML = '<p style="color: red; text-align: center;">Ошибка формата данных для главной страницы.</p>';
      cardElement.appendChild(homeContent);
      return;
  }


  // Генерируем HTML для главной страницы
  homeContent.innerHTML = `

    <div class="shapka-selenyj"><span class="shapka-selenyj"><h2>Текущий пробег</h2><h1>${data.endKm || '—'} км</h1></span></div>

  <div class="grid">
<div class="card2-test">
  <div class="card2-icon">
    <img src="icons/free-icon-tools-and-utensils-453591.png" alt="Мой пробег" style="width:42px; height:42px;">
  </div>
  <div class="card-title">МОЙ ПРОБЕГ</div>
  <div class="card-value">${data.distance || '—'} км</div>
</div>
	
    <div class="card2-test">
      <div class="card2-icon"><img src="icons/free-icon-calendar-7955483.png" alt="Календарь" style="width:42px; height:42px;"></div>
      <div class="card-title">ДО СЛЕДУЮЩЕГО ТО</div>
	  <div class="card-value">${data.nextDiagnostic || '—'} км</div>
    </div>
	
	
<div class="card2-test">
  <div class="card2-icon">
    <img src="icons/free-icon-fuel-4459018.png" alt="Топливо" style="width:42px; height:42px;">
  </div>
  <div class="card-title">ТОПЛИВО</div>
  <div class="card-value">${data.weeklyFuelCost ? data.weeklyFuelCost + ' zł' : '—'}</div>
  <div class="fuel-period">${data.weeklyFuelPeriod ? data.weeklyFuelPeriod : ''}</div>
</div>
	
	

	
    <div class="card2-test">
      <div class="card2-icon"><img src="icons/free-icon-wallet-passes-app-3845819.png" alt="Всегорасходов" style="width:42px; height:42px;"></div>
      <div class="card-title">ВСЕГО РАСХОДОВ</div>
	  <div class="card-value">${data.totalCost !== undefined ? data.totalCost : '—'}</div>
      <div class="fuel-period">тестовая заглушка</div>
    </div>
  </div>

<!-- Информационные карточки -->
  <div class="expenses-summary">
    <div><strong>АКТУАЛЬНЫЕ СРОКИ</strong></div>
    <div class="expenses-items">
	

	  
      <div class="expenses-item">
        <div class="icon-circle red"><img src="icons/free-icon-car-oil-938639.png" alt="Заменамасла" style="width:48px; height:48px;"></div>
		 <div><strong>${data.nextOilChange} км</strong></div>
		  <div class="infoniz"><span>МАСЛО</span></div>
       
      </div>
	  
      <div class="expenses-item">
        <div class="icon-circle yellow"><img src="icons/free-icon-gearshift-1399176.png" alt="Коробка передач масло" style="width:48px; height:48px;"></div>
		<div><strong>${data.nextGearboxOilChange || '—'} км</strong></div>
		      <div class="infoniz"><span>КПП</span></div>
        
      </div>
	  
      <div class="expenses-item">
        <div class="icon-circle orange"><img src="icons/free-icon-medical-insurance-835397.png" alt="Страховка" style="width:48px; height:48px;"></div>
		<div><strong>${data.insuranceEnds || '—'} дн.</strong></div>
         <div class="infoniz"><span>СТРАХОВКА</span></div>
		
      </div>
	  
	        <div class="expenses-item">
        <div class="icon-circle green"><img src="icons/free-icon-gas-3144737.png" alt="Обсл.газа" style="width:48px; height:48px;"></div>
		   <div><strong>${data.gasServiceDue || '—'} км</strong></div>
		  <div class="infoniz"><span>ГАЗ</span></div>
 
      </div>
	  
    </div>

<!--
<div class="info"><span>Начальный пробег:</span> <strong>${data.startKm || '—'} км</strong></div>
    <div class="info"><span>Текущий пробег:</span> <strong>${data.endKm || '—'} км</strong></div>
    <div class="info"><span>Пробег:</span> <strong>${data.distance || '—'} км</strong></div>
    <div class="info"><span>Срок владения:</span> <strong>${data.duration || '—'}</strong></div>
    <div class="info"><span>Без учёта топлива и штрафов:</span> <strong>${data.costWithoutFuel !== undefined ? data.costWithoutFuel + ' zł' : '—'}</strong></div>
    <div class="info"><span>Все расходы:</span> <strong>${data.totalCost !== undefined ? data.totalCost + ' zł' : '—'}</strong></div>
    <div class="info">
      <span>До замены масла:</span>
      ${data.nextOilChange ? `<span class="progress-label">${data.nextOilChange} км</span>` : '<strong>—</strong>'}
    </div>
    <div class="info"><span>До замены в КПП:</span> <strong>${data.nextGearboxOilChange || '—'} км</strong></div>
    <div class="info"><span>До диагностики:</span> <strong>${data.nextDiagnostic || '—'} км</strong></div>
    <div class="info"><span>До окончания страховки:</span> <strong>${data.insuranceEnds || '—'} дн.</strong></div>
    <div class="info"><span>До обслуживания газа:</span> <strong>${data.gasServiceDue || '—'} км</strong></div>

    <div style="text-align: center;">
      <a href="?page=fuel" class="home-fuel-link">⛽ Отчёт по заправкам</a>
    </div>
-->
	
  `;
  cardElement.appendChild(homeContent); // Добавляем созданный контент в .card
}

/*
 * Динамически рендерит (отображает) таблицу с историей заправок на веб-странице.
 */
function renderFuelData(data) {
  table.style.display = "none";
  
  const fuelContent = document.createElement('div');
  fuelContent.className = 'fuel-dashboard';

  if (!Array.isArray(data)) {
      console.error("Данные для 'fuel' не являются массивом:", data);
      fuelContent.innerHTML = '<p style="color: red; text-align: center;">Ошибка формата данных.</p>';
      cardElement.appendChild(fuelContent);
      return;
  }

  if (data.length === 0) {
     fuelContent.innerHTML = '<p style="text-align: center; color: #666;">Нет данных о заправках</p>';
     cardElement.appendChild(fuelContent);
     return;
  }

  // Сортируем от новых к старым
  const sortedData = [...data].reverse();
  const latestRefuel = sortedData[0];
  const avgConsumption = calculateAverageConsumption(sortedData);

fuelContent.innerHTML = `
  <div class="fuel-stats">
    <div class="stat-card stat-card--average">
      <div class="stat-card-icon">
        <img src="icons/free-icon-eco-car-16775761.png" alt="Средний расход" style="width:42px; height:42px;" class="stat-icon">
		  
      </div>
      <div class="stat-card-content">
  <div class="stat-label">СРЕДНИЙ РАСХОД</div>
  <div class="stat-value">
    <span class="consumption-number">${avgConsumption.split(' ')[0] || avgConsumption}</span>
    <span class="consumption-l100"> л/100</span>
    <span class="consumption-km"> км</span>
  </div>
</div>
    </div>
      
<div class="stat-card stat-card--last">
      <div class="stat-card-icon">
        <img src="icons/free-icon-gas-station-1000437.png" alt="Последняя заправка" style="width:42px; height:42px;" class="stat-icon">
      </div>
      <div class="stat-card-content">
  <div class="stat-label">ПОСЛЕДНЯЯ ЗАПРАВКА</div>
  <div class="stat-value">
    <span class="fuel-amount">${latestRefuel.fuelAmount || '—'} л</span>
    <span class="separator">+</span>
    <span class="fuel-cost">${latestRefuel.totalCost || '—'} zł</span>
  </div>
</div>
    </div>
  </div>

<div class="fuel-trend">
  <div class="section-title">ТРЕНД РАСХОДА ГАЗА (6 МЕСЯЦЕВ)</div>
  <div class="trend-chart-container">
    <canvas id="fuelTrendCanvas" style="display: none;"></canvas>
    <div id="noDataMessage" style="display: none; text-align: center; padding: 40px 0; color: #666;">
      Недостаточно данных о расходе газа за последние 6 месяцев
    </div>
    <div class="trend-placeholder" id="trendPlaceholder">
      <p style="color: #666; text-align: center; padding: 40px 0;">
        Загрузка графика...
      </p>
    </div>
  </div>
</div>

    <div class="add-fuel-btn-container">
      <a href="?page=addfuel" class="add-fuel-btn">
        ДОБАВИТЬ ЗАПРАВКУ
      </a>
    </div>

    <div class="fuel-history">
      <div class="history-header">
        <div class="section-title">ИСТОРИЯ ЗАПРАВОК</div>
        <div class="history-filters" id="historyFilters">
<button class="filter-btn active" data-filter="week">Неделя</button>
<button class="filter-btn" data-filter="month">Месяц</button>
<button class="filter-btn" data-filter="year">Год</button>
<button class="filter-btn" data-filter="all">Вся история</button>



  </div>
      </div>
      <div class="history-list" id="historyList">
        ${generateHistoryList(filterDataByPeriod(sortedData, 'week'), 'week')}
      </div>
    </div>
  `;

  cardElement.appendChild(fuelContent);
  
  // Добавляем обработчики для фильтров
  setupFilterHandlers(sortedData);
// Отрисовываем график тренда расхода
if (typeof renderFuelChart === 'function') {
    // Скрываем плейсхолдер и рисуем график
    setTimeout(() => {
        const placeholder = document.getElementById('trendPlaceholder');
        if (placeholder) placeholder.style.display = 'none';
        renderFuelChart(data); // data - это все данные о заправках
    }, 100);
} else {
    console.warn('Функция renderFuelChart не найдена');
}


}

// Функция для настройки обработчиков фильтров
function setupFilterHandlers(data) {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const historyList = document.getElementById('historyList');
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      // Убираем активный класс у всех кнопок
      filterButtons.forEach(b => b.classList.remove('active'));
      // Добавляем активный класс текущей кнопке
      this.classList.add('active');
      
      const filter = this.getAttribute('data-filter');
      const filteredData = filterDataByPeriod(data, filter);
      
      historyList.innerHTML = generateHistoryList(filteredData, filter);
    });
  });
}

// Функция для фильтрации данных по периоду
// Функция для фильтрации данных по периоду (ВОССТАНАВЛИВАЕМ РАБОЧУЮ ВЕРСИЮ)
// Функция для фильтрации данных по периоду (ИСПРАВЛЕННАЯ ВЕРСИЯ)
function filterDataByPeriod(data, period) {
  const now = new Date(); // ← Выносим now в начало функции
  
  switch (period) {
    case 'week':
      // Текущая неделя (с понедельника по воскресенье)
      const weekStart = getWeekStart(now);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return data.filter(entry => isDateInRange(entry.date, weekStart, weekEnd));
      
    case 'month':
      // Текущий месяц (с 1 по последнее число)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      return data.filter(entry => isDateInRange(entry.date, monthStart, monthEnd));
      
    case 'year':
      // Текущий год (с 1 января по 31 декабря)
      const currentYear = now.getFullYear(); // ← ДИНАМИЧЕСКИЙ ГОД!
      const yearStart = new Date(currentYear, 0, 1); // 1 января текущего года
      const yearEnd = new Date(currentYear, 11, 31); // 31 декабря текущего года
      yearEnd.setHours(23, 59, 59, 999);
      
      console.log('Год фильтр:', currentYear, 
                  yearStart.toLocaleDateString(), '-', 
                  yearEnd.toLocaleDateString());
      
      return data.filter(entry => isDateInRange(entry.date, yearStart, yearEnd));
      
    case 'all':
    default:
      return data;
  }
}

// Функция для получения самого нового года из данных
function getLatestYearFromData(data) {
  let latestYear = new Date().getFullYear(); // По умолчанию текущий год
  
  data.forEach(entry => {
    if (entry.date && typeof entry.date === 'string') {
      try {
        const [day, month, year] = entry.date.split('.');
        const entryYear = parseInt(year);
        if (entryYear > latestYear) {
          latestYear = entryYear;
        }
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
  });
  
  return latestYear;
}

// Вспомогательная функция для парсинга дат
function parseDateFromString(dateString) {
  if (!dateString) return new Date(0);
  
  try {
    const [day, month, year] = dateString.split('.');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } catch (e) {
    return new Date(0);
  }
}

// Функция для получения начала недели (понедельник)
function getWeekStart(date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Понедельник как начало недели
  const weekStart = new Date(date);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Функция для проверки, находится ли дата в диапазоне
// Функция для проверки, находится ли дата в диапазоне (УЛУЧШЕННАЯ)
// Функция для проверки, находится ли дата в диапазоне (ИСПРАВЛЕННАЯ)
function isDateInRange(dateString, startDate, endDate) {
  if (!dateString) return false;
  
  let entryDate;
  if (typeof dateString === 'string') {
    try {
      const [day, month, year] = dateString.split('.');
      entryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      // Устанавливаем время на конец дня для правильного сравнения
      entryDate.setHours(23, 59, 59, 999);
    } catch (e) {
      console.error('Ошибка парсинга даты:', dateString, e);
      return false;
    }
  } else if (dateString instanceof Date) {
    entryDate = dateString;
  } else {
    return false;
  }
  
  return entryDate >= startDate && entryDate <= endDate;
}

// Обновленная функция генерации списка истории
// Обновленная функция генерации списка истории (БЕЗ ОГРАНИЧЕНИЙ ДЛЯ "ВСЯ ИСТОРИЯ")
function generateHistoryList(data, filter) {
  if (data.length === 0) {
    return `
      <div class="history-empty">
        Нет заправок за выбранный период
      </div>
    `;
  }
  
  // Убираем ограничение для "вся история", для других фильтров можно оставить ограничение
   //  const displayData = filter === 'all' ? data : data.slice(0, 50);
const displayData = data; // Убираем ограничение для всех фильтров
  
  return displayData.map(entry => `
    <div class="history-item">
      <div class="history-date">
        ${formatFuelDate(entry.date)} (${entry.mileage || '—'} км)
      </div>
      <div class="history-details">
        <span class="fuel-type">${entry.fuelType || 'Топливо'}</span>
        <span class="fuel-amount">${entry.fuelAmount || '—'} л</span>
        <span class="fuel-cost">${entry.totalCost || '—'} zł</span>
        ${entry.pricePerLiter ? `<span class="fuel-price">(${entry.pricePerLiter} zł/л)</span>` : ''}
      </div>
      ${entry.comment ? `<div class="history-comment">${entry.comment}</div>` : ''}
    </div>
  `).join('');
}

// Функция для форматирования даты (улучшенная версия)
function formatFuelDate(dateString) {
  if (!dateString) return '—';
  
  const months = {
    '01': 'ЯНВ.', '02': 'ФЕВ.', '03': 'МАР.', '04': 'АПР.',
    '05': 'МАЯ', '06': 'ИЮН.', '07': 'ИЮЛ.', '08': 'АВГ.',
    '09': 'СЕН.', '10': 'ОКТ.', '11': 'НОЯ.', '12': 'ДЕК.'
  };
  
  try {
    const [day, month, year] = dateString.split('.');
    return `${day} ${months[month] || month} ${year}`;
  } catch (e) {
    return dateString;
  }
}

// ЗАМЕНИТЕ существующую функцию на эту:

function calculateAverageConsumption(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return '—';
  
  // 1. Фильтруем только ГАЗ
  const gasData = data.filter(entry => {
    const fuelType = entry.fuelType ? entry.fuelType.toString().toLowerCase() : '';
    return fuelType.includes('газ');
  });
  
  if (gasData.length === 0) return '—';
  
  // 2. Сортируем от новых к старым
  const sortedData = [...gasData].sort((a, b) => {
    const dateA = parseCustomDate(a.date);
    const dateB = parseCustomDate(b.date);
    return dateB - dateA; // новые первые
  });
  
  // 3. Ищем неделю с данными (текущая → прошлая → позапрошлая)
  let weekData = [];
  
  // Проверяем недели назад
  for (let weeksBack = 0; weeksBack < 8; weeksBack++) { // проверяем до 8 недель
    const weekStart = getWeekStart(new Date(), weeksBack);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    weekData = sortedData.filter(entry => 
      isDateInRange(entry.date, weekStart, weekEnd)
    );
    
    if (weekData.length > 0) {
      console.log(`Найдены данные за неделю ${weeksBack===0?'текущую':weeksBack===1?'прошлую':weeksBack+' недели(ю) назад'}:`, 
                  weekData.length, 'заправок');
      break;
    }
  }
  
  // 4. Если вообще нет данных за 8 недель - берем последние 5 заправок газа
  if (weekData.length === 0) {
    console.log('Нет данных за 8 недель, берем последние 5 заправок газа');
    weekData = sortedData.slice(0, Math.min(5, sortedData.length));
  }
  
  // 5. Считаем средний расход
  let totalConsumption = 0;
  let validEntries = 0;
  
  weekData.forEach(entry => {
    if (entry.fuelConsumption && !isNaN(parseFloat(entry.fuelConsumption))) {
      totalConsumption += parseFloat(entry.fuelConsumption);
      validEntries++;
    }
  });
  
  return validEntries > 0 ? (totalConsumption / validEntries).toFixed(1) : '—';
}


/*
// 🔥 ДОБАВЬТЕ ЭТУ ФУНКЦИЮ В КОНЕЦ ФАЙЛА
function calculateAverageConsumption(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return '—';
  
  let totalConsumption = 0;
  let validEntries = 0;
  
  data.forEach(entry => {
    if (entry.fuelConsumption && !isNaN(parseFloat(entry.fuelConsumption))) {
      totalConsumption += parseFloat(entry.fuelConsumption);
      validEntries++;
    }
  });
  
  return validEntries > 0 ? (totalConsumption / validEntries).toFixed(1) : '—';
}
 */

/*
Показывает сообщение о том, что выбранный раздел находится в разработке, вместо того чтобы отображать таблицу с данными.
 */
function renderPlaceholder(page) {
  table.style.display = "none"; // Скрыть таблицу
  const placeholderDiv = document.createElement('div');
  placeholderDiv.style.textAlign = 'center';
  placeholderDiv.style.marginTop = '20px';
  placeholderDiv.style.color = '#666';

  const titleMap = {
     other: "Другое",
     settings: "Настройки",
	addfuel: "Добавить Запись" // Добавлено
   };
  placeholderDiv.textContent = `Раздел "${titleMap[page] || page}" находится в разработке.`;
  cardElement.appendChild(placeholderDiv);
}






// --- Инициализация ---
// Запускаем загрузку данных при загрузке страницы
window.addEventListener('load', loadData);

// Добавляем обработчик для навигации по истории браузера (кнопки назад/вперед)
window.addEventListener('popstate', loadData);