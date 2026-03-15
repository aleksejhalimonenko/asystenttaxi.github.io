(function () {
    'use strict';

    // Настройки плагина
    var SETTINGS = {
        city: Lampa.Storage.get('weather_city', 'Moscow'),
        units: Lampa.Storage.get('weather_units', 'metric'), // metric или imperial
        apiKey: 'bd5e378503939ddaee76f12ad7a97608', // Публичный демо-ключ OpenWeatherMap
        updateInterval: 30 * 60 * 1000, // 30 минут
        enabled: Lampa.Storage.get('weather_enabled', true)
    };

    // Состояние
    var weatherData = null;
    var weatherElement = null;
    var updateTimer = null;
    var isInitialized = false;

    // Локализация
    Lampa.Lang.add({
        weather_settings: {
            en: 'Weather',
            ru: 'Погода',
            uk: 'Погода',
            be: 'Надвор\'е'
        },
        weather_city: {
            en: 'City',
            ru: 'Город',
            uk: 'Місто',
            be: 'Горад'
        },
        weather_units: {
            en: 'Units',
            ru: 'Единицы',
            uk: 'Одиниці',
            be: 'Адзінкі'
        },
        weather_units_metric: {
            en: 'Celsius',
            ru: 'Цельсий',
            uk: 'Цельсій',
            be: 'Цэльсій'
        },
        weather_units_imperial: {
            en: 'Fahrenheit',
            ru: 'Фаренгейт',
            uk: 'Фаренгейт',
            be: 'Фарэнгейт'
        },
        weather_enabled: {
            en: 'Show weather',
            ru: 'Показывать погоду',
            uk: 'Показувати погоду',
            be: 'Паказваць надвор\'е'
        },
        weather_update: {
            en: 'Update now',
            ru: 'Обновить сейчас',
            uk: 'Оновити зараз',
            be: 'Абнавіць зараз'
        },
        weather_feels_like: {
            en: 'Feels like',
            ru: 'Ощущается как',
            uk: 'Відчувається як',
            be: 'Адчуваецца як'
        },
        weather_humidity: {
            en: 'Humidity',
            ru: 'Влажность',
            uk: 'Вологість',
            be: 'Вільготнасць'
        },
        weather_wind: {
            en: 'Wind',
            ru: 'Ветер',
            uk: 'Вітер',
            be: 'Вецер'
        },
        weather_pressure: {
            en: 'Pressure',
            ru: 'Давление',
            uk: 'Тиск',
            be: 'Ціск'
        }
    });

    // Функция для получения иконки погоды
    function getWeatherIcon(iconCode) {
        return 'https://openweathermap.org/img/wn/' + iconCode + '@2x.png';
    }

    // Функция для получения направления ветра
    function getWindDirection(deg) {
        var directions = ['⬆️ С', '↗️ СВ', '➡️ В', '↘️ ЮВ', '⬇️ Ю', '↙️ ЮЗ', '⬅️ З', '↖️ СЗ'];
        var index = Math.round(deg / 45) % 8;
        return directions[index];
    }

    // Функция для перевода скорости ветра
    function getWindSpeed(speed, units) {
        if (units === 'metric') {
            return speed.toFixed(1) + ' м/с';
        } else {
            return speed.toFixed(1) + ' mph';
        }
    }

    // Функция для получения данных о погоде
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
                Lampa.Storage.set('weather_last_data', response);
                if (callback) callback(response);
                updateWeatherDisplay();
            } else {
                console.error('[Weather] Invalid API response');
                if (callback) callback(null);
            }
        }, function(error) {
            console.error('[Weather] Fetch error:', error);
            // Пробуем загрузить последние сохраненные данные
            var lastData = Lampa.Storage.get('weather_last_data');
            if (lastData && typeof lastData === 'object') {
                weatherData = lastData;
                updateWeatherDisplay();
            }
            if (callback) callback(null);
        });
    }

    // Создание элемента погоды
    function createWeatherElement() {
        var element = $(
            '<div class="weather-button selector" style="' +
                'display: inline-block;' +
                'margin-right: 15px;' +
                'cursor: pointer;' +
                'vertical-align: middle;' +
            '">' +
                '<div style="display: flex; align-items: center; gap: 5px;">' +
                    '<div class="weather-icon" style="width: 24px; height: 24px;"></div>' +
                    '<span class="weather-temp" style="font-size: 1.1em;">--°</span>' +
                '</div>' +
            '</div>'
        );

        // Обработчик клика
        element.on('hover:enter', function() {
            showWeatherDetails();
        });

        return element;
    }

    // Обновление отображения погоды
    function updateWeatherDisplay() {
        if (!weatherElement || !weatherData || !weatherData.main) return;

        var temp = Math.round(weatherData.main.temp);
        var unit = SETTINGS.units === 'metric' ? '°C' : '°F';
        var iconCode = weatherData.weather[0].icon;

        weatherElement.find('.weather-temp').text(temp + unit);
        
        var iconElement = weatherElement.find('.weather-icon');
        iconElement.css({
            'background-image': 'url(' + getWeatherIcon(iconCode) + ')',
            'background-size': 'contain',
            'background-position': 'center',
            'background-repeat': 'no-repeat'
        });
    }

    // Показ детальной информации
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
                        '<div style="opacity: 0.7;">' + Lampa.Lang.translate('weather_feels_like') + '</div>' +
                    '</div>' +
                    '<div>' +
                        '<div style="font-size: 1.3em; font-weight: bold;">' + 
                            weatherData.main.humidity + '%' + 
                        '</div>' +
                        '<div style="opacity: 0.7;">' + Lampa.Lang.translate('weather_humidity') + '</div>' +
                    '</div>' +
                    '<div>' +
                        '<div style="font-size: 1.3em; font-weight: bold;">' + 
                            getWindSpeed(weatherData.wind.speed, SETTINGS.units) + 
                        '</div>' +
                        '<div style="opacity: 0.7;">' + 
                            Lampa.Lang.translate('weather_wind') + ' ' + 
                            getWindDirection(weatherData.wind.deg || 0) + 
                        '</div>' +
                    '</div>' +
                    '<div>' +
                        '<div style="font-size: 1.3em; font-weight: bold;">' + 
                            weatherData.main.pressure + ' гПа' + 
                        '</div>' +
                        '<div style="opacity: 0.7;">' + Lampa.Lang.translate('weather_pressure') + '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="margin-top: 15px; font-size: 0.9em; opacity: 0.6;">' +
                    weatherData.name + ', ' + weatherData.sys.country +
                '</div>' +
            '</div>';

        var currentController = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: Lampa.Lang.translate('weather_settings') + ' - ' + weatherData.name,
            items: [{
                title: html,
                disabled: true
            }],
            onBack: function() {
                Lampa.Controller.toggle(currentController);
            }
        });
    }

    // Добавление погоды в шапку
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

        // Удаляем старый элемент если есть
        if (weatherElement) {
            weatherElement.remove();
        }

        weatherElement = createWeatherElement();
        header.prepend(weatherElement);

        // Загружаем данные
        var lastData = Lampa.Storage.get('weather_last_data');
        if (lastData && typeof lastData === 'object') {
            weatherData = lastData;
            updateWeatherDisplay();
        }
        
        fetchWeather();
    }

    // Добавление настроек
    function addSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'weather',
            name: Lampa.Lang.translate('weather_settings'),
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12Z" fill="currentColor"/><path d="M12 2L12 5M12 19L12 22M22 12L19 12M5 12L2 12M19.07 4.93L16.95 7.05M7.05 16.95L4.93 19.07M19.07 19.07L16.95 16.95M7.05 7.05L4.93 4.93" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
            after: 'interface'
        });

        Lampa.SettingsApi.addParam({
            component: 'weather',
            param: {
                name: 'weather_enabled',
                type: 'trigger',
                default: SETTINGS.enabled
            },
            field: {
                name: Lampa.Lang.translate('weather_enabled')
            },
            onChange: function(value) {
                SETTINGS.enabled = value === 'true';
                Lampa.Storage.set('weather_enabled', SETTINGS.enabled);
                addWeatherToHeader();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weather',
            param: {
                name: 'weather_city',
                type: 'input',
                default: SETTINGS.city,
                placeholder: 'Moscow, London, New York'
            },
            field: {
                name: Lampa.Lang.translate('weather_city')
            },
            onChange: function(value) {
                SETTINGS.city = value || 'Moscow';
                Lampa.Storage.set('weather_city', SETTINGS.city);
                fetchWeather();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weather',
            param: {
                name: 'weather_units',
                type: 'select',
                values: {
                    'metric': Lampa.Lang.translate('weather_units_metric'),
                    'imperial': Lampa.Lang.translate('weather_units_imperial')
                },
                default: SETTINGS.units
            },
            field: {
                name: Lampa.Lang.translate('weather_units')
            },
            onChange: function(value) {
                SETTINGS.units = value;
                Lampa.Storage.set('weather_units', SETTINGS.units);
                fetchWeather();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weather',
            param: {
                type: 'button',
                action: 'update'
            },
            field: {
                name: Lampa.Lang.translate('weather_update')
            },
            onChange: function() {
                fetchWeather();
                Lampa.Notify.show('Обновление погоды...');
            }
        });
    }

    // Добавление стилей
    function addStyles() {
        var style = document.createElement('style');
        style.type = 'text/css';
        style.textContent = 
            '.weather-button {' +
                'padding: 6px 10px;' +
                'border-radius: 20px;' +
                'background: rgba(255, 255, 255, 0.1);' +
                'transition: all 0.2s;' +
            '}' +
            '.weather-button.focus {' +
                'background: rgba(255, 255, 255, 0.25);' +
                'transform: scale(1.05);' +
            '}' +
            '.weather-button .weather-icon {' +
                'width: 24px;' +
                'height: 24px;' +
                'background-size: contain;' +
                'background-position: center;' +
                'background-repeat: no-repeat;' +
            '}';
        document.head.appendChild(style);
    }

    // Инициализация
    function init() {
        if (isInitialized) return;
        isInitialized = true;

        addStyles();
        addSettings();

        // Ждем появления шапки
        var checkHeader = setInterval(function() {
            if ($('.header').length) {
                clearInterval(checkHeader);
                addWeatherToHeader();
                
                // Запускаем автообновление
                if (updateTimer) clearInterval(updateTimer);
                updateTimer = setInterval(fetchWeather, SETTINGS.updateInterval);
            }
        }, 1000);

        // Слушаем события приложения
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') {
                // Обновляем при возвращении на главную
                setTimeout(addWeatherToHeader, 1000);
            }
        });

        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite') {
                // Проверяем, не пропала ли погода после открытия фильма
                if (!weatherElement || !weatherElement.parent().length) {
                    setTimeout(addWeatherToHeader, 500);
                }
            }
        });
    }

    // Старт плагина
    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') init();
        });
    }

})();