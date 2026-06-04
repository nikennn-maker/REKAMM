// ============================================
//  MEMORIPITA — script.js
//  Retro Voice Recorder
// ============================================

// --- Referensi elemen ---
const views = {
  welcome: document.getElementById("view-welcome"),
  selectTape: document.getElementById("view-select-tape"),
  studio: document.getElementById("view-studio"),
  share: document.getElementById("view-share"),
};

// Peta gambar tape — sesuaikan dengan nama file di folder assets/ milikmu
const tapeImages = {
  tape1: "assets/tape1.png",
  tape2: "assets/tape2.png",
  tape3: "assets/tape3.png",
  tape4: "assets/tape4.png",
  tape5: "assets/tape5.png",
  tape6: "assets/tape6.png",
};

// --- State ---
let selectedTape = null;
let selectedTapeName = "";
let mediaRecorder = null;
let audioChunks = [];
let audioBase64 = "";
let audioObj = null;
let isRecording = false;
let isPlaying = false;
let timerInterval = null;
let timerSec = 0;
let analyser = null;
let audioCtx = null;
let vuRafId = null;

// ============================================
//  NAVIGASI / SWITCH VIEW
// ============================================

function showView(name) {
  Object.values(views).forEach((v) => v.classList.remove("active"));
  views[name].classList.add("active");
}

// Welcome → Pilih Tape
document.getElementById("btnStart").addEventListener("click", () => {
  showView("selectTape");
});

// Pilih Tape → Welcome
document.getElementById("btnBackToWelcome").addEventListener("click", () => {
  showView("welcome");
});

// Studio → Pilih Tape
document.getElementById("btnBackToTape").addEventListener("click", () => {
  stopAll();
  showView("selectTape");
});

// Buat Milikmu (dari Share) → Welcome
document.getElementById("btnMakeOwn").addEventListener("click", () => {
  // Bersihkan URL params agar tidak langsung masuk share lagi
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.pushState({}, "", cleanUrl);
  showView("welcome");
});

// ============================================
//  PILIH TAPE
// ============================================

document.querySelectorAll(".tape-card").forEach((card) => {
  card.addEventListener("click", () => {
    document
      .querySelectorAll(".tape-card")
      .forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    selectedTape = card.dataset.tape;
    selectedTapeName = card.dataset.name;

    const bar = document.getElementById("confirmBar");
    bar.classList.remove("hidden");
  });
});

document.getElementById("btnGoStudio").addEventListener("click", () => {
  if (!selectedTape) return;

  // Set gambar tape di studio
  const img = document.getElementById("selectedTapeImg");
  img.src = tapeImages[selectedTape] || "";

  document.getElementById("studioTapeName").textContent =
    selectedTapeName.toUpperCase();
  document.getElementById("tapeNameDisplay").textContent =
    selectedTapeName.toUpperCase();

  resetStudio();
  showView("studio");
});

// ============================================
//  TIMER
// ============================================

function startTimer() {
  timerSec = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSec++;
    const m = String(Math.floor(timerSec / 60)).padStart(2, "0");
    const s = String(timerSec % 60).padStart(2, "0");
    document.getElementById("timerDisplay").textContent = m + ":" + s;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function resetTimer() {
  stopTimer();
  timerSec = 0;
  document.getElementById("timerDisplay").textContent = "00:00";
}

// ============================================
//  VU METER
// ============================================

function animateVUFromAnalyser() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const step = Math.floor(data.length / 9);
  for (let i = 0; i < 9; i++) {
    const val = (data[i * step] / 255) * 100;
    updateVUBar(i, val);
  }
  vuRafId = requestAnimationFrame(animateVUFromAnalyser);
}

function animateVURandom() {
  for (let i = 0; i < 9; i++) {
    const val = Math.random() * 65 + 15;
    updateVUBar(i, val);
  }
}

function updateVUBar(i, val) {
  const el = document.getElementById("vu" + i);
  if (!el) return;
  el.style.height = val + "%";
  if (val > 75) el.style.background = "#cc0000";
  else if (val > 42) el.style.background = "#c8a84b";
  else el.style.background = "var(--maroon)";
}

function clearVU() {
  cancelAnimationFrame(vuRafId);
  for (let i = 0; i < 9; i++) {
    const el = document.getElementById("vu" + i);
    if (el) {
      el.style.height = "5%";
      el.style.background = "#1a1a1a";
    }
  }
}

// ============================================
//  RECORD
// ============================================

document.getElementById("btnRecord").addEventListener("click", async () => {
  audioChunks = [];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Setup Web Audio analyser untuk VU meter real-time
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, {
        type: "audio/webm",
      });

      // Konversi ke Base64 untuk bisa dimasukkan ke URL share
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        audioBase64 = reader.result;
        document.getElementById("btnShare").classList.remove("hidden");
      };

      setStudioState("ready");
    };

    mediaRecorder.start();
    isRecording = true;
    setStudioState("recording");
    startTimer();
    animateVUFromAnalyser();
  } catch (err) {
    showToast("⚠ Akses mikrofon ditolak!");
    console.error(err);
  }
});

// ============================================
//  STOP
// ============================================

document.getElementById("btnStop").addEventListener("click", () => {
  if (isRecording && mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    isRecording = false;
    stopTimer();
    clearVU();
    analyser = null;
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
  } else if (isPlaying && audioObj) {
    audioObj.pause();
    audioObj.currentTime = 0;
    isPlaying = false;
    stopTimer();
    clearVU();
    setStudioState("ready");
  }
});

// ============================================
//  PLAY
// ============================================

document.getElementById("btnPlay").addEventListener("click", () => {
  if (!audioObj) return;

  audioObj.play();
  isPlaying = true;
  setStudioState("playing");
  startTimer();

  // VU meter animasi random saat playback (tidak ada analyser)
  let vuPlayInterval = setInterval(() => {
    if (!isPlaying) {
      clearInterval(vuPlayInterval);
      return;
    }
    animateVURandom();
  }, 120);

  // Sync timer dengan durasi audio aktual
  audioObj.ontimeupdate = () => {
    const m = String(Math.floor(audioObj.currentTime / 60)).padStart(2, "0");
    const s = String(Math.floor(audioObj.currentTime % 60)).padStart(2, "0");
    document.getElementById("timerDisplay").textContent = m + ":" + s;
  };

  audioObj.onended = () => {
    isPlaying = false;
    clearInterval(vuPlayInterval);
    stopTimer();
    clearVU();
    setStudioState("ready");
  };
});

// ============================================
//  SET STATE UI STUDIO
// ============================================

function setStudioState(state) {
  const btnRec = document.getElementById("btnRecord");
  const btnStop = document.getElementById("btnStop");
  const btnPlay = document.getElementById("btnPlay");
  const mode = document.getElementById("modeValue");
  const signal = document.getElementById("signalValue");
  const msg = document.getElementById("statusMsg");
  const led1 = document.getElementById("led1");
  const led2 = document.getElementById("led2");
  const reel1 = document.getElementById("reel1");
  const reel2 = document.getElementById("reel2");

  // Reset semua
  btnRec.classList.remove("active");
  btnPlay.classList.remove("active");
  led1.className = "led";
  led2.className = "led";
  reel1.className = "reel";
  reel2.className = "reel";
  mode.className = "status-value";

  if (state === "recording") {
    btnRec.disabled = true;
    btnStop.disabled = false;
    btnPlay.disabled = true;
    btnRec.classList.add("active");
    mode.textContent = "REC";
    mode.className = "status-value mode-rec";
    signal.textContent = "LIVE";
    msg.textContent = "🔴 Mengunci suara & memori...";
    led1.classList.add("on-record");
    reel1.classList.add("spinning");
    reel2.classList.add("spinning-slow");
  } else if (state === "playing") {
    btnRec.disabled = true;
    btnStop.disabled = false;
    btnPlay.disabled = true;
    btnPlay.classList.add("active");
    mode.textContent = "PLAY";
    mode.className = "status-value mode-play";
    signal.textContent = "OUTPUT";
    msg.textContent = "▶ Memutar memori pita...";
    led2.classList.add("on-play");
    reel1.classList.add("spinning-slow");
    reel2.classList.add("spinning");
  } else {
    // STANDBY / ready
    btnRec.disabled = false;
    btnStop.disabled = true;
    btnPlay.disabled = !audioObj;
    mode.textContent = "STANDBY";
    signal.textContent = audioObj ? "LOADED" : "—";
    msg.textContent = audioObj
      ? "Kenangan terekam sempurna!"
      : "Siap merekam kenanganmu...";
  }
}

// ============================================
//  RESET STUDIO
// ============================================

function resetStudio() {
  stopAll();
  audioObj = null;
  audioBase64 = "";
  audioChunks = [];
  document.getElementById("btnShare").classList.add("hidden");
  resetTimer();
  clearVU();
  setStudioState("ready");
}

function stopAll() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  if (audioObj) {
    audioObj.pause();
    audioObj.currentTime = 0;
  }
  isRecording = false;
  isPlaying = false;
  stopTimer();
  clearVU();
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}

// ============================================
//  GENERATE & SALIN LINK SHARE
// ============================================

document.getElementById("btnShare").addEventListener("click", () => {
  if (!audioBase64) return;

  // URL base = origin + path (tanpa query lama)
  const base = window.location.origin + window.location.pathname;
  const url = `${base}?tape=${selectedTape}&audio=${encodeURIComponent(audioBase64)}`;

  navigator.clipboard
    .writeText(url)
    .then(() => showToast("✓ Link berhasil disalin! Bagikan ke temanmu."))
    .catch(() => {
      // Fallback manual copy
      prompt("Salin link ini secara manual:", url);
    });
});

// ============================================
//  SHARE PLAYER (halaman penerima)
// ============================================

let shareAudio = null;
let shareIsPlaying = false;

const btnSharePlay = document.getElementById("btnSharePlay");
const shareCassette = document.getElementById("shareCassette"); // bisa null
const shareReel1 = document.getElementById("shareReel1");
const shareReel2 = document.getElementById("shareReel2");
const shareStatus = document.getElementById("shareStatusText");
const progressFill = document.getElementById("progressFill");

btnSharePlay.addEventListener("click", () => {
  if (!shareAudio) return;

  if (!shareIsPlaying) {
    shareAudio.play();
    shareIsPlaying = true;
    btnSharePlay.textContent = "⏸";
    shareStatus.textContent = "MEMUTAR...";
    shareReel1.classList.add("spin");
    shareReel2.classList.add("spin");

    shareAudio.ontimeupdate = () => {
      const pct = (shareAudio.currentTime / shareAudio.duration) * 100 || 0;
      progressFill.style.width = pct + "%";
    };

    shareAudio.onended = () => {
      shareIsPlaying = false;
      btnSharePlay.textContent = "▶";
      shareStatus.textContent = "SELESAI DIPUTAR";
      shareReel1.classList.remove("spin");
      shareReel2.classList.remove("spin");
      progressFill.style.width = "100%";
    };
  } else {
    shareAudio.pause();
    shareIsPlaying = false;
    btnSharePlay.textContent = "▶";
    shareStatus.textContent = "DIJEDA";
    shareReel1.classList.remove("spin");
    shareReel2.classList.remove("spin");
  }
});

// ============================================
//  CEK URL PARAMS — share atau biasa?
// ============================================

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const sTape = params.get("tape");
  const sAudio = params.get("audio");

  if (sTape && sAudio) {
    // Mode share: tampilkan player
    showView("share");

    const shareImg = document.getElementById("shareTapeImg");
    shareImg.src = tapeImages[sTape] || "";

    shareAudio = new Audio(decodeURIComponent(sAudio));
  } else {
    // Mode normal: tampilkan welcome
    showView("welcome");
  }
});

// ============================================
//  TOAST NOTIFIKASI
// ============================================

function showToast(msg, duration = 3200) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}
