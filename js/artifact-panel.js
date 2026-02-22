(function () {
  var panel = null;
  var iframe = null;
  var loader = null;
  var titleEl = null;
  var backdrop = null;
  var isOpen = false;
  var liveUrl = '';

  function createPanel() {
    if (panel) return;

    // Backdrop (mobile only, controlled via CSS)
    backdrop = document.createElement('div');
    backdrop.className = 'artifact-panel__backdrop';
    backdrop.addEventListener('click', close);
    document.body.appendChild(backdrop);

    // Panel container
    panel = document.createElement('div');
    panel.className = 'artifact-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Project preview');

    // Header
    var header = document.createElement('div');
    header.className = 'artifact-panel__header';

    titleEl = document.createElement('span');
    titleEl.className = 'artifact-panel__title';

    var actions = document.createElement('div');
    actions.className = 'artifact-panel__actions';

    var openBtn = document.createElement('button');
    openBtn.className = 'artifact-panel__btn';
    openBtn.setAttribute('aria-label', 'Open in new tab');
    openBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
      '<polyline points="15 3 21 3 21 9"/>' +
      '<line x1="10" y1="14" x2="21" y2="3"/>' +
      '</svg>';
    openBtn.addEventListener('click', function () {
      if (liveUrl) window.open(liveUrl, '_blank', 'noopener');
    });

    var closeBtn = document.createElement('button');
    closeBtn.className = 'artifact-panel__btn';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="18" y1="6" x2="6" y2="18"/>' +
      '<line x1="6" y1="6" x2="18" y2="18"/>' +
      '</svg>';
    closeBtn.addEventListener('click', close);

    actions.appendChild(openBtn);
    actions.appendChild(closeBtn);
    header.appendChild(titleEl);
    header.appendChild(actions);

    // Content area
    var content = document.createElement('div');
    content.className = 'artifact-panel__content';

    loader = document.createElement('div');
    loader.className = 'artifact-panel__loader';
    loader.textContent = 'Loading\u2026';

    content.appendChild(loader);
    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);
  }

  function open(opts) {
    createPanel();

    titleEl.textContent = opts.title || '';
    liveUrl = opts.liveUrl || opts.url;

    // Destroy old iframe if any
    if (iframe) {
      iframe.parentNode.removeChild(iframe);
      iframe = null;
    }

    // Show loader
    loader.style.display = '';

    // Create fresh iframe
    iframe = document.createElement('iframe');
    iframe.className = 'artifact-panel__iframe';
    iframe.addEventListener('load', function () {
      loader.style.display = 'none';
    });
    iframe.src = opts.url;

    var content = panel.querySelector('.artifact-panel__content');
    content.appendChild(iframe);

    // Trigger open
    isOpen = true;
    document.body.classList.add('artifact-panel--open');
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.body.classList.remove('artifact-panel--open');

    // Destroy iframe after transition
    setTimeout(function () {
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
        iframe = null;
      }
    }, 350);
  }

  // Escape key closes panel
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      close();
    }
  });

  // Public API
  window.artifactPanel = {
    open: open,
    close: close
  };
})();
