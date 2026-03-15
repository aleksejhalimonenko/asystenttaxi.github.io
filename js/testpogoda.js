(function () {
    'use strict';

    function addButton() {
        // Прямой поиск элемента
        var header = $('.header');
        if (header.length === 0) return false;
        
        // Создаем элемент и вставляем
        var button = $('<div class="selector" style="display:inline-block; float:right; margin-right:15px;">🔌 ТЕСТ</div>');
        header.find('.header__right').prepend(button);
        
        button.on('hover:enter', function() { alert('OK'); });
        return true;
    }

    // Пробуем несколько раз
    var attempts = 0;
    var timer = setInterval(function() {
        attempts++;
        if (addButton() || attempts > 20) {
            clearInterval(timer);
        }
    }, 500);
})();
