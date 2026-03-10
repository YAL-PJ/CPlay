const statusText = document.getElementById("statusText");
const dropzone = document.getElementById("dropzone");
const bundleInput = document.getElementById("bundleInput");
const bundleUrlInput = document.getElementById("bundleUrl");
const loadUrlBtn = document.getElementById("loadUrlBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const playerHost = document.getElementById("dos-player");

const settingsFields = {
  cycles: document.getElementById("cycles"),
  memsize: document.getElementById("memsize"),
  sound: document.getElementById("sound"),
  themeTint: document.getElementById("themeTint"),
};

const demoBundles = {
  doom: "https://v8.js-dos.com/bundles/doom.jsdos",
  keen: "https://v8.js-dos.com/bundles/keen.jsdos",
  pinball: "https://v8.js-dos.com/bundles/epic-pinball.jsdos",
};

const defaultSettings = {
  cycles: 12000,
  memsize: 16,
  sound: "on",
  themeTint: "amber",
};

let ci = null;
let objectUrl = null;

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "#ff8181" : "#69d086";
}

function readSettings() {
  const stored = localStorage.getItem("cplay.settings");
  return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
}

function persistSettings() {
  const value = {
    cycles: Number(settingsFields.cycles.value) || defaultSettings.cycles,
    memsize: Number(settingsFields.memsize.value) || defaultSettings.memsize,
    sound: settingsFields.sound.value,
    themeTint: settingsFields.themeTint.value,
  };

  localStorage.setItem("cplay.settings", JSON.stringify(value));
  document.body.dataset.tint = value.themeTint;
}

function hydrateSettingsUI() {
  const settings = readSettings();
  settingsFields.cycles.value = settings.cycles;
  settingsFields.memsize.value = settings.memsize;
  settingsFields.sound.value = settings.sound;
  settingsFields.themeTint.value = settings.themeTint;
  document.body.dataset.tint = settings.themeTint;
}

async function stopCurrent() {
  if (ci?.exit) {
    await ci.exit();
  }
  ci = null;

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  playerHost.innerHTML = "";
}

function buildDosboxConf() {
  const settings = readSettings();
  const sb = settings.sound === "on" ? "true" : "false";

  return `
[sdl]
fullscreen=false
fulldouble=true

[dosbox]
memsize=${settings.memsize}

[cpu]
core=auto
cycles=${settings.cycles}

[sblaster]
sbtype=sb16
sbbase=220
irq=7
dma=1
hdma=5
mixer=${sb}
oplmode=auto

[mixer]
nosound=${settings.sound === "on" ? "false" : "true"}
rate=44100
blocksize=2048
prebuffer=40
`;
}

async function startDos(bundleUrl) {
  setStatus("Starting emulator...");
  await stopCurrent();

  const conf = buildDosboxConf();

  try {
    ci = await window.Dos(playerHost, {
      url: bundleUrl,
      autoStart: true,
      kiosk: true,
      dosboxConf: conf,
    });
  } catch {
    ci = await window.Dos(playerHost, { kiosk: true, dosboxConf: conf });
    if (ci?.run) {
      await ci.run(bundleUrl);
    }
  }

  setStatus("Running. Press Ctrl+F10 to release mouse.");
}

async function loadUserBundle(file) {
  if (!file) return;

  const isZipLike = file.name.toLowerCase().endsWith(".jsdos") || file.name.toLowerCase().endsWith(".zip");

  if (!isZipLike) {
    setStatus("Please choose a .jsdos or .zip bundle.", true);
    return;
  }

  objectUrl = URL.createObjectURL(file);
  setStatus(`Loading ${file.name}...`);
  await startDos(objectUrl);
}

function normalizeGithubUrl(urlValue) {
  try {
    const url = new URL(urlValue);
    const parts = url.pathname.split("/").filter(Boolean);

    if (url.hostname !== "github.com" || parts.length < 2) {
      return urlValue;
    }

    const [owner, repo, mode, branch, ...rest] = parts;

    if (mode === "blob" && branch && rest.length > 0) {
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`;
    }

    if (mode === "raw" && branch && rest.length > 0) {
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`;
    }

    if (!mode) {
      return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/main`;
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
      const fileIdFromPath = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
      const fileId = fileIdFromPath || url.searchParams.get("id");

      if (fileId) {
        return {
          finalUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
          note: "Converted Google Drive share link to direct download URL.",
        };
      }
    }

    if (url.hostname.endsWith("dropbox.com")) {
      url.searchParams.set("dl", "1");
      return {
        finalUrl: url.toString(),
        note: "Converted Dropbox share link to direct download URL.",
      };
    }

    if (url.hostname === "1drv.ms" || url.hostname.includes("onedrive")) {
      const onedriveUrl = new URL(urlValue);
      onedriveUrl.searchParams.set("download", "1");
      return {
        finalUrl: onedriveUrl.toString(),
        note: "Attempted to convert OneDrive link to a direct download URL.",
      };
    }
  } catch {
    return { finalUrl: urlValue, note: "" };
  }

  return { finalUrl: urlValue, note: "" };
}

async function resolveGithubRepoArchive(urlValue) {
  const url = new URL(urlValue);
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.hostname !== "github.com" || parts.length < 2 || parts.length > 2) {
    return normalizeGithubUrl(urlValue);
  }

  const [owner, repo] = parts;
  const api = `https://api.github.com/repos/${owner}/${repo}`;

  const response = await fetch(api, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) {
    return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/main`;
  }

  const data = await response.json();
  const branch = data.default_branch || "main";
  return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;
}

async function loadBundleFromUrl(rawUrl) {
  if (!rawUrl) {
    setStatus("Paste a URL first.", true);
    return;
  }

  const typedUrl = rawUrl.trim();
  if (!typedUrl.startsWith("http://") && !typedUrl.startsWith("https://")) {
    setStatus("URL must start with http:// or https://", true);
    return;
  }

  let finalUrl = normalizeGithubUrl(typedUrl);
  let transformNote = "";
  try {
    if (typedUrl.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/i)) {
      finalUrl = await resolveGithubRepoArchive(typedUrl);
      transformNote = "Resolved GitHub repo URL to default-branch archive.";
    }

    const cloudTransform = transformCloudDriveUrl(finalUrl);
    finalUrl = cloudTransform.finalUrl;
    transformNote = transformNote || cloudTransform.note;

    setStatus("Loading bundle from URL (no manual download needed)...");
    await startDos(finalUrl);
    if (transformNote) {
      setStatus(`Running. ${transformNote}`);
    }
  } catch (error) {
    setStatus(
      `Could not load URL (${error.message}). Check direct-link format/CORS. If blocked, download locally then upload here.`,
      true,
    );
  }
}

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragging");
});

dropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  const [file] = event.dataTransfer.files;
  await loadUserBundle(file);
});

bundleInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  await loadUserBundle(file);
  event.target.value = "";
});

loadUrlBtn.addEventListener("click", async () => {
  await loadBundleFromUrl(bundleUrlInput.value);
});

bundleUrlInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    await loadBundleFromUrl(bundleUrlInput.value);
  }
});

document.querySelectorAll(".demo-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const key = button.dataset.demo;
    const url = demoBundles[key];

    if (!url) {
      setStatus("Demo not configured.", true);
      return;
    }

    setStatus(`Loading ${button.textContent}...`);
    await startDos(url);
  });
});

Object.values(settingsFields).forEach((field) => {
  field.addEventListener("change", persistSettings);
});

fullscreenBtn.addEventListener("click", async () => {
  const shell = document.getElementById("playerShell");
  if (!document.fullscreenElement) {
    await shell.requestFullscreen();
    return;
  }
  await document.exitFullscreen();
});

window.addEventListener("beforeunload", () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});

hydrateSettingsUI();
setStatus("Ready. Load a bundle or try a demo game.");
