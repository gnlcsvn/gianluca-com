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
- Each page is standalone HTML; the shared top nav is injected at runtime by `js/main.js`
- Articles are self-contained HTML pages under `/articles/<slug>/index.html`, linked directly from the homepage
- The resume page (`resume.html`) fetches `resume.md` at runtime and renders it with marked.js (`lib/marked.min.js`) via `js/resume.js`

**JavaScript pattern:** Small IIFE modules in `/js/` (`main.js` for nav, `resume.js` for resume rendering, `logo-anim.js` for the canvas logo); each checks for its target DOM element before running.

**CSS:** Single stylesheet (`css/style.css`) using CSS custom properties for spacing (`--space-1` through `--space-12`) and theming.

## Content Management

**Adding an article:**
1. Create `/articles/<slug>/index.html` (model it on an existing article folder such as `swiss-ai-efficiency/`)
2. Add a link to it from the Writing section in `index.html`

## Code Conventions

- ES5 JavaScript (uses `var`, not `let`/`const`; no arrow functions)
- BEM-style CSS class naming (e.g., `docs-section__title`)
- Helvetica Neue body text, Libre Baskerville serif headings; near-black (`#131314`) / off-white (`#faf9f6`) palette with a warm accent (`--color-accent`)
