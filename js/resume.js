(function () {
  var container = document.getElementById('resume-content');
  if (!container) return;

  fetch('resume.md')
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load resume');
      return res.text();
    })
    .then(function (markdown) {
      var bodyHtml = marked.parse(markdown, { gfm: true });
      container.innerHTML = '<div class="article-body resume-body">' + bodyHtml + '</div>';
    })
    .catch(function (err) {
      container.innerHTML = '<p>Could not load resume.</p>';
      console.error(err);
    });
})();
