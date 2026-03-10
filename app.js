/* ── C:\PLAY  —  app.js ─────────────────────────────────────────── */

// ── DOM refs ──────────────────────────────────────────────────────
const statusText    = document.getElementById("statusText");
const dropzone      = document.getElementById("dropzone");
const bundleInput   = document.getElementById("bundleInput");
const bundleUrlInput = document.getElementById("bundleUrl");
const loadUrlBtn    = document.getElementById("loadUrlBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const stopBtn       = document.getElementById("stopBtn");
const playerShell   = document.getElementById("playerShell");
const playerHost    = document.getElementById("dos-player");
const emptyState    = document.getElementById("emptyState");

const settingsFields = {
  cycles:    document.getElementById("cycles"),
  memsize:   document.getElementById("memsize"),
  sound:     document.getElementById("sound"),
  themeTint: document.getElementById("themeTint"),
};

// ── Constants ─────────────────────────────────────────────────────
const demoBundles = {
  doom:    "https://v8.js-dos.com/bundles/doom.jsdos",
  keen:    "https://v8.js-dos.com/bundles/keen.jsdos",
  pinball: "https://v8.js-dos.com/bundles/epic-pinball.jsdos",
};

const defaultSettings = {
  cycles:    12000,
  memsize:   16,
  sound:     "on",
  themeTint: "amber",
};

// ── State ─────────────────────────────────────────────────────────
let ci        = null;
let objectUrl  = null;
let isRunning  = false;

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
  overlay.innerHTML = `<div class="spinner"></div><p>${escapeHtml(message)}</p>`;
  playerShell.appendChild(overlay);
}

function hideLoading() {
  document.getElementById("loadingOverlay")?.remove();
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function setRunning(running) {
  isRunning = running;
  stopBtn.hidden = !running;
  showEmptyState(!running && !ci);
}

// ── Settings ──────────────────────────────────────────────────────
function readSettings() {
  const stored = localStorage.getItem("cplay.settings");
  return stored ? { ...defaultSettings, ...JSON.parse(stored) } : { ...defaultSettings };
}

function persistSettings() {
  const value = {
    cycles:    Number(settingsFields.cycles.value) || defaultSettings.cycles,
    memsize:   Number(settingsFields.memsize.value) || defaultSettings.memsize,
    sound:     settingsFields.sound.value,
    themeTint: settingsFields.themeTint.value,
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
async function stopCurrent() {
  hideLoading();
  if (ci?.exit) {
    try { await ci.exit(); } catch { /* swallow */ }
  }
  ci = null;

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  playerHost.innerHTML = "";
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
  await stopCurrent();
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

  hideLoading();
  setStatus("Running \u2014 Ctrl+F10 to release mouse", "ok");
  setRunning(true);
}

// ── File loading ──────────────────────────────────────────────────
async function loadUserBundle(file) {
  if (!file) return;

  const name = file.name.toLowerCase();
  if (!name.endsWith(".jsdos") && !name.endsWith(".zip")) {
    setStatus("Only .jsdos or .zip bundles are supported.", "error");
    return;
  }

  objectUrl = URL.createObjectURL(file);
  showLoading(`Loading ${file.name}\u2026`);
  setStatus(`Loading ${file.name}\u2026`, "");
  await startDos(objectUrl);
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

    // Bare repo URLs are handled by resolveGithubRepoArchive — don't guess the branch here
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
    // GitHub repo → archive
    if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(typedUrl)) {
      finalUrl      = await resolveGithubRepoArchive(typedUrl);
      transformNote = "Resolved GitHub repo to archive.";
    } else {
      finalUrl = normalizeGithubUrl(typedUrl);
    }

    // Cloud drive transforms
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

// Demo buttons — only target buttons that actually have a data-demo attribute
document.querySelectorAll("[data-demo]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const url = demoBundles[btn.dataset.demo];
    if (!url) { setStatus("Demo not configured.", "error"); return; }
    setStatus(`Loading ${btn.textContent}\u2026`, "");
    startDos(url);
  });
});

// Settings persistence
Object.values(settingsFields).forEach((f) => f.addEventListener("change", persistSettings));

// Stop button
stopBtn.addEventListener("click", async () => {
  await stopCurrent();
  setStatus("Stopped.", "");
});

// Fullscreen
fullscreenBtn.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await playerShell.requestFullscreen().catch(() => {});
    fullscreenBtn.textContent = "Exit Fullscreen";
  } else {
    await document.exitFullscreen().catch(() => {});
    fullscreenBtn.textContent = "Fullscreen";
  }
});

document.addEventListener("fullscreenchange", () => {
  fullscreenBtn.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
});

// Cleanup
window.addEventListener("beforeunload", () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});

// ── Init ──────────────────────────────────────────────────────────
hydrateSettingsUI();
showEmptyState(true);
setStatus("Ready \u2014 load a bundle or try a demo", "");
