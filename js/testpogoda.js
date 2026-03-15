(function () {
    'use strict';

    // Уникальное имя для настроек, чтобы избежать конфликтов
    var STORAGE_PREFIX = 'weather_plugin_';

    // Настройки плагина
    var SETTINGS = {
        city: Lampa.Storage.get(STORAGE_PREFIX + 'city', 'Moscow'),
        units: Lampa.Storage.get(STORAGE_PREFIX + 'units', 'metric'),
        apiKey: 'bd5e378503939ddaee76f12ad7a97608',
        updateInterval: 30 * 60 * 1000,
        enabled: Lampa.Storage.get(STORAGE_PREFIX + 'enabled', true) === true
    };

    // Состояние
    var weatherData = null;
    var weatherElement = null;
    var updateTimer = null;
    var isInitialized = false;

    // Локализация
    Lampa.Lang.add({
        weather_plugin_name: {
            en: 'Weather',
            ru: 'Погода',
            uk: 'Погода',
            be: 'Надвор\'е'
        },
        weather_plugin_settings: {
            en: 'Weather settings',
            ru: 'Настройки погоды',
            uk: 'Налаштування погоди',
            be: 'Налады надвор\'я'
        },
        weather_plugin_city: {
            en: 'City',
            ru: 'Город',
            uk: 'Місто',
            be: 'Горад'
        },
        weather_plugin_units: {
            en: 'Units',
            ru: 'Единицы',
            uk: 'Одиниці',
            be: 'Адзінкі'
        },
        weather_plugin_units_metric: {
            en: 'Celsius',
            ru: 'Цельсий',
            uk: 'Цельсій',
            be: 'Цэльсій'
        },
        weather_plugin_units_imperial: {
            en: 'Fahrenheit',
            ru: 'Фаренгейт',
            uk: 'Фаренгейт',
            be: 'Фарэнгейт'
        },
        weather_plugin_enabled: {
            en: 'Show weather',
            ru: 'Показывать погоду',
            uk: 'Показувати погоду',
            be: 'Паказваць надвор\'е'
        },
        weather_plugin_update: {
            en: 'Update now',
            ru: 'Обновить сейчас',
            uk: 'Оновити зараз',
            be: 'Абнавіць зараз'
        }
    });

    function getWeatherIcon(iconCode) {
        return 'https://openweathermap.org/img/wn/' + iconCode + '@2x.png';
    }

    function getWindDirection(deg) {
        var directions = ['⬆️ С', '↗️ СВ', '➡️ В', '↘️ ЮВ', '⬇️ Ю', '↙️ ЮЗ', '⬅️ З', '↖️ СЗ'];
        var index = Math.round(deg / 45) % 8;
        return directions[index];
    }

    function getWindSpeed(speed, units) {
        if (units === 'metric') {
            return speed.toFixed(1) + ' м/с';
        } else {
            return speed.toFixed(1) + ' mph';
        }
    }

    function fetchWeather(callback) {
        if (!SETTINGS.enabled) {
            if (callback) callback(null);
            return;
        }

        var url = 'https://api.openweathermap.org/data/2.5/weather?q=' + 
                  encodeURIComponent(SETTINGS.city) + 
                  '&appid=' + SETTINGS.apiKey + 
                  '&units=' + SETTINGS.units +
                  '&lang=ru';

        var network = new Lampa.Reguest();
        network.timeout(10000);
        
        network.silent(url, function(response) {
            if (response && response.main && response.weather && response.weather[0]) {
                weatherData = response;
                Lampa.Storage.set(STORAGE_PREFIX + 'last_data', response);
                if (callback) callback(response);
                updateWeatherDisplay();
            } else {
                console.error('[Weather] Invalid API response');
                if (callback) callback(null);
            }
        }, function(error) {
            console.error('[Weather] Fetch error:', error);
            var lastData = Lampa.Storage.get(STORAGE_PREFIX + 'last_data');
            if (lastData && typeof lastData === 'object') {
                weatherData = lastData;
                updateWeatherDisplay();
            }
            if (callback) callback(null);
        });
    }

    function createWeatherElement() {
        var element = $(
            '<div class="weather-plugin-button selector" style="' +
                'display: inline-block;' +
                'margin-right: 15px;' +
                'cursor: pointer;' +
                'vertical-align: middle;' +
            '">' +
                '<div style="display: flex; align-items: center; gap: 5px;">' +
                    '<div class="weather-plugin-icon" style="width: 24px; height: 24px;"></div>' +
                    '<span class="weather-plugin-temp" style="font-size: 1.1em;">--°</span>' +
                '</div>' +
            '</div>'
        );

        element.on('hover:enter', function() {
            showWeatherDetails();
        });

        return element;
    }

    function updateWeatherDisplay() {
        if (!weatherElement || !weatherData || !weatherData.main) return;

        var temp = Math.round(weatherData.main.temp);
        var unit = SETTINGS.units === 'metric' ? '°C' : '°F';
        var iconCode = weatherData.weather[0].icon;

        weatherElement.find('.weather-plugin-temp').text(temp + unit);
        
        var iconElement = weatherElement.find('.weather-plugin-icon');
        iconElement.css({
            'background-image': 'url(' + getWeatherIcon(iconCode) + ')',
            'background-size': 'contain',
            'background-position': 'center',
            'background-repeat': 'no-repeat'
        });
    }

    function showWeatherDetails() {
        if (!weatherData || !weatherData.main) {
            Lampa.Notify.show('Загрузка данных о погоде...');
            fetchWeather(function() {
                if (weatherData) showWeatherDetails();
            });
            return;
        }

        var unit = SETTINGS.units === 'metric' ? '°C' : '°F';
        var speedUnit = SETTINGS.units === 'metric' ? 'м/с' : 'mph';
        var weather = weatherData.weather[0];
        var icon = getWeatherIcon(weather.icon);

        var html = 
            '<div style="text-align: center; padding: 10px;">' +
                '<div style="margin-bottom: 15px;">' +
                    '<img src="' + icon + '" style="width: 80px; height: 80px;">' +
                '</div>' +
                '<div style="font-size: 2.5em; font-weight: bold; margin-bottom: 5px;">' +
                    Math.round(weatherData.main.temp) + unit +
                '</div>' +
                '<div style="font-size: 1.2em; margin-bottom: 15px; opacity: 0.8;">' +
                    weather.description.charAt(0).toUpperCase() + weather.description.slice(1) +
                '</div>' +
                '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">' +
                    '<div>' +
                        '<div style="font-size: 1.3em; font-weight: bold;">' + 
                            Math.round(weatherData.main.feels_like) + unit + 
                        '</div>' +
                        '<div style="opacity: 0.7;">Ощущается как</div>' +
                    '</div>' +
                    '<div>' +
                        '<div style="font-size: 1.3em; font-weight: bold;">' + 
                            weatherData.main.humidity + '%' + 
                        '</div>' +
                        '<div style="opacity: 0.7;">Влажность</div>' +
                    '</div>' +
                    '<div>' +
                        '<div style="font-size: 1.3em; font-weight: bold;">' + 
                            getWindSpeed(weatherData.wind.speed, SETTINGS.units) + 
                        '</div>' +
                        '<div style="opacity: 0.7;">Ветер ' + 
                            getWindDirection(weatherData.wind.deg || 0) + 
                        '</div>' +
                    '</div>' +
                    '<div>' +
                        '<div style="font-size: 1.3em; font-weight: bold;">' + 
                            weatherData.main.pressure + ' гПа' + 
                        '</div>' +
                        '<div style="opacity: 0.7;">Давление</div>' +
                    '</div>' +
                '</div>' +
                '<div style="margin-top: 15px; font-size: 0.9em; opacity: 0.6;">' +
                    weatherData.name + ', ' + weatherData.sys.country +
                '</div>' +
            '</div>';

        var currentController = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: 'Погода - ' + weatherData.name,
            items: [{
                title: html,
                disabled: true
            }],
            onBack: function() {
                Lampa.Controller.toggle(currentController);
            }
        });
    }

    function addWeatherToHeader() {
        if (!SETTINGS.enabled) {
            if (weatherElement) {
                weatherElement.remove();
                weatherElement = null;
            }
            return;
        }

        var header = $('.header .header__right');
        if (!header.length) return;

        if (weatherElement) {
            weatherElement.remove();
        }

        weatherElement = createWeatherElement();
        header.prepend(weatherElement);

        var lastData = Lampa.Storage.get(STORAGE_PREFIX + 'last_data');
        if (lastData && typeof lastData === 'object') {
            weatherData = lastData;
            updateWeatherDisplay();
        }
        
        fetchWeather();
    }

    function addSettings() {
        // Добавляем пункт в меню настроек
        Lampa.SettingsApi.addComponent({
            component: 'weather_plugin',
            name: Lampa.Lang.translate('weather_plugin_name'),
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12Z" fill="currentColor"/><path d="M12 2L12 5M12 19L12 22M22 12L19 12M5 12L2 12M19.07 4.93L16.95 7.05M7.05 16.95L4.93 19.07M19.07 19.07L16.95 16.95M7.05 7.05L4.93 4.93" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
            after: 'interface'
        });

        // Настройки
        Lampa.SettingsApi.addParam({
            component: 'weather_plugin',
            param: {
                name: STORAGE_PREFIX + 'enabled',
                type: 'trigger',
                default: SETTINGS.enabled
            },
            field: {
                name: Lampa.Lang.translate('weather_plugin_enabled')
            },
            onChange: function(value) {
                SETTINGS.enabled = value === 'true';
                Lampa.Storage.set(STORAGE_PREFIX + 'enabled', SETTINGS.enabled);
                addWeatherToHeader();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weather_plugin',
            param: {
                name: STORAGE_PREFIX + 'city',
                type: 'input',
                default: SETTINGS.city,
                placeholder: 'Moscow'
            },
            field: {
                name: Lampa.Lang.translate('weather_plugin_city')
            },
            onChange: function(value) {
                SETTINGS.city = value || 'Moscow';
                Lampa.Storage.set(STORAGE_PREFIX + 'city', SETTINGS.city);
                fetchWeather();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weather_plugin',
            param: {
                name: STORAGE_PREFIX + 'units',
                type: 'select',
                values: {
                    'metric': Lampa.Lang.translate('weather_plugin_units_metric'),
                    'imperial': Lampa.Lang.translate('weather_plugin_units_imperial')
                },
                default: SETTINGS.units
            },
            field: {
                name: Lampa.Lang.translate('weather_plugin_units')
            },
            onChange: function(value) {
                SETTINGS.units = value;
                Lampa.Storage.set(STORAGE_PREFIX + 'units', SETTINGS.units);
                fetchWeather();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weather_plugin',
            param: {
                type: 'button',
                action: 'update'
            },
            field: {
                name: Lampa.Lang.translate('weather_plugin_update')
            },
            onChange: function() {
                fetchWeather();
                Lampa.Notify.show('Обновление погоды...');
            }
        });
    }

    function addStyles() {
        var style = document.createElement('style');
        style.type = 'text/css';
        style.textContent = 
            '.weather-plugin-button {' +
                'padding: 6px 10px;' +
                'border-radius: 20px;' +
                'background: rgba(255, 255, 255, 0.1);' +
                'transition: all 0.2s;' +
            '}' +
            '.weather-plugin-button.focus {' +
                'background: rgba(255, 255, 255, 0.25);' +
                'transform: scale(1.05);' +
            '}' +
            '.weather-plugin-button .weather-plugin-icon {' +
                'width: 24px;' +
                'height: 24px;' +
                'background-size: contain;' +
                'background-position: center;' +
                'background-repeat: no-repeat;' +
            '}';
        document.head.appendChild(style);
    }

    function init() {
        if (isInitialized) return;
        isInitialized = true;

        addStyles();
        addSettings();

        var checkHeader = setInterval(function() {
            if ($('.header').length) {
                clearInterval(checkHeader);
                addWeatherToHeader();
                
                if (updateTimer) clearInterval(updateTimer);
                updateTimer = setInterval(fetchWeather, SETTINGS.updateInterval);
            }
        }, 1000);

        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite') {
                setTimeout(addWeatherToHeader, 500);
            }
        });
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') init();
        });
    }

})();
