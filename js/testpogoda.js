(function () {
    'use strict';

    // Создаем модуль плагина согласно архитектуре Lampa
    function MyStubPlugin() {
        var network = new Lampa.Reguest(); // Используем встроенный модуль запросов
        
        // Метод открытия окна
        this.open = function () {
            // Проверяем состояние плеера (из раздела 2 документации)
            var isVideoPlaying = Lampa.Player.opened();
            var videoStatus = isVideoPlaying ? 'Видео сейчас запущено' : 'Плеер в покое';

            var html = $(`
                <div class="stub-modal">
                    <div class="stub-modal__content" style="padding: 20px;">
                        <h2 style="margin-bottom: 15px; color: var(--main-color);">Модульная система</h2>
                        <p style="opacity: 0.8; margin-bottom: 10px;">Этот плагин зарегистрирован как глобальный компонент.</p>
                        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
                            <strong>Статус плеера:</strong> ${videoStatus}
                        </div>
                        <div class="navigation-tabs__item selector" id="modal-close-btn" style="margin-top: 20px; width: 100%;">
                            <span>Закрыть</span>
                        </div>
                    </div>
                </div>
            `);

            Lampa.Modal.open({
                title: 'Lampa Source Info',
                html: html,
                size: 'small',
                onBack: () => Lampa.Modal.close()
            });

            // Управление фокусом через Controller (раздел 1.2)
            Lampa.Controller.add('plugin_stub_modal', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.render();
                },
                back: () => Lampa.Modal.close()
            });
            Lampa.Controller.toggle('plugin_stub_modal');

            html.find('#modal-close-btn').on('hover:enter click', () => Lampa.Modal.close());
        };

        // Метод отрисовки кнопки в шапке
        this.render = function () {
            if (!Lampa.Storage.get('show_stub_button', true)) return;
            if ($('.stub-button').length > 0) return;

            var head = $('.head__actions');
            if (head.length) {
                var btn = $(`
                    <div class="head__action stub-button selector">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
                            <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                `);

                btn.on('hover:enter click', (e) => {
                    e.preventDefault();
                    this.open();
                });

                head.prepend(btn);
            }
        };
    }

    // Инициализация плагина
    function init() {
        // Регистрируем как компонент (раздел 1.2)
        Lampa.Component.add('stub_plugin', MyStubPlugin);
        
        var instance = new MyStubPlugin();

        // Добавляем настройки
        Lampa.SettingsApi.addParam({
            component: 'display',
            param: { name: 'show_stub_button', type: 'boolean', default: true },
            field: { name: 'Кнопка заглушка (PRO)', description: 'Построено на основе глубокой документации Lampa' },
            onChange: (value) => {
                if (value) instance.render();
                else $('.stub-button').remove();
            }
        });

        // Следим за состоянием интерфейса для перерисовки кнопки
        Lampa.Listener.follow('app', (e) => {
            if (e.type === 'ready' || e.type === 'full:complite') instance.render();
        });
        Lampa.Listener.follow('layout', (e) => {
            if (e.type === 'complete') instance.render();
        });

        instance.render();
    }

    // Запуск согласно циклу инициализации (раздел 1.1)
    if (window.Lampa) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
