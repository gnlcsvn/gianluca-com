// Spiegelung: klappt das Bild zu (nur die Spiegelung, aufrecht) und auf (das ganze Bild).
(function () {
  var mirror = document.querySelector('.mirror');
  if (!mirror) { return; }

  var article = mirror.parentNode;
  var buttons = article.querySelectorAll('.mirror__toggle, .mirror__turn');
  var closed = true;
  var i;

  function show() {
    if (closed) { mirror.classList.add('mirror--closed'); }
    else { mirror.classList.remove('mirror--closed'); }
    for (i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', closed ? 'false' : 'true');
    }
  }

  function turn() {
    closed = !closed;
    show();
  }

  // Zuerst ohne Bewegung zuklappen, damit beim Laden nichts dreht.
  mirror.style.transition = 'none';
  mirror.querySelector('.mirror__image').style.transition = 'none';
  show();
  for (i = 0; i < buttons.length; i++) {
    buttons[i].hidden = false;
    buttons[i].addEventListener('click', turn);
  }
  window.setTimeout(function () {
    mirror.style.transition = '';
    mirror.querySelector('.mirror__image').style.transition = '';
  }, 50);
})();
