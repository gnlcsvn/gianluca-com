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
  var formatTools = byId('format-tools');
  var head = byId('head');
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
  var mode = 'write';                 // write, history, version oder diff
  var pushTimer = null;
  var keepTimer = null;
  var pollTimer = null;
  var firstUnsaved = 0;               // seit wann Ungespeichertes da ist
  var uploads = 0;                    // Bilder, die gerade hochgehen
  var pictures = {};                  // '<id>/<name>' -> lokale Adresse des Bildes oder Videos
  var lastRange = null;               // wo die Schreibmarke zuletzt im Blatt stand
  var steps = [];                     // Staende des offenen Textes, zum Zuruecknehmen: {text, place}
  var undone = [];                    // zurueckgenommene Staende, zum Wiederholen
  var recordTimer = null;
  var lastRecord = 0;
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

  // ---------- Bilder und Videos ----------

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

  // Setzt ein Bild oder Video unter die Zeile, in der die Schreibmarke steht,
  // mit einer Leerzeile davor und danach.
  function insertMedia(name) {
    var figure = mediaBlock({ alt: '', src: name, line: '![](' + name + ')' });
    var block = lastRange && blocks.contains(lastRange.startContainer) ? topBlock(lastRange.startContainer) : null;
    function blank(node) { return !!node && node.nodeName === 'DIV' && !node.textContent; }
    if (!block) { block = blocks.lastChild; }
    if (block && !blank(block)) {
      blocks.insertBefore(lineNode(''), block.nextSibling);
      block = block.nextSibling;
    }
    blocks.insertBefore(figure, block ? block.nextSibling : null);
    if (!blank(figure.nextSibling)) { blocks.insertBefore(lineNode(''), figure.nextSibling); }
    blocks.focus();
    placeCaret(Array.prototype.indexOf.call(blocks.childNodes, figure.nextSibling), 0);
    typed();
  }

  function upload(id, name, blob) {
    uploads++;
    setState('uploading ...');
    return queued(function () { return send(id, name, blob, 3); }).then(function () {
      uploads--;
      if (!uploads && id === openId && !unsaved(texts[id])) { setState('saved'); }
    }, function (error) {
      uploads--;
      say(name + ' was not uploaded (' + explain(error) + '). Add it again.', true);
    });
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
          if (id === openId) { insertMedia(name); }
          return upload(id, name, ready.blob);
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
    formatTools.hidden = view !== 'text';
    calm(false);
    pinHead();
  }

  // Beim Schreiben tritt die Kopfzeile zurueck; jede Bewegung holt sie wieder.
  function calm(on) { document.body.className = 'editor-page write-page' + (on ? ' write-page--typing' : ''); }

  // ---------- Das Blatt ----------
  // Gespeichert wird einfacher Text: Zeile fuer Zeile, **fett**, *kursiv*, [Text](Adresse),
  // und ein Bild oder Video als eigene Zeile ![](datei). Auf dem Blatt sieht man davon nichts:
  // fett ist fett, ein Bild ist das Bild. Das Blatt ist ein einziges Feld zum Schreiben,
  // darin je Zeile ein <div> und je Bild oder Video ein <figure>.

  var INLINE = /(\*\*\*[^*\n]+?\*\*\*|\*\*(?:[^*\n]|\*(?!\*))+?\*\*|\*(?![*\s])(?:[^*\n]|\*\*[^*\n]+?\*\*)*?[^*\s]\*(?!\*)|\[[^\]\n]+?\]\((?:https?:\/\/|mailto:)[^\s)]+\))/;

  // Text einer Zeile -> Elemente.
  function fillInline(node, text) {
    var parts = text.split(INLINE);
    var i, part, child, inner, match;
    for (i = 0; i < parts.length; i++) {
      part = parts[i];
      if (!part) { continue; }
      if (i % 2 === 0) { node.appendChild(document.createTextNode(part)); continue; }
      if (part.charAt(0) === '[') {
        match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        child = document.createElement('a');
        child.setAttribute('href', match[2]);
        fillInline(child, match[1]);
      } else if (part.indexOf('***') === 0) {
        child = document.createElement('strong');
        inner = document.createElement('em');
        fillInline(inner, part.slice(3, -3));
        child.appendChild(inner);
      } else if (part.indexOf('**') === 0) {
        child = document.createElement('strong');
        fillInline(child, part.slice(2, -2));
      } else {
        child = document.createElement('em');
        fillInline(child, part.slice(1, -1));
      }
      node.appendChild(child);
    }
  }

  function lineNode(text) {
    var div = document.createElement('div');
    if (text) { fillInline(div, text); } else { div.appendChild(document.createElement('br')); }
    return div;
  }

  // Die Zeichen kommen eng um den Text, Leerzeichen bleiben draussen: sonst gilt es nicht als fett.
  function marked(mark, inner) {
    var lines = inner.split('\n');
    var i, m;
    for (i = 0; i < lines.length; i++) {
      m = /^(\s*)([\s\S]*?)(\s*)$/.exec(lines[i]);
      if (m[2]) { lines[i] = m[1] + mark + m[2] + mark + m[3]; }
    }
    return lines.join('\n');
  }

  // Elemente -> Text. Ein Umbruch und ein eingeschachtelter Absatz werden eine neue Zeile.
  function textOf(node) {
    var out = '';
    var kids = node.childNodes;
    var i, child, tag, inner, href, weight;
    for (i = 0; i < kids.length; i++) {
      child = kids[i];
      if (child.nodeType === 3) { out += child.nodeValue.replace(/ /g, ' ').replace(/[​﻿]/g, ''); continue; }
      if (child.nodeType !== 1) { continue; }
      tag = child.tagName;
      if (tag === 'BR') { out += '\n'; continue; }
      if (tag === 'FIGURE') { out += (out && !/\n$/.test(out) ? '\n' : '') + (child.line || '') + '\n'; continue; }
      inner = textOf(child);
      if (tag === 'DIV' || tag === 'P' || tag === 'LI' || tag === 'BLOCKQUOTE') {
        if (child.lastChild && child.lastChild.nodeName === 'BR' && /\n$/.test(inner)) { inner = inner.slice(0, -1); }
        out += (out && !/\n$/.test(out) ? '\n' : '') + inner + '\n';
        continue;
      }
      weight = child.style ? child.style.fontWeight : '';
      if (tag === 'B' || tag === 'STRONG' || weight === 'bold' || parseInt(weight, 10) >= 600) { inner = marked('**', inner); }
      if (tag === 'I' || tag === 'EM' || (child.style && child.style.fontStyle === 'italic')) { inner = marked('*', inner); }
      if (tag === 'A') {
        href = child.getAttribute('href') || '';
        if (inner && /^(https?:\/\/|mailto:)[^\s)]+$/.test(href)) { inner = '[' + inner.replace(/\n/g, ' ') + '](' + href + ')'; }
      }
      out += inner;
    }
    return out;
  }

  // Der Text, wie er auf dem Blatt steht.
  function currentText() {
    var lines = [];
    var stray = null;
    var kids = blocks.childNodes;
    var i, child, inner, holder;
    function flush() { if (stray !== null) { lines.push(stray.replace(/\n$/, '')); stray = null; } }
    for (i = 0; i < kids.length; i++) {
      child = kids[i];
      if (child.nodeType === 1 && child.tagName === 'FIGURE') { flush(); lines.push(child.line || ''); continue; }
      if (child.nodeType === 1 && (child.tagName === 'DIV' || child.tagName === 'P')) {
        flush();
        inner = textOf(child);
        if (child.lastChild && child.lastChild.nodeName === 'BR' && /\n$/.test(inner)) { inner = inner.slice(0, -1); }
        lines.push(inner.replace(/\n$/, ''));   // endet die Zeile mit einem eingeschachtelten Absatz, bleibt sein Umbruch uebrig
        continue;
      }
      // Text, der ohne Zeile direkt im Blatt steht (nach "alles loeschen")
      holder = document.createElement('span');
      holder.appendChild(child.cloneNode(true));
      stray = (stray === null ? '' : stray) + textOf(holder);
    }
    flush();
    return lines.join('\n');
  }

  function topBlock(node) {
    while (node && node.parentNode !== blocks) { node = node.parentNode; }
    return node;
  }

  // Wo die Schreibmarke steht: Nummer der Zeile und Stelle darin.
  function caretPlace() {
    var sel = window.getSelection();
    var block, range;
    if (document.activeElement !== blocks || !sel.rangeCount || !blocks.contains(sel.anchorNode)) { return null; }
    block = topBlock(sel.anchorNode);
    if (!block) { return null; }
    range = document.createRange();
    range.selectNodeContents(block);
    range.setEnd(sel.anchorNode, sel.anchorOffset);
    return { line: Array.prototype.indexOf.call(blocks.childNodes, block), at: range.toString().length };
  }

  function placeCaret(line, at) {
    var block = blocks.childNodes[Math.max(0, Math.min(line, blocks.childNodes.length - 1))];
    var sel = window.getSelection();
    var range = document.createRange();
    var walker, node, last = null;
    while (block && block.nodeName === 'FIGURE' && block.nextSibling) { block = block.nextSibling; }
    if (!block) { return; }
    walker = document.createTreeWalker(block, 4, null, false);   // 4: nur Text
    while ((node = walker.nextNode())) {
      last = node;
      if (at <= node.nodeValue.length) { break; }
      at -= node.nodeValue.length;
    }
    if (last) { range.setStart(last, Math.min(at, last.nodeValue.length)); } else { range.setStart(block, 0); }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    lastRange = range.cloneRange();
  }

  function mediaBlock(part) {
    var box = mediaBox(openId, part.alt, part.src);
    var caption = el('figcaption', 'write__mediacaption');
    box.line = part.line;
    box.contentEditable = 'false';
    var tools = el('span', 'write__mediatools');
    caption.appendChild(el('span', '', part.src));
    if (!VIDEO.test(part.src) && !/\.(gif|svg)$/i.test(part.src)) {
      tools.appendChild(quiet('edit', function () { showCrop(box, part); }));
    }
    tools.appendChild(quiet('remove', function () {
      blocks.removeChild(box);
      typed();
    }));
    caption.appendChild(tools);
    box.appendChild(caption);
    return box;
  }

  // ---------- Bild zuschneiden ----------
  // Ein Rahmen ueber dem Bild, an den Ecken zu ziehen und als Ganzes zu verschieben.
  // Gespeichert wird der Ausschnitt als neue Datei; das Original bleibt fuer aeltere Fassungen liegen.
  function showCrop(box, part) {
    var id = openId;
    var key = id + '/' + part.src;
    var crop = { x: 0, y: 0, w: 1, h: 1 };       // Anteile des Bildes
    var SMALLEST = 0.05;
    var corners = ['nw', 'ne', 'sw', 'se'];
    var drag = null;
    var stage, clip, shade, img, frame, handle, i;

    if (!pictures[key]) { say('The picture is still loading.'); return; }

    function limit(value, low, high) { return Math.max(low, Math.min(high, value)); }
    function place() {
      var both = [frame, shade];
      var k;
      for (k = 0; k < both.length; k++) {
        both[k].style.left = (crop.x * 100) + '%';
        both[k].style.top = (crop.y * 100) + '%';
        both[k].style.width = (crop.w * 100) + '%';
        both[k].style.height = (crop.h * 100) + '%';
      }
    }
    function move(event) {
      var rect = stage.getBoundingClientRect();
      var dx = (event.clientX - drag.x) / rect.width;
      var dy = (event.clientY - drag.y) / rect.height;
      var from = drag.from;
      var right = from.x + from.w, bottom = from.y + from.h;
      if (!drag.corner) {
        crop.x = limit(from.x + dx, 0, 1 - from.w);
        crop.y = limit(from.y + dy, 0, 1 - from.h);
      } else {
        if (drag.corner.charAt(1) === 'w') { crop.x = limit(from.x + dx, 0, right - SMALLEST); crop.w = right - crop.x; }
        else { crop.w = limit(from.w + dx, SMALLEST, 1 - from.x); }
        if (drag.corner.charAt(0) === 'n') { crop.y = limit(from.y + dy, 0, bottom - SMALLEST); crop.h = bottom - crop.y; }
        else { crop.h = limit(from.h + dy, SMALLEST, 1 - from.y); }
      }
      place();
    }
    function drop() {
      drag = null;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', drop);
      document.removeEventListener('pointercancel', drop);
    }
    function save() {
      var canvas = document.createElement('canvas');
      if (crop.w > 0.995 && crop.h > 0.995) { setMode('write'); return; }   // nichts weggeschnitten
      canvas.width = Math.max(1, Math.round(crop.w * img.naturalWidth));
      canvas.height = Math.max(1, Math.round(crop.h * img.naturalHeight));
      canvas.getContext('2d').drawImage(img, Math.round(crop.x * img.naturalWidth), Math.round(crop.y * img.naturalHeight),
        canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        var name = idNow(new Date()) + '.jpg';
        var fresh;
        if (!blob) { say('The picture cannot be cropped.', true); return; }
        if (name === part.src) { name = name.replace('.jpg', '-2.jpg'); }
        fresh = { alt: part.alt, src: name, line: '![' + part.alt + '](' + name + ')' };
        pictures[id + '/' + name] = window.URL.createObjectURL(blob);
        if (id !== openId) { return; }
        setMode('write');
        if (box.parentNode === blocks) { blocks.replaceChild(mediaBlock(fresh), box); }
        else { render(texts[id].text.split(part.line).join(fresh.line)); }   // das Blatt wurde inzwischen neu gesetzt
        typed();
        upload(id, name, blob);
      }, 'image/jpeg', 0.9);
    }

    setMode('crop');
    stage = el('div', 'write__crop');
    img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.src = pictures[key];
    frame = el('div', 'write__cropframe');
    for (i = 0; i < corners.length; i++) {
      handle = el('div', 'write__crophandle write__crophandle--' + corners[i]);
      handle.setAttribute('data-corner', corners[i]);
      frame.appendChild(handle);
    }
    // Das Abdunkeln ist auf das Bild beschnitten, der Rahmen mit seinen Griffen nicht:
    // sonst waeren die Griffe am Bildrand nur halb zu sehen.
    clip = el('div', 'write__cropclip');
    shade = el('div', 'write__cropshade');
    clip.appendChild(img);
    clip.appendChild(shade);
    stage.appendChild(clip);
    stage.appendChild(frame);
    stage.addEventListener('pointerdown', function (event) {
      var corner = event.target.getAttribute('data-corner') || '';
      if (!corner && event.target !== frame) { return; }
      event.preventDefault();
      drag = { x: event.clientX, y: event.clientY, corner: corner, from: { x: crop.x, y: crop.y, w: crop.w, h: crop.h } };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', drop);
      document.addEventListener('pointercancel', drop);
    });
    pane.appendChild(paneHead('crop', [quiet('cancel', function () { setMode('write'); }), quiet('save', save)]));
    pane.appendChild(stage);
    place();
  }

  function render(value) {
    var lines = value.split('\n');
    var i, match;
    blocks.innerHTML = '';
    for (i = 0; i < lines.length; i++) {
      match = MEDIA_LINE.exec(lines[i]);
      blocks.appendChild(match ? mediaBlock({ alt: match[1], src: match[2], line: lines[i] }) : lineNode(lines[i]));
    }
    // ueber dem ersten und unter dem letzten Bild muss sich schreiben lassen
    if (blocks.firstChild.nodeName === 'FIGURE') { blocks.insertBefore(lineNode(''), blocks.firstChild); }
    if (blocks.lastChild.nodeName === 'FIGURE') { blocks.appendChild(lineNode('')); }
    blocks.className = value ? 'write__rich' : 'write__rich write__rich--empty';
    lastRange = null;
  }

  function count() {
    var plain = (texts[openId] ? texts[openId].text : '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\]\([^)\s]*\)/g, ' ').replace(/[*\[]/g, '');
    var words = (plain.match(/\S+/g) || []).length;
    countLine.textContent = words ? words + (words === 1 ? ' word' : ' words') : '';
  }

  // ---------- Zuruecknehmen und wiederholen ----------
  // Der Editor fuehrt die Staende selbst. Das eigene "rueckgaengig" des Browsers kommt
  // durcheinander, sobald ein Bild eingesetzt wird oder eine Aenderung von aussen ankommt.

  function record() {
    var t = texts[openId];
    var last = steps[steps.length - 1];
    window.clearTimeout(recordTimer);
    if (!t || (last && last.text === t.text)) { return; }
    steps.push({ text: t.text, place: caretPlace() });
    if (steps.length > 300) { steps.shift(); }
    undone = [];
    lastRecord = Date.now();
    showFormat();
  }

  // Ein Stand je Schreibpause, bei langem Schreiben am Stueck alle paar Sekunden einer.
  function recordSoon() {
    window.clearTimeout(recordTimer);
    if (Date.now() - lastRecord > 2500) { record(); return; }
    recordTimer = window.setTimeout(record, 500);
  }

  function applyStep(step) {
    var t = texts[openId];
    t.text = step.text;
    t.changed = Date.now();
    render(step.text);
    if (step.place) { blocks.focus(); placeCaret(step.place.line, step.place.at); }
    keepSoon();
    count();
    setState('');
    pushSoon();
    showFormat();
  }

  function undo() {
    if (mode !== 'write' || !texts[openId]) { return; }
    record();
    if (steps.length < 2) { return; }
    undone.push(steps.pop());
    applyStep(steps[steps.length - 1]);
  }

  function redo() {
    var step;
    if (mode !== 'write' || !texts[openId] || !undone.length) { return; }
    step = undone.pop();
    steps.push(step);
    applyStep(step);
  }

  // Fett, kursiv, Link: der Browser setzt es an der Auswahl um, und "rueckgaengig" nimmt es zurueck.
  function format(kind) {
    var sel = window.getSelection();
    var range, url, node;
    if (mode !== 'write') { return; }
    blocks.focus();
    if ((!sel.rangeCount || !blocks.contains(sel.anchorNode)) && lastRange) { sel.removeAllRanges(); sel.addRange(lastRange); }
    if (kind !== 'link') { document.execCommand(kind, false, null); showFormat(); return; }
    node = sel.anchorNode;
    while (node && node !== blocks && node.nodeName !== 'A') { node = node.parentNode; }
    if (node && node.nodeName === 'A') {            // steht schon in einem Link: der Link geht weg
      range = document.createRange();
      range.selectNodeContents(node);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('unlink', false, null);
      return;
    }
    if (sel.isCollapsed) { say('Select the words for the link first.'); return; }
    range = sel.getRangeAt(0).cloneRange();
    url = (window.prompt('link address', 'https://') || '').trim();
    if (!/^(https?:\/\/|mailto:)[^\s)]+$/.test(url) || url === 'https://') { return; }
    blocks.focus();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('createLink', false, url);
  }

  // Die Kopfzeile steht fest am oberen Rand des Fensters (position: fixed, nur im Stylesheet);
  // die Seite beginnt um ihre Hoehe tiefer. Mehr nicht: die Kopfzeile wird nie per Skript
  // verschoben. Ein Nachschieben um visualViewport.offsetTop liess sie am Telefon wandern,
  // weil der Browser sie dort schon selbst am sichtbaren Rand haelt.
  function pinHead() {
    page.style.paddingTop = head.offsetHeight + 'px';
  }

  // Die Knoepfe der Leiste zeigen, was an der Schreibmarke gilt.
  function showFormat() {
    var buttons = formatTools.querySelectorAll('button[data-format]');
    var stepButtons = document.querySelectorAll('button[data-step]');
    var t = texts[openId];
    var i, on;
    for (i = 0; i < stepButtons.length; i++) {
      stepButtons[i].disabled = stepButtons[i].getAttribute('data-step') === 'undo'
        ? !(t && steps.length && (steps.length > 1 || steps[0].text !== t.text))
        : !undone.length;
    }
    for (i = 0; i < buttons.length; i++) {
      on = false;
      try { on = buttons[i].getAttribute('data-format') !== 'link' && document.queryCommandState(buttons[i].getAttribute('data-format')); } catch (e) { /* dann eben aus */ }
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function setMode(next) {
    mode = next;
    blocks.hidden = next !== 'write';
    formatTools.hidden = next !== 'write';
    pinHead();
    pane.hidden = next === 'write';
    historyToggle.setAttribute('aria-pressed', next === 'history' || next === 'version' ? 'true' : 'false');
    fileInput.disabled = next !== 'write';
    sheet.className = next === 'write' ? 'write__sheet' : 'write__sheet write__sheet--pane';
    if (next === 'write') { pane.innerHTML = ''; }
    window.scrollTo(0, 0);
  }

  // Setzt einen neuen Text aufs Blatt und laesst die Schreibmarke moeglichst in ihrer Zeile.
  function replaceText(value) {
    var place = caretPlace();
    var old = currentText().split('\n');
    var fresh = value.split('\n');
    var front = 0, back = 0, line;
    while (front < old.length && front < fresh.length && old[front] === fresh[front]) { front++; }
    while (back < old.length - front && back < fresh.length - front && old[old.length - 1 - back] === fresh[fresh.length - 1 - back]) { back++; }
    render(value);
    if (place) {
      line = place.line;
      if (line >= front) { line = line >= old.length - back ? line + fresh.length - old.length : front; }
      placeCaret(line, place.at);
    }
    count();
    if (!steps.length || steps[steps.length - 1].text !== value) { steps.push({ text: value, place: caretPlace() }); undone = []; }
    showFormat();
  }

  // Der offene Text hat sich von aussen geaendert (anderes Geraet oder ein Agent).
  function arrived(id, before, first) {
    var t = texts[id];
    if (id !== openId || !t) { return; }
    replaceText(t.text);
    if (first) { steps = [{ text: t.text, place: null }]; undone = []; setState('saved'); return; }   // der erste Stand ist der geladene Text, nicht das leere Blatt
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
    steps = [{ text: texts[id].text, place: null }];
    undone = [];
    lastRecord = 0;
    showFormat();
    count();
    setState(unsaved(texts[id]) ? '' : (texts[id].sha ? 'saved' : ''));
    if (!texts[id].text) { blocks.focus(); placeCaret(0, 0); }
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
    recordSoon();
    t.changed = Date.now();
    blocks.className = t.text ? 'write__rich' : 'write__rich write__rich--empty';
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

  historyToggle.addEventListener('click', function () {
    if (mode === 'history' || mode === 'version') { setMode('write'); return; }
    pushNow(false);
    showHistory();
  });

  blocks.addEventListener('input', function () { typed(); calm(true); });

  // Die Schreibmarke merken: ein Tipp auf "media" oder auf die Leiste nimmt sie dem Blatt weg.
  document.addEventListener('selectionchange', function () {
    var sel = window.getSelection();
    if (sel.rangeCount && blocks.contains(sel.anchorNode)) { lastRange = sel.getRangeAt(0).cloneRange(); showFormat(); }
  });

  // cmd/ctrl + b fett, + i kursiv, + k Link. Die Tasten werden hier selbst behandelt:
  // sonst macht mancher Browser damit etwas Eigenes auf (Firefox: Lesezeichen, Seiteninfo).
  blocks.addEventListener('keydown', function (event) {
    var command = (event.metaKey || event.ctrlKey) && !event.altKey;
    var key = String(event.key).toLowerCase();
    var kind = command && !event.shiftKey ? { b: 'bold', i: 'italic', k: 'link' }[key] : '';
    // cmd/ctrl + z nimmt zurueck; mit Umschalttaste (oder ctrl + y) wird wiederholt
    if (command && (key === 'z' || (key === 'y' && !event.shiftKey))) {
      event.preventDefault();
      if (key === 'y' || event.shiftKey) { redo(); } else { undo(); }
      return;
    }
    if (!kind) { return; }
    event.preventDefault();
    format(kind);
  });

  window.addEventListener('resize', pinHead);

  // Zuruecknehmen ueber das Menue des Browsers oder das Schuetteln am Telefon geht denselben Weg.
  blocks.addEventListener('beforeinput', function (event) {
    if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') { return; }
    event.preventDefault();
    if (event.inputType === 'historyUndo') { undo(); } else { redo(); }
  });
  // Die Knoepfe in der Kopfzeile: fett, kursiv, Link, zurueck, vor.
  // Ein Tipp auf sie darf dem Blatt die Auswahl nicht nehmen.
  formatTools.addEventListener('mousedown', function (event) { event.preventDefault(); });
  formatTools.addEventListener('click', function (event) {
    var button = event.target;
    while (button && button !== formatTools && button.nodeName !== 'BUTTON') { button = button.parentNode; }
    if (!button || button === formatTools || button.disabled) { return; }
    if (button.getAttribute('data-step') === 'undo') { undo(); }
    else if (button.getAttribute('data-step') === 'redo') { redo(); }
    else if (button.getAttribute('data-format')) { format(button.getAttribute('data-format')); }
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
  // Eingefuegt wird nur der reine Text: was er woanders an Form hatte, bleibt draussen.
  // Eine Adresse auf markierten Worten macht daraus einen Link.
  blocks.addEventListener('paste', function (event) {
    var data = event.clipboardData;
    var sel = window.getSelection();
    var pasted;
    if (!data) { return; }
    event.preventDefault();
    if (data.files && data.files.length) { addPictures(data.files); return; }
    pasted = data.getData('text/plain').replace(/\r/g, '');
    if (!sel.isCollapsed && /^https?:\/\/[^\s)]+$/.test(pasted.trim())) { document.execCommand('createLink', false, pasted.trim()); return; }
    document.execCommand('insertText', false, pasted);
  });

  statusLine.addEventListener('click', function () { say(''); });
  window.addEventListener('hashchange', route);
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

  try {
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('defaultParagraphSeparator', false, 'div');
  } catch (e) { /* dann wie der Browser will */ }

  recallAll();
  token = recall(TOKEN_KEY);
  checkVersion();
  route();
}());
