(function () {
    'use strict';

    function startPlugin() {
        // 1. Стили для окна, прелоадера и курсора (Раздел 1.3 и 7.6)
        var style = `
            <style id="stub-net-styles">
                .stub-net-modal { padding: 20px; text-align: center; }
                .stub-net-ip { 
                    font-family: monospace; 
                    background: rgba(255,255,255,0.1); 
                    padding: 12px; 
                    border-radius: 8px; 
                    color: var(--main-color);
                    margin: 15px 0;
                    font-size: 1.3rem;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .stub-close { cursor: pointer !important; }
                .stub-net-loader { 
                    display: inline-block;
                    animation: stub-rotate 1s linear infinite; 
                    font-size: 2rem;
                    margin-top: 10px;
                }
                @keyframes stub-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            </style>
        `;
        if (!$('#stub-net-styles').length) $('head').append(style);

        // 2. Функция запроса данных через Lampa.Reguest (Раздел 4.3)
        function getMyIp(callback) {
            var network = new Lampa.Reguest();
            network.silent('https://api.ipify.org?format=json', function (data) {
                callback(data.ip);
            }, function () {
                callback('Ошибка сети');
            });
        }

        // 3. Основная функция модального окна
        function showModal() {
            var html = $(`
                <div class="stub-net-modal">
                    <h2 style="margin-bottom: 15px; color: var(--white);">Сетевой запрос</h2>
                    <div class="stub-net-info">
                        <p style="opacity: 0.6;">Определяем ваш IP...</p>
                        <div class="stub-net-loader">⌛</div>
                    </div>
                    <div class="navigation-tabs__item selector stub-close" style="margin-top: 25px; width: 100%; justify-content: center; display: none;">
                        <span>Закрыть окно</span>
                    </div>
                </div>
            `);

            // Открываем окно (Раздел 7.2)
            Lampa.Modal.open({
                title: 'Информация об IP',
                html: html,
                size: 'small',
                onBack: () => {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                }
            });

            // Выполняем асинхронный запрос
            getMyIp(function (ip) {
                // Обновляем содержимое
                html.find('.stub-net-info').html(`
                    <p style="opacity: 0.8; margin-bottom: 5px;">Ваш внешний IP адрес:</p>
                    <div class="stub-net-ip">${ip}</div>
                `);
                
                var closeBtn = html.find('.stub-close');
                closeBtn.show(); 

                // ВАЖНО: Вешаем события только ПОСЛЕ появления кнопки в DOM
                closeBtn.on('click hover:enter', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                });
                
                // Регистрируем навигацию для пульта (Раздел 7.1)
                Lampa.Controller.add('stub_net_modal', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(html);
                        // render() не вызываем, так как в твоей версии это приводит к ошибке
                    },
                    back: () => {
                        Lampa.Modal.close();
                        Lampa.Controller.toggle('content');
                    }
                });
                
                // Активируем управление
                Lampa.Controller.toggle('stub_net_modal');
            });
        }

        // 4. Отрисовка кнопки в шапке
        function renderButton() {
            if ($('.stub-net-button').length > 0) return;
            var head = $('.head__actions');
            if (head.length) {
                var btn = $(`
                    <div class="head__action stub-net-button selector" title="Проверить IP">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L12 12M12 12L16 16M12 12L8 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </div>
                `);
                
                btn.on('click hover:enter', function (e) {
                    e.preventDefault();
                    showModal();
                });
                
                head.prepend(btn);
            }
        }

        // 5. Жизненный цикл плагина
        Lampa.Listener.follow('app', (e) => { 
            if (e.type === 'ready' || e.type === 'full:complite') renderButton(); 
        });
        Lampa.Listener.follow('layout', (e) => { 
            if (e.type === 'complete') renderButton(); 
        });

        renderButton();
    }

    // Запуск инициализации (Раздел 1.1)
    if (window.Lampa) {
        startPlugin();
    } else {
        var timer = setInterval(() => { 
            if (window.Lampa) { 
                clearInterval(timer); 
                startPlugin(); 
            } 
        }, 100);
    }
})();
