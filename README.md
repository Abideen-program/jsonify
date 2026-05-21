# Jsonify — Chrome Extension

> The fast JSON viewer. Live search, virtual rendering for large files, and auto-detection of stringified JSON.

---

## Features

- **Virtual rendering** — handles 50MB+ JSON without freezing. Only visible rows hit the DOM.
- **Live search** — type to filter the tree in real time, with match highlighting
- **Stringified JSON detection** — auto-detects escaped JSON strings and lets you expand them inline
- **Click-to-copy** — copy any key's dot-path or value with one click
- **Dark / light theme** — auto-reads your OS preference, overridable in settings
- **Stats bar** — instant type breakdown (strings, numbers, booleans) and file size
- **Breadcrumb nav** — always shows the path of the node you last clicked
- **Raw ↔ formatted** — toggle between the parsed tree and the raw JSON string
- **Block list** — ignore specific domains from rendering

---

## Load in Chrome (development)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this folder (`jsonify/`)
5. Open any URL that returns JSON — e.g. `https://api.github.com/users/torvalds`

That's it. No build step, no npm install, no bundler.

---

## File structure

```
jsonify/
├── manifest.json        # Extension config (Manifest V3)
├── popup.html           # Settings popup (click extension icon)
├── popup.js             # Popup logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── detector.js      # Sniffs if the page is JSON
    ├── renderer.js      # Virtual tree builder + search + stringified detection
    ├── toolbar.js       # Search bar, stats bar, breadcrumb UI
    ├── main.js          # Orchestrates everything, handles all events
    └── theme.css        # Full dark + light theme
```

---

## Test URLs

These URLs return raw JSON — great for testing:

```
https://api.github.com/users/torvalds
https://api.github.com/repos/torvalds/linux
https://jsonplaceholder.typicode.com/posts
https://jsonplaceholder.typicode.com/users
```

For large JSON performance testing:
```
https://raw.githubusercontent.com/json-iterator/test-data/master/large-file.json
```

---

## Roadmap

- **v1.0** — Virtual rendering, live search, stringified detection, copy path, dark/light
- **v1.1** — Inline value editing, response history (last 10)
- **v2.0** — YAML/XML import, shareable JSON links, diff view

---

## Publishing to Chrome Web Store

1. Zip the entire `jsonify/` folder
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay the one-time $5 developer fee
4. Upload the zip, add screenshots, publish

---

## Stack

Vanilla JS · CSS custom properties · Chrome Extension Manifest V3 · No dependencies · No build step
# jsonify
