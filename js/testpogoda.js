(function () {
    'use strict';

    // 1. Описываем наш модуль
    function MyFinalStub() {
        var _this = this;
        var btn;

        // Метод для отрисовки кнопки (Раздел 7.1)
        this.render = function () {
            if ($('.stub-final-button').length > 0) return;

            var head = $('.head__actions');
            if (head.length) {
                btn = $(`
                    <div class="head__action stub-final-button selector">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" fill="var(--main-color)"/>
                        </svg>
                    </div>
                `);

                btn.on('hover:enter click', function (e) {
                    e.preventDefault();
                    _this.open();
                });

                head.prepend(btn);
            }
        };

        // Метод открытия модального окна (Раздел 7.2 + 7.6)
        this.open = function () {
            var html = $(`
                <div class="stub-final-modal" style="padding: 20px; text-align: center;">
                    <h2 style="margin-bottom: 15px; color: var(--main-color);">Lampa Extension</h2>
                    <p style="opacity: 0.8; line-height: 1.5; margin-bottom: 20px;">
                        Эта заглушка построена на базе полного цикла документации.<br>
                        Проверено: UI, Navigation, CSS, Extensions.
                    </p>
                    <div class="navigation-tabs__item selector stub-confirm" style="width: 100%; justify-content: center;">
                        <span>Закрыть</span>
                    </div>
                </div>
            `);

            Lampa.Modal.open({
                title: 'Версия 1.0.0',
                html: html,
                size: 'small',
                onBack: function() {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                }
            });

            // Регистрация в контроллере навигации
            Lampa.Controller.add('stub_final_ctrl', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.render();
                },
                back: function () {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                }
            });
            Lampa.Controller.toggle('stub_final_ctrl');

            html.find('.stub-confirm').on('hover:enter click', function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            });
        };

        // Метод удаления (Раздел 11.2)
        this.destroy = function () {
            $('.stub-final-button').remove();
            $('#stub-final-styles').remove();
            btn = null;
        };
    }

    // 2. Инициализация с учетом жизненного цикла (Раздел 1.1)
    function init() {
        // Добавляем стили с эффектами (Раздел 7.6)
        var styles = `
            <style id="stub-final-styles">
                .stub-final-modal { backdrop-filter: blur(15px); }
                .stub-final-button.focus { color: var(--main-color); transform: scale(1.1); }
            </style>
        `;
        if (!$('#stub-final-styles').length) $('head').append(styles);

        // Создаем экземпляр
        var plugin = new MyFinalStub();

        // Регистрируем в системе компонентов (Раздел 1.2)
        Lampa.Component.add('my_final_stub', MyFinalStub);

        // Добавляем параметр в настройки
        Lampa.SettingsApi.addParam({
            component: 'display',
            param: { name: 'show_final_stub', type: 'boolean', default: true },
            field: { 
                name: 'Финальная заглушка', 
                description: 'Полная интеграция по стандартам Lampa Source' 
            },
            onChange: function (value) {
                if (value) plugin.render();
                else plugin.destroy();
            }
        });

        // Слушатели для удержания кнопки в DOM
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready' || e.type === 'full:complite') plugin.render();
        });
        Lampa.Listener.follow('layout', function (e) {
            if (e.type === 'complete') plugin.render();
        });

        plugin.render();
    }

    // Запуск (Bootstrap)
    if (window.Lampa) {
        init();
    } else {
        var timer = setInterval(function () {
            if (window.Lampa) {
                clearInterval(timer);
                init();
            }
        }, 100);
    }
})();
