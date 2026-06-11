# Design System

This file defines the visual language for gianlucasavino.com. Follow these guidelines when creating any content — pages, articles, visualizations, or components.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-black` | `#17171a` | Primary text, borders, strong elements |
| `--color-white` | `#fbfbfc` | Background (cool off-white) |
| `--color-accent` | `#0b5cff` | Links on hover, selection, key stats, accent borders |
| `--color-gray-700` | `#44464b` | Secondary text, subheadings |
| `--color-gray-500` | `#686b71` | Tertiary text, dates, captions, metadata |
| `--color-gray-300` | `#c2c4c8` | Dividers (light), decorative elements |
| `--color-gray-200` | `#e4e5e8` | Borders, table rules, section dividers |
| `--color-gray-100` | `#eeeff1` | Subtle backgrounds (code blocks, callouts) |
| `--color-gray-50` | `#f3f4f5` | Barely-visible backgrounds |

**Rules:**
- Never use pure black (`#000`) or pure white (`#fff`)
- The accent is a single blue, used sparingly — primarily link-hover and selection, plus key statistics and footnote links. It is not a brand color to splash everywhere
- For chart fills, use `rgba(11, 92, 255, 0.3)` (accent at 30% opacity) or grayscale values from the palette

## Typography

The site is **all system sans** — no web fonts. Both `--font-stack` and `--font-heading` resolve to the native system sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`). Headings are set apart by **size and weight**, not by a serif. Monospace (`--font-mono`) is reserved for small metadata such as feed dates and inline code.

### Site-wide (UI pages: homepage, notes, resume, nav)
- **Body:** system sans — `var(--font-stack)`, 1rem
- **Headings:** system sans, heavier weight (600–700) and larger size

### Research articles (long-form reading)
- **Body:** system sans — 17px, comfortable line-height
- **Headings (h2, h3):** system sans, weight 600
- **Title (h1):** system sans, weight 700, centered, large (`clamp(2.2rem, 6vw, 3.8rem)`)

Articles are distinguished from UI pages by a **centered reading column** (not a different typeface).

### Supporting type
- **Captions / figcaptions:** system sans, 14px, `--color-gray-500`
- **Metadata (dates, reading time):** system sans or mono, ~0.9rem, `--color-gray-500`
- **Labels (uppercase):** system sans, 0.72rem, weight 700, letter-spacing 0.06–0.08em, uppercase, `--color-gray-500`
- **Monospace (code, feed/note dates):** `var(--font-mono)` (system mono)

## Layout Widths

| Container | Max-width | Usage |
|---|---|---|
| `ra-text` | 720px | Body text, key findings, footnotes, author cards |
| `ra-media` | 880px | Figures, breakout images, hero images |
| `ra-header` | 1000px | Centered article title + date |
| `container` | 54rem (864px) | UI pages (homepage, resume) |

## Spacing

Use the CSS custom property scale: `--space-1` (6px) through `--space-12` (80px). Do not use arbitrary pixel values. The scale:

```
--space-1:  0.375rem   (6px)
--space-2:  0.75rem    (12px)
--space-3:  1.125rem   (18px)
--space-4:  1.5rem     (24px)
--space-5:  2rem       (32px)
--space-6:  2.5rem     (40px)
--space-8:  3rem       (48px)
--space-10: 4rem       (64px)
--space-12: 5rem       (80px)
```

## Visualizations & Charts

### General principles
- Keep it minimal. Remove all decoration that doesn't encode data
- No 3D effects, no gradients on data elements, no drop shadows
- Prefer horizontal bar charts over vertical ones for labeled categories
- Let whitespace do the work — don't crowd elements

### Colors in charts
- **Primary fill:** `rgba(11, 92, 255, 0.3)` (accent at 30%)
- **Secondary fill:** `var(--color-gray-100)`
- **Axis lines / rules:** `var(--color-black)` at 1.5px
- **Grid lines:** avoid them. If absolutely needed, `var(--color-gray-200)` at 1px
- **Labels:** `var(--color-black)` for values, `var(--color-gray-500)` for secondary info
- For multiple data series, use opacity steps of the accent (15%, 30%, 50%, 70%) or the grayscale palette. Do not introduce new hues

### Typography in charts
- **Axis labels / bar labels:** system sans, 0.85–0.92rem, weight 500
- **Data values:** system sans, 0.85rem, weight 700
- **Chart titles:** not needed if the figcaption handles it
- **Source / footer:** system sans, 0.78rem, `--color-gray-500`, right-aligned

### Figure treatment
- Images get `border-radius: 8px` (hero: 12px)
- Figcaptions go directly below, 0.6rem gap
- Caption format: **Figure N.** Description text
- Figure title in `<strong>`, description in plain text

## Interactive States

- **Link hover:** color shifts to `--color-accent`, underline removed
- **Button hover:** background shifts one shade darker in the gray scale
- **Transitions:** 0.12–0.15s ease for color/background changes
- **Focus visible:** 2px solid black outline, 3px offset

## Images

- Always `display: block` and `width: 100%` inside figures
- Hero images: max-width 880px, border-radius 12px
- Inline images: constrained to text column (720px)
- Use descriptive alt text — not decorative filler

## Do / Don't

**Do:**
- Use the existing color tokens — never hardcode hex values in new components
- Keep body text at 17px for articles, 1rem for UI
- Center article headers, left-align everything else
- Use the spacing scale
- Test at 768px breakpoint

**Don't:**
- Add new colors outside the palette
- Use decorative borders or boxes around text unless it's a callout or table
- Make text smaller than 14px (except for labels/footnotes)
- Use bold for emphasis in body text when italics would do
- Put shadows on anything
