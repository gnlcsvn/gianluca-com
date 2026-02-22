(function () {
  // Scroll-spy: highlight sidebar links based on visible section
  var sections = document.querySelectorAll('.docs-section[id]');
  if (!sections.length) return;

  var sidebarLinks = document.querySelectorAll('.site-sidebar__link[data-section]');
  if (!sidebarLinks.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var id = entry.target.getAttribute('id');
        sidebarLinks.forEach(function (link) {
          if (link.getAttribute('data-section') === id) {
            link.classList.add('site-sidebar__link--active');
          } else {
            link.classList.remove('site-sidebar__link--active');
          }
        });
      }
    });
  }, {
    rootMargin: '-20% 0px -60% 0px',
    threshold: 0
  });

  sections.forEach(function (section) {
    observer.observe(section);
  });
})();
