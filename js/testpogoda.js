(function () {
    'use strict';

    // ⬇️ ВСТАВЬ СЮДА URL своего GAS веб-приложения
    var GAS_URL = 'https://script.google.com/macros/s/AKfycbwbmbhFKSKTcZx1zQZcYYs8xeNKxCZKRqFNpRSrcS4VvEaSyKNfIQtymnFw0YkL-V6L/exec';

    function startPlugin() {

        // ── Стили ──────────────────────────────────────────────────────────
        var style = '<style id="stub-fuel-styles">' +
            '.sfm{padding:16px 12px;min-width:260px}' +
            '.sfm-title{font-size:1rem;opacity:.5;margin-bottom:12px;text-align:center}' +
            '.sfm-block{background:rgba(255,255,255,.07);border-radius:10px;padding:10px 14px;margin-bottom:8px}' +
            '.sfm-block-title{font-size:.75rem;opacity:.45;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em}' +
            '.sfm-row{display:flex;justify-content:space-between;align-items:center;padding:3px 0}' +
            '.sfm-row span:first-child{opacity:.6;font-size:.85rem}' +
            '.sfm-row span:last-child{font-weight:bold;color:var(--main-color)}' +
            '.sfm-big{font-size:1.4rem;font-weight:bold;color:var(--main-color);text-align:center;padding:4px 0}' +
            '.sfm-period{font-size:.75rem;opacity:.4;text-align:center;margin-top:-4px;margin-bottom:6px}' +
            '.sfm-loader{text-align:center;padding:30px 0;font-size:2rem;animation:sfm-spin 1s linear infinite;display:inline-block}' +
            '.sfm-loader-wrap{text-align:center;padding:20px 0}' +
            '.sfm-err{text-align:center;padding:20px;opacity:.5}' +
            '@keyframes sfm-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}' +
            '</style>';
        if (!$('#stub-fuel-styles').length) $('head').append(style);

        // ── Запросы к GAS ──────────────────────────────────────────────────
        function fetchPage(page, callback) {
            var net = new Lampa.Reguest();
            net.timeout(12000);
            net.silent(GAS_URL + '?page=' + page, function (data) {
                callback(null, data);
            }, function () {
                callback('error', null);
            });
        }

        // ── Вспомогательные функции ────────────────────────────────────────
        function parseDate(str) {
            if (!str) return null;
            var parts = String(str).split('.');
            if (parts.length === 3) {
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
            return null;
        }

        function getWeekStart() {
            var d = new Date();
            var day = d.getDay();
            var diff = d.getDate() - day + (day === 0 ? -6 : 1);
            var w = new Date(d);
            w.setDate(diff);
            w.setHours(0, 0, 0, 0);
            return w;
        }

        function getMonthStart() {
            var d = new Date();
            return new Date(d.getFullYear(), d.getMonth(), 1);
        }

        // ── Аналитика по данным топлива ────────────────────────────────────
        function analyzeFuel(fuelData) {
            var result = {
                lastFill:    null,
                week:        { cost: 0, liters: 0, count: 0 },
                month:       { cost: 0, liters: 0, count: 0 },
                avgConsGas:  null,
                avgConsPetrol: null
            };

            if (!Array.isArray(fuelData) || !fuelData.length) return result;

            var weekStart  = getWeekStart();
            var monthStart = getMonthStart();

            // Последняя заправка
            result.lastFill = fuelData[fuelData.length - 1];

            fuelData.forEach(function (entry) {
                var d = parseDate(entry.date);
                if (!d) return;

                var cost   = parseFloat(entry.totalCost)    || 0;
                var liters = parseFloat(entry.fuelAmount)   || 0;

                // За неделю
                if (d >= weekStart) {
                    result.week.cost   += cost;
                    result.week.liters += liters;
                    result.week.count++;
                }

                // За месяц
                if (d >= monthStart) {
                    result.month.cost   += cost;
                    result.month.liters += liters;
                    result.month.count++;
                }
            });

            // Средний расход — последние 5 записей по каждому типу
            var gasEntries = fuelData.filter(function (e) {
                return e.fuelType && e.fuelType.toString().toLowerCase().includes('газ') &&
                       parseFloat(e.fuelConsumption) > 0;
            });
            var petrolEntries = fuelData.filter(function (e) {
                return e.fuelType && !e.fuelType.toString().toLowerCase().includes('газ') &&
                       parseFloat(e.fuelConsumption) > 0;
            });

            if (gasEntries.length) {
                var last = gasEntries.slice(-5);
                var sum = last.reduce(function (s, e) { return s + parseFloat(e.fuelConsumption); }, 0);
                result.avgConsGas = (sum / last.length).toFixed(1);
            }
            if (petrolEntries.length) {
                var last2 = petrolEntries.slice(-5);
                var sum2 = last2.reduce(function (s, e) { return s + parseFloat(e.fuelConsumption); }, 0);
                result.avgConsPetrol = (sum2 / last2.length).toFixed(1);
            }

            result.week.cost   = Math.round(result.week.cost   * 100) / 100;
            result.week.liters = Math.round(result.week.liters * 100) / 100;
            result.month.cost  = Math.round(result.month.cost  * 100) / 100;
            result.month.liters = Math.round(result.month.liters * 100) / 100;

            return result;
        }

        // ── Построение HTML для модалки ────────────────────────────────────
        function buildContent(homeData, fuelAnalysis) {
            var html = '';

            // Блок 1: за неделю
            if (homeData && homeData.hasFuelData) {
                html += '<div class="sfm-block">' +
                    '<div class="sfm-block-title">⛽ Топливо за неделю</div>' +
                    '<div class="sfm-big">' + homeData.weeklyFuelCost + ' zł</div>' +
                    '<div class="sfm-period">' + (homeData.weeklyFuelPeriod || '') + '</div>';
                if (fuelAnalysis && fuelAnalysis.week.liters > 0) {
                    html += '<div class="sfm-row"><span>Заправлено</span><span>' + fuelAnalysis.week.liters + ' л</span></div>';
                    html += '<div class="sfm-row"><span>Заправок</span><span>' + fuelAnalysis.week.count + ' раз</span></div>';
                }
                html += '</div>';
            }

            // Блок 2: за месяц
            if (fuelAnalysis && fuelAnalysis.month.cost > 0) {
                html += '<div class="sfm-block">' +
                    '<div class="sfm-block-title">📅 Текущий месяц</div>' +
                    '<div class="sfm-row"><span>Потрачено</span><span>' + fuelAnalysis.month.cost + ' zł</span></div>' +
                    '<div class="sfm-row"><span>Заправлено</span><span>' + fuelAnalysis.month.liters + ' л</span></div>' +
                    '<div class="sfm-row"><span>Заправок</span><span>' + fuelAnalysis.month.count + ' раз</span></div>' +
                    '</div>';
            }

            // Блок 3: средний расход
            if (fuelAnalysis && (fuelAnalysis.avgConsGas || fuelAnalysis.avgConsPetrol)) {
                html += '<div class="sfm-block">' +
                    '<div class="sfm-block-title">📊 Средний расход (посл. 5 заправок)</div>';
                if (fuelAnalysis.avgConsGas) {
                    html += '<div class="sfm-row"><span>Газ</span><span>' + fuelAnalysis.avgConsGas + ' л/100км</span></div>';
                }
                if (fuelAnalysis.avgConsPetrol) {
                    html += '<div class="sfm-row"><span>Бензин</span><span>' + fuelAnalysis.avgConsPetrol + ' л/100км</span></div>';
                }
                html += '</div>';
            }

            // Блок 4: последняя заправка
            if (fuelAnalysis && fuelAnalysis.lastFill) {
                var lf = fuelAnalysis.lastFill;
                html += '<div class="sfm-block">' +
                    '<div class="sfm-block-title">🕐 Последняя заправка</div>' +
                    '<div class="sfm-row"><span>Дата</span><span>' + (lf.date || '—') + '</span></div>' +
                    '<div class="sfm-row"><span>Тип</span><span>' + (lf.fuelType || '—') + '</span></div>' +
                    '<div class="sfm-row"><span>Объём</span><span>' + (lf.fuelAmount || '—') + ' л</span></div>' +
                    '<div class="sfm-row"><span>Сумма</span><span>' + (lf.totalCost || '—') + ' zł</span></div>';
                if (lf.fuelConsumption > 0) {
                    html += '<div class="sfm-row"><span>Расход</span><span>' + lf.fuelConsumption + ' л/100км</span></div>';
                }
                html += '</div>';
            }

            // Блок 5: общий пробег из home
            if (homeData && homeData.endKm) {
                html += '<div class="sfm-block">' +
                    '<div class="sfm-block-title">🚗 Пробег</div>' +
                    '<div class="sfm-row"><span>Текущий</span><span>' + homeData.endKm + ' км</span></div>';
                if (homeData.distance) {
                    html += '<div class="sfm-row"><span>За период</span><span>' + homeData.distance + ' км</span></div>';
                }
                html += '</div>';
            }

            return html || '<div class="sfm-err">Нет данных</div>';
        }

        // ── Модальное окно ─────────────────────────────────────────────────
        function showModal() {
            var html = $('<div class="sfm">' +
                '<div class="sfm-title">Загружаем данные...</div>' +
                '<div class="sfm-loader-wrap"><span class="sfm-loader">⌛</span></div>' +
                '<div class="navigation-tabs__item selector sfm-close" style="margin-top:16px;width:100%;justify-content:center;display:none">' +
                    '<span>Закрыть</span>' +
                '</div>' +
            '</div>');

            Lampa.Modal.open({
                title: 'Топливо · Auris',
                html: html,
                size: 'medium',
                onBack: function () {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                }
            });

            var homeData = null;
            var fuelData = null;
            var pending  = 2;

            function tryRender() {
                pending--;
                if (pending > 0) return;

                // Оба запроса завершены
                var analysis = fuelData ? analyzeFuel(fuelData) : null;
                var content  = buildContent(homeData, analysis);

                html.find('.sfm-title').remove();
                html.find('.sfm-loader-wrap').replaceWith('<div>' + content + '</div>');

                var closeBtn = html.find('.sfm-close');
                closeBtn.show();
                closeBtn.on('click hover:enter', function () {
                    Lampa.Modal.close();
                    Lampa.Controller.toggle('content');
                });

                Lampa.Controller.add('stub_fuel_modal', {
                    toggle: function () { Lampa.Controller.collectionSet(html); },
                    back: function () {
                        Lampa.Modal.close();
                        Lampa.Controller.toggle('content');
                    }
                });
                Lampa.Controller.toggle('stub_fuel_modal');
            }

            fetchPage('home', function (err, data) {
                if (!err && data) homeData = data;
                tryRender();
            });

            fetchPage('fuel', function (err, data) {
                if (!err && Array.isArray(data)) fuelData = data;
                tryRender();
            });
        }

        // ── Кнопка в шапке ─────────────────────────────────────────────────
function renderButton() {
    if ($('.stub-fuel-button').length > 0) return;
    var head = $('.head__actions');
    if (!head.length) return;
    var btn = $('<div class="head__action stub-fuel-button selector" title="Топливо">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 22V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14"/>' +
        '<path d="M17 12h1a2 2 0 0 1 2 2v1a2 2 0 0 0 4 0V9l-3-3"/>' +
        '<path d="M3 22h18"/><path d="M7 14h4"/><path d="M7 10h4"/>' +
        '</svg>' +
    '</div>');
    btn.on('click hover:enter', function () { showModal(); });
    head.prepend(btn);
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
            if (window.Lampa) { clearInterval(timer); startPlugin(); }
        }, 100);
    }
})();
