// Editor zum Schreiben (/write/). Die Texte liegen in einem eigenen, privaten Repository:
// je Text ein Ordner <id>/ mit text.md und den Bildern daneben.
// Geschrieben wird zuerst in den Speicher dieses Browsers, das geht sofort und ohne Netz.
// In Schreibpausen geht der Stand als Commit zu GitHub; von dort holt ihn jedes andere Geraet.
// Das Token liegt nur im Speicher dieses Browsers und geht nur an api.github.com.
(function () {
  var page = document.getElementById('write');
  if (!page) { return; }

  var API = 'https://api.github.com/repos/gnlcsvn/texte';
  var BRANCH = 'main';
  var FILE = 'text.md';
  var TOKEN_KEY = 'feed-token';       // dasselbe Token wie im Feed-Editor
  var STORE = 'write:';               // davor: je Text ein Eintrag im Speicher des Browsers
  var MAX_EDGE = 2000;                // Bilder werden auf diese Kantenlaenge verkleinert
  var MAX_FILE = 50 * 1024 * 1024;    // groessere Videos lehnt der Editor ab
  var MEDIA_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;   // ein Bild oder Video: allein auf seiner Zeile
  var VIDEO = /\.(mp4|mov|m4v|webm)$/i;
  var IDLE = 6000;                    // so lange nach dem letzten Tastendruck wird gespeichert
  var LONGEST = 45000;                // spaetestens aber nach dieser Zeit, auch mitten im Schreiben
  var POLL = 30000;                   // so oft wird nachgesehen, ob der Text woanders geaendert wurde
  var VERSION = ((document.currentScript && document.currentScript.src || '').match(/[?&]v=(\w+)/) || [])[1] || '';

  function byId(id) { return document.getElementById(id); }

  var tokenForm = byId('token-form');
  var tokenInput = byId('token');
  var homeLink = byId('home');
  var backButton = byId('back');
  var listTools = byId('list-tools');
  var textTools = byId('text-tools');
  var newButton = byId('new');
  var forgetButton = byId('forget');
  var fileInput = byId('files');
  var previewToggle = byId('preview-toggle');
  var historyToggle = byId('history-toggle');
  var deleteButton = byId('delete');
  var listBox = byId('texts');
  var sheet = byId('sheet');
  var notice = byId('notice');
  var blocks = byId('blocks');
  var pane = byId('pane');
  var foot = byId('foot');
  var stateLine = byId('state');
  var countLine = byId('count');
  var statusLine = byId('status');

  var token = '';
  var texts = {};                     // id -> {text, base, sha, changed, date}
                                      // text: was hier steht; base und sha: der letzte Stand von GitHub
  var openId = '';                    // der Text, der gerade offen ist
  var mode = 'write';                 // write, preview, history oder diff
  var pushTimer = null;
  var keepTimer = null;
  var pollTimer = null;
  var firstUnsaved = 0;               // seit wann Ungespeichertes da ist
  var uploads = 0;                    // Bilder, die gerade hochgehen
  var pictures = {};                  // '<id>/<name>' -> lokale Adresse des Bildes oder Videos
  var lastCaret = -1;                 // wo die Schreibmarke zuletzt stand, als Stelle im ganzen Text
  var line = Promise.resolve();       // alles, was zu GitHub schreibt, geht der Reihe nach

  // ---------- kleine Helfer ----------

  var sayTimer = null;
  function say(message, stay) {
    window.clearTimeout(sayTimer);
    statusLine.textContent = message;
    if (message && !stay) { sayTimer = window.setTimeout(function () { statusLine.textContent = ''; }, 6000); }
  }

  function setState(message) { stateLine.textContent = message; }

  function two(n) { return n < 10 ? '0' + n : String(n); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text) { node.appendChild(document.createTextNode(text)); }
    return node;
  }

  function quiet(label, action) {
    var button = el('button', 'editor__quiet', label);
    button.type = 'button';
    button.addEventListener('click', action);
    return button;
  }

  function idNow(d) {
    return String(d.getFullYear()) + two(d.getMonth() + 1) + two(d.getDate()) +
      '-' + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
  }

  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  // Heute nur die Uhrzeit, sonst der Tag; full: immer Tag und Uhrzeit.
  function when(time, full) {
    var d = new Date(time || NaN);
    var now = new Date();
    var clock = two(d.getHours()) + ':' + two(d.getMinutes());
    var day = d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() === now.getFullYear() ? '' : ' ' + d.getFullYear());
    if (isNaN(d.getTime())) { return ''; }
    if (full) { return day + ' ' + clock; }
    return d.toDateString() === now.toDateString() ? clock : day;
  }

  // Die erste Zeile ist der Titel.
  function titleOf(text) {
    var lines = text.split('\n');
    var i, title;
    for (i = 0; i < lines.length; i++) {
      title = lines[i].replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/^[#>\-\s]+/, '').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();
      if (title) { return title.length > 60 ? title.slice(0, 60).trim() + ' ...' : title; }
    }
    return 'untitled';
  }

  function unsaved(t) { return t.text !== t.base || (!t.sha && t.text !== ''); }

  // ---------- Speicher dieses Browsers ----------

  function remember(key, value) {
    try {
      if (value) { window.localStorage.setItem(key, value); }
      else { window.localStorage.removeItem(key); }
      return true;
    } catch (e) { return false; }
  }
  function recall(key) {
    try { return window.localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function keep(id) {
    if (!texts[id]) { return; }
    if (!remember(STORE + id, JSON.stringify(texts[id]))) {
      say('This browser cannot store the text. Keep the page open until it says "saved".', true);
    }
  }
  function keepSoon() {
    window.clearTimeout(keepTimer);
    keepTimer = window.setTimeout(function () { keep(openId); }, 300);
  }
  function forget(id) {
    delete texts[id];
    remember(STORE + id, '');
  }
  function recallAll() {
    var i, key, t;
    try {
      for (i = 0; i < window.localStorage.length; i++) {
        key = window.localStorage.key(i);
        if (key.indexOf(STORE) !== 0) { continue; }
        try { t = JSON.parse(window.localStorage.getItem(key)); } catch (e) { t = null; }
        if (t && typeof t.text === 'string') {
          texts[key.slice(STORE.length)] = { text: t.text, base: t.base || '', sha: t.sha || '', changed: t.changed || 0, date: t.date || '' };
        }
      }
    } catch (e) { /* privates Fenster: dann gibt es nur, was auf GitHub liegt */ }
  }

  // ---------- GitHub ----------

  // kind 'blob': die Datei selbst (fuer Bilder); sonst JSON.
  function api(method, path, body, kind, keepalive) {
    var options = {
      method: method,
      cache: 'no-store',              // nie aus dem Zwischenspeicher: sonst waere der Stand alt
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': kind === 'blob' ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (body) { options.body = JSON.stringify(body); }
    if (keepalive && body && options.body.length < 60000) { options.keepalive = true; }
    return window.fetch(API + path, options).then(function (res) {
      if (res.ok) { return kind === 'blob' ? res.blob() : res.json(); }
      return res.text().then(function (text) {
        var message = '';
        var error;
        try { message = JSON.parse(text).message || ''; } catch (e) { /* kein JSON */ }
        error = new Error(message || String(res.status));
        error.status = res.status;
        throw error;
      });
    });
  }

  function explain(error) {
    if (!error.status) { return 'No connection.'; }
    if (error.status === 401) { return 'GitHub rejected the token.'; }
    if (error.status === 404) { return 'The token cannot see the repository gnlcsvn/texte. Add it to the token (Contents: read and write).'; }
    return 'GitHub: ' + error.message;
  }

  function encode(text) {
    var bytes = new window.TextEncoder().encode(text);
    var chars = '';
    var i;
    for (i = 0; i < bytes.length; i++) { chars += String.fromCharCode(bytes[i]); }
    return window.btoa(chars);
  }
  function decode(base64) {
    var chars = window.atob(String(base64).replace(/\s/g, ''));
    var bytes = new Uint8Array(chars.length);
    var i;
    for (i = 0; i < chars.length; i++) { bytes[i] = chars.charCodeAt(i); }
    return new window.TextDecoder().decode(bytes);
  }

  // Der Reihe nach: zwei Commits zur selben Zeit lehnt GitHub ab.
  function queued(job) {
    var next = line.then(job, job);
    line = next.then(function () {}, function () {});
    return next;
  }

  function path(id, name) { return '/contents/' + id + '/' + encodeURIComponent(name || FILE); }

  // Den Stand von GitHub holen. Hat sich der Text dort geaendert, wird er uebernommen;
  // ist hier inzwischen auch geschrieben worden, werden beide Fassungen zusammengefuehrt.
  function pull(id) {
    var t = texts[id];
    if (!t) { return Promise.resolve(); }
    return api('GET', path(id) + '?ref=' + BRANCH).then(function (res) {
      var remote, before, first;
      if (res.sha === t.sha) { return; }
      if (res.content === '' && res.size > 0) { throw new Error('The text is too large.'); }
      remote = decode(res.content);
      before = t.text;
      first = !t.sha && !before;        // hier noch leer: der Text kommt zum ersten Mal an
      t.text = t.text === t.base ? remote : merge3(t.base, t.text, remote);
      t.base = remote;
      t.sha = res.sha;
      keep(id);
      if (t.text !== before) { arrived(id, before, first); }
    }, function (error) {
      if (error.status !== 404) { throw error; }
      if (!t.sha) { return; }           // noch nie gespeichert: es gibt ihn dort noch nicht
      // Die Datei fehlt. Erst sicher gehen, dass das Repository ueberhaupt zu sehen ist:
      // sonst wuerde ein Token ohne Zugriff aussehen, als seien alle Texte geloescht.
      return api('GET', '').then(function () {
        if (unsaved(t)) { t.sha = ''; t.base = ''; keep(id); return; }   // hier weitergeschrieben: er entsteht neu
        forget(id);
        if (id === openId) { say('This text was deleted elsewhere.'); window.location.hash = ''; }
      });
    });
  }

  // Den Stand von hier zu GitHub bringen: ein Commit.
  function push(id, tries, keepalive) {
    var t = texts[id];
    var sent, body;
    if (!t || !unsaved(t)) { return Promise.resolve(); }
    sent = t.text;
    body = { message: 'write: ' + titleOf(sent), content: encode(sent), branch: BRANCH };
    if (t.sha) { body.sha = t.sha; }
    if (id === openId) { setState('saving ...'); }
    return api('PUT', path(id), body, '', keepalive).then(function (res) {
      t.sha = res.content.sha;
      t.base = sent;
      t.date = new Date().toISOString();
      keep(id);
      if (id !== openId) { return; }
      firstUnsaved = 0;
      if (t.text === sent) { setState('saved'); } else { setState(''); pushSoon(); }
    }, function (error) {
      // 409/422: auf GitHub steht inzwischen etwas anderes. Holen, zusammenfuehren, noch einmal.
      if ((error.status === 409 || error.status === 422) && tries > 1) {
        return pull(id).then(function () { return push(id, tries - 1, keepalive); });
      }
      if (id === openId) { setState(error.status ? explain(error) : 'offline, kept on this device'); }
    });
  }

  function sync(id) {
    return queued(function () {
      return pull(id).then(function () { return push(id, 3); });
    }).catch(function (error) {
      if (id === openId) { setState(error.status ? explain(error) : 'offline, kept on this device'); }
    });
  }

  function pushNow(keepalive) {
    var id = openId;
    window.clearTimeout(pushTimer);
    if (!id || !texts[id] || !unsaved(texts[id])) { return; }
    queued(function () { return push(id, 3, keepalive); });
  }

  function pushSoon() {
    var now = Date.now();
    window.clearTimeout(pushTimer);
    if (!firstUnsaved) { firstUnsaved = now; }
    pushTimer = window.setTimeout(function () { pushNow(false); }, Math.max(0, Math.min(IDLE, LONGEST - (now - firstUnsaved))));
  }

  // Einen Text mit allen Bildern loeschen: ein Commit, der den Ordner entfernt.
  function removeFolder(id, title) {
    var head, entries = [];
    return api('GET', '/git/ref/heads/' + BRANCH).then(function (ref) {
      head = ref.object.sha;
      return api('GET', '/git/commits/' + head);
    }).then(function (commit) {
      return api('GET', '/git/trees/' + commit.tree.sha + '?recursive=1').then(function (tree) {
        var i;
        for (i = 0; i < tree.tree.length; i++) {
          if (tree.tree[i].type === 'blob' && tree.tree[i].path.indexOf(id + '/') === 0) {
            entries.push({ path: tree.tree[i].path, mode: '100644', type: 'blob', sha: null });
          }
        }
        if (!entries.length) { return null; }
        return api('POST', '/git/trees', { base_tree: commit.tree.sha, tree: entries });
      });
    }).then(function (tree) {
      if (!tree) { return null; }
      return api('POST', '/git/commits', { message: 'write: delete ' + title, tree: tree.sha, parents: [head] });
    }).then(function (commit) {
      if (!commit) { return null; }
      return api('PATCH', '/git/refs/heads/' + BRANCH, { sha: commit.sha });
    });
  }

  // ---------- Vergleichen und Zusammenfuehren ----------

  // Vergleicht zwei Listen (Zeilen oder Woerter). Ergebnis: Stuecke der Art
  // {kind: 'same' | 'del' | 'ins', items: [...]} in der Reihenfolge des Textes.
  function diff(a, b) {
    var start = 0, endA = a.length, endB = b.length;
    var ops = [];
    var n, m, w, table, i, j;

    function add(kind, item) {
      var last = ops[ops.length - 1];
      if (last && last.kind === kind) { last.items.push(item); } else { ops.push({ kind: kind, items: [item] }); }
    }

    while (start < endA && start < endB && a[start] === b[start]) { start++; }
    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
    for (i = 0; i < start; i++) { add('same', a[i]); }
    n = endA - start;
    m = endB - start;
    if (n * m > 6000000) {
      // zu gross fuer den genauen Vergleich: die Mitte gilt als ganz ersetzt
      for (i = start; i < endA; i++) { add('del', a[i]); }
      for (j = start; j < endB; j++) { add('ins', b[j]); }
    } else {
      // laengste gemeinsame Folge, von hinten gerechnet
      w = m + 1;
      table = new Int32Array((n + 1) * w);
      for (i = n - 1; i >= 0; i--) {
        for (j = m - 1; j >= 0; j--) {
          table[i * w + j] = a[start + i] === b[start + j]
            ? table[(i + 1) * w + j + 1] + 1
            : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
        }
      }
      i = 0; j = 0;
      while (i < n && j < m) {
        if (a[start + i] === b[start + j]) { add('same', a[start + i]); i++; j++; }
        else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) { add('del', a[start + i]); i++; }
        else { add('ins', b[start + j]); j++; }
      }
      for (; i < n; i++) { add('del', a[start + i]); }
      for (; j < m; j++) { add('ins', b[start + j]); }
    }
    for (i = endA; i < a.length; i++) { add('same', a[i]); }
    return ops;
  }

  // Die Aenderungen von a nach b als Stellen in a: {start, end, lines} heisst
  // "die Zeilen start bis end werden durch lines ersetzt".
  function hunks(a, b) {
    var ops = diff(a, b);
    var out = [];
    var pos = 0, open = null, i, op;
    for (i = 0; i < ops.length; i++) {
      op = ops[i];
      if (op.kind === 'same') { pos += op.items.length; open = null; continue; }
      if (!open) { open = { start: pos, end: pos, lines: [] }; out.push(open); }
      if (op.kind === 'del') { pos += op.items.length; open.end = pos; }
      else { open.lines = open.lines.concat(op.items); }
    }
    return out;
  }

  // Zwei Fassungen, die beide aus base entstanden sind, werden eine. Aenderungen an
  // verschiedenen Zeilen gelten beide. Haben beide dieselbe Zeile geaendert, bleiben
  // beide Fassungen untereinander stehen: verloren geht nichts.
  function merge3(base, mine, theirs) {
    var b = base.split('\n');
    var hm = hunks(b, mine.split('\n'));
    var ht = hunks(b, theirs.split('\n'));
    var out = [];
    var pos = 0, i = 0, j = 0;
    var m, t, start, end, ms, ts, more, a, c;

    function copy(to) { for (; pos < to; pos++) { out.push(b[pos]); } }
    function take(h) { copy(h.start); out = out.concat(h.lines); pos = h.end; }
    function apply(list) {
      var lines = [], at = start, k;
      for (k = 0; k < list.length; k++) {
        lines = lines.concat(b.slice(at, list[k].start), list[k].lines);
        at = list[k].end;
      }
      return lines.concat(b.slice(at, end));
    }
    function sameSpot(x, y) { return x.start === x.end && y.start === y.end && x.start === y.start; }

    while (i < hm.length || j < ht.length) {
      m = hm[i]; t = ht[j];
      if (m && (!t || (m.end <= t.start && !sameSpot(m, t)))) { take(m); i++; continue; }
      if (t && (!m || (t.end <= m.start && !sameSpot(m, t)))) { take(t); j++; continue; }
      // beide haben dieselbe Stelle angefasst
      start = Math.min(m.start, t.start);
      end = Math.max(m.end, t.end);
      ms = [m]; ts = [t]; i++; j++;
      more = true;
      while (more) {
        more = false;
        while (hm[i] && hm[i].start < end) { end = Math.max(end, hm[i].end); ms.push(hm[i]); i++; more = true; }
        while (ht[j] && ht[j].start < end) { end = Math.max(end, ht[j].end); ts.push(ht[j]); j++; more = true; }
      }
      copy(start);
      a = apply(ms);
      c = apply(ts);
      out = out.concat(a);
      if (a.join('\n') !== c.join('\n')) { out = out.concat(c); }
      pos = end;
    }
    copy(b.length);
    return out.join('\n');
  }

  // Der Vergleich zum Ansehen: Weggefallenes durchgestrichen, Neues unterlegt.
  function diffView(before, after) {
    var box = el('div', 'write__diff');
    var ops = diff(before.split(/(\s+)/), after.split(/(\s+)/));
    var changes = 0, i, text, node, wasChange = false;
    for (i = 0; i < ops.length; i++) {
      text = ops[i].items.join('');
      if (!text) { continue; }
      if (ops[i].kind === 'same') {
        box.appendChild(document.createTextNode(text));
        if (/\S/.test(text)) { wasChange = false; }
      } else {
        node = el(ops[i].kind === 'del' ? 'del' : 'ins', '', text);
        box.appendChild(node);
        if (!wasChange) { changes++; }
        wasChange = true;
      }
    }
    box.changes = changes;
    return box;
  }

  // ---------- Vorschau ----------
  // Dieselben Zeichen wie im Feed (**fett**, *kursiv*, `code`, Links, "> " Zitat, "- " Liste),
  // dazu Ueberschriften (#, ##, ###), Bilder und Videos (![](datei.jpg)) und eine Linie (---).

  // Ein Bild oder Video als Kasten. Dateien eines privaten Repositorys lassen sich nicht
  // per Adresse laden: sie kommen ueber die API und werden als lokale Adresse gezeigt.
  // Bilder laden von selbst, Videos erst auf einen Tipp (sie koennen gross sein).
  function mediaBox(id, alt, src) {
    var box = el('figure', 'write__media');
    var key = id + '/' + src;
    var video = VIDEO.test(src);

    function show(url) {
      var node = document.createElement(video ? 'video' : 'img');
      if (video) { node.controls = true; node.preload = 'metadata'; node.setAttribute('playsinline', ''); }
      else { node.alt = alt; }
      node.src = url;
      box.insertBefore(node, box.firstChild);
    }
    function note(text) { box.insertBefore(el('p', 'write__medianote', text), box.firstChild); }
    function fetchIt() {
      return api('GET', path(id, src) + '?ref=' + BRANCH, null, 'blob').then(function (blob) {
        pictures[key] = window.URL.createObjectURL(blob);
        show(pictures[key]);
      }, function () { note('(missing: ' + src + ')'); });
    }

    if (/^[a-z]+:|^\/|\.\./i.test(src)) {
      note('(only files of this text can be shown: ' + src + ')');
    } else if (pictures[key]) {
      show(pictures[key]);
    } else if (video) {
      box.insertBefore(quiet('load video ' + src, function (event) {
        var button = event.currentTarget;
        button.disabled = true;
        button.textContent = 'loading ...';
        fetchIt().then(function () { box.removeChild(button); });
      }), box.firstChild);
    } else {
      fetchIt();
    }
    return box;
  }

  function renderText(id, text) {
    var box = el('div', 'post__text write__preview');
    var lines = text.replace(/\r/g, '').split('\n');
    var kind = '';
    var group = [];
    var i, lineText, next, match, node;

    function flush() {
      var block, j, item;
      if (!group.length) { return; }
      if (kind === 'list') {
        block = document.createElement('ul');
        for (j = 0; j < group.length; j++) {
          item = document.createElement('li');
          window.feedInline(item, group[j], false);
          block.appendChild(item);
        }
      } else {
        block = document.createElement(kind === 'quote' ? 'blockquote' : 'p');
        for (j = 0; j < group.length; j++) {
          if (j) { block.appendChild(document.createElement('br')); }
          window.feedInline(block, group[j], false);
        }
      }
      box.appendChild(block);
      group = [];
    }

    for (i = 0; i < lines.length; i++) {
      lineText = lines[i];
      if (!lineText.trim()) { flush(); kind = ''; continue; }
      match = /^(#{1,3})\s+(.*)$/.exec(lineText);
      if (match) {
        flush(); kind = '';
        node = document.createElement('h' + match[1].length);
        window.feedInline(node, match[2], false);
        box.appendChild(node);
        continue;
      }
      match = MEDIA_LINE.exec(lineText);
      if (match) { flush(); kind = ''; box.appendChild(mediaBox(id, match[1], match[2])); continue; }
      if (/^-{3,}\s*$/.test(lineText)) { flush(); kind = ''; box.appendChild(document.createElement('hr')); continue; }
      next = lineText.indexOf('> ') === 0 ? 'quote' : (lineText.indexOf('- ') === 0 ? 'list' : 'text');
      if (next !== kind) { flush(); kind = next; }
      group.push(next === 'text' ? lineText : lineText.slice(2));
    }
    flush();
    if (!box.firstChild) { box.appendChild(el('p', 'posts__note', 'Nothing here yet.')); }
    return box;
  }

  // ---------- Bilder ----------

  // Verkleinert ein Bild und macht ein JPEG daraus (das wirft auch die Kameradaten weg).
  // GIF und SVG bleiben, wie sie sind; was der Browser nicht oeffnen kann, auch.
  function prepare(file) {
    var asIs = { blob: file, ext: (String(file.name).split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg' };
    if (/^video\//.test(file.type)) {
      if (!VIDEO.test('.' + asIs.ext)) { asIs.ext = 'mp4'; }
      return Promise.resolve(asIs);
    }
    if (/gif|svg/.test(file.type)) { return Promise.resolve(asIs); }
    return new Promise(function (resolve) {
      var url = window.URL.createObjectURL(file);
      var img = new window.Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        window.URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) { resolve(blob ? { blob: blob, ext: 'jpg' } : asIs); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { window.URL.revokeObjectURL(url); resolve(asIs); };
      img.src = url;
    });
  }

  function base64Of(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new window.FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1] || ''); };
      reader.onerror = function () { reject(new Error('The picture cannot be read.')); };
      reader.readAsDataURL(blob);
    });
  }

  function send(id, name, blob, tries) {
    return base64Of(blob).then(function (content) {
      return api('PUT', path(id, name), { message: 'write: add file to ' + titleOf(texts[id] ? texts[id].text : ''), content: content, branch: BRANCH });
    }).catch(function (error) {
      if (error.status === 409 && tries > 1) { return send(id, name, blob, tries - 1); }
      throw error;
    });
  }

  // Setzt ein Stueck Text an die Stelle der Schreibmarke, als eigenen Absatz.
  function insertBlock(block) {
    var value = currentText();
    var at = caretOffset();
    var before, after;
    if (at < 0 || at > value.length) { at = value.length; }
    before = value.slice(0, at).replace(/\s+$/, '');
    after = value.slice(at).replace(/^\s+/, '');
    render((before ? before + '\n\n' : '') + block + (after ? '\n\n' + after : ''));
    setCaret((before ? before.length + 2 : 0) + block.length + 2, false);
    typed();
  }

  function addPictures(files) {
    var id = openId;
    var stamp = idNow(new Date());
    var chain = Promise.resolve();
    var count = 0;
    var i;
    if (!id || mode !== 'write') { return; }
    function one(file) {
      if (!/^(image|video)\//.test(file.type)) { say('Only pictures and videos can be added to a text.'); return; }
      if (file.size > MAX_FILE) { say(file.name + ' is larger than 50 mb.', true); return; }
      count++;
      chain = chain.then(function () { return prepare(file); }).then((function (number) {
        return function (ready) {
          var name = stamp + (number > 1 ? '-' + number : '') + '.' + ready.ext;
          pictures[id + '/' + name] = window.URL.createObjectURL(ready.blob);
          if (id === openId) { insertBlock('![](' + name + ')'); }
          uploads++;
          setState('uploading ...');
          return queued(function () { return send(id, name, ready.blob, 3); }).then(function () {
            uploads--;
            if (!uploads && id === openId && !unsaved(texts[id])) { setState('saved'); }
          }, function (error) {
            uploads--;
            say(name + ' was not uploaded (' + explain(error) + '). Add it again.', true);
          });
        };
      }(count)));
    }
    for (i = 0; i < files.length; i++) { one(files[i]); }
  }

  // ---------- Ansichten ----------

  function show(view) {
    tokenForm.hidden = view !== 'token';
    listBox.hidden = view !== 'list';
    sheet.hidden = view !== 'text';
    foot.hidden = view !== 'text';
    homeLink.hidden = view === 'text';
    backButton.hidden = view !== 'text';
    listTools.hidden = view !== 'list';
    textTools.hidden = view !== 'text';
    calm(false);
  }

  // Beim Schreiben tritt die Kopfzeile zurueck; jede Bewegung holt sie wieder.
  function calm(on) { document.body.className = 'editor-page write-page' + (on ? ' write-page--typing' : ''); }

  // ---------- Das Blatt ----------
  // Der Text ist eine einzige Datei. Auf dem Blatt steht er in Stuecken: Textfelder und,
  // wo eine Zeile ein Bild oder Video nennt, das Bild oder Video selbst.

  function parse(value) {
    var out = [];
    var lines = value.split('\n');
    var at = 0, from = 0, i, match;
    function text(to, beforeMedia) {
      var raw = value.slice(from, Math.max(from, to));
      if (out.length) { raw = raw.replace(/^\n+/, ''); }
      if (beforeMedia) { raw = raw.replace(/\n+$/, ''); }
      out.push({ kind: 'text', value: raw });
    }
    for (i = 0; i < lines.length; i++) {
      match = MEDIA_LINE.exec(lines[i]);
      if (match) {
        text(at - 1, true);
        out.push({ kind: 'media', alt: match[1], src: match[2], line: lines[i] });
        from = at + lines[i].length + 1;
      }
      at += lines[i].length + 1;
    }
    text(value.length, false);
    return out;
  }

  function isText(node) { return !!node && node.parentNode === blocks && node.tagName === 'TEXTAREA'; }

  // Der Text, wie er auf dem Blatt steht. Merkt sich dabei, wo jedes Stueck im Text anfaengt.
  function currentText() {
    var out = '';
    var nodes = blocks.children;
    var i, piece;
    for (i = 0; i < nodes.length; i++) {
      piece = isText(nodes[i]) ? nodes[i].value : nodes[i].line;
      nodes[i].start = out.length + (out && piece ? 2 : 0);
      if (piece) { out += (out ? '\n\n' : '') + piece; }
    }
    return out;
  }

  function caretOffset() {
    var node = document.activeElement;
    if (!isText(node)) { return lastCaret; }
    currentText();
    return node.start + node.selectionStart;
  }

  // Setzt die Schreibmarke an eine Stelle des ganzen Textes. quiet: ohne dorthin zu rollen.
  function setCaret(offset, quiet) {
    var nodes = blocks.children;
    var target = null, i;
    currentText();
    for (i = 0; i < nodes.length; i++) {
      if (isText(nodes[i]) && (!target || nodes[i].start <= offset)) { target = nodes[i]; }
    }
    if (!target) { return; }
    try { target.focus({ preventScroll: !!quiet }); } catch (e) { target.focus(); }
    target.selectionStart = target.selectionEnd = Math.max(0, Math.min(target.value.length, offset - target.start));
    lastCaret = offset;
  }

  function mediaBlock(part) {
    var box = mediaBox(openId, part.alt, part.src);
    var caption = el('figcaption', 'write__mediacaption');
    box.line = part.line;
    caption.appendChild(el('span', '', part.src));
    caption.appendChild(quiet('remove', function () {
      blocks.removeChild(box);
      render(currentText());
      typed();
    }));
    box.appendChild(caption);
    return box;
  }

  function render(value) {
    var parts = parse(value);
    var i, node;
    blocks.innerHTML = '';
    for (i = 0; i < parts.length; i++) {
      if (parts[i].kind === 'text') {
        node = el('textarea', 'write__text');
        node.rows = 1;
        node.value = parts[i].value;
        node.setAttribute('aria-label', 'text');
        node.setAttribute('autocapitalize', 'sentences');
      } else {
        node = mediaBlock(parts[i]);
      }
      blocks.appendChild(node);
    }
    if (parts.length === 1) { blocks.firstChild.placeholder = 'write'; }
    lastCaret = -1;
    grow();
  }

  function growOne(node) {
    sheet.style.minHeight = sheet.offsetHeight + 'px';   // sonst springt die Seite, waehrend das Feld kurz klein ist
    node.style.height = 'auto';
    node.style.height = node.scrollHeight + 'px';
    sheet.style.minHeight = '';
  }

  function grow() {
    var nodes = blocks.children;
    var i;
    for (i = 0; i < nodes.length; i++) { if (isText(nodes[i])) { growOne(nodes[i]); } }
  }

  function count() {
    var words = ((texts[openId] ? texts[openId].text : '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').match(/\S+/g) || []).length;
    countLine.textContent = words ? words + (words === 1 ? ' word' : ' words') : '';
  }

  function setMode(next) {
    mode = next;
    blocks.hidden = next !== 'write';
    pane.hidden = next === 'write';
    previewToggle.setAttribute('aria-pressed', next === 'preview' ? 'true' : 'false');
    historyToggle.setAttribute('aria-pressed', next === 'history' || next === 'version' ? 'true' : 'false');
    fileInput.disabled = next !== 'write';
    sheet.className = next === 'write' ? 'write__sheet' : 'write__sheet write__sheet--pane';
    if (next === 'write') { pane.innerHTML = ''; grow(); }
    window.scrollTo(0, 0);
  }

  // Setzt einen neuen Text aufs Blatt und laesst die Schreibmarke moeglichst, wo sie war.
  function replaceText(value) {
    var old = currentText();
    var live = isText(document.activeElement);
    var at = caretOffset();
    var front = 0, back = 0;
    while (front < old.length && front < value.length && old.charAt(front) === value.charAt(front)) { front++; }
    while (back < old.length - front && back < value.length - front &&
      old.charAt(old.length - 1 - back) === value.charAt(value.length - 1 - back)) { back++; }
    render(value);
    if (at > front) { at = at >= old.length - back ? at + value.length - old.length : front; }
    if (live) { setCaret(at, true); }
    count();
  }

  // Der offene Text hat sich von aussen geaendert (anderes Geraet oder ein Agent).
  function arrived(id, before, first) {
    var t = texts[id];
    if (id !== openId || !t) { return; }
    replaceText(t.text);
    if (mode === 'preview') { showPreview(); }
    if (first) { setState('saved'); return; }
    api('GET', '/commits?path=' + id + '/' + FILE + '&sha=' + BRANCH + '&per_page=1').then(function (list) {
      var message = list[0] ? list[0].commit.message.split('\n')[0] : '';
      var label = /^write: /.test(message) || !message ? 'changed on another device' : message;
      showNotice(label + ', ' + when(list[0] ? list[0].commit.committer.date : Date.now()), before);
    }).catch(function () { showNotice('changed elsewhere', before); });
  }

  function showNotice(label, before) {
    notice.innerHTML = '';
    notice.appendChild(el('span', '', label));
    notice.appendChild(quiet('show changes', function () {
      var view = diffView(before, texts[openId].text);
      setMode('diff');
      pane.appendChild(paneHead(label + ': ' + (view.changes === 1 ? '1 change' : view.changes + ' changes'), [quiet('back', function () { setMode('write'); })]));
      pane.appendChild(view);
    }));
    notice.appendChild(quiet('undo', function () {
      texts[openId].text = before;
      texts[openId].changed = Date.now();
      replaceText(before);
      keep(openId);
      hideNotice();
      setMode('write');
      pushNow(false);
    }));
    notice.appendChild(quiet('ok', hideNotice));
    notice.hidden = false;
  }
  function hideNotice() { notice.hidden = true; notice.innerHTML = ''; }

  function paneHead(label, buttons) {
    var head = el('p', 'write__panehead');
    var tools = el('span', 'write__panetools');
    var i;
    head.appendChild(el('span', '', label));
    for (i = 0; i < buttons.length; i++) { tools.appendChild(buttons[i]); }
    head.appendChild(tools);
    return head;
  }

  function showPreview() {
    pane.innerHTML = '';
    pane.appendChild(renderText(openId, texts[openId].text));
  }

  // Verlauf: jede gespeicherte Fassung, neueste oben. Ein Tipp zeigt, was sie geaendert hat.
  function showHistory() {
    var id = openId;
    setMode('history');
    pane.appendChild(el('p', 'posts__note', 'Loading ...'));
    api('GET', '/commits?path=' + id + '/' + FILE + '&sha=' + BRANCH + '&per_page=60').then(function (list) {
      var box = el('div', 'texts');
      var i;
      if (id !== openId || mode !== 'history') { return; }
      function row(index) {
        var commit = list[index];
        var message = commit.commit.message.split('\n')[0];
        var own = /^write: /.test(message);
        var button = el('button', 'texts__item');
        button.type = 'button';
        button.appendChild(el('span', own ? 'texts__meta' : 'texts__title', own ? 'saved' : message));
        button.appendChild(el('span', 'texts__meta', when(commit.commit.committer.date, true)));
        button.addEventListener('click', function () { showVersion(list, index); });
        return button;
      }
      for (i = 0; i < list.length; i++) { box.appendChild(row(i)); }
      pane.innerHTML = '';
      if (!list.length) { pane.appendChild(el('p', 'posts__note', 'Not saved yet.')); return; }
      pane.appendChild(box);
    }).catch(function (error) {
      pane.innerHTML = '';
      pane.appendChild(el('p', 'posts__note', explain(error)));
    });
  }

  function versionText(id, commit) {
    if (!commit) { return Promise.resolve(''); }
    return api('GET', path(id) + '?ref=' + commit.sha).then(function (res) { return decode(res.content); });
  }

  function showVersion(list, index) {
    var id = openId;
    var commit = list[index];
    var message = commit.commit.message.split('\n')[0];
    var label = when(commit.commit.committer.date, true) + (/^write: /.test(message) ? '' : ', ' + message);
    setMode('version');
    pane.appendChild(el('p', 'posts__note', 'Loading ...'));
    Promise.all([versionText(id, list[index + 1]), versionText(id, commit)]).then(function (pair) {
      var view = diffView(pair[0], pair[1]);
      if (id !== openId || mode !== 'version') { return; }
      pane.innerHTML = '';
      pane.appendChild(paneHead(label, [
        quiet('back', showHistory),
        quiet('restore this version', function () {
          texts[id].text = pair[1];
          texts[id].changed = Date.now();
          replaceText(pair[1]);
          keep(id);
          setMode('write');
          pushNow(false);
        })
      ]));
      pane.appendChild(view);
    }).catch(function (error) {
      pane.innerHTML = '';
      pane.appendChild(paneHead(explain(error), [quiet('back', showHistory)]));
    });
  }

  // ---------- Liste ----------

  function showList() {
    var ids = Object.keys(texts);
    var i, t, item;
    function age(id) { return Math.max(texts[id].changed || 0, Date.parse(texts[id].date) || 0); }
    ids.sort(function (a, b) { return age(b) - age(a) || (a < b ? 1 : -1); });
    listBox.innerHTML = '';
    for (i = 0; i < ids.length; i++) {
      t = texts[ids[i]];
      item = el('a', 'texts__item');
      item.href = '#' + ids[i];
      item.appendChild(el('span', 'texts__title', titleOf(t.text)));
      item.appendChild(el('span', 'texts__meta', (unsaved(t) ? 'not synced, ' : '') + when(age(ids[i]))));
      listBox.appendChild(item);
    }
    if (!ids.length) { listBox.appendChild(el('p', 'posts__note', 'No texts yet. Start one with "new".')); }
  }

  // Die Liste mit GitHub abgleichen: neue und geaenderte Texte holen, hier Geschriebenes
  // hinbringen, woanders Geloeschtes entfernen.
  function refreshList() {
    var known = {};
    var id;
    for (id in texts) { if (texts.hasOwnProperty(id)) { known[id] = texts[id].sha; } }
    return api('GET', '/git/trees/' + BRANCH + '?recursive=1').then(function (tree) {
      var found = {};
      var jobs = Promise.resolve();
      var i, match;

      function fetchText(textId, sha) {
        jobs = jobs.then(function () {
          return Promise.all([
            api('GET', '/git/blobs/' + sha),
            api('GET', '/commits?path=' + textId + '/' + FILE + '&sha=' + BRANCH + '&per_page=1')
          ]);
        }).then(function (pair) {
          var content = decode(pair[0].content);
          var t = texts[textId];
          if (t && unsaved(t)) { return; }    // inzwischen hier geschrieben: das klaert sync
          texts[textId] = { text: content, base: content, sha: sha, changed: 0, date: pair[1][0] ? pair[1][0].commit.committer.date : '' };
          keep(textId);
          if (!openId) { showList(); }
        });
      }

      for (i = 0; i < tree.tree.length; i++) {
        match = /^([^\/]+)\/text\.md$/.exec(tree.tree[i].path);
        if (match && tree.tree[i].type === 'blob') { found[match[1]] = tree.tree[i].sha; }
      }
      for (id in found) {
        if (!found.hasOwnProperty(id)) { continue; }
        if (texts[id] && texts[id].sha === found[id] && !unsaved(texts[id])) { continue; }
        if (texts[id] && unsaved(texts[id])) { sync(id).then(function () { if (!openId) { showList(); } }); }
        else { fetchText(id, found[id]); }
      }
      for (id in texts) {
        if (!texts.hasOwnProperty(id) || found[id] || id === openId) { continue; }
        if (unsaved(texts[id])) {
          // nur hier vorhanden: hinbringen (ein woanders geloeschter, hier geaenderter Text entsteht neu)
          if (texts[id].sha) { texts[id].sha = ''; texts[id].base = ''; }
          sync(id).then(function () { if (!openId) { showList(); } });
        } else if (known[id] && known[id] === texts[id].sha) {
          forget(id);                         // woanders geloescht
        }
      }
      if (!openId) { showList(); }
      return jobs;
    });
  }

  // ---------- Wege ----------

  function leave() {
    var id = openId;
    var t = texts[id];
    window.clearTimeout(pushTimer);
    window.clearTimeout(keepTimer);
    window.clearInterval(pollTimer);
    openId = '';
    firstUnsaved = 0;
    hideNotice();
    if (!t) { return; }
    if (!t.sha && !t.text) { forget(id); return; }   // leer und nie gespeichert
    keep(id);
    if (unsaved(t)) { queued(function () { return push(id, 3); }); }
  }

  function openText(id) {
    openId = id;
    show('text');
    setMode('write');
    render(texts[id].text);
    count();
    setState(unsaved(texts[id]) ? '' : (texts[id].sha ? 'saved' : ''));
    if (!texts[id].text) { blocks.firstChild.focus(); }
    sync(id);
    pollTimer = window.setInterval(function () {
      var t = texts[openId];
      if (!t || document.hidden || unsaved(t)) { return; }
      queued(function () { return pull(openId); }).catch(function () { /* ohne Netz: spaeter wieder */ });
    }, POLL);
  }

  function route() {
    var id = decodeURIComponent(window.location.hash.slice(1));
    if (openId) { leave(); }
    if (!token) { show('token'); return; }
    if (id && !/^[\w-]+$/.test(id)) { id = ''; }
    if (id && !texts[id]) {
      // hier unbekannt: vielleicht liegt er auf GitHub
      texts[id] = { text: '', base: '', sha: '', changed: 0, date: '' };
    }
    if (id) { openText(id); return; }
    show('list');
    showList();
    refreshList().catch(function (error) { say(explain(error), true); });
  }

  function typed() {
    var t = texts[openId];
    if (!t) { return; }
    t.text = currentText();
    t.changed = Date.now();
    keepSoon();
    count();
    setState('');
    pushSoon();
  }

  // Der Editor prueft bei jedem Start, ob es eine neuere Fassung von sich gibt.
  function checkVersion() {
    if (!VERSION) { return; }
    window.fetch('../post/version.txt?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.text() : ''; })
      .then(function (text) {
        var latest = text.replace(/\s/g, '');
        if (!latest || latest === VERSION) { return; }
        if (window.location.search.indexOf('v=' + latest) !== -1) { return; }   // schon versucht
        if (openId && unsaved(texts[openId])) { keep(openId); }
        window.location.replace('./?v=' + encodeURIComponent(latest) + window.location.hash);
      })
      .catch(function () { /* ohne Netz: spaeter wieder */ });
  }

  // ---------- Start ----------

  tokenForm.addEventListener('submit', function (event) {
    event.preventDefault();
    token = tokenInput.value.replace(/\s/g, '');
    tokenInput.value = '';
    if (!token) { return; }
    remember(TOKEN_KEY, token);
    route();
  });

  // Zweimal tippen statt eines Dialogs: der erste Tipp fragt nach.
  function twice(button, label, question, action) {
    button.addEventListener('click', function () {
      if (button.textContent !== question) {
        button.textContent = question;
        window.setTimeout(function () { button.textContent = label; }, 4000);
        return;
      }
      button.textContent = label;
      action();
    });
  }

  twice(forgetButton, 'forget token', 'really forget?', function () {
    token = '';
    remember(TOKEN_KEY, '');
    route();
  });

  twice(deleteButton, 'delete', 'really delete?', function () {
    var id = openId;
    var t = texts[id];
    var title = titleOf(t.text);
    window.clearTimeout(pushTimer);
    setState('deleting ...');
    queued(function () { return t.sha ? removeFolder(id, title) : null; }).then(function () {
      forget(id);
      openId = '';
      window.clearInterval(pollTimer);
      window.location.hash = '';
      say('Deleted.');
    }, function (error) { setState(''); say(explain(error), true); });
  });

  newButton.addEventListener('click', function () {
    var id = idNow(new Date());
    texts[id] = { text: '', base: '', sha: '', changed: Date.now(), date: '' };
    window.location.hash = id;
  });

  backButton.addEventListener('click', function () {
    if (mode !== 'write') { setMode('write'); return; }
    window.location.hash = '';
  });

  previewToggle.addEventListener('click', function () {
    if (mode === 'preview') { setMode('write'); return; }
    setMode('preview');
    showPreview();
  });
  historyToggle.addEventListener('click', function () {
    if (mode === 'history' || mode === 'version') { setMode('write'); return; }
    pushNow(false);
    showHistory();
  });

  blocks.addEventListener('input', function (event) {
    if (!isText(event.target)) { return; }
    growOne(event.target);
    typed();
    calm(true);
  });
  // Die Schreibmarke merken, bevor ein Tipp auf "media" sie dem Feld wegnimmt.
  blocks.addEventListener('focusout', function (event) {
    if (isText(event.target)) { currentText(); lastCaret = event.target.start + event.target.selectionStart; }
  });
  document.addEventListener('mousemove', function () { calm(false); });
  document.addEventListener('touchstart', function () { calm(false); }, { passive: true });

  // cmd/ctrl + b und i setzen die Zeichen fuer fett und kursiv um die Auswahl.
  // Pfeil hoch am Anfang und Pfeil runter am Ende eines Stuecks gehen ins Nachbarstueck.
  blocks.addEventListener('keydown', function (event) {
    var field = event.target;
    var mark, start, end, value, other;
    if (!isText(field)) { return; }
    start = field.selectionStart;
    end = field.selectionEnd;
    value = field.value;
    if ((event.key === 'ArrowUp' && start === 0 && end === 0) || (event.key === 'ArrowDown' && start === value.length && end === value.length)) {
      other = field;
      do { other = event.key === 'ArrowUp' ? other.previousElementSibling : other.nextElementSibling; } while (other && !isText(other));
      if (!other) { return; }
      event.preventDefault();
      other.focus();
      other.selectionStart = other.selectionEnd = event.key === 'ArrowUp' ? other.value.length : 0;
      return;
    }
    mark = (event.metaKey || event.ctrlKey) && !event.altKey ? { b: '**', i: '*' }[event.key] : '';
    if (!mark) { return; }
    event.preventDefault();
    field.value = value.slice(0, start) + mark + value.slice(start, end) + mark + value.slice(end);
    field.selectionStart = start + mark.length;
    field.selectionEnd = end + mark.length;
    typed();
  });

  fileInput.addEventListener('change', function () {
    addPictures(fileInput.files || []);
    fileInput.value = '';
  });
  sheet.addEventListener('dragover', function (event) { event.preventDefault(); });
  sheet.addEventListener('drop', function (event) {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files.length) { addPictures(event.dataTransfer.files); }
  });
  blocks.addEventListener('paste', function (event) {
    var files = event.clipboardData && event.clipboardData.files;
    if (files && files.length) { event.preventDefault(); addPictures(files); }
  });

  statusLine.addEventListener('click', function () { say(''); });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', function () { if (openId && mode === 'write') { grow(); } });
  window.addEventListener('online', function () { if (openId) { sync(openId); } });

  // Wird die Seite verlassen oder verdeckt, geht der Stand sofort hinaus;
  // kommt sie wieder, wird nachgesehen, was sich woanders getan hat.
  document.addEventListener('visibilitychange', function () {
    if (!token) { return; }
    if (document.hidden) {
      if (openId) { keep(openId); pushNow(true); }
    } else if (openId) {
      sync(openId);
    } else {
      refreshList().catch(function () { /* ohne Netz: die Liste bleibt, wie sie ist */ });
    }
  });
  window.addEventListener('pagehide', function () { if (openId) { keep(openId); pushNow(true); } });
  window.addEventListener('beforeunload', function (event) {
    if (uploads) { event.preventDefault(); event.returnValue = ''; }
  });

  recallAll();
  token = recall(TOKEN_KEY);
  checkVersion();
  route();
}());
