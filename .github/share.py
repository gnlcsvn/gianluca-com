"""Baut fuer jeden Post eine eigene kleine Seite mit Vorschau fuer Messenger.

WhatsApp, iMessage und andere lesen von einer verlinkten Seite nur ein paar Angaben im
Seitenkopf (Open Graph): Titel, Beschreibung, Bild. Sie fuehren kein JavaScript aus.
Deshalb bekommt jeder Post aus feed/posts.json eine feste Seite

    feed/p/<id>/index.html     Angaben im Kopf, darunter derselbe Post wie im Feed
    feed/p/<id>/preview.jpg    das Vorschaubild, 1200 x 630, klein genug fuer WhatsApp

Seiten von geloeschten Posts fallen weg. Laeuft in .github/workflows/video.yml nach
jeder Aenderung an posts.json; lokal zum Ansehen: python3 .github/share.py --local
"""
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time

from PIL import Image, ImageDraw, ImageFont

SITE = 'https://gianlucasavino.com'
NAME = 'Gian-Luca Savino'
FEED = 'feed'
POSTS = os.path.join(FEED, 'posts.json')
PAGES = os.path.join(FEED, 'p')
TEMPLATE = '3'                       # hochzaehlen, wenn sich Seite oder Vorschaubild aendern
SIZE = (1200, 630)
PAPER, INK, QUIET = (251, 250, 247), (27, 27, 29), (138, 137, 133)
FONTS = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Courier New.ttf',
]


def run(*args, check=True):
    result = subprocess.run(args, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError('%s\n%s' % (' '.join(args), result.stderr.strip()))
    return result


def plain(text):
    """Der Text ohne die Zeichen fuer die Form (siehe js/feed.js)."""
    text = re.sub(r'\[([^\]\n]+)\]\((?:https?://|mailto:)[^\s)]+\)', r'\1', text or '')
    text = re.sub(r'\*\*([^*\n]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*\s][^*\n]*)\*', r'\1', text)
    text = re.sub(r'`([^`\n]+)`', r'\1', text)
    text = re.sub(r'(?m)^(>\s?|- )', '', text)
    return text.strip()


def cut(text, limit):
    text = ' '.join(text.split())
    if len(text) <= limit:
        return text
    return text[:limit - 1].rsplit(' ', 1)[0].rstrip('.,;:') + '…'


def font(size):
    for path in FONTS:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def picture_of(post):
    """Die Datei, aus der das Vorschaubild wird: das erste Bild, sonst das Standbild eines Videos."""
    for item in post.get('media', []):
        if item.get('type') == 'image' and not item['src'].lower().endswith('.svg'):
            return os.path.join(FEED, item['src'])
        if item.get('type') == 'video' and item.get('poster'):
            return os.path.join(FEED, item['poster'])
    return None


def preview(post, target):
    canvas = Image.new('RGB', SIZE, PAPER)
    source = picture_of(post)
    drawn = False
    if source and os.path.exists(source):
        try:
            image = Image.open(source)
            image.seek(0)
            image = image.convert('RGB')
            # das ganze Bild, auf Papier gesetzt: nichts wird abgeschnitten
            image.thumbnail(SIZE, Image.LANCZOS)
            canvas.paste(image, ((SIZE[0] - image.size[0]) // 2, (SIZE[1] - image.size[1]) // 2))
            drawn = True
        except Exception as error:  # noqa: BLE001
            print('%s: Bild nicht lesbar (%s), es gibt eine Textkarte' % (post['id'], error))
    if not drawn:
        text_card(canvas, plain(post.get('text', '')))
    canvas.save(target, 'JPEG', quality=82, optimize=True)


def text_card(canvas, text):
    """Ein Post ohne Bild: sein Text als Karte, in der Schrift der Website."""
    draw = ImageDraw.Draw(canvas)
    big, small = font(40), font(26)
    margin, line_height, max_lines = 90, 58, 7
    width = int((SIZE[0] - 2 * margin) / draw.textlength('m', font=big))
    lines = []
    for paragraph in (text or NAME).split('\n'):
        words, line = paragraph.split(), ''
        if not words and lines and lines[-1] != '':
            lines.append('')
        for word in words:
            if len(line) + len(word) + 1 > width and line:
                lines.append(line)
                line = word
            else:
                line = (line + ' ' + word).strip()
        if line:
            lines.append(line)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1][:width - 2].rstrip() + ' …'
    top = (SIZE[1] - 60 - len(lines) * line_height) // 2
    for index, line in enumerate(lines):
        draw.text((margin, top + index * line_height), line, font=big, fill=INK)
    draw.text((margin, SIZE[1] - 80), NAME, font=small, fill=QUIET)


PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <!-- Erzeugt von .github/share.py aus feed/posts.json. Nicht von Hand aendern. -->
  <meta name="post-stamp" content="{stamp}">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="{name}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="article:published_time" content="{date}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{image}">
  <link rel="icon" href="/favicon.png" sizes="64x64" type="image/png">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../../../css/style.css?v={version}">
</head>
<body>

  <header class="site-header site-header--narrow">
    <a href="../../../" class="site-header__home">{name}</a>
    <span class="site-header__nav"><a href="../../">feed</a></span>
  </header>

  <main class="posts" id="posts" data-feed="../../" data-post="{id}">
    <noscript><p class="post__text">{noscript}</p></noscript>
  </main>

  <script src="../../../js/feed.js?v={version}"></script>
</body>
</html>
'''


def page(post, version):
    text = plain(post.get('text', ''))
    first = next((line for line in text.split('\n') if line.strip()), '')
    title = cut(first, 70) or 'Post'
    values = {
        'id': post['id'],
        'name': NAME,
        'title': html.escape('%s – %s' % (title, NAME), quote=True),
        'description': html.escape(cut(text, 200) or NAME, quote=True),
        'url': '%s/feed/p/%s/' % (SITE, post['id']),
        'image': '%s/feed/p/%s/preview.jpg?s=%s' % (SITE, post['id'], stamp(post, version)[:8]),
        'date': html.escape(post.get('date', ''), quote=True),
        'noscript': html.escape(text).replace('\n', '<br>'),
        'stamp': stamp(post, version),
        'version': version,
    }
    return PAGE.format(**values)


def stamp(post, version):
    """Aendert sich, sobald sich der Post, die Vorlage oder die Fassung der Website aendert."""
    raw = json.dumps(post, sort_keys=True, ensure_ascii=False) + TEMPLATE + version
    return hashlib.sha1(raw.encode('utf-8')).hexdigest()


def build():
    """Erzeugt alle Seiten neu, die fehlen oder veraltet sind, und raeumt alte weg."""
    with open(POSTS, encoding='utf-8') as f:
        posts = json.load(f).get('posts', [])
    with open(os.path.join('post', 'version.txt'), encoding='utf-8') as f:
        version = f.read().strip()
    os.makedirs(PAGES, exist_ok=True)
    wanted = set()
    for post in posts:
        if not re.match(r'^[\w-]+$', post.get('id', '')):
            continue
        wanted.add(post['id'])
        folder = os.path.join(PAGES, post['id'])
        index = os.path.join(folder, 'index.html')
        if os.path.exists(index) and os.path.exists(os.path.join(folder, 'preview.jpg')):
            with open(index, encoding='utf-8') as f:
                if 'content="%s"' % stamp(post, version) in f.read():
                    continue
        os.makedirs(folder, exist_ok=True)
        preview(post, os.path.join(folder, 'preview.jpg'))
        with open(index, 'w', encoding='utf-8') as f:
            f.write(page(post, version))
        print('%s: Seite und Vorschaubild' % post['id'])
    for name in os.listdir(PAGES):
        if name not in wanted:
            shutil.rmtree(os.path.join(PAGES, name))
            print('%s: Seite entfernt' % name)


def main():
    if '--local' in sys.argv:
        build()
        return
    for attempt in range(6):
        run('git', 'fetch', '--quiet', 'origin', 'main')
        run('git', 'reset', '--quiet', '--hard', 'origin/main')
        build()
        run('git', 'add', '-A', PAGES)
        if run('git', 'diff', '--cached', '--quiet', check=False).returncode == 0:
            print('Alle Seiten sind aktuell.')
            return
        run('git', 'commit', '--quiet', '-m', 'Feed: update post pages')
        if run('git', 'push', '--quiet', 'origin', 'HEAD:main', check=False).returncode == 0:
            out = os.environ.get('GITHUB_OUTPUT')
            if out:
                with open(out, 'a', encoding='utf-8') as f:
                    f.write('changed=yes\n')
            return
        time.sleep(3 + attempt * 2)
    raise RuntimeError('Der Push auf main ist sechsmal gescheitert.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(error)
        sys.exit(1)
