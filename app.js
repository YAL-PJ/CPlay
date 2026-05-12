/* ── C:\PLAY  —  app.js ───────────────────────────────────────────────────────────────── */

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
  openLibraryBtn: document.getElementById("openLibraryBtn"),
  libraryModal: document.getElementById("libraryModal"),
  libraryFrame: document.getElementById("libraryFrame"),
  closeLibraryBtn: document.getElementById("closeLibraryBtn"),
  featuredGameCards: document.getElementById("featuredGameCards"),
  featuredGamesTerminal: document.getElementById("featuredGamesTerminal"),
  openFileBrowserBtn: document.getElementById("openFileBrowserBtn"),
  fileBrowserModal: document.getElementById("fileBrowserModal"),
  inlineBrowserView: document.getElementById("inlineBrowserView"),
  openDosTerminalBtn: document.getElementById("openDosTerminalBtn"),
  dosTerminalInteractive: document.getElementById("dosTerminalInteractive"),
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

const LIBRARY_JSON_URL = "https://raw.githubusercontent.com/yal-pj/dos-freeware-games-library/main/library.json";
const FALLBACK_THUMB = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#0d1117"/><text y="48" x="60" text-anchor="middle" font-family="monospace" font-size="14" fill="#444">DOS</text></svg>'
);

function trackEvent(eventName, params = {}) {
  try { if (typeof gtag === "function") gtag("event", eventName, params); } catch { }
}

function trackWebVitals() {
  if (!("PerformanceObserver" in window)) return;
  try { new PerformanceObserver(list => { const last = list.getEntries().at(-1); trackEvent("web_vital_lcp", { value: Math.round(last.startTime), metric_id: "LCP" }); }).observe({ type: "largest-contentful-paint", buffered: true }); } catch { }
  try { new PerformanceObserver(list => { list.getEntries().forEach(e => trackEvent("web_vital_fid", { value: Math.round(e.processingStart - e.startTime), metric_id: "FID" })); }).observe({ type: "first-input", buffered: true }); } catch { }
  try { let cls = 0; new PerformanceObserver(list => { list.getEntries().forEach(e => { if (!e.hadRecentInput) cls += e.value; }); trackEvent("web_vital_cls", { value: Math.round(cls * 1000), metric_id: "CLS" }); }).observe({ type: "layout-shift", buffered: true }); } catch { }
}

function trackScrollDepth() {
  const seen = new Set();
  window.addEventListener("scroll", () => {
    const pct = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
    [25, 50, 75, 100].forEach(m => { if (pct >= m && !seen.has(m)) { seen.add(m); trackEvent("scroll_depth", { percent: m }); } });
  }, { passive: true });
}

function trackEngagement() {
  let secs = 0, active = true;
  document.addEventListener("visibilitychange", () => { active = document.visibilityState === "visible"; });
  setInterval(() => { if (active) secs++; }, 1000);
  window.addEventListener("beforeunload", () => trackEvent("engagement_time", { seconds: secs, game_was_played: state.isRunning || state.currentBundle !== "" }));
}

function trackOutboundLinks() {
  document.addEventListener("click", e => {
    const link = e.target.closest("a[href]");
    if (!link) return;
    try { const url = new URL(link.href); if (url.hostname !== window.location.hostname) trackEvent("outbound_click", { url: link.href }); } catch { }
  });
}

function setStatus(msg, type = "ok") { if (dom.statusText) { dom.statusText.textContent = `C:\\PLAY> ${msg}${msg.endsWith("_") ? "" : "_"}`; dom.statusText.className = type; } }
function handleExitStatus(err) { return !!(err && (err.name === "ExitStatus" || (err.message && err.message.includes("ExitStatus"))) && (err.status === 0 || !err.status)); }
function showEmptyState(v) { if (dom.emptyState) dom.emptyState.style.display = v ? "" : "none"; }
let _bootTimer = null;
function hideLoading() { if (_bootTimer) { clearTimeout(_bootTimer); _bootTimer = null; } document.getElementById("loadingOverlay")?.remove(); }
function showLoading(msg) { hideLoading(); const o = document.createElement("div"); o.className = "loading-overlay"; o.id = "loadingOverlay"; o.innerHTML = '<div class="spinner"></div>'; const p = document.createElement("p"); p.textContent = msg; o.appendChild(p); dom.playerShell.appendChild(o); }
function showBootingOverlay() { const o = document.getElementById("loadingOverlay"); if (!o) return; const p = o.querySelector("p"); if (p) p.textContent = "Game booting… click to dismiss"; o.style.cursor = "pointer"; o.addEventListener("click", hideLoading, { once: true }); _bootTimer = setTimeout(hideLoading, 12000); }
function showGameCrashScreen(msg) { const ex = document.getElementById("gameCrashOverlay"); if (ex) ex.remove(); const o = document.createElement("div"); o.id = "gameCrashOverlay"; o.className = "game-crash-overlay"; const b = document.createElement("div"); b.className = "crash-box"; const t = document.createElement("p"); t.className = "crash-title"; t.textContent = "⚠ GAME ERROR"; const m = document.createElement("p"); m.className = "crash-msg"; m.textContent = msg; const btn = document.createElement("button"); btn.className = "crash-dismiss ghost-btn"; btn.textContent = "Dismiss"; btn.addEventListener("click", () => o.remove()); b.append(t, m, btn); o.appendChild(b); dom.playerShell?.appendChild(o); }
function updateUI() { if (dom.stopBtn) dom.stopBtn.hidden = !state.isRunning; if (dom.saveBtn) dom.saveBtn.hidden = !state.isRunning; showEmptyState(!state.isRunning && !state.ci); }
const clamp = (v, mn, mx) => Math.min(mx, Math.max(mn, v));

function readSettings() { try { const s = localStorage.getItem("cplay.settings"); if (s) return { ...defaultSettings, ...JSON.parse(s) }; } catch { localStorage.removeItem("cplay.settings"); } return { ...defaultSettings }; }
function persistSettings() { const v = { cycles: clamp(Number(settingsFields.cycles.value)||defaultSettings.cycles,500,50000), memsize: clamp(Number(settingsFields.memsize.value)||defaultSettings.memsize,8,64), sound: settingsFields.sound.value==="off"?"off":"on", themeTint: ["amber","green","ice"].includes(settingsFields.themeTint.value)?settingsFields.themeTint.value:"amber" }; localStorage.setItem("cplay.settings",JSON.stringify(v)); document.documentElement.setAttribute("data-tint",v.themeTint); document.body.dataset.tint=v.themeTint; }
function hydrateSettingsUI() { const s=readSettings(); if(settingsFields.cycles) settingsFields.cycles.value=s.cycles; if(settingsFields.memsize) settingsFields.memsize.value=s.memsize; if(settingsFields.sound) settingsFields.sound.value=s.sound; if(settingsFields.themeTint) settingsFields.themeTint.value=s.themeTint; document.documentElement.setAttribute("data-tint",s.themeTint); document.body.dataset.tint=s.themeTint; }

const trackedAudioContexts = new Set();
const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
if (OriginalAudioContext) {
  const Patched = function(...a) { const ctx = new OriginalAudioContext(...a); trackedAudioContexts.add(ctx); if(readSettings().sound==="off") ctx.suspend().catch(()=>{}); return ctx; };
  Patched.prototype = OriginalAudioContext.prototype;
  if (window.AudioContext) window.AudioContext = Patched;
  if (window.webkitAudioContext) window.webkitAudioContext = Patched;
}

function closeOrphanedAudioContexts() {
  trackedAudioContexts.forEach(c => { try { if(c.state!=="closed") c.close().catch(()=>{}); } catch{} }); trackedAudioContexts.clear();
  try { if(window.audioContext&&window.audioContext.state!=="closed") window.audioContext.close().catch(()=>{}); } catch{}
  try { dom.playerHost.querySelectorAll("canvas").forEach(c => c.audioCtx?.state!=="closed"&&c.audioCtx.close().catch(()=>{})); } catch{}
}

function syncSoundIndicator() { const m=readSettings().sound==="off"; [dom.soundToggleBtn,dom.soundToggleFS].forEach(b => b&&b.classList.toggle("muted",m)); }
function toggleSound() { const s=readSettings(); const nv=s.sound==="off"?"on":"off"; trackEvent("sound_toggle",{sound_state:nv}); if(settingsFields.sound) settingsFields.sound.value=nv; persistSettings(); applySoundSetting(); syncSoundIndicator(); }
function applySoundSetting() {
  const m=readSettings().sound==="off";
  trackedAudioContexts.forEach(c => { try { if(c.state==="closed") return; if(m&&c.state==="running") c.suspend().catch(()=>{}); if(!m&&c.state==="suspended") c.resume().catch(()=>{}); } catch{} });
  try { if(window.audioContext&&window.audioContext.state!=="closed") { if(m&&window.audioContext.state==="running") window.audioContext.suspend().catch(()=>{}); if(!m&&window.audioContext.state==="suspended") window.audioContext.resume().catch(()=>{}); } } catch{}
  try { dom.playerHost.querySelectorAll("canvas").forEach(c => { if(c.audioCtx&&c.audioCtx.state!=="closed") { if(m&&c.audioCtx.state==="running") c.audioCtx.suspend().catch(()=>{}); if(!m&&c.audioCtx.state==="suspended") c.audioCtx.resume().catch(()=>{}); } }); } catch{}
}

async function stopCurrent() {
  hideLoading();
  if (state.ci) { try { if(typeof state.ci.exit==="function") await state.ci.exit(); else if(typeof state.ci.stop==="function") await state.ci.stop(); } catch(e) { if(!handleExitStatus(e)) logError("Stop error:",e); } }
  state.ci=null; state.isRunning=false;
  if(state.objectUrl){URL.revokeObjectURL(state.objectUrl);state.objectUrl=null;}
  await new Promise(r=>setTimeout(r,100)); closeOrphanedAudioContexts(); if(dom.playerHost) dom.playerHost.innerHTML=""; updateUI();
}

function buildDosboxConf() { const s=readSettings(); return `\n[sdl]\nfullscreen=false\nfulldouble=true\n\n[dosbox]\nmachine=svga_s3\nmemsize=${s.memsize}\n\n[cpu]\ncore=auto\ncycles=${s.cycles}\n\n[mixer]\nnosound=${s.sound==="on"?"false":"true"}\nrate=44100\nblocksize=2048\nprebuffer=40\n\n[autoexec]\nexit\n`; }

async function startDos(bundleUrl) {
  if (state.startingLock) return;
  state.startingLock = true;
  try {
    await stopCurrent();
    showEmptyState(false); showLoading("Initializing System..."); setStatus("Booting...","");
    if (window.emulators) window.emulators.pathPrefix = "https://v8.js-dos.com/latest/emulators/";
    const result = window.Dos(dom.playerHost, { url: bundleUrl, dosboxConf: buildDosboxConf(), kiosk: true, autoStart: true });
    const ci = (result instanceof Promise) ? await result : result;
    if (!ci) throw new Error("Dos initialization returned null");
    state.ci=ci; state.isRunning=true; state.currentBundle=bundleUrl; updateUI();
    ci.events?.().onTerminate(()=>stopCurrent().then(()=>showEmptyState(true)));
    showBootingOverlay(); setStatus("System Ready - Drive A:","ok"); applySoundSetting();
    [500,1500,3000,5000].forEach(d=>setTimeout(applySoundSetting,d));
    dom.playerShell?.requestFullscreen().catch(()=>{});
    trackEvent("game_start",{bundle_url:bundleUrl,method:state.objectUrl?"file_upload":"url"});
    return {ok:true};
  } catch(err) {
    if(handleExitStatus(err)){await stopCurrent();return{ok:true};}
    hideLoading(); setStatus(`System Error: ${err.message||"Unknown"}`,"error"); state.isRunning=false; updateUI();
    trackEvent("game_error",{error_message:err?.message||"Unknown",bundle_url:bundleUrl});
    return {ok:false,errorMessage:err?.message||"Unknown error"};
  } finally { state.startingLock=false; }
}

async function loadUserBundle(file) {
  if (!file) return;
  const name=file.name.toLowerCase();
  if(!name.endsWith(".jsdos")&&!name.endsWith(".zip")) return setStatus("Only .jsdos or .zip bundles are supported.","error");
  trackEvent("file_upload",{file_name:file.name,file_size:file.size,file_type:name.endsWith(".jsdos")?"jsdos":"zip"});
  const newUrl=URL.createObjectURL(file); showLoading(`Loading ${file.name}…`); setStatus(`Loading ${file.name}…`,"");
  const result=await startDos(newUrl);
  if(result.ok) state.objectUrl=newUrl; else URL.revokeObjectURL(newUrl);
}

function normalizeGithubUrl(u) { try { const url=new URL(u); const p=url.pathname.split("/").filter(Boolean); if(url.hostname!=="github.com"||p.length<2) return u; const[,, mode, branch,...rest]=p; if((mode==="blob"||mode==="raw")&&branch&&rest.length>0) return `https://raw.githubusercontent.com/${p[0]}/${p[1]}/${branch}/${rest.join("/")}`; return u; } catch{return u;} }
function transformCloudDriveUrl(u) { try { const url=new URL(u); if(url.hostname==="drive.google.com"){const id=url.pathname.match(/\/file\/d\/([^/]+)/)?.[1]||url.searchParams.get("id");if(id)return{finalUrl:`https://drive.google.com/uc?export=download&id=${id}`,note:"G-Drive converted."};} if(url.hostname.endsWith("dropbox.com")){url.searchParams.set("dl","1");return{finalUrl:url.toString(),note:"Dropbox converted."};} if(url.hostname==="1drv.ms"||url.hostname.includes("onedrive")){url.searchParams.set("download","1");return{finalUrl:url.toString(),note:"OneDrive converted."};} } catch{} return{finalUrl:u,note:""};}
async function resolveGithubRepoArchive(u) { try { const url=new URL(u); const p=url.pathname.split("/").filter(Boolean); if(url.hostname!=="github.com"||p.length!==2) return normalizeGithubUrl(u); const[owner,repo]=p; const res=await fetch(`https://api.github.com/repos/${owner}/${repo}`,{headers:{Accept:"application/vnd.github+json"}}); const data=await res.json(); return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${data.default_branch||"main"}`; } catch{return u;} }

async function loadBundleFromUrl(rawUrl) {
  const typedUrl=(rawUrl||"").trim();
  if(!typedUrl) return setStatus("Paste a URL first.","error");
  if(!/^https?:\/\//i.test(typedUrl)) return setStatus("Invalid URL protocol.","error");
  let finalUrl=typedUrl,note="";
  const src=/github\.com/i.test(typedUrl)?"github":/drive\.google/i.test(typedUrl)?"google_drive":/dropbox/i.test(typedUrl)?"dropbox":/onedrive|1drv/i.test(typedUrl)?"onedrive":"direct";
  trackEvent("url_load",{url_source:src});
  try {
    if(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i.test(typedUrl)){finalUrl=await resolveGithubRepoArchive(typedUrl);note="GitHub archive.";}
    else finalUrl=normalizeGithubUrl(typedUrl);
    const cloud=transformCloudDriveUrl(finalUrl); finalUrl=cloud.finalUrl; note=note||cloud.note;
    showLoading("Fetching..."); setStatus("Loading from URL…","");
    const result=await startDos(finalUrl);
    if(!result.ok) return setStatus(`Load failed: ${result.errorMessage||"Unknown error"}`,"error");
    if(note) setStatus(`Running (${note})`,"ok");
  } catch(err){hideLoading();setStatus(`Load failed: ${err.message}`,"error");}
}

const DB_NAME="cplay-saves-db",STORE_NAME="saves";
function openDatabase(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE_NAME))r.result.createObjectStore(STORE_NAME,{keyPath:"id"});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function dbTransaction(mode,handler){const db=await openDatabase();return new Promise((res,rej)=>{const tx=db.transaction(STORE_NAME,mode);const store=tx.objectStore(STORE_NAME);handler(store,(v)=>{db.close();res(v);},(e)=>{db.close();rej(e);});tx.onerror=()=>{db.close();rej(tx.error);};});}
const getAllSaves=()=>dbTransaction("readonly",(store,res)=>{const r=store.getAll();r.onsuccess=()=>res(r.result.sort((a,b)=>b.timestamp-a.timestamp));});
const putSave=s=>dbTransaction("readwrite",(store,res)=>{const r=store.put(s);r.onsuccess=()=>res();});
const deleteSave=id=>dbTransaction("readwrite",(store,res)=>{const r=store.delete(id);r.onsuccess=()=>res();});

function captureScreenshot(){try{const c=dom.playerHost.querySelector("canvas");if(!c)return null;const t=document.createElement("canvas");const sc=120/Math.max(c.width,1);t.width=Math.round(c.width*sc);t.height=Math.round(c.height*sc);t.getContext("2d").drawImage(c,0,0,t.width,t.height);return t.toDataURL("image/jpeg",0.7);}catch{return null;}}
function toUint8Array(d){if(!d)return null;if(d instanceof Uint8Array)return d;if(d instanceof ArrayBuffer)return new Uint8Array(d);if(ArrayBuffer.isView(d))return new Uint8Array(d.buffer,d.byteOffset,d.byteLength);if(Array.isArray(d))return new Uint8Array(d);if(d&&typeof d==="object")return toUint8Array(d.data||d.state||d.buffer);return null;}
async function saveEmulatorState(ci){if(!ci)return{ok:false};if(typeof ci.save==="function"){try{const r=await ci.save();const b=toUint8Array(r);if(b?.length)return{ok:true,state:b};if(r===true)return{ok:true,state:null};}catch(e){logError("ci.save() failed:",e);}}if(typeof ci.persist==="function"){try{const b=toUint8Array(await ci.persist());if(b?.length)return{ok:true,state:b};}catch(e){logError("ci.persist() failed:",e);}}return{ok:false};}

async function saveGameState(){if(!state.ci||!state.isRunning)return setStatus("Nothing running.","error");const result=await saveEmulatorState(state.ci);if(!result.ok)return setStatus("Save not supported.","error");let name="Unknown";try{const url=new URL(state.currentBundle);name=decodeURIComponent((url.pathname.split("/").pop()||"").replace(/\.(jsdos|zip)$/i,""))||"Custom Game";}catch{}await putSave({id:`save-${Date.now()}`,name,timestamp:Date.now(),bundleUrl:state.currentBundle,screenshot:captureScreenshot(),state:result.state?Array.from(result.state):null});trackEvent("game_save",{game_name:name});setStatus(`Saved "${name}"`,"ok");await renderSavesList();}
async function loadGameState(id){try{const save=(await getAllSaves()).find(s=>s.id===id);if(!save)return;showLoading("Restoring...");const result=await startDos(save.bundleUrl);if(!result.ok)return setStatus("Restore failed: could not start game.","error");state.currentBundle=save.bundleUrl;if(save.state&&state.ci&&typeof state.ci.restore==="function"){await state.ci.restore(new Uint8Array(save.state));setStatus(`Restored "${save.name}"`,"ok");}else{setStatus(`Loaded "${save.name}"`,"ok");}trackEvent("game_load_save",{game_name:save.name});}catch{setStatus("Restore failed.","error");}}
async function renderSavesList(){if(!dom.savesList)return;try{const saves=await getAllSaves();if(!saves.length)return(dom.savesList.innerHTML='<p class="small-note">No saves yet.</p>');dom.savesList.innerHTML="";saves.forEach(save=>{const el=document.createElement("div");el.className="save-card";if(save.screenshot){const img=document.createElement("img");img.src=save.screenshot;img.className="save-thumb";el.appendChild(img);}const info=document.createElement("div");info.className="save-info";const sn=document.createElement("span");sn.className="save-name";sn.textContent=save.name;info.appendChild(sn);const sd=document.createElement("span");sd.className="save-date";sd.textContent=new Date(save.timestamp).toLocaleString();info.appendChild(sd);el.appendChild(info);const actions=document.createElement("div");actions.className="save-actions";const lb=document.createElement("button");lb.className="action-btn";lb.textContent="Load";lb.addEventListener("click",()=>loadGameState(save.id));const db=document.createElement("button");db.className="ghost-btn";db.textContent="Del";db.addEventListener("click",()=>confirm("Delete this save?")&&(trackEvent("game_delete_save",{game_name:save.name}),deleteSave(save.id).then(renderSavesList)));actions.append(lb,db);el.appendChild(actions);dom.savesList.appendChild(el);});}catch{}}

function openLibrary(){if(!dom.libraryModal)return;if(dom.libraryFrame&&!dom.libraryFrame.getAttribute("src"))dom.libraryFrame.src="./library/";dom.libraryModal.hidden=false;document.body.style.overflow="hidden";trackEvent("library_open");}
function closeLibrary(){if(dom.libraryModal){dom.libraryModal.hidden=true;document.body.style.overflow="";}}

async function loadFeaturedGames(){try{const resp=await fetch(LIBRARY_JSON_URL);if(!resp.ok)return;const data=await resp.json();if(!Array.isArray(data))return;const playable=data.filter(g=>g.downloadUrl);if(!playable.length){if(dom.featuredGamesTerminal)dom.featuredGamesTerminal.innerHTML='<p class="dos-line dos-muted"> &lt;No games found&gt;</p>';return;}if(dom.featuredGamesTerminal)dom.featuredGamesTerminal.innerHTML=`<p class="dos-line dos-muted">     ${playable.length} file(s) found &mdash; click a game to play</p>`;renderFeaturedGameCards(playable.sort(()=>Math.random()-0.5).slice(0,6));}catch{if(dom.featuredGamesTerminal)dom.featuredGamesTerminal.innerHTML='<p class="dos-line dos-muted"> &lt;Library offline&gt;</p>';}}

// ── File Browser (modal + inline) ─────────────────────────────────────────────
const fb = { games: [], filtered: [], cursor: 0 };

function escapeHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

async function openFileBrowser(){const m=dom.fileBrowserModal;if(!m)return;m.hidden=false;document.body.style.overflow="hidden";document.getElementById("fbSearch")?.focus();if(!fb.games.length)await loadFbGames();else renderFbList();trackEvent("file_browser_open");}
function closeFileBrowser(){if(dom.fileBrowserModal){dom.fileBrowserModal.hidden=true;document.body.style.overflow="";}}

async function loadFbGames(){
  try{
    const resp=await fetch(LIBRARY_JSON_URL);if(!resp.ok)throw new Error("Network error");
    const data=await resp.json();
    fb.games=Array.isArray(data)?data.filter(g=>g.downloadUrl):[];
    fb.filtered=[...fb.games]; fb.cursor=0;
    renderFbList(); updateFbCount();
    if(dom.inlineBrowserView&&!dom.inlineBrowserView.hidden){renderIbList();updateIbCount();}
  }catch{
    const l=document.getElementById("fbList");if(l)l.innerHTML='<div style="padding:1.5rem 1rem"><p class="dos-line" style="color:var(--err)">Bad command or file name</p><p class="dos-line dos-muted">Library connection failed</p></div>';
    const il=document.getElementById("ibList");if(il)il.innerHTML='<div style="padding:1.5rem 1rem"><p class="dos-line" style="color:var(--err)">Bad command or file name</p></div>';
  }
}

function renderFbList(){const list=document.getElementById("fbList");if(!list)return;if(!fb.filtered.length){list.innerHTML='<div style="padding:1.5rem;text-align:center;color:#555">No files found.</div>';return;}list.innerHTML="";fb.filtered.forEach((g,i)=>{const item=document.createElement("div");item.className="fb-item"+(i===fb.cursor?" fb-cursor":"");item.setAttribute("role","option");item.setAttribute("aria-selected",i===fb.cursor);item.innerHTML=`<span class="fb-col-num">${i+1}</span><span class="fb-col-name">${escapeHtml(g.title||"Unknown")}</span><span class="fb-col-year">${g.year||"????"}</span><span class="fb-col-genre">${escapeHtml(g.genre||"")}</span><span class="fb-col-status">&lt;PLAY&gt;</span>`;item.addEventListener("click",()=>{fb.cursor=i;playFbGame(fb.filtered[i]);});item.addEventListener("mouseenter",()=>{fb.cursor=i;list.querySelectorAll(".fb-cursor").forEach(e=>e.classList.remove("fb-cursor"));item.classList.add("fb-cursor");});list.appendChild(item);});list.querySelector(".fb-cursor")?.scrollIntoView({block:"nearest"});}
function updateFbCount(){const c=document.getElementById("fbCount");if(c)c.textContent=`${fb.filtered.length} file(s) — ENTER to run`;}
function filterFb(q){const ql=q.toLowerCase().trim();fb.filtered=ql?fb.games.filter(g=>g.title?.toLowerCase().includes(ql)||g.genre?.toLowerCase().includes(ql)):[...fb.games];fb.cursor=0;renderFbList();updateFbCount();const cmd=document.getElementById("fbCmdText");if(cmd)cmd.textContent=ql?`DIR /S *${ql}*`:"";};
function playFbGame(game){if(!game?.downloadUrl)return;closeFileBrowser();closeInlineBrowser();loadBundleFromUrl(game.downloadUrl);trackEvent("file_browser_game_launch",{title:game.title});}

// ── Inline browser (DIR /B visual) ─────────────────────────────────────────
async function openInlineBrowser(){if(!dom.inlineBrowserView){openFileBrowser();return;}showEmptyState(false);dom.inlineBrowserView.hidden=false;document.getElementById("ibSearch")?.focus();if(!fb.games.length)await loadFbGames();else{fb.filtered=[...fb.games];fb.cursor=0;renderIbList();updateIbCount();}trackEvent("inline_browser_open");}
function closeInlineBrowser(){if(!dom.inlineBrowserView||dom.inlineBrowserView.hidden)return;dom.inlineBrowserView.hidden=true;if(!state.isRunning&&!state.ci)showEmptyState(true);const s=document.getElementById("ibSearch");if(s)s.value="";const c=document.getElementById("ibCmdText");if(c)c.textContent="";fb.filtered=[...fb.games];fb.cursor=0;}
function renderIbList(){const list=document.getElementById("ibList");if(!list)return;if(!fb.filtered.length){list.innerHTML='<div style="padding:1.5rem;text-align:center;color:#555">No files found.</div>';return;}list.innerHTML="";fb.filtered.forEach((g,i)=>{const item=document.createElement("div");item.className="fb-item"+(i===fb.cursor?" fb-cursor":"");item.setAttribute("role","option");item.setAttribute("aria-selected",i===fb.cursor);item.innerHTML=`<span class="fb-col-num">${i+1}</span><span class="fb-col-name">${escapeHtml(g.title||"Unknown")}</span><span class="fb-col-year">${g.year||"????"}</span><span class="fb-col-genre">${escapeHtml(g.genre||"")}</span><span class="fb-col-status">&lt;PLAY&gt;</span>`;item.addEventListener("click",()=>{fb.cursor=i;playFbGame(fb.filtered[i]);});item.addEventListener("mouseenter",()=>{fb.cursor=i;list.querySelectorAll(".fb-cursor").forEach(e=>e.classList.remove("fb-cursor"));item.classList.add("fb-cursor");});list.appendChild(item);});list.querySelector(".fb-cursor")?.scrollIntoView({block:"nearest"});}
function updateIbCount(){const c=document.getElementById("ibCount");if(c)c.textContent=`${fb.filtered.length} file(s) — ENTER to run`;}
function filterIb(q){const ql=q.toLowerCase().trim();fb.filtered=ql?fb.games.filter(g=>g.title?.toLowerCase().includes(ql)||g.genre?.toLowerCase().includes(ql)):[...fb.games];fb.cursor=0;renderIbList();updateIbCount();const c=document.getElementById("ibCmdText");if(c)c.textContent=ql?`DIR /S *${ql}*`:"";};

// ── Interactive DOS Terminal ───────────────────────────────────────────────────
const dit = { history: [], histIdx: -1, currentDir: "C:\\GAMES" };

function ditHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = Math.imul(h, 31) + str.charCodeAt(i) | 0;
  return Math.abs(h);
}

function ditFakeInfo(g) {
  const h = ditHash(g.title || "");
  const size = (h % 11_500_000) + 524_288; // ~512 KB – 12 MB
  const y = parseInt(g.year) || 1993;
  const mo = String((h % 12) + 1).padStart(2, "0");
  const dy = String((h % 28) + 1).padStart(2, "0");
  const hr = String(h % 24).padStart(2, "0");
  const mn = String((h >> 4) % 60).padStart(2, "0");
  return { size, date: `${mo}/${dy}/${y}`, time: `${hr}:${mn}` };
}

function ditAppend(html) {
  const out = document.getElementById("ditOutput");
  if (!out) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  out.appendChild(wrap);
  out.scrollTop = out.scrollHeight;
}

function ditLine(text, cls = "dit-out") {
  return `<p class="${cls}">${escapeHtml(text)}</p>`;
}

async function openDosTerminal() {
  if (!dom.dosTerminalInteractive) return;
  showEmptyState(false);
  dom.dosTerminalInteractive.hidden = false;
  if (!fb.games.length) await loadFbGames();
  // Print welcome banner if output is empty
  const out = document.getElementById("ditOutput");
  if (out && out.children.length === 0) {
    ditAppend(
      `<p class="dit-out">Microsoft(R) MS-DOS(R) Version 6.22</p>` +
      `<p class="dit-out dit-dim">             (C)Copyright Microsoft Corp 1981-1994.</p>` +
      `<p class="dit-out">&nbsp;</p>` +
      `<p class="dit-out dit-dim">Type <span style="color:var(--dos-cyan)">HELP</span> for available commands. Click a filename to launch the game.</p>` +
      `<p class="dit-out">&nbsp;</p>`
    );
  }
  document.getElementById("ditInput")?.focus();
  trackEvent("dos_terminal_open");
}

function closeDosTerminal() {
  if (!dom.dosTerminalInteractive || dom.dosTerminalInteractive.hidden) return;
  dom.dosTerminalInteractive.hidden = true;
  if (!state.isRunning && !state.ci) showEmptyState(true);
}

async function executeDosCommand(raw) {
  const cmd = raw.trim();
  const up = cmd.toUpperCase().replace(/\s+/g, " ");

  // Echo typed command
  ditAppend(`<p class="dit-echo">${escapeHtml(dit.currentDir)}&gt; ${escapeHtml(cmd)}</p>`);

  if (!cmd) return;

  // Add to history
  if (cmd && (dit.history[0] !== cmd)) dit.history.unshift(cmd);
  if (dit.history.length > 50) dit.history.pop();
  dit.histIdx = -1;

  if (up === "CLS") { const o = document.getElementById("ditOutput"); if (o) o.innerHTML = ""; return; }

  if (up === "VER") { ditAppend(ditLine("") + ditLine("MS-DOS Version 6.22") + ditLine("")); return; }

  if (up === "CD" || up === "CD." || up === `CD ${dit.currentDir}`) { ditAppend(ditLine(dit.currentDir)); return; }

  if (up === "HELP") {
    ditAppend(
      ditLine("") +
      ditLine("Available commands:") +
      ditLine("  DIR          Full directory listing with sizes and dates") +
      ditLine("  DIR /B       Bare listing (filenames only)") +
      ditLine("  DIR /W       Wide listing") +
      ditLine("  CLS          Clear screen") +
      ditLine("  VER          Show DOS version") +
      ditLine("  CD           Show current directory") +
      ditLine("  HELP         Show this help") +
      ditLine("  <filename>   Type a .JSDOS name to launch the game") +
      ditLine("")
    );
    return;
  }

  // DIR — full listing
  if (up === "DIR" || up === "DIR /A" || up === "DIR /O" || up === "DIR /ON") {
    if (!fb.games.length) { ditAppend(ditLine(" Loading...","dit-out dit-dim")); await loadFbGames(); }
    const out = document.getElementById("ditOutput");
    // Header block
    const hdr = document.createElement("div");
    hdr.innerHTML =
      ditLine("") +
      `<p class="dit-out"> Volume in drive C is PLAY</p>` +
      `<p class="dit-out"> Volume Serial Number is CAFE-BABE</p>` +
      ditLine("") +
      `<p class="dit-out"> Directory of ${escapeHtml(dit.currentDir)}</p>` +
      ditLine("");
    out.appendChild(hdr);
    let total = 0;
    fb.games.forEach(g => {
      const { size, date, time } = ditFakeInfo(g);
      total += size;
      const fname = ((g.title || "UNKNOWN") + ".JSDOS").toUpperCase();
      const sizeStr = size.toLocaleString("en-US").padStart(15);
      const row = document.createElement("p");
      row.className = "dit-file-row";
      row.innerHTML =
        `<span class="dit-fdate">${date}  ${time}  </span>` +
        `<span class="dit-fsize">${sizeStr} </span>` +
        `<span class="dit-fname">${escapeHtml(fname)}</span>`;
      row.addEventListener("click", () => {
        if (g.downloadUrl) { closeDosTerminal(); loadBundleFromUrl(g.downloadUrl); trackEvent("dos_terminal_game_launch", { title: g.title }); }
      });
      out.appendChild(row);
    });
    const ftr = document.createElement("div");
    ftr.innerHTML =
      ditLine("") +
      ditLine(`         ${String(fb.games.length).padStart(4)} File(s)  ${total.toLocaleString("en-US")} bytes`) +
      ditLine(`            0 Dir(s)   638,976,000 bytes free`) +
      ditLine("");
    out.appendChild(ftr);
    out.scrollTop = out.scrollHeight;
    return;
  }

  // DIR /B
  if (up === "DIR /B") {
    if (!fb.games.length) await loadFbGames();
    const out = document.getElementById("ditOutput");
    const block = document.createElement("div");
    block.innerHTML = ditLine("");
    out.appendChild(block);
    fb.games.forEach(g => {
      const fname = ((g.title || "UNKNOWN") + ".JSDOS").toUpperCase();
      const row = document.createElement("p");
      row.className = "dit-file-row";
      row.innerHTML = `<span class="dit-fname">${escapeHtml(fname)}</span>`;
      row.addEventListener("click", () => {
        if (g.downloadUrl) { closeDosTerminal(); loadBundleFromUrl(g.downloadUrl); trackEvent("dos_terminal_game_launch", { title: g.title }); }
      });
      out.appendChild(row);
    });
    const end = document.createElement("div");
    end.innerHTML = ditLine("");
    out.appendChild(end);
    out.scrollTop = out.scrollHeight;
    return;
  }

  // DIR /W — wide format (4 columns)
  if (up === "DIR /W") {
    if (!fb.games.length) await loadFbGames();
    const names = fb.games.map(g => ((g.title || "UNKNOWN") + ".JSDOS").toUpperCase());
    let html = ditLine("") + ditLine(` Directory of ${dit.currentDir}`) + ditLine("");
    const COL = 4, W = 20;
    for (let i = 0; i < names.length; i += COL) {
      const row = names.slice(i, i + COL).map(n => n.substring(0, W - 1).padEnd(W)).join("");
      html += `<p class="dit-out"> ${escapeHtml(row)}</p>`;
    }
    html += ditLine("") + ditLine(`         ${fb.games.length} File(s)`) + ditLine("");
    ditAppend(html);
    return;
  }

  // Try matching a game filename typed directly
  if (fb.games.length) {
    const stripped = cmd.replace(/\.jsdos$/i, "").toLowerCase();
    const match = fb.games.find(g =>
      g.title?.toLowerCase() === stripped ||
      (g.title?.toLowerCase() + ".jsdos") === cmd.toLowerCase()
    );
    if (match) {
      ditAppend(ditLine(`Starting ${match.title}...`));
      setTimeout(() => { closeDosTerminal(); loadBundleFromUrl(match.downloadUrl); }, 600);
      return;
    }
  }

  ditAppend(ditLine("") + ditLine(`Bad command or file name`, "dit-err") + ditLine(""));
}

function renderFeaturedGameCards(games){
  if(!dom.featuredGameCards)return;
  dom.featuredGameCards.innerHTML="";
  games.forEach(g=>{
    const btn=document.createElement("button");btn.type="button";btn.className="featured-card";btn.title=`Play ${g.title}`;
    const img=document.createElement("img");img.src=g.screenshot||FALLBACK_THUMB;img.alt=g.title;img.loading="lazy";img.addEventListener("error",()=>{img.src=FALLBACK_THUMB;},{once:true});
    const label=document.createElement("span");label.className="featured-card-title";label.textContent=g.title;
    btn.appendChild(img);btn.appendChild(label);
    btn.addEventListener("click",()=>{trackEvent("featured_game_click",{title:g.title});loadBundleFromUrl(g.downloadUrl);});
    dom.featuredGameCards.appendChild(btn);
  });
  dom.featuredGameCards.hidden=false;
}

function setupEventListeners(){
  dom.dropzone?.addEventListener("dragover",e=>{e.preventDefault();dom.dropzone.classList.add("dragging");});
  dom.dropzone?.addEventListener("dragleave",()=>dom.dropzone.classList.remove("dragging"));
  dom.dropzone?.addEventListener("drop",e=>{e.preventDefault();dom.dropzone.classList.remove("dragging");loadUserBundle(e.dataTransfer.files[0]);});
  dom.bundleInput?.addEventListener("change",e=>{loadUserBundle(e.target.files[0]);e.target.value="";});
  dom.loadUrlBtn?.addEventListener("click",()=>loadBundleFromUrl(dom.bundleUrlInput?.value));
  dom.bundleUrlInput?.addEventListener("keydown",e=>{if(e.key==="Enter")loadBundleFromUrl(dom.bundleUrlInput.value);});
  dom.stopBtn?.addEventListener("click",()=>{trackEvent("game_stop");stopCurrent().then(()=>setStatus("Stopped"));});
  dom.saveBtn?.addEventListener("click",saveGameState);
  dom.fullscreenBtn?.addEventListener("click",()=>{trackEvent("fullscreen_toggle",{entering:!document.fullscreenElement});!document.fullscreenElement?dom.playerShell?.requestFullscreen():document.exitFullscreen();});
  dom.soundToggleBtn?.addEventListener("click",toggleSound);
  dom.soundToggleFS?.addEventListener("click",toggleSound);
  dom.openLibraryBtn?.addEventListener("click",openLibrary);
  dom.closeLibraryBtn?.addEventListener("click",closeLibrary);
  dom.openFileBrowserBtn?.addEventListener("click",openInlineBrowser);
  dom.openDosTerminalBtn?.addEventListener("click",openDosTerminal);
  document.getElementById("fbCloseBtn")?.addEventListener("click",closeFileBrowser);
  document.getElementById("fbSearch")?.addEventListener("input",e=>filterFb(e.target.value));
  document.getElementById("ibBackBtn")?.addEventListener("click",closeInlineBrowser);
  document.getElementById("ibSearch")?.addEventListener("input",e=>filterIb(e.target.value));
  document.getElementById("ditCloseBtn")?.addEventListener("click",closeDosTerminal);

  // DOS terminal input
  const ditInput = document.getElementById("ditInput");
  if (ditInput) {
    ditInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const v = ditInput.value;
        ditInput.value = "";
        executeDosCommand(v);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (dit.history.length) {
          dit.histIdx = Math.min(dit.histIdx + 1, dit.history.length - 1);
          ditInput.value = dit.history[dit.histIdx] || "";
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        dit.histIdx = Math.max(dit.histIdx - 1, -1);
        ditInput.value = dit.histIdx >= 0 ? dit.history[dit.histIdx] : "";
      }
    });
  }

  dom.inlineBrowserView?.addEventListener("keydown",e=>{
    if(e.key==="Escape"){closeInlineBrowser();return;}
    if(e.key==="ArrowDown"){e.preventDefault();fb.cursor=Math.min(fb.cursor+1,fb.filtered.length-1);renderIbList();}
    else if(e.key==="ArrowUp"){e.preventDefault();fb.cursor=Math.max(fb.cursor-1,0);renderIbList();}
    else if(e.key==="Enter"){e.preventDefault();if(fb.filtered[fb.cursor])playFbGame(fb.filtered[fb.cursor]);}
  });

  dom.fileBrowserModal?.addEventListener("keydown",e=>{
    if(e.key==="Escape"){closeFileBrowser();return;}
    if(e.key==="ArrowDown"){e.preventDefault();fb.cursor=Math.min(fb.cursor+1,fb.filtered.length-1);renderFbList();}
    else if(e.key==="ArrowUp"){e.preventDefault();fb.cursor=Math.max(fb.cursor-1,0);renderFbList();}
    else if(e.key==="Enter"){e.preventDefault();if(fb.filtered[fb.cursor])playFbGame(fb.filtered[fb.cursor]);}
  });

  const playerDrop=dom.playerShell;
  if(playerDrop){
    playerDrop.addEventListener("dragover",e=>{e.preventDefault();playerDrop.classList.add("player-dragging");});
    playerDrop.addEventListener("dragleave",e=>{if(!playerDrop.contains(e.relatedTarget))playerDrop.classList.remove("player-dragging");});
    playerDrop.addEventListener("drop",e=>{e.preventDefault();playerDrop.classList.remove("player-dragging");loadUserBundle(e.dataTransfer.files[0]);});
  }

  Object.values(settingsFields).forEach(f=>f?.addEventListener("change",()=>{persistSettings();applySoundSetting();syncSoundIndicator();trackEvent("settings_change",{cycles:settingsFields.cycles.value,memsize:settingsFields.memsize.value,sound:settingsFields.sound.value,theme:settingsFields.themeTint.value});}));

  window.addEventListener("message",e=>{
    if(e.data?.type==="launchGame"&&e.data.bundleUrl){closeLibrary();loadBundleFromUrl(e.data.bundleUrl);trackEvent("library_game_launch",{title:e.data.title||""});}
    if(e.data?.type==="closeLibrary")closeLibrary();
  });

  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"){
      if(dom.dosTerminalInteractive&&!dom.dosTerminalInteractive.hidden){e.preventDefault();closeDosTerminal();return;}
      if(dom.inlineBrowserView&&!dom.inlineBrowserView.hidden){e.preventDefault();closeInlineBrowser();return;}
      if(dom.fileBrowserModal&&!dom.fileBrowserModal.hidden){e.preventDefault();closeFileBrowser();return;}
      if(dom.libraryModal&&!dom.libraryModal.hidden){e.preventDefault();closeLibrary();return;}
    }
    if(e.key!=="Enter"&&e.key!==" ")return;
    const tag=document.activeElement?.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return;
    const host=dom.playerHost||document;
    const playBtn=host.querySelector(".play-button")||host.querySelector(".emulator-click-to-start-overlay")||host.querySelector(".emulator-click-to-start-icon")||document.querySelector(".play-button")||document.querySelector(".emulator-click-to-start-overlay");
    if(playBtn){e.preventDefault();if(tag==="BUTTON")document.activeElement.blur();playBtn.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,cancelable:true}));playBtn.dispatchEvent(new PointerEvent("pointerup",{bubbles:true,cancelable:true}));playBtn.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));}
  });
}

window.addEventListener("unhandledrejection",event=>{
  const err=event.reason;
  const isExit=err&&(err.name==="ExitStatus"||(err.message&&err.message.includes("ExitStatus")));
  if(!isExit)return;
  event.preventDefault();
  if(handleExitStatus(err))return;
  const code=err?.status??"?";
  stopCurrent().then(()=>{setStatus(`Game crashed (exit code ${code})`,"error");showGameCrashScreen(`The game exited unexpectedly (error code ${code}).\nThe bundle may be missing files or have a configuration error.`);});
});

document.addEventListener("DOMContentLoaded",async()=>{
  hydrateSettingsUI();setupEventListeners();syncSoundIndicator();
  renderSavesList();
  setStatus("Ready — drop a .jsdos bundle or paste a URL to play","ok");updateUI();
  trackWebVitals();trackScrollDepth();trackEngagement();trackOutboundLinks();
  trackEvent("page_load",{referrer:document.referrer||"direct",screen_width:window.innerWidth,screen_height:window.innerHeight});
  loadFeaturedGames();
  const urlParams=new URLSearchParams(window.location.search);
  const bundleParam=urlParams.get("bundle");
  if(bundleParam)loadBundleFromUrl(bundleParam);
});
