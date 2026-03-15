(function () {
    'use strict';

    // Простая заглушка - просто показывает, что плагин работает
    var pluginEnabled = true;
    var pluginElement = null;

    // Добавляем локализацию (на всякий случай)
    Lampa.Lang.add({
        plugin_demo: {
            en: 'Plugin Demo',
            ru: 'Демо плагина',
            uk: 'Демо плагіна',
            be: 'Дэма плагіна'
        },
        plugin_working: {
            en: 'Plugin is working!',
            ru: 'Плагин работает!',
            uk: 'Плагін працює!',
            be: 'Плагін працуе!'
        }
    });

    // Создаем элемент-заглушку
    function createDemoElement() {
        var element = $(
            '<div class="demo-plugin-button selector" style="' +
                'display: inline-block;' +
                'margin-right: 15px;' +
                'cursor: pointer;' +
                'vertical-align: middle;' +
                'padding: 6px 10px;' +
                'border-radius: 20px;' +
                'background: rgba(255, 255, 255, 0.1);' +
            '">' +
                '<div style="display: flex; align-items: center; gap: 5px;">' +
                    '<span style="font-size: 1.2em;">🔌</span>' +
                    '<span style="font-size: 1em;">Plugin</span>' +
                '</div>' +
            '</div>'
        );

        // Добавляем эффект при наведении
        element.hover(
            function() { $(this).css('background', 'rgba(255, 255, 255, 0.25)'); },
            function() { $(this).css('background', 'rgba(255, 255, 255, 0.1)'); }
        );

        // Обработчик клика
        element.on('hover:enter', function() {
            showDemoMessage();
        });

        return element;
    }

    // Показываем сообщение при клике
    function showDemoMessage() {
        var currentController = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: Lampa.Lang.translate('plugin_demo'),
            items: [{
                title: Lampa.Lang.translate('plugin_working'),
                disabled: true
            }],
            onBack: function() {
                Lampa.Controller.toggle(currentController);
            }
        });
    }

    // Добавляем элемент в шапку
    function addToHeader() {
        if (!pluginEnabled) {
            if (pluginElement) {
                pluginElement.remove();
                pluginElement = null;
            }
            return;
        }

        var header = $('.header .header__right');
        if (!header.length) return;

        // Удаляем старый элемент если есть
        if (pluginElement) {
            pluginElement.remove();
        }

        pluginElement = createDemoElement();
        header.prepend(pluginElement);
        
        console.log('[Demo Plugin] Added to header');
    }

    // Добавляем простые настройки
    function addSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'demo_plugin',
            name: 'Demo Plugin',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><path d="M12 8V12L14 14" stroke="currentColor" stroke-width="2"/></svg>',
            after: 'interface'
        });

        Lampa.SettingsApi.addParam({
            component: 'demo_plugin',
            param: {
                name: 'demo_enabled',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Включить демо-плагин'
            },
            onChange: function(value) {
                pluginEnabled = value === 'true';
                if (pluginEnabled) {
                    addToHeader();
                } else if (pluginElement) {
                    pluginElement.remove();
                    pluginElement = null;
                }
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'demo_plugin',
            param: {
                type: 'button',
                action: 'test'
            },
            field: {
                name: 'Проверить работу'
            },
            onChange: function() {
                showDemoMessage();
            }
        });
    }

    // Добавляем стили
    function addStyles() {
        var style = document.createElement('style');
        style.type = 'text/css';
        style.textContent = 
            '.demo-plugin-button {' +
                'transition: all 0.2s;' +
            '}' +
            '.demo-plugin-button.focus {' +
                'background: rgba(255, 255, 255, 0.25) !important;' +
                'transform: scale(1.05);' +
            '}';
        document.head.appendChild(style);
    }

    // Инициализация
    function init() {
        addStyles();
        addSettings();

        // Ждем появления шапки
        var checkHeader = setInterval(function() {
            if ($('.header').length) {
                clearInterval(checkHeader);
                addToHeader();
            }
        }, 1000);

        // Обновляем при смене активности
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite') {
                setTimeout(addToHeader, 500);
            }
        });

        console.log('[Demo Plugin] Initialized');
    }

    // Старт
    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') init();
        });
    }

})();
