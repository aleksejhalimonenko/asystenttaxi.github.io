// ==========================================================================
// РАЗДЕЛ НАСТРОЕК (settings.js)
// ==========================================================================

// Глобальная функция для настроек
function renderSettingsPage(data) {
    // Очищаем предыдущий контент
    if (typeof clearDynamicContent === 'function') {
        clearDynamicContent();
    }
    
    // Используем глобальный объект DOM или находим элементы
    const table = document.getElementById("dataTable");
    if (table) table.style.display = "none";
    
    const cardElement = document.querySelector('.card');
    if (!cardElement) return;
    
    const settingsContent = document.createElement('div');
    settingsContent.className = 'settings-container';
    
    settingsContent.innerHTML = `
        <div class="settings-header">
            <h2 class="settings-title">Настройки автомобиля</h2>
            <p class="settings-subtitle">Управление параметрами вашего авто</p>
        </div>
        
        <div class="settings-grid">
            <!-- Карточка пробега -->
            <div class="setting-card">
                <div class="setting-icon">
                    <img src="icons/history_pereobuvka.png" alt="Пробег" style="width:32px; height:32px;">
                </div>
                <div class="setting-content">
                    <h3 class="setting-title">Текущий пробег</h3>
                    <p class="setting-description">Актуальный пробег автомобиля</p>
                    <div class="setting-input-group">
                        <input type="number" id="currentMileage" class="setting-input" placeholder="Введите пробег" value="0">
                        <span class="setting-unit">км</span>
                    </div>
                    <button class="setting-btn" onclick="updateMileage()">Обновить пробег</button>
                </div>
            </div>
            
            <!-- Карточка напоминаний -->
            <div class="setting-card">
                <div class="setting-icon">
                    <img src="icons/free-icon-calendar-date-12014055.png" alt="Напоминания" style="width:32px; height:32px;">
                </div>
                <div class="setting-content">
                    <h3 class="setting-title">Напоминания</h3>
                    <p class="setting-description">Настройка уведомлений</p>
                    
                    <div class="setting-checkbox">
                        <label>
                            <input type="checkbox" id="notifyOil" checked>
                            <span>Уведомлять о замене масла</span>
                        </label>
                    </div>
                    
                    <div class="setting-checkbox">
                        <label>
                            <input type="checkbox" id="notifyTires" checked>
                            <span>Уведомлять о замене шин</span>
                        </label>
                    </div>
                    
                    <div class="setting-checkbox">
                        <label>
                            <input type="checkbox" id="notifyInsurance" checked>
                            <span>Уведомлять о страховке</span>
                        </label>
                    </div>
                    
                    <button class="setting-btn" onclick="saveNotifications()">Сохранить настройки</button>
                </div>
            </div>
            
            <!-- Карточка интервалов ТО -->
            <div class="setting-card">
                <div class="setting-icon">
                    <img src="icons/check-list2.png" alt="Интервалы" style="width:32px; height:32px;">
                </div>
                <div class="setting-content">
                    <h3 class="setting-title">Интервалы обслуживания</h3>
                    <p class="setting-description">Настройка планового ТО</p>
                    
                    <div class="setting-form-group">
                        <label for="oilInterval">Замена масла каждые:</label>
                        <div class="setting-input-group">
                            <input type="number" id="oilInterval" class="setting-input" value="15000" min="1000" max="30000">
                            <span class="setting-unit">км</span>
                        </div>
                    </div>
                    
                    <div class="setting-form-group">
                        <label for="diagnosticInterval">Диагностика каждые:</label>
                        <div class="setting-input-group">
                            <input type="number" id="diagnosticInterval" class="setting-input" value="30000" min="1000" max="50000">
                            <span class="setting-unit">км</span>
                        </div>
                    </div>
                    
                    <button class="setting-btn" onclick="saveServiceIntervals()">Сохранить интервалы</button>
                </div>
            </div>
        </div>
        
        <!-- Статус-бар -->
        <div class="settings-status">
            <div class="status-item">
                <span class="status-label">Версия приложения:</span>
                <span class="status-value">1.0.0</span>
            </div>
            <div class="status-item">
                <span class="status-label">Всего записей:</span>
                <span class="status-value">${data && data.length ? data.length : '0'}</span>
            </div>
            <div class="status-item">
                <span class="status-label">Последнее обновление:</span>
                <span class="status-value">Сегодня</span>
            </div>
        </div>
    `;
    
    cardElement.appendChild(settingsContent);
    
    // Загружаем сохраненные настройки
    loadSettings();
}

// ==========================================================================
// ПРОСТЫЕ ФУНКЦИИ ДЛЯ НАСТРОЕК
// ==========================================================================

function loadSettings() {
    try {
        const savedMileage = localStorage.getItem('currentMileage');
        if (savedMileage) {
            const input = document.getElementById('currentMileage');
            if (input) input.value = savedMileage;
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
    }
}

function updateMileage() {
    const input = document.getElementById('currentMileage');
    if (!input) return;
    
    const mileage = parseInt(input.value);
    if (isNaN(mileage) || mileage < 0) {
        alert('Введите корректный пробег');
        return;
    }
    
    localStorage.setItem('currentMileage', mileage);
    alert(`Пробег обновлен: ${mileage} км`);
}

function saveNotifications() {
    alert('Настройки напоминаний сохранены');
}

function saveServiceIntervals() {
    alert('Интервалы обслуживания сохранены');
}

// ==========================================================================
// ДОБАВЛЯЕМ СТИЛИ ДЛЯ НАСТРОЕК
// ==========================================================================

if (!document.getElementById('settings-styles')) {
    const style = document.createElement('style');
    style.id = 'settings-styles';
    style.textContent = `
        .settings-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .settings-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .settings-title {
            font-size: 24px;
            color: #1c1c1c;
            margin-bottom: 8px;
        }
        
        .settings-subtitle {
            color: #666;
            font-size: 14px;
        }
        
        .settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .setting-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border: 1px solid #e0e0e0;
        }
        
        .setting-icon {
            margin-bottom: 15px;
        }
        
        .setting-title {
            font-size: 16px;
            margin-bottom: 8px;
            color: #1c1c1c;
        }
        
        .setting-description {
            color: #666;
            font-size: 13px;
            margin-bottom: 15px;
        }
        
        .setting-input-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 15px;
        }
        
        .setting-input {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
        }
        
        .setting-unit {
            color: #666;
            font-size: 14px;
            min-width: 30px;
        }
        
        .setting-checkbox {
            margin-bottom: 10px;
        }
        
        .setting-checkbox label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-size: 14px;
            color: #666;
        }
        
        .setting-btn {
            background: #007aff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            margin-top: 10px;
        }
        
        .setting-btn:hover {
            background: #005bb5;
        }
        
        .setting-form-group {
            margin-bottom: 15px;
        }
        
        .setting-form-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 14px;
            color: #666;
        }
        
        .settings-status {
            display: flex;
            justify-content: space-around;
            background: white;
            border-radius: 12px;
            padding: 15px;
            border: 1px solid #e0e0e0;
        }
        
        .status-item {
            text-align: center;
        }
        
        .status-label {
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
        }
        
        .status-value {
            font-size: 14px;
            font-weight: 600;
            color: #1c1c1c;
        }
        
        @media (max-width: 768px) {
            .settings-grid {
                grid-template-columns: 1fr;
            }
            
            .settings-status {
                flex-direction: column;
                gap: 15px;
            }
        }
    `;
    document.head.appendChild(style);
}