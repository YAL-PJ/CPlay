/* ── C:\PLAY  —  app.js ─────────────────────────────────────────── */

// ── DOM References ────────────────────────────────────────────────
const dom = {
  statusText: document.getElementById("statusText"),
  dropzone: document.getElementById("dropzone"),
  bundleInput: document.getElementById("bundleInput"),
  bundleUrlInput: document.getElementById("bundleUrl"),
  loadUrlBtn: document.getElementById("loadUrlBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  stopBtn: document.getElementById("stopBtn"),
  saveBtn: document.getElementById("saveBtn"),
  playerShell: document.getElementById("playerShell"),
  playerHost: document.getElementById("dos-player"),
  emptyState: document.getElementById("emptyState"),
  savesList: document.getElementById("savesList"),
  gameGrid: document.getElementById("gameGrid"),
  featuredGameGrid: document.getElementById("featuredGameGrid"),
  openLibraryBtn: document.getElementById("openLibraryBtn"),
  closeLibraryBtn: document.getElementById("closeLibraryBtn"),
  libraryModal: document.getElementById("libraryModal"),
  gameSearchInput: document.getElementById("gameSearch"),
  gameQuickFilters: document.getElementById("gameQuickFilters"),
  gameSort: document.getElementById("gameSort"),
  randomPlayBtn: document.getElementById("randomPlayBtn"),
  visibleGamesCount: document.getElementById("visibleGamesCount"),
  instantGamesCount: document.getElementById("instantGamesCount"),
};

const settingsFields = {
  cycles: document.getElementById("cycles"),
  memsize: document.getElementById("memsize"),
  sound: document.getElementById("sound"),
  themeTint: document.getElementById("themeTint"),
};

const BASE_GAMES = [
  { id: "doom-shareware", name: "DOOM (Shareware)", source: "js-dos", category: "fps", year: 1993, instantPlay: true, icon: "./assets/doom.png", links: [{ type: "jsdos", label: "Play", url: "https://v8.js-dos.com/bundles/doom.jsdos" }] },
  { id: "doom2", name: "DOOM II", source: "dos-zone", category: "fps", year: 1994, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/custom/dos/doom2.jsdos" }] },
  { id: "wolf3d", name: "Wolfenstein 3D", source: "dos-zone", category: "fps", year: 1992, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/original/2X/a/ac888d1660aa253f0ed53bd6c962c894125aaa19.jsdos" }] },
  { id: "heretic", name: "Heretic", source: "dos-zone", category: "fps", year: 1994, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/custom/dos/heretic.jsdos" }] },
  { id: "prince-of-persia", name: "Prince of Persia", source: "dos-zone", category: "platformer", year: 1989, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/original/2X/1/1179a7c9e05b1679333ed6db08e7884f6e86c155.jsdos" }] },
  { id: "digger", name: "Digger", source: "js-dos", category: "arcade", year: 1983, instantPlay: true, icon: "./assets/digger.png", links: [{ type: "jsdos", label: "Play", url: "https://v8.js-dos.com/bundles/digger.jsdos" }] },
  { id: "mortal-kombat", name: "Mortal Kombat", source: "dos-zone", category: "fighting", year: 1993, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/original/2X/8/872f3668c36085d0b1ace46872145285364ee628.jsdos" }] },
  { id: "tyrian-2000", name: "Tyrian 2000", source: "dos-zone", category: "shooter", year: 1999, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/custom/dos/tyrian-2000.jsdos" }] },
  { id: "sim-city", name: "SimCity", source: "dos-zone", category: "strategy", year: 1989, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/original/2X/7/744842062905f72648a4d492ccc2526d039b3702.jsdos" }] },
  { id: "nfs-se", name: "Need for Speed: SE", source: "dos-zone", category: "racing", year: 1996, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/custom/dos/nfs.jsdos" }] },
  { id: "lost-vikings", name: "The Lost Vikings", source: "dos-zone", category: "puzzle", year: 1992, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/original/2X/1/1b063b2520052ebb504184667ac95e72423331de.jsdos" }] },
  { id: "out-of-this-world", name: "Out of This World", source: "dos-zone", category: "cinematic", year: 1991, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/original/2X/1/1031eb810e8b648fc5f777b3bd9cbc0187927fd4.jsdos" }] },
  { id: "gta", name: "Grand Theft Auto", source: "dos-zone", category: "action", year: 1997, instantPlay: true, icon: "", links: [{ type: "jsdos", label: "Play", url: "https://cdn.dos.zone/custom/dos/gta-mobile.jsdos" }] },
];

const QUICK_FILTERS = [
  { id: "all", label: "All", predicate: () => true },
  { id: "instant", label: "1-Click", predicate: g => g.instantPlay },
  { id: "fps", label: "FPS", predicate: g => g.category === "fps" },
  { id: "racing", label: "Racing", predicate: g => g.category === "racing" },
  { id: "retro", label: "80s/90s", predicate: g => g.year <= 1995 },
];

const FALLBACK_ICON = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#111"/><text y="50%" x="50%" dominant-baseline="middle" text-anchor="middle" font-size="50" fill="#333">?</text></svg>');
const defaultSettings = { cycles: 12000, memsize: 16, sound: "on", themeTint: "amber" };
const state = { ci: null, isRunning: false, startingLock: false, objectUrl: null, currentBundle: "", activeFilter: "all", sortBy: "name", libraryOpen: false };
let allGames = [...BASE_GAMES];

const getPlayableLink = game => game.links.find(link => link.type === "jsdos" || link.type === "zip") || game.links[0];
const log = (...a) => console.log("[CPLAY]", ...a);
const logError = (...a) => console.error("[CPLAY ERROR]", ...a);

function setStatus(message, type = "ok") { if (!dom.statusText) return; dom.statusText.textContent = `C:\\PLAY> ${message}${message.endsWith("_") ? "" : "_"}`; dom.statusText.className = type; }
function handleExitStatus(err) { const isExit = err && (err.name === "ExitStatus" || (err.message && err.message.includes("ExitStatus"))); return !!(isExit && (err.status === 0 || !err.status)); }
function showEmptyState(visible) { if (dom.emptyState) dom.emptyState.style.display = visible ? "" : "none"; }
function hideLoading() { document.getElementById("loadingOverlay")?.remove(); }
function showLoading(message) { hideLoading(); const overlay = document.createElement("div"); overlay.className = "loading-overlay"; overlay.id = "loadingOverlay"; overlay.innerHTML = '<div class="spinner"></div>'; const p = document.createElement("p"); p.textContent = message; overlay.appendChild(p); dom.playerShell.appendChild(overlay); }
function updateUI() { if (dom.stopBtn) dom.stopBtn.hidden = !state.isRunning; if (dom.saveBtn) dom.saveBtn.hidden = !state.isRunning; showEmptyState(!state.isRunning && !state.ci); }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function readSettings() { try { const stored = localStorage.getItem("cplay.settings"); if (stored) return { ...defaultSettings, ...JSON.parse(stored) }; } catch { localStorage.removeItem("cplay.settings"); } return { ...defaultSettings }; }
function persistSettings() { const value = { cycles: clamp(Number(settingsFields.cycles.value) || defaultSettings.cycles, 500, 50000), memsize: clamp(Number(settingsFields.memsize.value) || defaultSettings.memsize, 8, 64), sound: settingsFields.sound.value === "off" ? "off" : "on", themeTint: ["amber", "green", "ice"].includes(settingsFields.themeTint.value) ? settingsFields.themeTint.value : "amber" }; localStorage.setItem("cplay.settings", JSON.stringify(value)); document.documentElement.setAttribute("data-tint", value.themeTint); document.body.dataset.tint = value.themeTint; }
function hydrateSettingsUI() { const s = readSettings(); if (settingsFields.cycles) settingsFields.cycles.value = s.cycles; if (settingsFields.memsize) settingsFields.memsize.value = s.memsize; if (settingsFields.sound) settingsFields.sound.value = s.sound; if (settingsFields.themeTint) settingsFields.themeTint.value = s.themeTint; document.documentElement.setAttribute("data-tint", s.themeTint); document.body.dataset.tint = s.themeTint; }

function closeOrphanedAudioContexts() {
  try { if (window.audioContext && window.audioContext.state !== "closed") window.audioContext.close().catch(() => { }); } catch { }
  try { dom.playerHost.querySelectorAll("canvas").forEach(c => c.audioCtx?.state !== "closed" && c.audioCtx.close().catch(() => { })); } catch { }
}

async function stopCurrent() {
  hideLoading();
  if (state.ci) {
    try { if (typeof state.ci.exit === "function") await state.ci.exit(); else if (typeof state.ci.stop === "function") await state.ci.stop(); }
    catch (e) { if (!handleExitStatus(e)) logError("Stop error:", e); }
  }
  state.ci = null; state.isRunning = false;
  if (state.objectUrl) { URL.revokeObjectURL(state.objectUrl); state.objectUrl = null; }
  await new Promise(r => setTimeout(r, 100)); closeOrphanedAudioContexts(); if (dom.playerHost) dom.playerHost.innerHTML = ""; updateUI();
}

function buildDosboxConf() {
  const s = readSettings();
  return `\n[sdl]\nfullscreen=false\nfulldouble=true\n\n[dosbox]\nmemsize=${s.memsize}\n\n[cpu]\ncore=auto\ncycles=${s.cycles}\n\n[mixer]\nnosound=${s.sound === "on" ? "false" : "true"}\nrate=44100\nblocksize=2048\nprebuffer=40\n`;
}

async function startDos(bundleUrl) {
  if (state.startingLock) return;
  state.startingLock = true;
  try {
    await stopCurrent();
    showEmptyState(false); showLoading("Initializing System..."); setStatus("Booting...", "");
    if (window.emulators) window.emulators.pathPrefix = "https://v8.js-dos.com/latest/emulators/";
    const result = window.Dos(dom.playerHost, { url: bundleUrl, dosboxConf: buildDosboxConf(), kiosk: true });
    const ci = (result instanceof Promise) ? await result : result;
    if (!ci) throw new Error("Dos initialization returned null");
    state.ci = ci; state.isRunning = true; state.currentBundle = bundleUrl; updateUI();
    ci.events?.().onTerminate(() => stopCurrent().then(() => showEmptyState(true)));
    hideLoading(); setStatus("System Ready - Drive A:", "ok"); return { ok: true };
  } catch (err) {
    if (handleExitStatus(err)) { await stopCurrent(); return { ok: true }; }
    hideLoading(); setStatus(`System Error: ${err.message || "Unknown"}`, "error"); state.isRunning = false; updateUI();
    return { ok: false, errorMessage: err?.message || "Unknown error" };
  } finally { state.startingLock = false; }
}

async function loadUserBundle(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  if (!name.endsWith(".jsdos") && !name.endsWith(".zip")) return setStatus("Only .jsdos or .zip bundles are supported.", "error");
  const newUrl = URL.createObjectURL(file); showLoading(`Loading ${file.name}…`); setStatus(`Loading ${file.name}…`, "");
  const result = await startDos(newUrl);
  if (result.ok) state.objectUrl = newUrl; else URL.revokeObjectURL(newUrl);
}

function normalizeGithubUrl(urlValue) { try { const url = new URL(urlValue); const parts = url.pathname.split("/").filter(Boolean); if (url.hostname !== "github.com" || parts.length < 2) return urlValue; const [owner, repo, mode, branch, ...rest] = parts; if ((mode === "blob" || mode === "raw") && branch && rest.length > 0) return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`; return urlValue; } catch { return urlValue; } }
function transformCloudDriveUrl(urlValue) { try { const url = new URL(urlValue); if (url.hostname === "drive.google.com") { const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id"); if (fileId) return { finalUrl: `https://drive.google.com/uc?export=download&id=${fileId}`, note: "G-Drive converted." }; } if (url.hostname.endsWith("dropbox.com")) { url.searchParams.set("dl", "1"); return { finalUrl: url.toString(), note: "Dropbox converted." }; } if (url.hostname === "1drv.ms" || url.hostname.includes("onedrive")) { url.searchParams.set("download", "1"); return { finalUrl: url.toString(), note: "OneDrive converted." }; } } catch { } return { finalUrl: urlValue, note: "" }; }
async function resolveGithubRepoArchive(urlValue) { try { const url = new URL(urlValue); const parts = url.pathname.split("/").filter(Boolean); if (url.hostname !== "github.com" || parts.length !== 2) return normalizeGithubUrl(urlValue); const [owner, repo] = parts; const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { Accept: "application/vnd.github+json" } }); const data = await res.json(); return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${data.default_branch || "main"}`; } catch { return urlValue; } }

async function loadBundleFromUrl(rawUrl) {
  const typedUrl = (rawUrl || "").trim();
  if (!typedUrl) return setStatus("Paste a URL first.", "error");
  if (!/^https?:\/\//i.test(typedUrl)) return setStatus("Invalid URL protocol.", "error");
  let finalUrl = typedUrl; let note = "";
  try {
    if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(typedUrl)) { finalUrl = await resolveGithubRepoArchive(typedUrl); note = "GitHub archive."; }
    else finalUrl = normalizeGithubUrl(typedUrl);
    const cloud = transformCloudDriveUrl(finalUrl); finalUrl = cloud.finalUrl; note = note || cloud.note;
    showLoading("Fetching..."); setStatus("Loading from URL…", "");
    const result = await startDos(finalUrl);
    if (!result.ok) return setStatus(`Load failed: ${result.errorMessage || "Unknown error"}`, "error");
    if (note) setStatus(`Running (${note})`, "ok");
  } catch (err) { hideLoading(); setStatus(`Load failed: ${err.message}`, "error"); }
}

const DB_NAME = "cplay-saves-db"; const STORE_NAME = "saves";
function openDatabase() { return new Promise((resolve, reject) => { const req = indexedDB.open(DB_NAME, 1); req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME, { keyPath: "id" }); }; req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
async function dbTransaction(mode, handler) { const db = await openDatabase(); return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, mode); const store = tx.objectStore(STORE_NAME); handler(store, (val) => { db.close(); resolve(val); }, (err) => { db.close(); reject(err); }); tx.onerror = () => { db.close(); reject(tx.error); }; }); }
const getAllSaves = () => dbTransaction("readonly", (store, resolve) => { const req = store.getAll(); req.onsuccess = () => resolve(req.result.sort((a, b) => b.timestamp - a.timestamp)); });
const putSave = save => dbTransaction("readwrite", (store, resolve) => { const req = store.put(save); req.onsuccess = () => resolve(); });
const deleteSave = id => dbTransaction("readwrite", (store, resolve) => { const req = store.delete(id); req.onsuccess = () => resolve(); });

function captureScreenshot() { try { const canvas = dom.playerHost.querySelector("canvas"); if (!canvas) return null; const thumb = document.createElement("canvas"); const scale = 120 / Math.max(canvas.width, 1); thumb.width = Math.round(canvas.width * scale); thumb.height = Math.round(canvas.height * scale); thumb.getContext("2d").drawImage(canvas, 0, 0, thumb.width, thumb.height); return thumb.toDataURL("image/jpeg", 0.7); } catch { return null; } }
function toUint8Array(data) { if (!data) return null; if (data instanceof Uint8Array) return data; if (data instanceof ArrayBuffer) return new Uint8Array(data); if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength); if (Array.isArray(data)) return new Uint8Array(data); if (data && typeof data === "object") return toUint8Array(data.data || data.state || data.buffer); return null; }
async function saveEmulatorState(ci) {
  if (!ci) return { ok: false };
  if (typeof ci.save === "function") {
    try {
      const result = await ci.save();
      const bytes = toUint8Array(result);
      if (bytes?.length) return { ok: true, state: bytes };
      if (result === true) return { ok: true, state: null };
    } catch (err) { logError("ci.save() failed:", err); }
  }
  if (typeof ci.persist === "function") {
    try {
      const bytes = toUint8Array(await ci.persist());
      if (bytes?.length) return { ok: true, state: bytes };
    } catch (err) { logError("ci.persist() failed:", err); }
  }
  return { ok: false };
}

async function saveGameState() {
  if (!state.ci || !state.isRunning) return setStatus("Nothing running.", "error");
  const result = await saveEmulatorState(state.ci);
  if (!result.ok) return setStatus("Save not supported.", "error");
  let name = "Unknown";
  try { const url = new URL(state.currentBundle); name = decodeURIComponent((url.pathname.split("/").pop() || "").replace(/\.(jsdos|zip)$/i, "")) || "Custom Game"; } catch { }
  await putSave({ id: `save-${Date.now()}`, name, timestamp: Date.now(), bundleUrl: state.currentBundle, screenshot: captureScreenshot(), state: result.state ? Array.from(result.state) : null });
  setStatus(`Saved "${name}"`, "ok"); await renderSavesList();
}

async function loadGameState(id) {
  try {
    const save = (await getAllSaves()).find(s => s.id === id); if (!save) return;
    showLoading("Restoring..."); const result = await startDos(save.bundleUrl); if (!result.ok) return setStatus("Restore failed: could not start game.", "error");
    state.currentBundle = save.bundleUrl;
    if (save.state && state.ci && typeof state.ci.restore === "function") { await state.ci.restore(new Uint8Array(save.state)); setStatus(`Restored "${save.name}"`, "ok"); }
    else { setStatus(`Loaded "${save.name}"`, "ok"); }
  } catch { setStatus("Restore failed.", "error"); }
}

async function renderSavesList() {
  if (!dom.savesList) return;
  try {
    const saves = await getAllSaves();
    if (!saves.length) return (dom.savesList.innerHTML = '<p class="small-note">No saves yet.</p>');
    dom.savesList.innerHTML = "";
    saves.forEach(save => {
      const el = document.createElement("div"); el.className = "save-card";
      if (save.screenshot) { const img = document.createElement("img"); img.src = save.screenshot; img.className = "save-thumb"; el.appendChild(img); }
      const info = document.createElement("div"); info.className = "save-info";
      const saveName = document.createElement("span"); saveName.className = "save-name"; saveName.textContent = save.name; info.appendChild(saveName);
      const saveDate = document.createElement("span"); saveDate.className = "save-date"; saveDate.textContent = new Date(save.timestamp).toLocaleString(); info.appendChild(saveDate);
      el.appendChild(info);
      const actions = document.createElement("div"); actions.className = "save-actions";
      const loadBtn = document.createElement("button"); loadBtn.className = "action-btn"; loadBtn.textContent = "Load"; loadBtn.addEventListener("click", () => loadGameState(save.id));
      const delBtn = document.createElement("button"); delBtn.className = "ghost-btn"; delBtn.textContent = "Del"; delBtn.addEventListener("click", () => confirm("Delete this save?") && deleteSave(save.id).then(renderSavesList));
      actions.append(loadBtn, delBtn); el.appendChild(actions); dom.savesList.appendChild(el);
    });
  } catch { }
}



function normalizeLibraryEntry(entry) {
  const name = String(entry.title || entry.name || "").trim();
  const downloadUrl = String(entry.downloadUrl || "").trim();
  if (!name || !downloadUrl) return null;
  const links = [];
  if (downloadUrl) links.push({ type: "jsdos", label: "Play", url: downloadUrl });
  const id = String(entry.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  return {
    id: id || `game-${Math.random().toString(16).slice(2)}`,
    name,
    source: String(entry.source || "community-library"),
    category: String(entry.category || entry.genre || "other").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "other",
    year: Number(entry.year) || 0,
    instantPlay: Boolean(downloadUrl),
    icon: String(entry.icon || ""),
    links,
    license: entry.license || ""
  };
}

async function loadExternalLibrary() {
  try {
    const response = await fetch("./library.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("library.json is not an array");
    const imported = data.map(normalizeLibraryEntry).filter(Boolean);
    if (!imported.length) {
      allGames = [...BASE_GAMES];
      return;
    }
    const merged = [...BASE_GAMES];
    const seen = new Set(merged.map(g => g.id));
    imported.forEach(game => { if (!seen.has(game.id)) { seen.add(game.id); merged.push(game); } });
    allGames = merged;
  } catch (error) {
    logError("Failed to load library.json", error);
    allGames = [...BASE_GAMES];
  }
}

function hintForFetchFailure(urlValue) { return (new URL(urlValue).hostname.includes("dos.zone")) ? "This host blocked browser fetch. Click listing or download then drag into C:\\PLAY." : "Host blocked browser fetch. Open listing or download, then drag the file into C:\\PLAY."; }

function setupFilterUI() {
  if (!dom.gameQuickFilters) return;
  dom.gameQuickFilters.innerHTML = "";
  QUICK_FILTERS.forEach(filter => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `quick-filter ${filter.id === state.activeFilter ? "active" : ""}`;
    btn.textContent = filter.label;
    btn.addEventListener("click", () => { state.activeFilter = filter.id; renderGameGrid(dom.gameSearchInput?.value || ""); });
    dom.gameQuickFilters.appendChild(btn);
  });
}

function getFilteredGames(filterText = "") {
  const query = filterText.toLowerCase().trim();
  const quickFilter = QUICK_FILTERS.find(f => f.id === state.activeFilter) || QUICK_FILTERS[0];
  let games = allGames.filter(g => quickFilter.predicate(g));
  if (query) {
    games = games.filter(g => [g.name, g.source, g.category, String(g.year), ...g.links.map(l => `${l.label} ${l.type}`)].join(" ").toLowerCase().includes(query));
  }
  games.sort((a, b) => {
    if (state.sortBy === "year") return b.year - a.year;
    if (state.sortBy === "source") return a.source.localeCompare(b.source);
    return a.name.localeCompare(b.name);
  });
  return games;
}

function setLibraryOpen(open) {
  state.libraryOpen = open;
  if (!dom.libraryModal) return;
  dom.libraryModal.hidden = !open;
  document.body.classList.toggle("library-open", open);
  if (open) dom.gameSearchInput?.focus();
}

function createGameCard(game) {
  const card = document.createElement("article"); card.className = "game-card";

  const iconWrap = document.createElement("div"); iconWrap.className = "game-icon-container";
  const img = document.createElement("img"); img.src = game.icon || FALLBACK_ICON; img.className = "game-thumb"; img.alt = game.name + " cover";
  img.addEventListener("error", () => { img.src = FALLBACK_ICON; }, { once: true });
  iconWrap.appendChild(img); card.appendChild(iconWrap);

  const label = document.createElement("span"); label.className = "game-label"; label.textContent = game.name; card.appendChild(label);
  const source = document.createElement("span"); source.className = "game-source"; source.textContent = `${game.source} • ${game.year}`; card.appendChild(source);
  const badge = document.createElement("span"); badge.className = "game-badge " + (game.instantPlay ? "badge-instant" : "badge-manual"); badge.textContent = game.instantPlay ? "1-Click" : "Manual"; card.appendChild(badge);

  const playableLink = getPlayableLink(game);
  if (playableLink?.type === "jsdos" || playableLink?.type === "zip") {
    const btnRow = document.createElement("div"); btnRow.className = "game-btn-row";

    const playBtn = document.createElement("button"); playBtn.type = "button"; playBtn.className = "play-btn"; playBtn.textContent = "Play";
    playBtn.addEventListener("click", e => {
      e.stopPropagation(); setStatus(`Loading ${game.name}...`, "");
      startDos(playableLink.url).then(result => { if (!result.ok && /failed to fetch/i.test(result.errorMessage || "")) { setStatus(hintForFetchFailure(playableLink.url), "error"); window.open(playableLink.url, "_blank", "noopener,noreferrer"); } });
    });
    btnRow.appendChild(playBtn);

    const dlBtn = document.createElement("a"); dlBtn.href = playableLink.url; dlBtn.className = "dl-btn"; dlBtn.textContent = "\u2B07"; dlBtn.title = "Download .jsdos bundle";
    dlBtn.setAttribute("download", ""); dlBtn.addEventListener("click", e => e.stopPropagation());
    btnRow.appendChild(dlBtn);

    card.appendChild(btnRow);
  }

  card.addEventListener("click", () => {
    if (!playableLink) return;
    setStatus(`Loading ${game.name}...`, "");
    startDos(playableLink.url).then(result => { if (!result.ok && /failed to fetch/i.test(result.errorMessage || "")) setStatus(hintForFetchFailure(playableLink.url), "error"); });
  });
  return card;
}

function renderFeaturedGames() {
  if (!dom.featuredGameGrid) return;
  dom.featuredGameGrid.innerHTML = "";
  allGames.filter(g => g.instantPlay).slice(0, 3).forEach(game => dom.featuredGameGrid.appendChild(createGameCard(game)));
}

function renderGameGrid(filter = "") {
  if (!dom.gameGrid) return;
  const filtered = getFilteredGames(filter);
  dom.gameGrid.innerHTML = "";
  filtered.forEach(game => dom.gameGrid.appendChild(createGameCard(game)));

  if (dom.visibleGamesCount) dom.visibleGamesCount.textContent = String(filtered.length);
  if (dom.instantGamesCount) dom.instantGamesCount.textContent = String(filtered.filter(g => g.instantPlay).length);
  setupFilterUI();
}

function playRandomGame() {
  const candidates = getFilteredGames(dom.gameSearchInput?.value || "").filter(g => g.instantPlay);
  if (!candidates.length) return setStatus("No instant-play game in current filter.", "error");
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const playableLink = getPlayableLink(picked);
  setStatus(`Launching random game: ${picked.name}`, "ok");
  startDos(playableLink.url);
}

function setupEventListeners() {
  dom.dropzone?.addEventListener("dragover", e => { e.preventDefault(); dom.dropzone.classList.add("dragging"); });
  dom.dropzone?.addEventListener("dragleave", () => dom.dropzone.classList.remove("dragging"));
  dom.dropzone?.addEventListener("drop", e => { e.preventDefault(); dom.dropzone.classList.remove("dragging"); loadUserBundle(e.dataTransfer.files[0]); });
  dom.bundleInput?.addEventListener("change", e => { loadUserBundle(e.target.files[0]); e.target.value = ""; });
  dom.loadUrlBtn?.addEventListener("click", () => loadBundleFromUrl(dom.bundleUrlInput?.value));
  dom.bundleUrlInput?.addEventListener("keydown", e => { if (e.key === "Enter") loadBundleFromUrl(dom.bundleUrlInput.value); });
  dom.gameSearchInput?.addEventListener("input", e => renderGameGrid(e.target.value));
  dom.gameSort?.addEventListener("change", e => { state.sortBy = e.target.value; renderGameGrid(dom.gameSearchInput?.value || ""); });
  dom.randomPlayBtn?.addEventListener("click", playRandomGame);
  dom.openLibraryBtn?.addEventListener("click", () => setLibraryOpen(true));
  dom.closeLibraryBtn?.addEventListener("click", () => setLibraryOpen(false));
  dom.libraryModal?.addEventListener("click", e => { if (e.target === dom.libraryModal) setLibraryOpen(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && state.libraryOpen) setLibraryOpen(false); });
  dom.stopBtn?.addEventListener("click", () => stopCurrent().then(() => setStatus("Stopped")));
  dom.saveBtn?.addEventListener("click", saveGameState);
  dom.fullscreenBtn?.addEventListener("click", () => !document.fullscreenElement ? dom.playerShell?.requestFullscreen() : document.exitFullscreen());
  Object.values(settingsFields).forEach(f => f?.addEventListener("change", persistSettings));
}

window.addEventListener("unhandledrejection", event => { if (handleExitStatus(event.reason)) event.preventDefault(); });

document.addEventListener("DOMContentLoaded", async () => {
  hydrateSettingsUI(); setupEventListeners();
  await loadExternalLibrary();
  renderGameGrid(); renderFeaturedGames(); renderSavesList();
  const loadedCount = Math.max(0, allGames.length - BASE_GAMES.length);
  setStatus(`Ready — ${loadedCount ? `${loadedCount} auto library games loaded` : "curated 1-click library loaded"}`, "ok"); updateUI();
});
