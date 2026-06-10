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
- The home page (`index.html`) is fully static — no JavaScript and no web fonts
- Sub-pages (articles, `resume.html`, `404.html`) contain an empty `<div id="site-chrome">` into which `js/main.js` injects a minimal back-home header at runtime
- Articles are self-contained HTML pages under `/articles/<slug>/index.html`, linked directly from the homepage
- The resume page (`resume.html`) fetches `resume.md` at runtime and renders it with marked.js (`lib/marked.min.js`) via `js/resume.js`

**JavaScript pattern:** Small IIFE modules in `/js/` (`main.js` injects the back-home header on sub-pages; `resume.js` renders the resume); each checks for its target DOM element before running.

**CSS:** Single stylesheet (`css/style.css`) using CSS custom properties for spacing (`--space-1` through `--space-12`) and theming.

## Content Management

**Adding an article:**
1. Create `/articles/<slug>/index.html` (model it on an existing article folder such as `swiss-ai-efficiency/`)
2. Add a link to it from the Writing section in `index.html`

## Code Conventions

- ES5 JavaScript (uses `var`, not `let`/`const`; no arrow functions)
- BEM-style CSS class naming (e.g., `writing__title`)
- System sans body text; Libre Baskerville serif headings (used by the article/resume pages via `--font-heading`); near-black (`#131314`) on warm off-white (`#faf9f6`), with a single terracotta accent (`--color-accent`) used only for link-hover and selection
- The interactive article pages add their own `<style>` blocks that reference the global `:root` custom properties — keep those variable names stable when editing `css/style.css`
