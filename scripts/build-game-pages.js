#!/usr/bin/env node
// Fetches library.json and generates static /games/[slug]/index.html pages + sitemap.xml

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const LIBRARY_URL = 'https://raw.githubusercontent.com/yal-pj/dos-freeware-games-library/main/library.json';
const BASE_URL = 'https://playdosgames.xyz';
const ROOT_DIR = path.join(__dirname, '..');
const GAMES_DIR = path.join(ROOT_DIR, 'games');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function slugify(str) {
  return String(str).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDescription(game) {
  const { title, genre, year, license } = game;
  const genrePart = genre ? ` ${genre}` : '';
  const yearPart = year ? ` from ${year}` : '';
  const licensePart = license && license.toLowerCase() !== 'unknown' ? ` ${license}.` : '';
  return `Play ${title}, a classic${genrePart} DOS game${yearPart}.${licensePart} Available free online via C:\\PLAY — no download or install required.`;
}

function buildGamePage(game, slug) {
  const desc = buildDescription(game);
  const title = game.title;
  const year = game.year;
  const genre = game.genre || 'Classic';
  const screenshot = game.screenshot || `${BASE_URL}/assets/og-preview.png`;
  const hasBundle = !!(game.hasBundle && game.downloadUrl);
  const playUrl = hasBundle
    ? `${BASE_URL}/?bundle=${encodeURIComponent(game.downloadUrl)}`
    : `${BASE_URL}/library/`;

  const videoGameLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: title,
    description: desc,
    genre: genre,
    gamePlatform: 'DOS',
    applicationCategory: 'Game',
    url: `${BASE_URL}/games/${slug}/`,
    playMode: 'SinglePlayer',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isPartOf: { '@type': 'WebApplication', name: 'C:\\PLAY', url: `${BASE_URL}/` },
  };
  if (year) videoGameLd.datePublished = String(year);
  if (game.screenshot) videoGameLd.image = game.screenshot;
  if (Array.isArray(game.tags) && game.tags.length > 0) {
    videoGameLd.keywords = game.tags.join(', ');
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'C:\\PLAY', item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'A:\\GAMES Library', item: `${BASE_URL}/library/` },
      { '@type': 'ListItem', position: 3, name: title, item: `${BASE_URL}/games/${slug}/` },
    ],
  };

  const screenshotTag = game.screenshot
    ? `\n    <div class="gs-img"><img src="${esc(game.screenshot)}" alt="${esc(title)} DOS game screenshot" width="640" height="400" loading="eager" /></div>`
    : '';

  const genreFilterUrl = `${BASE_URL}/library/?genre=${encodeURIComponent(genre)}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Play ${esc(title)} Free in Browser — DOS Game | C:\\PLAY</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <link rel="canonical" href="${BASE_URL}/games/${slug}/" />
  <meta name="theme-color" content="#1a1a2e" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Play ${esc(title)} — Free DOS Game | C:\\PLAY" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${BASE_URL}/games/${slug}/" />
  <meta property="og:image" content="${esc(screenshot)}" />
  <meta property="og:image:alt" content="${esc(title)} DOS game screenshot" />
  <meta property="og:image:width" content="640" />
  <meta property="og:image:height" content="400" />
  <meta property="og:site_name" content="C:\\PLAY" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Play ${esc(title)} — Free DOS Game | C:\\PLAY" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${esc(screenshot)}" />
  <script type="application/ld+json">
${JSON.stringify(videoGameLd, null, 2)}
  </script>
  <script type="application/ld+json">
${JSON.stringify(breadcrumbLd, null, 2)}
  </script>
  <link rel="manifest" href="/manifest.json" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --bg: #05080d; --panel: #0d1117; --border: #222b3a; --accent: #ffb454; --text: #d4dae6; --muted: #6b7a90; }
    body { background: var(--bg); color: var(--text); font-family: 'IBM Plex Mono', 'Courier New', monospace; min-height: 100vh; display: flex; flex-direction: column; }
    a { color: var(--accent); }
    .top-bar { background: var(--panel); border-bottom: 1px solid var(--border); padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .brand { color: var(--accent); font-size: 1rem; font-weight: 700; letter-spacing: 0.05em; text-decoration: none; }
    .top-nav { display: flex; gap: 16px; }
    .top-nav a { color: var(--muted); text-decoration: none; font-size: 0.82rem; }
    .top-nav a:hover { color: var(--accent); }
    .page { max-width: 800px; margin: 0 auto; padding: 36px 24px; flex: 1; }
    .breadcrumb { font-size: 0.78rem; color: var(--muted); margin-bottom: 28px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .breadcrumb a { color: var(--muted); text-decoration: none; }
    .breadcrumb a:hover { color: var(--accent); }
    .game-title { font-size: 1.75rem; color: var(--accent); margin-bottom: 12px; line-height: 1.25; }
    .meta-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
    .badge { background: var(--panel); border: 1px solid var(--border); padding: 3px 9px; font-size: 0.75rem; color: var(--muted); }
    .game-desc { font-size: 0.9rem; line-height: 1.75; color: var(--text); margin-bottom: 28px; max-width: 580px; }
    .gs-img { margin-bottom: 28px; }
    .gs-img img { max-width: 100%; border: 1px solid var(--border); display: block; }
    .play-btn { display: inline-block; background: var(--accent); color: #000; font-family: inherit; font-size: 1rem; font-weight: 700; padding: 13px 28px; text-decoration: none; letter-spacing: 0.04em; }
    .play-btn:hover { background: #ffc470; color: #000; }
    .play-note { margin-top: 10px; font-size: 0.78rem; color: var(--muted); }
    .more-section { border-top: 1px solid var(--border); padding-top: 28px; margin-top: 36px; }
    .more-section h2 { font-size: 0.8rem; color: var(--muted); letter-spacing: 0.08em; margin-bottom: 14px; }
    .link-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .link-card { background: var(--panel); border: 1px solid var(--border); padding: 11px 14px; text-decoration: none; color: var(--text); font-size: 0.82rem; flex: 1; min-width: 140px; }
    .link-card:hover { border-color: var(--accent); }
    .link-card strong { display: block; color: var(--accent); font-size: 0.85rem; margin-bottom: 3px; }
    footer { text-align: center; padding: 20px 16px; color: var(--muted); font-size: 0.72rem; border-top: 1px solid var(--border); }
    footer a { color: var(--muted); }
  </style>
</head>
<body>
  <header class="top-bar">
    <a class="brand" href="${BASE_URL}/">C:\\PLAY</a>
    <nav class="top-nav">
      <a href="${BASE_URL}/">Emulator</a>
      <a href="${BASE_URL}/library/">Game Library</a>
    </nav>
  </header>

  <main class="page">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="${BASE_URL}/">C:\\PLAY</a>
      <span>›</span>
      <a href="${BASE_URL}/library/">A:\\GAMES</a>
      <span>›</span>
      <span>${esc(title)}</span>
    </nav>

    <h1 class="game-title">Play ${esc(title)} in Your Browser</h1>
    <div class="meta-row">
      ${year ? `<span class="badge">Year: ${year}</span>` : ''}
      ${genre ? `<span class="badge">Genre: ${esc(genre)}</span>` : ''}
      ${game.license ? `<span class="badge">${esc(game.license)}</span>` : ''}
      <span class="badge">Platform: DOS</span>
    </div>
    ${screenshotTag}
    <p class="game-desc">${esc(desc)}</p>

    ${hasBundle
      ? `<a class="play-btn" href="${esc(playUrl)}">▶ Play ${esc(title)} Now</a>
         <p class="play-note">Runs in the C:\\PLAY browser emulator — no download or account required.</p>`
      : `<a class="play-btn" href="${BASE_URL}/library/">Browse Game Library</a>
         <p class="play-note">A playable bundle for ${esc(title)} is not yet available. Explore similar games in the library.</p>`
    }

    <div class="more-section">
      <h2>EXPLORE MORE</h2>
      <div class="link-row">
        <a class="link-card" href="${BASE_URL}/">
          <strong>C:\\PLAY Emulator</strong>
          Play any DOS game in your browser
        </a>
        <a class="link-card" href="${BASE_URL}/library/">
          <strong>A:\\GAMES Library</strong>
          Browse 500+ free DOS games
        </a>
        <a class="link-card" href="${esc(genreFilterUrl)}">
          <strong>${esc(genre)} Games</strong>
          More ${esc(genre)} titles in the library
        </a>
      </div>
    </div>
  </main>

  <footer>
    <a href="${BASE_URL}/">C:\\PLAY</a> — Free browser-based DOS emulator. Play classic DOS games online — no download required.
  </footer>
</body>
</html>`;
}

async function main() {
  console.log('Fetching library.json...');
  const rawData = await fetchUrl(LIBRARY_URL);
  const games = JSON.parse(rawData);
  console.log(`Found ${games.length} games.`);

  if (!fs.existsSync(GAMES_DIR)) {
    fs.mkdirSync(GAMES_DIR, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0];
  const generated = [];

  for (const game of games) {
    if (!game.title) continue;
    const slug = slugify(game.id || game.title);
    if (!slug) continue;

    const dir = path.join(GAMES_DIR, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildGamePage(game, slug), 'utf8');
    generated.push({ slug, priority: (game.hasBundle && game.downloadUrl) ? '0.7' : '0.5' });
  }

  console.log(`Generated ${generated.length} game pages.`);

  // Rewrite sitemap.xml with all URLs
  const staticUrls = [
    `  <url>\n    <loc>${BASE_URL}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    `  <url>\n    <loc>${BASE_URL}/library/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
  ];
  const gameUrls = generated.map(({ slug, priority }) =>
    `  <url>\n    <loc>${BASE_URL}/games/${slug}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`
  );

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticUrls,
    ...gameUrls,
    '</urlset>',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(ROOT_DIR, 'sitemap.xml'), sitemap, 'utf8');
  console.log(`Sitemap written with ${staticUrls.length + gameUrls.length} URLs.`);
}

main().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
