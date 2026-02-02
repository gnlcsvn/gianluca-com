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

**Static site with client-side rendering:**
- HTML pages fetch JSON/Markdown at runtime
- Articles stored as Markdown in `/articles/`, rendered client-side with marked.js
- Client-side routing uses URL hashes (e.g., `article.html#my-article-slug`)

**JavaScript pattern:** Each page has its own IIFE module that checks for DOM elements, fetches data, and renders content.

**CSS:** Single stylesheet (`css/style.css`) using CSS custom properties for spacing (`--space-1` through `--space-12`) and theming.

## Content Management

**Adding an article:**
1. Create markdown file in `/articles/` (e.g., `my-article.md`)
2. Add entry to `/articles/manifest.json` with slug, title, date, description

**Adding a project:**
- Add object to `/projects.json` with title, description, url, tags, and optional image

## Code Conventions

- ES5 JavaScript (uses `var`, not `let`/`const`; no arrow functions)
- BEM-style CSS class naming (e.g., `article-preview__date`)
- Helvetica Neue typography, black/white color palette
