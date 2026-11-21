# gianlucasavino.com

Personal website of Gianluca Savino. A card with a name and a few links, and one art page.

## Stack

- Vanilla HTML, CSS and one small script
- No frameworks, no build step

## Structure

```
├── index.html      # The card
├── 404.html
├── art/
│   ├── index.html  # Art: one scroll page with all pictures
│   └── bilder/     # The pictures
├── css/
│   └── style.css
└── js/
    └── mirror.js   # Turns the reflection picture on the art page
```

## Development

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## License

MIT
