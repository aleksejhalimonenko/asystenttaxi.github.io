(function () {
    'use strict';

    var pluginManifest = {
        version: '1.0.1',
        author: 'custom',
        name: 'Weather Plugin Fixed'
    };

    var settings = {
        weather_api_key: '',
        weather_city: '',
        weather_units: 'metric',
        weather_show_in_header: true,
        weather_update_interval: 30
    };

    var weatherData = null;
    var updateTimer = null;
    var weatherButton = null;

    var DEFAULT_API_KEY = 'bd5e378503939ddaee76f12ad7a97608'; 
    
    function addLocalization() {
        Lampa.Lang.add({
            weather_plugin_name: { en: 'Weather', uk: 'Погода', ru: 'Погода', ro: 'Vremea' },
            weather_settings: { en: 'Weather settings', uk: 'Налаштування погоди', ru: 'Настройки погоды', ro: 'Setări vreme' },
            weather_api_key: { en: 'API Key (OpenWeatherMap)', uk: 'API ключ (OpenWeatherMap)', ru: 'API ключ (OpenWeatherMap)', ro: 'Cheie API (OpenWeatherMap)' },
            weather_city: { en: 'City', uk: 'Місто', ru: 'Город', ro: 'Oraș' },
            weather_units: { en: 'Units', uk: 'Одиниці', ru: 'Единицы', ro: 'Unități' },
            weather_units_metric: { en: 'Celsius', uk: 'Цельсій', ru: 'Цельсий', ro: 'Celsius' },
            weather_units_imperial: { en: 'Fahrenheit', uk: 'Фаренгейт', ru: 'Фаренгейт', ro: 'Fahrenheit' },
            weather_show_in_header: { en: 'Show in header', uk: 'Показувати в шапці', ru: 'Показывать в шапке', ro: 'Afișează în antet' },
            weather_update_interval: { en: 'Update interval (minutes)', uk: 'Інтервал оновлення (хвилини)', ru: 'Интервал обновления (минуты)', ro: 'Interval actualizare (minute)' },
            weather_refresh: { en: 'Update weather', uk: 'Оновити погоду', ru: 'Обновить погоду', ro: 'Actualizează vremea' },
            weather_feels_like: { en: 'Feels like', uk: 'Відчувається як', ru: 'Ощущается как', ro: 'Se simte ca' },
            weather_humidity: { en: 'Humidity', uk: 'Вологість', ru: 'Влажность', ro: 'Umiditate' },
            weather_wind: { en: 'Wind', uk: 'Вітер', ru: 'Ветер', ro: 'Vânt' },
            weather_pressure: { en: 'Pressure', uk: 'Тиск', ru: 'Давление', ro: 'Presiune' },
            weather_clouds: { en: 'Clouds', uk: 'Хмари', ru: 'Облачность', ro: 'Nori' }
        });
    }

    function getWeatherIcon(iconCode) {
        return 'https://openweathermap.org/img/wn/' + iconCode + '@2x.png';
    }

    function fetchWeather(callback) {
        var apiKey = settings.weather_api_key || DEFAULT_API_KEY;
        var city = settings.weather_city || 'London';
        var units = settings.weather_units || 'metric';
        var url = 'https://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(city) + '&appid=' + apiKey + '&units=' + units;
        
        var network = new Lampa.Reguest();
        network.timeout(10000);
        network.silent(url, function(response) {
            // Добавлена проверка структуры ответа
            if (response && response.main && response.weather && response.weather[0]) {
                weatherData = response;
                if (callback) callback(response);
                updateWeatherDisplay();
            } else {
                console.error('Weather plugin: Invalid API response');
                if (callback) callback(null);
            }
        }, function(error) {
            console.error('Weather plugin error:', error);
            if (callback) callback(null);
        });
    }

    function createWeatherButton() {
        var btn = $('<div class="weather-button selector" style="display: inline-block; margin-right: 15px; cursor: pointer;">' +
            '<div style="display: flex; align-items: center; gap: 5px;">' +
                '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                    '<path d="M6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12Z" fill="currentColor"/>' +
                    '<path d="M12 2L12 5M12 19L12 22M22 12L19 12M5 12L2 12M19.07 4.93L16.95 7.05M7.05 16.95L4.93 19.07M19.07 19.07L16.95 16.95M7.05 7.05L4.93 4.93" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
                '</svg>' +
                '<span class="weather-temp">--°</span>' +
            '</div>' +
        '</div>');

        btn.on('hover:enter', function() {
            showWeatherDetails();
        });

        return btn;
    }

    function updateWeatherDisplay() {
        // Защита от пустых данных
        if (!weatherData || !weatherData.main || !weatherButton) return;
        var temp = Math.round(weatherData.main.temp);
        var unit = settings.weather_units === 'metric' ? '°C' : '°F';
        weatherButton.find('.weather-temp').text(temp + unit);
    }

    function showWeatherDetails() {
        // Проверка данных перед открытием модального окна
        if (!weatherData || !weatherData.main || !weatherData.weather || !weatherData.weather[0]) {
            Lampa.Notify.show('Данные погоды еще не загружены');
            fetchWeather();
            return;
        }

        var unit = settings.weather_units === 'metric' ? '°C' : '°F';
        var speedUnit = settings.weather_units === 'metric' ? 'm/s' : 'mph';
        var pressureUnit = 'hPa';
        var weatherInfo = weatherData.weather[0];
        var icon = getWeatherIcon(weatherInfo.icon);
        
        var details = [
            '<div style="text-align: center; margin-bottom: 20px;">',
                '<img src="' + icon + '" style="width: 100px; height: 100px;">',
                '<h2 style="font-size: 48px; margin: 10px 0;">' + Math.round(weatherData.main.temp) + unit + '</h2>',
                '<h3>' + (weatherInfo.description || '') + '</h3>',
            '</div>',
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">',
                '<div style="text-align: center;">',
                    '<div style="font-size: 20px; font-weight: bold;">' + Math.round(weatherData.main.feels_like) + unit + '</div>',
                    '<div style="opacity: 0.7;">' + Lampa.Lang.translate('weather_feels_like') + '</div>',
                '</div>',
                '<div style="text-align: center;">',
                    '<div style="font-size: 20px; font-weight: bold;">' + weatherData.main.humidity + '%</div>',
                    '<div style="opacity: 0.7;">' + Lampa.Lang.translate('weather_humidity') + '</div>',
                '</div>',
                '<div style="text-align: center;">',
                    '<div style="font-size: 20px; font-weight: bold;">' + (weatherData.wind ? weatherData.wind.speed : 0) + ' ' + speedUnit + '</div>',
                    '<div style="opacity: 0.7;">' + Lampa.Lang.translate('weather_wind') + '</div>',
                '</div>',
                '<div style="text-align: center;">',
                    '<div style="font-size: 20px; font-weight: bold;">' + weatherData.main.pressure + ' ' + pressureUnit + '</div>',
                    '<div style="opacity: 0.7;">' + Lampa.Lang.translate('weather_pressure') + '</div>',
                '</div>',
            '</div>'
        ].join('');

        var current = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: (weatherData.name || 'City') + (weatherData.sys ? ', ' + weatherData.sys.country : ''),
            items: [{ title: details, disabled: true }],
            onBack: function() {
                Lampa.Controller.toggle(current);
            }
        });
    }

    function addToHeader() {
        if (!settings.weather_show_in_header) return;
        var header = $('.header .header__right');
        if (header.length && !$('.weather-button').length) {
            weatherButton = createWeatherButton();
            header.prepend(weatherButton);
            if (weatherData) updateWeatherDisplay();
            else fetchWeather();
        }
    }

    function startAutoUpdate() {
        if (updateTimer) clearInterval(updateTimer);
        var interval = (settings.weather_update_interval || 30) * 60 * 1000;
        updateTimer = setInterval(fetchWeather, interval);
    }

    function addSettings() {
        Lampa.Template.add('settings_weather', '<div></div>');
        Lampa.SettingsApi.addParam({
            component: 'interface',
            param: { type: 'button', component: 'weather' },
            field: { name: Lampa.Lang.translate('weather_settings'), description: 'Настройка отображения погоды' },
            onChange: function() {
                Lampa.Settings.create('weather', {
                    template: 'settings_weather',
                    onBack: function() { Lampa.Settings.create('interface'); }
                });
            }
        });

        var params = [
            { name: 'weather_api_key', type: 'input', default: settings.weather_api_key, label: 'weather_api_key' },
            { name: 'weather_city', type: 'input', default: settings.weather_city, label: 'weather_city' },
            { name: 'weather_units', type: 'select', default: settings.weather_units, label: 'weather_units', values: { 'metric': Lampa.Lang.translate('weather_units_metric'), 'imperial': Lampa.Lang.translate('weather_units_imperial') } }
        ];

        params.forEach(function(p) {
            Lampa.SettingsApi.addParam({
                component: 'weather',
                param: { name: p.name, type: p.type, default: p.default, values: p.values },
                field: { name: Lampa.Lang.translate(p.label) },
                onChange: function(value) {
                    settings[p.name] = (p.type === 'select' && (value === 'true' || value === 'false')) ? value === 'true' : value;
                    Lampa.Storage.set(p.name, value);
                    fetchWeather();
                }
            });
        });
    }

    function initSettings() {
        settings.weather_api_key = Lampa.Storage.get('weather_api_key', '');
        settings.weather_city = Lampa.Storage.get('weather_city', 'London');
        settings.weather_units = Lampa.Storage.get('weather_units', 'metric');
        settings.weather_show_in_header = Lampa.Storage.get('weather_show_in_header', 'true') === 'true';
        settings.weather_update_interval = parseInt(Lampa.Storage.get('weather_update_interval', 30));
    }

    function injectStyles() {
        var style = '.weather-button { padding: 8px 12px; border-radius: 20px; background: rgba(255, 255, 255, 0.1); transition: all 0.2s; margin-top: 5px; } .weather-button.focus { background: rgba(255, 255, 255, 0.25); transform: scale(1.05); }';
        $('<style>').prop('type', 'text/css').html(style).appendTo('head');
    }

    function startPlugin() {
        if (window.weather_plugin_started) return;
        window.weather_plugin_started = true;
        initSettings();
        addLocalization();
        addSettings();
        injectStyles();

        var checkHeader = setInterval(function() {
            if ($('.header').length) {
                clearInterval(checkHeader);
                if (settings.weather_show_in_header) addToHeader();
                startAutoUpdate();
            }
        }, 1000);
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', function(e) { if (e.type === 'ready') startPlugin(); });
})();
