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
  var MAX_VIDEO = 50 * 1024 * 1024;   // groessere Videos lehnt der Editor ab

  var tokenForm = document.getElementById('token-form');
  var tokenInput = document.getElementById('token');
  var forgetButton = document.getElementById('forget');
  var textInput = document.getElementById('text');
  var fileInput = document.getElementById('files');
  var fileList = document.getElementById('file-list');
  var submitButton = document.getElementById('submit');
  var statusLine = document.getElementById('status');
  var list = document.getElementById('list');
  var liveLine = document.getElementById('live');
  var refreshButton = document.getElementById('refresh');

  var token = '';
  var busy = false;
  var current = [];                   // die Posts, wie sie auf GitHub stehen
  var syncTimer = null;
  var syncStart = 0;
  var fresh = {};                     // gerade hochgeladene Dateien: Pfad -> lokale Adresse

  // ---------- kleine Helfer ----------

  function say(message) { statusLine.textContent = message; }

  function two(n) { return n < 10 ? '0' + n : String(n); }

  function readToken() {
    try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function writeToken(value) {
    try {
      if (value) { window.localStorage.setItem(TOKEN_KEY, value); }
      else { window.localStorage.removeItem(TOKEN_KEY); }
    } catch (e) { /* privates Fenster: das Token gilt dann nur bis zum Schliessen */ }
  }

  function setBusy(value) {
    busy = value;
    submitButton.disabled = value;
    var buttons = list.querySelectorAll('button');
    var i;
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
        try { message = JSON.parse(text).message || ''; } catch (e) { /* kein JSON */ }
        var error = new Error(message || String(res.status));
        error.status = res.status;
        throw error;
      });
    });
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
    if (error.status === 401) { return 'GitHub does not accept this token. Use "forget token" and paste a new one.'; }
    if (error.status === 403 || error.status === 404) { return 'The token may not write to this repository (' + error.message + ').'; }
    if (error.status === 409 || error.status === 422) { return 'GitHub did not take the change (' + error.message + '). Nothing was posted. Try again.'; }
    return 'That did not work: ' + error.message;
  }

  // ---------- Bilder und Videos vorbereiten ----------

  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = function () { reject(new Error('The file could not be read.')); };
      reader.readAsDataURL(blob);
    });
  }

  // Bilder: verkleinern und als JPEG speichern. Dabei fallen auch die Kameradaten
  // (Ort, Datum) weg. GIFs bleiben, wie sie sind, damit sie sich weiter bewegen.
  function prepareImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        var width = Math.round(img.naturalWidth * scale);
        var height = Math.round(img.naturalHeight * scale);
        var canvas, context;
        if (file.type === 'image/gif') {
          URL.revokeObjectURL(url);
          resolve({ type: 'image', ext: 'gif', blob: file, width: img.naturalWidth, height: img.naturalHeight });
          return;
        }
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob) { reject(new Error('The picture could not be converted.')); return; }
          resolve({ type: 'image', ext: 'jpg', blob: blob, width: width, height: height });
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('"' + file.name + '" is not a picture this browser can open.'));
      };
      img.src = url;
    });
  }

  function prepareVideo(file) {
    var ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (file.size > MAX_VIDEO) {
      return Promise.reject(new Error('"' + file.name + '" is larger than 50 MB.'));
    }
    return Promise.resolve({ type: 'video', ext: ext || 'mp4', blob: file });
  }

  function prepare(file) {
    if (file.type.indexOf('video/') === 0) { return prepareVideo(file); }
    return prepareImage(file);
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
    var files = Array.prototype.slice.call(fileInput.files || []);
    var now = new Date();
    var id = idNow(now);
    var media = [];

    if (!text && !files.length) { say('Write something or add a picture.'); return; }

    setBusy(true);
    say(files.length ? 'Preparing files ...' : 'Posting ...');

    inOrder(files, prepare)
      .then(function (items) {
        // Erst die Dateien hochladen, dann alles in einem Commit eintragen.
        return inOrder(items, function (item, index) {
          var name = id + '-' + (index + 1) + '.' + item.ext;
          say('Uploading ' + (index + 1) + ' of ' + items.length + ' ...');
          return toBase64(item.blob)
            .then(function (data) { return api('POST', '/git/blobs', { content: data, encoding: 'base64' }); })
            .then(function (blob) {
              var entry = { type: item.type, src: 'media/' + name };
              if (item.width) { entry.width = item.width; entry.height = item.height; }
              media.push(entry);
              // Bis die Website neu gebaut ist, zeigt der Editor die Datei von hier.
              fresh[entry.src] = URL.createObjectURL(item.blob);
              return { path: FEED + 'media/' + name, mode: '100644', type: 'blob', sha: blob.sha };
            });
        });
      })
      .then(function (entries) {
        say('Posting ...');
        return save(function (state) {
          state.data.posts.unshift({ id: id, date: isoNow(now), text: text, media: media });
          return entries.slice();
        }, 'Feed: add post ' + id, 3);
      })
      .then(function (state) {
        textInput.value = '';
        fileInput.value = '';
        showFiles();
        showList(state.data.posts);
        say('Posted. It shows up in the feed within a minute.');
      })
      .catch(function (error) { say(error.status ? explain(error) : error.message); })
      .then(function () { setBusy(false); });
  }

  // ---------- Loeschen ----------

  function remove(id) {
    if (busy) { return; }
    if (!window.confirm('Delete this post?')) { return; }
    setBusy(true);
    say('Deleting ...');
    save(function (state) {
      var entries = [];
      var kept = [];
      var i, j, post;
      for (i = 0; i < state.data.posts.length; i++) {
        post = state.data.posts[i];
        if (post.id !== id) { kept.push(post); continue; }
        for (j = 0; j < (post.media || []).length; j++) {
          // sha null heisst: diese Datei faellt mit dem Commit weg
          entries.push({ path: FEED + post.media[j].src, mode: '100644', type: 'blob', sha: null });
        }
      }
      state.data.posts = kept;
      return entries;
    }, 'Feed: delete post ' + id, 3)
      .then(function (state) {
        showList(state.data.posts);
        say('Deleted. It disappears from the feed within a minute.');
      })
      .catch(function (error) { say(error.status ? explain(error) : error.message); })
      .then(function () { setBusy(false); });
  }

  // ---------- Anzeige ----------

  function showFiles() {
    var files = fileInput.files || [];
    var i, li;
    fileList.innerHTML = '';
    for (i = 0; i < files.length; i++) {
      li = document.createElement('li');
      li.appendChild(document.createTextNode(files[i].name));
      fileList.appendChild(li);
    }
  }

  // Die Liste zeigt die Posts wie im Feed, je mit einem Knopf zum Loeschen.
  function showList(posts) {
    var articles, media, src, i;
    current = posts;
    window.feedRender(list, posts, '../feed/');
    articles = list.querySelectorAll('.post');
    for (i = 0; i < articles.length; i++) { addDelete(articles[i]); }
    media = list.querySelectorAll('.post__media');
    for (i = 0; i < media.length; i++) {
      src = media[i].getAttribute('src').replace('../feed/', '');
      if (fresh[src]) { media[i].src = fresh[src]; }
    }
    syncStart = Date.now();
    sync();
  }

  function addDelete(article) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor__quiet post__delete';
    button.appendChild(document.createTextNode('delete'));
    button.addEventListener('click', function () { remove(article.id); });
    var state = document.createElement('span');
    state.className = 'post__state';
    article.insertBefore(state, article.firstChild);
    article.insertBefore(button, article.firstChild);
  }

  // ---------- Ist es schon live? ----------

  // GitHub hat die Aenderung sofort, die Website erst nach dem Neubau. sync() fragt
  // die Website alle paar Sekunden, bis sie dieselben Posts zeigt wie GitHub, und
  // markiert solange jeden Post, der dort noch fehlt.
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
        var i, state;

        if (!data) {
          liveLine.textContent = 'cannot reach the website, trying again ...';
          syncTimer = window.setTimeout(sync, 5000);
          return;
        }
        for (i = 0; i < (data.posts || []).length; i++) { live[data.posts[i].id] = true; }
        for (i = 0; i < current.length; i++) { mine[current[i].id] = true; }

        for (i = 0; i < articles.length; i++) {
          state = articles[i].querySelector('.post__state');
          if (live[articles[i].id]) {
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
          liveLine.textContent = 'the website is up to date';
          return;
        }
        liveLine.textContent = 'updating the website ... ' + seconds + ' s' +
          (seconds > 180 ? ' (longer than usual)' : '');
        syncTimer = window.setTimeout(sync, seconds > 180 ? 10000 : 3000);
      });
  }

  function showEditor() {
    tokenForm.hidden = true;
    postForm.hidden = false;
    forgetButton.hidden = false;
    refreshButton.hidden = false;
    say('Loading ...');
    loadState()
      .then(function (state) { showList(state.data.posts); say(''); })
      .catch(function (error) { say(explain(error)); });
  }

  function showTokenForm() {
    postForm.hidden = true;
    forgetButton.hidden = true;
    refreshButton.hidden = true;
    window.clearTimeout(syncTimer);
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
    writeToken(token);
    showEditor();
  });

  forgetButton.addEventListener('click', function () {
    if (!window.confirm('Remove the token from this browser?')) { return; }
    token = '';
    writeToken('');
    showTokenForm();
  });

  postForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!busy) { publish(); }
  });

  fileInput.addEventListener('change', showFiles);

  // Die App auf dem Homescreen hat keinen Knopf zum Neuladen: hier ist einer,
  // und beim Zurueckkommen in die App wird von selbst neu geladen.
  refreshButton.addEventListener('click', function () {
    if (token && !busy) { showEditor(); }
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && token && !busy) { showEditor(); }
  });

  token = readToken();
  if (token) { showEditor(); } else { showTokenForm(); }
})();
