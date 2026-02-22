(function () {
  var canvasEl = document.getElementById('logo-canvas');
  if (!canvasEl) return;

  var ctx = canvasEl.getContext('2d');
  var DPR = window.devicePixelRatio || 1;

  var FULL_NAME = 'Gian-Luca Savino';
  var SHORT_NAME = 'gnlcsvn';

  // Map: which index in FULL_NAME maps to which in SHORT_NAME
  // G(0)->g(0), n(3)->n(1), L(5)->l(2), c(7)->c(3), S(10)->s(4), v(12)->v(5), n(14)->n(6)
  var KEPT_MAP = [
    { full: 0,  short: 0 },
    { full: 3,  short: 1 },
    { full: 5,  short: 2 },
    { full: 7,  short: 3 },
    { full: 10, short: 4 },
    { full: 12, short: 5 },
    { full: 14, short: 6 }
  ];

  var DROPPED = [1, 2, 4, 6, 8, 9, 11, 13, 15];

  var FONT_SIZE = 20;
  var FONT_PRO = FONT_SIZE + 'px "Georgia", "Times New Roman", serif';
  var FONT_VIBE = FONT_SIZE + 'px "Georgia", "Times New Roman", serif';
  var TEXT_COLOR = '#131314';

  var fullGlyphs, shortGlyphs, fullTotal, shortTotal;

  function measureGlyphs(text, font) {
    ctx.font = font;
    var glyphs = [];
    var x = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var m = ctx.measureText(ch);
      glyphs.push({
        char: ch,
        x: x,
        width: m.width
      });
      x += m.width;
    }
    return { glyphs: glyphs, totalWidth: x };
  }

  function initCanvas() {
    var fMeasure = measureGlyphs(FULL_NAME, FONT_PRO);
    var sMeasure = measureGlyphs(SHORT_NAME, FONT_VIBE);
    fullGlyphs = fMeasure.glyphs;
    shortGlyphs = sMeasure.glyphs;
    fullTotal = fMeasure.totalWidth;
    shortTotal = sMeasure.totalWidth;

    var maxW = Math.max(fullTotal, shortTotal) + 4;
    var h = FONT_SIZE * 1.5;
    canvasEl.width = maxW * DPR;
    canvasEl.height = h * DPR;
    canvasEl.style.width = maxW + 'px';
    canvasEl.style.height = h + 'px';
    ctx.scale(DPR, DPR);

  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function render(t) {
    var e = easeInOutCubic(t);
    var W = parseFloat(canvasEl.style.width);
    var H = parseFloat(canvasEl.style.height);
    var baseline = H * 0.72;

    ctx.clearRect(0, 0, W, H);

    // Dropped letters — fade out, drift down, shrink
    for (var d = 0; d < DROPPED.length; d++) {
      var fi = DROPPED[d];
      var g = fullGlyphs[fi];
      if (!g) continue;
      var alpha = 1 - Math.min(1, e * 2.5);
      var yOff = e * 6;
      var scl = 1 - e * 0.3;
      if (alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = FONT_PRO;
      ctx.fillStyle = TEXT_COLOR;
      ctx.translate(g.x + g.width / 2, baseline);
      ctx.scale(scl, scl);
      ctx.fillText(g.char, -g.width / 2, yOff);
      ctx.restore();
    }

    // Kept letters — interpolate position, crossfade serif/mono
    for (var k = 0; k < KEPT_MAP.length; k++) {
      var fIdx = KEPT_MAP[k].full;
      var sIdx = KEPT_MAP[k].short;
      var fg = fullGlyphs[fIdx];
      var sg = shortGlyphs[sIdx];
      if (!fg || !sg) continue;

      var startX = fg.x;
      var endX = sg.x;
      var kx = startX + (endX - startX) * e;

      // Serif fading out
      var serifAlpha = 1 - e;
      if (serifAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = serifAlpha;
        ctx.font = FONT_PRO;
        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(fg.char, kx, baseline);
        ctx.restore();
      }

      // Mono fading in
      var monoAlpha = e;
      if (monoAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = monoAlpha;
        ctx.font = FONT_VIBE;
        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(sg.char, kx, baseline);
        ctx.restore();
      }
    }

  }

  // Animation controller
  var morphed = false;
  var currentT = 0;
  var targetT = 0;
  var animating = false;

  function animateLoop() {
    if (Math.abs(currentT - targetT) < 0.003) {
      currentT = targetT;
      render(currentT);
      animating = false;
      return;
    }

    var speed = 0.028;
    var dir = targetT > currentT ? 1 : -1;
    currentT += dir * speed;
    currentT = dir > 0 ? Math.min(currentT, targetT) : Math.max(currentT, targetT);

    render(currentT);
    requestAnimationFrame(animateLoop);
  }

  function toggle() {
    morphed = !morphed;
    targetT = morphed ? 1 : 0;
    if (!animating) {
      animating = true;
      requestAnimationFrame(animateLoop);
    }
  }

  var logoWrap = document.getElementById('logo-wrap');
  if (logoWrap) {
    logoWrap.addEventListener('click', function () {
      window.location.href = 'index.html';
    });
    // Animation disabled — uncomment to re-enable morph on click:
    // logoWrap.addEventListener('click', function (e) {
    //   e.preventDefault();
    //   if (morphed) {
    //     window.location.href = 'index.html';
    //   } else {
    //     toggle();
    //   }
    // });
  }

  // Init after fonts loaded
  function start() {
    initCanvas();
    render(0);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    start();
  }

  // Handle resize
  window.addEventListener('resize', function () {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    initCanvas();
    render(currentT);
  });
})();
