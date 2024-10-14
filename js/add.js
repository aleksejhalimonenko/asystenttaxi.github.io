document.getElementById('utilityForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Отменяем стандартное поведение формы

    // Создаем объект FormData из формы
    const formData = new FormData(this);

    // Добавляем дополнительные данные пользователя
    formData.append('user', 'Admin'); // Замените на нужные данные пользователя

    // Отправка данных в Google Apps Script
    fetch('https://script.google.com/macros/s/AKfycbwCVJnyhhtUbLPFj8R8rjVKjr4XGdIipaHKnHIsZjkrEihzPH61T1UgdyNEONjiL1c/exec', { // Замените на ваш URL
        method: 'POST',
        body: formData
    })
    .then(response => response.json()) // Предполагается, что ответ в формате JSON
    .then(data => {
        // Обработка успешного ответа
        const responseDiv = document.getElementById('response');
        responseDiv.style.display = 'block'; // Отображаем блок ответа
        responseDiv.innerText = 'Данные успешно отправлены!';
        // Очищаем форму после отправки
        document.getElementById('utilityForm').reset();
    })
    .catch(error => {
        console.error('Ошибка:', error);
        const responseDiv = document.getElementById('response');
        responseDiv.style.display = 'block';
        responseDiv.innerText = 'Произошла ошибка при отправке данных.';
    });
});
