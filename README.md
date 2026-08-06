# C:\PLAY

C:\PLAY is a static, browser-based DOS game launcher built around [js-dos](https://js-dos.com/). It accepts compatible `.jsdos` or `.zip` bundles, starts them in a WebAssembly DOS runtime, and presents the emulator through a DOS-inspired interface.

This repository contains the player and catalog user interface. It **does not maintain the game catalog or game bundles**. Those are supplied by the separate [`dos-freeware-games-library`](https://github.com/yal-pj/dos-freeware-games-library) repository.

Live site: [playdosgames.xyz](https://playdosgames.xyz/)

## Architecture

C:\PLAY has no application backend and no package-managed client build. GitHub Pages serves the HTML, CSS, JavaScript, manifest, and images directly.

```text
                         build/deployment time
 dos-freeware-games-library/library.json ──> scripts/build-game-pages.js
                                              │
                                              ├──> games/<slug>/index.html
                                              └──> sitemap.xml

                              browser runtime
 dos-freeware-games-library/library.json ──> catalog and featured-game UIs
                                              │ selected downloadUrl
 local file or remote bundle URL ─────────────┴──> app.js
                                                       │
 js-dos assets from v8.js-dos.com ────────────────────> js-dos / DOSBox runtime
                                                       │
                                  localStorage <── settings
                                      IndexedDB <── save records
```

The main page (`index.html` and `app.js`) owns emulator startup, shutdown, settings, URL handling, and saves. The library route (`library/`) is a separate catalog application that can run standalone or inside the main page's sandboxed iframe. When embedded, it sends the selected catalog entry's `downloadUrl` to the parent with `postMessage`; the parent closes the library and launches that URL.

## Relationship to `dos-freeware-games-library`

The upstream library repository is the source of truth for catalog records. C:\PLAY reads its `library.json` from the `main` branch on `raw.githubusercontent.com` in three contexts:

1. The main player fetches it for random featured games, its visual file browser, and its DOS-like command interface.
2. The standalone library fetches and normalizes it for browsing. It uses fields including `id`, `title`/`name`, `source`, `genre`, `category`, `year`, `license`, `screenshot`, `sourceUrl`, `downloadUrl`, `metadataOnly`, `status`, and `tags`. An entry is playable when it has a non-empty `downloadUrl`.
3. The deployment generator fetches it to create crawlable game pages and rebuild the sitemap.

C:\PLAY does not copy the catalog into this repository, validate licensing, curate entries, or host the bundles. Catalog corrections, additions, removals, metadata, and bundle URLs belong in `dos-freeware-games-library`. At runtime, C:\PLAY passes a selected `downloadUrl` to js-dos; availability therefore depends on the upstream metadata and the referenced host.

The library page also accepts a `library` query parameter to override the catalog URL and a `cplay` parameter for a standalone player's URL. These are integration hooks, not a catalog-management system.

## Implemented features

### Player

- Select or drag and drop local `.jsdos` and `.zip` files.
- Launch an HTTP(S) bundle URL supplied directly or through the catalog.
- Rewrite GitHub blob/raw links, resolve a GitHub repository URL to its default-branch ZIP archive, and add download parameters for recognized Google Drive, Dropbox, and OneDrive links.
- Start and stop js-dos, display boot/error overlays, attempt to pass js-dos's click-to-start screen, and enter fullscreen automatically on non-mobile launches.
- Configure DOSBox memory (8–64 MB), CPU cycles (500–50,000), and sound; retain these values in `localStorage`.
- Toggle sound and select amber, green, or ice interface tints.
- Show a landscape-orientation hint for mobile browsers.

### Saves

- Ask the active js-dos command interface for state through its `save()` or `persist()` method.
- Store save metadata, serialized state bytes when returned, and an optional canvas thumbnail in IndexedDB.
- List, load, and delete saved records.

### Catalog experiences

- Show six randomly selected playable entries on the player boot screen.
- Browse playable entries through a keyboard-accessible, DOS-style file list.
- Use a simulated DOS command prompt with `DIR`, `DIR /B`, `DIR /W`, `CLS`, `VER`, `CD`, and `HELP`, or launch a game by typing its displayed `.JSDOS` name. File sizes, dates, free space, and DOS version shown there are presentation data, not catalog metadata or an emulated shell.
- Open the full library in an iframe or visit `/library/` directly.
- Search the full library and filter it by genre, decade, license, and playable/info-only status.
- Sort by name, release year, or genre; paginate at 50 entries per page; open source-information links; or choose a random filtered entry.

### Publishing and discovery

- Serve metadata, Open Graph/Twitter tags, structured data, a web app manifest, `robots.txt`, `llms.txt`, and a sitemap.
- Generate one static metadata page per catalog entry during deployment. Playable pages link back to the player with the bundle in the `bundle` query parameter.
- Deploy to GitHub Pages from `main` through GitHub Actions, using the custom domain in `CNAME`.
- Send Google Analytics events and browser performance/engagement measurements when the configured analytics script is available.

## Application flow

1. A browser loads the static main page, js-dos CSS/JavaScript from `v8.js-dos.com`, and the local ES module.
2. The module restores saved settings, initializes the IndexedDB save list, reads an optional `?bundle=` URL, and fetches upstream catalog data for the boot-screen experiences.
3. The user selects a local bundle, enters a remote URL, chooses a featured/file-browser result, or opens the full library.
4. A library selection is sent to the parent player as a `launchGame` message. Direct visits can instead open a configured C:\PLAY URL or, without one, open the bundle itself.
5. The player stops any previous emulator, cleans up object URLs and tracked audio contexts, builds a DOSBox configuration, and calls `window.Dos(...)` with the bundle URL.
6. Settings remain in `localStorage`; explicitly requested save records remain in IndexedDB. Neither is synchronized to a server.

## Technologies

- Semantic HTML5 and responsive CSS
- Vanilla JavaScript ES modules and DOM APIs
- [js-dos v8](https://js-dos.com/) loaded from its `latest` CDN path
- WebAssembly/DOSBox through js-dos
- Browser `localStorage`, IndexedDB, Fullscreen, Canvas, Web Audio, and Performance Observer APIs
- Dependency-free Node.js script for static page and sitemap generation
- GitHub Actions and GitHub Pages
- Google Analytics 4

## Repository structure

```text
.
├── .github/workflows/deploy.yml  # Generate catalog pages, then publish GitHub Pages
├── assets/                       # Social preview and featured-game images
├── library/
│   ├── index.html                # Standalone/embedded catalog markup
│   ├── app.js                    # Catalog loading, normalization, filters, and launch bridge
│   └── styles.css                # Catalog presentation
├── scripts/
│   └── build-game-pages.js       # Catalog-driven static pages and sitemap generator
├── app.js                        # Main player, saves, settings, and compact catalog interfaces
├── index.html                    # Player shell, SEO data, FAQ, and iframe containers
├── styles.css                    # Player and DOS-inspired UI
├── manifest.json                 # Web app metadata
├── sitemap.xml                   # Checked-in base sitemap; regenerated during deployment
├── robots.txt                    # Crawler directives
├── llms.txt                      # Machine-readable site summary
├── CNAME                         # GitHub Pages custom domain
└── README.md
```

`games/` is intentionally absent from the checked-in tree. The deployment workflow creates it from the current upstream catalog before uploading the Pages artifact.

## Run locally

There are no declared npm dependencies and no required application build step. Serve the repository over HTTP because the browser loads `app.js` as an ES module:

```bash
git clone https://github.com/yal-pj/CPlay.git
cd CPlay
python3 -m http.server 4173
```

Then open <http://localhost:4173/>. Network access is required for js-dos and all upstream catalog-backed views. A local bundle still requires the js-dos runtime assets from the CDN.

To reproduce deployment-time generation:

```bash
node scripts/build-game-pages.js
```

This command fetches the current upstream `library.json`, creates or overwrites `games/<slug>/index.html`, and replaces `sitemap.xml`. Generated files can be numerous and are not automatically removed when an upstream entry disappears.

## Limitations and operational notes

- **External dependencies:** emulator startup depends on the js-dos `latest` CDN URL. Catalog browsing and generation depend on GitHub raw content, while remote bundles and screenshots depend on their individual hosts.
- **CORS and share links:** URL rewriting does not bypass authentication, CORS restrictions, download confirmation pages, rate limits, or incompatible archives. A GitHub repository archive is not necessarily a valid js-dos bundle.
- **Bundle compatibility:** accepting a `.zip` extension does not guarantee that its contents have the layout or startup configuration js-dos requires. Some games may need DOSBox configuration beyond the exposed cycles, memory, and sound controls.
- **Local-only persistence:** settings and saves are browser- and origin-local, with no accounts, export/import, or cloud synchronization. Clearing site data removes them.
- **Save support varies:** saving/restoring relies on methods exposed by the active js-dos command interface. A record may contain no state bytes, in which case loading only restarts its bundle. Saves made from uploaded files retain a temporary `blob:` URL, so they are not durable after that URL is revoked or the page session ends.
- **Catalog availability:** failed catalog requests produce empty/offline states. C:\PLAY does not ship a fallback catalog snapshot.
- **Integration trust boundary:** the iframe and parent currently exchange `postMessage` events with wildcard origins and validate message shape, not sender origin. The library override query parameter can fetch another JSON endpoint if the browser permits it.
- **Generated content:** static game pages reflect upstream fields at build time and can become stale until the next successful deployment. Slug collisions are not detected.
- **Testing:** the repository has no automated test suite, lint configuration, package manifest, service worker, or offline cache.
- **Mobile input:** responsive layouts and an orientation hint are implemented, but C:\PLAY does not provide an on-screen game keyboard or gamepad; actual game controls depend on js-dos and available input hardware.

## Ownership boundary

Changes to the emulator, browser UI, launch flow, persistence, deployment, or catalog presentation belong here. Changes to the list of games, their metadata, licensing classifications, screenshots, source links, or downloadable bundles belong in [`dos-freeware-games-library`](https://github.com/yal-pj/dos-freeware-games-library).
