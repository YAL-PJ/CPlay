/* ─────────────────────────────────────────────
   C:\PLAY — app.js
   Clean version
─────────────────────────────────────────────*/

/* ── DOM ─────────────────────────────────── */

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
gameGrid: document.getElementById("gameGrid"),
savesList: document.getElementById("savesList")

};

/* ── Settings ─────────────────────────────── */

const settingsFields = {

cycles: document.getElementById("cycles"),
memsize: document.getElementById("memsize"),
sound: document.getElementById("sound"),
themeTint: document.getElementById("themeTint")

};

/* ── Constants ────────────────────────────── */

const SETTINGS_KEY = "cplay.settings";
const SAVES_KEY = "cplay.saves";

const GAMES = [

{
id: "doom",
name: "DOOM",
url: "https://v8.js-dos.com/bundles/doom.jsdos",
icon: "./assets/doom.png"
},

{
id: "digger",
name: "Digger",
url: "https://v8.js-dos.com/bundles/digger.jsdos",
icon: "./assets/digger.png"
},

{
id: "pinball",
name: "Epic Pinball",
url: "https://v8.js-dos.com/bundles/pinball.jsdos",
icon: "./assets/pinball.png"
}

];

/* ── State ───────────────────────────────── */

const state = {

ci: null,
running: false,
starting: false,
objectUrl: null,
currentBundle: null

};

/* ── Logging ─────────────────────────────── */

function log(...a) {

console.log("[CPLAY]", ...a);

}

function logError(...a) {

console.error("[CPLAY ERROR]", ...a);

}

/* ── Status UI ───────────────────────────── */

function setStatus(msg, type = "") {

dom.statusText.textContent = `C:\\PLAY> ${msg}_`;

dom.statusText.className = type;

}

function showEmpty(v) {

dom.emptyState.style.display = v ? "" : "none";

}

/* ── Button visibility ───────────────────── */

function updateButtons() {

dom.stopBtn.hidden = !state.running;
dom.saveBtn.hidden = !state.running;

}

/* ── Loading Overlay ─────────────────────── */

function showLoading(text) {

hideLoading();

const overlay = document.createElement("div");

overlay.className = "loading-overlay";
overlay.id = "loadingOverlay";

const spinner = document.createElement("div");
spinner.className = "spinner";

const p = document.createElement("p");
p.textContent = text;

overlay.appendChild(spinner);
overlay.appendChild(p);

dom.playerShell.appendChild(overlay);

}

function hideLoading() {

document.getElementById("loadingOverlay")?.remove();

}

/* ── Emulator Cleanup ────────────────────── */

async function stopCurrent() {

hideLoading();

if (state.ci) {

try {

if (typeof state.ci.exit === "function")
await state.ci.exit();

else if (typeof state.ci.stop === "function")
await state.ci.stop();

} catch (e) {

logError("stop error", e);

}

}

state.ci = null;

if (state.objectUrl) {

URL.revokeObjectURL(state.objectUrl);
state.objectUrl = null;

}

dom.playerHost.innerHTML = "";

state.running = false;
state.currentBundle = null;

updateButtons();

}

/* ── DOSBOX CONFIG ───────────────────────── */

function buildDosboxConf() {

const s = readSettings();

return `
[sdl]
fullscreen=false

[dosbox]
memsize=${s.memsize}

[cpu]
cycles=${s.cycles}

[mixer]
nosound=${s.sound === "on" ? "false" : "true"}
`;

}

/* ── START DOS ───────────────────────────── */

async function startDos(bundleUrl) {

if (state.starting) {

setStatus("System busy", "error");
return false;

}

state.starting = true;

try {

await stopCurrent();

showEmpty(false);
showLoading("Booting...");
setStatus("Booting...");

log("bundle", bundleUrl);

const conf = buildDosboxConf();

if (window.emulators) {

window.emulators.pathPrefix =
"https://v8.js-dos.com/latest/emulators/";

}

const result = window.Dos(dom.playerHost, {
url: bundleUrl,
dosboxConf: conf,
kiosk: true
});

const ci = result instanceof Promise
? await result
: result;

if (!ci)
throw new Error("Dos returned null");

state.ci = ci;
state.running = true;
state.currentBundle = bundleUrl;

updateButtons();

if (ci.events) {

ci.events().onTerminate(() => {

log("terminated");

stopCurrent().then(() => {
showEmpty(true);
});

});

}

hideLoading();

setStatus("System Ready", "ok");

return true;

} catch (e) {

logError(e);

hideLoading();
showEmpty(true);

setStatus(`Boot error: ${e.message}`, "error");

return false;

} finally {

state.starting = false;

}

}

/* ── File Loading ────────────────────────── */

async function loadUserBundle(file) {

if (!file) return;

const name = file.name.toLowerCase();

if (!name.endsWith(".jsdos") && !name.endsWith(".zip")) {

setStatus("Invalid file type", "error");

return;

}

const blob = URL.createObjectURL(file);

const ok = await startDos(blob);

if (ok)
state.objectUrl = blob;
else
URL.revokeObjectURL(blob);

}

/* ── Settings ────────────────────────────── */

function readSettings() {

try {

const s = localStorage.getItem(SETTINGS_KEY);

if (s) return JSON.parse(s);

} catch { /* use defaults */ }

return {

cycles: 12000,
memsize: 16,
sound: "on",
themeTint: "amber"

};

}

function persistSettings() {

const s = {

cycles: Number(settingsFields.cycles.value) || 12000,
memsize: Number(settingsFields.memsize.value) || 16,
sound: settingsFields.sound.value,
themeTint: settingsFields.themeTint.value

};

localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

applyThemeTint(s.themeTint);

}

function loadSettingsIntoFields() {

const s = readSettings();

settingsFields.cycles.value = s.cycles;
settingsFields.memsize.value = s.memsize;
settingsFields.sound.value = s.sound;
settingsFields.themeTint.value = s.themeTint;

applyThemeTint(s.themeTint);

}

function applyThemeTint(tint) {

document.documentElement.setAttribute("data-tint", tint);

}

/* ── Save / Load Game ────────────────────── */

function getSaves() {

try {

const raw = localStorage.getItem(SAVES_KEY);

return raw ? JSON.parse(raw) : [];

} catch { return []; }

}

function writeSaves(saves) {

localStorage.setItem(SAVES_KEY, JSON.stringify(saves));

}

async function saveGame() {

if (!state.ci || !state.running) {
setStatus("No game running", "error");
return;
}

try {

setStatus("Saving...");

let dataUrl = null;

if (typeof state.ci.screenshot === "function") {
try {
const img = await state.ci.screenshot();
if (img) dataUrl = img;
} catch { /* screenshot optional */ }
}

const saves = getSaves();

const entry = {
id: Date.now(),
name: getGameName(state.currentBundle),
date: new Date().toISOString(),
bundle: state.currentBundle,
thumb: dataUrl
};

saves.unshift(entry);

if (saves.length > 20) saves.length = 20;

writeSaves(saves);
renderSaves();

setStatus("Game saved", "ok");

} catch (e) {

logError("save error", e);
setStatus("Save failed", "error");

}

}

function getGameName(url) {

if (!url) return "Unknown";

const game = GAMES.find(g => g.url === url);

if (game) return game.name;

try {
const parts = new URL(url).pathname.split("/");
const file = parts[parts.length - 1] || "Custom Game";
return file.replace(/\.(jsdos|zip)$/i, "");
} catch {
return "Custom Game";
}

}

function renderSaves() {

const saves = getSaves();

if (saves.length === 0) {
dom.savesList.innerHTML =
'<p class="small-note">No saves yet. Run a game and hit Save.</p>';
return;
}

dom.savesList.innerHTML = "";

for (const save of saves) {

const card = document.createElement("div");
card.className = "save-card";

const thumb = document.createElement("img");
thumb.className = "save-thumb";
thumb.src = save.thumb || "./assets/doom.png";
thumb.alt = save.name;

const info = document.createElement("div");
info.className = "save-info";

const nameEl = document.createElement("span");
nameEl.className = "save-name";
nameEl.textContent = save.name;

const dateEl = document.createElement("span");
dateEl.className = "save-date";
dateEl.textContent = new Date(save.date).toLocaleString();

info.appendChild(nameEl);
info.appendChild(dateEl);

const actions = document.createElement("div");
actions.className = "save-actions";

const loadBtn = document.createElement("button");
loadBtn.className = "ghost-btn save-load-btn";
loadBtn.textContent = "Load";
loadBtn.onclick = () => {
if (save.bundle) {
setStatus(`Loading ${save.name}...`);
startDos(save.bundle);
}
};

const delBtn = document.createElement("button");
delBtn.className = "ghost-btn save-del-btn";
delBtn.textContent = "Del";
delBtn.onclick = () => {
const all = getSaves().filter(s => s.id !== save.id);
writeSaves(all);
renderSaves();
};

actions.appendChild(loadBtn);
actions.appendChild(delBtn);

card.appendChild(thumb);
card.appendChild(info);
card.appendChild(actions);

dom.savesList.appendChild(card);

}

}

/* ── Game Grid ───────────────────────────── */

function renderGameGrid() {

dom.gameGrid.innerHTML = "";

for (const game of GAMES) {

const card = document.createElement("div");

card.className = "game-card";

const iconWrap = document.createElement("div");
iconWrap.className = "game-icon-container";

const img = document.createElement("img");
img.src = game.icon;
img.alt = game.name;
img.className = "game-thumb";

iconWrap.appendChild(img);

const label = document.createElement("span");
label.className = "game-label";
label.textContent = game.name;

card.appendChild(iconWrap);
card.appendChild(label);

card.onclick = () => {

setStatus(`Loading ${game.name}...`);

startDos(game.url);

};

dom.gameGrid.appendChild(card);

}

}

/* ── Drag and Drop ───────────────────────── */

function setupDragDrop() {

const dz = dom.dropzone;

dz.addEventListener("dragover", (e) => {
e.preventDefault();
dz.classList.add("dragging");
});

dz.addEventListener("dragleave", () => {
dz.classList.remove("dragging");
});

dz.addEventListener("drop", (e) => {
e.preventDefault();
dz.classList.remove("dragging");

const file = e.dataTransfer.files[0];
if (file) loadUserBundle(file);
});

}

/* ── Events ─────────────────────────────── */

dom.bundleInput.addEventListener("change", async e => {

const file = e.target.files[0];

await loadUserBundle(file);

e.target.value = "";

});

dom.loadUrlBtn.addEventListener("click", () => {

const url = dom.bundleUrlInput.value.trim();

if (!url) {
setStatus("Enter a URL first", "error");
return;
}

try {
new URL(url);
} catch {
setStatus("Invalid URL", "error");
return;
}

startDos(url);

});

dom.stopBtn.addEventListener("click", async () => {

await stopCurrent();

showEmpty(true);
setStatus("Stopped");

});

dom.saveBtn.addEventListener("click", () => {

saveGame();

});

dom.fullscreenBtn.addEventListener("click", async () => {

if (!document.fullscreenElement)
await dom.playerShell.requestFullscreen();
else
await document.exitFullscreen();

});

/* Settings change listeners */
for (const field of Object.values(settingsFields)) {
field.addEventListener("change", persistSettings);
}

/* ── Init ───────────────────────────────── */

loadSettingsIntoFields();

setStatus("Ready");

showEmpty(true);

updateButtons();

renderGameGrid();

renderSaves();

setupDragDrop();
