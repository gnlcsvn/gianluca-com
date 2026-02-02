(function () {
  var postContainer = document.getElementById('latest-post');
  var projectContainer = document.getElementById('latest-project');

  if (!postContainer && !projectContainer) return;

  // Fetch latest post
  if (postContainer) {
    fetch('articles/manifest.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load articles');
        return res.json();
      })
      .then(function (articles) {
        if (articles.length === 0) {
          postContainer.innerHTML = '<p>No posts yet.</p>';
          return;
        }

        articles.sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });

        var latest = articles[0];
        var date = new Date(latest.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        postContainer.innerHTML =
          '<article class="article-preview article-preview--home">' +
          '<time class="article-preview__date" datetime="' + latest.date + '">' + date + '</time>' +
          '<h3 class="article-preview__title"><a href="article.html#' + latest.slug + '">' + latest.title + '</a></h3>' +
          '<p class="article-preview__desc">' + latest.description + '</p>' +
          '</article>';
      })
      .catch(function (err) {
        postContainer.innerHTML = '<p>Could not load posts.</p>';
        console.error(err);
      });
  }

  // Fetch latest project
  if (projectContainer) {
    fetch('projects.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load projects');
        return res.json();
      })
      .then(function (projects) {
        if (projects.length === 0) {
          projectContainer.innerHTML = '<p>No projects yet.</p>';
          return;
        }

        var latest = projects[0];
        var tags = (latest.tags || [])
          .map(function (tag) {
            return '<li class="project-card__tag">' + tag + '</li>';
          })
          .join('');

        var imageHtml = latest.image
          ? '<img src="' + latest.image + '" alt="' + latest.title + '" class="project-card__image">'
          : '<div class="project-card__image project-card__image--placeholder"></div>';

        projectContainer.innerHTML =
          '<article class="project-card project-card--home">' +
          '<a href="' + latest.url + '" target="_blank" rel="noopener" class="project-card__link">' +
          imageHtml +
          '</a>' +
          '<div class="project-card__body">' +
          (tags ? '<ul class="project-card__tags">' + tags + '</ul>' : '') +
          '<h3 class="project-card__title"><a href="' + latest.url + '" target="_blank" rel="noopener">' + latest.title + '</a></h3>' +
          '<p class="project-card__desc">' + latest.description + '</p>' +
          '</div>' +
          '</article>';
      })
      .catch(function (err) {
        projectContainer.innerHTML = '<p>Could not load projects.</p>';
        console.error(err);
      });
  }
})();
