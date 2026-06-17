/* Data Insight chart export.
   Wires any [data-export-target] button to render its target figure to a PNG
   via the vendored html-to-image (lib/html-to-image.min.js). ES5, no build step.
   The exported image strips the on-page card chrome so corners stay clean. */
(function () {
  if (!window.htmlToImage) { return; }

  var buttons = document.querySelectorAll('[data-export-target]');
  for (var i = 0; i < buttons.length; i++) {
    wire(buttons[i]);
  }

  function wire(btn) {
    btn.addEventListener('click', function () {
      var node = document.querySelector(btn.getAttribute('data-export-target'));
      if (!node) { return; }
      var name = btn.getAttribute('data-export-name') || 'chart';
      var label = btn.textContent;
      btn.textContent = 'Rendering…';
      btn.disabled = true;

      window.htmlToImage.toPng(node, {
        pixelRatio: 2,
        backgroundColor: '#fbfbfc'
      }).then(function (dataUrl) {
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = name + '.png';
        a.click();
      }).catch(function (err) {
        console.error('PNG export failed', err);
      }).then(function () {
        btn.textContent = label;
        btn.disabled = false;
      });
    });
  }
})();
