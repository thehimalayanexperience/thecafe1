# THE Himalayan Experience Cafe — website

Static site for GitHub Pages. The whole menu lives in one data file; nothing else needs editing.

## Files

| File | What it is |
| --- | --- |
| `index.dc.html` | The public site + QR menu. Reads `data/menu.json`. |
| `adminpanelthecafe.dc.html` | Staff panel: items, prices, sold-out, today's board, events. Unguessable filename — this is the only way in, so bookmark it. |
| `qr-cards.dc.html` | Printable QR sheets — four table cards, plus one counter card. |
| `data/menu.json` | **The single source of truth.** Everything on the site comes from here. |
| `qr.js` | Self-contained QR encoder. No CDN, works offline. |
| `doc-page.js`, `support.js` | Page/runtime helpers. Leave them alone. |
| `assets/logo.png` | Cafe logo. |
| `assets/items/` | Item and event photos uploaded from the admin panel. |
| `assets/photos/` | Cafe photos: interior, storefront, entrance, latte art, dishes. |

## Publishing to GitHub Pages

1. Push these files to `thehimalayanexperience/thecafe` on branch `main`.
2. Repository → Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Copy `index.dc.html` to `index.html` so the site answers at the bare URL:
   ```
   cp index.dc.html index.html
   ```
   Do this again whenever `index.dc.html` changes. Everything it loads is referenced
   relatively, so the copy works unchanged.
4. The site is then at `https://thehimalayanexperience.github.io/thecafe/`.
   That is the URL baked into the QR cards. If you use a custom domain instead,
   open `qr-cards.dc.html` and change the `siteUrl` value before printing.

## Updating the menu

Open `adminpanelthecafe.dc.html` (on the live site: `/adminpanelthecafe.dc.html`).
There is no link to it from the public site and no password — a static site cannot
authenticate anyone, so the filename is the lock. Bookmark it and do not share it.
Even if someone finds it, they cannot publish without your token. Two ways to save:

**One click — connect a token once.** Setup → paste a GitHub fine-grained token with
**Contents: Read and write** on this repository only. Create one at
<https://github.com/settings/personal-access-tokens/new>. Publish then commits
`data/menu.json` straight to the repo and the live site updates in about a minute.
The token is stored in that browser only, never in the repository.

**No token.** Export JSON downloads `menu.json`; drag it into `data/` on github.com
to replace the old one.

Either way, **Preview** opens the site with your unsaved changes so you can check
before anything goes live.

## Photos

Photos are optional per item. With a token connected, Upload puts the file in
`assets/items/` and fills the path in. Without one, paste any image URL.
Keep them square-ish and under about 300 KB.

## Event registrations

GitHub Pages can't store form submissions. Events link out to a Google Form —
paste the form link once in Events and every event uses it, or give an event its
own link. Responses collect in the linked Google Sheet.

## Printing QR cards

Open `qr-cards.dc.html` and print. Page 1 is four identical table cards on letter
paper with cut lines; page 2 is a single large counter card. Print on the heaviest
stock your printer takes.
