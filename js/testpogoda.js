(function () {
    'use strict';

    function startPlugin() {
        // 1. Добавляем настройку в меню Lampa (Настройки -> Вид)
        Lampa.SettingsApi.addParam({
            component: 'display',
            param: {
                name: 'show_stub_button',
                type: 'boolean',
                default: true
            },
            field: {
                name: 'Показывать кнопку-заглушку',
                description: 'Отображает тестовую кнопку в верхнем углу для вызова окна'
            },
            onChange: function (value) {
                if (value) renderButton();
                else $('.stub-plugin-button').remove();
            }
        });

        // 2. Функция создания всплывающего окна
        function openMyModal() {
            Lampa.Modal.open({
                title: 'Плагин активен',
                html: '<div style="padding: 1.5rem; text-align: center;">' +
                        '<h2 style="margin-bottom: 1rem; color: #fff;">Привет!</h2>' +
                        '<p style="font-size: 1.2rem; line-height: 1.5; color: #aaa;">Это полноценное модальное окно Lampa.<br>Кнопка в углу работает исправно и не исчезает при переходах.</p>' +
                        '<div style="margin-top: 1.5rem; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 10px;">' +
                            'Версия Lampa: ' + (window.Lampa.Manifest ? window.Lampa.Manifest.version : 'Неизвестно') +
                        '</div>' +
                      '</div>',
                size: 'medium',
                buttons: [
                    {
                        name: 'Отлично',
                        onSelect: function () {
                            Lampa.Modal.close();
                        }
                    },
                    {
                        name: 'Закрыть',
                        onSelect: function () {
                            Lampa.Modal.close();
                        }
                    }
                ],
                onBack: function() {
                    Lampa.Modal.close();
                }
            });
        }

        // 3. Функция рендера кнопки в шапке
        function renderButton() {
            // Проверка: включена ли настройка
            if (!Lampa.Storage.get('show_stub_button', true)) return;
            // Проверка: нет ли кнопки уже на экране
            if ($('.stub-plugin-button').length > 0) return;

            // Контейнер в правом верхнем углу (где часы и иконки сети)
            var head = $('.head__actions'); 
            
            if (head.length) {
                // Создаем элемент кнопки с SVG иконкой (круг с точкой)
                var btn = $('<div class="head__action stub-plugin-button selector">' +
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">' +
                        '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>' +
                        '<circle cx="12" cy="12" r="3" fill="currentColor"/>' +
                    '</svg>' +
                '</div>');

                // Обработка клика и Enter на пульте
                btn.on('hover:enter click', function () {
                    openMyModal();
                });

                // Добавляем в начало списка иконок
                head.prepend(btn);
            }
        }

        // 4. Слушатели событий для удержания кнопки в DOM
        // Lampa часто перерисовывает шапку, поэтому вешаемся на основные события
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready' || e.type === 'full:complite') {
                renderButton();
            }
        });

        Lampa.Listener.follow('layout', function (e) {
            if (e.type === 'complete') {
                renderButton();
            }
        });

        // Прямой вызов при загрузке
        renderButton();
    }

    // Ожидание инициализации Lampa
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
