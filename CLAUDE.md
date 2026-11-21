# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website of Gian-Luca Savino: a business-card home page with a name and a few links, an art page, and a feed with its own editor. Vanilla HTML, CSS and a few small scripts, no build step, no dependencies. Hosted on GitHub Pages at gianlucasavino.com.

The site is deliberately maintenance-free. Do not add articles, a bio, or a resume unless asked. The only automation is the video workflow described under Feed. Earlier versions (articles, data insights, resume) live in the git history.

## Development

**Local server:**
```bash
python3 -m http.server 8000
```

No build, lint, or test commands exist—this is intentional.

## Architecture

- `index.html`: the card, centered in the viewport. A name (`.card__name`), a list of links about me (`.card__links`), and below it, separated by a blank line, a second list for projects (`.card__links--projects`).
- `404.html`: same card layout, links back home. Uses root-absolute paths because GitHub Pages serves it for any missing URL.
- `css/style.css`: the only stylesheet.
- `favicon.svg`, `favicon.png`, `favicon.ico`: the same pixel hourglass alone on a transparent ground, linked from every page. The SVG switches its frame to light in dark mode.

- `art/index.html`: the art page. One long scroll page that collects all pictures, newest work on top. The header shows the name (link home) on the left and an overview of the projects on the right, each linking to that project's own site (e.g. z-fighting at `https://gnlcsvn.github.io/z-fighting/`).
- `art/bilder/`: the pictures for the art page. `art/bilder/original/` holds full-resolution originals that the page only links to.
- `js/mirror.js`: drives the "reflection" piece on the art page. The picture `spiegelung.jpg` is cropped so that the mirror axis (the walkway) sits exactly in the middle. Closed, the frame (`.mirror--closed`) shows only the top half of the picture rotated by 180 degrees, i.e. the reflection, upright. A tap on the picture or on "turn" rotates it back around the walkway while the frame grows downward to show the whole picture. Without JavaScript the whole picture is shown. If the picture is replaced, crop it symmetrically around the mirror axis and update the two `padding-bottom` ratios in `css/style.css` (height/width, and half of it).

**Adding a work to the art page:** put the image files in `art/bilder/`, then add an `<article class="work">` at the top of `<main class="feed">` in `art/index.html`: one or more `<img class="work__image">` (with `width`, `height`, `alt`, and `loading="lazy"` for everything below the first image) followed by a `<p class="work__caption">` with the title on the left and a quiet `.work__meta` on the right (medium, or a link to the project). A new project also gets a link in `.site-header__nav`.

## Feed

An X-style feed with only the owner's posts.

- `feed/posts.json`: all posts, newest first. Each post has `id` (`YYYYMMDD-HHMMSS`), `date` (ISO with time zone), `text`, `media`, and `edited` (ISO date, only after an edit).
- `media` is a list of `{type, src, ...}` with `src` relative to `feed/`. Types: `image` and `video` (with `width`, `height`; a video may have `poster`, a still frame the editor makes at upload), `audio` (with `name`), `file` (with `name`, `size`; shown as a download link).
- `feed/media/`: the files of the posts, named `<post id>-<n>.<ext>`.
- `feed/index.html` + `js/feed.js`: load `posts.json` and render it. Several pictures or videos in one post become a swipeable carousel (CSS scroll snap, arrows and a counter). Videos are muted, loop, and play only while at least 60% visible (IntersectionObserver); with "reduce motion" they do not start by themselves.
- **Text format:** post text is plain text with a small markdown subset that `js/feed.js` turns into elements: `**bold**`, `*italic*`, `` `code` ``, `[label](https://...)`, bare web addresses, lines starting with `> ` (quote) and `- ` (list). Text is always inserted as text nodes, never as HTML, and links only accept `http(s):` and `mailto:`.
- `post/index.html` + `js/post.js`: the editor, installable on the phone's home screen (`post/manifest.webmanifest`, icons in `post/`; the icon is a self-drawn pixel hourglass in the spirit of the old Windows busy cursor, with a dark frame, translucent glass and red sand on a light gradient, full-bleed and unmasked as Apple's icon guidelines ask, plus a maskable version with the motif in the safe middle). It writes to this repository through the GitHub API: one commit per post, edit or deletion, made via the git data API (blobs, tree, commit, ref update) on `main`. GitHub Pages then rebuilds, so a change is live after some seconds up to a minute.
- **Videos are compressed on GitHub** (`.github/workflows/video.yml` runs `.github/video.py`). The editor does not put a video into the feed. It puts the original into its own orphan branch `upload/<post id>-<n>` and lists the video in `posts.json` under its final name `media/<post id>-<n>.mp4` with `"processing": true`. The workflow runs whenever `posts.json` changes on `main`: it fetches the original from the branch, encodes it with ffmpeg (H.264/AAC in MP4, short side at most 720 px, at most 30 fps, CRF 27, all metadata stripped), commits the result to `feed/media/`, makes a still frame as `poster` (phones often deliver a black one), removes the `processing` flag, and deletes the branch. GitHub Pages rebuilds by itself after the workflow's push; do not trigger a build from the workflow as well. The large original therefore never enters the history of `main`. While `processing` is set, the feed shows the poster and a note. Upload branches without a post are deleted after an hour. No post may stay on `processing`: if encoding fails the original goes into the feed unchanged, and if the original never arrives the video is dropped from the post. Each video is committed on its own.
- **A page per post, for link previews** (`.github/share.py`, second step of the same workflow). Messengers build a link preview from Open Graph tags in the page head and run no JavaScript, so every post gets a generated static page `feed/p/<id>/index.html` (title, description, `og:image`, then the same shell as the feed with `data-post` and `data-feed` on `#posts`) and a 1200x630 `preview.jpg` beside it: the post's first picture or video still set whole on paper, or the post's text as a card. The script rebuilds a page only when the post, `TEMPLATE` in the script or `post/version.txt` changed (a hash in `<meta name="post-stamp">`), and removes pages of deleted posts. Never edit `feed/p/` by hand. To rebuild locally: `python3 .github/share.py --local` (needs Pillow). `404.html` redirects `feed/p/<id>/` to `feed/#<id>` for the seconds before a new page exists.
- **Feed page extras** (only on `feed/` and the post pages, not in the editor): every post has a "share" button that copies the address of the post's own page, `feed/p/<post id>/`; the button itself reads "link copied" for two seconds; inside the feed, a click on a post's date shows that post alone under `feed/#<post id>` without reloading, with a link back; texts much longer than 14 lines are cut in the feed and get a "more" button.
- **Editor features:** attach any files (file picker, drag and drop, paste), reorder and remove them; a format bar that inserts the markdown characters (hidden behind "format" on the phone, open on wide screens); a live preview that uses the feed's own renderer; edit the text of an existing post; delete a post with its files. After every change it polls the website and marks each post as "publishing ..." or "live".
- **Editor safeguards:** while it works, the draft, attachments and list are locked; a post keeps its id across retries, so a retry after a lost response finds the post already there instead of posting twice; uploads retry on a broken or stalled connection and finished uploads are not sent again; editing a post is refused while an unsent draft exists.
- **Editor version:** `post/version.txt` holds a number. The same number is the `?v=` on the stylesheet and the two scripts in `post/index.html` (and in `feed/index.html`). On start, the editor fetches `version.txt` fresh and reloads itself under `?v=<number>` if it differs, which gets around the browser and home screen cache. **Whenever the editor, `js/feed.js` or `css/style.css` changes, raise the number in all of these places.**
- **Access:** the editor page is public but can do nothing without a GitHub fine-grained personal access token (only this repository, permission "Contents: read and write"). The token is typed into the editor once per device and kept in that browser's `localStorage` under `feed-token`. It must never be written into any file of this repository.
- The editor shrinks pictures to 2000 px on the long edge and saves them as JPEG (this also drops camera metadata); GIF and SVG stay as they are; pictures the browser cannot open, and all other files, are uploaded unchanged, up to 50 MB each.
- Posts made through the editor arrive as commits on `origin/main`. Pull before working on the site.

## Code Conventions

- Buttons follow z-fighting (`.button`): fine 1px frame in `--knopf`, 2px radius, 30px high; filled means selected or open (`aria-expanded`/`aria-pressed`). Joined groups like the format bar use `.tools__group`.
- Style follows the z-fighting project (`pen plotting/zfighting_web/stil.css`): one typeface, two colors.
- Typeface: `"Courier Prime", "Courier New", Courier, monospace`. No web fonts are loaded.
- Palette as custom properties: `--papier` (#fbfaf7), `--tinte` (#1b1b1d), `--leise` (#8a8985), `--knopf` (#29292c, buttons), `--blau` (#2d3c96, links).
- Link labels are lowercase.
- BEM-style CSS class naming (e.g., `card__links`).
- JavaScript: ES5 (`var`, no arrow functions), one IIFE per file that checks for its DOM element first.
