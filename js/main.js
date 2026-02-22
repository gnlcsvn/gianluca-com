(function () {
  var chrome = document.getElementById('site-chrome');
  if (!chrome) return;

  var path = window.location.pathname.replace(/\/$/, '') || '/';
  var isHome = path === '/' || path.indexOf('index.html') !== -1;

  // Build sidebar HTML
  var sidebarHTML =
    '<aside class="site-sidebar" id="site-sidebar">' +
      '<nav class="site-sidebar__nav">' +
        '<div class="site-sidebar__section">' +
          '<ul class="site-sidebar__list">' +
            (isHome
              ? '<li><a href="#about" class="site-sidebar__link" data-section="about">About</a></li>' +
                '<li><a href="#projects" class="site-sidebar__link" data-section="projects">Projects</a></li>' +
                '<li><a href="#writing" class="site-sidebar__link" data-section="writing">Writing</a></li>' +
                '<li><a href="https://scholar.google.com/citations?user=R2AuVGkAAAAJ&hl=de&oi=ao" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">Research</a></li>' +
                '<li><a href="https://github.com/gnlcsvn" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">GitHub</a></li>' +
                '<li><a href="https://www.linkedin.com/in/gianlucasavino/" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">LinkedIn</a></li>' +
                '<li><a href="https://x.com/gnlcsvn" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">X</a></li>'
              : '<li><a href="index.html#about" class="site-sidebar__link">About</a></li>' +
                '<li><a href="index.html#projects" class="site-sidebar__link">Projects</a></li>' +
                '<li><a href="index.html#writing" class="site-sidebar__link">Writing</a></li>' +
                '<li><a href="https://scholar.google.com/citations?user=R2AuVGkAAAAJ&hl=de&oi=ao" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">Research</a></li>' +
                '<li><a href="https://github.com/gnlcsvn" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">GitHub</a></li>' +
                '<li><a href="https://www.linkedin.com/in/gianlucasavino/" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">LinkedIn</a></li>' +
                '<li><a href="https://x.com/gnlcsvn" class="site-sidebar__link site-sidebar__external" target="_blank" rel="noopener">X</a></li>'
            ) +
          '</ul>' +
        '</div>' +
        '<div class="site-sidebar__section">' +
          '<h3 class="site-sidebar__heading">Pages</h3>' +
          '<ul class="site-sidebar__list">' +
            '<li><a href="writing.html" class="site-sidebar__link">All Articles</a></li>' +
            '<li><a href="projects.html" class="site-sidebar__link">All Projects</a></li>' +
            '<li><a href="resume.html" class="site-sidebar__link">Resume</a></li>' +
          '</ul>' +
        '</div>' +
      '</nav>' +
    '</aside>';

  // Build copy button group HTML
  var copyBtnHTML =
    '<div class="copy-btn-group" id="copy-btn-group">' +
      '<button class="copy-btn-group__main" id="copy-context-btn" type="button">' +
        '<span class="copy-btn-group__icon">' +
          '<svg class="copy-btn-group__icon-default" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"></path></svg>' +
          '<svg class="copy-btn-group__icon-success" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z"></path></svg>' +
        '</span>' +
        '<span>Copy about me</span>' +
      '</button>' +
      '<button class="copy-btn-group__toggle" id="copy-format-toggle" type="button" aria-label="Choose what to copy">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path></svg>' +
      '</button>' +
      '<div class="copy-btn-group__menu" id="copy-format-menu" hidden>' +
        '<button class="copy-btn-group__menu-item" data-copy="about" type="button">About me</button>' +
        '<button class="copy-btn-group__menu-item" data-copy="resume" type="button">Full resume</button>' +
      '</div>' +
    '</div>';

  // Build topbar HTML (full width, logo on left)
  var topbarHTML =
    '<div class="site-topbar">' +
      '<div class="site-topbar__left">' +
        '<button class="site-topbar__menu-btn" id="menu-toggle" aria-label="Toggle navigation">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
        '<div class="site-topbar__logo" id="logo-wrap">' +
          '<canvas id="logo-canvas"></canvas>' +
        '</div>' +
      '</div>' +
      copyBtnHTML +
    '</div>';

  // Build sidebar overlay for mobile
  var overlayHTML = '<div class="sidebar-overlay" id="sidebar-overlay"></div>';

  chrome.innerHTML = sidebarHTML + topbarHTML + overlayHTML;

  // Set active sidebar link for subpages
  if (!isHome) {
    var pageName = path.split('/').pop() || '';
    var sidebarLinks = document.querySelectorAll('.site-sidebar__link');
    for (var i = 0; i < sidebarLinks.length; i++) {
      var href = sidebarLinks[i].getAttribute('href');
      if (href && href === pageName) {
        sidebarLinks[i].classList.add('site-sidebar__link--active');
      }
    }
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
