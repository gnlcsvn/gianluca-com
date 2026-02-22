(function () {
  var group = document.getElementById('copy-btn-group');
  var btn = document.getElementById('copy-context-btn');
  var toggle = document.getElementById('copy-format-toggle');
  var menu = document.getElementById('copy-format-menu');

  if (!group || !btn || !toggle || !menu) return;

  var cache = {};
  var currentMode = 'about';

  function fetchAbout() {
    if (cache.about) return Promise.resolve(cache.about);
    return Promise.all([
      fetch('context.json').then(function (r) { return r.json(); }),
      fetch('projects.json').then(function (r) { return r.json(); }),
      fetch('articles/manifest.json').then(function (r) { return r.json(); }),
      fetch('resume.md').then(function (r) { return r.text(); })
    ]).then(function (results) {
      var p = results[0];
      var projects = results[1];
      var articles = results[2];
      var resumeText = results[3];

      var lines = [];
      lines.push('# ' + p.name);
      lines.push('');
      lines.push(p.title + ' at ' + p.affiliation + ', ' + p.location + '.');
      lines.push(p.education.degree + ', ' + p.education.institution + '.');
      lines.push('');
      lines.push(p.bio);
      lines.push('');
      lines.push('## Skills');
      lines.push('');
      lines.push(p.skills.join(', '));
      lines.push('');
      lines.push('## Links');
      lines.push('');
      var keys = Object.keys(p.links);
      for (var i = 0; i < keys.length; i++) {
        var label = keys[i].replace(/_/g, ' ');
        label = label.charAt(0).toUpperCase() + label.slice(1);
        lines.push('- [' + label + '](' + p.links[keys[i]] + ')');
      }
      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('## Resume');
      lines.push('');
      lines.push(resumeText.trim());
      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('## Projects');
      lines.push('');
      for (var i = 0; i < projects.length; i++) {
        lines.push('- **' + projects[i].title + '** — ' + projects[i].description);
      }
      lines.push('');
      lines.push('## Articles');
      lines.push('');
      var sorted = articles.slice().sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
      for (var i = 0; i < sorted.length; i++) {
        lines.push('- ' + sorted[i].title + ' (' + sorted[i].date + ') — ' + sorted[i].description);
      }

      cache.about = lines.join('\n');
      return cache.about;
    });
  }

  function fetchResume() {
    if (cache.resume) return Promise.resolve(cache.resume);
    return fetch('resume.md').then(function (r) { return r.text(); }).then(function (text) {
      cache.resume = text;
      return text;
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; });
    }
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve(true);
  }

  function showSuccess() {
    group.classList.add('copy-btn-group--copied');
    setTimeout(function () {
      group.classList.remove('copy-btn-group--copied');
    }, 2000);
  }

  function doCopy(mode) {
    var fetcher = mode === 'resume' ? fetchResume : fetchAbout;
    fetcher().then(function (text) {
      copyToClipboard(text).then(showSuccess);
    }).catch(function (err) {
      console.error('Failed to copy', err);
    });
  }

  // Main button copies current mode
  btn.addEventListener('click', function () {
    doCopy(currentMode);
  });

  // Dropdown toggle
  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    if (menu.hasAttribute('hidden')) {
      menu.removeAttribute('hidden');
    } else {
      menu.setAttribute('hidden', '');
    }
  });

  // Menu items
  var items = menu.querySelectorAll('.copy-btn-group__menu-item');
  for (var i = 0; i < items.length; i++) {
    (function (item) {
      item.addEventListener('click', function () {
        var mode = item.getAttribute('data-copy');
        currentMode = mode;
        // Update button label
        var label = btn.querySelector('span:last-child');
        if (label) {
          label.textContent = mode === 'resume' ? 'Copy resume' : 'Copy about me';
        }
        menu.setAttribute('hidden', '');
        doCopy(mode);
      });
    })(items[i]);
  }

  // Close menu on outside click
  document.addEventListener('click', function (e) {
    if (!group.contains(e.target)) {
      menu.setAttribute('hidden', '');
    }
  });

  // Close menu on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      menu.setAttribute('hidden', '');
    }
  });

  // Pre-fetch both
  fetchAbout().catch(function () {});
  fetchResume().catch(function () {});
})();
