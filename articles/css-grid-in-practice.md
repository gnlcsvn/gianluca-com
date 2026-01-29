CSS Grid has been stable and well-supported for years now, but I still see developers reaching for flexbox or JavaScript-based layouts in situations where Grid is the simpler solution. Here are a few patterns I use repeatedly.

## The responsive card grid

This is the most common pattern. A list of cards that shows one column on mobile, two on tablet, and three on desktop:

```css
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 640px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

No flexbox wrapping calculations, no percentage widths with margin offsets. Just declare how many columns you want at each breakpoint.

## The auto-fill pattern

When you don't want to specify exact breakpoints, `auto-fill` with `minmax` handles it:

```css
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 2rem;
}
```

This creates as many columns as will fit, with each column at least 250px wide. No media queries needed. The grid adapts to whatever container width it's given.

## The sidebar layout

A classic page layout with a fixed sidebar and fluid content area:

```css
.layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
}

@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
```

On mobile, the sidebar stacks above the content. On desktop, it sits alongside it.

## Alignment within cells

One thing Grid does better than flexbox is two-dimensional alignment. You can align items both horizontally and vertically within their cells:

```css
.grid-item {
  align-self: start;  /* top of cell */
}
```

This is useful for card grids where cards have varying content heights. Without `align-self: start`, taller cards stretch shorter ones to match.

## When to use flexbox instead

Flexbox is still better for one-dimensional layouts: a navigation bar, a row of buttons, a horizontal list of tags. The rule of thumb is simple: one axis = flexbox, two axes = grid.

---

CSS Grid isn't new or exciting, but it's the right tool for most layout problems. Learn these few patterns and you'll cover the majority of real-world cases.
