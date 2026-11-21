// Feed: laedt feed/posts.json und setzt die Posts untereinander, neueste oben.
// window.feedRender und window.feedBuildPost werden auch vom Editor (/post/) benutzt.
(function () {
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  function two(n) { return n < 10 ? '0' + n : String(n); }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return iso; }
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() +
      ', ' + two(d.getHours()) + ':' + two(d.getMinutes());
  }

  function formatSize(bytes) {
    if (!bytes) { return ''; }
    if (bytes < 1024 * 1024) { return Math.max(1, Math.round(bytes / 1024)) + ' kb'; }
    return (Math.round(bytes / 1024 / 1024 * 10) / 10) + ' mb';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text) { node.appendChild(document.createTextNode(text)); }
    return node;
  }

  // ---------- Text ----------
  // Der Text eines Posts ist reiner Text mit ein paar Zeichen fuer die Form:
  //   **fett**   *kursiv*   `code`   [Linktext](https://...)   https://...
  //   Zeilen mit "> " am Anfang sind ein Zitat, Zeilen mit "- " eine Liste.
  // Daraus werden hier Elemente gebaut. Der Text wird nie als HTML eingesetzt.

  var INLINE = /(\*\*[^*\n]+?\*\*|\*[^*\s][^*\n]*?\*|`[^`\n]+?`|\[[^\]\n]+?\]\((?:https?:\/\/|mailto:)[^\s)]+\)|https?:\/\/[^\s<]+)/;

  function link(url, label) {
    var a = document.createElement('a');
    a.href = url;
    if (url.indexOf('mailto:') !== 0) { a.target = '_blank'; a.rel = 'noopener'; }
    fillInline(a, label, true);
    return a;
  }

  function fillInline(node, text, insideLink) {
    var parts = text.split(INLINE);
    var i, part, match, url, tail, child;
    for (i = 0; i < parts.length; i++) {
      part = parts[i];
      if (!part) { continue; }
      if (i % 2 === 0) {
        node.appendChild(document.createTextNode(part));
      } else if (part.indexOf('**') === 0) {
        child = document.createElement('strong');
        fillInline(child, part.slice(2, -2), insideLink);
        node.appendChild(child);
      } else if (part.charAt(0) === '*') {
        child = document.createElement('em');
        fillInline(child, part.slice(1, -1), insideLink);
        node.appendChild(child);
      } else if (part.charAt(0) === '`') {
        node.appendChild(el('code', '', part.slice(1, -1)));
      } else if (insideLink) {
        node.appendChild(document.createTextNode(part));
      } else if (part.charAt(0) === '[') {
        match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        node.appendChild(link(match[2], match[1]));
      } else {
        url = part;
        tail = '';
        while (/[.,;:!?)]$/.test(url)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
        node.appendChild(link(url, url.replace(/^https?:\/\//, '').replace(/\/$/, '')));
        if (tail) { node.appendChild(document.createTextNode(tail)); }
      }
    }
  }

  // Mehrere Zeilen in einen Absatz: jede neue Zeile ist ein Umbruch.
  function fillLines(node, lines) {
    var i;
    for (i = 0; i < lines.length; i++) {
      if (i) { node.appendChild(document.createElement('br')); }
      fillInline(node, lines[i], false);
    }
  }

  function buildText(text) {
    var box = el('div', 'post__text');
    var lines = text.replace(/\r/g, '').split('\n');
    var kind = '';
    var group = [];
    var i, line, next;

    function flush() {
      var node, j, item;
      if (!group.length) { return; }
      if (kind === 'list') {
        node = document.createElement('ul');
        for (j = 0; j < group.length; j++) {
          item = document.createElement('li');
          fillInline(item, group[j], false);
          node.appendChild(item);
        }
      } else {
        node = document.createElement(kind === 'quote' ? 'blockquote' : 'p');
        fillLines(node, group);
      }
      box.appendChild(node);
      group = [];
    }

    for (i = 0; i < lines.length; i++) {
      line = lines[i];
      if (!line.replace(/\s/g, '')) { flush(); kind = ''; continue; }
      next = /^>\s?/.test(line) ? 'quote' : (/^- /.test(line) ? 'list' : 'text');
      if (next !== kind) { flush(); kind = next; }
      group.push(next === 'quote' ? line.replace(/^>\s?/, '') : (next === 'list' ? line.slice(2) : line));
    }
    flush();
    return box;
  }

  // ---------- Bilder, Videos, Ton, Dateien ----------

  // Ein Video spielt, solange es gut zur Haelfte zu sehen ist, und haelt sonst an.
  // Wer im System "Bewegung reduzieren" gewaehlt hat, startet Videos selbst.
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var watcher = null;
  function watch(video) {
    if (still || !window.IntersectionObserver) { return; }
    if (!watcher) {
      watcher = new IntersectionObserver(function (entries) {
        var i, playing;
        for (i = 0; i < entries.length; i++) {
          if (entries[i].intersectionRatio >= 0.6) {
            playing = entries[i].target.play();
            if (playing && playing.catch) { playing.catch(function () { /* der Browser will einen Tipp */ }); }
          } else {
            entries[i].target.pause();
          }
        }
      }, { threshold: [0, 0.6] });
    }
    watcher.observe(video);
  }

  function buildVisual(item, base, eager) {
    var node;
    if (item.type === 'video') {
      // Videos laufen stumm und in Schleife, sobald sie im Bild sind (siehe watch).
      // Stumm ist die Bedingung der Browser fuer ein Abspielen ohne Tipp.
      node = document.createElement('video');
      node.controls = true;
      node.muted = true;
      node.loop = true;
      node.preload = 'metadata';
      node.setAttribute('muted', '');
      node.setAttribute('playsinline', '');
      if (item.poster) { node.poster = base + item.poster; }
      watch(node);
    } else {
      node = document.createElement('img');
      node.alt = item.alt || '';
      if (!eager) { node.loading = 'lazy'; }
    }
    if (item.width && item.height) {
      node.width = item.width;
      node.height = item.height;
    }
    node.className = 'post__media';
    // "#t=0.001" laesst Safari das erste Bild des Videos zeigen, auch ohne Vorschaubild.
    node.src = base + item.src + (item.type === 'video' && item.src.indexOf('blob:') !== 0 ? '#t=0.001' : '');
    return node;
  }

  // Mehrere Bilder: nebeneinander zum Wischen, darunter Pfeile und ein Zaehler.
  function buildCarousel(items, base, eager) {
    var box = el('div', 'carousel');
    var track = el('div', 'carousel__track');
    var bar = el('div', 'carousel__bar');
    var prev = el('button', 'carousel__step', '←');
    var next = el('button', 'carousel__step', '→');
    var count = el('span', 'carousel__count', '1 / ' + items.length);
    var first = items[0];
    var ratio = first.width && first.height ? first.width / first.height : 1;
    var i, slide;

    // Der Rahmen nimmt das Format des ersten Bildes, in Grenzen.
    ratio = Math.max(0.75, Math.min(2, ratio));
    track.style.aspectRatio = String(ratio);
    track.tabIndex = 0;
    track.setAttribute('aria-label', items.length + ' pictures, swipe or use the arrows');

    for (i = 0; i < items.length; i++) {
      slide = el('div', 'carousel__slide');
      slide.appendChild(buildVisual(items[i], base, eager && i === 0));
      track.appendChild(slide);
    }

    function index() { return Math.round(track.scrollLeft / (track.clientWidth || 1)); }
    function show() {
      var at = Math.max(0, Math.min(items.length - 1, index()));
      count.textContent = (at + 1) + ' / ' + items.length;
      prev.disabled = at === 0;
      next.disabled = at === items.length - 1;
    }
    function go(step) {
      var left = (index() + step) * track.clientWidth;
      if (track.scrollTo) { track.scrollTo({ left: left, behavior: 'smooth' }); }
      else { track.scrollLeft = left; }
    }

    prev.type = 'button';
    next.type = 'button';
    prev.setAttribute('aria-label', 'previous picture');
    next.setAttribute('aria-label', 'next picture');
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', show);
    show();

    bar.appendChild(prev);
    bar.appendChild(count);
    bar.appendChild(next);
    box.appendChild(track);
    box.appendChild(bar);
    return box;
  }

  function buildAudio(item, base) {
    var box = el('div', 'post__audio');
    var node = document.createElement('audio');
    node.controls = true;
    node.preload = 'metadata';
    node.className = 'post__media';
    node.src = base + item.src;
    if (item.name) { box.appendChild(el('span', 'post__name', item.name)); }
    box.appendChild(node);
    return box;
  }

  function buildFile(item, base) {
    var a = el('a', 'post__file');
    var size = formatSize(item.size);
    a.href = base + item.src;
    a.setAttribute('download', item.name || '');
    a.appendChild(el('span', '', item.name || item.src.split('/').pop()));
    if (size) { a.appendChild(el('span', 'post__size', size)); }
    return a;
  }

  function buildPost(post, base, eager) {
    var article = el('article', 'post');
    var head = el('div', 'post__head');
    var date = el('a', 'post__date');
    var time = el('time', '', formatDate(post.date));
    var media = post.media || [];
    var visual = [];
    var i;

    article.id = post.id;
    date.href = '#' + post.id;
    time.setAttribute('datetime', post.date);
    date.appendChild(time);
    head.appendChild(date);
    article.appendChild(head);

    if (post.text) { article.appendChild(buildText(post.text)); }

    for (i = 0; i < media.length; i++) {
      if (media[i].type === 'image' || media[i].type === 'video') { visual.push(media[i]); }
    }
    if (visual.length === 1) { article.appendChild(buildVisual(visual[0], base, eager)); }
    if (visual.length > 1) { article.appendChild(buildCarousel(visual, base, eager)); }
    for (i = 0; i < visual.length; i++) {
      // Das Video wird gerade auf GitHub kleingerechnet: bis dahin steht nur das Vorschaubild.
      if (visual[i].processing) {
        article.appendChild(el('p', 'post__note', 'The video is being prepared. It plays here in a minute or two.'));
        break;
      }
    }
    for (i = 0; i < media.length; i++) {
      if (media[i].type === 'audio') { article.appendChild(buildAudio(media[i], base)); }
      if (media[i].type === 'file') { article.appendChild(buildFile(media[i], base)); }
    }
    return article;
  }

  function note(container, message) {
    container.appendChild(el('p', 'posts__note', message));
  }

  // Setzt die Posts in den Container. base ist der Pfad zum Ordner feed/.
  function render(container, posts, base) {
    var i;
    container.innerHTML = '';
    if (!posts.length) { note(container, 'Nothing here yet.'); return; }
    for (i = 0; i < posts.length; i++) {
      container.appendChild(buildPost(posts[i], base, i === 0));
    }
  }

  window.feedRender = render;
  window.feedBuildPost = buildPost;

  var container = document.getElementById('posts');
  if (!container) { return; }

  // ---------- Nur auf der Feed-Seite: Teilen, lange Texte, ein Post allein ----------

  var all = [];
  var CLAMP_LINES = 14;   // laengere Texte werden im Feed auf so viele Zeilen gekuerzt
  var LONG_LINES = 18;    // ... aber erst, wenn sie deutlich laenger sind

  function linkTo(id) {
    return window.location.origin + window.location.pathname + '#' + id;
  }

  // Eine kurze Meldung unten am Fensterrand, die von selbst wieder verschwindet.
  var toastTimer = null;
  function toast(message, seconds) {
    var box = document.getElementById('toast');
    if (!box) {
      box = el('div', 'toast');
      box.id = 'toast';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { box.hidden = true; }, (seconds || 2) * 1000);
  }

  // Text in die Zwischenablage. Der neue Weg geht nur ueber https, der alte ueberall.
  function copy(text) {
    function oldWay() {
      var field = document.createElement('textarea');
      var ok = false;
      field.value = text;
      field.setAttribute('readonly', '');
      field.className = 'toast__field';
      document.body.appendChild(field);
      field.select();
      field.setSelectionRange(0, text.length);
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(field);
      return ok ? Promise.resolve() : Promise.reject(new Error('copy'));
    }
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(oldWay);
    }
    return oldWay();
  }

  // Teilen: der Link zur Einzelansicht des Posts kommt in die Zwischenablage.
  function addShare(article) {
    var button = el('button', 'post__share', 'share');
    button.type = 'button';
    button.addEventListener('click', function () {
      var url = linkTo(article.id);
      copy(url).then(
        function () { toast('link copied'); },
        function () { toast(url, 8); }      // ging nicht: den Link wenigstens zeigen
      );
    });
    article.querySelector('.post__head').appendChild(button);
  }

  // Lange Texte: gekuerzt, mit "more" zum Ausklappen.
  function addMore(article) {
    var text = article.querySelector('.post__text');
    var line, button;
    if (!text) { return; }
    line = parseFloat(window.getComputedStyle(text).lineHeight) || 22;
    if (text.scrollHeight <= line * LONG_LINES) { return; }
    button = el('button', 'post__more', 'more');
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    text.style.maxHeight = (line * CLAMP_LINES) + 'px';
    text.className = 'post__text post__text--clamped';
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.textContent = open ? 'less' : 'more';
      text.className = open ? 'post__text' : 'post__text post__text--clamped';
      text.style.maxHeight = open ? '' : (line * CLAMP_LINES) + 'px';
      if (!open) { article.scrollIntoView(); }
    });
    text.parentNode.insertBefore(button, text.nextSibling);
  }

  function find(id) {
    var i;
    for (i = 0; i < all.length; i++) { if (all[i].id === id) { return all[i]; } }
    return null;
  }

  // Steht hinter der Adresse "#<id>", zeigt die Seite nur diesen einen Post, ungekuerzt,
  // mit einem Weg zurueck. Das ist die Adresse, die "share" verschickt.
  function show(from) {
    var id = decodeURIComponent(window.location.hash.slice(1));
    var post = id ? find(id) : null;
    var articles, back, i, target;
    if (post) {
      render(container, [post], '');
      back = el('a', 'posts__back', '\u2190 all posts');
      back.href = './';
      back.addEventListener('click', function (event) {
        event.preventDefault();
        window.history.pushState(null, '', window.location.pathname);
        show(id);
      });
      container.insertBefore(back, container.firstChild);
      addShare(container.querySelector('.post'));
      window.scrollTo(0, 0);
      return;
    }
    render(container, all, '');
    articles = container.querySelectorAll('.post');
    for (i = 0; i < articles.length; i++) { addShare(articles[i]); addMore(articles[i]); }
    // zurueck aus der Einzelansicht: wieder an die Stelle des Posts
    target = from ? document.getElementById(from) : null;
    if (target) { target.scrollIntoView(); }
  }

  window.addEventListener('hashchange', function () { show(''); });
  window.addEventListener('popstate', function () { show(''); });

  fetch('posts.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) { throw new Error(String(res.status)); }
      return res.json();
    })
    .then(function (data) {
      all = data.posts || [];
      show('');
    })
    .catch(function () {
      container.innerHTML = '';
      note(container, 'The feed could not be loaded.');
    });
})();
