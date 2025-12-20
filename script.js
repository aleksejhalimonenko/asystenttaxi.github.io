// Оптимизированный основной файл скрипта (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// ==========================================================================
// 1. КОНСТАНТЫ И КЭШИРОВАНИЕ DOM
// ==========================================================================

// Кэшируем все DOM элементы
const DOM = {
    appContent: document.getElementById("appContent"),
    spinnerOverlay: document.getElementById("spinnerOverlay"),
    table: document.getElementById("dataTable"),
    sectionTitle: document.getElementById("sectionTitle"),
    cardElement: document.querySelector('.card'),
    tableHead: document.querySelector("#dataTable thead"),
    tableBody: document.querySelector("#dataTable tbody"),
    bottomNavLinks: document.querySelectorAll("nav a")
};

// Константы для навигации
const TITLE_MAP = {
    home: "Главная",
    fuel: "История заправок",
    service: "Обслуживание и ремонт",
    addfuel: "Добавить Запись",
    other: "Прочее",
    settings: "Настройки"
};

const TAB_SELECTOR_MAP = {
    home: ".home-tab",
    fuel: ".fuel-tab",
    service: ".service-tab",
    addfuel: ".add-tab",
    other: ".other-tab",
    settings: ".settings-tab"
};

// URL для Google Apps Script
const GAS_BASE_URL = "https://script.google.com/macros/s/AKfycbxLYT5b2qCLXK8iLtSz-48kimWcjGYfI6r31s3sJMjPJljrVMuJqmuNIswJ7RnjiTmG/exec";

// ==========================================================================
// 2. УТИЛИТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================================================

/**
 * Управление состоянием загрузки
 */
function setLoadingState(isLoading) {
    if (isLoading) {
        DOM.appContent.style.display = 'none';
        DOM.spinnerOverlay.style.display = 'flex';
    } else {
        DOM.spinnerOverlay.style.display = 'none';
        DOM.appContent.style.display = 'block';
    }
}

/**
 * Получение параметра из URL
 */
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

/**
 * Установка активной вкладки
 */
function setActiveTab(page) {
    const pageKey = page || "home";
    
    // Сбрасываем активные классы
    DOM.bottomNavLinks.forEach(link => link.classList.remove("active"));
    
    // Устанавливаем заголовок
    DOM.sectionTitle.textContent = TITLE_MAP[pageKey] || "Раздел";
    
    // Находим и активируем нужную вкладку
    const tabSelector = TAB_SELECTOR_MAP[pageKey];
    if (tabSelector) {
        const activeTab = document.querySelector(tabSelector);
        if (activeTab) {
            activeTab.classList.add("active");
        }
    }
}

/**
 * Парсинг кастомной даты
 */
function parseCustomDate(dateString) {
    if (!dateString) return new Date(NaN);
    
    const parts = dateString.trim().split('.');
    if (parts.length !== 3) return new Date(NaN);
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    return new Date(year, month, day);
}

/**
 * Получение иконки для типа обслуживания (ВОССТАНАВЛИВАЕМ ИСХОДНУЮ ФУНКЦИЮ)
 */
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
    
    return '<img src="icons/free-icon-eco-car-16775761.png" class="service-icon" alt="Дефолд">';
}

/**
 * Получение CSS класса для типа обслуживания
 */
function getServiceTypeClass(type) {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('шины') || lowerType.includes('резина')) return 'entry--tyre';
    if (lowerType.includes('масло') || lowerType.includes('то')) return 'entry--maintenance';
    if (lowerType.includes('ремонт')) return 'entry--repair';
    if (lowerType.includes('газ')) return 'entry--gas';
    return 'entry--default';
}

/**
 * Группировка данных по месяцам
 */
function groupByMonth(data) {
    const groups = {};
    
    // Фильтруем только валидные даты и сортируем от новых к старым
    const validData = data.filter(item => {
        const date = parseCustomDate(item.date);
        return !isNaN(date);
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

/**
 * Проверка даты в диапазоне
 */
function isDateInRange(dateString, startDate, endDate) {
    if (!dateString) return false;
    
    let entryDate;
    if (typeof dateString === 'string') {
        try {
            const [day, month, year] = dateString.split('.');
            entryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
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

/**
 * Получение начала недели
 */
function getWeekStart(date, weeksBack = 0) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1) - (weeksBack * 7);
    const weekStart = new Date(date);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
}

/**
 * Форматирование даты для истории заправок
 */
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

// ==========================================================================
// 3. ОСНОВНЫЕ ФУНКЦИИ РЕНДЕРИНГА
// ==========================================================================

/**
 * Основная функция загрузки данных
 */
async function loadData() {
    const page = getQueryParam("page") || "home";
    
    // Подготовка UI
    setActiveTab(page);
    setLoadingState(true);
    DOM.table.style.display = "none";
    
    // Очистка предыдущего контента
    clearDynamicContent();
    
    // Уничтожение графика при необходимости
    if (typeof destroyFuelChart === 'function') {
        destroyFuelChart();
    }
    
    try {
        // Загрузка данных
        const url = `${GAS_BASE_URL}?page=${page}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Ошибка сети: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setLoadingState(false);
        
        // Маршрутизация по страницам
        const renderMap = {
            service: renderServiceData,
            home: renderHomeData,
            fuel: renderFuelData,
            addfuel: renderAddFuelData,
			settings: renderSettingsPage,
            default: () => renderPlaceholder(page)
        };
        
        const renderFunction = renderMap[page] || renderMap.default;
        renderFunction(data);
        
    } catch (error) {
        setLoadingState(false);
        showErrorMessage(error);
    }
}

/**
 * Очистка динамического контента
 */
function clearDynamicContent() {
    const dynamicElements = DOM.cardElement.querySelectorAll(':scope > *:not(h2):not(.spinner):not(#dataTable)');
    dynamicElements.forEach(el => el.remove());
    
    DOM.tableHead.innerHTML = "";
    DOM.tableBody.innerHTML = "";
}

/**
 * Показ сообщения об ошибке
 */
function showErrorMessage(error) {
    DOM.sectionTitle.textContent = "Ошибка загрузки";
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        Не удалось загрузить данные 😢 
        <br><small>(${error.message})</small>
    `;
    
    DOM.cardElement.appendChild(errorDiv);
    console.error("Ошибка fetch:", error);
}

/**
 * Рендеринг страницы обслуживания
 */
function renderServiceData(data) {
    DOM.table.style.display = "none";
    
    const serviceContent = document.createElement('div');
    serviceContent.className = 'service-timeline';

    if (!Array.isArray(data)) {
        console.error("Данные для 'service' не являются массивом:", data);
        serviceContent.innerHTML = '<p style="color: red; text-align: center;">Ошибка формата данных.</p>';
        DOM.cardElement.appendChild(serviceContent);
        return;
    }

    if (data.length === 0) {
        serviceContent.innerHTML = '<p style="text-align: center; color: #666;">Нет данных об обслуживании</p>';
        DOM.cardElement.appendChild(serviceContent);
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
    DOM.cardElement.appendChild(serviceContent);
	
	
	 // ============ ДОБАВЛЯЕМ ИНИЦИАЛИЗАЦИЮ КАРТОЧЕК ============
    if (typeof initServiceStats === 'function') {
        initServiceStats(data);
    } else {
        console.warn('Функция initServiceStats не найдена. Подключите serviceStats.js');
    }
    // ============ КОНЕЦ ДОБАВЛЕНИЯ ============
	
}

/**
 * Рендеринг главной страницы (ВОССТАНАВЛИВАЕМ ИСХОДНУЮ ФУНКЦИЮ)
 */
function renderHomeData(data) {
    DOM.table.style.display = "none"; // Скрыть таблицу

    // Создаем контейнер для информации на главной
    const homeContent = document.createElement('div');
    homeContent.className = 'home-content-wrapper';

    // Проверяем, что data - это объект
    if (typeof data !== 'object' || data === null) {
        console.error("Данные для 'home' не являются объектом:", data);
        homeContent.innerHTML = '<p style="color: red; text-align: center;">Ошибка формата данных для главной страницы.</p>';
        DOM.cardElement.appendChild(homeContent);
        return;
    }

    // Генерируем HTML для главной страницы (ВОССТАНАВЛИВАЕМ ИСХОДНЫЙ HTML)
    homeContent.innerHTML = `
        <div class="shapka-selenyj">
            <h2>Текущий пробег</h2>
            <h1>${data.endKm || '—'} км</h1>
        </div>

        <div class="grid">
            <div class="card2-test">
                <div class="card2-icon">
                    <img src="icons/free-icon-tools-and-utensils-453591.png" alt="Мой пробег" style="width:42px; height:42px;">
                </div>
                <div class="card-title">МОЙ ПРОБЕГ</div>
                <div class="card-value">${data.distance || '—'} км</div>
            </div>
            
            <div class="card2-test">
                <div class="card2-icon">
                    <img src="icons/free-icon-calendar-7955483.png" alt="Календарь" style="width:42px; height:42px;">
                </div>
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
                <div class="card2-icon">
                    <img src="icons/free-icon-wallet-passes-app-3845819.png" alt="Всегорасходов" style="width:42px; height:42px;">
                </div>
                <div class="card-title">ВСЕГО РАСХОДОВ</div>
                <div class="card-value">${data.totalCost !== undefined ? data.totalCost : '—'}</div>
                <div class="fuel-period">тестовая заглушка</div>
            </div>
        </div>

        <div class="expenses-summary">
            <div><strong>АКТУАЛЬНЫЕ СРОКИ</strong></div>
            <div class="expenses-items">
                <div class="expenses-item">
                    <div class="icon-circle red">
                        <img src="icons/free-icon-car-oil-938639.png" alt="Заменамасла" style="width:48px; height:48px;">
                    </div>
                    <div><strong>${data.nextOilChange} км</strong></div>
                    <div class="infoniz"><span>МАСЛО</span></div>
                </div>
                
                <div class="expenses-item">
                    <div class="icon-circle yellow">
                        <img src="icons/free-icon-gearshift-1399176.png" alt="Коробка передач масло" style="width:48px; height:48px;">
                    </div>
                    <div><strong>${data.nextGearboxOilChange || '—'} км</strong></div>
                    <div class="infoniz"><span>КПП</span></div>
                </div>
                
                <div class="expenses-item">
                    <div class="icon-circle orange">
                        <img src="icons/free-icon-medical-insurance-835397.png" alt="Страховка" style="width:48px; height:48px;">
                    </div>
                    <div><strong>${data.insuranceEnds || '—'} дн.</strong></div>
                    <div class="infoniz"><span>СТРАХОВКА</span></div>
                </div>
                
                <div class="expenses-item">
                    <div class="icon-circle green">
                        <img src="icons/free-icon-gas-3144737.png" alt="Обсл.газа" style="width:48px; height:48px;">
                    </div>
                    <div><strong>${data.gasServiceDue || '—'} км</strong></div>
                    <div class="infoniz"><span>ГАЗ</span></div>
                </div>
            </div>
        </div>
    `;
    
    DOM.cardElement.appendChild(homeContent);
}

/**
 * Рендеринг страницы топлива (ВОССТАНАВЛИВАЕМ ИСХОДНУЮ ФУНКЦИЮ)
 */
function renderFuelData(data) {
    DOM.table.style.display = "none";
    
    const fuelContent = document.createElement('div');
    fuelContent.className = 'fuel-dashboard';

    if (!Array.isArray(data)) {
        console.error("Данные для 'fuel' не являются массивом:", data);
        fuelContent.innerHTML = '<p style="color: red; text-align: center;">Ошибка формата данных.</p>';
        DOM.cardElement.appendChild(fuelContent);
        return;
    }

    if (data.length === 0) {
        fuelContent.innerHTML = '<p style="text-align: center; color: #666;">Нет данных о заправках</p>';
        DOM.cardElement.appendChild(fuelContent);
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
                    <img src="icons/tank.png" alt="Последняя заправка" style="width:42px; height:42px;" class="stat-icon">
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
		
		  <!-- ==================== ДОБАВЛЯЕМ ЗДЕСЬ ==================== -->
  <div class="fuel-range-stats">
    <div class="stat-card stat-card--range">
      <div class="stat-card-icon">
        <img src="icons/car.png" alt="Запас хода" style="width:42px; height:42px;" class="stat-icon">
      </div>
      <div class="stat-card-content">
        <div class="stat-label">ЗАПАС ХОДА</div>
        <div class="stat-value">
          <span class="range-km" id="fuelRangeKm">—</span>
          <span class="range-unit">км</span>
        </div>
        <div class="stat-subvalue" id="fuelRangeDetails">при полном баке (34 л)</div>
      </div>
    </div>
  </div>
  <!-- ==================== КОНЕЦ ДОБАВЛЕНИЯ ==================== -->
		
		

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

    DOM.cardElement.appendChild(fuelContent);
    
    // Добавляем обработчики для фильтров
    setupFilterHandlers(sortedData);
    
    // Отрисовываем график тренда расхода
    if (typeof renderFuelChart === 'function') {
        setTimeout(() => {
            const placeholder = document.getElementById('trendPlaceholder');
            if (placeholder) placeholder.style.display = 'none';
            renderFuelChart(data);
        }, 100);
    } else {
        console.warn('Функция renderFuelChart не найдена');
    }
	 // ============ ДОБАВЬ ЭТО В КОНЕЦ ФУНКЦИИ ============
    // Обновляем карточку запаса хода
    if (typeof updateFuelRangeDisplay === 'function') {
        updateFuelRangeDisplay(sortedData);
    }
    // ============ КОНЕЦ ДОБАВЛЕНИЯ ============
	
}

/**
 * Расчет среднего расхода
 */
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
        return dateB - dateA;
    });
    
    // 3. Ищем неделю с данными (текущая → прошлая → позапрошлая)
    let weekData = [];
    
    for (let weeksBack = 0; weeksBack < 8; weeksBack++) {
        const weekStart = getWeekStart(new Date(), weeksBack);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        weekData = sortedData.filter(entry => 
            isDateInRange(entry.date, weekStart, weekEnd)
        );
        
        if (weekData.length > 0) break;
    }
    
    // 4. Если вообще нет данных за 8 недель - берем последние 5 заправок газа
    if (weekData.length === 0) {
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

/**
 * Фильтрация данных по периоду
 */
function filterDataByPeriod(data, period) {
    const now = new Date();
    
    switch (period) {
        case 'week':
            const weekStart = getWeekStart(now);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            return data.filter(entry => isDateInRange(entry.date, weekStart, weekEnd));
            
        case 'month':
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            monthEnd.setHours(23, 59, 59, 999);
            return data.filter(entry => isDateInRange(entry.date, monthStart, monthEnd));
            
        case 'year':
            const currentYear = now.getFullYear();
            const yearStart = new Date(currentYear, 0, 1);
            const yearEnd = new Date(currentYear, 11, 31);
            yearEnd.setHours(23, 59, 59, 999);
            return data.filter(entry => isDateInRange(entry.date, yearStart, yearEnd));
            
        case 'all':
        default:
            return data;
    }
}

/**
 * Настройка обработчиков фильтров
 */
function setupFilterHandlers(data) {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const historyList = document.getElementById('historyList');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.getAttribute('data-filter');
            const filteredData = filterDataByPeriod(data, filter);
            historyList.innerHTML = generateHistoryList(filteredData, filter);
        });
    });
}

/**
 * Генерация списка истории
 */
function generateHistoryList(data, filter) {
    if (data.length === 0) {
        return `
            <div class="history-empty">
                Нет заправок за выбранный период
            </div>
        `;
    }
    
    const displayData = data;
    
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

/**
 * Рендеринг заглушки для нереализованных страниц
 */
function renderPlaceholder(page) {
    DOM.table.style.display = "none";
    const placeholderDiv = document.createElement('div');
    placeholderDiv.style.textAlign = 'center';
    placeholderDiv.style.marginTop = '20px';
    placeholderDiv.style.color = '#666';

    const titleMap = {
        other: "Другое",
        settings: "Настройки",
        addfuel: "Добавить Запись"
    };
    
    placeholderDiv.textContent = `Раздел "${titleMap[page] || page}" находится в разработке.`;
    DOM.cardElement.appendChild(placeholderDiv);
}

// ==========================================================================
// 4. ИНИЦИАЛИЗАЦИЯ И СОБЫТИЯ
// ==========================================================================

// Загрузка данных при загрузке страницы
window.addEventListener('load', loadData);

// Обработчик для навигации по истории браузера
window.addEventListener('popstate', loadData);