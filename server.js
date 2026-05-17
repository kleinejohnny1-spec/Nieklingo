const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const WORDS = require("./public/words.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket", "polling"]
});
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
const rooms = new Map();

function makeCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

function getUniqueCode() {
  for (let tries = 0; tries < 5000; tries++) {
    const code = makeCode();
    if (!rooms.has(code)) return code;
  }
  throw new Error("Kon geen unieke kamercode maken.");
}

function sanitizeWordList(length) {
  return (WORDS[length] || [])
    .map((w) => String(w).toUpperCase().replace(/[^A-Z]/g, ""))
    .filter((w) => w.length === Number(length));
}

function filterWordsByDifficulty(pool, difficulty) {
  if (difficulty === "makkelijk") {
    return pool.filter((w) => {
      const unique = new Set(w).size;
      return w.length <= 5 || unique >= w.length - 1;
    });
  }

  if (difficulty === "pittig") {
    return pool.filter((w) => new Set(w).size < w.length || w.length >= 5);
  }

  return pool;
}

function getLetterBucket(room) {
  const key = `${room.settings.wordLength}|${room.settings.difficulty}`;
  if (!room.firstLetterStats[key]) room.firstLetterStats[key] = { recent: [], counts: {} };
  return room.firstLetterStats[key];
}

function chooseBalancedWord(room) {
  let pool = sanitizeWordList(room.settings.wordLength);
  pool = filterWordsByDifficulty(pool, room.settings.difficulty);
  if (!pool.length) pool = sanitizeWordList(room.settings.wordLength);

  const grouped = {};
  for (const word of pool) {
    const first = word[0];
    if (!grouped[first]) grouped[first] = [];
    grouped[first].push(word);
  }

   
const letters = Object.keys(grouped);

const bagKey = `${room.settings.wordLength}|${room.settings.difficulty}`;

if (room.letterBagKey !== bagKey) {
  room.letterBag = [];
  room.lastChosenLetter = null;
  room.recentWords = [];
  room.letterBagKey = bagKey;
}

if (!room.letterBag || !room.letterBag.length) {
  room.letterBag = letters.slice();

  for (let i = room.letterBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [room.letterBag[i], room.letterBag[j]] = [room.letterBag[j], room.letterBag[i]];
  }
}

const lastLetter = room.lastChosenLetter;

let possibleIndexes = [];

room.letterBag.forEach((letter, i) => {
  if (letter !== lastLetter) possibleIndexes.push(i);
});

if (!possibleIndexes.length) {
  possibleIndexes = room.letterBag.map((_, i) => i);
}

const randomIndex = possibleIndexes[Math.floor(Math.random() * possibleIndexes.length)];
const chosenLetter = room.letterBag.splice(randomIndex, 1)[0];
room.lastChosenLetter = chosenLetter;

const words = grouped[chosenLetter] || [];

if (!words.length) {
  throw new Error(`Geen woorden gevonden voor ${room.settings.wordLength} letters`);
}

if (!room.recentWords) room.recentWords = [];

let wordCandidates = words.filter(word => !room.recentWords.includes(word));
if (!wordCandidates.length) wordCandidates = words.slice();

const chosenWord = wordCandidates[Math.floor(Math.random() * wordCandidates.length)];

room.recentWords.push(chosenWord);
while (room.recentWords.length > 40) room.recentWords.shift();

return chosenWord;
}

function createFreshBoard(wordLength) {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: wordLength }, () => ({ letter: "", state: "" }))
  );
}

function stampLockedPrefix(board, prefix) {
  for (let row = 0; row < board.length; row++) {
    board[row][0] = { letter: prefix, state: "good", locked: true };
  }
}

function scoreGuess(guess, target) {
  const result = new Array(guess.length).fill("bad");
  const remaining = target.split("");

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === target[i]) {
      result[i] = "good";
      remaining[i] = null;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] !== "bad") continue;
    const index = remaining.indexOf(guess[i]);
    if (index !== -1) {
      result[i] = "present";
      remaining[index] = null;
    }
  }

  result[0] = "good";
  return result;
}

function pointsForRow(row) {
  if (row === 0) return 25;
  if (row === 1) return 20;
  if (row === 2) return 15;
  if (row === 3) return 12;
  return 10;
}

function publicRoomState(room) {
  const round = room.round;

  return {
    code: room.code,
    hostId: room.hostId,
    playerCount: room.players.length,
    players: room.players.map((p, index) => ({
      id: p.id,
      name: p.name,
      number: index + 1
    })),
    settings: room.settings,
    scores: room.scores,
    roundWins: room.roundWins,
    recentWords: [],
    round: round
      ? {
          status: round.status,
          wordLength: round.wordLength,
          timeLimit: round.timeLimit,
          timeLeft: round.timeLeft,
          currentTurn: round.currentTurn,
          currentTurnName:
            room.players.find((p) => p.id === round.currentTurn)?.name || "Speler",
          currentRow: round.currentRow,
          board: round.board,
          lockedPrefix: round.lockedPrefix,
          winnerId: round.winnerId,
          revealWord: round.status === "ended" ? round.target : null,
          message: round.message || ""
        }
      : null
  };
}
function emitRoom(room) {
  io.to(room.code).emit("room:update", publicRoomState(room));
}

function createRoom(hostSocket) {
  const code = getUniqueCode();

  const room = {
    code,
    players: [],
    hostId: null,
    settings: { wordLength: 5, timeLimit: 30, difficulty: "normaal" },
    scores: {},
    roundWins: {},
    firstLetterStats: {},
    round: null,
    letterBag: [],
    lastChosenLetter: null,
    recentWords: []
  };

  rooms.set(code, room);
  return room;
}

function endRound(room, message, winnerId = null) {
  if (!room.round) return;

  if (room.round.timer) {
    clearInterval(room.round.timer);
    room.round.timer = null;
  }

 } else if (room.round.status === "paused") {
  room.round.status = "playing";
  room.round.timeLeft = room.settings.timeLimit;
  room.round.message = "Spel hervat door de host.";
  emitRoom(room);
}
function startRound(room) {
  if (room.players.length < 2) {
    return { ok: false, error: "Je hebt 2 spelers nodig." };
  }

  const target = chooseBalancedWord(room);
  const board = createFreshBoard(room.settings.wordLength);
  const lockedPrefix = target[0];

  stampLockedPrefix(board, lockedPrefix);

  for (const player of room.players) {
    if (typeof room.scores[player.id] !== "number") room.scores[player.id] = 0;
    if (typeof room.roundWins[player.id] !== "number") room.roundWins[player.id] = 0;
  }

  if (typeof room.starterIndex !== "number") {
    room.starterIndex = Math.floor(Math.random() * room.players.length);
  } else {
    room.starterIndex = (room.starterIndex + 1) % room.players.length;
  }

  const nextStarter = room.players[room.starterIndex].id;

  room.lastStarter = nextStarter;
  console.log("STARTER IS:", nextStarter, "INDEX:", room.starterIndex);

  room.round = {
    status: "playing",
    target,
    wordLength: room.settings.wordLength,
    timeLimit: room.settings.timeLimit,
    timeLeft: room.settings.timeLimit,
    currentTurn: nextStarter,
    currentRow: 0,
    board,
    lockedPrefix,
    winnerId: null,
    message: `Nieuwe ronde. Beginletter is ${lockedPrefix}.`,
    timer: null
  };

  room.round.timer = setInterval(() => {
    const currentRoom = rooms.get(room.code);
    if (!currentRoom || !currentRoom.round || currentRoom.round.status !== "playing") return;

    currentRoom.round.timeLeft -= 1;

    if (currentRoom.round.timeLeft <= 0) {
      const turnIndex = currentRoom.players.findIndex((p) => p.id === currentRoom.round.currentTurn);
      const nextIndex = turnIndex === 0 ? 1 : 0;
      currentRoom.round.currentTurn = currentRoom.players[nextIndex].id;
      currentRoom.round.timeLeft = currentRoom.settings.timeLimit;
      currentRoom.round.message = "Tijd op. Beurt gewisseld.";
    }

    emitRoom(currentRoom);
  }, 1000);

  emitRoom(room);
  return { ok: true };
}

io.on("connection", (socket) => {
    socket.on("room:create", ({ name, playerId }) => {
    const safeName = String(name || "Speler 1").trim().slice(0, 20) || "Speler 1";

const room = createRoom(socket);
room.hostId = playerId;

room.players.push({
  id: playerId,
  socketId: socket.id,
  name: safeName,
  connected: true
});

room.scores[playerId] = 0;
room.roundWins[playerId] = 0;



socket.join(room.code);
socket.emit("self:update", { id: playerId, roomCode: room.code });

console.log("ROOM GEMAAKT:", room.code, safeName, socket.id);
emitRoom(room);
});

  socket.on("room:join", ({ code, name, playerId }) => {
  console.log("JOIN POGING:", code, name, socket.id);

    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return socket.emit("error:message", "Kamer niet gevonden.");
    if (room.players.length >= 2) return socket.emit("error:message", "Deze kamer zit al vol.");

    const safeName = String(name || "Speler 2").trim().slice(0, 20) || "Speler 2";
    
room.players.push({
  id: playerId,
  socketId: socket.id,
  name: safeName,
  connected: true
});

room.scores[playerId] = room.scores[playerId] || 0;
room.roundWins[playerId] = room.roundWins[playerId] || 0;
    socket.join(room.code);
    socket.emit("self:update", { id: playerId, roomCode: room.code });
    emitRoom(room);
    });

    socket.on("settings:update", ({ code, settings }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    const player = room?.players.find((p) => p.socketId === socket.id);

    if (!room || room.hostId !== player?.id) return;
    if (room.round && (room.round.status === "playing" || room.round.status === "paused")) return;

    const wordLength = Number(settings?.wordLength) || room.settings.wordLength;
    const timeLimit = Number(settings?.timeLimit) || room.settings.timeLimit;
    const difficulty = ["makkelijk", "normaal", "pittig"].includes(settings?.difficulty)
      ? settings.difficulty
      : room.settings.difficulty;

    room.settings = {
      wordLength: [4, 5, 6].includes(wordLength) ? wordLength : 5,
      timeLimit: [30, 60, 90, 120].includes(timeLimit) ? timeLimit : 30,
      difficulty
    };

    emitRoom(room);
  });

  socket.on("round:start", ({ code }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    const player = room?.players.find((p) => p.socketId === socket.id);

    if (!room || room.hostId !== player?.id) return;

    const result = startRound(room);
    if (!result.ok) socket.emit("error:message", result.error);
  });

 socket.on("round:togglePause", ({ code }) => {
  console.log("PAUZE KNOP ONTVANGEN", code);

  const room = rooms.get(String(code || "").toUpperCase());
  const player = room?.players.find((p) => p.socketId === socket.id);

  if (!room || room.hostId !== player?.id) return;
  if (!room.round) return;

  if (room.round.status === "playing") {
    room.round.status = "paused";
    room.round.message = "Spel gepauzeerd door de host.";
    emitRoom(room);
  } else if (room.round.status === "paused") {
    room.round.status = "playing";
    room.round.timeLeft = room.settings.timeLimit;
    room.round.message = "Spel hervat door de host.";
    emitRoom(room);
  }
});

socket.on("guess:submit", ({ code, guess }) => {
  const room = rooms.get(String(code || "").toUpperCase());
  if (!room || !room.round || room.round.status !== "playing") return;

  const player = room.players.find((p) => p.socketId === socket.id);

  if (room.round.currentTurn !== player?.id) {
    return socket.emit("error:message", "Wacht op je beurt.");
  }

  const cleaned = String(guess || "").toUpperCase().replace(/[^A-Z]/g, "");

  if (cleaned.length !== room.round.wordLength) {
    return socket.emit("error:message", `Gebruik precies ${room.round.wordLength} letters.`);
  }

  if (cleaned[0] !== room.round.lockedPrefix) {
    return socket.emit("error:message", `Je woord moet beginnen met ${room.round.lockedPrefix}.`);
  }

  const row = room.round.currentRow;
  const results = scoreGuess(cleaned, room.round.target);

  for (let i = 0; i < cleaned.length; i++) {
    room.round.board[row][i] = {
      letter: cleaned[i],
      state: results[i],
      locked: i === 0
    };
  }

  if (cleaned === room.round.target) {

    room.roundWins[player.id] = (room.roundWins[player.id] || 0) + 1;

    const points = pointsForRow(row);
    room.scores[player.id] = (room.scores[player.id] || 0) + points;

    return endRound(
      room,
      `${room.players.find((p) => p.id === player.id)?.name || "Speler"} raadde het woord en wint de ronde.`,
      player.id
    );
  }

  room.round.currentRow += 1;

  if (room.round.currentRow >= 5) {
    return endRound(room, `Geen pogingen meer. Het woord was ${room.round.target}.`, null);
  }

  const currentIndex = room.players.findIndex((p) => p.id === player.id);
  const nextIndex = currentIndex === 0 ? 1 : 0;

  room.round.currentTurn = room.players[nextIndex].id;
  room.round.timeLeft = room.settings.timeLimit;
  room.round.message = `Niet goed. Beurt naar ${room.players[nextIndex]?.name || "speler"}.`;

  emitRoom(room);
});

  socket.on("disconnect", () => {
    for (const [code, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex === -1) continue;

      room.players[playerIndex].connected = false;

      if (room.hostId === socket.id) {
        const newHost = room.players.find((p) => p.id !== socket.id && p.connected !== false);
        if (newHost) room.hostId = newHost.id;
      }

      if (room.round && (room.round.status === "playing" || room.round.status === "paused")) {
        endRound(room, "Een speler is weggevallen. Start een nieuwe ronde.");
      } else {
        emitRoom(room);
      }

      break;
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lingo Online V3 Clean draait op http://localhost:${PORT}`);
});