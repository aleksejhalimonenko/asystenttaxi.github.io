// ==========================================================================
// serviceStats.js - Аналитика и карточки для раздела "Обслуживание"
// ==========================================================================

/**
 * Рассчитывает финансовую статистику обслуживания
 * @param {Array} maintenanceData - Данные из doGetMaintenance()
 * @returns {Object} - Статистика
 */
function calculateServiceStats(maintenanceData) {
    if (!Array.isArray(maintenanceData) || maintenanceData.length === 0) {
        return {
            totalSpent: 0,
            avgCost: 0,
            mostCommon: '—',
            visitsCount: 0,
            isValid: false
        };
    }

    try {
        // 1. Общая сумма
        const total = maintenanceData.reduce((sum, item) => {
            const cost = parseFloat(item.total) || 0;
            return sum + cost;
        }, 0);

        // 2. Средний чек
        const avg = total / maintenanceData.length;

        // 3. Самый частый тип работ
        const typeCounts = {};
        maintenanceData.forEach(item => {
            const type = (item.type || 'другое').toLowerCase().trim();
            if (type) {
                typeCounts[type] = (typeCounts[type] || 0) + 1;
            }
        });

        let mostCommon = '—';
        let maxCount = 0;
        Object.entries(typeCounts).forEach(([type, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = type.toUpperCase();
            }
        });

        // 4. Последний визит
        let lastVisitDays = '—';
        if (maintenanceData.length > 0) {
            const lastDate = maintenanceData.reduce((latest, item) => {
                const itemDate = parseCustomDate(item.date);
                return itemDate > latest ? itemDate : latest;
            }, new Date(0));
            
            if (!isNaN(lastDate)) {
                const diffDays = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
                lastVisitDays = diffDays === 0 ? 'сегодня' : `${diffDays} дн. назад`;
            }
        }

        return {
            totalSpent: Math.round(total),
            avgCost: Math.round(avg),
            mostCommon,
            visitsCount: maintenanceData.length,
            lastVisitDays,
            isValid: true
        };

    } catch (error) {
        console.error('Ошибка расчета статистики:', error);
        return {
            totalSpent: 0,
            avgCost: 0,
            mostCommon: '—',
            visitsCount: 0,
            isValid: false
        };
    }
}

/**
 * Рассчитывает активность за текущий год
 * @param {Array} maintenanceData - Данные обслуживания
 * @returns {Object} - Статистика активности
 */
function calculateActivityStats(maintenanceData) {
    if (!Array.isArray(maintenanceData)) {
        return {
            visitsCount: 0,
            monthlyAvg: '0.0',
            totalThisYear: 0,
            trend: '—',
            isValid: false
        };
    }

    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1; // 1-12
        
        // Данные за текущий год
        const yearData = maintenanceData.filter(item => {
            try {
                const itemDate = parseCustomDate(item.date);
                return !isNaN(itemDate) && itemDate.getFullYear() === currentYear;
            } catch {
                return false;
            }
        });

        // Данные за прошлый год
        const lastYearData = maintenanceData.filter(item => {
            try {
                const itemDate = parseCustomDate(item.date);
                return !isNaN(itemDate) && itemDate.getFullYear() === currentYear - 1;
            } catch {
                return false;
            }
        });

        const visitsCount = yearData.length;
        
        // Среднее в месяц (с учетом текущего месяца)
        const monthlyAvg = visitsCount > 0 
            ? (visitsCount / currentMonth).toFixed(1)
            : '0.0';

        // Сумма за год
        const totalThisYear = yearData.reduce((sum, item) => {
            return sum + (parseFloat(item.total) || 0);
        }, 0);

        // Тренд по количеству визитов
        let trend = '—';
        if (lastYearData.length > 0 && visitsCount > 0) {
            const lastYearVisits = lastYearData.length;
            const changePercent = Math.round(
                ((visitsCount - lastYearVisits) / lastYearVisits) * 100
            );
            
            if (changePercent > 0) {
                trend = `↑${changePercent}%`;
            } else if (changePercent < 0) {
                trend = `↓${Math.abs(changePercent)}%`;
            } else {
                trend = '→0%';
            }
        }

        return {
            visitsCount,
            monthlyAvg,
            totalThisYear: Math.round(totalThisYear),
            trend,
            isValid: yearData.length > 0
        };

    } catch (error) {
        console.error('Ошибка расчета активности:', error);
        return {
            visitsCount: 0,
            monthlyAvg: '0.0',
            totalThisYear: 0,
            trend: '—',
            isValid: false
        };
    }
}

/**
 * Рассчитывает распределение расходов по типам работ
 * @param {Array} maintenanceData - Данные обслуживания
 * @returns {Object} - Процентное распределение
 */
function calculateCostDistribution(maintenanceData) {
    if (!Array.isArray(maintenanceData) || maintenanceData.length === 0) {
        return {
            maintenance: 0,
            repairs: 0,
            consumables: 0,
            tires: 0,
            other: 100,
            isValid: false
        };
    }

    try {
        const categories = {
            maintenance: 0,   // ТО, обслуживание
            repairs: 0,       // Ремонты
            consumables: 0,   // Расходники, фильтры
            tires: 0,         // Шины, переобувка
            other: 0          // Остальное
        };

        let totalCost = 0;

        maintenanceData.forEach(item => {
            const type = (item.type || '').toLowerCase();
            const cost = parseFloat(item.total) || 0;
            
            if (cost > 0) {
                totalCost += cost;
                
                if (type.includes('то') || type.includes('обслуживание')) {
                    categories.maintenance += cost;
                } else if (type.includes('ремонт')) {
                    categories.repairs += cost;
                } else if (type.includes('расходник') || type.includes('фильтр') || type.includes('масло')) {
                    categories.consumables += cost;
                } else if (type.includes('шин') || type.includes('резин') || type.includes('переобув')) {
                    categories.tires += cost;
                } else {
                    categories.other += cost;
                }
            }
        });

        // Преобразуем в проценты
        const result = {};
        Object.keys(categories).forEach(key => {
            result[key] = totalCost > 0 
                ? Math.round((categories[key] / totalCost) * 100)
                : 0;
        });

        result.isValid = totalCost > 0;
        return result;

    } catch (error) {
        console.error('Ошибка расчета распределения:', error);
        return {
            maintenance: 0,
            repairs: 0,
            consumables: 0,
            tires: 0,
            other: 100,
            isValid: false
        };
    }
}

/**
 * Создает HTML для карточек статистики
 * @param {Array} maintenanceData - Данные обслуживания
 * @returns {string} - HTML карточек
 */
function createServiceStatsCards(maintenanceData) {
    const financeStats = calculateServiceStats(maintenanceData);
    const activityStats = calculateActivityStats(maintenanceData);
    const distributionStats = calculateCostDistribution(maintenanceData);

    return `
        <div class="service-stats-grid">
            <!-- Карточка 1: Финансовая статистика -->
            <div class="service-stat-card service-stat-card--finance">
                <div class="service-stat-card-header">
                    <div class="service-stat-card-icon">
                        <img src="icons/free-icon-wallet-passes-app-3845819.png" alt="Финансы" style="width:32px; height:32px;">
                    </div>
                    <div class="service-stat-card-title">ФИНАНСОВАЯ СТАТИСТИКА</div>
                </div>
                <div class="service-stat-card-content">
                    <div class="service-stat-item">
                        <span class="service-stat-label">Всего потрачено:</span>
                        <span class="service-stat-value">${financeStats.totalSpent.toLocaleString()} zł</span>
                    </div>
                    <div class="service-stat-item">
                        <span class="service-stat-label">Средний чек:</span>
                        <span class="service-stat-value">${financeStats.avgCost.toLocaleString()} zł</span>
                    </div>
                    <div class="service-stat-item">
                        <span class="service-stat-label">Чаще всего:</span>
                        <span class="service-stat-value">${financeStats.mostCommon}</span>
                    </div>
                </div>
            </div>

            <!-- Карточка 2: Активность -->
            <div class="service-stat-card service-stat-card--activity">
                <div class="service-stat-card-header">
                    <div class="service-stat-card-icon">
                        <img src="icons/free-icon-calendar-7955483.png" alt="Активность" style="width:32px; height:32px;">
                    </div>
                    <div class="service-stat-card-title">АКТИВНОСТЬ ${new Date().getFullYear()}</div>
                </div>
                <div class="service-stat-card-content">
                    <div class="service-stat-item">
                        <span class="service-stat-label">Визитов:</span>
                        <span class="service-stat-value">${activityStats.visitsCount}</span>
                    </div>
                    <div class="service-stat-item">
                        <span class="service-stat-label">В среднем:</span>
                        <span class="service-stat-value">${activityStats.monthlyAvg}/мес</span>
                    </div>
                    <div class="service-stat-item">
                        <span class="service-stat-label">Сумма:</span>
                        <span class="service-stat-value">${activityStats.totalThisYear.toLocaleString()} zł</span>
                    </div>
                    <div class="service-stat-item">
                        <span class="service-stat-label">Тренд:</span>
                        <span class="service-stat-value ${activityStats.trend.includes('↑') ? 'trend-up' : activityStats.trend.includes('↓') ? 'trend-down' : ''}">
                            ${activityStats.trend}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Карточка 3: Распределение расходов -->
            <div class="service-stat-card service-stat-card--distribution">
                <div class="service-stat-card-header">
                    <div class="service-stat-card-icon">
                        <img src="icons/growth.png" alt="Распределение" style="width:32px; height:32px;">
                    </div>
                    <div class="service-stat-card-title">РАСПРЕДЕЛЕНИЕ РАСХОДОВ</div>
                </div>
                <div class="service-stat-card-content">
                    <div class="distribution-chart">
                        <div class="distribution-item">
                            <span class="distribution-label">ТО</span>
                            <div class="distribution-bar">
                                <div class="distribution-fill" style="width: ${distributionStats.maintenance}%"></div>
                            </div>
                            <span class="distribution-value">${distributionStats.maintenance}%</span>
                        </div>
                        <div class="distribution-item">
                            <span class="distribution-label">Ремонты</span>
                            <div class="distribution-bar">
                                <div class="distribution-fill" style="width: ${distributionStats.repairs}%"></div>
                            </div>
                            <span class="distribution-value">${distributionStats.repairs}%</span>
                        </div>
                        <div class="distribution-item">
                            <span class="distribution-label">Расходники</span>
                            <div class="distribution-bar">
                                <div class="distribution-fill" style="width: ${distributionStats.consumables}%"></div>
                            </div>
                            <span class="distribution-value">${distributionStats.consumables}%</span>
                        </div>
                        <div class="distribution-item">
                            <span class="distribution-label">Шины</span>
                            <div class="distribution-bar">
                                <div class="distribution-fill" style="width: ${distributionStats.tires}%"></div>
                            </div>
                            <span class="distribution-value">${distributionStats.tires}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Инициализация карточек статистики
 * @param {Array} maintenanceData - Данные обслуживания
 */
function initServiceStats(maintenanceData) {
    // Проверяем, что мы на странице обслуживания
    const page = new URLSearchParams(window.location.search).get('page');
    if (page !== 'service') return;

    // Создаем контейнер для карточек
    const cardElement = document.querySelector('.card');
    if (!cardElement) return;

    // Создаем карточки
    const statsHTML = createServiceStatsCards(maintenanceData);
    
    // Вставляем перед существующей timeline
    const timeline = cardElement.querySelector('.service-timeline');
    if (timeline) {
        const container = document.createElement('div');
        container.className = 'service-stats-container';
        container.innerHTML = statsHTML;
        cardElement.insertBefore(container, timeline);
    } else {
        // Если timeline еще нет, добавляем в начало
        const container = document.createElement('div');
        container.className = 'service-stats-container';
        container.innerHTML = statsHTML;
        cardElement.insertBefore(container, cardElement.firstChild);
    }

    console.log('Карточки статистики обслуживания инициализированы');
}

// Вспомогательная функция для парсинга даты (дублируем из script.js)
function parseCustomDate(dateString) {
    if (!dateString) return new Date(NaN);
    
    const parts = dateString.trim().split('.');
    if (parts.length !== 3) return new Date(NaN);
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    return new Date(year, month, day);
}

// Экспорт для использования в основном скрипте
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateServiceStats,
        calculateActivityStats,
        calculateCostDistribution,
        createServiceStatsCards,
        initServiceStats
    };
}