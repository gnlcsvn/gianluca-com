(function () {
  var btn = document.getElementById('copy-context-btn');
  if (!btn) return;

  var modal = document.getElementById('copy-modal');
  if (!modal) return;

  var closeBtn = modal.querySelector('.copy-modal__close');
  var overlay = modal.querySelector('.copy-modal__overlay');
  var tabs = modal.querySelectorAll('.copy-modal__tab');
  var output = document.getElementById('copy-output');
  var copyBtn = document.getElementById('copy-output-btn');

  var contextData = null;
  var currentFormat = 'markdown';

  function fetchAllData() {
    return Promise.all([
      fetch('context.json').then(function (r) { return r.json(); }),
      fetch('projects.json').then(function (r) { return r.json(); }),
      fetch('articles/manifest.json').then(function (r) { return r.json(); })
    ]).then(function (results) {
      contextData = {
        person: results[0],
        projects: results[1],
        articles: results[2]
      };
      return contextData;
    });
  }

  function formatMarkdown(data) {
    var p = data.person;
    var lines = [];

    lines.push('# ' + p.name);
    lines.push('');
    lines.push('## About');
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

    lines.push('## Interests');
    lines.push('');
    p.interests.forEach(function (i) {
      lines.push('- ' + i);
    });
    lines.push('');

    lines.push('## Projects');
    lines.push('');
    data.projects.forEach(function (proj) {
      lines.push('- **' + proj.title + '** — ' + proj.description);
      lines.push('  Tags: ' + proj.tags.join(', '));
      lines.push('  URL: ' + proj.url);
    });
    lines.push('');

    lines.push('## Writing');
    lines.push('');
    var sorted = data.articles.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    sorted.forEach(function (article) {
      lines.push('- ' + article.title + ' (' + article.date + ')');
      lines.push('  ' + article.description);
    });
    lines.push('');

    lines.push('## Links');
    lines.push('');
    Object.keys(p.links).forEach(function (key) {
      var label = key.replace(/_/g, ' ');
      label = label.charAt(0).toUpperCase() + label.slice(1);
      lines.push('- ' + label + ': ' + p.links[key]);
    });
    lines.push('');

    lines.push('## Agent Context');
    lines.push('');
    lines.push(p.agent_instructions);

    return lines.join('\n');
  }

  function formatJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  function formatPlainText(data) {
    var p = data.person;
    var lines = [];

    lines.push(p.name.toUpperCase());
    lines.push('');
    lines.push(p.title + ' at ' + p.affiliation + ', ' + p.location);
    lines.push(p.education.degree + ', ' + p.education.institution);
    lines.push('');
    lines.push(p.bio);
    lines.push('');

    lines.push('SKILLS: ' + p.skills.join(', '));
    lines.push('');

    lines.push('INTERESTS: ' + p.interests.join(', '));
    lines.push('');

    lines.push('PROJECTS');
    data.projects.forEach(function (proj) {
      lines.push('  ' + proj.title + ' - ' + proj.description);
      lines.push('  ' + proj.url);
    });
    lines.push('');

    lines.push('WRITING');
    var sorted = data.articles.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    sorted.forEach(function (article) {
      lines.push('  ' + article.title + ' (' + article.date + ') - ' + article.description);
    });
    lines.push('');

    lines.push('LINKS');
    Object.keys(p.links).forEach(function (key) {
      var label = key.replace(/_/g, ' ');
      label = label.charAt(0).toUpperCase() + label.slice(1);
      lines.push('  ' + label + ': ' + p.links[key]);
    });
    lines.push('');

    lines.push('AGENT CONTEXT: ' + p.agent_instructions);

    return lines.join('\n');
  }

  function renderOutput() {
    if (!contextData) return;
    var text = '';
    if (currentFormat === 'markdown') {
      text = formatMarkdown(contextData);
    } else if (currentFormat === 'json') {
      text = formatJSON(contextData);
    } else {
      text = formatPlainText(contextData);
    }
    output.textContent = text;
  }

  function openModal() {
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    if (!contextData) {
      output.textContent = 'Loading...';
      fetchAllData().then(function () {
        renderOutput();
      });
    } else {
      renderOutput();
    }
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openModal);

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (overlay) {
    overlay.addEventListener('click', closeModal);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
      closeModal();
    }
  });

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        t.classList.remove('copy-modal__tab--active');
      });
      tab.classList.add('copy-modal__tab--active');
      currentFormat = tab.getAttribute('data-format');
      renderOutput();
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = output.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copy-modal__copy-btn--copied');
          setTimeout(function () {
            copyBtn.textContent = 'Copy to clipboard';
            copyBtn.classList.remove('copy-modal__copy-btn--copied');
          }, 2000);
        });
      } else {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copy-modal__copy-btn--copied');
        setTimeout(function () {
          copyBtn.textContent = 'Copy to clipboard';
          copyBtn.classList.remove('copy-modal__copy-btn--copied');
        }, 2000);
      }
    });
  }
})();
