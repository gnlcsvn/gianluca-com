(function () {
  var articlesContainer = document.getElementById('home-articles');
  var projectsContainer = document.getElementById('home-projects');

  if (!articlesContainer && !projectsContainer) return;

  // Fetch and display articles
  if (articlesContainer) {
    articlesContainer.innerHTML = '<p>Loading articles...</p>';

    fetch('articles/manifest.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load articles');
        return res.json();
      })
      .then(function (articles) {
        if (articles.length === 0) {
          articlesContainer.innerHTML = '<p>No posts yet.</p>';
          return;
        }

        articles.sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        });

        // Show latest 5 articles
        var shown = articles.slice(0, 5);

        var html = shown
          .map(function (article) {
            var date = new Date(article.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            return (
              '<article class="article-preview">' +
              '<time class="article-preview__date" datetime="' + article.date + '">' + date + '</time>' +
              '<h3 class="article-preview__title"><a href="article.html#' + article.slug + '">' + article.title + '</a></h3>' +
              '<p class="article-preview__desc">' + article.description + '</p>' +
              '</article>'
            );
          })
          .join('');

        articlesContainer.innerHTML = html;
      })
      .catch(function (err) {
        articlesContainer.innerHTML = '<p>Could not load posts.</p>';
        console.error(err);
      });
  }

  // Fetch and display projects
  if (projectsContainer) {
    projectsContainer.innerHTML = '<p>Loading projects...</p>';

    fetch('projects.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load projects');
        return res.json();
      })
      .then(function (projects) {
        if (projects.length === 0) {
          projectsContainer.innerHTML = '<p>No projects yet.</p>';
          return;
        }

        var html = '<div class="project-grid">' + projects
          .map(function (project) {
            var tags = (project.tags || [])
              .map(function (tag) {
                return '<li class="project-card__tag">' + tag + '</li>';
              })
              .join('');

            var imageHtml = project.image
              ? '<img src="' + project.image + '" alt="' + project.title + '" class="project-card__image">'
              : '<div class="project-card__image project-card__image--placeholder"></div>';

            return (
              '<article class="project-card">' +
              '<a href="' + project.url + '" target="_blank" rel="noopener" class="project-card__link">' +
              imageHtml +
              '</a>' +
              '<div class="project-card__body">' +
              (tags ? '<ul class="project-card__tags">' + tags + '</ul>' : '') +
              '<h3 class="project-card__title"><a href="' + project.url + '" target="_blank" rel="noopener">' + project.title + '</a></h3>' +
              '<p class="project-card__desc">' + project.description + '</p>' +
              '</div>' +
              '</article>'
            );
          })
          .join('') + '</div>';

        projectsContainer.innerHTML = html;
      })
      .catch(function (err) {
        projectsContainer.innerHTML = '<p>Could not load projects.</p>';
        console.error(err);
      });
  }
})();
