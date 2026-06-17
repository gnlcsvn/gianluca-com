/* Toggle bar chart for Data Insights. ES5, no build step.
   Renders a horizontal bar chart from a JSON config in data-chart, and lets the
   reader switch between modes (e.g. absolute vs per capita) via .di-chip buttons.
   Config shape:
   { "modes": { "<key>": {
       "axis_max": 40, "axis_ticks": ["0","..."], "source": "Source: ...",
       "highlight": "Switzerland",
       "rows": [ { "label": "...", "value": 34.1, "display": "$34.1B" }, ... ]
   } } } */
(function () {
  var charts = document.querySelectorAll('.di-toggle-chart');
  for (var i = 0; i < charts.length; i++) { initChart(charts[i]); }

  function initChart(el) {
    var cfg;
    try { cfg = JSON.parse(el.getAttribute('data-chart')); } catch (e) { return; }
    if (!cfg || !cfg.modes) { return; }
    var figure = el.closest ? el.closest('.di-figure') : null;
    var chips = figure ? figure.querySelectorAll('.di-chip') : [];
    var sourceLine = figure ? figure.querySelector('.di-source-line') : null;
    var modeKeys = []; for (var k in cfg.modes) { if (cfg.modes.hasOwnProperty(k)) { modeKeys.push(k); } }
    var current = el.getAttribute('data-mode') || modeKeys[0];

    for (var c = 0; c < chips.length; c++) {
      (function (chip) {
        chip.addEventListener('click', function () { render(chip.getAttribute('data-mode')); });
      })(chips[c]);
    }
    render(current);

    function render(mode) {
      var m = cfg.modes[mode];
      if (!m) { return; }
      var html = '';
      for (var r = 0; r < m.rows.length; r++) {
        var row = m.rows[r];
        var w = (row.value / m.axis_max) * 100;
        if (w < 0) { w = 0; } if (w > 100) { w = 100; }
        var hl = (m.highlight && row.label === m.highlight) ? ' di-row--hl' : '';
        html += '<div class="di-row' + hl + '"><div class="di-row__label">' + esc(row.label) +
          '</div><div class="di-row__track"><div class="di-row__fill" style="width:' + w.toFixed(2) +
          '%">' + esc(row.display) + '</div></div></div>';
      }
      html += '<div class="di-axis">';
      for (var t = 0; t < m.axis_ticks.length; t++) { html += '<span>' + esc(m.axis_ticks[t]) + '</span>'; }
      html += '</div>';
      el.innerHTML = html;
      if (sourceLine && m.source) { sourceLine.textContent = m.source; }
      for (var j = 0; j < chips.length; j++) {
        if (chips[j].getAttribute('data-mode') === mode) { chips[j].classList.add('is-active'); }
        else { chips[j].classList.remove('is-active'); }
      }
    }
    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
      });
    }
  }
})();
