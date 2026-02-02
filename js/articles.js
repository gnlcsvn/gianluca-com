(function () {
  var container = document.getElementById('article-list');
  if (!container) return;

  fetch('articles/manifest.json')
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load articles');
      return res.json();
    })
    .then(function (articles) {
      articles.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });

      if (articles.length === 0) {
        container.innerHTML = '<p>No articles yet.</p>';
        return;
      }

      var html = articles
        .map(function (article) {
          var date = new Date(article.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          return (
            '<article class="article-preview">' +
            '<time class="article-preview__date" datetime="' + article.date + '">' + date + '</time>' +
            '<h2 class="article-preview__title"><a href="article.html#' + article.slug + '">' + article.title + '</a></h2>' +
            '<p class="article-preview__desc">' + article.description + '</p>' +
            '</article>'
          );
        })
        .join('');

      container.innerHTML = html;
    })
    .catch(function (err) {
      container.innerHTML = '<p>Could not load articles.</p>';
      console.error(err);
    });
})();
