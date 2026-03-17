const socket = io();

const els = {
  playerName: document.getElementById('playerName'),
  createBtn: document.getElementById('createBtn'),
  roomCodeInput: document.getElementById('roomCodeInput'),
  joinBtn: document.getElementById('joinBtn'),
  roomCode: document.getElementById('roomCode'),
  phase: document.getElementById('phase'),
  readyBtn: document.getElementById('readyBtn'),
  startBtn: document.getElementById('startBtn'),
  message: document.getElementById('message'),
  players: document.getElementById('players'),
  board: document.getElementById('board'),
  guessInput: document.getElementById('guessInput'),
  submitBtn: document.getElementById('submitBtn'),
  timer: document.getElementById('timer'),
  timerFill: document.getElementById('timerFill'),
  clue: document.getElementById('clue'),
  guessesLeft: document.getElementById('guessesLeft'),
  turnState: document.getElementById('turnState'),
  inviteLink: document.getElementById('inviteLink'),
  copyInviteBtn: document.getElementById('copyInviteBtn'),
  modes: [...document.querySelectorAll('.mode')],
};

let localState = {
  roomCode: '',
  modeLength: 5,
  ready: false,
  timerEndsAt: null,
  roundSeconds: 30,
  mySocketId: null,
  players: [],
};

function safeName() {
  return (els.playerName.value || 'Speler').trim().slice(0, 20);
}

function showMessage(msg) {
  els.message.textContent = msg;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPlayers(players = []) {
  els.players.innerHTML = '';
  localState.players = players;
  players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card' + (p.isTurn ? ' turn' : '') + (p.id === socket.id ? ' me' : '');
    card.innerHTML = `
      <strong>${escapeHtml(p.name)} ${p.id === socket.id ? '<span class="you">(jij)</span>' : ''}</strong>
      <div>Score: ${p.score}</div>
      <div>${p.ready ? 'Klaar' : 'Niet klaar'} ${p.isTurn ? '• Aan zet' : ''}</div>
    `;
    els.players.appendChild(card);
  });

  const me = players.find(p => p.id === socket.id);
  els.turnState.textContent = me ? (me.isTurn ? 'Aan zet' : 'Wachten') : '-';
  els.startBtn.disabled = !(localState.players.length >= 1 && localState.players.length <= 2 && localState.players.every(p => p.ready));
}

function renderBoard(board = [], modeLength = 5, currentGuess = '', currentRow = 0) {
  els.board.innerHTML = '';
  board.forEach((row, index) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    rowEl.style.gridTemplateColumns = `repeat(${modeLength}, 1fr)`;

    const renderedRow = row.map(cell => ({ ...cell }));
    if (index === currentRow && currentGuess) {
      for (let i = 0; i < currentGuess.length; i++) {
        if (!renderedRow[i] || !renderedRow[i].char) renderedRow[i] = { char: currentGuess[i], state: 'draft' };
      }
    }

    renderedRow.forEach(cell => {
      const cellEl = document.createElement('div');
      const state = cell.state || '';
      cellEl.className = `cell ${state}`;
      cellEl.textContent = cell.char || '';
      rowEl.appendChild(cellEl);
    });

    els.board.appendChild(rowEl);
  });
}

function setModeButtons(modeLength) {
  els.modes.forEach(btn => btn.classList.toggle('active', Number(btn.dataset.mode) === modeLength));
  els.guessInput.maxLength = modeLength;
  els.guessInput.placeholder = `Woord van ${modeLength} letters`;
}

function updateInviteLink(roomCode) {
  if (!roomCode) {
    els.inviteLink.value = '';
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  els.inviteLink.value = url.toString();
}

function ensureAudioContext() {
  return window.audioCtx || (window.audioCtx = new (window.AudioContext || window.webkitAudioContext)());
}

function playTone(freq, duration, type = 'sine', when = 0, gainValue = 0.08) {
  const ctx = ensureAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, ctx.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + duration + 0.02);
}

function playSound(type) {
  if (type === 'submit') {
    playTone(523, 0.08, 'triangle', 0, 0.08);
    playTone(659, 0.08, 'triangle', 0.09, 0.08);
  } else if (type === 'win') {
    playTone(523, 0.10, 'triangle', 0, 0.08);
    playTone(659, 0.10, 'triangle', 0.11, 0.08);
    playTone(784, 0.12, 'triangle', 0.22, 0.09);
    playTone(1046, 0.22, 'triangle', 0.34, 0.09);
  } else if (type === 'lose') {
    playTone(392, 0.12, 'sawtooth', 0, 0.06);
    playTone(349, 0.18, 'sawtooth', 0.14, 0.06);
  } else if (type === 'tick') {
    playTone(950, 0.035, 'square', 0, 0.03);
  }
}

els.createBtn.addEventListener('click', () => {
  socket.emit('createRoom', { name: safeName() });
});

els.joinBtn.addEventListener('click', () => {
  socket.emit('joinRoom', { name: safeName(), roomCode: els.roomCodeInput.value });
});

els.readyBtn.addEventListener('click', () => {
  localState.ready = !localState.ready;
  socket.emit('setReady', { ready: localState.ready });
  els.readyBtn.textContent = localState.ready ? 'Toch niet klaar' : 'Ik ben klaar';
});

els.startBtn.addEventListener('click', () => {
  socket.emit('startMatch', { modeLength: localState.modeLength });
});

els.submitBtn.addEventListener('click', () => {
  socket.emit('submitGuess');
});

els.copyInviteBtn.addEventListener('click', async () => {
  if (!els.inviteLink.value) return showMessage('Maak eerst een kamer aan.');
  try {
    await navigator.clipboard.writeText(els.inviteLink.value);
    showMessage('Uitnodigingslink gekopieerd. Lekker bezig.');
  } catch {
    els.inviteLink.select();
    document.execCommand('copy');
    showMessage('Uitnodigingslink gekopieerd.');
  }
});

els.guessInput.addEventListener('input', e => {
  const cleaned = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, localState.modeLength);
  e.target.value = cleaned;
  socket.emit('typeGuess', { value: cleaned });
});

els.guessInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') socket.emit('submitGuess');
});

els.modes.forEach(btn => {
  btn.addEventListener('click', () => {
    localState.modeLength = Number(btn.dataset.mode);
    setModeButtons(localState.modeLength);
    socket.emit('switchMode', { modeLength: localState.modeLength });
  });
});

socket.on('connect', () => {
  localState.mySocketId = socket.id;
  const roomFromUrl = new URLSearchParams(window.location.search).get('room');
  if (roomFromUrl) {
    els.roomCodeInput.value = roomFromUrl.toUpperCase();
  }
});

socket.on('roomState', state => {
  localState.roomCode = state.roomCode;
  localState.modeLength = state.modeLength;
  localState.timerEndsAt = state.timerEndsAt;
  localState.roundSeconds = state.roundSeconds || 30;
  els.roomCode.textContent = state.roomCode;
  els.phase.textContent = state.phase;
  els.clue.textContent = state.clue || '-';
  els.guessesLeft.textContent = state.guessesLeft ?? '-';
  showMessage(state.message || '');
  renderPlayers(state.players || []);
  renderBoard(state.board || [], state.modeLength, state.currentGuess, state.currentRow);
  setModeButtons(state.modeLength);
  updateInviteLink(state.roomCode);
  const me = (state.players || []).find(p => p.id === socket.id);
  const myTurn = !!me?.isTurn;
  els.guessInput.disabled = !myTurn || state.phase !== 'playing';
  els.submitBtn.disabled = !myTurn || state.phase !== 'playing';
  if (myTurn && state.phase === 'playing') els.guessInput.focus();
});

socket.on('errorMessage', msg => showMessage(msg));
socket.on('playSound', ({ type }) => playSound(type));

let lastDisplayedSecond = null;
setInterval(() => {
  if (!localState.timerEndsAt) {
    els.timer.textContent = '30';
    els.timerFill.style.width = '100%';
    lastDisplayedSecond = null;
    return;
  }
  const msLeft = Math.max(0, localState.timerEndsAt - Date.now());
  const seconds = Math.max(0, Math.ceil(msLeft / 1000));
  els.timer.textContent = String(seconds);
  const pct = Math.max(0, Math.min(100, (msLeft / (localState.roundSeconds * 1000)) * 100));
  els.timerFill.style.width = `${pct}%`;
  if (seconds <= 5 && seconds > 0 && seconds !== lastDisplayedSecond) {
    playSound('tick');
  }
  lastDisplayedSecond = seconds;
}, 150);

setModeButtons(5);
