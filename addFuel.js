// Этот файл будет содержать логику для рендеринга формы добавления топлива и её отправки.

function renderAddFuelData(data) {
  const spinnerOverlay = document.getElementById("spinnerOverlay");
  const appContent = document.getElementById("appContent");
  const table = document.getElementById("dataTable");
  const cardElement = document.querySelector('.card');

  // Скрыть таблицу и показать контент
  if (table) table.style.display = "none";
  if (spinnerOverlay) spinnerOverlay.style.display = "none";
  if (appContent) appContent.style.display = "block";

  // Очистить весь предыдущий динамический контент внутри .card
  const dynamicContent = cardElement.querySelectorAll(':scope > *:not(h2):not(.spinner):not(#dataTable)');
  dynamicContent.forEach(el => el.remove());

  // Создаем контейнер для формы динамически
  const addFuelFormContainer = document.createElement('div');
  addFuelFormContainer.id = 'addFuelFormContainer';
  addFuelFormContainer.innerHTML = `
    <h3>Форма добавления заправки</h3>
    <form id="fuelForm">
      <div class="form-group">
        <label for="fuelMileage">Пробег (км):</label>
        <input type="number" id="fuelMileage" name="mileage" required>
      </div>
      <div class="form-group">
        <label for="fuelType">Тип топлива:</label>
        <select id="fuelType" name="fuelType" required>
          <option value="">Выберите тип</option>
          <option value="бензин">Бензин</option>
          <option value="газ">Газ</option>
          <option value="дизель">Дизель</option>
        </select>
      </div>
      <div class="form-group">
        <label for="fuelAmount">Объем (литры):</label>
        <input type="number" step="0.01" id="fuelAmount" name="fuelAmount" required>
      </div>
      <div class="form-group">
        <label for="fuelCost">Стоимость (PLN):</label>
        <input type="number" step="0.01" id="fuelCost" name="fuelCost" required>
      </div>
      <div class="form-group">
        <label for="fuelDistance">Пройденное расстояние (км):</label>
        <input type="number" id="fuelDistance" name="distance">
        <small>Расстояние от предыдущей заправки</small>
      </div>
      <button type="submit">Добавить заправку</button>
      <div id="formMessage" style="margin-top: 10px; text-align: center;"></div>
    </form>
  `;
  
  cardElement.appendChild(addFuelFormContainer);

  // Автозаполнение текущим пробегом
  const fuelMileageInput = document.getElementById('fuelMileage');
  if (fuelMileageInput && data && data.endKm) {
    fuelMileageInput.value = data.endKm;
  }

  // Обработчик отправки формы
  const fuelForm = document.getElementById('fuelForm');
  const formMessage = document.getElementById('formMessage');

  fuelForm.addEventListener('submit', async function(event) {
    event.preventDefault();

    formMessage.textContent = 'Отправка данных...';
    formMessage.style.color = '#333';

    const formData = new FormData(fuelForm);
    const params = new URLSearchParams();
    
    for (const [key, value] of formData.entries()) {
      params.append(key, value);
    }

    const gasWebAppUrl = `https://script.google.com/macros/s/AKfycbxLYT5b2qCLXK8iLtSz-48kimWcjGYfI6r31s3sJMjPJljrVMuJqmuNIswJ7RnjiTmG/exec`;

    try {
      const response = await fetch(gasWebAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`Ошибка сети: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        formMessage.textContent = '✅ ' + result.message;
        formMessage.style.color = 'green';
        fuelForm.reset();
        
        // Обновляем значение пробега после успешной отправки
        if (fuelMileageInput && data && data.endKm) {
          fuelMileageInput.value = data.endKm;
        }
      } else {
        formMessage.textContent = '❌ Ошибка: ' + result.message;
        formMessage.style.color = 'red';
      }
    } catch (error) {
      console.error('Ошибка при отправке данных:', error);
      formMessage.textContent = '❌ Произошла ошибка при отправке: ' + error.message;
      formMessage.style.color = 'red';
    }
  });
}