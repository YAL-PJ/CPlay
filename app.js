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
gameGrid: document.getElementById("gameGrid")

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

function setStatus(msg,type=""){

dom.statusText.textContent = `C:\\PLAY> ${msg}_`;

dom.statusText.className = type;

}

function showEmpty(v){

dom.emptyState.style.display = v ? "" : "none";

}

/* ── Loading Overlay ─────────────────────── */

function showLoading(text){

hideLoading();

const overlay = document.createElement("div");

overlay.className="loading-overlay";
overlay.id="loadingOverlay";

const spinner=document.createElement("div");
spinner.className="spinner";

const p=document.createElement("p");
p.textContent=text;

overlay.appendChild(spinner);
overlay.appendChild(p);

dom.playerShell.appendChild(overlay);

}

function hideLoading(){

document.getElementById("loadingOverlay")?.remove();

}

/* ── Emulator Cleanup ────────────────────── */

async function stopCurrent(){

hideLoading();

if(state.ci){

try{

if(typeof state.ci.exit==="function")
await state.ci.exit();

else if(typeof state.ci.stop==="function")
await state.ci.stop();

}catch(e){

logError("stop error",e);

}

}

state.ci=null;

if(state.objectUrl){

URL.revokeObjectURL(state.objectUrl);
state.objectUrl=null;

}

dom.playerHost.innerHTML="";

state.running=false;

}

/* ── DOSBOX CONFIG ───────────────────────── */

function buildDosboxConf(){

const s=readSettings();

return `

[sdl]
fullscreen=false

[dosbox]
memsize=${s.memsize}

[cpu]
cycles=${s.cycles}

[mixer]
nosound=${s.sound==="on"?"false":"true"}

`;

}

/* ── START DOS ───────────────────────────── */

async function startDos(bundleUrl){

if(state.starting){

setStatus("System busy","error");
return false;

}

state.starting=true;

try{

await stopCurrent();

showEmpty(false);
showLoading("Booting...");
setStatus("Booting...");

log("bundle",bundleUrl);

const conf=buildDosboxConf();

if(window.emulators){

window.emulators.pathPrefix=
"https://v8.js-dos.com/latest/emulators/";

}

const result=window.Dos(dom.playerHost,{
url:bundleUrl,
dosboxConf:conf,
kiosk:true
});

const ci=result instanceof Promise
?await result
:result;

if(!ci)
throw new Error("Dos returned null");

state.ci=ci;
state.running=true;
state.currentBundle=bundleUrl;

if(ci.events){

ci.events().onTerminate(()=>{

log("terminated");

stopCurrent();

});

}

hideLoading();

setStatus("System Ready","ok");

return true;

}catch(e){

logError(e);

hideLoading();

setStatus(`Boot error: ${e.message}`,"error");

return false;

}finally{

state.starting=false;

}

}

/* ── File Loading ────────────────────────── */

async function loadUserBundle(file){

if(!file)return;

const name=file.name.toLowerCase();

if(!name.endsWith(".jsdos")&&!name.endsWith(".zip")){

setStatus("Invalid file type","error");

return;

}

const blob=URL.createObjectURL(file);

const ok=await startDos(blob);

if(ok)
state.objectUrl=blob;
else
URL.revokeObjectURL(blob);

}

/* ── Settings ────────────────────────────── */

function readSettings(){

try{

const s=localStorage.getItem(SETTINGS_KEY);

if(s)return JSON.parse(s);

}catch{}

return{

cycles:12000,
memsize:16,
sound:"on",
themeTint:"amber"

};

}

function persistSettings(){

const s={

cycles:Number(settingsFields.cycles.value)||12000,
memsize:Number(settingsFields.memsize.value)||16,
sound:settingsFields.sound.value,
themeTint:settingsFields.themeTint.value

};

localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));

}

/* ── Game Grid ───────────────────────────── */

function renderGameGrid(){

dom.gameGrid.innerHTML="";

for(const game of GAMES){

const card=document.createElement("div");

card.className="game-card";

const img=document.createElement("img");
img.src=game.icon;
img.className="game-thumb";

const label=document.createElement("span");
label.textContent=game.name;

card.appendChild(img);
card.appendChild(label);

card.onclick=()=>{

setStatus(`Loading ${game.name}...`);

startDos(game.url);

};

dom.gameGrid.appendChild(card);

}

}

/* ── Events ─────────────────────────────── */

dom.bundleInput.addEventListener("change",async e=>{

const file=e.target.files[0];

await loadUserBundle(file);

e.target.value="";

});

dom.loadUrlBtn.addEventListener("click",()=>{

startDos(dom.bundleUrlInput.value);

});

dom.stopBtn.addEventListener("click",async()=>{

await stopCurrent();

setStatus("Stopped");

});

dom.fullscreenBtn.addEventListener("click",async()=>{

if(!document.fullscreenElement)
await dom.playerShell.requestFullscreen();
else
await document.exitFullscreen();

});

/* ── Init ───────────────────────────────── */

setStatus("Ready");

showEmpty(true);

renderGameGrid();