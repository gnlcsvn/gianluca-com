"""Rechnet die Videos klein, die in feed/posts.json mit "processing": true stehen.

Je Video: Original aus dem Zweig upload/<post>-<n> holen, mit ffmpeg umrechnen,
nach feed/media/ legen, den Eintrag in posts.json fertig melden, den Zweig loeschen.
Laeuft in der GitHub Action .github/workflows/video.yml.
"""
import json
import os
import subprocess
import sys
import tempfile
import time

FEED = 'feed'
POSTS = os.path.join(FEED, 'posts.json')
SHORT_SIDE = 720          # groesser wird kein Video: 720p, hochkant 720 breit
CRF = '27'                # Qualitaet von x264: kleiner ist besser und groesser
WORK = tempfile.mkdtemp()


def run(*args, check=True, quiet=False):
    result = subprocess.run(args, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError('%s\n%s' % (' '.join(args), result.stderr.strip()))
    if not quiet and result.stderr.strip() and result.returncode != 0:
        print(result.stderr.strip())
    return result


def load():
    with open(POSTS, encoding='utf-8') as f:
        return json.load(f)


def pending(data):
    """Alle Videos, die noch umgerechnet werden muessen: (post, eintrag)."""
    return [(post, item) for post in data.get('posts', []) for item in post.get('media', [])
            if item.get('processing')]


def name_of(item):
    """media/20261121-100756-1.mp4 -> 20261121-100756-1"""
    return os.path.splitext(os.path.basename(item['src']))[0]


def fetch_original(name):
    """Holt die Datei aus dem Zweig upload/<name>. Gibt den Pfad zurueck oder None."""
    ref = 'refs/heads/upload/' + name
    if run('git', 'fetch', '--quiet', 'origin', ref, check=False).returncode != 0:
        return None
    files = run('git', 'ls-tree', '--name-only', 'FETCH_HEAD').stdout.split('\n')
    files = [f for f in files if f]
    if not files:
        return None
    path = os.path.join(WORK, 'original-' + files[0])
    with open(path, 'wb') as out:
        subprocess.run(['git', 'show', 'FETCH_HEAD:' + files[0]], stdout=out, check=True)
    return path


def encode(source, target):
    """H.264 und AAC in MP4, hoechstens 720p und 30 Bilder, ohne Ort und Kameradaten."""
    # Die kurze Seite hoechstens 720, beide Seiten gerade (x264 nimmt keine ungeraden Masse).
    scale = ("scale='if(gt(iw,ih),-2,trunc(min(%d,iw)/2)*2)':'if(gt(iw,ih),trunc(min(%d,ih)/2)*2,-2)'"
             % (SHORT_SIDE, SHORT_SIDE))
    run('ffmpeg', '-v', 'error', '-y', '-i', source,
        '-vf', scale + ",fps='min(30,source_fps)'",
        '-c:v', 'libx264', '-preset', 'medium', '-crf', CRF, '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
        '-map_metadata', '-1', '-movflags', '+faststart', target)


def still(video, target):
    """Ein Standbild kurz nach dem Anfang, als Vorschaubild. Das Telefon liefert oft nur Schwarz."""
    run('ffmpeg', '-v', 'error', '-y', '-ss', '0.5', '-i', video, '-frames:v', '1', '-q:v', '4', target)
    if not os.path.exists(target) or os.path.getsize(target) == 0:
        # kuerzer als eine halbe Sekunde: das allererste Bild
        run('ffmpeg', '-v', 'error', '-y', '-i', video, '-frames:v', '1', '-q:v', '4', target)


def size_of(path):
    out = run('ffprobe', '-v', 'error', '-select_streams', 'v:0',
              '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path).stdout.strip()
    width, height = out.split(',')[:2]
    return int(width), int(height)


def age_of(post):
    """Alter des Posts in Sekunden, aus seiner Nummer JJJJMMTT-HHMMSS (Ortszeit, also grob)."""
    try:
        stamp = time.mktime(time.strptime(post['id'][:15], '%Y%m%d-%H%M%S'))
    except (ValueError, KeyError):
        return 0
    return time.time() - stamp


def main():
    """Ein Video nach dem anderen, jedes mit eigenem Commit: was fertig ist, ist sicher.

    Kein Post darf auf "processing" haengen bleiben:
    - laesst sich ein Video nicht umrechnen, geht das Original unveraendert in den Feed;
    - fehlt das Original auch nach einer Stunde noch, faellt das Video aus dem Post.
    """
    finished = []
    for post, item in pending(load()):
        name = name_of(item)
        original = fetch_original(name)
        if not original:
            if age_of(post) > 3600 + 86400:   # ein Tag Spielraum fuer die Zeitzone der Post-Nummer
                print('%s: kein Original im Zweig upload/%s, das Video wird aus dem Post genommen' % (item['src'], name))
                commit(item['src'], None)
            else:
                print('%s: noch kein Zweig upload/%s, naechster Lauf' % (item['src'], name))
            continue
        target = os.path.join(WORK, name + '.mp4')
        try:
            encode(original, target)
            width, height = size_of(target)
            result = {'file': target, 'src': item['src'], 'width': width, 'height': height}
            try:
                poster = os.path.join(WORK, name + '-poster.jpg')
                still(target, poster)
                result['poster'] = poster
            except Exception as error:  # noqa: BLE001
                print('%s: kein Standbild (%s)' % (item['src'], error))
            print('%s: %d kb -> %d kb, %dx%d' % (
                item['src'], os.path.getsize(original) // 1024, os.path.getsize(target) // 1024, width, height))
        except Exception as error:  # noqa: BLE001
            # Umrechnen gescheitert: lieber das Original zeigen als gar nichts.
            ext = os.path.splitext(original)[1] or '.mp4'
            result = {'file': original, 'src': 'media/' + name + ext}
            print('%s: Umrechnen gescheitert, das Original geht unveraendert in den Feed (%s)' % (item['src'], error))
        commit(item['src'], result)
        finished.append(name)
    clean_up(finished)


def commit(src, result):
    """Meldet das Video mit der Adresse src fertig. result None heisst: aus dem Post nehmen.

    Kam inzwischen ein Post dazu, wird der neue Stand geholt und es noch einmal versucht.
    """
    for attempt in range(6):
        run('git', 'fetch', '--quiet', 'origin', 'main')
        run('git', 'reset', '--quiet', '--hard', 'origin/main')
        data = load()
        found = [(post, item) for post, item in pending(data) if item['src'] == src]
        if not found:
            print('%s: den Post gibt es nicht mehr, nichts einzutragen' % src)
            return
        post, item = found[0]
        if result is None:
            post['media'].remove(item)
        else:
            path = os.path.join(FEED, result['src'])
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(result['file'], 'rb') as source, open(path, 'wb') as out:
                out.write(source.read())
            item['src'] = result['src']
            if result.get('width'):
                item['width'], item['height'] = result['width'], result['height']
            if result.get('poster'):
                item['poster'] = 'media/' + name_of({'src': src}) + '-poster.jpg'
                poster_path = os.path.join(FEED, item['poster'])
                with open(result['poster'], 'rb') as source, open(poster_path, 'wb') as out:
                    out.write(source.read())
                run('git', 'add', poster_path)
            del item['processing']
            run('git', 'add', path)
        with open(POSTS, 'w', encoding='utf-8') as f:
            f.write(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
        run('git', 'add', POSTS)
        run('git', 'commit', '--quiet', '-m', 'Feed: add compressed video' if result else 'Feed: drop video without original')
        if run('git', 'push', '--quiet', 'origin', 'HEAD:main', check=False).returncode == 0:
            return
        time.sleep(3 + attempt * 2)
    raise RuntimeError('Der Push auf main ist sechsmal gescheitert.')


def clean_up(finished):
    """Loescht die Zweige der fertigen Videos und liegengebliebene, die aelter als eine Stunde sind."""
    run('git', 'fetch', '--quiet', 'origin', 'main')
    run('git', 'reset', '--quiet', '--hard', 'origin/main')
    still_needed = set(name_of(item) for _, item in pending(load()))
    refs = run('git', 'ls-remote', '--heads', 'origin', 'refs/heads/upload/*').stdout.split('\n')
    for line in refs:
        if not line.strip():
            continue
        ref = line.split('\t')[1]
        name = ref.split('refs/heads/upload/')[1]
        if name in finished:
            run('git', 'push', '--quiet', 'origin', '--delete', ref, check=False)
            continue
        if name in still_needed:
            continue
        # Ein Zweig ohne Post: vielleicht kommt der Post gleich noch. Nach einer Stunde weg damit.
        run('git', 'fetch', '--quiet', 'origin', ref, check=False)
        stamp = run('git', 'log', '-1', '--format=%ct', 'FETCH_HEAD', check=False).stdout.strip()
        if stamp and time.time() - int(stamp) > 3600:
            run('git', 'push', '--quiet', 'origin', '--delete', ref, check=False)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(error)
        sys.exit(1)
