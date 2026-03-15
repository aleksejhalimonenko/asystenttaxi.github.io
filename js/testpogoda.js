(function () {
    'use strict';

    function startPlugin() {
        // 1. Настройка в меню
        Lampa.SettingsApi.addParam({
            component: 'display',
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

        // 2. Исправленная функция модального окна
        function openMyModal() {
            // Создаем контент через jQuery, чтобы избежать ошибок парсинга
            var html = $(
                '<div class="about">' +
                    '<div class="about__text" style="padding: 20px; text-align: center;">' +
                        '<h2 style="margin-bottom: 10px;">Всё работает!</h2>' +
                        '<p>Ошибка "where.find" исправлена.</p>' +
                        '<p style="color: #aaa; margin-top: 10px;">Lampa успешно приняла объект модального окна.</p>' +
                    '</div>' +
                '</div>'
            );

            Lampa.Modal.open({
                title: 'Плагин активен',
                html: html, // Передаем объект
                size: 'medium',
                onBack: function() {
                    Lampa.Modal.close();
                },
                onSelect: function() {
                    // Это сработает, если нажать на сам контент (опционально)
                    Lampa.Modal.close();
                }
            });

            // Добавляем кнопки отдельно для надежности, если стандартный массив глючит
            var btn_close = $('<div class="navigation-tabs__item selector"><span>Закрыть окно</span></div>');
            btn_close.on('hover:enter click', function(){
                Lampa.Modal.close();
            });
            
            html.append(btn_close);

            // Сообщаем Lampa, что в окне появились новые элементы для выбора (фокуса)
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.render();
                },
                back: function () {
                    Lampa.Modal.close();
                }
            });
            Lampa.Controller.toggle('content');
        }

        // 3. Рендер кнопки
        function renderButton() {
            if (!Lampa.Storage.get('show_stub_button', true)) return;
            if ($('.stub-plugin-button').length > 0) return;

            var head = $('.head__actions'); 
            if (head.length) {
                var btn = $('<div class="head__action stub-plugin-button selector">' +
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                        '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/>' +
                        '<circle cx="12" cy="12" r="3" fill="currentColor"/>' +
                    '</svg>' +
                '</div>');

                btn.on('hover:enter click', function (e) {
                    e.preventDefault();
                    openMyModal();
                });

                head.prepend(btn);
            }
        }

        // 4. Слушатели
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready' || e.type === 'full:complite') renderButton();
        });

        Lampa.Listener.follow('layout', function (e) {
            if (e.type === 'complete') renderButton();
        });

        renderButton();
    }

    if (window.Lampa) startPlugin();
    else {
        var timer = setInterval(function () {
            if (window.Lampa) {
                clearInterval(timer);
                startPlugin();
            }
        }, 100);
    }
})();
