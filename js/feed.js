// Feed: laedt feed/posts.json und setzt die Posts untereinander, neueste oben.
// window.feedRender wird auch vom Editor (/post/) benutzt.
(function () {
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  function two(n) { return n < 10 ? '0' + n : String(n); }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return iso; }
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() +
      ', ' + two(d.getHours()) + ':' + two(d.getMinutes());
  }

  // Text als Text einsetzen (nie als HTML), nur Webadressen werden zu Links.
  function fillText(node, text) {
    var parts = text.split(/(https?:\/\/[^\s]+)/);
    var i, a, url, tail;
    for (i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        url = parts[i];
        tail = '';
        while (/[.,;:!?)]$/.test(url)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
        a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.appendChild(document.createTextNode(url.replace(/^https?:\/\//, '').replace(/\/$/, '')));
        node.appendChild(a);
        if (tail) { node.appendChild(document.createTextNode(tail)); }
      } else if (parts[i]) {
        node.appendChild(document.createTextNode(parts[i]));
      }
    }
  }

  function buildMedia(item, base, eager) {
    var el;
    if (item.type === 'video') {
      el = document.createElement('video');
      el.controls = true;
      el.preload = 'metadata';
      el.setAttribute('playsinline', '');
    } else {
      el = document.createElement('img');
      el.alt = '';
      if (!eager) { el.loading = 'lazy'; }
    }
    if (item.width && item.height) {
      el.width = item.width;
      el.height = item.height;
    }
    el.className = 'post__media';
    el.src = base + item.src;
    return el;
  }

  function buildPost(post, base, eager) {
    var article = document.createElement('article');
    var date = document.createElement('a');
    var time = document.createElement('time');
    var text, i;

    article.className = 'post';
    article.id = post.id;

    date.className = 'post__date';
    date.href = '#' + post.id;
    time.setAttribute('datetime', post.date);
    time.appendChild(document.createTextNode(formatDate(post.date)));
    date.appendChild(time);
    article.appendChild(date);

    if (post.text) {
      text = document.createElement('p');
      text.className = 'post__text';
      fillText(text, post.text);
      article.appendChild(text);
    }
    for (i = 0; i < (post.media || []).length; i++) {
      article.appendChild(buildMedia(post.media[i], base, eager));
    }
    return article;
  }

  function note(container, message) {
    var p = document.createElement('p');
    p.className = 'posts__note';
    p.appendChild(document.createTextNode(message));
    container.appendChild(p);
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
  window.feedFormatDate = formatDate;

  var container = document.getElementById('posts');
  if (!container) { return; }

  fetch('posts.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) { throw new Error(String(res.status)); }
      return res.json();
    })
    .then(function (data) {
      var target;
      render(container, data.posts || [], '');
      // Link auf einen einzelnen Post: nach dem Einsetzen dorthin springen.
      if (window.location.hash) {
        target = document.getElementById(window.location.hash.slice(1));
        if (target) { target.scrollIntoView(); }
      }
    })
    .catch(function () {
      container.innerHTML = '';
      note(container, 'The feed could not be loaded.');
    });
})();
