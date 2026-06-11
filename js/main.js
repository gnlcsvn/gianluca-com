(function () {
  var chrome = document.getElementById('site-chrome');
  if (!chrome) { return; }

  var path = window.location.pathname.replace(/\/$/, '') || '/';

  // Resolve base path for links (handles sub-pages in subdirectories).
  // Counts how many directory levels deep the page sits so the back-home
  // link climbs back to the site root — works for any nested content dir
  // such as /articles/<slug>/ or /n/<slug>/.
  var cleanPath = path.replace(/\/index\.html$/, '');
  var segments = cleanPath.split('/').filter(Boolean);
  var depth = segments.length;
  // A trailing file segment (e.g. /resume.html) sits at its parent's level,
  // so it adds no directory depth.
  if (segments.length && segments[segments.length - 1].indexOf('.') !== -1) {
    depth = segments.length - 1;
  }
  var base = depth > 0 ? new Array(depth + 1).join('../') : '';

  // Inject a minimal, quiet back-home header in normal flow (not fixed):
  // a single small link showing the site name. No nav bar, no hamburger,
  // no logo canvas.
  chrome.innerHTML =
    '<header class="site-header">' +
      '<a href="' + base + 'index.html" class="site-header__home">Gian-Luca Savino</a>' +
    '</header>';

  // Open all external http(s) links in a new tab.
  document.addEventListener('click', function (e) {
    var node = e.target;
    var link = null;
    while (node && node.nodeType === 1) {
      if (node.tagName === 'A') { link = node; break; }
      node = node.parentNode;
    }
    if (!link) { return; }
    var href = link.getAttribute('href') || '';
    if (href.indexOf('http') === 0 && !link.hasAttribute('target')) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
    }
  });
})();
