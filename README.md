# asystenttaxi.github.io

Веб-приложение для учёта расходов на автомобиль (HTML/CSS/JS + Google Apps Script backend).

## Актуальная структура фронтенда

- `index.html` — основная страница приложения (SPA shell).
- `style.css` — стили интерфейса.
- `script.js` — основная логика и рендеринг страниц.
- `fuelRange.js` — расчёт и отображение запаса хода.
- `fuelChart.js` — визуализация расхода топлива.

## Поток данных

Frontend (SPA)
→ Google Apps Script API
→ Google Sheets (база данных)
→ JSON response → Frontend
