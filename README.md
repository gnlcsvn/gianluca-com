# gianluca.com

Personal website of Gian-Luca Savino.

## Stack

- Vanilla HTML, CSS, JavaScript
- No frameworks, no build step
- Markdown articles rendered client-side with [marked](https://github.com/markedjs/marked)

## Structure

```
├── index.html          # Home page
├── writing.html        # Article listing
├── article.html        # Article viewer
├── projects.html       # Projects grid
├── projects.json       # Project data
├── articles/
│   ├── manifest.json   # Article metadata
│   └── *.md            # Article content
├── css/
│   └── style.css
├── js/
│   ├── main.js         # Navigation
│   ├── articles.js     # Article listing
│   ├── article.js      # Article rendering
│   └── projects.js     # Project cards
└── images/
    └── projects/       # Project screenshots
```

## Development

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## License

MIT
