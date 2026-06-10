# gianluca.com

Personal website of Gian-Luca Savino.

## Stack

- Vanilla HTML, CSS, JavaScript
- No frameworks, no build step
- Resume rendered client-side from Markdown with [marked](https://github.com/markedjs/marked)

## Structure

```
├── index.html          # Home page (About + Writing)
├── resume.html         # Resume page (renders resume.md)
├── resume.md           # Resume content (Markdown)
├── 404.html
├── articles/
│   └── <slug>/         # Each article is a self-contained HTML page
│       └── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js         # Shared top navigation
│   ├── resume.js       # Renders resume.md with marked.js
│   └── logo-anim.js    # Canvas logo animation
└── lib/
    └── marked.min.js   # Markdown renderer
```

## Development

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## License

MIT
