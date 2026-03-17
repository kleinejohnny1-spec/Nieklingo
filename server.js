const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ROUND_SECONDS = 30;
const MAX_ATTEMPTS = 5;
const ALLOWED_LENGTHS = [5, 6, 7];

function readWordFile(filename) {
  return fs.readFileSync(path.join(__dirname, 'words', filename), 'utf8')
    .split(/\r?\n/)
    .map(w => w.trim().toUpperCase())
    .filter(Boolean);
}

const WORDS = {
  5: readWordFile('words5.txt'),
  6: readWordFile('words6.txt'),
  7: readWordFile('words7.txt'),
};

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function randomWord(length) {
  const list = WORDS[length] || WORDS[5];
  return list[Math.floor(Math.random() * list.length)];
}

function createEmptyBoard(length) {
  return Array.from({ length: MAX_ATTEMPTS }, (_, rowIdx) => {
    const row = Array.from({ length }, () => ({ char: '', state: 'empty' }));
    if (rowIdx === 0) row[0] = { char: '', state: 'starter' };
    return row;
  });
}

function evaluateGuess(guess, answer) {
  const result = Array.from({ length: guess.length }, (_, i) => ({ char: guess[i], state: 'absent' }));
  const answerChars = answer.split('');
  const taken = Array(answer.length).fill(false);

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      result[i].state = 'correct';
      taken[i] = true;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i].state === 'correct') continue;
    for (let j = 0; j < answerChars.length; j++) {
      if (!taken[j] && guess[i] === answerChars[j]) {
        result[i].state = 'present';
        taken[j] = true;
        break;
      }
    }
  }

  return result;
}

function nextPlayerIndex(room) {
  return room.turnIndex === 0 ? 1 : 0;
}

function pointsForLength(length) {
  return length * 10;
}

function emitRoomState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const payload = {
    roomCode,
    phase: room.phase,
    players: room.players.map((p, index) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      ready: p.ready,
      isTurn: room.turnIndex === index,
    })),
    modeLength: room.modeLength,
    roundSeconds: ROUND_SECONDS,
    timerEndsAt: room.timerEndsAt,
    board: room.board,
    currentRow: room.currentRow,
    currentGuess: room.currentGuess,
    clue: room.answer ? room.answer[0] + '•'.repeat(room.answer.length - 1) : '',
    message: room.message,
    guessesLeft: room.board ? Math.max(0, room.board.length - room.currentRow) : MAX_ATTEMPTS,
    canStart: room.players.length === 2 && room.players.every(p => p.ready),
  };

  io.to(roomCode).emit('roomState', payload);
}

function resetTimer(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  room.timerEndsAt = Date.now() + ROUND_SECONDS * 1000;
}

function clearRoomTimer(room) {
  if (room.interval) {
    clearInterval(room.interval);
    room.interval = null;
  }
}

function setupRoomTicker(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  clearRoomTimer(room);
  room.interval = setInterval(() => {
    const liveRoom = rooms.get(roomCode);
    if (!liveRoom || liveRoom.phase !== 'playing') return;

    if (Date.now() >= liveRoom.timerEndsAt) {
      liveRoom.message = `Tijd op. ${liveRoom.players[liveRoom.turnIndex].name} verliest deze beurt.`;
      liveRoom.turnIndex = nextPlayerIndex(liveRoom);
      liveRoom.currentGuess = '';
      liveRoom.currentRow += 1;
      resetTimer(roomCode);

      if (liveRoom.currentRow >= liveRoom.board.length) {
        liveRoom.message = `Niemand vond het woord. Het woord was ${liveRoom.answer}. Nieuwe ronde gestart.`;
        io.to(roomCode).emit('playSound', { type: 'lose' });
        startRound(roomCode, liveRoom.modeLength);
        return;
      }

      emitRoomState(roomCode);
    }
  }, 250);
}

function startRound(roomCode, length) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.modeLength = length;
  room.answer = randomWord(length);
  room.board = createEmptyBoard(length);
  room.board[0][0] = { char: room.answer[0], state: 'correct' };
  room.currentRow = 0;
  room.currentGuess = '';
  room.phase = 'playing';
  room.message = `Nieuwe ronde: ${length}-letterwoord. ${room.players[room.turnIndex].name} begint.`;
  resetTimer(roomCode);
  setupRoomTicker(roomCode);
  emitRoomState(roomCode);
}

function sanitizeRoomCode(code) {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function getRoomBySocket(socket) {
  for (const [code, room] of rooms.entries()) {
    if (room.players.some(p => p.id === socket.id)) return { code, room };
  }
  return null;
}

function normalizeLength(modeLength) {
  const value = Number(modeLength);
  return ALLOWED_LENGTHS.includes(value) ? value : 5;
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => {
    const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const room = {
      players: [{ id: socket.id, name: (name || 'Speler 1').slice(0, 20), score: 0, ready: false }],
      phase: 'lobby',
      modeLength: 5,
      turnIndex: 0,
      currentRow: 0,
      currentGuess: '',
      board: null,
      answer: '',
      timerEndsAt: null,
      interval: null,
      message: 'Lobby aangemaakt. Deel de kamercode of uitnodigingslink en wacht op speler 2.',
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);
    emitRoomState(roomCode);
  });

  socket.on('joinRoom', ({ name, roomCode }) => {
    roomCode = sanitizeRoomCode(roomCode);
    const room = rooms.get(roomCode);
    if (!room) return socket.emit('errorMessage', 'Kamer niet gevonden.');
    if (room.players.some(p => p.id === socket.id)) return;
    if (room.players.length >= 2) return socket.emit('errorMessage', 'Kamer is al vol.');

    room.players.push({ id: socket.id, name: (name || 'Speler 2').slice(0, 20), score: 0, ready: false });
    room.message = 'Speler 2 is binnen. Zet jullie klaar en start.';
    socket.join(roomCode);
    emitRoomState(roomCode);
  });

  socket.on('setReady', ({ ready }) => {
    const found = getRoomBySocket(socket);
    if (!found) return;
    const { code, room } = found;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    player.ready = !!ready;
    room.message = `${player.name} is ${player.ready ? 'klaar' : 'niet klaar'}.`;
    emitRoomState(code);
  });

  socket.on('startMatch', ({ modeLength }) => {
    const found = getRoomBySocket(socket);
    if (!found) return;
    const { code, room } = found;

    if (room.players.length !== 2) return socket.emit('errorMessage', 'Je hebt 2 spelers nodig.');
    if (!room.players.every(p => p.ready)) return socket.emit('errorMessage', 'Beide spelers moeten klaar staan.');

    room.turnIndex = Math.floor(Math.random() * 2);
    startRound(code, normalizeLength(modeLength));
  });

  socket.on('typeGuess', ({ value }) => {
    const found = getRoomBySocket(socket);
    if (!found) return;
    const { code, room } = found;
    if (room.phase !== 'playing') return;
    if (room.players[room.turnIndex]?.id !== socket.id) return;

    const normalized = (value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, room.modeLength);
    room.currentGuess = normalized;
    emitRoomState(code);
  });

  socket.on('submitGuess', () => {
    const found = getRoomBySocket(socket);
    if (!found) return;
    const { code, room } = found;
    if (room.phase !== 'playing') return;
    if (room.players[room.turnIndex]?.id !== socket.id) return;

    const guess = room.currentGuess;
    if (!guess || guess.length !== room.modeLength) {
      return socket.emit('errorMessage', `Vul een woord van ${room.modeLength} letters in.`);
    }

    const row = evaluateGuess(guess, room.answer);
    room.board[room.currentRow] = row;

    if (guess === room.answer) {
      room.players[room.turnIndex].score += pointsForLength(room.modeLength);
      room.message = `${room.players[room.turnIndex].name} raadde ${room.answer} goed.`;
      io.to(code).emit('playSound', { type: 'win' });
      room.turnIndex = nextPlayerIndex(room);
      startRound(code, room.modeLength);
      return;
    }

    room.currentRow += 1;
    room.currentGuess = '';
    room.turnIndex = nextPlayerIndex(room);

    if (room.currentRow >= room.board.length) {
      room.message = `Geen juiste oplossing. Het woord was ${room.answer}. Nieuwe ronde.`;
      io.to(code).emit('playSound', { type: 'lose' });
      startRound(code, room.modeLength);
      return;
    }

    room.message = `${room.players[room.turnIndex].name} is aan de beurt.`;
    io.to(code).emit('playSound', { type: 'submit' });
    resetTimer(code);
    emitRoomState(code);
  });

  socket.on('switchMode', ({ modeLength }) => {
    const found = getRoomBySocket(socket);
    if (!found) return;
    const { code, room } = found;

    room.modeLength = normalizeLength(modeLength);
    room.message = `Spelmodus ingesteld op ${room.modeLength} ballen.`;
    emitRoomState(code);
  });

  socket.on('disconnect', () => {
    const found = getRoomBySocket(socket);
    if (!found) return;
    const { code, room } = found;

    room.players = room.players.filter(p => p.id !== socket.id);
    clearRoomTimer(room);

    if (room.players.length === 0) {
      rooms.delete(code);
      return;
    }

    room.phase = 'lobby';
    room.message = 'Een speler is weggevallen. Wacht op herverbinding of start later opnieuw.';
    room.board = null;
    room.answer = '';
    room.currentGuess = '';
    room.currentRow = 0;
    room.timerEndsAt = null;
    room.players.forEach(p => p.ready = false);
    emitRoomState(code);
  });
});

server.listen(PORT, () => {
  console.log(`Lingo online v3 draait op http://localhost:${PORT}`);
});
