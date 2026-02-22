(function () {
  var sections = document.querySelectorAll('.docs-section[id]');
  if (!sections.length) return;

  var sidebarLinks = document.querySelectorAll('.site-sidebar__link[data-section]');
  if (!sidebarLinks.length) return;

  var topbarHeight = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')
  ) * 16 || 56;

  var locked = false;

  function setActive(id) {
    for (var i = 0; i < sidebarLinks.length; i++) {
      if (sidebarLinks[i].getAttribute('data-section') === id) {
        sidebarLinks[i].classList.add('site-sidebar__link--active');
      } else {
        sidebarLinks[i].classList.remove('site-sidebar__link--active');
      }
    }
  }

  function update() {
    if (locked) return;

    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var threshold = scrollY + topbarHeight + 80;
    var active = null;

    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= threshold) {
        active = sections[i].getAttribute('id');
      }
    }

    if (!active && sections.length) {
      active = sections[0].getAttribute('id');
    }

    setActive(active);
  }

  // Lock scroll updates briefly after a hash navigation
  function lockAndSet(id) {
    locked = true;
    setActive(id);
    setTimeout(function () {
      locked = false;
    }, 400);
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(function () {
        update();
        ticking = false;
      });
      ticking = true;
    }
  });

  var hash = window.location.hash.slice(1);
  if (hash) {
    lockAndSet(hash);
  } else {
    update();
  }

  window.addEventListener('hashchange', function () {
    var newHash = window.location.hash.slice(1);
    if (newHash) {
      lockAndSet(newHash);
    }
  });
})();
