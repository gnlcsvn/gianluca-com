(function () {
  var container = document.getElementById('article-content');
  if (!container) return;

  function loadArticle() {
    var slug = window.location.hash.slice(1);

    if (!slug) {
      container.innerHTML = '<p>No article specified. <a href="writing.html">Browse articles</a>.</p>';
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      container.innerHTML = '<p>Invalid article. <a href="writing.html">Browse articles</a>.</p>';
      return;
    }

    Promise.all([
      fetch('articles/manifest.json').then(function (r) {
        if (!r.ok) throw new Error('Manifest not found');
        return r.json();
      }),
      fetch('articles/' + slug + '.md').then(function (r) {
        if (!r.ok) throw new Error('Article not found');
        return r.text();
      }),
    ])
      .then(function (results) {
        var manifest = results[0];
        var markdown = results[1];

        var meta = manifest.find(function (a) {
          return a.slug === slug;
        });

        var title = meta ? meta.title : slug;
        var dateStr = '';
        if (meta && meta.date) {
          dateStr = new Date(meta.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }

        document.title = title + ' — Gian-Luca Savino';

        var headerHtml =
          '<header class="article-header">' +
          (dateStr ? '<time class="article-header__date" datetime="' + meta.date + '">' + dateStr + '</time>' : '') +
          '<h1 class="article-header__title">' + title + '</h1>' +
          '</header>';

        var bodyHtml = marked.parse(markdown, { gfm: true });

        container.innerHTML = headerHtml + '<div class="article-body">' + bodyHtml + '</div>';
      })
      .catch(function (err) {
        container.innerHTML = '<p>Article not found. <a href="writing.html">Browse articles</a>.</p>';
        console.error(err);
      });
  }

  loadArticle();
  window.addEventListener('hashchange', loadArticle);
})();
