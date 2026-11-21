# gianlucasavino.com

Personal website of Gianluca Savino. A card with a name and a few links, an art page, and a feed.

## Stack

- Vanilla HTML, CSS and a few small scripts
- No frameworks, no build step

## Structure

```
├── index.html      # The card
├── 404.html
├── art/
│   ├── index.html  # Art: one scroll page with all pictures
│   └── bilder/     # The pictures
├── feed/
│   ├── index.html  # Feed: renders posts.json
│   ├── posts.json  # All posts
│   └── media/      # Pictures and videos of the posts
├── post/
│   └── index.html  # Editor for the feed (needs a GitHub token)
├── css/
│   └── style.css
└── js/
    ├── mirror.js   # Turns the reflection picture on the art page
    ├── feed.js     # Renders the feed
    └── post.js     # Editor: writes posts to this repository via the GitHub API
```

## Development

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## License

MIT
