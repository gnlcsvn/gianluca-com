(function () {
  var path = window.location.pathname.replace(/\/$/, '') || '/';
  var links = document.querySelectorAll('.site-nav__link');

  links.forEach(function (link) {
    var href = link.getAttribute('href').replace(/\/$/, '') || '/';
    if (href === path) {
      link.setAttribute('aria-current', 'page');
    }
  });
})();
