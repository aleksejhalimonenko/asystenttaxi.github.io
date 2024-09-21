document.addEventListener('DOMContentLoaded', function() {
  // Инициализация компонентов Materialize
  const elems = document.querySelectorAll('select');
  M.FormSelect.init(elems);

  const modals = document.querySelectorAll('.modal');
  M.Modal.init(modals);

  // FAB кнопка вызывает модальное окно для штрихкода
  document.getElementById('fabButton').addEventListener('click', function() {
    const modal = M.Modal.getInstance(document.getElementById('barcodeModal'));
    modal.open();
  });

  // Навигация между шагами формы
  let currentStep = 0;
  showStep(currentStep);

  function showStep(n) {
    const steps = document.getElementsByClassName('form-step');
    steps[n].classList.add('active');

    document.getElementById('prevBtn').disabled = n === 0;
    document.getElementById('nextBtn').innerText = n === (steps.length - 1) ? 'Отправить' : 'Далее';
  }

  document.getElementById('nextBtn').addEventListener('click', function() {
    nextPrev(1);
  });

  document.getElementById('prevBtn').addEventListener('click', function() {
    nextPrev(-1);
  });

  function nextPrev(n) {
    const steps = document.getElementsByClassName('form-step');
    steps[currentStep].classList.remove('active');
    currentStep += n;

    if (currentStep >= steps.length) {
      document.getElementById('fuelForm').submit();
      return false;
    }

    showStep(currentStep);
  }
});
