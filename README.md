# C:\PLAY

A static, no-backend DOS web player built with [js-dos](https://js-dos.com/).

## Features

- Run DOS games in-browser with no local emulator install.
- Bring-your-own bundle support (`.jsdos` / `.zip`).
- Paste-and-load support for direct URLs and GitHub links (blob/raw/repo), with cloud share-link normalization for Google Drive/Dropbox/OneDrive.
- Demo launch buttons for shareware test bundles.
- Saved settings (CPU cycles, memory, sound, and theme tint) via `localStorage`.
- Retro-inspired UI with modern layout and fullscreen mode.

## Run locally

Because browsers block module scripts from `file://`, use a local static server:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Do users need to download first?

Usually **no**. If users paste a compatible direct URL (or a supported GitHub/cloud share link), C:\PLAY starts it directly in the browser.

Users only need to download manually when a host blocks browser fetches (CORS/auth/interstitial pages), then they can use local upload.

## Where to find legal shareware/freeware DOS titles

Good sources to start from:

- **DOS Games Archive** (https://www.dosgamesarchive.com/) — focused on free DOS games.
- **ClassicReload** (https://classicreload.com/) — useful for discovering titles and metadata, then verifying original license/distribution rights.
- **Internet Archive: Software Library (MS-DOS)** (https://archive.org/details/softwarelibrary_msdos_games) — large catalog, but always verify redistribution rights per title.
- **GOG/Steam “Classic” pages** — not freeware, but useful to identify which games are still commercially sold (avoid bundling these).

Tips for safe inclusion:

- Prefer games explicitly labeled **freeware**, **shareware**, or with a clear redistribution statement.
- Keep a small `licenses.md` (or JSON manifest) listing each demo game and source URL/license note.
- When uncertain, do not bundle: let users supply their own files.

## Notes

- This project is intentionally backend-free: files are loaded directly in the browser.
- User-provided bundles are never uploaded.
- Some remote links may fail because of CORS, virus-scan interstitials, auth gates, or unexpected archive structure.
- Legal distribution of games is your responsibility; the demos should only point to content you are allowed to redistribute.
