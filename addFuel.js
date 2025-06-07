// Этот файл будет содержать логику для рендеринга формы добавления топлива и её отправки.

function renderAddFuelData(data) {
  const spinner = document.getElementById("spinner");
  const table = document.getElementById("dataTable");
  const cardElement = document.querySelector('.card');

  table.style.display = "none"; // Скрыть таблицу
  spinner.style.display = "none"; // Скрыть спиннер, если он был виден

  // Очистить весь предыдущий динамический контент внутри .card
  // Теперь удаляем всё, что не является h2, spinner или dataTable
  const dynamicContent = cardElement.querySelectorAll(':scope > *:not(h2):not(.spinner):not(#dataTable)');
  dynamicContent.forEach(el => el.remove());

  // Создаем контейнер для формы динамически
  const addFuelFormContainer = document.createElement('div');
  addFuelFormContainer.id = 'addFuelFormContainer'; // Присваиваем ID
  addFuelFormContainer.innerHTML = `
    <h3>Форма добавления заправки</h3>
    <form id="fuelForm">
      <!-- <div class="form-group">
        <label for="fuelDate">Дата:</label>
        <input type="date" id="fuelDate" name="date" required>
      </div>
	  -->
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
	  <!--
      <div class="form-group">
        <label for="fuelComment">Комментарий:</label>
        <textarea id="fuelComment" name="comment"></textarea>
      </div>
	    -->
      <button type="submit">Добавить заправку</button>
      <div id="formMessage" style="margin-top: 10px; text-align: center;"></div>
    </form>
  `;
  cardElement.appendChild(addFuelFormContainer); // Добавляем созданный контейнер в .card

  // Устанавливаем текущую дату в поле даты
  const fuelDateInput = document.getElementById('fuelDate');
  if (fuelDateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    fuelDateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  // Опционально: можно использовать данные 'data' (текущий пробег) для автозаполнения формы
  const fuelMileageInput = document.getElementById('fuelMileage');
  if (fuelMileageInput && data && data.endKm) {
    fuelMileageInput.value = data.endKm; // Устанавливаем текущий пробег как значение по умолчанию
  }

  const fuelForm = document.getElementById('fuelForm');
  const formMessage = document.getElementById('formMessage');

  // Добавляем обработчик события отправки формы
  fuelForm.addEventListener('submit', async function(event) {
    event.preventDefault(); // Предотвращаем стандартную отправку формы

    formMessage.textContent = 'Отправка данных...';
    formMessage.style.color = '#333';

    const formData = new FormData(fuelForm); // Собираем данные формы
	
	
// --- Проверка на корректные дннаые пробега
// --- КОНЕЦ БЛОКА ПРОВЕРКИ ---



    // --- ИЗМЕНЕНИЯ ЗДЕСЬ: Преобразуем FormData в URLSearchParams ---
    const params = new URLSearchParams();
    for (const [key, value] of formData.entries()) {
      params.append(key, value);
    }
    // --- КОНЕЦ ИЗМЕНЕНИЙ ---

    // URL вашего GAS веб-приложения (тот же самый URL, что и для doGet)
    // Убедитесь, что это ваш актуальный URL развертывания, заканчивающийся на /exec
    const gasWebAppUrl = `https://script.google.com/macros/s/AKfycbxLYT5b2qCLXK8iLtSz-48kimWcjGYfI6r31s3sJMjPJljrVMuJqmuNIswJ7RnjiTmG/exec`; // ВАШ URL

    try {
      const response = await fetch(gasWebAppUrl, {
        method: 'POST', // Важно: используем POST метод
        headers: {
          // --- ИЗМЕНЕНИЯ ЗДЕСЬ: Меняем Content-Type ---
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          // --- КОНЕЦ ИЗМЕНЕНИЙ ---
        },
        // --- ИЗМЕНЕНИЯ ЗДЕСЬ: Отправляем params.toString() ---
        body: params.toString() // Отправляем данные как строку в формате x-www-form-urlencoded
        // --- КОНЕЦ ИЗМЕНЕНИЙ ---
      });

      if (!response.ok) {
        throw new Error(`Ошибка сети: ${response.status} ${response.statusText}`);
      }

      const result = await response.json(); // Парсим JSON ответ от GAS

      if (result.success) {
        formMessage.textContent = '✅ ' + result.message;
        formMessage.style.color = 'green';
        fuelForm.reset(); // Очищаем форму после успешной отправки
        // Опционально: можно обновить данные на главной странице или истории заправок
        // loadData(); // Перезагрузить данные после добавления
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