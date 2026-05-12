const socket = io({
  transports: ["websocket", "polling"]
});

/* ===== MOBILE CUSTOM KEYPAD ===== */

function handleVirtualKey(key) {
  if (!els.guessInput || els.guessInput.disabled) return;

  let value = els.guessInput.value || "";

  if (key === "BACKSPACE") {
    els.guessInput.value = value.slice(0, -1);
    return;
  }

  const max = Number(els.guessInput.maxLength || 6);

  if (value.length >= max) return;

  els.guessInput.value += key.toUpperCase();
}

function submitVirtualGuess() {
  if (els.submitBtn && !els.submitBtn.disabled) {
    els.submitBtn.click();
  }
}

function setupMobileKeypad() {
  if (!els.keyButtons) return;

  els.keyButtons.forEach((btn) => {
    btn.setAttribute("type", "button");

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const key = btn.dataset.key;
      const action = btn.dataset.action;

      if (navigator.vibrate) {
        navigator.vibrate(12);
      }

      if (action === "backspace") {
        handleVirtualKey("BACKSPACE");
        return;
      }

      if (action === "submit") {
        submitVirtualGuess();
        return;
      }

      if (key) {
        handleVirtualKey(key);
      }
    });
  });
}
let playerId = localStorage.getItem("playerId");

if (!playerId) {
  playerId = "player-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem("playerId", playerId);
}

let previousBoard = [];
let flipLock = false;
let finalTriggered = false;
let lastFinalDramaKey = "";
const state = { selfId: null, roomCode: "", room: null };
let prevRoomSnapshot = null;

const els = {
  nameInput: document.getElementById("nameInput"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  
  topScoreBar: document.getElementById("topScoreBar"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  roomCodeDisplay: document.getElementById("roomCodeDisplay"),
  playersList: document.getElementById("playersList"),
  scoreList: document.getElementById("scoreList"),
  startRoundBtn: document.getElementById("startRoundBtn"),
  copyCodeBtn: document.getElementById("copyCodeBtn"),
  shareCodeBtn: document.getElementById("shareCodeBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  board: document.getElementById("board"),
  statusTitle: document.getElementById("statusTitle"),
  statusSub: document.getElementById("statusSub"),
  turnPill: document.getElementById("turnPill"),
  timerPill: document.getElementById("timerPill"),
  timerBar: document.getElementById("timerBar"),
  guessInput: document.getElementById("guessInput"),
  submitBtn: document.getElementById("submitBtn"),
  clearBtn: document.getElementById("clearBtn"),
  notice: document.getElementById("notice"),
  mobileKeypad: document.getElementById("mobileKeypad"),
  keyButtons: document.querySelectorAll(".key-btn"),
};

const audio = {
  ready: false,
  ctx: null,
  gain: null,
  volume: 2.2,
  warnedAt: new Set(),
  overlay: null
};

function ensureAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return false;
  if (!audio.ctx) audio.ctx = new AudioCtx();
  if (!audio.gain) {
    audio.gain = audio.ctx.createGain();
    audio.gain.gain.value = audio.volume;
    audio.gain.connect(audio.ctx.destination);
  }
  return true;
}

function beep(freq = 880, duration = 0.12, type = "square", volume = 0.08, delay = 0) {
  if (!audio.ready || !audio.ctx || !audio.gain) return;
  const t = audio.ctx.currentTime + delay;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume * 3, t);
  gain.gain.linearRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(audio.gain);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

async function unlockAudio(playTest = true) {
  if (!ensureAudio()) return false;
  try {
    if (audio.ctx.state === "suspended") await audio.ctx.resume();
    audio.ready = true;
    if (playTest) {
      beep(760, 0.10, "square", 0.14);
      beep(1040, 0.12, "square", 0.18, 0.09);
    }
    if (audio.overlay) audio.overlay.style.display = "none";
    return true;
  } catch {
    return false;
  }
}

function playTick() { beep(600, 0.055, "square", 0.14); beep(460, 0.04, "square", 0.10, 0.018); }
function playTypeSound() { beep(740, 0.06, "square", 0.16); beep(620, 0.03, "square", 0.08, 0.015); }
function playSubmitSound() { beep(780, 0.06, "square", 0.11); }
function playStartSound() { beep(620, 0.09, "square", 0.14); beep(900, 0.13, "square", 0.18, 0.11); }

function playPlayerJoinedSound() {
  beep(523, 0.10, "triangle", 0.18);
  beep(659, 0.10, "triangle", 0.18, 0.12);
  beep(784, 0.12, "triangle", 0.20, 0.24);
} 
function playFlipSound() {
  beep(430, 0.03, "square", 0.05);
  beep(650, 0.10, "square", 0.07, 0.04); 
}
function playTurnSound() { beep(760, 0.06, "triangle", 0.08); beep(1020, 0.09, "triangle", 0.10, 0.07); }
function playWarnSound() { beep(980, 0.10, "square", 0.13); }
function playLastFiveSound() { beep(1340, 0.17, "square", 0.17); beep(1000, 0.13, "square", 0.17, 0.05); }
function playWinSound() {
  // langere win-tune
  beep(523, 0.12, "triangle", 0.20);
  beep(659, 0.12, "triangle", 0.22, 0.12);
  beep(784, 0.14, "triangle", 0.24, 0.26);
  beep(1046, 0.18, "triangle", 0.26, 0.43);

  // extra feestlaag
  beep(784, 0.10, "square", 0.12, 0.65);
  beep(988, 0.12, "square", 0.13, 0.78);
  beep(1318, 0.20, "triangle", 0.24, 0.95);

  // afsluiter
  beep(1046, 0.16, "triangle", 0.22, 1.25);
  beep(1318, 0.28, "triangle", 0.26, 1.45);
}
function playEndSound() {
  // diepe buzz
  beep(120, 0.30, "sawtooth", 0.30);
  beep(90, 0.35, "sawtooth", 0.35, 0.10);

  // korte “fail tik”
  beep(300, 0.08, "square", 0.18, 0.25);
}

function playErrorSound() {
  beep(150, 0.12, "sawtooth", 0.12);
  beep(110, 0.18, "sawtooth", 0.13, 0.10);
}

function playPauseSound() { beep(420, 0.08, "square", 0.10); beep(320, 0.12, "square", 0.10, 0.08); }
function playResumeSound() { beep(520, 0.08, "square", 0.10); beep(760, 0.12, "square", 0.11, 0.08); }

function installAudioOverlay() {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(2,6,23,.82)";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "20px";

  const box = document.createElement("div");
  box.style.width = "min(430px, 100%)";
  box.style.background = "#0f1a2d";
  box.style.border = "1px solid rgba(159,176,199,.2)";
  box.style.borderRadius = "18px";
  box.style.padding = "22px";
  box.style.color = "#fff";
  box.style.textAlign = "center";

  const title = document.createElement("div");
  title.textContent = "Tik voor geluid";
  title.style.fontSize = "28px";
  title.style.fontWeight = "900";
  title.style.marginBottom = "10px";

  const sub = document.createElement("div");
  sub.textContent = "Doe dit op elk apparaat apart. Daarna hoor je typen, tikken, countdown en winst op dat apparaat.";
  sub.style.fontSize = "15px";
  sub.style.opacity = "0.9";
  sub.style.marginBottom = "16px";

  const btn = document.createElement("button");
  btn.textContent = "GELUID AAN";
  btn.style.border = "0";
  btn.style.borderRadius = "14px";
  btn.style.padding = "14px 18px";
  btn.style.fontSize = "18px";
  btn.style.fontWeight = "900";
  btn.style.cursor = "pointer";
  btn.style.background = "#22c55e";
  btn.style.color = "#05260f";
  btn.style.width = "100%";

  const note = document.createElement("div");
  note.textContent = "Je hoort meteen een testpiep als het lukt.";
  note.style.marginTop = "12px";
  note.style.fontSize = "13px";
  note.style.opacity = "0.85";

  btn.addEventListener("click", async () => {
    const ok = await unlockAudio(true);
    if (!ok) note.textContent = "Geluid ging nog niet aan. Tik nog een keer.";
  });

  box.appendChild(title);
  box.appendChild(sub);
  box.appendChild(btn);
  box.appendChild(note);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  audio.overlay = overlay;
}

  function playFinalWrongDrama() {
  
  const round = state.room?.round;
  const key = `${round?.target || round?.revealWord || ""}-${round?.timeLeft || ""}-${round?.message || ""}`;

  if (lastFinalDramaKey === key) return;
  lastFinalDramaKey = key;

  console.log("🔥 FINAL WRONG DRAMA START");

  if (navigator.vibrate) {
  navigator.vibrate(0); // oude trilling resetten

  setTimeout(() => {
    navigator.vibrate([300, 120, 300, 120, 700]);
  }, 50);

  setTimeout(() => {
    navigator.vibrate([200, 80, 500]);
  }, 900);
}

  playEndSound();
  playEndSound();

 
  if (!round || !round.board) return;

  const lastRowIndex = round.board.length - 1;
  const rows = document.querySelectorAll(".board-row");
  const lastRowEl = rows[lastRowIndex];
  const boardEl = document.querySelector(".board");

  if (lastRowEl) {
    lastRowEl.classList.remove("final-wrong-flash");
    void lastRowEl.offsetWidth;
    lastRowEl.classList.add("final-wrong-flash");

    setTimeout(() => {
      lastRowEl.classList.remove("final-wrong-flash");
    }, 1400);
  }

  if (boardEl) {
    boardEl.classList.remove("final-shake");
    void boardEl.offsetWidth;
    boardEl.classList.add("final-shake");

    setTimeout(() => {
      boardEl.classList.remove("final-shake");
    }, 1200);
  }

  setTimeout(() => {
    finalTriggered = false;
  }, 2500);
}

function showGameOver(title, text) {
  let overlay = document.getElementById("gameOverOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "gameOverOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(2,6,23,.78)";
    overlay.style.zIndex = "9500";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "20px";

    const box = document.createElement("div");
    box.style.width = "min(460px, 100%)";
    box.style.background = "#0f1a2d";
    box.style.border = "1px solid rgba(159,176,199,.2)";
    box.style.borderRadius = "18px";
    box.style.padding = "24px";
    box.style.color = "#fff";
    box.style.textAlign = "center";
    box.style.boxShadow = "0 18px 40px rgba(0,0,0,.35)";

    const titleEl = document.createElement("div");
    titleEl.id = "gameOverTitle";
    titleEl.style.fontSize = "30px";
    titleEl.style.fontWeight = "900";
    titleEl.style.marginBottom = "12px";

    const textEl = document.createElement("div");
    textEl.id = "gameOverText";
    textEl.style.fontSize = "16px";
    textEl.style.lineHeight = "1.5";
    textEl.style.opacity = "0.95";
    textEl.style.marginBottom = "18px";

    const btn = document.createElement("button");
    btn.textContent = "SLUIT";
    btn.style.border = "0";
    btn.style.borderRadius = "14px";
    btn.style.padding = "12px 16px";
    btn.style.fontSize = "16px";
    btn.style.fontWeight = "900";
    btn.style.cursor = "pointer";
    btn.style.background = "#38bdf8";
    btn.style.color = "#062033";
    btn.addEventListener("click", () => { overlay.style.display = "none"; });

    box.appendChild(titleEl);
    box.appendChild(textEl);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  document.getElementById("gameOverTitle").textContent = title;
  document.getElementById("gameOverText").textContent = text;
  overlay.style.display = "flex";
}

function hideGameOver() {
  const overlay = document.getElementById("gameOverOverlay");
  if (overlay) overlay.style.display = "none";
}

function showPauseOverlay(text) {
  let overlay = document.getElementById("pauseOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pauseOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(2,6,23,.58)";
    overlay.style.zIndex = "9400";
    overlay.style.pointerEvents = "none";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "20px";

    const box = document.createElement("div");
    box.style.width = "min(420px, 100%)";
    box.style.background = "#0f1a2d";
    box.style.border = "1px solid rgba(159,176,199,.2)";
    box.style.borderRadius = "18px";
    box.style.padding = "22px";
    box.style.color = "#fff";
    box.style.textAlign = "center";
    box.style.boxShadow = "0 18px 40px rgba(0,0,0,.35)";
    box.innerHTML = '<div style="font-size:30px;font-weight:900;margin-bottom:10px">PAUZE</div><div id="pauseOverlayText" style="font-size:16px;opacity:.92"></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
  const textEl = document.getElementById("pauseOverlayText");
  if (textEl) textEl.textContent = text || "Spel gepauzeerd";
  overlay.style.display = "flex";
}

function hidePauseOverlay() {
  const overlay = document.getElementById("pauseOverlay");
  if (overlay) overlay.style.display = "none";
}

let confettiTimer = null;

function clearConfetti() {
  document.querySelectorAll('.confetti-piece').forEach((el) => el.remove());
  if (confettiTimer) {
    clearTimeout(confettiTimer);
    confettiTimer = null;
  }
}

function launchConfetti() {
  clearConfetti();
  const total = 260;
  for (let i = 0; i < total; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.position = 'fixed';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.top = '-12px';
    piece.style.width = `${6 + Math.random() * 6}px`;
    piece.style.height = `${10 + Math.random() * 8}px`;
    piece.style.opacity = '0.95';
    piece.style.pointerEvents = 'none';
    piece.style.zIndex = '9600';
    piece.style.borderRadius = '2px';
    piece.style.background = `hsl(${Math.random() * 360}, 100%, ${48 + Math.random() * 12}%)`;
    piece.style.transform = `translateY(0) rotate(${Math.random() * 360}deg)`;
    piece.style.transition = `transform ${2.4 + Math.random() * 1.8}s linear, opacity ${2.8 + Math.random() * 1.2}s ease-out`;
    document.body.appendChild(piece);
    requestAnimationFrame(() => {
      const x = (Math.random() - 0.5) * 180;
      const y = window.innerHeight + 120 + Math.random() * 240;
      const r = (Math.random() - 0.5) * 900;
      piece.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
      piece.style.opacity = '0.15';
    });
  }
  confettiTimer = setTimeout(clearConfetti, 7000);
}

function setNotice(text = "", type = "") {
  els.notice.textContent = text;
  els.notice.className = "notice" + (type ? ` ${type}` : "");
}

function getName() {
  return (els.nameInput.value || "").trim().slice(0, 20) || "Speler";
}

function setActiveByData(selector, value, key) {
  document.querySelectorAll(selector).forEach((btn) => btn.classList.toggle("active", String(btn.dataset[key]) === String(value)));
}

function isHost() {
  return !!(state.room && state.selfId && state.room.hostId === state.selfId);
}

function buildBoard(wordLength = 5, boardState = null) {
  if (flipLock) return;

  els.board.innerHTML = "";
  els.board.className = `board len-${wordLength}`;

  const rows = 5;
  const board = boardState && boardState.length
    ? boardState
    : Array.from({ length: rows }, () =>
        Array.from({ length: wordLength }, () => ({ letter: "", state: "" }))
      );

  const hasPrevious = previousBoard && previousBoard.length;
  let flipRowIndex = -1;

  if (hasPrevious) {
    board.forEach((row, rowIndex) => {
      const prevRow = previousBoard[rowIndex] || [];
      const changed = JSON.stringify(row) !== JSON.stringify(prevRow);
      const hasStates = row.some((cell) => cell.state);
      if (changed && hasStates) flipRowIndex = rowIndex;
    });
  }

board.forEach((row, rowIndex) => {
  const rowEl = document.createElement("div");
  rowEl.className = "board-row";

  const prevRow = previousBoard[rowIndex] || [];

  row.forEach((cell, cellIndex) => {
    const cellEl = document.createElement("div");
    cellEl.className = "cell";

    const prevCell = prevRow[cellIndex] || {};
    const shouldFlip = rowIndex === flipRowIndex && cell.state;

    if (shouldFlip) {
      cellEl.textContent = prevCell.letter || "";
      if (prevCell.state) cellEl.classList.add(prevCell.state);
    } else {
      cellEl.textContent = cell.letter || "";
      if (cell.state) cellEl.classList.add(cell.state);
    }

    if (shouldFlip) {
      flipLock = true;

      setTimeout(() => {
        playFlipSound();
        cellEl.classList.add("flip");

        setTimeout(() => {
          cellEl.textContent = cell.letter || "";
          cellEl.className = "cell";
          if (cell.state) cellEl.classList.add(cell.state);
        }, 180);
      }, cellIndex * 180);
    }

    rowEl.appendChild(cellEl);
  });

  // 🔥 DEZE MISSTE BIJ JOU
  els.board.appendChild(rowEl);
});

// 🔥 SLUIT buildBoard netjes af
previousBoard = JSON.parse(JSON.stringify(board));

if (flipRowIndex >= 0) {
  setTimeout(() => {
    flipLock = false;
  }, wordLength * 180 + 600);
}
}

 
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updatePlayers() {
  if (!state.room) {
    els.playersList.textContent = "Nog niemand verbonden.";
    return;
  }



  els.playersList.innerHTML = state.room.players.map((p, index) => {
    const hostBadge = p.id === state.room.hostId ? ' <span class="badge">host</span>' : "";
    const meBadge = p.id === state.selfId ? ' <span class="badge">jij</span>' : "";
    return `<div>Speler ${index + 1}: <strong>${escapeHtml(p.name)}</strong>${hostBadge}${meBadge}</div>`;
  }).join("");
}

function updateTopScoreBar(room) {
  if (!els.topScoreBar || !room || !room.players) return;

  const scores = room.scores || {};
  const players = room.players;

  els.topScoreBar.innerHTML = players.map((p, index) => {
    const name = p.name || `Speler ${index + 1}`;
    const score = scores[p.id] || 0;

    return `<span>${name}: ${score}</span>`;
  }).join("");
}

 
 function updateScores() {
  if (!state.room) {
    els.scoreList.textContent = "Nog geen score.";
    return;
  }

  els.scoreList.innerHTML = state.room.players.map((p) =>
    `<div><strong>${escapeHtml(p.name)}</strong>: ${state.room.roundWins?.[p.id] ?? 0}</div>`
  ).join("");
}

function updateControls() {
  const room = state.room;
  const round = room?.round || null;
  const host = isHost();

  const playing = round && round.status === "playing";
  const paused = round && round.status === "paused";

  const myTurn = !!(round && round.currentTurn === state.selfId && playing);

  const playerCount = room?.players ? room.players.length : 0;
  const canStart = !!(room && host && playerCount >= 2 && (!round || round.status !== "playing"));

  els.startRoundBtn.disabled = !canStart;
  els.copyCodeBtn.disabled = !state.roomCode;
  els.pauseBtn.disabled = !(host && round && (playing || paused));

  document.querySelectorAll(".lenBtn").forEach((btn) => btn.disabled = !host || playing);
  document.querySelectorAll(".timeBtn").forEach((btn) => btn.disabled = !host || playing);
  document.querySelectorAll(".diffBtn").forEach((btn) => btn.disabled = !host || playing);

  els.guessInput.disabled = !myTurn;

if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
  els.guessInput.setAttribute("readonly", true);
}
  els.submitBtn.disabled = !myTurn;
  els.clearBtn.disabled = false;

  if (!myTurn) els.guessInput.blur();
}

function updateSettingsButtons() {
  const settings = state.room?.settings;
  if (!settings) return;
  setActiveByData(".lenBtn", settings.wordLength, "len");
  setActiveByData(".timeBtn", settings.timeLimit, "time");
  document.querySelectorAll(".diffBtn").forEach((btn) => btn.classList.toggle("active", btn.dataset.diff === settings.difficulty));
  els.guessInput.maxLength = settings.wordLength;
}

function updateStatus() {
  const room = state.room;
  const round = room?.round || null;

  if (!room) {
    els.statusTitle.textContent = state.roomCode ? "Kamer laden..." : "Nog geen kamer";
    els.statusSub.textContent = state.roomCode ? "Wacht op server..." : "Maak eerst een kamer of join er één.";
    els.roomCodeDisplay.textContent = state.roomCode || "-----";
    buildBoard(5);
    return;
  }

  els.roomCodeDisplay.textContent = state.roomCode || room.code || "-----";

  if (!round) {
    hideGameOver();
    hidePauseOverlay();

    els.statusTitle.textContent = room.players.length < 2 ? "Wacht op speler 2" : "Klaar om te starten";
    els.statusSub.textContent = room.players.length < 2 ? "Stuur de kamercode naar je maatje." : "De host kan nu de ronde starten.";
    els.turnPill.textContent = "Beurt: -";
    els.timerPill.textContent = `Tijd: ${room.settings.timeLimit}`;
    els.timerBar.style.width = "100%";
    els.timerBar.classList.remove("warn");

    buildBoard(room.settings.wordLength);
    return;
    }

    if (round && round.board) {
  // hier doen we nu niks meer met rode shake
  // final drama gebeurt straks alleen bij Game Over
    }

buildBoard(round.wordLength, round.board);


  const pct = Math.max(0, Math.min(100, (round.timeLeft / round.timeLimit) * 100));
  els.timerBar.style.width = `${pct}%`;
  els.timerBar.classList.toggle("warn", round.timeLeft <= 10);
  els.timerBar.classList.toggle("danger", round.timeLeft <= 5);
  els.timerBar.classList.toggle("critical", round.timeLeft <= 3);

  if (round.status === "playing") {
    hidePauseOverlay();
    els.statusTitle.textContent = "Ronde bezig";
    els.statusSub.textContent = round.message || "Speel!";
  } else if (round.status === "paused") {
    showPauseOverlay(round.message || "Spel gepauzeerd");
    els.statusTitle.textContent = "Spel gepauzeerd";
    els.statusSub.textContent = round.message || "Wacht tot de host verder gaat.";
  } else {
    hidePauseOverlay();
    const winner = room.players.find((p) => p.id === round.winnerId);
    els.statusTitle.textContent = winner ? `${winner.name} wint de ronde` : "Ronde afgelopen";
    els.statusSub.textContent = round.message + (round.revealWord ? ` Woord: ${round.revealWord}.` : "");
  }

  els.pauseBtn.textContent = round.status === "paused" ? "VERDER" : "PAUZE";
  els.turnPill.textContent = `Beurt: ${round.currentTurnName || "-"}`;

if (round.currentTurn === state.selfId) {
  els.turnPill.classList.add("turn-active");
} else {
  els.turnPill.classList.remove("turn-active");
}
  els.timerPill.textContent = `Tijd: ${round.timeLeft}`;
}

function syncUI() {
  document.body.classList.toggle("room-active", !!state.room);

  updatePlayers();
  updateScores();
  updateTopScoreBar(state.room);
  updateSettingsButtons();
  updateStatus();
  updateControls();
}
  

function emitSettingsUpdate() {
  if (!state.roomCode || !isHost()) return;
  socket.emit("settings:update", {
    code: state.roomCode,
    settings: {
      wordLength: Number(document.querySelector(".lenBtn.active")?.dataset.len || 5),
      timeLimit: Number(document.querySelector(".timeBtn.active")?.dataset.time || 30),
      difficulty: document.querySelector(".diffBtn.active")?.dataset.diff || "normaal"
    }
  });
}

function countFilledCells(board) {
  if (!board) return 0;
  let n = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell && cell.letter) n++;
    }
  }
  return n;
}

function handleAudioTransitions(prevRoom, nextRoom) {
  if (prevRoom && nextRoom) {
    const prevCount = prevRoom.players?.length || 0;
    const nextCount = nextRoom.players?.length || 0;

    if (prevCount < 2 && nextCount === 2) {
      playPlayerJoinedSound();
    }
  }

  const prevRound = prevRoom?.round || null;
  const nextRound = nextRoom?.round || null;

  if (!prevRound && nextRound && nextRound.status === "playing") {
    hideGameOver();
    clearConfetti();
    audio.warnedAt.clear();
    playStartSound();
  }

  if (prevRound && nextRound) {
   if (prevRound.currentTurn !== nextRound.currentTurn && nextRound.status === "playing") {
  playTurnSound();

 setTimeout(() => {
  const rowIndex = Math.max(0, (nextRound.currentRow || 1) - 1);
  const rows = document.querySelectorAll(".board-row");
  const row = rows[rowIndex];

  if (!row) return;

  row.classList.remove("wrong-flash");
  void row.offsetWidth;
  row.classList.add("wrong-flash");

  setTimeout(() => {
    row.classList.remove("wrong-flash");
  }, 950);
}, 80);
  }


    if (prevRound.status === "playing" && nextRound.status === "paused") {
      playPauseSound();
    }

    if (prevRound.status === "paused" && nextRound.status === "playing") {
      playResumeSound();
      audio.warnedAt.clear();
    }

    if (prevRound.timeLeft !== nextRound.timeLeft && nextRound.status === "playing") {
      playTick();

      if (nextRound.timeLeft <= 5 && !audio.warnedAt.has(`panic${nextRound.timeLeft}`)) {
        audio.warnedAt.add(`panic${nextRound.timeLeft}`);
        beep(900 + (5 - nextRound.timeLeft) * 120, 0.08, "square", 0.22);

        if (nextRound.timeLeft <= 3) {
          beep(1300 + (3 - nextRound.timeLeft) * 180, 0.10, "square", 0.28, 0.06);
        }
      } else if (nextRound.timeLeft <= 10 && !audio.warnedAt.has(`w${nextRound.timeLeft}`)) {
        audio.warnedAt.add(`w${nextRound.timeLeft}`);
        playWarnSound();
      }

      if (nextRound.timeLeft > 10) audio.warnedAt.clear();
    }

   if (nextRound.status === "ended") {
  const winner = nextRoom?.players?.find((p) => p.id === nextRound.winnerId);

  if (nextRound.winnerId) {
    playWinSound();
    launchConfetti();
  } else {
    console.log("GAME OVER ZONDER WINNAAR");
    playFinalWrongDrama();
  }

  setTimeout(() => {
    showGameOver(
      winner ? `${winner.name} wint de ronde` : "Game over",
      nextRound.revealWord
        ? `Het woord was ${nextRound.revealWord}.`
        : (nextRound.message || "De ronde is afgelopen.")
    );
  }, 1600);
}
  }
}

els.createRoomBtn.addEventListener("click", async () => {
  setNotice("");

  // HARDE TEST: als je dit niet ziet, laad je oude client.js
  els.statusTitle.textContent = "Kamer wordt gemaakt...";
  els.statusSub.textContent = "Wacht op server...";
  els.roomCodeDisplay.textContent = ".....";

  console.log("KLIK KAMER MAKEN - NIEUWE CLIENT.JS WORDT GEBRUIKT");

  socket.emit("room:create", {
  name: getName(),
  playerId
});
  setNotice("Kamer wordt aangemaakt...", "ok");
});

els.joinRoomBtn.addEventListener("click", async () => {
  const code = (els.roomCodeInput.value || "").trim().toUpperCase();
  if (!code) return setNotice("Vul eerst een kamercode in.", "error");
  await unlockAudio(false);
  setNotice("");
  socket.emit("room:join", {
  code,
  name: getName(),
  playerId
 });
});

els.copyCodeBtn.addEventListener("click", async () => {
  const code = state.room?.code || state.roomCode;
  if (!code) return;

  const joinUrl = `https://lingo-online.onrender.com/?room=${code}`;

  const text =
`🎮 Join Johnny's Lingo kamer!

Kamercode: ${code}

${joinUrl}`;

  try {
    if (navigator.clipboard && window.isSecureContext) {
  await navigator.clipboard.writeText(text);
} else {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-999999px";

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  document.execCommand("copy");

  textarea.remove();
}

    window.open(
  `https://wa.me/?text=${encodeURIComponent(text)}`,
  "_blank"
);

    setNotice("Kamercode + link gekopieerd.", "ok");

    els.copyCodeBtn.textContent = "GEKOPIEERD!";

    setTimeout(() => {
      els.copyCodeBtn.textContent = "Kopieer code";
    }, 2000);

  } catch {
    setNotice(`Kopieer handmatig: ${code}`, "ok");
  }
});
els.startRoundBtn.addEventListener("click", async () => {
  if (!state.roomCode) return;
  await unlockAudio(false);
  setNotice("");
  socket.emit("round:start", { code: state.roomCode });
});

els.pauseBtn.addEventListener("click", async () => {
  if (!state.roomCode) return;
  await unlockAudio(false);
  setNotice("");
  socket.emit("round:togglePause", { code: state.roomCode });
});

document.querySelectorAll(".lenBtn").forEach((btn) => btn.addEventListener("click", () => {
  if (!isHost()) return;
  document.querySelectorAll(".lenBtn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  emitSettingsUpdate();
}));

document.querySelectorAll(".timeBtn").forEach((btn) => btn.addEventListener("click", () => {
  if (!isHost()) return;
  document.querySelectorAll(".timeBtn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  emitSettingsUpdate();
}));

document.querySelectorAll(".diffBtn").forEach((btn) => btn.addEventListener("click", () => {
  if (!isHost()) return;
  document.querySelectorAll(".diffBtn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  emitSettingsUpdate();
}));


async function submitGuessNow() {
  if (!state.roomCode) return;
  if (els.submitBtn.disabled) return;

  await unlockAudio(false);
  playSubmitSound();

  socket.emit("guess:submit", {
    code: state.roomCode,
    guess: els.guessInput.value
  });

  setTimeout(() => {
    document.querySelector(".game")?.scrollIntoView({
      block: "start",
      behavior: "auto"
    });
  }, 150);
}

els.submitBtn.addEventListener("pointerdown", async (e) => {
  e.preventDefault();
  await submitGuessNow();
});

els.clearBtn.addEventListener("click", () => {
  els.guessInput.value = "";
  els.guessInput.dataset.prevValue = "";
  els.guessInput.blur();
});

els.guessInput.addEventListener("input", async () => {
  const oldValue = els.guessInput.dataset.prevValue || "";
  const maxLength = Number(els.guessInput.maxLength || 5);

  els.guessInput.value = els.guessInput.value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, maxLength);

  if (els.guessInput.value.length > oldValue.length) {
    await unlockAudio(false);
    playTypeSound();
  }

  els.guessInput.dataset.prevValue = els.guessInput.value;
});

els.guessInput.addEventListener("keydown", async (e) => {
  if (e.key === "Enter" && !els.submitBtn.disabled) {
    e.preventDefault();
    await submitGuessNow();
  }
});

// OPPO: keyboard open/dicht detectie + beeld rustig houden
els.guessInput.addEventListener("focus", () => {
  document.body.classList.add("kb-open");

  setTimeout(() => {
    document.querySelector(".game")?.scrollIntoView({
      block: "start",
      behavior: "auto"
    });
  }, 150);
});

els.guessInput.addEventListener("blur", () => {
  document.body.classList.remove("kb-open");
});

socket.on("self:update", ({ id, roomCode }) => {
  console.log("CLIENT self:update", id, roomCode);

  state.selfId = id;
  state.roomCode = roomCode || "";

  els.roomCodeInput.value = roomCode || "";
  els.roomCodeDisplay.textContent = roomCode || "-----";

  syncUI();
});

socket.on("room:update", (room) => {
  console.log("CLIENT room:update", room);

  const prev = prevRoomSnapshot;

  state.room = room;
  state.roomCode = room.code || state.roomCode;

  syncUI();

  handleAudioTransitions(prev, room);

  prevRoomSnapshot = JSON.parse(JSON.stringify(room));
});

socket.on("error:message", (message) => {
  console.log("SERVER ERROR:", message);
  setNotice(message, "error");
  playErrorSound();
});

window.addEventListener("load", () => {
  setTimeout(() => {
    if (!audio.ready && !audio.overlay) {
      installAudioOverlay();
    }
  }, 300);
});

installAudioOverlay();

const params = new URLSearchParams(window.location.search);
const roomFromUrl = params.get("room");

if (roomFromUrl) {

  els.roomCodeInput.value = roomFromUrl.toUpperCase();

  setTimeout(() => {

    socket.emit("room:join", {
      code: roomFromUrl.toUpperCase(),
      name: getName()
    });

  }, 600);
}

setupMobileKeypad();