(function () {
    'use strict';

    function startPlugin() {
        // 1. Добавляем стили плагина в head, используя переменные Lampa
        var styles = `
            <style id="stub-plugin-styles">
                .stub-button {
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .stub-button.focus {
                    transform: scale(1.1);
                    color: var(--main-color) !important;
                }
                .stub-modal__content {
                    padding: 20px;
                    text-align: center;
                }
                .stub-modal__title {
                    font-size: 1.5rem;
                    margin-bottom: 15px;
                    color: var(--white);
                }
                .stub-modal__text {
                    font-size: 1.1rem;
                    line-height: 1.4;
                    color: var(--text-color);
                    opacity: 0.8;
                }
                .stub-modal__footer {
                    margin-top: 25px;
                    display: flex;
                    justify-content: center;
                }
            </style>
        `;
        if (!$('#stub-plugin-styles').length) $('head').append(styles);

        // 2. Настройка в меню
        Lampa.SettingsApi.addParam({
            component: 'display',
            param: {
                name: 'show_stub_button',
                type: 'boolean',
                default: true
            },
            field: {
                name: 'Показывать кнопку-заглушку',
                description: 'Кнопка в шапке с учетом CSS архитектуры'
            },
            onChange: function (value) {
                if (value) renderButton();
                else $('.stub-button').remove();
            }
        });

        // 3. Функция модального окна
        function openMyModal() {
            var html = $(`
                <div class="stub-modal">
                    <div class="stub-modal__content">
                        <div class="stub-modal__title">Архитектура CSS</div>
                        <div class="stub-modal__text">
                            Это окно использует системные переменные Lampa.<br>
                            Оно будет менять цвета вместе с темой приложения.
                        </div>
                        <div class="stub-modal__footer">
                            <div class="navigation-tabs__item selector" id="modal-close-btn">
                                <span>Понятно</span>
                            </div>
                        </div>
                    </div>
                </div>
            `);

            Lampa.Modal.open({
                title: 'Проверка стилей',
                html: html,
                size: 'small',
                onBack: function() {
                    Lampa.Modal.close();
                }
            });

            // Работа с контроллером для навигации пульта
            Lampa.Controller.add('plugin_modal', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.render();
                },
                back: function () {
                    Lampa.Modal.close();
                }
            });
            Lampa.Controller.toggle('plugin_modal');

            html.find('#modal-close-btn').on('hover:enter click', function() {
                Lampa.Modal.close();
            });
        }

        // 4. Рендер кнопки в шапке
        function renderButton() {
            if (!Lampa.Storage.get('show_stub_button', true)) return;
            if ($('.stub-button').length > 0) return;

            var head = $('.head__actions'); 
            if (head.length) {
                var btn = $('<div class="head__action stub-button selector">' +
                    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                        '<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" fill="none"/>' +
                    '</svg>' +
                '</div>');

                btn.on('hover:enter click', function (e) {
                    e.preventDefault();
                    openMyModal();
                });

                head.prepend(btn);
            }
        }

        // 5. События
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
