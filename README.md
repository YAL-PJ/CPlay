# C:\PLAY

A static, no-backend DOS web player built with [js-dos](https://js-dos.com/).

## Features

- Run DOS games in-browser with no local emulator install.
- Bring-your-own bundle support (`.jsdos` / `.zip`).
- Paste-and-load support for direct URLs and GitHub links (blob/raw/repo), with cloud share-link normalization for Google Drive/Dropbox/OneDrive.
- Expanded curated game library with categories, year metadata, quick filters, sorting, and random one-click play for instant sessions.
- Per-game source links plus one-click launch badges so users can immediately see what is runnable in-browser.
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

## Fully automated legal library pipeline

This repo now includes a bot that can scrape legal freeware/shareware metadata, build `.jsdos` bundles, publish them to your bundle repo, and regenerate `library.json`.

### Files added

- `tools/library-bot/` — scraper + bundler + library generator.
- `.github/workflows/library-bot.yml` — scheduled/dispatch automation.
- `library.json` — runtime game catalog loaded by `app.js`.

### One-time GitHub setup

1. Keep this repo public (C:\PLAY app).
2. Keep `YAL-PJ/dos-freeware-games-library` public (bundle storage repo).
3. Add a secret in this repo: `DOS_LIBRARY_TOKEN` (fine-grained PAT with `contents:write` on `dos-freeware-games-library`).
4. Run **Actions → Library Bot → Run workflow** once.

### Local bot run

```bash
npm --prefix tools/library-bot install
npm --prefix tools/library-bot run run
```

Optional env vars:

- `CPLAY_LIBRARY_REPO_PATH=/path/to/local/clone/of/dos-freeware-games-library`
- `CPLAY_BUNDLE_BASE_URL=https://raw.githubusercontent.com/YAL-PJ/dos-freeware-games-library/main/bundles`

### Runtime integration

`app.js` now automatically fetches `./library.json` on startup and merges it with built-in curated games.
