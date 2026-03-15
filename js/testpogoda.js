(function () {
    'use strict';

    function startPlugin() {
        var style = `
            <style id="stub-ui-styles">
                .stub-overlay {
                    background: rgba(0,0,0,0.8);
                    backdrop-filter: blur(15px);
                    padding: 20px;
                    border-radius: 10px;
                }
                .stub-btn-pulse.focus {
                    background-color: var(--main-color) !important;
                    color: #fff !important;
                    transform: scale(1.05);
                }
            </style>
        `;
        if (!$('#stub-ui-styles').length) $('head').append(style);

        function showStubModal() {
            var html = $(`
                <div class="stub-overlay">
                    <h2 style="margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">Проверка UI</h2>
                    <p style="margin-bottom: 20px; opacity: 0.8;">Навигация и контроллер исправлены.</p>
                    <div class="navigation-tabs__item selector stub-btn-pulse" style="width: 100%; text-align: center;">
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

            // Исправленная работа с контроллером
            Lampa.Controller.add('stub_ui_modal', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    // Убрали Lampa.Controller.render(), так как он вызывает ошибку
                },
                back: function () {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                }
            });
            
            // Сначала переключаем контроллер, потом вешаем событие
            Lampa.Controller.toggle('stub_ui_modal');

            html.find('.selector').on('hover:enter click', function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            });
        }

        function renderButton() {
            if ($('.stub-ui-button').length > 0) return;

            var head = $('.head__actions');
            if (head.length) {
                var btn = $(`
                    <div class="head__action stub-ui-button selector">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" fill="var(--main-color)"/>
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

        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready' || e.type === 'full:complite') renderButton();
        });

        Lampa.Listener.follow('layout', function (e) {
            if (e.type === 'complete') renderButton();
        });

        renderButton();
    }

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
