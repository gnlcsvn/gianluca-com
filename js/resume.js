(function () {
  var container = document.getElementById('resume-content');
  if (!container) return;

  var resumeMarkdown = '';

  fetch('resume.md')
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load resume');
      return res.text();
    })
    .then(function (markdown) {
      resumeMarkdown = markdown;
      var bodyHtml = marked.parse(markdown, { gfm: true });
      container.innerHTML =
        '<button class="copy-resume-btn" id="copy-resume-btn" type="button">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"></path></svg>' +
          '<span>Copy resume</span>' +
        '</button>' +
        '<div class="article-body resume-body">' + bodyHtml + '</div>';

      var links = container.querySelectorAll('.resume-body a');
      for (var i = 0; i < links.length; i++) {
        links[i].setAttribute('target', '_blank');
        links[i].setAttribute('rel', 'noopener');
      }

      var btn = document.getElementById('copy-resume-btn');
      btn.addEventListener('click', function () {
        var plainText = resumeMarkdown
          // mailto links: [text](mailto:...) → text
          .replace(/\[([^\]]+)\]\(mailto:[^)]+\)/g, '$1')
          // Links: [text](url) → text (url)
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
          // Headers: remove # symbols
          .replace(/^#{1,6}\s+/gm, '')
          // Bold: **text** → text
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          // Italic: *text* → text
          .replace(/\*([^*]+)\*/g, '$1')
          // Clean up extra blank lines
          .replace(/\n{3,}/g, '\n\n');

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(plainText);
        } else {
          var textarea = document.createElement('textarea');
          textarea.value = plainText;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        btn.classList.add('copy-resume-btn--copied');
        var span = btn.querySelector('span');
        span.textContent = 'Copied!';
        setTimeout(function () {
          btn.classList.remove('copy-resume-btn--copied');
          span.textContent = 'Copy resume';
        }, 2000);
      });
    })
    .catch(function (err) {
      container.innerHTML = '<p>Could not load resume.</p>';
      console.error(err);
    });
})();
