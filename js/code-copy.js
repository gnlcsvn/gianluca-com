(function () {
  function addCopyButtons(container) {
    if (!container) return;
    var pres = container.querySelectorAll('pre');
    for (var i = 0; i < pres.length; i++) {
      (function (pre) {
        if (pre.parentNode.classList && pre.parentNode.classList.contains('code-block')) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'code-block';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        var btn = document.createElement('button');
        btn.className = 'code-block__copy';
        btn.textContent = 'Copy';
        btn.setAttribute('type', 'button');

        btn.addEventListener('click', function () {
          var code = pre.querySelector('code');
          var text = code ? code.textContent : pre.textContent;

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
              btn.textContent = 'Copied!';
              btn.classList.add('code-block__copy--copied');
              setTimeout(function () {
                btn.textContent = 'Copy';
                btn.classList.remove('code-block__copy--copied');
              }, 2000);
            });
          } else {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            btn.textContent = 'Copied!';
            btn.classList.add('code-block__copy--copied');
            setTimeout(function () {
              btn.textContent = 'Copy';
              btn.classList.remove('code-block__copy--copied');
            }, 2000);
          }
        });

        wrapper.appendChild(btn);
      })(pres[i]);
    }
  }

  window.addCopyButtons = addCopyButtons;
})();
