(function () {
    'use strict';

    function startPlugin() {
        // Стили для окна и прелоадера
        var style = `
            <style id="stub-net-styles">
                .stub-net-modal { padding: 20px; text-align: center; }
                .stub-net-ip { 
                    font-family: monospace; 
                    background: rgba(255,255,255,0.1); 
                    padding: 10px; 
                    border-radius: 5px; 
                    color: var(--main-color);
                    margin: 15px 0;
                    font-size: 1.2rem;
                }
                .stub-net-loader { animation: stub-rotate 1s linear infinite; }
                @keyframes stub-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            </style>
        `;
        if (!$('#stub-net-styles').length) $('head').append(style);

        // Функция запроса данных
        function getMyIp(callback) {
            var network = new Lampa.Reguest();
            // Используем публичное API для получения IP
            network.silent('https://api.ipify.org?format=json', function (data) {
                callback(data.ip);
            }, function () {
                callback('Ошибка сети');
            });
        }

        function showModal() {
            // Сначала показываем окно с загрузкой
            var html = $(`
                <div class="stub-net-modal">
                    <h2 style="margin-bottom: 15px;">Сетевой запрос</h2>
                    <div class="stub-net-info">
                        <p>Определяем ваш IP...</p>
                        <div class="stub-net-loader" style="margin-top: 10px;">⌛</div>
                    </div>
                    <div class="navigation-tabs__item selector stub-close" style="margin-top: 20px; width: 100%; justify-content: center; display: none;">
                        <span>Закрыть</span>
                    </div>
                </div>
            `);

            Lampa.Modal.open({
                title: 'Инфо',
                html: html,
                size: 'small',
                onBack: () => {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                }
            });

            // Делаем запрос
            getMyIp(function (ip) {
                html.find('.stub-net-info').html(`
                    <p>Ваш внешний IP адрес:</p>
                    <div class="stub-net-ip">${ip}</div>
                `);
                html.find('.stub-close').show(); // Показываем кнопку закрытия после ответа
                
                // Переинициализируем контроллер, чтобы кнопка стала доступна
                Lampa.Controller.add('stub_net_modal', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(html);
                    },
                    back: () => {
                        Lampa.Modal.close();
                        Lampa.Controller.toggle('content');
                    }
                });
                Lampa.Controller.toggle('stub_net_modal');
            });

            html.find('.stub-close').on('hover:enter click', function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle('content');
            });
        }

        function renderButton() {
            if ($('.stub-net-button').length > 0) return;
            var head = $('.head__actions');
            if (head.length) {
                var btn = $(`
                    <div class="head__action stub-net-button selector">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L12 12M12 12L16 16M12 12L8 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </div>
                `);
                btn.on('hover:enter click', function (e) {
                    e.preventDefault();
                    showModal();
                });
                head.prepend(btn);
            }
        }

        Lampa.Listener.follow('app', (e) => { if (e.type === 'ready' || e.type === 'full:complite') renderButton(); });
        Lampa.Listener.follow('layout', (e) => { if (e.type === 'complete') renderButton(); });
        renderButton();
    }

    if (window.Lampa) startPlugin();
    else {
        var timer = setInterval(() => { if (window.Lampa) { clearInterval(timer); startPlugin(); } }, 100);
    }
})();
