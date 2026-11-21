# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website of Gianluca Savino: a single business-card page with a name and a few links. Vanilla HTML and CSS, no JavaScript, no build step, no dependencies. Hosted on GitHub Pages at gianlucasavino.com.

The site is deliberately maintenance-free. Do not add writing, feeds, a bio, or a resume unless asked. Earlier versions (articles, data insights, resume) live in the git history.

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

**Tabs:** `index.html` contains a commented-out `<nav class="tabs">` (top right) with a link to the z-fighting site (`https://gnlcsvn.github.io/z-fighting/`). It is switched off for now; remove the comment markers to switch it on. The `.tabs` styles are already in the stylesheet.

## Code Conventions

- Style follows the z-fighting project (`pen plotting/zfighting_web/stil.css`): one typeface, two colors.
- Typeface: `"Courier Prime", "Courier New", Courier, monospace`. No web fonts are loaded.
- Palette as custom properties: `--papier` (#fbfaf7), `--tinte` (#1b1b1d), `--leise` (#8a8985), `--blau` (#2d3c96, links).
- Link labels are lowercase.
- BEM-style CSS class naming (e.g., `card__links`).
- If JavaScript is ever added: ES5 (`var`, no arrow functions).
