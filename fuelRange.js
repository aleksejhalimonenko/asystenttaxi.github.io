// fuelRange.js - Расчёт запаса хода на полном баке

/**
 * Рассчитывает запас хода на полном баке
 * @param {Array} fuelData - Массив данных о заправках
 * @param {number} tankCapacity - Объём бака в литрах (по умолчанию 34)
 * @returns {Object} - Результаты расчёта
 */
function calculateFuelRange(fuelData, tankCapacity = 34) {
    if (!Array.isArray(fuelData) || fuelData.length === 0) {
        return {
            rangeKm: null,
            avgConsumption: null,
            isValid: false,
            message: 'Нет данных'
        };
    }

    try {
        // 1. Фильтруем только ГАЗ и валидные данные о расходе
        const gasData = fuelData.filter(entry => {
            if (!entry || typeof entry !== 'object') return false;
            
            const fuelType = entry.fuelType ? entry.fuelType.toString().toLowerCase() : '';
            const hasConsumption = entry.fuelConsumption && !isNaN(parseFloat(entry.fuelConsumption));
            const consumptionValue = parseFloat(entry.fuelConsumption);
            
            return fuelType.includes('газ') && hasConsumption && consumptionValue > 0 && consumptionValue < 30;
        });

        if (gasData.length === 0) {
            return {
                rangeKm: null,
                avgConsumption: null,
                isValid: false,
                message: 'Нет данных по газу'
            };
        }

        // 2. Берем последние 10 заправок (или меньше если их меньше)
        const recentData = gasData.slice(-Math.min(3, gasData.length));
        
        // 3. Рассчитываем средний расход
        let totalConsumption = 0;
        let validEntries = 0;
        
        recentData.forEach(entry => {
            const consumption = parseFloat(entry.fuelConsumption);
            if (consumption > 0 && consumption < 30) { // Реалистичные пределы расхода
                totalConsumption += consumption;
                validEntries++;
            }
        });

        if (validEntries === 0) {
            return {
                rangeKm: null,
                avgConsumption: null,
                isValid: false,
                message: 'Нет валидных данных о расходе'
            };
        }

        const avgConsumption = totalConsumption / validEntries;
        
        // 4. Рассчитываем запас хода
        const rangeKm = Math.round((tankCapacity / avgConsumption) * 100);
        
        // 5. Проверяем на реалистичность (обычно 300-800 км)
        if (rangeKm < 200 || rangeKm > 1000) {
            console.warn('Нереалистичный запас хода:', rangeKm, 'км при расходе', avgConsumption, 'л/100км');
            return {
                rangeKm: null,
                avgConsumption: avgConsumption.toFixed(1),
                isValid: false,
                message: 'Нереалистичные данные'
            };
        }

        return {
            rangeKm: rangeKm,
            avgConsumption: avgConsumption.toFixed(1),
            isValid: true,
            message: `на ${tankCapacity} л при расходе ${avgConsumption.toFixed(1)} л/100км`,
            basedOn: `${validEntries} из ${recentData.length} заправок`
        };

    } catch (error) {
        console.error('Ошибка расчёта запаса хода:', error);
        return {
            rangeKm: null,
            avgConsumption: null,
            isValid: false,
            message: 'Ошибка расчёта'
        };
    }
}

/**
 * Обновляет отображение карточки запаса хода
 */
function updateFuelRangeDisplay(fuelData) {
    const result = calculateFuelRange(fuelData, 34); // 34 литра - полный бак
    
    const rangeKmElement = document.getElementById('fuelRangeKm');
    const rangeDetailsElement = document.getElementById('fuelRangeDetails');
    
    if (!rangeKmElement || !rangeDetailsElement) {
        console.warn('Элементы для отображения запаса хода не найдены');
        return;
    }
    
    if (result.isValid && result.rangeKm) {
        rangeKmElement.textContent = result.rangeKm;
        rangeDetailsElement.textContent = `при полном баке (34 л), расход ${result.avgConsumption} л/100км`;
        rangeDetailsElement.title = `Рассчитано на основе ${result.basedOn}`;
    } else {
        rangeKmElement.textContent = '—';
        rangeDetailsElement.textContent = result.message || 'Недостаточно данных';
    }
}

/**
 * Инициализация карточки запаса хода
 */
function initFuelRangeCard() {
    // Будет вызываться из основного скрипта после загрузки данных
    console.log('Карточка запаса хода готова к использованию');
}

// Экспорт функций для использования в основном скрипте
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateFuelRange, updateFuelRangeDisplay, initFuelRangeCard };
}