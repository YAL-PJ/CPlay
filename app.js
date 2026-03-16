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
  playerDropzone: document.getElementById("playerDropzone"),
  soundToggleBtn: document.getElementById("soundToggleBtn"),
  soundToggleFS: document.getElementById("soundToggleFS"),
};

const settingsFields = {
  cycles: document.getElementById("cycles"),
  memsize: document.getElementById("memsize"),
  sound: document.getElementById("sound"),
  themeTint: document.getElementById("themeTint"),
};

const defaultSettings = { cycles: 12000, memsize: 16, sound: "on", themeTint: "amber" };
const state = { ci: null, isRunning: false, startingLock: false, objectUrl: null, currentBundle: "" };

const log = (...a) => console.log("[CPLAY]", ...a);
const logError = (...a) => console.error("[CPLAY ERROR]", ...a);

// ── Analytics helpers ────────────────────────────────────────────
function trackEvent(eventName, params = {}) {
  try { if (typeof gtag === "function") gtag("event", eventName, params); } catch { }
}

// Track Core Web Vitals for SEO performance insights
function trackWebVitals() {
  if (!("PerformanceObserver" in window)) return;
  // Largest Contentful Paint
  try {
    new PerformanceObserver(list => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      trackEvent("web_vital_lcp", { value: Math.round(last.startTime), metric_id: "LCP" });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch { }
  // First Input Delay
  try {
    new PerformanceObserver(list => {
      list.getEntries().forEach(entry => {
        trackEvent("web_vital_fid", { value: Math.round(entry.processingStart - entry.startTime), metric_id: "FID" });
      });
    }).observe({ type: "first-input", buffered: true });
  } catch { }
  // Cumulative Layout Shift
  try {
    let clsValue = 0;
    new PerformanceObserver(list => {
      list.getEntries().forEach(entry => { if (!entry.hadRecentInput) clsValue += entry.value; });
      trackEvent("web_vital_cls", { value: Math.round(clsValue * 1000), metric_id: "CLS" });
    }).observe({ type: "layout-shift", buffered: true });
  } catch { }
}

// Track scroll depth
function trackScrollDepth() {
  const milestones = new Set();
  window.addEventListener("scroll", () => {
    const scrollPct = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
    [25, 50, 75, 100].forEach(m => {
      if (scrollPct >= m && !milestones.has(m)) {
        milestones.add(m);
        trackEvent("scroll_depth", { percent: m });
      }
    });
  }, { passive: true });
}

// Track user engagement time
function trackEngagement() {
  let engagedSeconds = 0;
  let isActive = true;
  document.addEventListener("visibilitychange", () => { isActive = document.visibilityState === "visible"; });
  setInterval(() => { if (isActive) engagedSeconds++; }, 1000);
  window.addEventListener("beforeunload", () => {
    trackEvent("engagement_time", { seconds: engagedSeconds, game_was_played: state.isRunning || state.currentBundle !== "" });
  });
}

// Track outbound link clicks
function trackOutboundLinks() {
  document.addEventListener("click", e => {
    const link = e.target.closest("a[href]");
    if (!link) return;
    try {
      const url = new URL(link.href);
      if (url.hostname !== window.location.hostname) {
        trackEvent("outbound_click", { url: link.href });
      }
    } catch { }
  });
}

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

const trackedAudioContexts = new Set();
const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
if (OriginalAudioContext) {
  const Patched = function (...args) {
    const ctx = new OriginalAudioContext(...args);
    trackedAudioContexts.add(ctx);
    if (readSettings().sound === "off") ctx.suspend().catch(() => { });
    return ctx;
  };
  Patched.prototype = OriginalAudioContext.prototype;
  if (window.AudioContext) window.AudioContext = Patched;
  if (window.webkitAudioContext) window.webkitAudioContext = Patched;
}

function closeOrphanedAudioContexts() {
  trackedAudioContexts.forEach(ctx => { try { if (ctx.state !== "closed") ctx.close().catch(() => { }); } catch { } });
  trackedAudioContexts.clear();
  try { if (window.audioContext && window.audioContext.state !== "closed") window.audioContext.close().catch(() => { }); } catch { }
  try { dom.playerHost.querySelectorAll("canvas").forEach(c => c.audioCtx?.state !== "closed" && c.audioCtx.close().catch(() => { })); } catch { }
}

function syncSoundIndicator() {
  const muted = readSettings().sound === "off";
  [dom.soundToggleBtn, dom.soundToggleFS].forEach(btn => {
    if (btn) btn.classList.toggle("muted", muted);
  });
}

function toggleSound() {
  const s = readSettings();
  const newVal = s.sound === "off" ? "on" : "off";
  trackEvent("sound_toggle", { sound_state: newVal });
  if (settingsFields.sound) settingsFields.sound.value = newVal;
  persistSettings();
  applySoundSetting();
  syncSoundIndicator();
}

function applySoundSetting() {
  const muted = readSettings().sound === "off";
  trackedAudioContexts.forEach(ctx => {
    try {
      if (ctx.state === "closed") return;
      if (muted && ctx.state === "running") ctx.suspend().catch(() => { });
      if (!muted && ctx.state === "suspended") ctx.resume().catch(() => { });
    } catch { }
  });
  try {
    if (window.audioContext && window.audioContext.state !== "closed") {
      if (muted && window.audioContext.state === "running") window.audioContext.suspend().catch(() => { });
      if (!muted && window.audioContext.state === "suspended") window.audioContext.resume().catch(() => { });
    }
  } catch { }
  try {
    dom.playerHost.querySelectorAll("canvas").forEach(c => {
      if (c.audioCtx && c.audioCtx.state !== "closed") {
        if (muted && c.audioCtx.state === "running") c.audioCtx.suspend().catch(() => { });
        if (!muted && c.audioCtx.state === "suspended") c.audioCtx.resume().catch(() => { });
      }
    });
  } catch { }
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
  return `\n[sdl]\nfullscreen=false\nfulldouble=true\n\n[dosbox]\nmachine=svga_s3\nmemsize=${s.memsize}\n\n[cpu]\ncore=auto\ncycles=${s.cycles}\n\n[mixer]\nnosound=${s.sound === "on" ? "false" : "true"}\nrate=44100\nblocksize=2048\nprebuffer=40\n`;
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
    hideLoading(); setStatus("System Ready - Drive A:", "ok"); applySoundSetting(); setTimeout(applySoundSetting, 500); setTimeout(applySoundSetting, 1500); setTimeout(applySoundSetting, 3000); setTimeout(applySoundSetting, 5000);
    trackEvent("game_start", { bundle_url: bundleUrl, method: state.objectUrl ? "file_upload" : "url" });
    return { ok: true };
  } catch (err) {
    if (handleExitStatus(err)) { await stopCurrent(); return { ok: true }; }
    hideLoading(); setStatus(`System Error: ${err.message || "Unknown"}`, "error"); state.isRunning = false; updateUI();
    trackEvent("game_error", { error_message: err?.message || "Unknown", bundle_url: bundleUrl });
    return { ok: false, errorMessage: err?.message || "Unknown error" };
  } finally { state.startingLock = false; }
}

async function loadUserBundle(file) {
  if (!file) return;
  const name = file.name.toLowerCase();
  if (!name.endsWith(".jsdos") && !name.endsWith(".zip")) return setStatus("Only .jsdos or .zip bundles are supported.", "error");
  trackEvent("file_upload", { file_name: file.name, file_size: file.size, file_type: name.endsWith(".jsdos") ? "jsdos" : "zip" });
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
  const urlSource = /github\.com/i.test(typedUrl) ? "github" : /drive\.google/i.test(typedUrl) ? "google_drive" : /dropbox/i.test(typedUrl) ? "dropbox" : /onedrive|1drv/i.test(typedUrl) ? "onedrive" : "direct";
  trackEvent("url_load", { url_source: urlSource });
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
  trackEvent("game_save", { game_name: name });
  setStatus(`Saved "${name}"`, "ok"); await renderSavesList();
}

async function loadGameState(id) {
  try {
    const save = (await getAllSaves()).find(s => s.id === id); if (!save) return;
    showLoading("Restoring..."); const result = await startDos(save.bundleUrl); if (!result.ok) return setStatus("Restore failed: could not start game.", "error");
    state.currentBundle = save.bundleUrl;
    if (save.state && state.ci && typeof state.ci.restore === "function") { await state.ci.restore(new Uint8Array(save.state)); setStatus(`Restored "${save.name}"`, "ok"); }
    else { setStatus(`Loaded "${save.name}"`, "ok"); }
    trackEvent("game_load_save", { game_name: save.name });
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
      const delBtn = document.createElement("button"); delBtn.className = "ghost-btn"; delBtn.textContent = "Del"; delBtn.addEventListener("click", () => confirm("Delete this save?") && (trackEvent("game_delete_save", { game_name: save.name }), deleteSave(save.id).then(renderSavesList)));
      actions.append(loadBtn, delBtn); el.appendChild(actions); dom.savesList.appendChild(el);
    });
  } catch { }
}

function setupEventListeners() {
  dom.dropzone?.addEventListener("dragover", e => { e.preventDefault(); dom.dropzone.classList.add("dragging"); });
  dom.dropzone?.addEventListener("dragleave", () => dom.dropzone.classList.remove("dragging"));
  dom.dropzone?.addEventListener("drop", e => { e.preventDefault(); dom.dropzone.classList.remove("dragging"); loadUserBundle(e.dataTransfer.files[0]); });
  dom.bundleInput?.addEventListener("change", e => { loadUserBundle(e.target.files[0]); e.target.value = ""; });
  dom.loadUrlBtn?.addEventListener("click", () => loadBundleFromUrl(dom.bundleUrlInput?.value));
  dom.bundleUrlInput?.addEventListener("keydown", e => { if (e.key === "Enter") loadBundleFromUrl(dom.bundleUrlInput.value); });
  dom.stopBtn?.addEventListener("click", () => { trackEvent("game_stop"); stopCurrent().then(() => setStatus("Stopped")); });
  dom.saveBtn?.addEventListener("click", saveGameState);
  dom.fullscreenBtn?.addEventListener("click", () => { trackEvent("fullscreen_toggle", { entering: !document.fullscreenElement }); !document.fullscreenElement ? dom.playerShell?.requestFullscreen() : document.exitFullscreen(); });
  dom.soundToggleBtn?.addEventListener("click", toggleSound);
  dom.soundToggleFS?.addEventListener("click", toggleSound);

  // Drag-and-drop on the player area (DOS screen)
  const playerDrop = dom.playerShell;
  if (playerDrop) {
    playerDrop.addEventListener("dragover", e => { e.preventDefault(); playerDrop.classList.add("player-dragging"); });
    playerDrop.addEventListener("dragleave", e => { if (!playerDrop.contains(e.relatedTarget)) playerDrop.classList.remove("player-dragging"); });
    playerDrop.addEventListener("drop", e => { e.preventDefault(); playerDrop.classList.remove("player-dragging"); loadUserBundle(e.dataTransfer.files[0]); });
  }
  Object.values(settingsFields).forEach(f => f?.addEventListener("change", () => { persistSettings(); applySoundSetting(); syncSoundIndicator(); trackEvent("settings_change", { cycles: settingsFields.cycles.value, memsize: settingsFields.memsize.value, sound: settingsFields.sound.value, theme: settingsFields.themeTint.value }); }));

  // Allow Space and Enter to trigger the js-dos play button (the overlay shown before emulation starts)
  document.addEventListener("keydown", e => {
    if (e.key !== " " && e.key !== "Enter") return;
    // Don't intercept if user is typing in an input/textarea/button
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
    // Look for the js-dos play button inside the player host
    const playBtn = dom.playerHost?.querySelector(".play-button");
    if (playBtn) { e.preventDefault(); playBtn.click(); }
  });
}

window.addEventListener("unhandledrejection", event => { if (handleExitStatus(event.reason)) event.preventDefault(); });

document.addEventListener("DOMContentLoaded", async () => {
  hydrateSettingsUI(); setupEventListeners(); syncSoundIndicator();
  renderSavesList();
  setStatus("Ready — drop a .jsdos bundle or paste a URL to play", "ok"); updateUI();

  // Initialize analytics tracking
  trackWebVitals();
  trackScrollDepth();
  trackEngagement();
  trackOutboundLinks();
  trackEvent("page_load", { referrer: document.referrer || "direct", screen_width: window.innerWidth, screen_height: window.innerHeight });

  // auto-launch if ?bundle= parameter is provided (from A:\GAMES library)
  const urlParams = new URLSearchParams(window.location.search);
  const bundleParam = urlParams.get("bundle");
  if (bundleParam) {
    loadBundleFromUrl(bundleParam);
  }
});
