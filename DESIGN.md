# Design System

This file defines the visual language for gianlucasavino.com. Follow these guidelines when creating any content — pages, articles, visualizations, or components.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-black` | `#131314` | Primary text, borders, strong elements |
| `--color-white` | `#faf9f6` | Background (warm off-white) |
| `--color-accent` | `#d97757` | Links on hover, key stats, accent borders |
| `--color-gray-700` | `#5c5850` | Secondary text, subheadings |
| `--color-gray-500` | `#8a857d` | Tertiary text, dates, captions, metadata |
| `--color-gray-300` | `#c4c0b8` | Dividers (light), decorative elements |
| `--color-gray-200` | `#e2dfd8` | Borders, table rules, section dividers |
| `--color-gray-100` | `#f0eee9` | Subtle backgrounds (code blocks, callouts) |
| `--color-gray-50` | `#f5f4f0` | Barely-visible backgrounds |

**Rules:**
- Never use pure black (`#000`) or pure white (`#fff`)
- The accent color is used sparingly — for interactive states, key statistics, and footnote links. It is not a brand color to splash everywhere
- For chart fills, use `rgba(217, 119, 87, 0.3)` (accent at 30% opacity) or grayscale values from the palette

## Typography

### Site-wide (UI pages: homepage, resume, nav)
- **Body:** Helvetica Neue (sans-serif) — `var(--font-stack)`
- **Headings:** Libre Baskerville (serif) — `var(--font-heading)`

### Research articles (long-form reading)
- **Body:** Libre Baskerville (serif) — `var(--font-heading)`, 17px, line-height 1.4
- **Headings (h2, h3):** Helvetica Neue (sans-serif) — `var(--font-stack)`, weight 600
- **Title (h1):** Helvetica Neue, weight 700, centered, large (`clamp(2.2rem, 6vw, 3.8rem)`)

This inversion is intentional. UI pages are short and scannable — sans-serif body keeps them clean. Articles are for sustained reading — serif body is more comfortable for long text.

### Supporting type
- **Captions / figcaptions:** Helvetica Neue, 14px, `--color-gray-500`
- **Metadata (dates, reading time):** Helvetica Neue, ~0.9rem, `--color-gray-500`
- **Labels (uppercase):** Helvetica Neue, 0.72rem, weight 700, letter-spacing 0.06–0.08em, uppercase, `--color-gray-500`
- **Monospace (code):** SFMono-Regular / Consolas — `var(--font-mono)`

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
- **Primary fill:** `rgba(217, 119, 87, 0.3)` (accent at 30%)
- **Secondary fill:** `var(--color-gray-100)`
- **Axis lines / rules:** `var(--color-black)` at 1.5px
- **Grid lines:** avoid them. If absolutely needed, `var(--color-gray-200)` at 1px
- **Labels:** `var(--color-black)` for values, `var(--color-gray-500)` for secondary info
- For multiple data series, use opacity steps of the accent (15%, 30%, 50%, 70%) or the grayscale palette. Do not introduce new hues

### Typography in charts
- **Axis labels / bar labels:** Helvetica Neue, 0.85–0.92rem, weight 500
- **Data values:** Helvetica Neue, 0.85rem, weight 700
- **Chart titles:** not needed if the figcaption handles it
- **Source / footer:** Helvetica Neue, 0.78rem, `--color-gray-500`, right-aligned

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
