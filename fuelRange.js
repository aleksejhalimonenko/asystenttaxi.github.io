// fuelRange.js

function updateFuelRangeDisplay(fuelData) {
    const tankCapacity = 34;
    const rangeKmElement = document.getElementById('fuelRangeKm');
    const rangeDetailsElement = document.getElementById('fuelRangeDetails');

    if (!fuelData || !Array.isArray(fuelData) || fuelData.length === 0) return;

    // 1. Фильтруем ГАЗ (как в твоем script.js)
    const gasData = fuelData.filter(entry => {
        const fuelType = entry.fuelType ? entry.fuelType.toString().toLowerCase() : '';
        return fuelType.includes('газ') && entry.fuelConsumption > 0;
    });

    if (gasData.length === 0) return;

    // 2. Берем последние 5 записей (самый низ таблицы)
    const lastFive = gasData.slice(-5);

    // 3. Считаем среднее
    const totalConsumption = lastFive.reduce((sum, entry) => sum + parseFloat(entry.fuelConsumption), 0);
    const avg = totalConsumption / lastFive.length;

    // 4. Расчет
    const range = (tankCapacity / avg) * 100;

    if (rangeKmElement && rangeDetailsElement) {
        rangeKmElement.innerText = Math.round(range);
        rangeDetailsElement.innerText = `при полном баке (${tankCapacity} л), расход ${avg.toFixed(1)} л/100км`;
    }
}