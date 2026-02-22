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
        for (var i = 0; i < sidebarLinks.length; i++) {
          if (sidebarLinks[i].getAttribute('data-section') === id) {
            sidebarLinks[i].classList.add('site-sidebar__link--active');
          } else {
            sidebarLinks[i].classList.remove('site-sidebar__link--active');
          }
        }
      }
    });
  }, {
    rootMargin: '-20% 0px -60% 0px',
    threshold: 0
  });

  for (var i = 0; i < sections.length; i++) {
    observer.observe(sections[i]);
  }
})();
