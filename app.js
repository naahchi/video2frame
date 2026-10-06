const videoInput = document.getElementById("videoInput");
const fileLabel = document.getElementById("fileLabel");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const fpsSelect = document.getElementById("fps");
const formatSelect = document.getElementById("format");
const quality = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");
const extractBtn = document.getElementById("extractBtn");
const downloadZipBtn = document.getElementById("downloadZipBtn");
const clearBtn = document.getElementById("clearBtn");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");
const framesEl = document.getElementById("frames");
const frameCount = document.getElementById("frameCount");

let videoURL = null;
let frames = [];
let busy = false;

quality.addEventListener("input", () => qualityValue.textContent = quality.value);

videoInput.addEventListener("change", () => {
  const file = videoInput.files[0];
  if (!file) return;
  if (videoURL) URL.revokeObjectURL(videoURL);
  videoURL = URL.createObjectURL(file);
  video.src = videoURL;
  fileLabel.textContent = file.name;
  extractBtn.disabled = false;
  downloadZipBtn.disabled = true;
  frames = [];
  renderFrames();
  setProgress(0, "Video loaded. Ready to extract.");
});

function setProgress(percent, text) {
  progressBar.style.width = `${percent}%`;
  statusText.textContent = text;
}

function waitForMetadata() {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && Number.isFinite(video.duration)) return resolve();
    video.addEventListener("loadedmetadata", resolve, {once:true});
    video.addEventListener("error", reject, {once:true});
  });
}

function seekTo(time) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("Could not seek video")); };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.0001));
  });
}

function extension() {
  return formatSelect.value === "image/jpeg" ? "jpg" :
         formatSelect.value === "image/webp" ? "webp" : "png";
}

function canvasBlob() {
  return new Promise(resolve => {
    const q = Number(quality.value);
    canvas.toBlob(resolve, formatSelect.value, q);
  });
}

function renderFrames() {
  framesEl.innerHTML = "";
  frameCount.textContent = frames.length;
  frames.forEach((f, i) => {
    const box = document.createElement("div");
    box.className = "frame";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(f.blob);
    const small = document.createElement("small");
    small.textContent = `${String(i + 1).padStart(4, "0")} · ${f.time.toFixed(3)}s`;
    box.append(img, small);
    framesEl.appendChild(box);
  });
}

extractBtn.addEventListener("click", async () => {
  if (busy || !video.src) return;
  busy = true;
  extractBtn.disabled = true;
  downloadZipBtn.disabled = true;
  frames = [];
  renderFrames();

  try {
    await waitForMetadata();
    const fps = Number(fpsSelect.value);
    const duration = video.duration;
    const total = Math.max(1, Math.ceil(duration * fps));

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", {alpha:false});

    for (let i = 0; i < total; i++) {
      const time = Math.min(i / fps, Math.max(0, duration - 0.0001));
      await seekTo(time);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvasBlob();
      if (!blob) throw new Error("Could not create image");
      frames.push({blob, time});

      const pct = ((i + 1) / total) * 100;
      setProgress(pct, `Extracting frame ${i + 1} of ${total}…`);
      if ((i + 1) % 5 === 0 || i === total - 1) renderFrames();
      await new Promise(r => setTimeout(r, 0));
    }

    renderFrames();
    setProgress(100, `Done. ${frames.length} frames extracted.`);
    downloadZipBtn.disabled = frames.length === 0;
  } catch (err) {
    console.error(err);
    setProgress(0, `Error: ${err.message}`);
  } finally {
    busy = false;
    extractBtn.disabled = false;
  }
});

downloadZipBtn.addEventListener("click", async () => {
  if (!frames.length || typeof JSZip === "undefined") return;
  downloadZipBtn.disabled = true;
  setProgress(0, "Creating ZIP…");

  const zip = new JSZip();
  const folder = zip.folder("frames");
  const ext = extension();

  frames.forEach((f, i) => {
    const name = `frame_${String(i + 1).padStart(4, "0")}.${ext}`;
    folder.file(name, f.blob);
  });

  const blob = await zip.generateAsync(
    {type:"blob", compression:"DEFLATE", compressionOptions:{level:6}},
    meta => setProgress(meta.percent, `Creating ZIP… ${meta.percent.toFixed(0)}%`)
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "video_frames.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);

  setProgress(100, `ZIP ready. ${frames.length} frames included.`);
  downloadZipBtn.disabled = false;
});

clearBtn.addEventListener("click", () => {
  if (videoURL) URL.revokeObjectURL(videoURL);
  videoURL = null;
  video.removeAttribute("src");
  video.load();
  videoInput.value = "";
  fileLabel.textContent = "Choose a video";
  frames = [];
  renderFrames();
  extractBtn.disabled = true;
  downloadZipBtn.disabled = true;
  setProgress(0, "Choose a video to begin.");
});
