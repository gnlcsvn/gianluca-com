// Editor fuer den Feed. Schreibt Posts als Commit ins Repository, ueber die GitHub-API.
// Das Token liegt nur im Speicher dieses Browsers und geht nur an api.github.com.
(function () {
  var postForm = document.getElementById('post-form');
  if (!postForm) { return; }

  var API = 'https://api.github.com/repos/gnlcsvn/gianluca-com';
  var BRANCH = 'main';
  var FEED = 'feed/';                 // Ordner im Repository
  var FILE = FEED + 'posts.json';
  var TOKEN_KEY = 'feed-token';
  var MAX_EDGE = 2000;                // Bilder werden auf diese Kantenlaenge verkleinert
  var MAX_FILE = 50 * 1024 * 1024;    // groessere Dateien lehnt der Editor ab
  // Die Fassung dieses Editors: die Nummer hinter v= am eigenen <script>.
  var VERSION = ((document.currentScript && document.currentScript.src || '').match(/[?&]v=(\w+)/) || [])[1] || '';

  function byId(id) { return document.getElementById(id); }

  var tokenForm = byId('token-form');
  var tokenInput = byId('token');
  var forgetButton = byId('forget');
  var refreshButton = byId('refresh');
  var textLabel = byId('text-label');
  var textInput = byId('text');
  var fileInput = byId('files');
  var mediaButton = byId('media-button');
  var attachmentList = byId('attachments');
  var formatToggle = byId('format-toggle');
  var previewToggle = byId('preview-toggle');
  var tools = byId('tools');
  var linkToggle = byId('link-toggle');
  var linkForm = byId('link-form');
  var linkText = byId('link-text');
  var linkUrl = byId('link-url');
  var linkInsert = byId('link-insert');
  var preview = byId('preview');
  var cancelButton = byId('cancel');
  var submitButton = byId('submit');
  var statusLine = byId('status');
  var liveLine = byId('live');
  var list = byId('list');

  var token = '';
  var busy = false;
  var current = [];                   // die Posts, wie sie auf GitHub stehen
  var attachments = [];               // was am neuen Post haengt: {file, kind, url, name, width, height}
  var editing = '';                   // id des Posts, der gerade bearbeitet wird
  var syncTimer = null;
  var tickTimer = null;
  var syncStart = 0;
  var fresh = {};                     // gerade hochgeladene Dateien: Pfad -> lokale Adresse

  // ---------- kleine Helfer ----------

  // Die Zeile unten am Fensterrand. Erfolgsmeldungen gehen nach ein paar Sekunden
  // von selbst weg; Fehler (stay) bleiben stehen, bis man sie antippt.
  var sayTimer = null;
  function say(message, stay) {
    window.clearTimeout(sayTimer);
    statusLine.textContent = message;
    if (message && !stay && !/\.\.\.$/.test(message)) {
      sayTimer = window.setTimeout(function () { statusLine.textContent = ''; }, 6000);
    }
  }

  function two(n) { return n < 10 ? '0' + n : String(n); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text) { node.appendChild(document.createTextNode(text)); }
    return node;
  }

  function remember(key, value) {
    try {
      if (value) { window.localStorage.setItem(key, value); }
      else { window.localStorage.removeItem(key); }
    } catch (e) { /* privates Fenster: gilt dann nur bis zum Schliessen */ }
  }
  function recall(key) {
    try { return window.localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function setBusy(value) {
    var buttons = list.querySelectorAll('button');
    var i;
    busy = value;
    submitButton.disabled = value;
    for (i = 0; i < buttons.length; i++) { buttons[i].disabled = value; }
  }

  // Zeit mit Zeitzone, z.B. 2026-11-21T09:30:00+01:00
  function isoNow(d) {
    var off = -d.getTimezoneOffset();
    var sign = off >= 0 ? '+' : '-';
    off = Math.abs(off);
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) +
      'T' + two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()) +
      sign + two(Math.floor(off / 60)) + ':' + two(off % 60);
  }
  function idNow(d) {
    return String(d.getFullYear()) + two(d.getMonth() + 1) + two(d.getDate()) +
      '-' + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
  }

  function megabytes(bytes) {
    if (bytes < 1024 * 1024) { return Math.max(1, Math.round(bytes / 1024)) + ' kb'; }
    return (Math.round(bytes / 1024 / 1024 * 10) / 10) + ' mb';
  }

  function extension(name, fallback) {
    var parts = String(name).split('.');
    var ext = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    return ext || fallback;
  }

  // ---------- GitHub ----------

  function api(method, path, body, raw) {
    var options = {
      method: method,
      // Nie aus dem Zwischenspeicher: sonst sieht der Editor einen alten Stand
      // und der naechste Post scheitert ("not a fast forward").
      cache: 'no-store',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (body) { options.body = JSON.stringify(body); }
    return fetch(API + path, options).then(function (res) {
      if (res.ok) { return raw ? res.text() : res.json(); }
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

  // Eine Datei hochladen. Anders als fetch meldet XMLHttpRequest, wie weit es ist.
  // Bricht die Verbindung ab, wird es noch einmal versucht.
  function upload(data, progress, tries) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      function fail(message, status) {
        var error = new Error(message);
        error.status = status || 0;
        error.network = !status;
        reject(error);
      }
      xhr.open('POST', API + '/git/blobs');
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.setRequestHeader('Accept', 'application/vnd.github+json');
      xhr.setRequestHeader('X-GitHub-Api-Version', '2022-11-28');
      xhr.upload.onprogress = function (event) {
        if (event.lengthComputable) { progress(event.loaded / event.total); }
      };
      xhr.onload = function () {
        var body = {};
        try { body = JSON.parse(xhr.responseText); } catch (e) { /* kein JSON */ }
        if (xhr.status >= 200 && xhr.status < 300 && body.sha) { resolve(body); }
        else { fail(body.message || String(xhr.status), xhr.status || 500); }
      };
      xhr.onerror = function () { fail('connection lost'); };
      xhr.onabort = function () { fail('connection lost'); };
      xhr.ontimeout = function () { fail('connection lost'); };
      xhr.send(JSON.stringify({ content: data, encoding: 'base64' }));
    }).catch(function (error) {
      if (error.network && tries > 1) {
        progress(0);
        return new Promise(function (resolve) { window.setTimeout(resolve, 2000); })
          .then(function () { return upload(data, progress, tries - 1); });
      }
      throw error;
    });
  }

  // Solange hochgeladen wird, soll der Bildschirm nicht ausgehen: sonst haelt das
  // Telefon die App an und der Upload bricht ab. Geht nicht in jedem Browser.
  var wakeLock = null;
  function keepAwake(on) {
    try {
      if (on && navigator.wakeLock) {
        navigator.wakeLock.request('screen').then(function (lock) { wakeLock = lock; }).catch(function () {});
      } else if (!on && wakeLock) {
        wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { /* ohne Wake Lock geht es auch */ }
  }

  // Der aktuelle Stand: letzter Commit, sein Dateibaum und der Inhalt von posts.json.
  function loadState() {
    var state = {};
    return api('GET', '/git/ref/heads/' + BRANCH)
      .then(function (ref) {
        state.head = ref.object.sha;
        return api('GET', '/git/commits/' + state.head);
      })
      .then(function (commit) {
        state.tree = commit.tree.sha;
        state.when = commit.committer && commit.committer.date;   // wann zuletzt etwas geaendert wurde
        return api('GET', '/contents/' + FILE + '?ref=' + state.head, null, true)
          .then(function (text) { return JSON.parse(text); })
          .catch(function (error) {
            if (error.status === 404) { return { posts: [] }; }
            throw error;
          });
      })
      .then(function (data) {
        if (!data.posts) { data.posts = []; }
        state.data = data;
        return state;
      });
  }

  // Ein Commit mit allen Aenderungen auf einmal. entries: Dateien, die neu sind oder wegfallen.
  function commit(state, entries, message) {
    entries.push({
      path: FILE, mode: '100644', type: 'blob',
      content: JSON.stringify(state.data, null, 2) + '\n'
    });
    return api('POST', '/git/trees', { base_tree: state.tree, tree: entries })
      .then(function (tree) {
        return api('POST', '/git/commits', { message: message, tree: tree.sha, parents: [state.head] });
      })
      .then(function (made) {
        return api('PATCH', '/git/refs/heads/' + BRANCH, { sha: made.sha });
      });
  }

  // change(state) traegt die Aenderung in state.data ein und gibt die Dateien zurueck.
  // Hat sich das Repository inzwischen geaendert, wird neu geladen und wiederholt.
  function save(change, message, tries) {
    return loadState().then(function (state) {
      var entries = change(state);
      return commit(state, entries, message).then(function () { return state; });
    }).catch(function (error) {
      if ((error.status === 409 || error.status === 422) && tries > 1) {
        return new Promise(function (resolve) { window.setTimeout(resolve, 1500); })
          .then(function () { return save(change, message, tries - 1); });
      }
      throw error;
    });
  }

  function explain(error) {
    // Safari nennt einen Abbruch der Verbindung "Load failed", andere "Failed to fetch".
    if (error.network || /load failed|failed to fetch|networkerror/i.test(error.message)) {
      return 'The connection broke off. Nothing was posted and your draft is still here. Keep the app open and tap post again.';
    }
    if (!error.status) { return error.message; }
    if (error.status === 401) { return 'GitHub does not accept this token. Use "forget token" and paste a new one.'; }
    if (error.status === 403 || error.status === 404) { return 'The token may not write to this repository (' + error.message + ').'; }
    if (error.status === 409 || error.status === 422) { return 'GitHub did not take the change (' + error.message + '). Nothing was saved. Try again.'; }
    return 'That did not work: ' + error.message;
  }

  // ---------- Dateien: annehmen ----------

  var KINDS = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif', 'svg', 'bmp', 'tif', 'tiff'],
    video: ['mp4', 'mov', 'm4v', 'webm'],
    audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac']
  };

  function kindOf(file) {
    var type = file.type || '';
    var ext = extension(file.name, '');
    var kind;
    if (type.indexOf('image/') === 0) { return 'image'; }
    if (type.indexOf('video/') === 0) { return 'video'; }
    if (type.indexOf('audio/') === 0) { return 'audio'; }
    for (kind in KINDS) {
      if (KINDS.hasOwnProperty(kind) && KINDS[kind].indexOf(ext) !== -1) { return kind; }
    }
    return 'file';
  }

  function addFiles(files) {
    var i, file;
    if (editing) { say('Media of an existing post cannot be changed.'); return; }
    for (i = 0; i < files.length; i++) {
      file = files[i];
      if (file.size > MAX_FILE) { say('"' + file.name + '" is larger than 50 MB and was left out.'); continue; }
      attachments.push({ file: file, kind: kindOf(file), url: URL.createObjectURL(file), name: file.name });
    }
    showAttachments();
    showPreview();
  }

  function dropAttachments() {
    var i;
    for (i = 0; i < attachments.length; i++) { URL.revokeObjectURL(attachments[i].url); }
    attachments = [];
    fileInput.value = '';
    showAttachments();
  }

  // Je Datei ein Kaestchen: klein zu sehen, verschiebbar, entfernbar.
  function showAttachments() {
    attachmentList.innerHTML = '';
    attachmentList.hidden = !attachments.length;
    attachments.forEach(function (item, index) {
      var li = el('li', 'attachments__item');
      var bar = el('div', 'attachments__bar');
      var thumb;

      function measured(width, height) {
        if (item.width || !width) { return; }
        item.width = width;
        item.height = height;
        showPreview();
      }
      function control(label, title, action, disabled) {
        var button = el('button', 'editor__quiet', label);
        button.type = 'button';
        button.title = title;
        button.setAttribute('aria-label', title + ': ' + item.name);
        button.disabled = !!disabled;
        button.addEventListener('click', action);
        bar.appendChild(button);
      }

      if (item.kind === 'image') {
        thumb = el('img', 'attachments__thumb');
        thumb.alt = item.name;
        thumb.addEventListener('load', function () { measured(thumb.naturalWidth, thumb.naturalHeight); });
        // Kann der Browser das Bild nicht zeigen, geht es als Datei mit.
        thumb.addEventListener('error', function () { item.kind = 'file'; showAttachments(); showPreview(); });
        thumb.src = item.url;
      } else if (item.kind === 'video') {
        thumb = el('video', 'attachments__thumb');
        thumb.muted = true;
        thumb.preload = 'metadata';
        thumb.setAttribute('playsinline', '');
        thumb.addEventListener('loadedmetadata', function () { measured(thumb.videoWidth, thumb.videoHeight); });
        thumb.src = item.url;
      } else {
        thumb = el('span', 'attachments__thumb attachments__thumb--name', extension(item.name, item.kind));
      }
      thumb.title = item.name;
      li.appendChild(thumb);
      li.appendChild(el('span', 'attachments__size', megabytes(item.file.size)));

      control('←', 'move left', function () { move(index, -1); }, index === 0);
      control('→', 'move right', function () { move(index, 1); }, index === attachments.length - 1);
      control('remove', 'remove', function () {
        URL.revokeObjectURL(item.url);
        attachments.splice(index, 1);
        showAttachments();
        showPreview();
      });
      li.appendChild(bar);
      attachmentList.appendChild(li);
    });
  }

  function move(index, step) {
    var item = attachments.splice(index, 1)[0];
    attachments.splice(index + step, 0, item);
    showAttachments();
    showPreview();
  }

  // ---------- Dateien: zum Hochladen vorbereiten ----------

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = function () { reject(new Error('The file could not be read.')); };
      reader.readAsDataURL(blob);
    });
  }

  function asFile(item) {
    return { type: 'file', ext: extension(item.name, 'bin'), blob: item.file, name: item.name, size: item.file.size };
  }

  // Bilder: verkleinern und als JPEG speichern. Dabei fallen auch die Kameradaten
  // (Ort, Datum) weg. GIF und SVG bleiben, wie sie sind.
  function prepareImage(item) {
    return new Promise(function (resolve) {
      var file = item.file;
      var ext = extension(file.name, 'jpg');
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        var width = Math.round(img.naturalWidth * scale);
        var height = Math.round(img.naturalHeight * scale);
        var canvas, context;
        if (file.type === 'image/gif' || file.type === 'image/svg+xml' || ext === 'gif' || ext === 'svg') {
          resolve({ type: 'image', ext: ext, blob: file, width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
          return;
        }
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(img, 0, 0, width, height);
        canvas.toBlob(function (blob) {
          if (!blob) { resolve(asFile(item)); return; }
          resolve({ type: 'image', ext: 'jpg', blob: blob, width: width, height: height });
        }, 'image/jpeg', 0.85);
      };
      // Ein Bildformat, das dieser Browser nicht oeffnen kann: als Datei anhaengen.
      img.onerror = function () { resolve(asFile(item)); };
      img.src = item.url;
    });
  }

  // Ein Standbild vom Anfang des Videos, als Vorschaubild im Feed. Gelingt es dem
  // Browser nicht (oder dauert es zu lange), geht das Video ohne Vorschaubild hoch.
  function videoPoster(url) {
    return new Promise(function (resolve) {
      var video = document.createElement('video');
      var finished = false;
      function finish(blob, width, height) {
        if (finished) { return; }
        finished = true;
        video.removeAttribute('src');
        video.load();
        resolve(blob ? { blob: blob, width: width, height: height } : null);
      }
      function draw() {
        var scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight, 1));
        var canvas = document.createElement('canvas');
        if (!video.videoWidth) { finish(null); return; }
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        try {
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) { finish(blob, video.videoWidth, video.videoHeight); }, 'image/jpeg', 0.8);
        } catch (e) { finish(null); }
      }
      video.muted = true;
      video.preload = 'auto';
      video.setAttribute('playsinline', '');
      video.addEventListener('loadeddata', function () {
        // ein Stueck hinter den Anfang springen: das allererste Bild ist oft schwarz
        try { video.currentTime = Math.min(0.5, (video.duration || 1) / 2); } catch (e) { draw(); }
      });
      video.addEventListener('seeked', draw);
      video.addEventListener('error', function () { finish(null); });
      window.setTimeout(function () { finish(null); }, 8000);
      video.src = url;
      video.load();
    });
  }

  function prepare(item) {
    if (item.kind === 'image') { return prepareImage(item); }
    if (item.kind === 'video') {
      return videoPoster(item.url).then(function (poster) {
        return {
          type: 'video', ext: extension(item.name, 'mp4'), blob: item.file,
          width: (poster && poster.width) || item.width || 0,
          height: (poster && poster.height) || item.height || 0,
          poster: poster ? poster.blob : null
        };
      });
    }
    if (item.kind === 'audio') {
      return Promise.resolve({ type: 'audio', ext: extension(item.name, 'mp3'), blob: item.file, name: item.name });
    }
    return Promise.resolve(asFile(item));
  }

  // Der Reihe nach, nicht gleichzeitig: schont den Speicher auf dem Telefon.
  function inOrder(items, work) {
    var results = [];
    return items.reduce(function (chain, item, index) {
      return chain.then(function () { return work(item, index); })
        .then(function (result) { results.push(result); });
    }, Promise.resolve()).then(function () { return results; });
  }

  // ---------- Posten ----------

  function publish() {
    var text = textInput.value.replace(/\s+$/, '');
    var now = new Date();
    var id = idNow(now);
    var media = [];

    if (!text && !attachments.length) { say('Write something or add a file.'); return; }

    setBusy(true);
    say(attachments.length ? 'Preparing files ...' : 'Posting ...');

    keepAwake(true);
    // Erst die Dateien hochladen, dann alles in einem Commit eintragen. Was schon
    // oben ist (item.done), wird bei einem zweiten Versuch nicht noch einmal geschickt.
    inOrder(attachments, function (item, index) {
      var label = 'Uploading ' + (index + 1) + ' of ' + attachments.length;
      if (item.done) { return item.done; }
      say('Preparing ' + (index + 1) + ' of ' + attachments.length + ' ...');
      return prepare(item)
        .then(function (ready) {
          say(label + ' ...');
          return toBase64(ready.blob).then(function (data) {
            return upload(data, function (part) { say(label + ', ' + Math.round(part * 100) + ' % ...'); }, 3);
          }).then(function (blob) {
            if (!ready.poster) { return { sha: blob.sha }; }
            return toBase64(ready.poster)
              .then(function (data) { return upload(data, function () {}, 3); })
              .then(function (poster) { return { sha: blob.sha, poster: poster.sha }; });
          }).then(function (shas) {
            item.done = { ready: ready, sha: shas.sha, poster: shas.poster };
            return item.done;
          });
        });
    })
      .then(function (done) {
        var entries = [];
        done.forEach(function (one, index) {
          var ready = one.ready;
          var name = id + '-' + (index + 1) + '.' + ready.ext;
          var entry = { type: ready.type, src: 'media/' + name };
          if (ready.width) { entry.width = ready.width; entry.height = ready.height; }
          if (ready.name) { entry.name = ready.name; }
          if (ready.size) { entry.size = ready.size; }
          media.push(entry);
          // Bis die Website neu gebaut ist, zeigt der Editor die Datei von hier.
          fresh[entry.src] = URL.createObjectURL(ready.blob);
          entries.push({ path: FEED + 'media/' + name, mode: '100644', type: 'blob', sha: one.sha });
          if (one.poster) {
            entry.poster = 'media/' + id + '-' + (index + 1) + '-poster.jpg';
            fresh[entry.poster] = URL.createObjectURL(ready.poster);
            entries.push({ path: FEED + entry.poster, mode: '100644', type: 'blob', sha: one.poster });
          }
        });
        return entries;
      })
      .then(function (entries) {
        say('Posting ...');
        return save(function (state) {
          state.data.posts.unshift({ id: id, date: isoNow(now), text: text, media: media });
          return entries.slice();
        }, 'Feed: add post ' + id, 3);
      })
      .then(function (state) {
        clearEditor();
        showList(state.data.posts);
        say('Posted. It shows up in the feed within a minute.');
      })
      .catch(function (error) { say(explain(error), true); })
      .then(function () { keepAwake(false); setBusy(false); });
  }

  // ---------- Bearbeiten ----------

  function findPost(posts, id) {
    var i;
    for (i = 0; i < posts.length; i++) { if (posts[i].id === id) { return posts[i]; } }
    return null;
  }

  function startEdit(id) {
    var post = findPost(current, id);
    if (!post || busy) { return; }
    dropAttachments();
    editing = id;
    textInput.value = post.text || '';
    textLabel.textContent = 'edit post';
    submitButton.textContent = 'save';
    cancelButton.hidden = false;
    mediaButton.hidden = true;
    say('');
    grow();
    showPreview();
    window.scrollTo(0, 0);
    textInput.focus();
  }

  function clearEditor() {
    editing = '';
    textInput.value = '';
    textLabel.textContent = 'new post';
    submitButton.textContent = 'post';
    cancelButton.hidden = true;
    mediaButton.hidden = false;
    dropAttachments();
    closeLink();
    grow();
    showPreview();
  }

  function saveEdit() {
    var id = editing;
    var text = textInput.value.replace(/\s+$/, '');
    var old = findPost(current, id);
    if (!text && !(old && old.media && old.media.length)) { say('The post would be empty. Delete it instead.'); return; }
    setBusy(true);
    say('Saving ...');
    save(function (state) {
      var post = findPost(state.data.posts, id);
      if (!post) { throw new Error('This post no longer exists.'); }
      post.text = text;
      post.edited = isoNow(new Date());
      return [];
    }, 'Feed: edit post ' + id, 3)
      .then(function (state) {
        clearEditor();
        showList(state.data.posts);
        say('Saved. The feed shows the change within a minute.');
      })
      .catch(function (error) { say(explain(error), true); })
      .then(function () { setBusy(false); });
  }

  // ---------- Loeschen ----------

  // article ist der Post in der Liste: dort steht auch, was gerade passiert.
  function remove(id, article) {
    var state = article.querySelector('.post__state');
    if (busy) { return; }
    if (editing === id) { clearEditor(); }
    setBusy(true);
    article.className = 'post post--leaving';
    state.className = 'post__state';
    state.textContent = 'deleting ...';
    say('Deleting ...');
    save(function (data) {
      var entries = [];
      var kept = [];
      var i, j, post;
      for (i = 0; i < data.data.posts.length; i++) {
        post = data.data.posts[i];
        if (post.id !== id) { kept.push(post); continue; }
        for (j = 0; j < (post.media || []).length; j++) {
          // sha null heisst: diese Datei faellt mit dem Commit weg
          entries.push({ path: FEED + post.media[j].src, mode: '100644', type: 'blob', sha: null });
          if (post.media[j].poster) {
            entries.push({ path: FEED + post.media[j].poster, mode: '100644', type: 'blob', sha: null });
          }
        }
      }
      data.data.posts = kept;
      return entries;
    }, 'Feed: delete post ' + id, 3)
      .then(function (data) {
        showList(data.data.posts);
        say('Deleted. It disappears from the feed within a minute.');
      })
      .catch(function (error) {
        article.className = 'post';
        state.className = 'post__state post__state--error';
        state.textContent = 'not deleted';
        say(explain(error), true);
      })
      .then(function () { setBusy(false); });
  }

  // ---------- Werkzeuge fuer den Text ----------
  // Die Werkzeuge setzen nur Zeichen in den Text; js/feed.js macht daraus die Form.

  function grow() {
    textInput.style.height = 'auto';
    textInput.style.height = (textInput.scrollHeight + 2) + 'px';
  }

  function changed() {
    grow();
    showPreview();
  }

  function replaceSelection(text, selectFrom, selectTo) {
    var start = textInput.selectionStart;
    var end = textInput.selectionEnd;
    textInput.focus();
    textInput.setRangeText(text, start, end, 'end');
    if (selectFrom !== undefined) { textInput.setSelectionRange(start + selectFrom, start + selectTo); }
    changed();
  }

  // Zeichen um die Auswahl setzen, oder wieder wegnehmen, wenn sie schon da sind.
  function wrap(mark, placeholder) {
    var value = textInput.value;
    var start = textInput.selectionStart;
    var end = textInput.selectionEnd;
    var chosen = value.slice(start, end);
    var n = mark.length;
    if (value.slice(start - n, start) === mark && value.slice(end, end + n) === mark) {
      textInput.focus();
      textInput.setRangeText(chosen, start - n, end + n, 'select');
      changed();
      return;
    }
    if (!chosen) { chosen = placeholder; }
    replaceSelection(mark + chosen + mark, n, n + chosen.length);
  }

  // Ein Zeichen an den Anfang jeder gewaehlten Zeile setzen, oder wieder wegnehmen.
  function prefix(mark) {
    var value = textInput.value;
    var start = value.lastIndexOf('\n', textInput.selectionStart - 1) + 1;
    var end = value.indexOf('\n', textInput.selectionEnd);
    var lines, all, i, text;
    if (end === -1) { end = value.length; }
    lines = value.slice(start, end).split('\n');
    all = true;
    for (i = 0; i < lines.length; i++) { if (lines[i].indexOf(mark) !== 0) { all = false; } }
    for (i = 0; i < lines.length; i++) {
      lines[i] = all ? lines[i].slice(mark.length) : (lines[i].indexOf(mark) === 0 ? lines[i] : mark + lines[i]);
    }
    text = lines.join('\n');
    textInput.focus();
    textInput.setRangeText(text, start, end, 'select');
    changed();
  }

  function openLink() {
    var chosen = textInput.value.slice(textInput.selectionStart, textInput.selectionEnd);
    linkForm.hidden = false;
    linkToggle.setAttribute('aria-expanded', 'true');
    if (/^https?:\/\/\S+$/.test(chosen)) { linkUrl.value = chosen; linkText.value = ''; }
    else { linkText.value = chosen; linkUrl.value = ''; }
    (linkText.value ? linkUrl : linkText).focus();
  }

  function closeLink() {
    linkForm.hidden = true;
    linkToggle.setAttribute('aria-expanded', 'false');
    linkText.value = '';
    linkUrl.value = '';
  }

  function insertLink() {
    var url = linkUrl.value.replace(/\s/g, '');
    var label = linkText.value.replace(/[\[\]]/g, '').replace(/^\s+|\s+$/g, '');
    if (!url) { linkUrl.focus(); return; }
    if (!/^(https?:\/\/|mailto:)/.test(url)) { url = 'https://' + url; }
    url = url.replace(/\)/g, '%29');
    closeLink();
    replaceSelection(label ? '[' + label + '](' + url + ')' : url);
  }

  function useTool(name) {
    if (name === 'bold') { wrap('**', 'bold'); }
    if (name === 'italic') { wrap('*', 'italic'); }
    if (name === 'code') { wrap('`', 'code'); }
    if (name === 'quote') { prefix('> '); }
    if (name === 'list') { prefix('- '); }
    if (name === 'link') { if (linkForm.hidden) { openLink(); } else { closeLink(); textInput.focus(); } }
  }

  function setOpen(toggle, panel, open, key) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (key) { remember(key, open ? 'open' : 'closed'); }
  }

  // ---------- Vorschau ----------

  // Der Post, wie er im Feed aussehen wird, mit den Dateien direkt vom Geraet.
  function showPreview() {
    var text = textInput.value.replace(/\s+$/, '');
    var old = editing ? findPost(current, editing) : null;
    var media = [];
    var base = '';
    var i, item, swap, src;
    if (preview.hidden) { return; }
    preview.innerHTML = '';
    if (old) {
      media = old.media || [];
      base = '../feed/';
    } else {
      for (i = 0; i < attachments.length; i++) {
        item = attachments[i];
        media.push({ type: item.kind, src: item.url, width: item.width, height: item.height, name: item.name, size: item.file.size });
      }
    }
    if (!text && !media.length) {
      preview.appendChild(el('p', 'posts__note', 'Nothing to preview yet.'));
      return;
    }
    preview.appendChild(window.feedBuildPost({
      id: 'preview', date: old ? old.date : isoNow(new Date()), text: text, media: media
    }, base, true));
    preview.querySelector('.post').removeAttribute('id');
    if (old) {
      swap = preview.querySelectorAll('.post__media');
      for (i = 0; i < swap.length; i++) {
        src = swap[i].getAttribute('src').replace('../feed/', '').replace(/#.*$/, '');
        if (fresh[src]) { swap[i].src = fresh[src]; }
      }
    }
  }

  // ---------- Die Liste der vorhandenen Posts ----------

  // Die Liste zeigt die Posts wie im Feed, je mit Knoepfen zum Bearbeiten und Loeschen.
  // since: seit wann die Website nachziehen muss. Beim Neuladen ist das der Zeitpunkt
  // der letzten Aenderung auf GitHub, damit der Zaehler nicht wieder bei 0 anfaengt.
  function showList(posts, since) {
    var articles, media, src, poster, i;
    current = posts;
    window.feedRender(list, posts, '../feed/');
    articles = list.querySelectorAll('.post');
    for (i = 0; i < articles.length; i++) { addControls(articles[i]); }
    media = list.querySelectorAll('.post__media, .post__file');
    for (i = 0; i < media.length; i++) {
      src = (media[i].getAttribute('src') || media[i].getAttribute('href')).replace('../feed/', '').replace(/#.*$/, '');
      poster = (media[i].getAttribute('poster') || '').replace('../feed/', '');
      if (fresh[poster]) { media[i].poster = fresh[poster]; }
      if (!fresh[src]) { continue; }
      if (media[i].hasAttribute('href')) { media[i].href = fresh[src]; } else { media[i].src = fresh[src]; }
    }
    syncStart = since && !isNaN(Date.parse(since)) ? Math.min(Date.now(), Date.parse(since)) : Date.now();
    sync();
  }

  function addControls(article) {
    var head = article.querySelector('.post__head');
    var box = el('span', 'post__controls');
    var state = el('span', 'post__state');
    var edit = el('button', 'editor__quiet', 'edit');
    var del = el('button', 'editor__quiet', 'delete');
    // Rueckfrage direkt am Post statt in einem Dialog des Browsers
    var ask = el('span', 'post__ask');
    var yes = el('button', 'editor__quiet post__yes', 'yes, delete');
    var no = el('button', 'editor__quiet', 'no');

    function asking(on) {
      ask.hidden = !on;
      edit.hidden = on;
      del.hidden = on;
      state.hidden = on;
    }

    edit.type = del.type = yes.type = no.type = 'button';
    edit.addEventListener('click', function () { startEdit(article.id); });
    del.addEventListener('click', function () { asking(true); yes.focus(); });
    no.addEventListener('click', function () { asking(false); del.focus(); });
    yes.addEventListener('click', function () { asking(false); remove(article.id, article); });

    ask.appendChild(yes);
    ask.appendChild(no);
    box.appendChild(state);
    box.appendChild(edit);
    box.appendChild(del);
    box.appendChild(ask);
    head.appendChild(box);
    asking(false);
  }

  // ---------- Ist es schon live? ----------

  // GitHub hat die Aenderung sofort, die Website erst nach dem Neubau. sync() fragt
  // die Website alle paar Sekunden, bis sie dieselben Posts zeigt wie GitHub, und
  // markiert solange jeden Post, der dort noch fehlt oder noch den alten Text hat.
  function tick() {
    var seconds = Math.round((Date.now() - syncStart) / 1000);
    liveLine.textContent = 'updating the website ... ' + seconds + ' s' +
      (seconds > 180 ? ' (longer than usual)' : '');
  }

  function sync() {
    window.clearTimeout(syncTimer);
    fetch('../feed/posts.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : { posts: [] }; })
      .catch(function () { return null; })
      .then(function (data) {
        var live = {};
        var mine = {};
        var waiting = 0;
        var seconds = Math.round((Date.now() - syncStart) / 1000);
        var articles = list.querySelectorAll('.post');
        var i, state, post;

        if (!data) {
          window.clearInterval(tickTimer);
          tickTimer = null;
          liveLine.textContent = 'cannot reach the website, trying again ...';
          syncTimer = window.setTimeout(sync, 5000);
          return;
        }
        for (i = 0; i < (data.posts || []).length; i++) { live[data.posts[i].id] = data.posts[i]; }
        for (i = 0; i < current.length; i++) { mine[current[i].id] = current[i]; }

        for (i = 0; i < articles.length; i++) {
          state = articles[i].querySelector('.post__state');
          post = live[articles[i].id];
          if (articles[i].className !== 'post' || state.className.indexOf('--error') !== -1) { continue; }
          if (post && post.text === mine[articles[i].id].text) {
            state.textContent = 'live';
            state.className = 'post__state post__state--live';
          } else {
            state.textContent = 'publishing ...';
            state.className = 'post__state';
            waiting++;
          }
        }
        // geloeschte Posts, die auf der Website noch stehen
        for (i = 0; i < (data.posts || []).length; i++) {
          if (!mine[data.posts[i].id]) { waiting++; }
        }

        if (!waiting) {
          window.clearInterval(tickTimer);
          tickTimer = null;
          liveLine.textContent = 'the website is up to date';
          return;
        }
        // Gefragt wird alle 3 Sekunden, die Anzeige zaehlt jede Sekunde.
        tick();
        if (!tickTimer) { tickTimer = window.setInterval(tick, 1000); }
        syncTimer = window.setTimeout(sync, seconds > 180 ? 10000 : 3000);
      });
  }

  // ---------- Neuere Fassung des Editors? ----------

  // Der Browser (und die App auf dem Homescreen) haelt die Seite eine Weile fest.
  // version.txt wird immer frisch geholt: steht dort eine andere Nummer als die
  // dieses Skripts, laedt sich der Editor unter neuer Adresse selbst neu.
  function checkVersion() {
    if (!VERSION) { return; }
    fetch('version.txt?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.text() : ''; })
      .then(function (text) {
        var latest = text.replace(/\s/g, '');
        if (!latest || latest === VERSION) { return; }
        if (window.location.search.indexOf('v=' + latest) !== -1) { return; }   // schon versucht
        if (busy || textInput.value || attachments.length) { return; }          // nichts Ungespeichertes verlieren
        window.location.replace('./?v=' + encodeURIComponent(latest));
      })
      .catch(function () { /* ohne Netz: spaeter wieder */ });
  }

  // ---------- Anzeige ----------

  function showEditor() {
    tokenForm.hidden = true;
    postForm.hidden = false;
    forgetButton.hidden = false;
    refreshButton.hidden = false;
    grow();
    say('Loading ...');
    loadState()
      .then(function (state) { showList(state.data.posts, state.when); say(''); })
      .catch(function (error) { say(explain(error), true); });
  }

  function showTokenForm() {
    postForm.hidden = true;
    forgetButton.hidden = true;
    refreshButton.hidden = true;
    window.clearTimeout(syncTimer);
    window.clearInterval(tickTimer);
    tickTimer = null;
    liveLine.textContent = '';
    tokenForm.hidden = false;
    list.innerHTML = '';
    say('');
  }

  // ---------- Start ----------

  tokenForm.addEventListener('submit', function (event) {
    event.preventDefault();
    token = tokenInput.value.replace(/\s/g, '');
    tokenInput.value = '';
    if (!token) { return; }
    remember(TOKEN_KEY, token);
    showEditor();
  });

  // Zweimal tippen statt eines Dialogs: der erste Tipp fragt nach.
  forgetButton.addEventListener('click', function () {
    if (forgetButton.textContent !== 'really forget?') {
      forgetButton.textContent = 'really forget?';
      window.setTimeout(function () { forgetButton.textContent = 'forget token'; }, 4000);
      return;
    }
    forgetButton.textContent = 'forget token';
    token = '';
    remember(TOKEN_KEY, '');
    showTokenForm();
  });

  postForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) { return; }
    if (editing) { saveEdit(); } else { publish(); }
  });

  cancelButton.addEventListener('click', function () { clearEditor(); say(''); });
  statusLine.addEventListener('click', function () { say(''); });

  fileInput.addEventListener('change', function () {
    addFiles(fileInput.files || []);
    fileInput.value = '';
  });

  // Dateien auf den Editor ziehen oder aus der Zwischenablage einfuegen.
  postForm.addEventListener('dragover', function (event) { event.preventDefault(); });
  postForm.addEventListener('drop', function (event) {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files.length) { addFiles(event.dataTransfer.files); }
  });
  textInput.addEventListener('paste', function (event) {
    var files = event.clipboardData && event.clipboardData.files;
    if (files && files.length) { event.preventDefault(); addFiles(files); }
  });

  textInput.addEventListener('input', changed);
  textInput.addEventListener('keydown', function (event) {
    var key = (event.key || '').toLowerCase();
    if (!(event.metaKey || event.ctrlKey) || event.altKey) { return; }
    if (key === 'b') { event.preventDefault(); useTool('bold'); }
    if (key === 'i') { event.preventDefault(); useTool('italic'); }
    if (key === 'k') {
      event.preventDefault();
      setOpen(formatToggle, tools, true, 'feed-format');
      if (linkForm.hidden) { openLink(); }
    }
    if (key === 'enter') { event.preventDefault(); if (!busy) { if (editing) { saveEdit(); } else { publish(); } } }
  });

  tools.addEventListener('click', function (event) {
    var name = event.target.getAttribute && event.target.getAttribute('data-tool');
    if (name) { useTool(name); }
  });
  // Ein Tipp auf ein Werkzeug soll die Auswahl im Text nicht aufheben.
  tools.addEventListener('mousedown', function (event) {
    if (event.target.getAttribute && event.target.getAttribute('data-tool')) { event.preventDefault(); }
  });

  linkInsert.addEventListener('click', insertLink);
  linkForm.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') { event.preventDefault(); insertLink(); }
    if (event.key === 'Escape') { closeLink(); textInput.focus(); }
  });

  formatToggle.addEventListener('click', function () {
    setOpen(formatToggle, tools, tools.hidden, 'feed-format');
  });
  previewToggle.addEventListener('click', function () {
    setOpen(previewToggle, preview, preview.hidden, 'feed-preview');
    showPreview();
  });

  // Die App auf dem Homescreen hat keinen Knopf zum Neuladen: hier ist einer,
  // und beim Zurueckkommen in die App wird von selbst neu geladen.
  refreshButton.addEventListener('click', function () {
    checkVersion();
    if (token && !busy) { showEditor(); }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { return; }
    checkVersion();
    if (token && !busy) { showEditor(); }
  });

  // Werkzeuge: am grossen Bildschirm von Anfang an offen, am Telefon erst auf Wunsch.
  (function () {
    var format = recall('feed-format');
    var wide = window.matchMedia && window.matchMedia('(min-width: 641px)').matches;
    setOpen(formatToggle, tools, format ? format === 'open' : wide);
    setOpen(previewToggle, preview, recall('feed-preview') === 'open');
  })();

  checkVersion();
  token = recall(TOKEN_KEY);
  if (token) { showEditor(); } else { showTokenForm(); }
})();
