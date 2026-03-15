(function () {
    'use strict';

    function startPlugin() {
        // 1. Регистрируем плагин как компонент (согласно разделу 1.2)
        Lampa.Component.add('my_stub_plugin', function () {
            this.open = function () {
                // Создаем структуру окна с использованием классов Lampa (раздел 1.3)
                var html = $(`
                    <div class="stub-modal" style="padding: 20px; text-align: center;">
                        <h2 style="margin-bottom: 15px; color: var(--main-color);">Тестовое окно</h2>
                        <p style="color: var(--white); opacity: 0.8; line-height: 1.5;">
                            Это модальное окно-заглушка.<br>
                            Все системы (Bootstrap, CSS, Controller) работают штатно.
                        </p>
                        
                        <div class="stub-modal__footer" style="margin-top: 25px;">
                            <div class="navigation-tabs__item selector" id="stub-close-btn" style="width: 100%; justify-content: center;">
                                <span>Закрыть</span>
                            </div>
                        </div>
                    </div>
                `);

                // Открываем модальное окно
                Lampa.Modal.open({
                    title: 'Статус плагина',
                    html: html,
                    size: 'small',
                    onBack: () => {
                        Lampa.Modal.close();
                        Lampa.Controller.toggle('content'); // Возвращаем фокус на основной контент
                    }
                });

                // Управляем навигацией пульта (раздел 1.2)
                Lampa.Controller.add('stub_modal_focus', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(html);
                        Lampa.Controller.render();
                    },
                    back: () => {
                        Lampa.Modal.close();
                        Lampa.Controller.toggle('content');
                    }
                });
                Lampa.Controller.toggle('stub_modal_focus');

                // Клик по кнопке закрытия
                html.find('#stub-close-btn').on('hover:enter click', function () {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                });
            };
        });

        // 2. Функция отрисовки кнопки в шапке
        function renderButton() {
            if ($('.stub-header-button').length > 0) return;

            var head = $('.head__actions');
            if (head.length) {
                // Используем стандартную разметку Lampa для иконок в шапке
                var btn = $(`
                    <div class="head__action stub-header-button selector">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 8V16M8 12H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                `);

                btn.on('hover:enter click', function (e) {
                    e.preventDefault();
                    // Вызываем метод open нашего компонента
                    (new (Lampa.Component.get('my_stub_plugin'))()).open();
                });

                head.prepend(btn);
            }
        }

        // 3. Следим за жизненным циклом (раздел 1.1)
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready' || e.type === 'full:complite') renderButton();
        });

        Lampa.Listener.follow('layout', function (e) {
            if (e.type === 'complete') renderButton();
        });

        renderButton();
    }

    // Запуск инициализации
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
