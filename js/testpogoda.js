(function () {
    'use strict';

    console.log('[TEST] Plugin started');

    // Функция вставки элемента
    function injectTestButton() {
        // Пробуем найти контейнер для кнопок справа
        var headerRight = $('.header .header__right, .header__right, .header-right, .header__actions');
        if (headerRight.length === 0) {
            console.log('[TEST] Header container not found');
            return false;
        }

        // Проверяем, не вставлен ли уже наш элемент
        if (headerRight.find('.test-inject-button').length > 0) {
            console.log('[TEST] Button already exists');
            return true;
        }

        // Создаем яркую кнопку
        var button = $(
            '<div class="test-inject-button selector" style="' +
                'display: inline-block;' +
                'margin-right: 15px;' +
                'padding: 5px 12px;' +
                'background: #4CAF50;' +
                'color: white;' +
                'border-radius: 20px;' +
                'cursor: pointer;' +
                'font-weight: bold;' +
                'box-shadow: 0 2px 5px rgba(0,0,0,0.3);' +
            '">' +
                '🔌 ТЕСТ' +
            '</div>'
        );

        button.on('hover:enter', function () {
            Lampa.Noty.show('Плагин работает!');
        });

        headerRight.prepend(button);
        console.log('[TEST] Button injected successfully');
        return true;
    }

    // 1. Пытаемся вставить сразу после готовности приложения
    if (window.appready) {
        setTimeout(injectTestButton, 1000);
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                setTimeout(injectTestButton, 1000);
            }
        });
    }

    // 2. Используем MutationObserver для отслеживания появления шапки
    var observer = new MutationObserver(function (mutations) {
        if (injectTestButton()) {
            // Если вставили успешно, можно отключить наблюдатель
            observer.disconnect();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 3. Также пробуем периодически (на всякий случай)
    var interval = setInterval(function () {
        if (injectTestButton()) {
            clearInterval(interval);
        }
    }, 1000);

    // Отключаем интервал через 30 секунд, чтобы не висел вечно
    setTimeout(function () {
        clearInterval(interval);
    }, 30000);
})();
