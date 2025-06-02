// Получаем ссылки на DOM элементы один раз
const spinner = document.getElementById("spinner");
const table = document.getElementById("dataTable");
const sectionTitle = document.getElementById("sectionTitle");
const cardElement = document.querySelector('.card'); // Ссылка на контейнер .card

// Функция для получения параметра из URL
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
    other: "Прочее",
    settings: "Настройки"
  };

  const tabClassMap = {
    home: ".home-tab",
    fuel: ".fuel-tab",
    service: ".service-tab",
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
function loadData() {
  const page = getQueryParam("page") || "home"; // Вкладка по умолчанию 'home'
  setActiveTab(page);

  spinner.style.display = "block"; // Показать спиннер
  table.style.display = "none";    // Скрыть таблицу по умолчанию
  // Очистить предыдущий динамический контент внутри .card (кроме h2 и spinner)
  const dynamicContent = cardElement.querySelectorAll(':scope > *:not(h2):not(.spinner):not(#dataTable)');
  dynamicContent.forEach(el => el.remove());
  // Очищаем таблицу на случай если она была видима
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  // 💡 Убедитесь, что URL вашего веб-приложения GAS верный
  const url = `https://script.google.com/macros/s/AKfycbwbIVB5WCgp5YVIZWHDiWzlX4gKtMQSwBBZhdLtH4rPdu2f9gBrzGqmF-6dy5csTaF4/exec?page=${page}`;

  fetch(url)
    .then(res => {
      if (!res.ok) { // Проверка на ошибки HTTP (например, 404, 500)
        throw new Error(`Ошибка сети: ${res.status} ${res.statusText}`);
      }
      return res.json(); // Пытаемся распарсить JSON
    })
    .then(data => {
      spinner.style.display = "none"; // Скрыть спиннер после получения данных

      // Обработка данных в зависимости от страницы
      if (page === "service") {
        renderServiceData(data);
      } else if (page === "home") {
        renderHomeData(data);
      } else if (page === "fuel") {
        renderFuelData(data);
      } else {
        renderPlaceholder(page); // Для 'other', 'settings' и т.д.
      }
    })
    .catch(err => {
      spinner.style.display = "none"; // Скрыть спиннер при ошибке
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




// --- Функции рендеринга для каждой страницы ---

function renderServiceData(data) {
  table.style.display = "table"; // Показать таблицу
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = `
    <tr>
      <th>Дата</th>
      <th>Пробег</th>
      <th>Тип</th>
      <th>Описание</th>
    </tr>`;

  if (!Array.isArray(data)) {
      console.error("Данные для 'service' не являются массивом:", data);
      tbody.innerHTML = '<tr><td colspan="4">Ошибка формата данных</td></tr>';
      return;
  }

  if (data.length === 0) {
     tbody.innerHTML = '<tr><td colspan="4">Нет данных об обслуживании</td></tr>';
     return;
  }

  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date || '—'}</td>
      <td><span class="mileage">${row.mileage !== undefined ? row.mileage + ' км' : '—'}</span></td>
      <td>${row.type || '—'}</td>
      <td>${row.description || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
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
<!--
  <div class="shapka-selenyj">
    <h2>Текущий пробег</h2>
    <h1>249 559 км</h1>
  </div>
-->
  <div class="grid">
    <div class="card2">
      <div class="card2-icon">      <img src="icons/free-icon-tools-and-utensils-453591.png" alt="Мой пробег" style="width:64px; height:64px;"></div>
      <div><strong>${data.distance || '—'} км</strong></div>
      <div>Мой пробег</div>
    </div>
    <div class="card2">
      <div class="card-icon"><img src="icons/free-icon-calendar-7955483.png" alt="Календарь" style="width:64px; height:64px;"></div>
      <div><strong>${data.nextDiagnostic || '—'} км</strong></div>
      <div>Осталось до ТО</div>
    </div>
    <div class="card2">
      <div class="card2-icon"><img src="icons/free-icon-fuel-4459018.png" alt="Расходтоплива" style="width:64px; height:64px;"></div>
      <div><strong>251 zł/мес.</strong></div>
      <div>Топливо</div>
    </div>
    <div class="card2">
      <div class="card2-icon"><img src="icons/free-icon-wallet-passes-app-3845819.png" alt="Всегорасходов" style="width:64px; height:64px;"></div>
      <div><strong>${data.totalCost !== undefined ? data.totalCost : '—'}</strong></div>
      <div>Всего расходов</div>
    </div>
  </div>

  <div class="expenses-summary">
    <div><strong>Доп.информация</strong></div>
    <div class="expenses-items">
      <div class="expenses-item">
        <div class="expenses-item-icon"><img src="icons/free-icon-gas-3144737.png" alt="Обсл.газа" style="width:48px; height:48px;"></div>
		   <div><strong>${data.gasServiceDue || '—'} км</strong></div>
		  <div class="infoniz"><span>До обслуж.газа</span></div>
 
      </div>
	  
      <div class="expenses-item">
        <div class="expenses-item-icon"><img src="icons/free-icon-car-oil-938639.png" alt="Заменамасла" style="width:48px; height:48px;"></div>
		 <div><strong>${data.nextOilChange} км</strong></div>
		  <div class="infoniz"><span>До замены масла</span></div>
       
      </div>
	  
      <div class="expenses-item">
        <div class="expenses-item-icon"><img src="icons/free-icon-gearshift-1399176.png" alt="Коробка передач масло" style="width:48px; height:48px;"></div>
		<div><strong>${data.nextGearboxOilChange || '—'} км</strong></div>
		      <div class="infoniz"><span>До замены в КПП</span></div>
        
      </div>
	  
      <div class="expenses-item">
        <div class="expenses-item-icon"><img src="icons/free-icon-medical-insurance-835397.png" alt="Страховка" style="width:48px; height:48px;"></div>
		<div><strong>${data.insuranceEnds || '—'} дн.</strong></div>
         <div class="infoniz"><span>До окончания страховки</span></div>
		
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

function renderFuelData(data) {
  table.style.display = "table"; // Показать таблицу
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = `
    <tr>
      <th>Дата</th>
      <th>Пробег</th>
      <th>Тип топлива</th>
      <th>Цена за литр</th>
      <th>Объём</th>
      <th>Стоимость</th>
       <!-- <th>Комментарий</th> -->
    </tr>`;

  if (!Array.isArray(data)) {
      console.error("Данные для 'fuel' не являются массивом:", data);
      tbody.innerHTML = '<tr><td colspan="7">Ошибка формата данных</td></tr>';
      return;
  }

   if (data.length === 0) {
     tbody.innerHTML = '<tr><td colspan="7">Нет данных о заправках</td></tr>';
     return;
  }


  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date || '—'}</td>
      <td><span class="mileage">${row.mileage !== undefined ? row.mileage + ' км' : '—'}</span></td>
      <td>${row.fuelType || '—'}</td>
      <td>${row.pricePerLiter !== undefined ? row.pricePerLiter + ' PLN' : '—'}</td>
      <td>${row.fuelAmount !== undefined ? row.fuelAmount + ' л' : '—'}</td>
      <td><span class="cost">${row.totalCost !== undefined ? row.totalCost + ' PLN' : '—'}</span></td>
       <!-- <td>${row.comment || '<span class="no-comment">Нет комментариев</span>'}</td> -->
    `;
    tbody.appendChild(tr);
  });
}

function renderPlaceholder(page) {
  table.style.display = "none"; // Скрыть таблицу
  const placeholderDiv = document.createElement('div');
  placeholderDiv.style.textAlign = 'center';
  placeholderDiv.style.marginTop = '20px';
  placeholderDiv.style.color = '#666';

  const titleMap = {
     other: "Другое",
     settings: "Настройки"
   };
  placeholderDiv.textContent = `Раздел "${titleMap[page] || page}" находится в разработке.`;
  cardElement.appendChild(placeholderDiv);
}


// --- Инициализация ---
// Запускаем загрузку данных при загрузке страницы
window.addEventListener('load', loadData);

// Добавляем обработчик для навигации по истории браузера (кнопки назад/вперед)
window.addEventListener('popstate', loadData);