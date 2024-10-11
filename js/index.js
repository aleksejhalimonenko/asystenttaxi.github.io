document.addEventListener('DOMContentLoaded', function () {
    const menuButton = document.getElementById('menuButton');
    const menu = document.getElementById('menu');
    const fabButton = document.getElementById('fab-button');
    const fabMenu = document.getElementById('fab-menu');

    // Функция для открытия и закрытия всплывающего меню
    menuButton.addEventListener('click', function (e) {
        e.preventDefault();
        menu.classList.toggle('show');
    });

    // Функция для открытия и закрытия FAB меню
    fabButton.addEventListener('click', function (e) {
        e.stopPropagation(); // Останавливаем всплытие события
        fabMenu.classList.toggle('show');

        // Плавная последовательная анимация для каждого элемента меню
        const items = fabMenu.querySelectorAll('.menu-item');
        items.forEach((item, index) => {
            item.style.transitionDelay = index * 100 + 'ms'; // Задержка между появлением элементов
            item.classList.toggle('show');
        });
    });

    // Закрытие меню при клике вне
    document.addEventListener('click', function (e) {
        if (!menu.contains(e.target) && !menuButton.contains(e.target)) {
            menu.classList.remove('show');
        }

        if (!fabMenu.contains(e.target) && !fabButton.contains(e.target)) {
            fabMenu.classList.remove('show');
            fabMenu.querySelectorAll('.menu-item.show').forEach((item) => {
                item.classList.remove('show');
            });
        }
    });
});
