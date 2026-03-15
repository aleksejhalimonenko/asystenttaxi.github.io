(function () {
    'use strict';

    function startPlugin() {
        // Добавляем специфичные стили для визуальных эффектов (раздел 7.6)
        var style = `
            <style id="stub-ui-styles">
                .stub-overlay {
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 30px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .stub-btn-pulse.focus {
                    box-shadow: 0 0 20px var(--main-color);
                    background-color: var(--main-color) !important;
                    color: #fff !important;
                }
            </style>
        `;
        if (!$('#stub-ui-styles').length) $('head').append(style);

        // Функция вызова окна через систему Activity/Modal (раздел 7.2)
        function showStubModal() {
            var html = $(`
                <div class="stub-overlay">
                    <h2 style="margin-bottom: 20px; font-size: 1.8rem;">UI Framework Test</h2>
                    <p style="margin-bottom: 25px; opacity: 0.7;">
                        Плагин интегрирован в навигационную структуру Lampa.<br>
                        Используется эффект Backdrop Blur (7.6).
                    </p>
                    <div class="navigation-tabs__item selector stub-btn-pulse" style="width: 100%; justify-content: center;">
                        <span>Закрыть окно</span>
                    </div>
                </div>
            `);

            Lampa.Modal.open({
                title: 'Навигация и UI',
                html: html,
                size: 'small',
                onBack: function() {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                }
            });

            // Регистрация в навигационном стеке (раздел 7.1)
            Lampa.Controller.add('stub_ui_modal', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.render();
                },
                back: function () {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                }
            });
            Lampa.Controller.toggle('stub_ui_modal');

            html.find('.selector').on('hover:enter click', function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            });
        }

        // Рендер кнопки в шапке
        function renderButton() {
            if ($('.stub-ui-button').length > 0) return;

            var head = $('.head__actions');
            if (head.length) {
                var btn = $(`
                    <div class="head__action stub-ui-button selector">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 -12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 8V12L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                `);

                btn.on('hover:enter click', function (e) {
                    e.preventDefault();
                    showStubModal();
                });

                head.prepend(btn);
            }
        }

        // Подписка на события жизненного цикла (раздел 1.1 и 7.1)
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready' || e.type === 'full:complite') renderButton();
        });

        Lampa.Listener.follow('layout', function (e) {
            if (e.type === 'complete') renderButton();
        });

        renderButton();
    }

    // Инициализация
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
