(function () {
  var chrome = document.getElementById('site-chrome');
  if (!chrome) return;

  var path = window.location.pathname.replace(/\/$/, '') || '/';

  // Resolve base path for links (handles subpages in subdirectories)
  var depth = 0;
  var cleanPath = path.replace(/\/index\.html$/, '');
  var segments = cleanPath.split('/').filter(Boolean);
  for (var s = 0; s < segments.length; s++) {
    if (segments[s] === 'articles') { depth = segments.length - s; break; }
  }
  var base = depth > 0 ? '../'.repeat(depth) : '';

  // Build nav links HTML
  var navHTML =
    '<nav class="site-topbar__nav" id="topbar-nav">' +
      '<a href="' + base + 'resume.html" class="site-topbar__link">Resume</a>' +
      '<a href="https://scholar.google.com/citations?user=R2AuVGkAAAAJ&hl=de&oi=ao" class="site-topbar__link" target="_blank" rel="noopener">Research</a>' +
      '<a href="https://github.com/gnlcsvn" class="site-topbar__link" target="_blank" rel="noopener">GitHub</a>' +
      '<a href="https://www.linkedin.com/in/gianlucasavino/" class="site-topbar__link" target="_blank" rel="noopener">LinkedIn</a>' +
      '<a href="https://x.com/gnlcsvn" class="site-topbar__link" target="_blank" rel="noopener">X</a>' +
    '</nav>';

  // Build topbar HTML
  var topbarHTML =
    '<div class="site-topbar">' +
      '<div class="site-topbar__left">' +
        '<button class="site-topbar__menu-btn" id="menu-toggle" aria-label="Toggle navigation">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
        '<div class="site-topbar__logo" id="logo-wrap" data-home="' + base + 'index.html">' +
          '<canvas id="logo-canvas"></canvas>' +
        '</div>' +
      '</div>' +
      navHTML +
    '</div>';

  chrome.innerHTML = topbarHTML;

  // Mobile hamburger toggle
  var menuBtn = document.getElementById('menu-toggle');
  var nav = document.getElementById('topbar-nav');

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var isOpen = nav.classList.contains('site-topbar__nav--open');
      if (isOpen) {
        nav.classList.remove('site-topbar__nav--open');
      } else {
        nav.classList.add('site-topbar__nav--open');
      }
    });
  }

  // Close nav on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav) {
      nav.classList.remove('site-topbar__nav--open');
    }
  });
})();
