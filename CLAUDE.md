# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website of Gianluca Savino: a business-card home page with a name and a few links, an art page, and a feed with its own editor. Vanilla HTML, CSS and a few small scripts, no build step, no dependencies. Hosted on GitHub Pages at gianlucasavino.com.

The site is deliberately maintenance-free. Do not add articles, a bio, or a resume unless asked. Earlier versions (articles, data insights, resume) live in the git history.

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

- `art/index.html`: the art page. One long scroll page that collects all pictures, newest work on top. The header shows the name (link home) on the left and an overview of the projects on the right, each linking to that project's own site (e.g. z-fighting at `https://gnlcsvn.github.io/z-fighting/`).
- `art/bilder/`: the pictures for the art page. `art/bilder/original/` holds full-resolution originals that the page only links to.
- `js/mirror.js`: drives the "reflection" piece on the art page. The picture `spiegelung.jpg` is cropped so that the mirror axis (the walkway) sits exactly in the middle. Closed, the frame (`.mirror--closed`) shows only the top half of the picture rotated by 180 degrees, i.e. the reflection, upright. A tap on the picture or on "turn" rotates it back around the walkway while the frame grows downward to show the whole picture. Without JavaScript the whole picture is shown. If the picture is replaced, crop it symmetrically around the mirror axis and update the two `padding-bottom` ratios in `css/style.css` (height/width, and half of it).

**Adding a work to the art page:** put the image files in `art/bilder/`, then add an `<article class="work">` at the top of `<main class="feed">` in `art/index.html`: one or more `<img class="work__image">` (with `width`, `height`, `alt`, and `loading="lazy"` for everything below the first image) followed by a `<p class="work__caption">` with the title on the left and a quiet `.work__meta` on the right (medium, or a link to the project). A new project also gets a link in `.site-header__nav`.

## Feed

An X-style feed with only the owner's posts.

- `feed/posts.json`: all posts, newest first. Each post has `id` (`YYYYMMDD-HHMMSS`), `date` (ISO with time zone), `text`, and `media` (list of `{type: "image"|"video", src, width, height}`, `src` relative to `feed/`).
- `feed/media/`: the pictures and videos of the posts, named `<post id>-<n>.<ext>`.
- `feed/index.html` + `js/feed.js`: load `posts.json` and render it. Post text is always inserted as text, never as HTML; only web addresses become links.
- `post/index.html` + `js/post.js`: the editor, installable on the phone's home screen (`post/manifest.webmanifest`, icons in `post/`). It writes to this repository through the GitHub API: one commit per post or per deletion, made via the git data API (blobs, tree, commit, ref update) on `main`. GitHub Pages then rebuilds, so a post is live after about a minute.
- **Access:** the editor page is public but can do nothing without a GitHub fine-grained personal access token (only this repository, permission "Contents: read and write"). The token is typed into the editor once per device and kept in that browser's `localStorage` under `feed-token`. It must never be written into any file of this repository.
- The editor shrinks pictures to 2000 px on the long edge and saves them as JPEG (this also drops camera metadata); GIFs stay as they are; videos are uploaded unchanged, up to 50 MB.
- Posts made through the editor arrive as commits on `origin/main`. Pull before working on the site.

## Code Conventions

- Style follows the z-fighting project (`pen plotting/zfighting_web/stil.css`): one typeface, two colors.
- Typeface: `"Courier Prime", "Courier New", Courier, monospace`. No web fonts are loaded.
- Palette as custom properties: `--papier` (#fbfaf7), `--tinte` (#1b1b1d), `--leise` (#8a8985), `--blau` (#2d3c96, links).
- Link labels are lowercase.
- BEM-style CSS class naming (e.g., `card__links`).
- JavaScript: ES5 (`var`, no arrow functions), one IIFE per file that checks for its DOM element first.
