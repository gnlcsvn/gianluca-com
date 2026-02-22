(function () {
  var chrome = document.getElementById('site-chrome');
  if (!chrome) return;

  var path = window.location.pathname.replace(/\/$/, '') || '/';
  var isHome = path === '/' || path.indexOf('index.html') !== -1;

  // Build sidebar HTML
  var sidebarHTML =
    '<aside class="site-sidebar" id="site-sidebar">' +
      '<div class="site-sidebar__logo">' +
        '<a href="index.html">Gian-Luca Savino</a>' +
      '</div>' +
      '<nav class="site-sidebar__nav">' +
        '<div class="site-sidebar__section">' +
          '<ul class="site-sidebar__list">' +
            (isHome
              ? '<li><a href="#about" class="site-sidebar__link" data-section="about">About</a></li>' +
                '<li><a href="#projects" class="site-sidebar__link" data-section="projects">Projects</a></li>' +
                '<li><a href="#writing" class="site-sidebar__link" data-section="writing">Writing</a></li>' +
                '<li><a href="https://scholar.google.com/citations?user=R2AuVGkAAAAJ&hl=de&oi=ao" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">Research</a></li>'
              : '<li><a href="index.html" class="site-sidebar__link">Home</a></li>' +
                '<li><a href="index.html#about" class="site-sidebar__link">About</a></li>' +
                '<li><a href="index.html#projects" class="site-sidebar__link">Projects</a></li>' +
                '<li><a href="index.html#writing" class="site-sidebar__link">Writing</a></li>' +
                '<li><a href="https://scholar.google.com/citations?user=R2AuVGkAAAAJ&hl=de&oi=ao" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">Research</a></li>'
            ) +
          '</ul>' +
        '</div>' +
        '<div class="site-sidebar__section">' +
          '<h3 class="site-sidebar__heading">Pages</h3>' +
          '<ul class="site-sidebar__list">' +
            '<li><a href="writing.html" class="site-sidebar__link">All Articles</a></li>' +
            '<li><a href="projects.html" class="site-sidebar__link">All Projects</a></li>' +
          '</ul>' +
        '</div>' +
      '</nav>' +
    '</aside>';

  // Build topbar HTML
  var topbarHTML =
    '<div class="site-topbar">' +
      '<button class="site-topbar__menu-btn" id="menu-toggle" aria-label="Toggle navigation">' +
        '<span></span><span></span><span></span>' +
      '</button>' +
      '<span class="site-topbar__breadcrumb"></span>' +
      '<button class="site-topbar__copy-btn" id="copy-context-btn">' +
        'Copy about me' +
      '</button>' +
    '</div>';

  // Build sidebar overlay for mobile
  var overlayHTML = '<div class="sidebar-overlay" id="sidebar-overlay"></div>';

  chrome.innerHTML = sidebarHTML + topbarHTML + overlayHTML;

  // Set active sidebar link for subpages
  if (!isHome) {
    var sidebarLinks = document.querySelectorAll('.site-sidebar__link');
    sidebarLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href.replace(/\/$/, '') === path) {
        link.classList.add('site-sidebar__link--active');
      }
    });
  }

  // Mobile hamburger toggle
  var menuBtn = document.getElementById('menu-toggle');
  var sidebar = document.getElementById('site-sidebar');
  var overlay = document.getElementById('sidebar-overlay');

  function openSidebar() {
    sidebar.classList.add('site-sidebar--open');
    overlay.classList.add('sidebar-overlay--visible');
  }

  function closeSidebar() {
    sidebar.classList.remove('site-sidebar--open');
    overlay.classList.remove('sidebar-overlay--visible');
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var isOpen = sidebar.classList.contains('site-sidebar--open');
      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Close sidebar on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });
})();
