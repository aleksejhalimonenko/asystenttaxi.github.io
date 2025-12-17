// fuelChart.js
// Функция для отрисовки графика тренда расхода газа

let fuelChartInstance = null;

/**
 * Основная функция для рендеринга графика
 * @param {Array} fuelData - Все данные о заправках из GAS
 */
function renderFuelChart(fuelData) {
    console.log('renderFuelChart вызван, данных:', fuelData?.length);
    
    // 1. Фильтруем данные: только газ за последние 6 месяцев
    const filteredData = filterGasLast6Months(fuelData);
    console.log('Отфильтрованные данные (газ, 6 мес):', filteredData);
    
    // 2. Группируем по месяцам и считаем средний расход
    const monthlyData = calculateMonthlyAverages(filteredData);
    console.log('Данные по месяцам:', monthlyData);
    
    // 3. Сортируем месяцы в правильном порядке
    const sortedData = sortMonthlyData(monthlyData);
    console.log('Отсортированные данные:', sortedData);
    
    // 4. Отрисовываем график
    drawLineChart(sortedData);
}

/**
 * Фильтрует данные: только газ за последние 6 месяцев
 */
function filterGasLast6Months(data) {
    if (!Array.isArray(data) || data.length === 0) {
        console.warn('Нет данных для фильтрации');
        return [];
    }
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    
    console.log('Фильтрация: 6 месяцев назад =', sixMonthsAgo.toLocaleDateString());
    
    return data.filter(entry => {
        // Проверяем тип топлива
        const isGas = entry.fuelType && 
                     entry.fuelType.toString().toLowerCase().includes('газ');
        
        // Проверяем наличие расхода
        const hasConsumption = entry.fuelConsumption && 
                              !isNaN(parseFloat(entry.fuelConsumption)) && 
                              parseFloat(entry.fuelConsumption) > 0;
        
        // Проверяем дату
        let isRecent = true;
        if (entry.date) {
            const entryDate = parseCustomDate(entry.date);
            isRecent = entryDate >= sixMonthsAgo && !isNaN(entryDate.getTime());
        }
        
        return isGas && hasConsumption && isRecent;
    });
}

/**
 * Парсит дату в формате "dd.MM.yyyy"
 */
function parseCustomDate(dateString) {
    if (!dateString) return new Date(NaN);
    
    const parts = dateString.trim().split('.');
    if (parts.length !== 3) return new Date(NaN);
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
        return new Date(NaN);
    }
    
    return new Date(year, month, day);
}

/**
 * Группирует данные по месяцам и считает средний расход
 */
function calculateMonthlyAverages(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }
    
    const monthlyMap = {};
    
    data.forEach(entry => {
        if (!entry.date || !entry.fuelConsumption) return;
        
        const date = parseCustomDate(entry.date);
        if (isNaN(date.getTime())) return;
        
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('ru-RU', { 
            month: 'short', 
            year: 'numeric' 
        }).replace(' г.', '');
        
        const consumption = parseFloat(entry.fuelConsumption);
        if (isNaN(consumption)) return;
        
        if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = {
                monthKey: monthKey,
                monthName: monthName,
                consumptions: [],
                total: 0,
                count: 0
            };
        }
        
        monthlyMap[monthKey].consumptions.push(consumption);
        monthlyMap[monthKey].total += consumption;
        monthlyMap[monthKey].count++;
    });
    
    // Преобразуем в массив и считаем среднее
    return Object.values(monthlyMap).map(month => ({
        ...month,
        average: month.total / month.count
    }));
}

/**
 * Сортирует данные по месяцам (от старых к новым)
 */
function sortMonthlyData(monthlyData) {
    return [...monthlyData].sort((a, b) => {
        return a.monthKey.localeCompare(b.monthKey);
    });
}

/**
 * Отрисовывает линейный график с использованием Chart.js
 */
function drawLineChart(monthlyData) {
    const canvas = document.getElementById('fuelTrendCanvas');
    if (!canvas) {
        console.error('Canvas элемент не найден!');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Уничтожаем предыдущий график, если он есть
    if (fuelChartInstance) {
        fuelChartInstance.destroy();
    }
    
    // Если нет данных для графика
    if (!monthlyData || monthlyData.length === 0) {
        canvas.style.display = 'none';
        document.getElementById('noDataMessage').style.display = 'block';
        return;
    }
    
    canvas.style.display = 'block';
    document.getElementById('noDataMessage').style.display = 'none';
    
    // Подготавливаем данные для Chart.js
    const labels = monthlyData.map(item => item.monthName);
    const data = monthlyData.map(item => parseFloat(item.average.toFixed(1)));
    
    // Настройки графика
    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Расход газа (л/100 км)',
                data: data,
                borderColor: '#007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#007aff',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.3 // Плавность линии
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            family: "'Fira Sans', sans-serif",
                            size: 12
                        },
                        color: '#333'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    titleFont: {
                        family: "'Fira Sans', sans-serif",
                        size: 12
                    },
                    bodyFont: {
                        family: "'Fira Sans', sans-serif",
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            return `Расход: ${context.parsed.y} л/100 км`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            family: "'Fira Sans', sans-serif",
                            size: 11
                        },
                        color: '#666'
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            family: "'Fira Sans', sans-serif",
                            size: 11
                        },
                        color: '#666',
                        callback: function(value) {
                            return value + ' л';
                        }
                    },
                    title: {
                        display: true,
                        text: 'л/100 км',
                        font: {
                            family: "'Fira Sans', sans-serif",
                            size: 12
                        },
                        color: '#666'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    };
    
    // Создаем график
    fuelChartInstance = new Chart(ctx, chartConfig);
}

/**
 * Уничтожает график (при переходе на другую страницу)
 */
function destroyFuelChart() {
    if (fuelChartInstance) {
        fuelChartInstance.destroy();
        fuelChartInstance = null;
    }
}