# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website built with vanilla HTML, CSS, and JavaScript. Zero build step, zero npm dependencies. Hosted on GitHub Pages at gianlucasavino.com.

## Development

**Local server:**
```bash
python3 -m http.server 8000
```

No build, lint, or test commands exist—this is intentional.

## Architecture

**Static multi-page site:**
- The home page (`index.html`) is fully static — no JavaScript and no web fonts. Its main section is a **feed**: a single reverse-chronological stream that interleaves two kinds of entry, **notes** (short posts) and **articles** (long-form). Each feed item is a static preview card using the stretched-link pattern (`.feed__link::after`) so the whole card is clickable
- Sub-pages (articles, notes, `resume.html`, `404.html`) contain an empty `<div id="site-chrome">` into which `js/main.js` injects a minimal back-home header at runtime
- Articles are self-contained HTML pages under `/articles/<slug>/index.html`, surfaced as feed cards on the homepage
- Notes are short posts, each a small static page under `/n/<slug>/index.html` (a note is essentially a very short article). They carry Open Graph tags for shareable link previews and reuse the shared `.note` styles in `css/style.css` — no per-page `<style>` block needed
- The resume page (`resume.html`) fetches `resume.md` at runtime and renders it with marked.js (`lib/marked.min.js`) via `js/resume.js`

**JavaScript pattern:** Small IIFE modules in `/js/` (`main.js` injects the back-home header on sub-pages; `resume.js` renders the resume); each checks for its target DOM element before running.

**CSS:** Single stylesheet (`css/style.css`) using CSS custom properties for spacing (`--space-1` through `--space-12`) and theming.

## Content Management

Both notes and articles appear in the same homepage feed, newest first. When adding either, insert its preview card into `<ul class="feed">` in `index.html` at the correct chronological position.

**Adding a note (short post):**
1. Create `/n/<slug>/index.html`. It's a minimal static page (no per-page `<style>` — it uses the shared `.note` styles in `css/style.css`):
   - `<head>`: `<title>`, `<meta name="description">`, Open Graph tags (`og:type=article`, `og:title`, `og:description`, `og:url`, and `og:image` if it has media), `twitter:card`, a `<link rel="canonical">`, and `<link rel="stylesheet" href="../../css/style.css">`
   - `<body>`: the skip link, `<div class="site-layout">` wrapping `<div id="site-chrome"></div>` and `<main id="main" class="site-main">`, inside which sits `<article class="note">` with a `.note__date` (`<time>`), a `.note__body` (one or more `<p>`), and an optional `.note__media` `<figure>`
   - End with `<script src="../../js/main.js"></script>` (injects the back-home header)
2. Optional media (one image / GIF / video) goes in the note's own folder and is shown via `.note__media`. The same asset can double as the `og:image`
3. Add a `feed__item--note` card to the feed in `index.html`: a `feed__date`, a `feed__tag feed__link` anchor pointing at the note (with an `aria-label`), a clamped `feed__text` preview, and an optional `feed__media` thumbnail

**Adding an article:**
1. Create `/articles/<slug>/index.html` (model it on an existing article folder such as `swiss-ai-efficiency/`)
2. Add a `feed__item--article` card to the feed in `index.html`: a `feed__date`, a plain `feed__tag` ("Article"), a `feed__title` whose link is the `feed__link`, and a clamped `feed__text` excerpt

## Code Conventions

- ES5 JavaScript (uses `var`, not `let`/`const`; no arrow functions)
- BEM-style CSS class naming (e.g., `feed__title`)
- All system sans — no web fonts; headings are set apart by size and weight (both `--font-stack` and `--font-heading` resolve to the system sans stack)
- Palette: near-black (`#17171a`) on cool off-white (`#fbfbfc`), with a single blue accent (`--color-accent`, `#0b5cff`) used only for link-hover and selection
- Layout: the home, `resume.html`, and `404.html` are left-aligned; the long-form article pages and note pages (`/n/<slug>/`) use a centered reading column
- The interactive article pages add their own `<style>` blocks that reference the global `:root` custom properties — keep those variable names stable when editing `css/style.css`
