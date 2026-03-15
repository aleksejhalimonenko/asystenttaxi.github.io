(function () {
    'use strict';

    function startPlugin() {
        // 1. Добавляем настройку в меню Lampa
        Lampa.SettingsApi.addParam({
            component: 'display', // Раздел настроек "Вид"
            param: {
                name: 'show_stub_button',
                type: 'boolean',
                default: true
            },
            field: {
                name: 'Показывать кнопку-заглушку',
                description: 'Отображает тестовую кнопку в верхнем углу'
            },
            onChange: function (value) {
                if (value) renderButton();
                else $('.stub-plugin-button').remove();
            }
        });

        // 2. Функция рендера кнопки
        function renderButton() {
            // Проверяем, включена ли настройка и нет ли кнопки уже на экране
            if (!Lampa.Storage.get('show_stub_button', true)) return;
            if ($('.stub-plugin-button').length > 0) return;

            // Находим контейнер с часами/статусом (правый верхний угол)
            var head = $('.head__actions'); 
            
            if (head.length) {
                var btn = $('<div class="head__action stub-plugin-button">' +
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/></svg>' +
                '</div>');

                // Обработчик нажатия
                btn.on('hover:enter click', function () {
                    Lampa.Noty.show('Плагин работает! Кнопка нажата.');
                });

                head.prepend(btn);
            }
        }

        // 3. Подписываемся на события Lampa для перерисовки
        // app:ready - когда всё загрузилось
        // full:complite - когда страница полностью отрисована
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready' || e.type === 'full:complite') {
                renderButton();
            }
        });

        // Дополнительный хук на изменение лейаута
        Lampa.Listener.follow('layout', function (e) {
            if (e.type === 'complete') {
                renderButton();
            }
        });

        // На всякий случай запускаем сразу
        renderButton();
    }

    // Ожидаем готовности объекта Lampa
    if (window.Lampa) {
        startPlugin();
    } else {
        var timer = setInterval(function () {
            if (window.Lampa) {
                clearInterval(timer);
                startPlugin();
            }
        }, 100);
    }
})();
