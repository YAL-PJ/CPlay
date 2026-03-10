/* ── C:\PLAY  —  app.js ─────────────────────────────────────────── */

// ── DOM refs ──────────────────────────────────────────────────────
const statusText    = document.getElementById("statusText");
const dropzone      = document.getElementById("dropzone");
const bundleInput   = document.getElementById("bundleInput");
const bundleUrlInput = document.getElementById("bundleUrl");
const loadUrlBtn    = document.getElementById("loadUrlBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const stopBtn       = document.getElementById("stopBtn");
const saveBtn       = document.getElementById("saveBtn");
const playerShell   = document.getElementById("playerShell");
const playerHost    = document.getElementById("dos-player");
const emptyState    = document.getElementById("emptyState");
const savesList     = document.getElementById("savesList");

const settingsFields = {
  cycles:    document.getElementById("cycles"),
  memsize:   document.getElementById("memsize"),
  sound:     document.getElementById("sound"),
  themeTint: document.getElementById("themeTint"),
};

// ── Constants ─────────────────────────────────────────────────────
const demoBundles = {
  doom:    "https://cdn.dos.zone/custom/dos/doom.jsdos",
  digger:  "https://v8.js-dos.com/bundles/digger.jsdos",
  pinball: "https://cdn.dos.zone/custom/dos/epic-pinball.jsdos",
};

const defaultSettings = {
  cycles:    12000,
  memsize:   16,
  sound:     "on",
  themeTint: "amber",
};

// ── AudioContext tracking ────────────────────────────────────────
// Patch AudioContext so we can close every instance on game stop.
// js-dos (and DOSBox WASM) may create AudioContexts that outlive ci.exit().
window._cplayAudioContexts = [];
const _OrigAudioContext = window.AudioContext || window.webkitAudioContext;
if (_OrigAudioContext) {
  const PatchedAudioContext = function (...args) {
    const ctx = new _OrigAudioContext(...args);
    window._cplayAudioContexts.push(ctx);
    return ctx;
  };
  PatchedAudioContext.prototype = _OrigAudioContext.prototype;
  window.AudioContext = PatchedAudioContext;
  if (window.webkitAudioContext) window.webkitAudioContext = PatchedAudioContext;
}

// ── State ─────────────────────────────────────────────────────────
let ci            = null;
let objectUrl     = null;
let isRunning     = false;
let startingLock  = false;   // prevents overlapping startDos calls
let currentBundle = "";      // tracks what bundle is loaded (for save metadata)

// ── Helpers ───────────────────────────────────────────────────────
function setStatus(message, type = "ok") {
  statusText.textContent = message;
  statusText.className = type; // "ok" | "error" | "" (neutral)
}

function showEmptyState(visible) {
  emptyState.style.display = visible ? "" : "none";
}

function showLoading(message) {
  hideLoading();
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.id = "loadingOverlay";
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  const p = document.createElement("p");
  p.textContent = message;
  overlay.appendChild(spinner);
  overlay.appendChild(p);
  playerShell.appendChild(overlay);
}

function hideLoading() {
  document.getElementById("loadingOverlay")?.remove();
}

function setRunning(running) {
  isRunning = running;
  stopBtn.hidden = !running;
  saveBtn.hidden = !running;
  showEmptyState(!running && !ci);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ── Settings ──────────────────────────────────────────────────────
function readSettings() {
  try {
    const stored = localStorage.getItem("cplay.settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    localStorage.removeItem("cplay.settings");
  }
  return { ...defaultSettings };
}

function persistSettings() {
  const value = {
    cycles:    clamp(Number(settingsFields.cycles.value) || defaultSettings.cycles, 500, 50000),
    memsize:   clamp(Number(settingsFields.memsize.value) || defaultSettings.memsize, 8, 64),
    sound:     settingsFields.sound.value === "off" ? "off" : "on",
    themeTint: ["amber", "green", "ice"].includes(settingsFields.themeTint.value)
      ? settingsFields.themeTint.value
      : "amber",
  };
  localStorage.setItem("cplay.settings", JSON.stringify(value));
  document.body.dataset.tint = value.themeTint;
}

function hydrateSettingsUI() {
  const s = readSettings();
  settingsFields.cycles.value    = s.cycles;
  settingsFields.memsize.value   = s.memsize;
  settingsFields.sound.value     = s.sound;
  settingsFields.themeTint.value = s.themeTint;
  document.body.dataset.tint     = s.themeTint;
}

// ── Emulator lifecycle ────────────────────────────────────────────

// Close every AudioContext the emulator may have created inside playerHost
function closeOrphanedAudioContexts() {
  // js-dos stores its AudioContext on the emulator's global or on window;
  // closing *all* contexts that are still "running" is the safest approach.
  try {
    // Some js-dos versions expose the context on the ci object
    if (ci?.audioContext && ci.audioContext.state !== "closed") {
      ci.audioContext.close().catch(() => {});
    }
  } catch { /* ignore */ }

  // Brute-force: suspend/close every AudioContext we can reach.
  // Browsers keep a list internally; we can't enumerate them, but we can
  // look for the one js-dos attached to the player DOM tree or to window.
  try {
    const canvases = playerHost.querySelectorAll("canvas");
    for (const c of canvases) {
      const ctx = c._audioCtx || c.audioCtx;
      if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    }
  } catch { /* ignore */ }

  // js-dos 8.x attaches the audio context to window.dosInstance or similar
  try {
    if (window.audioContext && window.audioContext.state !== "closed") {
      window.audioContext.close().catch(() => {});
      window.audioContext = undefined;
    }
  } catch { /* ignore */ }
}

async function stopCurrent() {
  hideLoading();

  // 1. Tear down emulator (this should stop audio, but often doesn't fully)
  if (ci?.exit) {
    try { await ci.exit(); } catch { /* swallow */ }
  }

  // 2. Force-close any lingering AudioContexts so music stops immediately
  closeOrphanedAudioContexts();
  ci = null;

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  // 3. Fully clear the player DOM (removes canvas, iframes, Web Audio nodes)
  playerHost.innerHTML = "";

  // 4. Suspend any remaining AudioContexts that the DOM removal didn't catch.
  //    Walking all contexts via the BaseAudioContext isn't possible in every
  //    browser, so we iterate through the (potentially patched) constructor.
  try {
    const allContexts = window._cplayAudioContexts || [];
    for (const actx of allContexts) {
      if (actx.state !== "closed") actx.close().catch(() => {});
    }
    window._cplayAudioContexts = [];
  } catch { /* ignore */ }

  setRunning(false);
}

function buildDosboxConf() {
  const s  = readSettings();
  const sb = s.sound === "on" ? "true" : "false";
  return `
[sdl]
fullscreen=false
fulldouble=true

[dosbox]
memsize=${s.memsize}

[cpu]
core=auto
cycles=${s.cycles}

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5
mixer=${sb}
oplmode=auto

[mixer]
nosound=${s.sound === "on" ? "false" : "true"}
rate=44100
blocksize=2048
prebuffer=40
`;
}

async function startDos(bundleUrl) {
  if (startingLock) return;
  startingLock = true;

  try {
    await stopCurrent();

    // Brief pause so the browser can finish tearing down audio/video
    // resources from the previous emulator before we spin up a new one.
    await new Promise(r => setTimeout(r, 100));

    showEmptyState(false);
    showLoading("Starting emulator\u2026");
    setStatus("Starting emulator\u2026", "");

    const conf = buildDosboxConf();

    try {
      ci = await window.Dos(playerHost, {
        url: bundleUrl,
        autoStart: true,
        kiosk: true,
        dosboxConf: conf,
      });
    } catch {
      try {
        ci = await window.Dos(playerHost, { kiosk: true, dosboxConf: conf });
        if (ci?.run) await ci.run(bundleUrl);
      } catch (inner) {
        hideLoading();
        setStatus(`Emulator failed: ${inner.message || "unknown error"}`, "error");
        setRunning(false);
        return;
      }
    }

    currentBundle = bundleUrl;
    hideLoading();
    setStatus("Running \u2014 Ctrl+F10 to release mouse", "ok");
    setRunning(true);
  } finally {
    startingLock = false;
  }
}

// ── File loading ──────────────────────────────────────────────────
async function loadUserBundle(file) {
  if (!file) return;

  const name = file.name.toLowerCase();
  if (!name.endsWith(".jsdos") && !name.endsWith(".zip")) {
    setStatus("Only .jsdos or .zip bundles are supported.", "error");
    return;
  }

  // Create the blob URL, but stash the old one for cleanup.
  // stopCurrent (called inside startDos) revokes `objectUrl`, so we must
  // ensure the *previous* URL is still in `objectUrl` when stop runs,
  // and only assign the *new* URL afterwards.
  const newUrl = URL.createObjectURL(file);

  showLoading(`Loading ${file.name}\u2026`);
  setStatus(`Loading ${file.name}\u2026`, "");

  // stopCurrent inside startDos will revoke the old objectUrl (if any).
  await startDos(newUrl);

  // Now that the old URL has been revoked by stopCurrent, track the new one.
  objectUrl = newUrl;
}

// ── URL normalization ─────────────────────────────────────────────
function normalizeGithubUrl(urlValue) {
  try {
    const url   = new URL(urlValue);
    const parts = url.pathname.split("/").filter(Boolean);

    if (url.hostname !== "github.com" || parts.length < 2) return urlValue;

    const [owner, repo, mode, branch, ...rest] = parts;

    if ((mode === "blob" || mode === "raw") && branch && rest.length > 0) {
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`;
    }

    return urlValue;
  } catch {
    return urlValue;
  }
}

function transformCloudDriveUrl(urlValue) {
  try {
    const url = new URL(urlValue);

    if (url.hostname === "drive.google.com") {
      const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
      if (fileId) {
        return {
          finalUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
          note: "Converted Google Drive link to direct download.",
        };
      }
    }

    if (url.hostname.endsWith("dropbox.com")) {
      url.searchParams.set("dl", "1");
      return { finalUrl: url.toString(), note: "Converted Dropbox link to direct download." };
    }

    if (url.hostname === "1drv.ms" || url.hostname.includes("onedrive")) {
      url.searchParams.set("download", "1");
      return { finalUrl: url.toString(), note: "Converted OneDrive link to direct download." };
    }
  } catch { /* fall through */ }

  return { finalUrl: urlValue, note: "" };
}

async function resolveGithubRepoArchive(urlValue) {
  try {
    const url   = new URL(urlValue);
    const parts = url.pathname.split("/").filter(Boolean);

    if (url.hostname !== "github.com" || parts.length !== 2) {
      return normalizeGithubUrl(urlValue);
    }

    const [owner, repo] = parts;
    const api = `https://api.github.com/repos/${owner}/${repo}`;

    try {
      const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error("API error");
      const data   = await res.json();
      const branch = data.default_branch || "main";
      return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;
    } catch {
      return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/main`;
    }
  } catch {
    return urlValue;
  }
}

async function loadBundleFromUrl(rawUrl) {
  const typedUrl = (rawUrl || "").trim();

  if (!typedUrl) {
    setStatus("Paste a URL first.", "error");
    return;
  }

  if (!/^https?:\/\//i.test(typedUrl)) {
    setStatus("URL must start with http:// or https://", "error");
    return;
  }

  let finalUrl      = typedUrl;
  let transformNote  = "";

  try {
    if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(typedUrl)) {
      finalUrl      = await resolveGithubRepoArchive(typedUrl);
      transformNote = "Resolved GitHub repo to archive.";
    } else {
      finalUrl = normalizeGithubUrl(typedUrl);
    }

    const cloud   = transformCloudDriveUrl(finalUrl);
    finalUrl      = cloud.finalUrl;
    transformNote = transformNote || cloud.note;

    showLoading("Fetching bundle\u2026");
    setStatus("Loading bundle from URL\u2026", "");
    await startDos(finalUrl);

    if (transformNote) setStatus(`Running \u2014 ${transformNote}`, "ok");
  } catch (err) {
    hideLoading();
    setStatus(`Could not load URL: ${err.message}. Try downloading the file and uploading it here.`, "error");
  }
}

// ── Save / Load system (IndexedDB) ───────────────────────────────
const DB_NAME    = "cplay-saves";
const DB_VERSION = 1;
const STORE_NAME = "saves";

function openSavesDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbTransaction(mode, fn) {
  return openSavesDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      fn(store, resolve, reject);
      tx.onerror = () => reject(tx.error);
    });
  });
}

function getAllSaves() {
  return dbTransaction("readonly", (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const saves = req.result || [];
      saves.sort((a, b) => b.timestamp - a.timestamp);
      resolve(saves);
    };
  });
}

function putSave(save) {
  return dbTransaction("readwrite", (store, resolve) => {
    const req = store.put(save);
    req.onsuccess = () => resolve();
  });
}

function deleteSave(id) {
  return dbTransaction("readwrite", (store, resolve) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
  });
}

// Capture a tiny screenshot from the dos-player canvas (if available)
function captureScreenshot() {
  try {
    const canvas = playerHost.querySelector("canvas");
    if (!canvas) return null;
    // Scale down to thumbnail
    const thumb = document.createElement("canvas");
    const scale = 120 / Math.max(canvas.width, 1);
    thumb.width  = Math.round(canvas.width * scale);
    thumb.height = Math.round(canvas.height * scale);
    const ctx = thumb.getContext("2d");
    ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    return thumb.toDataURL("image/png", 0.7);
  } catch {
    return null;
  }
}

async function saveGameState() {
  if (!ci || !isRunning) {
    setStatus("No game running to save.", "error");
    return;
  }

  // Try js-dos persist API
  let stateData = null;
  if (typeof ci.persist === "function") {
    try {
      stateData = await ci.persist();
    } catch {
      // persist not supported for this bundle
    }
  }

  if (!stateData) {
    setStatus("Save not available \u2014 this bundle may not support state saves.", "error");
    return;
  }

  const screenshot = captureScreenshot();
  const id = `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Derive a friendly name from the bundle URL
  let gameName = "Unknown game";
  try {
    const segments = currentBundle.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    gameName = decodeURIComponent(last)
      .replace(/\.(jsdos|zip)$/i, "")
      .replace(/[_-]/g, " ")
      .slice(0, 40) || "Unknown game";
  } catch { /* keep default */ }

  const save = {
    id,
    name: gameName,
    timestamp: Date.now(),
    bundleUrl: currentBundle,
    screenshot,
    state: Array.from(stateData instanceof Uint8Array ? stateData : new Uint8Array(stateData)),
  };

  try {
    await putSave(save);
    setStatus(`Saved "${gameName}"`, "ok");
    await renderSavesList();
  } catch (err) {
    setStatus(`Save failed: ${err.message}`, "error");
  }
}

async function loadGameState(id) {
  let saves;
  try {
    saves = await getAllSaves();
  } catch {
    setStatus("Could not read saves.", "error");
    return;
  }

  const save = saves.find(s => s.id === id);
  if (!save) {
    setStatus("Save not found.", "error");
    return;
  }

  showLoading("Restoring save\u2026");
  setStatus("Restoring save\u2026", "");

  try {
    // Reconstruct the state as a Uint8Array and create a blob URL
    const stateBytes = new Uint8Array(save.state);
    const blob = new Blob([stateBytes], { type: "application/octet-stream" });
    const blobUrl = URL.createObjectURL(blob);

    await startDos(blobUrl);
    objectUrl = blobUrl; // track for cleanup
    currentBundle = save.bundleUrl;
    setStatus(`Restored "${save.name}"`, "ok");
  } catch (err) {
    hideLoading();
    setStatus(`Restore failed: ${err.message}`, "error");
  }
}

async function deleteGameSave(id) {
  try {
    await deleteSave(id);
    await renderSavesList();
    setStatus("Save deleted.", "");
  } catch {
    setStatus("Could not delete save.", "error");
  }
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function renderSavesList() {
  if (!savesList) return;

  let saves;
  try {
    saves = await getAllSaves();
  } catch {
    savesList.innerHTML = '<p class="small-note">Could not load saves.</p>';
    return;
  }

  if (saves.length === 0) {
    savesList.innerHTML = '<p class="small-note">No saves yet. Run a game and hit Save.</p>';
    return;
  }

  // Build DOM without innerHTML for safety
  savesList.innerHTML = "";

  for (const save of saves) {
    const card = document.createElement("div");
    card.className = "save-card";

    if (save.screenshot) {
      const img = document.createElement("img");
      img.className = "save-thumb";
      img.src = save.screenshot;
      img.alt = save.name;
      card.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "save-info";

    const nameEl = document.createElement("span");
    nameEl.className = "save-name";
    nameEl.textContent = save.name;
    info.appendChild(nameEl);

    const dateEl = document.createElement("span");
    dateEl.className = "save-date";
    dateEl.textContent = formatTimestamp(save.timestamp);
    info.appendChild(dateEl);

    card.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "save-actions";

    const loadBtn = document.createElement("button");
    loadBtn.className = "action-btn save-load-btn";
    loadBtn.type = "button";
    loadBtn.textContent = "Load";
    loadBtn.addEventListener("click", () => loadGameState(save.id));
    actions.appendChild(loadBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "ghost-btn save-del-btn";
    delBtn.type = "button";
    delBtn.textContent = "Del";
    delBtn.addEventListener("click", () => {
      if (confirm(`Delete save "${save.name}"?`)) {
        deleteGameSave(save.id);
      }
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    savesList.appendChild(card);
  }
}

// ── Event listeners ───────────────────────────────────────────────

// Dropzone
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragging");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragging");
});

dropzone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragging");
  const [file] = e.dataTransfer.files;
  await loadUserBundle(file);
});

bundleInput.addEventListener("change", async (e) => {
  const [file] = e.target.files;
  await loadUserBundle(file);
  e.target.value = "";
});

// URL loader
loadUrlBtn.addEventListener("click", () => loadBundleFromUrl(bundleUrlInput.value));

bundleUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    loadBundleFromUrl(bundleUrlInput.value);
  }
});

// Demo buttons
document.querySelectorAll("[data-demo]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const url = demoBundles[btn.dataset.demo];
    if (!url) { setStatus("Demo not configured.", "error"); return; }
    setStatus(`Loading ${btn.textContent}\u2026`, "");
    await startDos(url);
  });
});

// Settings persistence
Object.values(settingsFields).forEach((f) => f.addEventListener("change", persistSettings));

// Stop button
stopBtn.addEventListener("click", async () => {
  await stopCurrent();
  setStatus("Stopped.", "");
});

// Save button
saveBtn.addEventListener("click", () => saveGameState());

// Fullscreen
fullscreenBtn.addEventListener("click", async () => {
  if (!document.fullscreenElement && playerShell.requestFullscreen) {
    await playerShell.requestFullscreen().catch(() => {});
    fullscreenBtn.textContent = "Exit Fullscreen";
  } else if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
    fullscreenBtn.textContent = "Fullscreen";
  }
});

document.addEventListener("fullscreenchange", () => {
  fullscreenBtn.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
});

// Warn before losing game state
window.addEventListener("beforeunload", (e) => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  if (isRunning) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ── Init ──────────────────────────────────────────────────────────
hydrateSettingsUI();
showEmptyState(true);
setStatus("Ready \u2014 load a bundle or try a demo", "");
renderSavesList();
