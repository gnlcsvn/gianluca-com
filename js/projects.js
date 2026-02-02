(function () {
  var container = document.getElementById('project-list');
  if (!container) return;

  fetch('projects.json')
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load projects');
      return res.json();
    })
    .then(function (projects) {
      if (projects.length === 0) {
        container.innerHTML = '<p>No projects yet.</p>';
        return;
      }

      var html = projects
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
            '<h2 class="project-card__title"><a href="' + project.url + '" target="_blank" rel="noopener">' + project.title + '</a></h2>' +
            '<p class="project-card__desc">' + project.description + '</p>' +
            '</div>' +
            '</article>'
          );
        })
        .join('');

      container.innerHTML = html;
    })
    .catch(function (err) {
      container.innerHTML = '<p>Could not load projects.</p>';
      console.error(err);
    });
})();
