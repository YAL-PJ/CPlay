/* ── C:\PLAY  —  app.js ─────────────────────────────────────────── */

/**
 * PRODUCTION GRADE CONSOLIDATED VERSION
 * 
 * COMBINES:
 * - Robust IndexedDB Save System (Local)
 * - Full Game Library (Local)
 * - Improved js-dos v8 Bootstrap (Remote)
 * - Modular State Management (Remote)
 * - Enhanced URL Normalization & Cloud Support
 * 
 * FIXES:
 * - ExitStatus errors (clean termination)
 * - Failed start state handling
 * - AudioContext orphaned contexts
 * - Pinball 404 URL
 */

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
  gameSearchInput: document.getElementById("gameSearch"),
};

const settingsFields = {
  cycles: document.getElementById("cycles"),
  memsize: document.getElementById("memsize"),
  sound: document.getElementById("sound"),
  themeTint: document.getElementById("themeTint"),
};

// ── Constants ─────────────────────────────────────────────────────
const GAMES = [
  { id: "doom", name: "DOOM", url: "https://v8.js-dos.com/bundles/doom.jsdos", icon: "https://cdn.dos.zone/original/2X/0/073c681816f1d01f80e07173e13028290f653456.png" },
  { id: "digger", name: "Digger", url: "https://v8.js-dos.com/bundles/digger.jsdos", icon: "https://cdn.dos.zone/original/2X/e/e0622956cf22d417774844336c53e8310e756a24.png" },
  { id: "lemmings", name: "Lemmings", url: "https://v8.js-dos.com/bundles/lemmings.jsdos", icon: "https://cdn.dos.zone/original/2X/3/3d010e810e8b648fc5f777b3bd9cbc0187927fd4.png" },
  { id: "civilization", name: "Sid Meier's Civilization", url: "https://v8.js-dos.com/bundles/civilization.jsdos", icon: "https://cdn.dos.zone/original/2X/c/c1010e810e8b648fc5f777b3bd9cbc0187927fd4.png" },
  { id: "oregon", name: "The Oregon Trail", url: "https://v8.js-dos.com/bundles/oregon.jsdos", icon: "https://cdn.dos.zone/original/2X/o/o1010e810e8b648fc5f777b3bd9cbc0187927fd4.png" },
];

const defaultSettings = {
  cycles: 12000,
  memsize: 16,
  sound: "on",
  themeTint: "amber",
};

// ── Variables & State ─────────────────────────────────────────────
const state = {
  ci: null,
  isRunning: false,
  startingLock: false,
  objectUrl: null,
  currentBundle: "",
};

// ── Helpers ───────────────────────────────────────────────────────
function log(...a) {
  console.log("[CPLAY]", ...a);
}

function logError(...a) {
  console.error("[CPLAY ERROR]", ...a);
}

function setStatus(message, type = "ok") {
  if (!dom.statusText) return;
  dom.statusText.textContent = `C:\\PLAY> ${message}${message.endsWith("_") ? "" : "_"}`;
  dom.statusText.className = type; // "ok" | "error" | "" (neutral)
}

function handleExitStatus(err) {
  const isExit = err && (err.name === 'ExitStatus' || (err.message && err.message.includes('ExitStatus')));
  if (isExit) {
    if (err.status === 0 || !err.status) {
      log("Process terminated successfully (ExitStatus: 0).");
      return true;
    }
  }
  return false;
}

function showEmptyState(visible) {
  if (!dom.emptyState) return;
  dom.emptyState.style.display = visible ? "" : "none";
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
  dom.playerShell.appendChild(overlay);
}

function hideLoading() {
  document.getElementById("loadingOverlay")?.remove();
}

function updateUI() {
  if (dom.stopBtn) dom.stopBtn.hidden = !state.isRunning;
  if (dom.saveBtn) dom.saveBtn.hidden = !state.isRunning;
  showEmptyState(!state.isRunning && !state.ci);
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
    cycles: clamp(Number(settingsFields.cycles.value) || defaultSettings.cycles, 500, 50000),
    memsize: clamp(Number(settingsFields.memsize.value) || defaultSettings.memsize, 8, 64),
    sound: settingsFields.sound.value === "off" ? "off" : "on",
    themeTint: ["amber", "green", "ice"].includes(settingsFields.themeTint.value)
      ? settingsFields.themeTint.value
      : "amber",
  };
  localStorage.setItem("cplay.settings", JSON.stringify(value));
  document.documentElement.setAttribute("data-tint", value.themeTint);
  document.body.dataset.tint = value.themeTint;
}

function hydrateSettingsUI() {
  const s = readSettings();
  if (settingsFields.cycles) settingsFields.cycles.value = s.cycles;
  if (settingsFields.memsize) settingsFields.memsize.value = s.memsize;
  if (settingsFields.sound) settingsFields.sound.value = s.sound;
  if (settingsFields.themeTint) settingsFields.themeTint.value = s.themeTint;
  document.documentElement.setAttribute("data-tint", s.themeTint);
  document.body.dataset.tint = s.themeTint;
}

// ── Emulator lifecycle ────────────────────────────────────────────

// Close every AudioContext the emulator may have created inside playerHost
function closeOrphanedAudioContexts() {
  try {
    if (window.audioContext && window.audioContext.state !== "closed") {
      window.audioContext.close().catch(() => { });
    }
  } catch (e) { }

  try {
    const canvases = dom.playerHost.querySelectorAll("canvas");
    for (const c of canvases) {
      if (c.audioCtx && c.audioCtx.state !== "closed") {
        c.audioCtx.close().catch(() => { });
      }
    }
  } catch (e) { }
}

async function stopCurrent() {
  hideLoading();

  if (state.ci) {
    try {
      log("Stopping emulator...");
      if (typeof state.ci.exit === "function") {
        await state.ci.exit();
      } else if (typeof state.ci.stop === "function") {
        await state.ci.stop();
      }
    } catch (e) {
      // Gracefully handle ExitStatus and regular stops
      if (e.name === 'ExitStatus') {
        log("System exited cleanly.");
      } else {
        logError("Stop error:", e);
      }
    }
  }

  // Clear state
  state.ci = null;
  state.isRunning = false;

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  // Wait for resources to free
  await new Promise(r => setTimeout(r, 100));

  // Clean DOM and lingering audio
  closeOrphanedAudioContexts();
  if (dom.playerHost) dom.playerHost.innerHTML = "";

  updateUI();
}

function buildDosboxConf() {
  const s = readSettings();
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

[mixer]
nosound=${s.sound === "on" ? "false" : "true"}
rate=44100
blocksize=2048
prebuffer=40
`;
}

async function startDos(bundleUrl) {
  if (state.startingLock) return;
  state.startingLock = true;

  try {
    await stopCurrent();

    showEmptyState(false);
    showLoading("Initializing System...");
    setStatus("Booting...", "");

    log("bundle", bundleUrl);

    try {
      if (window.emulators) {
        window.emulators.pathPrefix = "https://v8.js-dos.com/latest/emulators/";
      }

      const conf = buildDosboxConf();

      // Standard v8 entry point
      const result = window.Dos(dom.playerHost, {
        url: bundleUrl,
        dosboxConf: conf,
        kiosk: true
      });

      const ci = (result instanceof Promise) ? await result : result;

      if (!ci) throw new Error("Dos initialization returned null");

      state.ci = ci;
      state.isRunning = true;
      state.currentBundle = bundleUrl;

      updateUI();

      if (ci.events) {
        ci.events().onTerminate(() => {
          log("System process terminated.");
          stopCurrent().then(() => showEmptyState(true));
        });
      }

    } catch (err) {
      if (handleExitStatus(err)) {
        log("Initial process clean exit.");
        await stopCurrent();
        return true;
      }

      logError("Emulator Boot Failure:", err);
      hideLoading();
      setStatus(`System Error: ${err.message || "Unknown"}`, "error");
      state.isRunning = false;
      updateUI();
      return false;
    }

    hideLoading();
    setStatus("System Ready - Drive A:", "ok");
    return true;
  } finally {
    state.startingLock = false;
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

  const newUrl = URL.createObjectURL(file);
  showLoading(`Loading ${file.name}\u2026`);
  setStatus(`Loading ${file.name}\u2026`, "");

  const success = await startDos(newUrl);
  if (success) {
    state.objectUrl = newUrl;
  } else {
    URL.revokeObjectURL(newUrl);
  }
}

// ── URL normalization & Cloud Support ─────────────────────────────
function normalizeGithubUrl(urlValue) {
  try {
    const url = new URL(urlValue);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "github.com" || parts.length < 2) return urlValue;
    const [owner, repo, mode, branch, ...rest] = parts;
    if ((mode === "blob" || mode === "raw") && branch && rest.length > 0) {
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`;
    }
    return urlValue;
  } catch { return urlValue; }
}

function transformCloudDriveUrl(urlValue) {
  try {
    const url = new URL(urlValue);
    if (url.hostname === "drive.google.com") {
      const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
      if (fileId) return { finalUrl: `https://drive.google.com/uc?export=download&id=${fileId}`, note: "G-Drive converted." };
    }
    if (url.hostname.endsWith("dropbox.com")) {
      url.searchParams.set("dl", "1");
      return { finalUrl: url.toString(), note: "Dropbox converted." };
    }
    if (url.hostname === "1drv.ms" || url.hostname.includes("onedrive")) {
      url.searchParams.set("download", "1");
      return { finalUrl: url.toString(), note: "OneDrive converted." };
    }
  } catch { }
  return { finalUrl: urlValue, note: "" };
}

async function resolveGithubRepoArchive(urlValue) {
  try {
    const url = new URL(urlValue);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname !== "github.com" || parts.length !== 2) return normalizeGithubUrl(urlValue);
    const [owner, repo] = parts;
    const api = `https://api.github.com/repos/${owner}/${repo}`;
    try {
      const res = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
      const data = await res.json();
      const branch = data.default_branch || "main";
      return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;
    } catch { return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/main`; }
  } catch { return urlValue; }
}

async function loadBundleFromUrl(rawUrl) {
  const typedUrl = (rawUrl || "").trim();
  if (!typedUrl) { setStatus("Paste a URL first.", "error"); return; }
  if (!/^https?:\/\//i.test(typedUrl)) { setStatus("Invalid URL protocol.", "error"); return; }

  let finalUrl = typedUrl;
  let note = "";

  try {
    if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(typedUrl)) {
      finalUrl = await resolveGithubRepoArchive(typedUrl);
      note = "GitHub archive.";
    } else {
      finalUrl = normalizeGithubUrl(typedUrl);
    }

    const cloud = transformCloudDriveUrl(finalUrl);
    finalUrl = cloud.finalUrl;
    note = note || cloud.note;

    showLoading("Fetching...");
    setStatus("Loading from URL\u2026", "");
    await startDos(finalUrl);
    if (note) setStatus(`Running (${note})`, "ok");
  } catch (err) {
    hideLoading();
    setStatus(`Load failed: ${err.message}`, "error");
  }
}

// ── Save / Load system (IndexedDB) ───────────────────────────────
const DB_NAME = "cplay-saves";
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
    req.onerror = () => reject(req.error);
  });
}

function dbTransaction(mode, fn) {
  return openSavesDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
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

function captureScreenshot() {
  try {
    const canvas = dom.playerHost.querySelector("canvas");
    if (!canvas) return null;
    const thumb = document.createElement("canvas");
    const scale = 120 / Math.max(canvas.width, 1);
    thumb.width = Math.round(canvas.width * scale);
    thumb.height = Math.round(canvas.height * scale);
    const ctx = thumb.getContext("2d");
    ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    return thumb.toDataURL("image/png", 0.7);
  } catch { return null; }
}

async function saveGameState() {
  if (!state.ci || !state.isRunning) {
    setStatus("Nothing running.", "error");
    return;
  }

  let stateData = null;
  if (typeof state.ci.persist === "function") {
    try { stateData = await state.ci.persist(); } catch { }
  }

  if (!stateData) {
    setStatus("Save not supported.", "error");
    return;
  }

  const screenshot = captureScreenshot();
  const id = `save-${Date.now()}`;

  // Clean name from URL
  let name = "Unknown";
  try {
    const url = new URL(state.currentBundle);
    const file = url.pathname.split("/").pop() || "";
    name = decodeURIComponent(file).replace(/\.(jsdos|zip)$/i, "") || "Custom Game";
  } catch { }

  const save = {
    id,
    name,
    timestamp: Date.now(),
    bundleUrl: state.currentBundle,
    screenshot,
    state: Array.from(stateData instanceof Uint8Array ? stateData : new Uint8Array(stateData)),
  };

  try {
    await putSave(save);
    setStatus(`Saved "${name}"`, "ok");
    await renderSavesList();
  } catch (err) { setStatus("Save failed.", "error"); }
}

async function loadGameState(id) {
  try {
    const saves = await getAllSaves();
    const save = saves.find(s => s.id === id);
    if (!save) return;

    showLoading("Restoring...");
    const stateBytes = new Uint8Array(save.state);
    const blob = new Blob([stateBytes], { type: "application/octet-stream" });
    const blobUrl = URL.createObjectURL(blob);

    const success = await startDos(blobUrl);
    if (success) {
      state.objectUrl = blobUrl;
      state.currentBundle = save.bundleUrl;
      setStatus(`Restored "${save.name}"`, "ok");
    } else {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (err) { setStatus("Restore failed.", "error"); }
}

async function renderSavesList() {
  if (!dom.savesList) return;
  try {
    const saves = await getAllSaves();
    if (saves.length === 0) {
      dom.savesList.innerHTML = '<p class="small-note">No saves yet.</p>';
      return;
    }
    dom.savesList.innerHTML = "";
    saves.forEach(save => {
      const el = document.createElement("div");
      el.className = "save-card";
      el.innerHTML = `
        ${save.screenshot ? `<img src="${save.screenshot}" class="save-thumb" />` : ""}
        <div class="save-info">
          <span class="save-name">${save.name}</span>
          <span class="save-date">${new Date(save.timestamp).toLocaleString()}</span>
        </div>
        <div class="save-actions">
          <button class="action-btn" onclick="app.loadSave('${save.id}')">Load</button>
          <button class="ghost-btn" onclick="app.deleteSave('${save.id}')">Del</button>
        </div>
      `;
      dom.savesList.appendChild(el);
    });
  } catch { }
}

// ── Event listeners ───────────────────────────────────────────────

function setupEventListeners() {
  // Dropzone
  dom.dropzone.addEventListener("dragover", e => { e.preventDefault(); dom.dropzone.classList.add("dragging"); });
  dom.dropzone.addEventListener("dragleave", () => dom.dropzone.classList.remove("dragging"));
  dom.dropzone.addEventListener("drop", async e => {
    e.preventDefault();
    dom.dropzone.classList.remove("dragging");
    loadUserBundle(e.dataTransfer.files[0]);
  });

  dom.bundleInput.addEventListener("change", e => {
    loadUserBundle(e.target.files[0]);
    e.target.value = "";
  });

  // URL loader
  dom.loadUrlBtn.addEventListener("click", () => loadBundleFromUrl(dom.bundleUrlInput.value));
  dom.bundleUrlInput.addEventListener("keydown", e => { if (e.key === "Enter") loadBundleFromUrl(dom.bundleUrlInput.value); });

  // Search
  dom.gameSearchInput?.addEventListener("input", e => renderGameGrid(e.target.value));

  // Controls
  dom.stopBtn.addEventListener("click", () => stopCurrent().then(() => setStatus("Stopped")));
  dom.saveBtn.addEventListener("click", () => saveGameState());
  dom.fullscreenBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) dom.playerShell.requestFullscreen();
    else document.exitFullscreen();
  });

  // Settings
  Object.values(settingsFields).forEach(f => {
    if (f) f.addEventListener("change", persistSettings);
  });
}

function renderGameGrid(filter = "") {
  if (!dom.gameGrid) return;
  dom.gameGrid.innerHTML = "";
  const query = filter.toLowerCase().trim();
  const filtered = GAMES.filter(g => g.name.toLowerCase().includes(query));

  filtered.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="game-icon-container">
        <img src="${game.icon}" class="game-thumb" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><rect width=\\'100\\' height=\\'100\\' fill=\\'%23111\\'/><text y=\\'50%\\' x=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-size=\\'50\\' fill=\\'%23333\\'>?</text></svg>'">
      </div>
      <span class="game-label">${game.name}</span>
    `;
    card.onclick = () => {
      setStatus(`Loading ${game.name}...`, "");
      startDos(game.url);
    };
    dom.gameGrid.appendChild(card);
  });
}

// ── Global Exports (for inline onclicks) ──────────────────────────
window.app = {
  loadSave: (id) => loadGameState(id),
  deleteSave: (id) => {
    if (confirm("Delete this save?")) {
      deleteSave(id).then(renderSavesList);
    }
  }
};

// ── Global Error Suppression ─────────────────────────────────────
window.addEventListener('unhandledrejection', (event) => {
  if (handleExitStatus(event.reason)) {
    log("Suppressed unhandled ExitStatus(0) rejection.");
    event.preventDefault();
  }
});

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  hydrateSettingsUI();
  setupEventListeners();
  renderGameGrid();
  renderSavesList();
  setStatus("Ready — drive A: loaded", "ok");
  updateUI();
});
