import express from 'express';
import http from 'http';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// High-speed HTTP response compression (reduces HTML/JS/CSS/JSON transfer size by 75-80%)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    // CRITICAL: Never compress video, audio, or pre-compressed images
    // This allows instant byte-range streaming for MP4 videos and avoids audio lag
    const url = (req.url || '').toLowerCase();
    if (url.match(/\.(mp4|webm|ogg|mp3|wav|png|jpg|jpeg|gif|webp|ico|woff|woff2|svg|avif|mov|m4v|mkv)$/i) || 
        url.includes('/sounds/') || url.includes('/images/') || url.includes('/uploads/') ||
        url.includes('/media/') || url.includes('/sfx/') || url.includes('/videos/') || url.includes('/assets/')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Setup disk storage for uploaded media (intro videos, audio, etc.)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.mp4';
    const safeName = (file.fieldname || 'media') + '_' + Date.now() + '_' + Math.round(Math.random() * 1E6) + ext;
    cb(null, safeName);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max file size
});

// Enable JSON body parsing and CORS for all LAN and Internet origins
app.use(express.json({ limit: '10mb' }));
app.get('/favicon.ico', (req, res) => {
  res.setHeader('Content-Type', 'image/x-icon');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const favPath = path.join(__dirname, 'favicon.ico');
  if (fs.existsSync(favPath)) {
    return res.sendFile(favPath);
  }
  return res.status(204).end();
});
app.use('/uploads', express.static(uploadsDir));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  // Strip subfolder prefix safely without hijacking asset URLs containing words like 'state' or 'action'
  if (req.url) {
    if (req.url.includes('\\')) {
      req.url = req.url.replace(/\\/g, '/');
    }
    req.url = req.url.replace(/\/{2,}/g, '/');

    let stripped = req.url;
    for (let k = 0; k < 3; k++) {
      const next = stripped.replace(/^\/(?:public|Olympia|DuongDenVinhQuang-main)(?=\/|$)/i, '') || '/';
      if (next === stripped) break;
      stripped = next;
    }

    const qIdx = stripped.indexOf('?');
    const pathOnly = qIdx >= 0 ? stripped.slice(0, qIdx) : stripped;
    const queryPart = qIdx >= 0 ? stripped.slice(qIdx) : '';

    if (pathOnly.startsWith('/api/')) {
      req.url = stripped;
    } else if (/^\/(action|state|events|buzzer-state)$/i.test(pathOnly)) {
      req.url = '/api' + pathOnly.toLowerCase() + queryPart;
    } else if (/^\/upload\.php$/i.test(pathOnly)) {
      req.url = '/upload.php' + queryPart;
    } else if (/^\/(uploads|Media|media|SFX|sfx|sounds|Images|images|videos|assets)\//i.test(pathOnly)) {
      req.url = stripped;
    } else if (req.url.includes('/api/')) {
      req.url = req.url.substring(req.url.indexOf('/api/'));
    } else {
      const subMediaMatch = req.url.match(/(\/(?:uploads|Media|media|SFX|sfx|sounds|Images|images|videos|assets)\/.*)$/i);
      if (subMediaMatch) {
        req.url = subMediaMatch[1];
      }
    }
  }
  next();
});

// Set of connected Server-Sent Events (SSE) clients across LAN & Internet
const sseClients = new Set();

// Set of connected WebSocket clients
const wsClients = new Set();

// Comprehensive In-Memory Game & Server State
let serverState = {
  roomCode: 'DDVQ2026',
  roomAuth: '123456',
  slotAuth: {
    1: '101234',
    2: '202345',
    3: '303456',
    4: '404567'
  },
  activeRound: 'XUAT_PHAT',
  currentTimer: null,
  currentQuestion: null,
  xpQuestionShown: false,
  vsQuestionShown: false,
  vqQuestionShown: false,
  vuotSong: null,
  vuotSongRow: 0,
  vsRoundStartTime: 0,
  vsLockedContestants: { 1: false, 2: false, 3: false, 4: false },
  currentXuatPhatTurn: 0,
  s1QuestionStates: {},
  xpBuzzerOpen: false,
  xpBuzzerLocked: true,
  xpBuzzerWinner: 0,
  xpBellUnlockedAt: 0,
  xpBuzzerWinnerTime: '',
  vqMainContestant: 0,
  vqBuzzerOpen: false,
  vqBuzzerLocked: true,
  vqBuzzerWinner: 0,
  vqBellUnlockedAt: 0,
  vqBuzzerWinnerTime: '',
  chpQuestionShown: false,
  chpParticipants: [1, 2, 3, 4],
  chpEliminated: [],
  chpBuzzerOpen: false,
  chpBuzzerLocked: true,
  chpBuzzerWinner: 0,
  chpBellUnlockedAt: 0,
  chpBuzzerWinnerTime: '',
  chpRightWinnerName: '',
  chpRemainingMs: 15000,
  s1HasSelectedDeForTurn: { 1: false, 2: false, 3: false, 4: false },
  s1ChosenDeMap: { 1: null, 2: null, 3: null, 4: null },
  contestants: [
    { name: 'Thí sinh 1', info: '', score: 0 },
    { name: 'Thí sinh 2', info: '', score: 0 },
    { name: 'Thí sinh 3', info: '', score: 0 },
    { name: 'Thí sinh 4', info: '', score: 0 }
  ],
  scoreboardThumbnailStates: { 1: false, 2: false, 3: false, 4: false },
  scoreboardInfoStates: { 1: false, 2: false, 3: false, 4: false },
  gameData: {
    xuatPhat: {},
    raKhoi: [],
    vuotSong: { h1: { q: '', a: '' }, h2: { q: '', a: '' }, h3: { q: '', a: '' }, h4: { q: '', a: '' }, center: { q: '', a: '' }, keyword: '' },
    vinhQuang: { 10: [], 20: [], 30: [] },
    cauHoiPhu: [],
    contestants: [
      { name: 'Thí sinh 1', info: '', score: 0 },
      { name: 'Thí sinh 2', info: '', score: 0 },
      { name: 'Thí sinh 3', info: '', score: 0 },
      { name: 'Thí sinh 4', info: '', score: 0 }
    ]
  },
  playerAnswers: {},
  connectedClients: {
    ts1: { connected: false, sessionId: null, name: 'Thí sinh 1', lastSeen: 0 },
    ts2: { connected: false, sessionId: null, name: 'Thí sinh 2', lastSeen: 0 },
    ts3: { connected: false, sessionId: null, name: 'Thí sinh 3', lastSeen: 0 },
    ts4: { connected: false, sessionId: null, name: 'Thí sinh 4', lastSeen: 0 },
    host: { connected: false, sessionId: null, name: 'Máy MC', lastSeen: 0 },
    projector: { connected: false, sessionId: null, name: 'Máy Chiếu', lastSeen: 0 }
  },
  buzzerState: {
    buzzerUnlocked: false,
    buzzerWinner: null
  },
  latestAction: null,
  lastUpdated: Date.now()
};

function computeSlotAuth(masterAuth, slot) {
  if (!masterAuth) masterAuth = '123456';
  let hash = 5381;
  const str = `${masterAuth}_SLOT_${slot}_DDVQ2026_SECRET`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const pin = Math.abs(hash % 900000) + 100000;
  return `${pin}`;
}

function getSlotAuth(slot) {
  const s = parseInt(slot) || 1;
  if (serverState.slotAuth && serverState.slotAuth[s]) {
    return serverState.slotAuth[s];
  }
  return computeSlotAuth(serverState.roomAuth, s);
}

function getAllSlotAuths() {
  return {
    1: getSlotAuth(1),
    2: getSlotAuth(2),
    3: getSlotAuth(3),
    4: getSlotAuth(4)
  };
}

function isValidAuthForSlot(slot, auth) {
  // If no auth supplied or no strict roomAuth configured, allow seamless access
  if (!auth) return true;
  const s = parseInt(slot) || 0;
  const cleanAuth = auth.toString().trim();
  if (!serverState.roomAuth || cleanAuth === serverState.roomAuth) {
    return true; // Master room password can authenticate any slot
  }
  if (s >= 1 && s <= 4) {
    const expected = getSlotAuth(s);
    return cleanAuth === expected || cleanAuth === '123456' || cleanAuth === '1111';
  }
  return true;
}

function getActiveTimerPayload() {
  if (!serverState.currentTimer) return null;
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((serverState.currentTimer.targetTime - now) / 1000));
  if (remaining > 0) {
    return {
      round: serverState.currentTimer.round,
      duration: serverState.currentTimer.duration,
      startTime: serverState.currentTimer.startTime,
      targetTime: serverState.currentTimer.targetTime,
      remaining: remaining,
      elapsed: Math.floor((now - serverState.currentTimer.startTime) / 1000),
      questionText: serverState.currentTimer.questionText || ''
    };
  } else {
    serverState.currentTimer = null;
    return null;
  }
}

// Function to broadcast messages to all connected WebSocket & SSE clients (LAN & Web)
function broadcastToClients(data, senderWs = null) {
  const jsonStr = JSON.stringify(data);

  // 1. Broadcast to WebSocket clients
  for (const client of wsClients) {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      try {
        client.send(jsonStr);
      } catch (err) {
        wsClients.delete(client);
      }
    }
  }

  // 2. Broadcast to SSE clients
  const sseMsgStr = `data: ${jsonStr}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(sseMsgStr);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Function to process incoming game action and mutate serverState
function handleIncomingAction(action, senderWs = null) {
  if (!action || typeof action !== 'object') return;
  const type = action.type || action.event || 'UNKNOWN_ACTION';
  const now = Date.now();

  serverState.latestAction = action;
  serverState.lastUpdated = now;

  if (type === 'XUAT_PHAT_SELECT_CONTESTANT') {
    serverState.currentXuatPhatTurn = parseInt(action.turnIndex || action.contestantId) || 0;
    serverState.s1QuestionStates = {};
  } else if (type === 'XUAT_PHAT_SELECT_CHUNG' || type === 'XUAT_PHAT_SHOW_GRAPHIC_CAU_HOI') {
    serverState.s1QuestionStates = {};
  } else if (type === 'XUAT_PHAT_RIGHT' || type === 'KHOI_DONG_RIGHT' || type === 'KD_RIGHT') {
    const qIdx = parseInt(action.questionIndex, 10) || 1;
    serverState.s1QuestionStates[qIdx] = 'correct';
  } else if (type === 'XUAT_PHAT_WRONG' || type === 'KHOI_DONG_WRONG' || type === 'KD_WRONG') {
    const qIdx = parseInt(action.questionIndex, 10) || 1;
    serverState.s1QuestionStates[qIdx] = 'wrong';
  } else if (type === 'XUAT_PHAT_RESET') {
    serverState.currentXuatPhatTurn = 0;
    serverState.s1QuestionStates = {};
    serverState.s1HasSelectedDeForTurn = { 1: false, 2: false, 3: false, 4: false };
    serverState.s1ChosenDeMap = { 1: null, 2: null, 3: null, 4: null };
  } else if (type === 'RESET_S1_DE') {
    const tId = action.contestantId;
    if (tId === 'ALL' || !tId) {
      serverState.s1HasSelectedDeForTurn = { 1: false, 2: false, 3: false, 4: false };
      serverState.s1ChosenDeMap = { 1: null, 2: null, 3: null, 4: null };
    } else {
      const cId = parseInt(tId);
      if (cId) {
        serverState.s1HasSelectedDeForTurn[cId] = false;
        serverState.s1ChosenDeMap[cId] = null;
      }
    }
  } else if (type === 'XUAT_PHAT_RANDOM_DE') {
    const tId = parseInt(action.contestantId || action.turnIndex);
    if (tId) {
      serverState.s1HasSelectedDeForTurn[tId] = true;
      if (action.deNumber) serverState.s1ChosenDeMap[tId] = action.deNumber;
    }
  } else if (type === 'RESET_ALL_DATA') {
    serverState.currentXuatPhatTurn = 0;
    serverState.s1QuestionStates = {};
    serverState.s1HasSelectedDeForTurn = { 1: false, 2: false, 3: false, 4: false };
    serverState.s1ChosenDeMap = { 1: null, 2: null, 3: null, 4: null };
  }

  // Handle Client Join / Heartbeats / Pong
  if (type === 'CLIENT_JOIN' || type === 'CLIENT_HEARTBEAT' || type === 'PONG_RESPONSE') {
    const role = action.role || (action.contestantId ? `ts${action.contestantId}` : null);
    if (role && serverState.connectedClients[role]) {
      serverState.connectedClients[role].connected = true;
      serverState.connectedClients[role].lastSeen = now;
      if (action.sessionId) serverState.connectedClients[role].sessionId = action.sessionId;
      if (action.name) serverState.connectedClients[role].name = action.name;
      if (action.sendTime) serverState.connectedClients[role].ping = Math.max(1, now - action.sendTime);
      else if (action.ping !== undefined) serverState.connectedClients[role].ping = action.ping;
    }
  }

  // Handle Client Kick / Disconnect
  if (type === 'KICK_CLIENT') {
    const targetRole = action.role || action.target || (action.contestantId ? `ts${action.contestantId}` : null);
    if (targetRole && serverState.connectedClients[targetRole]) {
      serverState.connectedClients[targetRole].connected = false;
      serverState.connectedClients[targetRole].sessionId = null;
      serverState.connectedClients[targetRole].lastSeen = 0;
      serverState.connectedClients[targetRole].name = '';
    } else if (targetRole === 'all') {
      Object.keys(serverState.connectedClients).forEach(r => {
        serverState.connectedClients[r].connected = false;
        serverState.connectedClients[r].sessionId = null;
        serverState.connectedClients[r].lastSeen = 0;
        serverState.connectedClients[r].name = '';
      });
    }
  }

  // Handle Room Code Changes
  if (type === 'SET_ROOM_CODE') {
    if (action.roomCode) serverState.roomCode = action.roomCode.trim().toUpperCase();
    if (action.roomAuth !== undefined || action.auth !== undefined) {
      serverState.roomAuth = (action.roomAuth || action.auth || '').trim();
    }
    if (action.slotAuth && typeof action.slotAuth === 'object') {
      serverState.slotAuth = Object.assign({}, serverState.slotAuth, action.slotAuth);
    }
    // Invalidate all existing player connections when room credentials change
    Object.keys(serverState.connectedClients).forEach(r => {
      serverState.connectedClients[r].connected = false;
      serverState.connectedClients[r].sessionId = null;
      serverState.connectedClients[r].lastSeen = 0;
    });
    broadcastToClients({
      type: 'ROOM_CREDENTIALS_CHANGED',
      roomCode: serverState.roomCode,
      roomAuth: serverState.roomAuth,
      slotAuth: getAllSlotAuths(),
      timestamp: now
    });
  }

  // Handle Contestant & Game Data updates from any action
  if (action.contestants && Array.isArray(action.contestants)) {
    serverState.contestants = action.contestants;
    if (serverState.gameData) serverState.gameData.contestants = action.contestants;
  }
  if (action.gameData && typeof action.gameData === 'object') {
    serverState.gameData = Object.assign(serverState.gameData || {}, action.gameData);
    if (action.gameData.contestants && Array.isArray(action.gameData.contestants)) {
      serverState.contestants = action.gameData.contestants;
    }
  }
  if (action.scoreboardThumbnailStates && typeof action.scoreboardThumbnailStates === 'object') {
    serverState.scoreboardThumbnailStates = Object.assign({}, serverState.scoreboardThumbnailStates, action.scoreboardThumbnailStates);
  }
  if (action.scoreboardInfoStates && typeof action.scoreboardInfoStates === 'object') {
    serverState.scoreboardInfoStates = Object.assign({}, serverState.scoreboardInfoStates, action.scoreboardInfoStates);
  }
  if (type === 'TOGGLE_SCOREBOARD_THUMBNAIL' || type === 'SHOW_SCOREBOARD_THUMBNAIL' || type === 'HIDE_SCOREBOARD_THUMBNAIL') {
    const targetId = action.contestantId || action.targetSlot || 'ALL';
    const showVal = type === 'SHOW_SCOREBOARD_THUMBNAIL' ? true : (type === 'HIDE_SCOREBOARD_THUMBNAIL' ? false : !!action.show);
    if (targetId === 'ALL') {
      serverState.scoreboardThumbnailStates = { 1: showVal, 2: showVal, 3: showVal, 4: showVal };
    } else {
      const cId = parseInt(targetId, 10);
      if (cId >= 1 && cId <= 4) serverState.scoreboardThumbnailStates[cId] = showVal;
    }
  }
  if (type === 'TOGGLE_SCOREBOARD_INFO' || type === 'SHOW_SCOREBOARD_INFO' || type === 'HIDE_SCOREBOARD_INFO') {
    const targetId = action.contestantId || action.targetSlot || 'ALL';
    const showVal = type === 'SHOW_SCOREBOARD_INFO' ? true : (type === 'HIDE_SCOREBOARD_INFO' ? false : !!action.show);
    if (targetId === 'ALL') {
      serverState.scoreboardInfoStates = { 1: showVal, 2: showVal, 3: showVal, 4: showVal };
    } else {
      const cId = parseInt(targetId, 10);
      if (cId >= 1 && cId <= 4) serverState.scoreboardInfoStates[cId] = showVal;
    }
  }

  // Handle Player Answer Submissions
  if (type === 'PLAYER_SUBMIT_ANSWER' && action.contestantId) {
    const tsIdx = action.contestantId;
    const rKey = action.round ? `ts${tsIdx}_${action.round}` : `ts${tsIdx}`;
    serverState.playerAnswers[`ts${tsIdx}`] = {
      contestantId: tsIdx,
      answer: action.answer || '',
      time: action.time || '00.00',
      round: action.round || '',
      isVongThi: !!action.isVongThi,
      timestamp: now
    };
    serverState.playerAnswers[rKey] = serverState.playerAnswers[`ts${tsIdx}`];
  }

  // Handle Player Ring Bell
  if (type === 'PLAYER_RING_BELL' && action.contestantId) {
    const tsIdx = parseInt(action.contestantId, 10) || action.contestantId;
    const rUpper = (action.round || '').toString().toUpperCase();
    const isR1Bell = (rUpper === 'KD' || rUpper === 'XUAT_PHAT' || rUpper === 'KHOI_DONG' || rUpper === 'XP' || (!rUpper && serverState.activeRound === 'XUAT_PHAT'));
    const isR4Bell = (rUpper === 'VQ' || rUpper === 'VINH_QUANG' || rUpper === 'VE_DICH' || (!rUpper && serverState.activeRound === 'VINH_QUANG'));
    const isR5Bell = (rUpper === 'CHP' || rUpper === 'CAU_HOI_PHU' || (!rUpper && (serverState.activeRound === 'CAU_HOI_PHU' || serverState.activeRound === 'CHP')));

    let resolvedBellTime = action.time || '00.00';
    if (isR1Bell) {
      if (serverState.currentXuatPhatTurn !== 5 || serverState.xpBuzzerLocked || !serverState.xpBuzzerOpen) {
        return; // Ignore late or out-of-turn buzzes so only the single fastest contestant wins
      }
      serverState.xpBuzzerLocked = true;
      serverState.xpBuzzerOpen = false;
      serverState.xpBuzzerWinner = parseInt(tsIdx, 10) || 0;
      const rawBell = (action.bellTime !== undefined && action.bellTime !== null && String(action.bellTime).trim() !== '')
        ? action.bellTime
        : (action.time && action.time !== '00.00' ? action.time : '');
      const parsedBell = rawBell !== '' ? parseFloat(String(rawBell).replace(/s|giây/gi, '').trim()) : NaN;
      resolvedBellTime = (!isNaN(parsedBell) && parsedBell >= 0)
        ? parsedBell.toFixed(2)
        : (serverState.xpBellUnlockedAt > 0 ? Math.max(0, (now - serverState.xpBellUnlockedAt) / 1000).toFixed(2) : '0.00');
      serverState.xpBuzzerWinnerTime = resolvedBellTime;
      serverState.xpBellUnlockedAt = 0;
      action.winnerId = serverState.xpBuzzerWinner;
      action.turnIndex = 5;
      action.bellTime = resolvedBellTime;
      action.time = resolvedBellTime;
    } else if (isR4Bell) {
      const bellNum = parseInt(tsIdx, 10) || 0;
      if (
        serverState.vqBuzzerLocked ||
        !serverState.vqBuzzerOpen ||
        bellNum < 1 ||
        bellNum > 4 ||
        (serverState.vqMainContestant >= 1 && bellNum === serverState.vqMainContestant)
      ) {
        return; // Ignore main contestant or late/out-of-turn buzzes in Round 4
      }
      serverState.vqBuzzerLocked = true;
      serverState.vqBuzzerOpen = false;
      serverState.vqBuzzerWinner = bellNum;
      const rawBell = (action.bellTime !== undefined && action.bellTime !== null && String(action.bellTime).trim() !== '')
        ? action.bellTime
        : (action.time && action.time !== '00.00' ? action.time : '');
      const parsedBell = rawBell !== '' ? parseFloat(String(rawBell).replace(/s|giây/gi, '').trim()) : NaN;
      resolvedBellTime = (!isNaN(parsedBell) && parsedBell >= 0)
        ? parsedBell.toFixed(2)
        : (serverState.vqBellUnlockedAt > 0 ? Math.max(0, (now - serverState.vqBellUnlockedAt) / 1000).toFixed(2) : '0.00');
      serverState.vqBuzzerWinnerTime = resolvedBellTime;
      serverState.vqBellUnlockedAt = 0;
      action.winnerId = bellNum;
      action.round = 'VQ';
      action.bellTime = resolvedBellTime;
      action.time = resolvedBellTime;
    } else if (isR5Bell) {
      const bellNum = parseInt(tsIdx, 10) || 0;
      const participants = Array.isArray(serverState.chpParticipants) ? serverState.chpParticipants : [1, 2, 3, 4];
      const eliminated = Array.isArray(serverState.chpEliminated) ? serverState.chpEliminated : [];
      if (
        serverState.chpBuzzerLocked ||
        !serverState.chpBuzzerOpen ||
        bellNum < 1 ||
        bellNum > 4 ||
        !participants.includes(bellNum) ||
        eliminated.includes(bellNum)
      ) {
        return; // Ignore non-participant, eliminated, or late/out-of-turn buzzes in Round 5
      }
      serverState.chpBuzzerLocked = true;
      serverState.chpBuzzerOpen = false;
      serverState.chpBuzzerWinner = bellNum;
      if (serverState.currentTimer && (serverState.currentTimer.round === 'CAU_HOI_PHU' || serverState.currentTimer.round === 'CHP')) {
        serverState.chpRemainingMs = Math.max(0, serverState.currentTimer.targetTime - now);
        serverState.currentTimer = null;
      }
      const rawBell = (action.bellTime !== undefined && action.bellTime !== null && String(action.bellTime).trim() !== '')
        ? action.bellTime
        : (action.time && action.time !== '00.00' ? action.time : '');
      const parsedBell = rawBell !== '' ? parseFloat(String(rawBell).replace(/s|giây/gi, '').trim()) : NaN;
      resolvedBellTime = (!isNaN(parsedBell) && parsedBell >= 0)
        ? parsedBell.toFixed(2)
        : (serverState.chpBellUnlockedAt > 0 ? Math.max(0, (now - serverState.chpBellUnlockedAt) / 1000).toFixed(2) : '0.00');
      serverState.chpBuzzerWinnerTime = resolvedBellTime;
      serverState.chpBellUnlockedAt = 0;
      action.winnerId = bellNum;
      action.round = 'CHP';
      action.remainingMs = serverState.chpRemainingMs;
      action.bellTime = resolvedBellTime;
      action.time = resolvedBellTime;
    }

    const rKey = action.round ? `ts${tsIdx}_${action.round}` : `ts${tsIdx}`;
    serverState.playerAnswers[`ts${tsIdx}`] = {
      contestantId: tsIdx,
      answer: action.answer || '',
      time: resolvedBellTime || '00.00',
      round: action.round || 'VS',
      isVongThi: true,
      timestamp: now
    };
    serverState.playerAnswers[rKey] = serverState.playerAnswers[`ts${tsIdx}`];
  }

  // Handle Reset Vuot Song Bell specifically
  if (type === 'RESET_VS_BELL' || type === 'VUOT_SONG_RESET_BELL') {
    const targetC = action.contestantId;
    if (targetC === 'ALL' || !targetC) {
      for (const k of Object.keys(serverState.playerAnswers)) {
        if (serverState.playerAnswers[k].round === 'VS' || k.endsWith('_VS') || k.endsWith('_VUOT_SONG')) {
          delete serverState.playerAnswers[k];
        }
      }
    } else {
      const cId = parseInt(targetC);
      delete serverState.playerAnswers[`ts${cId}_VS`];
      delete serverState.playerAnswers[`ts${cId}`];
    }
  }

  // Handle Reset / Clear Answers on question switch or explicit clear
  if (
    type === 'CLEAR_PLAYER_ANSWERS' ||
    type === 'RA_KHOI_SHOW_QUESTION' ||
    type === 'RA_KHOI_OPEN_QUESTION' ||
    type === 'RA_KHOI_RESET' ||
    type === 'VUOT_SONG_SELECT_ROW' ||
    type === 'VUOT_SONG_SHOW_QUESTION' ||
    type === 'VUOT_SONG_OPEN_HANG_NGANG' ||
    type === 'VUOT_SONG_RESET' ||
    type === 'VINH_QUANG_SELECT_PACK' ||
    type === 'VINH_QUANG_SHOW_QUESTION' ||
    type === 'VINH_QUANG_START' ||
    type === 'VINH_QUANG_RESET'
  ) {
    if (action.round) {
      for (const k of Object.keys(serverState.playerAnswers)) {
        if (serverState.playerAnswers[k].round === action.round || k.endsWith(`_${action.round}`)) {
          delete serverState.playerAnswers[k];
        }
      }
    } else {
      serverState.playerAnswers = {};
    }
  }

  // Handle Complete Data Reset
  if (type === 'RESET_ALL_DATA') {
    serverState.playerAnswers = {};
    if (serverState.contestants) {
      serverState.contestants.forEach(c => { c.score = 0; });
    }
    if (serverState.gameData && serverState.gameData.contestants) {
      serverState.gameData.contestants.forEach(c => { c.score = 0; });
    }
    serverState.currentXuatPhatTurn = 0;
    serverState.s1QuestionStates = {};
    serverState.xpBuzzerOpen = false;
    serverState.xpBuzzerLocked = true;
    serverState.xpBuzzerWinner = 0;
    serverState.xpBellUnlockedAt = 0;
    serverState.xpBuzzerWinnerTime = '';
    serverState.vsLockedContestants = { 1: false, 2: false, 3: false, 4: false };
    serverState.vsRoundStartTime = 0;
    serverState.vuotSongRow = 0;
    serverState.vqMainContestant = 0;
    serverState.vqBuzzerOpen = false;
    serverState.vqBuzzerLocked = true;
    serverState.vqBuzzerWinner = 0;
    serverState.vqBellUnlockedAt = 0;
    serverState.vqBuzzerWinnerTime = '';
    serverState.chpQuestionShown = false;
    serverState.chpParticipants = [1, 2, 3, 4];
    serverState.chpEliminated = [];
    serverState.chpBuzzerOpen = false;
    serverState.chpBuzzerLocked = true;
    serverState.chpBuzzerWinner = 0;
    serverState.chpBellUnlockedAt = 0;
    serverState.chpBuzzerWinnerTime = '';
    serverState.chpRightWinnerName = '';
    serverState.chpRemainingMs = 15000;
    serverState.currentQuestion = null;
    serverState.currentTimer = null;
    serverState.buzzerState = { buzzerUnlocked: false, buzzerWinner: null };
  }

  // Handle Tossup & Buzzer control
  if (type === 'control-to-display' && action.payload) {
    if (action.payload.type === 'START_TOSSAV' || action.payload.type === 'START_TOSSUP' || action.payload.type === 'PLAY_TOSSUP') {
      serverState.buzzerState.buzzerUnlocked = true;
      serverState.buzzerState.buzzerWinner = null;
    } else if (
      action.payload.type === 'REVEAL_ALL' ||
      action.payload.type === 'RESET_BOARD' ||
      action.payload.type === 'LOAD_QUIZ' ||
      action.payload.type === 'SHOW_MANUAL_TEXT'
    ) {
      serverState.buzzerState.buzzerUnlocked = false;
      serverState.buzzerState.buzzerWinner = null;
    }
    action.buzzerState = serverState.buzzerState;
  } else if (type === 'player-buzz' && action.payload && action.payload.playerNum) {
    if (serverState.buzzerState.buzzerUnlocked && !serverState.buzzerState.buzzerWinner) {
      serverState.buzzerState.buzzerWinner = action.payload.playerNum;
    }
    action.buzzerState = serverState.buzzerState;
  }

  // Track Active Round across scenes (Ignore Controller tab switches so Player does not switch with Controller tabs)
  if (type !== 'SWITCH_ROUND_PLAYER_MC') {
    if (action.activeRound || action.round) {
      const incomingR = (action.activeRound || action.round || '').toString().toUpperCase();
      if (incomingR && incomingR !== 'HE_THONG') {
        serverState.activeRound = (incomingR === 'CHP' || incomingR === 'CAU_HOI_PHU') ? 'CAU_HOI_PHU' : (action.activeRound || action.round);
      }
    } else if (type.startsWith('XUAT_PHAT_')) {
      serverState.activeRound = 'XUAT_PHAT';
    } else if (type.startsWith('RA_KHOI_')) {
      serverState.activeRound = 'RA_KHOI';
    } else if (type.startsWith('VUOT_SONG_')) {
      serverState.activeRound = 'VUOT_SONG';
    } else if (type.startsWith('VINH_QUANG_')) {
      serverState.activeRound = 'VINH_QUANG';
    } else if (type.startsWith('CAU_HOI_PHU_')) {
      serverState.activeRound = 'CAU_HOI_PHU';
    } else if (type === 'SWITCH_VIEW') {
      if (action.viewNum === 1) serverState.activeRound = 'XUAT_PHAT';
      else if (action.viewNum === 2) serverState.activeRound = 'RA_KHOI';
      else if (action.viewNum === 3 || action.viewNum === 4 || action.viewNum === 5) serverState.activeRound = 'VUOT_SONG';
      else if (action.viewNum === 6 || action.viewNum === 7 || action.viewNum === 8) serverState.activeRound = 'VINH_QUANG';
    }
  }

  // Allow external state syncs (from projector or controller) to update currentTimer directly
  if (action.currentTimer && typeof action.currentTimer === 'object') {
    serverState.currentTimer = action.currentTimer;
  }

  // Track Question Visibility & Turn 5 Buzzer State across rounds
  // 1. Xuat Phat: Visible when question is explicitly shown or next question is triggered
  if (type === 'XUAT_PHAT_SELECT_CONTESTANT') {
    serverState.currentXuatPhatTurn = parseInt(action.turnIndex || action.contestantId, 10) || 1;
    serverState.xpBuzzerOpen = false;
    serverState.xpBuzzerLocked = true;
    serverState.xpBuzzerWinner = 0;
    serverState.xpBellUnlockedAt = 0;
    serverState.xpBuzzerWinnerTime = '';
  } else if (type === 'XUAT_PHAT_SELECT_CHUNG') {
    serverState.currentXuatPhatTurn = 5;
    serverState.xpBuzzerOpen = false;
    serverState.xpBuzzerLocked = true;
    serverState.xpBuzzerWinner = 0;
    serverState.xpBellUnlockedAt = 0;
    serverState.xpBuzzerWinnerTime = '';
  } else if (type === 'XUAT_PHAT_SHOW_FASTEST_HL' || type === 'LOCK_BELLS') {
    if (serverState.currentXuatPhatTurn === 5 || parseInt(action.turnIndex, 10) === 5) {
      serverState.currentXuatPhatTurn = 5;
      serverState.xpBuzzerOpen = false;
      serverState.xpBuzzerLocked = true;
      serverState.xpBellUnlockedAt = 0;
      const w = parseInt(action.contestantIndex || action.whoBuzzed || action.contestantId || action.winnerId, 10);
      if (w >= 1 && w <= 4) serverState.xpBuzzerWinner = w;
      if (action.bellTime) serverState.xpBuzzerWinnerTime = String(action.bellTime);
    }
  } else if (type === 'UNLOCK_BELLS') {
    if (serverState.currentXuatPhatTurn === 5 || parseInt(action.turnIndex, 10) === 5) {
      serverState.currentXuatPhatTurn = 5;
      serverState.xpBuzzerOpen = true;
      serverState.xpBuzzerLocked = false;
      serverState.xpBuzzerWinner = 0;
      serverState.xpBellUnlockedAt = now;
      serverState.xpBuzzerWinnerTime = '';
    }
  }

  if (type === 'XUAT_PHAT_BAT_DAU_CAU_HOI' || type === 'XUAT_PHAT_HIEN_CAU_HOI' || type === 'XUAT_PHAT_NEXT_QUESTION') {
    serverState.xpQuestionShown = true;
    if (action.turnIndex !== undefined) {
      serverState.currentXuatPhatTurn = parseInt(action.turnIndex, 10) || serverState.currentXuatPhatTurn;
    }
    if (serverState.currentXuatPhatTurn === 5) {
      const shouldUnlock = action.unlockBells !== false;
      serverState.xpBuzzerOpen = shouldUnlock;
      serverState.xpBuzzerLocked = !shouldUnlock;
      serverState.xpBuzzerWinner = 0;
      serverState.xpBellUnlockedAt = shouldUnlock ? now : 0;
      serverState.xpBuzzerWinnerTime = '';
    }
  } else if (type === 'XUAT_PHAT_START_TIMER') {
    serverState.xpQuestionShown = true;
  } else if (type === 'XUAT_PHAT_RIGHT' || type === 'XUAT_PHAT_WRONG') {
    if (serverState.currentXuatPhatTurn === 5) {
      serverState.xpBuzzerOpen = false;
      serverState.xpBuzzerLocked = true;
      serverState.xpBellUnlockedAt = 0;
    }
  } else if (
    type === 'XUAT_PHAT_RESET' ||
    type === 'XUAT_PHAT_FINISH' ||
    type === 'XUAT_PHAT_SELECT_CONTESTANT' ||
    type === 'XUAT_PHAT_SELECT_CHUNG' ||
    type === 'XUAT_PHAT_SHOW_QUESTION' ||
    type === 'XUAT_PHAT_RANDOM_DE' ||
    type === 'XUAT_PHAT_SHOW_GRAPHIC_CHON_DE' ||
    type === 'XUAT_PHAT_SHOW_GRAPHIC_CAU_HOI' ||
    type === 'SWITCH_ROUND' ||
    type === 'START_ROUND_CLEAN' ||
    type === 'RESET_ALL_DATA'
  ) {
    serverState.xpQuestionShown = false;
    if (type === 'XUAT_PHAT_SHOW_GRAPHIC_CAU_HOI') {
      if (action.turnIndex !== undefined) {
        serverState.currentXuatPhatTurn = parseInt(action.turnIndex, 10) || serverState.currentXuatPhatTurn;
      }
      serverState.xpBuzzerOpen = false;
      serverState.xpBuzzerLocked = true;
      serverState.xpBuzzerWinner = 0;
      serverState.xpBellUnlockedAt = 0;
      serverState.xpBuzzerWinnerTime = '';
    } else if (type === 'XUAT_PHAT_RESET' || type === 'XUAT_PHAT_FINISH' || (type === 'START_ROUND_CLEAN' && (!action.round || String(action.round).toUpperCase() === 'XUAT_PHAT'))) {
      serverState.currentXuatPhatTurn = 0;
      serverState.s1QuestionStates = {};
      serverState.xpBuzzerOpen = false;
      serverState.xpBuzzerLocked = true;
      serverState.xpBuzzerWinner = 0;
      serverState.xpBellUnlockedAt = 0;
      serverState.xpBuzzerWinnerTime = '';
    }
  }

  // 2. Vuot Song: Only visible when VUOT_SONG_SHOW_QUESTION is explicitly called
  if (action.roundStartTime && (type.startsWith('VUOT_SONG_') || (type === 'START_ROUND_CLEAN' && String(action.round || '').toUpperCase() === 'VUOT_SONG'))) {
    serverState.vsRoundStartTime = Number(action.roundStartTime) || now;
  }
  if (type === 'VUOT_SONG_LOCK_CONTESTANT') {
    if (action.vsLockedContestants && typeof action.vsLockedContestants === 'object') {
      serverState.vsLockedContestants = {
        1: !!action.vsLockedContestants[1],
        2: !!action.vsLockedContestants[2],
        3: !!action.vsLockedContestants[3],
        4: !!action.vsLockedContestants[4]
      };
    } else {
      const cid = parseInt(action.contestantId, 10);
      if (cid >= 1 && cid <= 4) {
        serverState.vsLockedContestants[cid] = !!action.locked;
      }
    }
  } else if (type === 'VUOT_SONG_UNLOCK_CONTESTANT') {
    if (action.contestantId === 'ALL' || !action.contestantId) {
      serverState.vsLockedContestants = { 1: false, 2: false, 3: false, 4: false };
    } else {
      const cid = parseInt(action.contestantId, 10);
      if (cid >= 1 && cid <= 4) {
        serverState.vsLockedContestants[cid] = false;
      }
    }
  } else if (type === 'VUOT_SONG_UNLOCK_ALL') {
    serverState.vsLockedContestants = { 1: false, 2: false, 3: false, 4: false };
  }

  if (type === 'VUOT_SONG_SHOW_QUESTION') {
    serverState.vsQuestionShown = true;
  } else if (
    type === 'VUOT_SONG_SELECT_ROW' ||
    type === 'VUOT_SONG_RETURN_GRID' ||
    type === 'VUOT_SONG_RESET' ||
    type === 'VUOT_SONG_INTRO' ||
    type === 'SWITCH_ROUND' ||
    type === 'START_ROUND_CLEAN' ||
    type === 'RESET_ALL_DATA'
  ) {
    serverState.vsQuestionShown = false;
    if (type === 'VUOT_SONG_RESET' || (type === 'START_ROUND_CLEAN' && (!action.round || String(action.round).toUpperCase() === 'VUOT_SONG'))) {
      serverState.vsLockedContestants = { 1: false, 2: false, 3: false, 4: false };
      serverState.vsRoundStartTime = Number(action.roundStartTime) || now;
      if (type === 'VUOT_SONG_RESET') serverState.vuotSongRow = 0;
    }
  }

  // 3. Vinh Quang: Only visible when VINH_QUANG_SHOW_QUESTION is explicitly called
  if (type === 'VINH_QUANG_SELECT_PLAYER') {
    const mc = parseInt(action.mainContestant || action.contestantIndex, 10) || 0;
    if (mc >= 1 && mc <= 4) serverState.vqMainContestant = mc;
    serverState.activeRound = 'VINH_QUANG';
    serverState.vqBuzzerOpen = false;
    serverState.vqBuzzerLocked = true;
    serverState.vqBuzzerWinner = 0;
  } else if (type === 'VINH_QUANG_CHOOSE_PACK') {
    const mc = parseInt(action.mainContestant || action.contestantIndex, 10) || 0;
    if (mc >= 1 && mc <= 4) serverState.vqMainContestant = mc;
    serverState.vqQuestionShown = false;
    serverState.currentTimer = null;
    serverState.activeRound = 'VINH_QUANG';
    serverState.vqBuzzerOpen = false;
    serverState.vqBuzzerLocked = true;
    serverState.vqBuzzerWinner = 0;
  } else if (type === 'VINH_QUANG_SHOW_QUESTION') {
    serverState.vqQuestionShown = true;
    serverState.activeRound = 'VINH_QUANG';
    const mc = parseInt(action.mainContestant || action.contestantIndex, 10) || 0;
    if (mc >= 1 && mc <= 4) serverState.vqMainContestant = mc;
    serverState.vqBuzzerOpen = false;
    serverState.vqBuzzerLocked = true;
    serverState.vqBuzzerWinner = 0;
    if (action.questionText) {
      serverState.currentQuestion = {
        questionText: action.questionText,
        questionIndex: action.questionIndex || 1,
        pack: action.pack || 10,
        subject: action.subject || '',
        answerText: action.answerText || action.answer || '',
        round: 'VINH_QUANG'
      };
    }
  } else if (type === 'VINH_QUANG_START_TIMER_5S' || type === 'VINH_QUANG_UNLOCK_BELLS') {
    const mc = parseInt(action.mainContestant || action.contestantIndex, 10) || 0;
    if (mc >= 1 && mc <= 4) serverState.vqMainContestant = mc;
    serverState.activeRound = 'VINH_QUANG';
    serverState.vqBuzzerOpen = true;
    serverState.vqBuzzerLocked = false;
    serverState.vqBuzzerWinner = 0;
    serverState.vqBellUnlockedAt = now;
    serverState.vqBuzzerWinnerTime = '';
  } else if (type === 'VINH_QUANG_SHOW_FASTEST_HL' || type === 'VINH_QUANG_LOCK_BELLS') {
    serverState.vqBuzzerOpen = false;
    serverState.vqBuzzerLocked = true;
    serverState.vqBellUnlockedAt = 0;
    const w = parseInt(action.contestantIndex || action.whoBuzzed || action.contestantId || action.winnerId, 10);
    if (w >= 1 && w <= 4) serverState.vqBuzzerWinner = w;
    if (action.bellTime) serverState.vqBuzzerWinnerTime = String(action.bellTime);
  } else if (type === 'VINH_QUANG_RIGHT' || type === 'VINH_QUANG_WRONG') {
    serverState.vqBuzzerOpen = false;
    serverState.vqBuzzerLocked = true;
    serverState.vqBuzzerWinner = 0;
    serverState.vqBellUnlockedAt = 0;
    serverState.vqBuzzerWinnerTime = '';
  } else if (
    type === 'VINH_QUANG_HIDE_PACK' ||
    type === 'VINH_QUANG_HIDE_QUESTION' ||
    type === 'VINH_QUANG_HIDE_ALL'
  ) {
    serverState.vqQuestionShown = false;
    serverState.currentTimer = null;
    serverState.vqBuzzerOpen = false;
    serverState.vqBuzzerLocked = true;
    serverState.vqBuzzerWinner = 0;
  } else if (
    type === 'VINH_QUANG_SELECT_PACK' ||
    type === 'VINH_QUANG_SHOW_PACKS'
  ) {
    serverState.vqQuestionShown = false;
    serverState.currentTimer = null;
    serverState.activeRound = 'VINH_QUANG';
    serverState.vqBuzzerOpen = false;
    serverState.vqBuzzerLocked = true;
    serverState.vqBuzzerWinner = 0;
  } else if (
    type === 'VINH_QUANG_RESET' ||
    type === 'VINH_QUANG_FINISH' ||
    type === 'VINH_QUANG_INTRO' ||
    type === 'VINH_QUANG_PHAN_THI' ||
    type === 'SWITCH_VIEW' ||
    type === 'SWITCH_ROUND' ||
    type === 'START_ROUND_CLEAN' ||
    type === 'RESET_ALL_DATA'
  ) {
    serverState.vqQuestionShown = false;
    serverState.currentTimer = null;
    serverState.vqBuzzerOpen = false;
    serverState.vqBuzzerLocked = true;
    serverState.vqBuzzerWinner = 0;
    if (action.round) serverState.activeRound = action.round;
    if (type === 'RESET_ALL_DATA' || type === 'VINH_QUANG_RESET' || type === 'VINH_QUANG_FINISH' || type === 'VINH_QUANG_INTRO' || type === 'START_ROUND_CLEAN') {
      serverState.vqMainContestant = 0;
    }
    if (type === 'RESET_ALL_DATA' || type === 'VINH_QUANG_RESET' || type === 'VINH_QUANG_FINISH') {
      serverState.currentQuestion = null;
    }
  }

  // 4. Cau Hoi Phu: Round 5 state & buzzer tracking
  if (type === 'CAU_HOI_PHU_SHOW_QUESTION') {
    serverState.activeRound = 'CAU_HOI_PHU';
    serverState.chpQuestionShown = true;
    serverState.chpParticipants = Array.isArray(action.participatingContestants)
      ? action.participatingContestants.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4)
      : [1, 2, 3, 4];
    serverState.chpEliminated = [];
    serverState.chpBuzzerOpen = true;
    serverState.chpBuzzerLocked = false;
    serverState.chpBuzzerWinner = 0;
    serverState.chpBellUnlockedAt = now;
    serverState.chpBuzzerWinnerTime = '';
    serverState.chpRightWinnerName = '';
    serverState.chpRemainingMs = 15000;
    serverState.currentTimer = null;
  } else if (type === 'CAU_HOI_PHU_START_TIMER') {
    serverState.activeRound = 'CAU_HOI_PHU';
    serverState.chpQuestionShown = true;
    if (Array.isArray(action.participatingContestants)) {
      serverState.chpParticipants = action.participatingContestants.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4);
    }
    serverState.chpEliminated = Array.isArray(action.eliminatedContestants)
      ? action.eliminatedContestants.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4)
      : [];
    serverState.chpBuzzerOpen = true;
    serverState.chpBuzzerLocked = false;
    serverState.chpBuzzerWinner = 0;
    serverState.chpBellUnlockedAt = now;
    serverState.chpBuzzerWinnerTime = '';
    serverState.chpRightWinnerName = '';
    const dur = Number(action.duration) || 15;
    const remMs = Number(action.remainingMs) || (dur * 1000);
    serverState.chpRemainingMs = remMs;
    const st = action.startTime || now;
    serverState.currentTimer = {
      round: 'CAU_HOI_PHU',
      duration: dur,
      startTime: st,
      targetTime: st + remMs,
      questionText: action.questionText || serverState.currentQuestion?.questionText || ''
    };
  } else if (type === 'CAU_HOI_PHU_BUZZ') {
    serverState.activeRound = 'CAU_HOI_PHU';
    serverState.chpBuzzerOpen = false;
    serverState.chpBuzzerLocked = true;
    serverState.chpBellUnlockedAt = 0;
    serverState.chpRightWinnerName = '';
    const w = parseInt(action.winnerId || action.contestantId, 10) || 0;
    if (w >= 1 && w <= 4) serverState.chpBuzzerWinner = w;
    if (action.bellTime) serverState.chpBuzzerWinnerTime = String(action.bellTime);
    if (action.remainingMs !== undefined) {
      serverState.chpRemainingMs = Math.max(0, Number(action.remainingMs) || 0);
    }
    serverState.currentTimer = null;
  } else if (type === 'CAU_HOI_PHU_RIGHT') {
    serverState.activeRound = 'CAU_HOI_PHU';
    serverState.chpBuzzerOpen = false;
    serverState.chpBuzzerLocked = true;
    serverState.chpBuzzerWinner = 0;
    serverState.chpBellUnlockedAt = 0;
    serverState.chpRightWinnerName = action.contestantName || (action.winnerId ? `Thí sinh ${action.winnerId}` : 'Thí sinh');
    serverState.currentTimer = null;
  } else if (type === 'CAU_HOI_PHU_WRONG') {
    serverState.activeRound = 'CAU_HOI_PHU';
    serverState.chpBuzzerOpen = false;
    serverState.chpBuzzerLocked = true;
    serverState.chpBuzzerWinner = 0;
    serverState.chpBellUnlockedAt = 0;
    serverState.chpRightWinnerName = '';
    if (Array.isArray(action.eliminatedContestants)) {
      serverState.chpEliminated = action.eliminatedContestants.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4);
    } else {
      const wrongId = parseInt(action.contestantId, 10) || 0;
      if (wrongId >= 1 && wrongId <= 4 && !serverState.chpEliminated.includes(wrongId)) {
        serverState.chpEliminated.push(wrongId);
      }
    }
    if (action.remainingMs !== undefined) {
      serverState.chpRemainingMs = Math.max(0, Number(action.remainingMs) || 0);
    }
    serverState.currentTimer = null;
  } else if (type === 'CAU_HOI_PHU_CONTINUE') {
    serverState.activeRound = 'CAU_HOI_PHU';
    if (Array.isArray(action.participatingContestants)) {
      serverState.chpParticipants = action.participatingContestants.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4);
    }
    if (Array.isArray(action.eliminatedContestants)) {
      serverState.chpEliminated = action.eliminatedContestants.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4);
    }
    const remMs = action.remainingMs !== undefined ? Math.max(0, Number(action.remainingMs) || 0) : serverState.chpRemainingMs;
    serverState.chpRemainingMs = remMs;
    serverState.chpBuzzerWinner = 0;
    serverState.chpRightWinnerName = '';
    serverState.chpBuzzerOpen = remMs > 0;
    serverState.chpBuzzerLocked = remMs <= 0;
    serverState.chpBellUnlockedAt = remMs > 0 ? now : 0;
    if (action.timerStarted !== false && remMs > 0) {
      serverState.currentTimer = {
        round: 'CAU_HOI_PHU',
        duration: remMs / 1000,
        startTime: now,
        targetTime: now + remMs,
        questionText: serverState.currentQuestion?.questionText || ''
      };
    } else {
      serverState.currentTimer = null;
    }
  } else if (type === 'CAU_HOI_PHU_TIMEOUT') {
    serverState.activeRound = 'CAU_HOI_PHU';
    serverState.chpBuzzerOpen = false;
    serverState.chpBuzzerLocked = true;
    serverState.chpBuzzerWinner = 0;
    serverState.chpBellUnlockedAt = 0;
    serverState.chpRemainingMs = 0;
    serverState.currentTimer = null;
  } else if (
    type === 'CAU_HOI_PHU_RESET' ||
    type === 'SWITCH_VIEW' ||
    type === 'SWITCH_ROUND' ||
    type === 'START_ROUND_CLEAN' ||
    type === 'RESET_ALL_DATA'
  ) {
    serverState.chpQuestionShown = false;
    serverState.chpEliminated = [];
    serverState.chpBuzzerOpen = false;
    serverState.chpBuzzerLocked = true;
    serverState.chpBuzzerWinner = 0;
    serverState.chpBellUnlockedAt = 0;
    serverState.chpBuzzerWinnerTime = '';
    serverState.chpRightWinnerName = '';
    serverState.chpRemainingMs = 15000;
    if (type === 'CAU_HOI_PHU_RESET') {
      serverState.currentTimer = null;
      if (Array.isArray(action.participatingContestants)) {
        serverState.chpParticipants = action.participatingContestants.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= 4);
      }
    }
  }

  // Track Question & Grid Info (preserve mediaUrl, mediaType, pack, subject, row)
  if (
    type === 'START_ROUND_CLEAN' ||
    type === 'XUAT_PHAT_RESET' ||
    type === 'RA_KHOI_RESET' ||
    type === 'VUOT_SONG_RESET' ||
    type === 'VINH_QUANG_RESET' ||
    type === 'CAU_HOI_PHU_RESET' ||
    type === 'RESET_ALL_DATA'
  ) {
    serverState.currentQuestion = null;
  } else if (
    action.questionText !== undefined ||
    action.question !== undefined ||
    action.mediaUrl !== undefined ||
    type === 'RA_KHOI_SELECT_QUESTION' ||
    type === 'RA_KHOI_SHOW_QUESTION' ||
    type === 'VUOT_SONG_SELECT_ROW' ||
    type === 'VUOT_SONG_SHOW_QUESTION' ||
    type === 'VINH_QUANG_SHOW_QUESTION' ||
    type === 'CAU_HOI_PHU_SHOW_QUESTION'
  ) {
    const prevQ = serverState.currentQuestion || {};
    const sameRound = prevQ.round === serverState.activeRound;
    serverState.currentQuestion = {
      questionText: action.questionText !== undefined ? action.questionText : (action.question !== undefined ? action.question : (sameRound ? (prevQ.questionText || '') : '')),
      questionIndex: action.questionIndex !== undefined ? action.questionIndex : (action.row !== undefined ? action.row : (sameRound ? (prevQ.questionIndex || 1) : 1)),
      mediaUrl: action.mediaUrl !== undefined ? action.mediaUrl : (sameRound ? (prevQ.mediaUrl || '') : ''),
      mediaType: action.mediaType !== undefined ? action.mediaType : (sameRound ? (prevQ.mediaType || '') : ''),
      pack: action.pack !== undefined ? action.pack : (sameRound ? prevQ.pack : undefined),
      subject: action.subject !== undefined ? action.subject : (sameRound ? (prevQ.subject || '') : ''),
      answerText: (action.answerText !== undefined || action.answer !== undefined) ? (action.answerText || action.answer || '') : (sameRound ? (prevQ.answerText || '') : ''),
      row: action.row !== undefined ? action.row : (sameRound ? prevQ.row : undefined),
      round: serverState.activeRound
    };
  }
  if (action.vuotSong) {
    serverState.vuotSong = action.vuotSong;
  }
  if (action.row !== undefined) {
    serverState.vuotSongRow = action.row;
  }

  // Track Active Timers & Instant Resumption
  if (type === 'XUAT_PHAT_START_TIMER' || type === 'XUAT_PHAT_BAT_DAU_CAU_HOI') {
    const dur = action.duration || 60;
    const start = action.startTime || now;
    serverState.currentTimer = {
      round: 'XUAT_PHAT',
      duration: dur,
      startTime: start,
      targetTime: start + dur * 1000,
      questionText: action.questionText || ''
    };
  } else if (type === 'RA_KHOI_START_TIMER') {
    const dur = action.duration || 30;
    const start = action.startTime || now;
    serverState.currentTimer = {
      round: 'RA_KHOI',
      duration: dur,
      startTime: start,
      targetTime: start + dur * 1000,
      questionText: action.questionText || ''
    };
  } else if (type === 'VUOT_SONG_START_TIMER') {
    const dur = action.duration || 15;
    const start = action.startTime || now;
    serverState.currentTimer = {
      round: 'VUOT_SONG',
      duration: dur,
      startTime: start,
      targetTime: start + dur * 1000,
      questionText: action.questionText || ''
    };
  } else if (type === 'VINH_QUANG_START_TIMER') {
    const dur = action.duration || 20;
    const start = action.startTime || now;
    serverState.currentTimer = {
      round: 'VINH_QUANG',
      duration: dur,
      startTime: start,
      targetTime: start + dur * 1000,
      questionText: action.questionText || ''
    };
  } else if (type === 'VINH_QUANG_START_TIMER_5S') {
    const dur = 5;
    const start = action.startTime || now;
    serverState.currentTimer = {
      round: 'VINH_QUANG',
      duration: dur,
      startTime: start,
      targetTime: start + 5000,
      questionText: action.questionText || ''
    };
  } else if (
    type === 'XUAT_PHAT_RESET' ||
    type === 'RA_KHOI_RESET' ||
    type === 'VUOT_SONG_RESET' ||
    type === 'VINH_QUANG_RESET' ||
    type === 'RA_KHOI_SHOW_QUESTION' ||
    type === 'VUOT_SONG_SHOW_QUESTION' ||
    type === 'VUOT_SONG_SELECT_ROW' ||
    type === 'VINH_QUANG_SHOW_QUESTION' ||
    type === 'VINH_QUANG_SELECT_PACK' ||
    type === 'STOP_TIMER' ||
    type === 'RESET_ALL_DATA'
  ) {
    serverState.currentTimer = null;
  }

  // Helper to determine if question is permitted to be shown on player
  const isQuestionVisibleForActiveRound = () => {
    if (serverState.activeRound === 'XUAT_PHAT') return !!serverState.xpQuestionShown;
    if (serverState.activeRound === 'VUOT_SONG') return !!serverState.vsQuestionShown;
    if (serverState.activeRound === 'VINH_QUANG') return !!serverState.vqQuestionShown;
    if (serverState.activeRound === 'CAU_HOI_PHU' || serverState.activeRound === 'CHP') return !!serverState.chpQuestionShown;
    return true; // RA_KHOI
  };

  // Handle Explicit Request for Current State (e.g. from player reloading with F5)
  if (type === 'REQUEST_CURRENT_STATE') {
    const timerPayload = getActiveTimerPayload();
    const isQVisible = isQuestionVisibleForActiveRound();
    const effectiveQText = isQVisible ? (serverState.currentQuestion?.questionText || '') : '';
    const fullStateSync = {
      type: 'FULL_STATE_SYNC',
      activeRound: serverState.activeRound,
      currentRound: serverState.activeRound,
      currentTimer: timerPayload,
      currentQuestion: isQVisible ? serverState.currentQuestion : null,
      questionText: effectiveQText,
      questionIndex: serverState.currentQuestion?.questionIndex || 1,
      xpQuestionShown: !!serverState.xpQuestionShown,
      currentXuatPhatTurn: serverState.currentXuatPhatTurn || 0,
      s1QuestionStates: serverState.s1QuestionStates || {},
      s1HasSelectedDeForTurn: serverState.s1HasSelectedDeForTurn || { 1: false, 2: false, 3: false, 4: false },
      s1ChosenDeMap: serverState.s1ChosenDeMap || { 1: null, 2: null, 3: null, 4: null },
      xpBuzzerOpen: !!serverState.xpBuzzerOpen,
      xpBuzzerLocked: !!serverState.xpBuzzerLocked,
      xpBuzzerWinner: serverState.xpBuzzerWinner || 0,
      xpBellUnlockedAt: serverState.xpBellUnlockedAt || 0,
      vqMainContestant: serverState.vqMainContestant || 0,
      vqBuzzerOpen: !!serverState.vqBuzzerOpen,
      vqBuzzerLocked: !!serverState.vqBuzzerLocked,
      vqBuzzerWinner: serverState.vqBuzzerWinner || 0,
      vqBellUnlockedAt: serverState.vqBellUnlockedAt || 0,
      chpQuestionShown: !!serverState.chpQuestionShown,
      chpParticipants: serverState.chpParticipants || [1, 2, 3, 4],
      chpEliminated: serverState.chpEliminated || [],
      chpBuzzerOpen: !!serverState.chpBuzzerOpen,
      chpBuzzerLocked: !!serverState.chpBuzzerLocked,
      chpBuzzerWinner: serverState.chpBuzzerWinner || 0,
      chpBellUnlockedAt: serverState.chpBellUnlockedAt || 0,
      chpRightWinnerName: serverState.chpRightWinnerName || '',
      chpRemainingMs: serverState.chpRemainingMs !== undefined ? serverState.chpRemainingMs : 15000,
      vsQuestionShown: !!serverState.vsQuestionShown,
      vsLockedContestants: serverState.vsLockedContestants || { 1: false, 2: false, 3: false, 4: false },
      vsRoundStartTime: serverState.vsRoundStartTime || 0,
      vqQuestionShown: !!serverState.vqQuestionShown,
      vuotSong: serverState.vuotSong,
      vuotSongRow: serverState.vuotSongRow,
      contestants: serverState.contestants,
      playerAnswers: serverState.playerAnswers,
      buzzerState: serverState.buzzerState,
      timestamp: Date.now()
    };
    broadcastToClients(fullStateSync);
    if (senderWs && senderWs.readyState === WebSocket.OPEN) {
      try { senderWs.send(JSON.stringify(fullStateSync)); } catch(e) {}
    }
  }

  // Broadcast to all WebSocket and SSE clients (skip raw heartbeats to prevent network flooding)
  if (type !== 'CLIENT_HEARTBEAT') {
    broadcastToClients(action, senderWs);
  }
}

// Initialize WebSocket Server with perMessageDeflate disabled for ultra-fast microsecond packet delivery
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

server.on('upgrade', (request, socket, head) => {
  try {
    const pathname = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
    if (pathname === '/ws' || pathname.endsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch (err) {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  wsClients.add(ws);

  const ip = req.socket.remoteAddress;
  console.log(`⚡ [WebSocket] Client connected from ${ip}. Total WS clients: ${wsClients.size}`);

  // Helper for initial connection check
  const isQVisible = () => {
    if (serverState.activeRound === 'XUAT_PHAT') return !!serverState.xpQuestionShown;
    if (serverState.activeRound === 'VUOT_SONG') return !!serverState.vsQuestionShown;
    if (serverState.activeRound === 'VINH_QUANG') return !!serverState.vqQuestionShown;
    if (serverState.activeRound === 'CAU_HOI_PHU' || serverState.activeRound === 'CHP') return !!serverState.chpQuestionShown;
    return true;
  };
  const showQ = isQVisible();

  // Send immediate initial state sync to newly connected WebSocket client
  try {
    ws.send(JSON.stringify({
      type: 'INITIAL_STATE_SYNC',
      event: 'buzzer-state-sync',
      roomCode: serverState.roomCode,
      roomAuth: serverState.roomAuth,
      activeRound: serverState.activeRound,
      currentRound: serverState.activeRound,
      currentTimer: getActiveTimerPayload(),
      currentQuestion: showQ ? serverState.currentQuestion : null,
      questionText: showQ ? (serverState.currentQuestion?.questionText || '') : '',
      questionIndex: serverState.currentQuestion?.questionIndex || 1,
      xpQuestionShown: !!serverState.xpQuestionShown,
      currentXuatPhatTurn: serverState.currentXuatPhatTurn || 0,
      s1QuestionStates: serverState.s1QuestionStates || {},
      s1HasSelectedDeForTurn: serverState.s1HasSelectedDeForTurn || { 1: false, 2: false, 3: false, 4: false },
      s1ChosenDeMap: serverState.s1ChosenDeMap || { 1: null, 2: null, 3: null, 4: null },
      xpBuzzerOpen: !!serverState.xpBuzzerOpen,
      xpBuzzerLocked: !!serverState.xpBuzzerLocked,
      xpBuzzerWinner: serverState.xpBuzzerWinner || 0,
      xpBellUnlockedAt: serverState.xpBellUnlockedAt || 0,
      vqMainContestant: serverState.vqMainContestant || 0,
      vqBuzzerOpen: !!serverState.vqBuzzerOpen,
      vqBuzzerLocked: !!serverState.vqBuzzerLocked,
      vqBuzzerWinner: serverState.vqBuzzerWinner || 0,
      vqBellUnlockedAt: serverState.vqBellUnlockedAt || 0,
      chpQuestionShown: !!serverState.chpQuestionShown,
      chpParticipants: serverState.chpParticipants || [1, 2, 3, 4],
      chpEliminated: serverState.chpEliminated || [],
      chpBuzzerOpen: !!serverState.chpBuzzerOpen,
      chpBuzzerLocked: !!serverState.chpBuzzerLocked,
      chpBuzzerWinner: serverState.chpBuzzerWinner || 0,
      chpBellUnlockedAt: serverState.chpBellUnlockedAt || 0,
      chpRightWinnerName: serverState.chpRightWinnerName || '',
      chpRemainingMs: serverState.chpRemainingMs !== undefined ? serverState.chpRemainingMs : 15000,
      vsQuestionShown: !!serverState.vsQuestionShown,
      vsLockedContestants: serverState.vsLockedContestants || { 1: false, 2: false, 3: false, 4: false },
      vsRoundStartTime: serverState.vsRoundStartTime || 0,
      vqQuestionShown: !!serverState.vqQuestionShown,
      vuotSong: serverState.vuotSong,
      vuotSongRow: serverState.vuotSongRow,
      contestants: serverState.contestants,
      gameData: serverState.gameData,
      scoreboardThumbnailStates: serverState.scoreboardThumbnailStates,
      scoreboardInfoStates: serverState.scoreboardInfoStates,
      connectedClients: serverState.connectedClients,
      playerAnswers: serverState.playerAnswers,
      buzzerState: serverState.buzzerState,
      latestAction: serverState.latestAction,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('[WebSocket] Initial sync send error:', err);
  }

  // Heartbeat pong listener
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Handle incoming messages from HTML client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data && data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        return;
      }
      handleIncomingAction(data, ws);
    } catch (err) {
      console.error('[WebSocket] Message parse error:', err);
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`🔌 [WebSocket] Client disconnected. Remaining WS clients: ${wsClients.size}`);
  });

  ws.on('error', (err) => {
    console.warn('[WebSocket] Client error:', err.message);
    wsClients.delete(ws);
  });
});

// Periodic WebSocket and SSE ping heartbeat
const wsHeartbeatInterval = setInterval(() => {
  // Check WebSocket connections
  for (const ws of wsClients) {
    if (ws.isAlive === false) {
      wsClients.delete(ws);
      try { ws.terminate(); } catch(e) {}
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {
      wsClients.delete(ws);
    }
  }

  // Check client timeouts
  const now = Date.now();
  let clientChanged = false;
  Object.keys(serverState.connectedClients).forEach(role => {
    const client = serverState.connectedClients[role];
    if (client && client.connected && (now - client.lastSeen > 12000)) {
      client.connected = false;
      clientChanged = true;
    }
  });

  if (clientChanged) {
    broadcastToClients({
      type: 'CLIENT_STATUS_UPDATE',
      connectedClients: serverState.connectedClients
    });
  }

  // SSE ping
  for (const client of sseClients) {
    try {
      client.write('data: {"type":"PING","event":"ping"}\n\n');
    } catch (err) {
      sseClients.delete(client);
    }
  }
}, 10000);

// Function to collect all Local Area Network (LAN) IPv4 addresses of the host machine
function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          ip: net.address,
          url: `http://${net.address}:${PORT}`
        });
      }
    }
  }
  return addresses;
}

// POST /api/upload & /upload.php - Direct stream upload for Intro videos and media files
const handleUploadEndpoint = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Không tìm thấy file tải lên' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;
  console.log(`📁 [Upload] File uploaded successfully: ${req.file.originalname} -> ${fileUrl} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
  res.json({
    success: true,
    url: fileUrl,
    fullUrl: fullUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  });
};

app.post('/api/upload', upload.single('file'), handleUploadEndpoint);
app.post('/upload.php', upload.single('file'), handleUploadEndpoint);

// GET /upload.php & /api/uploads-list - Return list of uploaded media files
const handleListUploads = (req, res) => {
  try {
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ success: true, files: [] });
    }
    const files = fs.readdirSync(uploadsDir)
      .filter(file => !fs.statSync(path.join(uploadsDir, file)).isDirectory() && file !== '.gitkeep')
      .map(file => {
        const stats = fs.statSync(path.join(uploadsDir, file));
        return {
          filename: file,
          url: `/uploads/${file}`,
          fullUrl: `${req.protocol}://${req.get('host')}/uploads/${file}`,
          size: stats.size,
          mtime: stats.mtimeMs
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.get('/upload.php', handleListUploads);
app.get('/api/uploads-list', handleListUploads);

// Setup Chunked Upload Directory
const tempChunksDir = path.join(uploadsDir, 'temp_chunks');
if (!fs.existsSync(tempChunksDir)) {
  fs.mkdirSync(tempChunksDir, { recursive: true });
}

// POST /api/upload-chunk - High speed parallel chunk receiver
app.post('/api/upload-chunk', upload.single('chunk'), (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks } = req.body;
    if (!uploadId || chunkIndex === undefined || !req.file) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin chunk upload' });
    }

    const sessionDir = path.join(tempChunksDir, uploadId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const chunkTarget = path.join(sessionDir, `chunk_${chunkIndex}`);
    fs.renameSync(req.file.path, chunkTarget);

    res.json({
      success: true,
      chunkIndex: parseInt(chunkIndex),
      totalChunks: parseInt(totalChunks)
    });
  } catch (err) {
    console.error('Error saving chunk:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/upload-complete - Fast stream reassembly with highWaterMark for maximum disk I/O throughput
app.post('/api/upload-complete', express.json(), async (req, res) => {
  try {
    const { uploadId, originalName, totalChunks, mediaType } = req.body;
    if (!uploadId || !totalChunks) {
      return res.status(400).json({ success: false, error: 'Thiếu uploadId hoặc totalChunks' });
    }

    const sessionDir = path.join(tempChunksDir, uploadId);
    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy session upload' });
    }

    const ext = path.extname(originalName || '') || '.mp4';
    const prefix = mediaType || 'rakhoi_video';
    const finalFilename = `${prefix}_${Date.now()}_${Math.round(Math.random() * 1E6)}${ext}`;
    const finalFilePath = path.join(uploadsDir, finalFilename);

    const writeStream = fs.createWriteStream(finalFilePath, { highWaterMark: 4 * 1024 * 1024 });

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(sessionDir, `chunk_${i}`);
      if (!fs.existsSync(chunkPath)) {
        writeStream.destroy();
        if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
        return res.status(400).json({ success: false, error: `Thiếu chunk ${i}` });
      }

      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath, { highWaterMark: 4 * 1024 * 1024 });
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', () => {
          try { fs.unlinkSync(chunkPath); } catch (_) {}
          resolve();
        });
        readStream.on('error', reject);
      });
    }

    writeStream.end();
    await new Promise((resolve) => writeStream.on('finish', resolve));

    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (_) {}

    const stats = fs.statSync(finalFilePath);
    const fileUrl = `/uploads/${finalFilename}`;
    console.log(`⚡ [Fast Chunk Upload] Video merged successfully: ${originalName} -> ${fileUrl} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${totalChunks} chunks)`);

    res.json({
      success: true,
      url: fileUrl,
      filename: finalFilename,
      originalName: originalName || finalFilename,
      size: stats.size
    });
  } catch (err) {
    console.error('Error completing chunk upload:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/network-info
app.get('/api/network-info', (req, res) => {
  const lanAddresses = getLocalNetworkAddresses();
  const hostHeader = req.headers.host || `localhost:${PORT}`;
  const protocol = req.protocol || 'http';
  const currentUrl = `${protocol}://${hostHeader}`;

  res.json({
    status: 'online',
    port: PORT,
    currentUrl: currentUrl,
    lanAddresses: lanAddresses,
    links: {
      controller: `${currentUrl}/controller`,
      projector: `${currentUrl}/projector`,
      host: `${currentUrl}/host`,
      player: `${currentUrl}/player`,
      playerDirectLink: `${currentUrl}/public/player.html?roomid=${serverState.roomCode}&auth=${serverState.roomAuth}`,
      graphic: `${currentUrl}/graphic`,
      scoreboard: `${currentUrl}/scoreboard`
    },
    roomCode: serverState.roomCode,
    roomAuth: serverState.roomAuth,
    connectedWsClients: wsClients.size,
    connectedReceivers: sseClients.size + wsClients.size
  });
});

// GET /api/events & /events - Real-time Server-Sent Events (SSE) endpoint fallback
const handleSseConnection = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const isSseQVisible = (() => {
    if (serverState.activeRound === 'XUAT_PHAT') return !!serverState.xpQuestionShown;
    if (serverState.activeRound === 'VUOT_SONG') return !!serverState.vsQuestionShown;
    if (serverState.activeRound === 'VINH_QUANG') return !!serverState.vqQuestionShown;
    if (serverState.activeRound === 'CAU_HOI_PHU' || serverState.activeRound === 'CHP') return !!serverState.chpQuestionShown;
    return true;
  })();

  res.write(`data: ${JSON.stringify({
    type: 'INITIAL_STATE_SYNC',
    event: 'buzzer-state-sync',
    roomCode: serverState.roomCode,
    roomAuth: serverState.roomAuth,
    slotAuth: getAllSlotAuths(),
    activeRound: serverState.activeRound,
    currentRound: serverState.activeRound,
    currentTimer: getActiveTimerPayload(),
    currentQuestion: isSseQVisible ? serverState.currentQuestion : null,
    questionText: isSseQVisible ? (serverState.currentQuestion?.questionText || '') : '',
    questionIndex: serverState.currentQuestion?.questionIndex || 1,
    xpQuestionShown: !!serverState.xpQuestionShown,
    currentXuatPhatTurn: serverState.currentXuatPhatTurn || 0,
    s1QuestionStates: serverState.s1QuestionStates || {},
    s1HasSelectedDeForTurn: serverState.s1HasSelectedDeForTurn || { 1: false, 2: false, 3: false, 4: false },
    s1ChosenDeMap: serverState.s1ChosenDeMap || { 1: null, 2: null, 3: null, 4: null },
    xpBuzzerOpen: !!serverState.xpBuzzerOpen,
    xpBuzzerLocked: !!serverState.xpBuzzerLocked,
    xpBuzzerWinner: serverState.xpBuzzerWinner || 0,
    xpBellUnlockedAt: serverState.xpBellUnlockedAt || 0,
    vsQuestionShown: !!serverState.vsQuestionShown,
    vsLockedContestants: serverState.vsLockedContestants || { 1: false, 2: false, 3: false, 4: false },
    vsRoundStartTime: serverState.vsRoundStartTime || 0,
    vuotSong: serverState.vuotSong,
    vuotSongRow: serverState.vuotSongRow,
    vqQuestionShown: !!serverState.vqQuestionShown,
    vqMainContestant: serverState.vqMainContestant || 0,
    vqBuzzerOpen: !!serverState.vqBuzzerOpen,
    vqBuzzerLocked: !!serverState.vqBuzzerLocked,
    vqBuzzerWinner: serverState.vqBuzzerWinner || 0,
    vqBellUnlockedAt: serverState.vqBellUnlockedAt || 0,
    chpQuestionShown: !!serverState.chpQuestionShown,
    chpParticipants: serverState.chpParticipants || [1, 2, 3, 4],
    chpEliminated: serverState.chpEliminated || [],
    chpBuzzerOpen: !!serverState.chpBuzzerOpen,
    chpBuzzerLocked: !!serverState.chpBuzzerLocked,
    chpBuzzerWinner: serverState.chpBuzzerWinner || 0,
    chpBellUnlockedAt: serverState.chpBellUnlockedAt || 0,
    chpRightWinnerName: serverState.chpRightWinnerName || '',
    chpRemainingMs: serverState.chpRemainingMs !== undefined ? serverState.chpRemainingMs : 15000,
    contestants: serverState.contestants,
    gameData: serverState.gameData,
    scoreboardThumbnailStates: serverState.scoreboardThumbnailStates,
    scoreboardInfoStates: serverState.scoreboardInfoStates,
    connectedClients: serverState.connectedClients,
    playerAnswers: serverState.playerAnswers,
    buzzerState: serverState.buzzerState,
    latestAction: serverState.latestAction,
    timestamp: Date.now()
  })}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
};
app.get('/api/events', handleSseConnection);
app.get('/events', handleSseConnection);

// GET /api/state & /state - Retrieve current authoritative game state
const handleGetState = (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const isQVisible = (() => {
    if (serverState.activeRound === 'XUAT_PHAT') return !!serverState.xpQuestionShown;
    if (serverState.activeRound === 'VUOT_SONG') return !!serverState.vsQuestionShown;
    if (serverState.activeRound === 'VINH_QUANG') return !!serverState.vqQuestionShown;
    if (serverState.activeRound === 'CAU_HOI_PHU' || serverState.activeRound === 'CHP') return !!serverState.chpQuestionShown;
    return true;
  })();
  const effectiveQText = isQVisible ? (serverState.currentQuestion?.questionText || '') : '';
  res.json({
    type: 'FULL_STATE_SYNC',
    roomCode: serverState.roomCode,
    roomAuth: serverState.roomAuth,
    slotAuth: getAllSlotAuths(),
    activeRound: serverState.activeRound,
    currentRound: serverState.activeRound,
    currentTimer: getActiveTimerPayload(),
    currentQuestion: isQVisible ? serverState.currentQuestion : null,
    questionText: effectiveQText,
    questionIndex: serverState.currentQuestion?.questionIndex || 1,
    xpQuestionShown: !!serverState.xpQuestionShown,
    xpBuzzerOpen: !!serverState.xpBuzzerOpen,
    xpBuzzerLocked: !!serverState.xpBuzzerLocked,
    xpBuzzerWinner: serverState.xpBuzzerWinner || 0,
    xpBellUnlockedAt: serverState.xpBellUnlockedAt || 0,
    vsQuestionShown: !!serverState.vsQuestionShown,
    vsLockedContestants: serverState.vsLockedContestants || { 1: false, 2: false, 3: false, 4: false },
    vsRoundStartTime: serverState.vsRoundStartTime || 0,
    vqQuestionShown: !!serverState.vqQuestionShown,
    vqMainContestant: serverState.vqMainContestant || 0,
    vqBuzzerOpen: !!serverState.vqBuzzerOpen,
    vqBuzzerLocked: !!serverState.vqBuzzerLocked,
    vqBuzzerWinner: serverState.vqBuzzerWinner || 0,
    vqBellUnlockedAt: serverState.vqBellUnlockedAt || 0,
    chpQuestionShown: !!serverState.chpQuestionShown,
    chpParticipants: serverState.chpParticipants || [1, 2, 3, 4],
    chpEliminated: serverState.chpEliminated || [],
    chpBuzzerOpen: !!serverState.chpBuzzerOpen,
    chpBuzzerLocked: !!serverState.chpBuzzerLocked,
    chpBuzzerWinner: serverState.chpBuzzerWinner || 0,
    chpBellUnlockedAt: serverState.chpBellUnlockedAt || 0,
    chpRightWinnerName: serverState.chpRightWinnerName || '',
    chpRemainingMs: serverState.chpRemainingMs !== undefined ? serverState.chpRemainingMs : 15000,
    vuotSong: serverState.vuotSong,
    vuotSongRow: serverState.vuotSongRow,
    contestants: serverState.contestants,
    gameData: serverState.gameData,
    scoreboardThumbnailStates: serverState.scoreboardThumbnailStates,
    scoreboardInfoStates: serverState.scoreboardInfoStates,
    connectedClients: serverState.connectedClients,
    playerAnswers: serverState.playerAnswers,
    buzzerState: serverState.buzzerState,
    latestAction: serverState.latestAction,
    lastUpdated: serverState.lastUpdated,
    currentXuatPhatTurn: serverState.currentXuatPhatTurn || 0,
    s1QuestionStates: serverState.s1QuestionStates || {},
    s1HasSelectedDeForTurn: serverState.s1HasSelectedDeForTurn || { 1: false, 2: false, 3: false, 4: false },
    s1ChosenDeMap: serverState.s1ChosenDeMap || { 1: null, 2: null, 3: null, 4: null },
    connectedWsClients: wsClients.size,
    connectedReceivers: sseClients.size + wsClients.size
  });
};
app.get('/api/state', handleGetState);
app.get('/state', handleGetState);

// POST /api/state & /state - Update game state
const handlePostState = (req, res) => {
  const body = req.body || {};
  if (body.contestants && Array.isArray(body.contestants)) {
    serverState.contestants = body.contestants;
    if (serverState.gameData) serverState.gameData.contestants = body.contestants;
  }
  if (body.gameData && typeof body.gameData === 'object') {
    serverState.gameData = Object.assign(serverState.gameData || {}, body.gameData);
    if (body.gameData.contestants && Array.isArray(body.gameData.contestants)) {
      serverState.contestants = body.gameData.contestants;
    }
  }
  if (body.roomCode) {
    serverState.roomCode = body.roomCode.trim().toUpperCase();
  }
  if (body.roomAuth !== undefined || body.auth !== undefined) {
    serverState.roomAuth = (body.roomAuth || body.auth || '').trim();
  }
  if (body.slotAuth && typeof body.slotAuth === 'object') {
    serverState.slotAuth = Object.assign({}, serverState.slotAuth, body.slotAuth);
  }
  serverState.lastUpdated = Date.now();

  const updateMsg = {
    type: 'STATE_UPDATED',
    contestants: serverState.contestants,
    gameData: serverState.gameData,
    roomCode: serverState.roomCode,
    roomAuth: serverState.roomAuth,
    slotAuth: getAllSlotAuths(),
    timestamp: serverState.lastUpdated
  };

  broadcastToClients(updateMsg);

  res.json({ success: true, state: serverState, slotAuth: getAllSlotAuths() });
};
app.post('/api/state', handlePostState);
app.post('/state', handlePostState);

// POST /api/action & /action - Handle game commands, answer submissions, client heartbeats & buzzer events
const handlePostAction = (req, res) => {
  const action = req.body || {};
  const clientRoom = (action.roomCode || '').trim().toUpperCase();
  const clientAuth = (action.auth || action.roomAuth || '').trim();
  const slot = action.contestantId || (action.role ? parseInt(action.role.replace(/\D/g, '')) : 0);
  const clientSessionId = (action.sessionId || '').trim();
  const now = Date.now();

  if (action.type === 'CLIENT_JOIN') {
    if (slot >= 1 && slot <= 4) {
      const roleKey = `ts${slot}`;
      const assignedSessionId = clientSessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      serverState.connectedClients[roleKey] = {
        connected: true,
        sessionId: assignedSessionId,
        name: action.name || serverState.contestants[slot - 1]?.name || `Thí sinh ${slot}`,
        lastSeen: now,
        ip: req.ip || req.socket.remoteAddress
      };

      handleIncomingAction(action);

      return res.json({
        success: true,
        slot: slot,
        sessionId: assignedSessionId,
        roomCode: serverState.roomCode,
        roomAuth: serverState.roomAuth,
        slotAuth: getAllSlotAuths(),
        contestants: serverState.contestants
      });
    }
  } else if (action.type === 'CLIENT_HEARTBEAT') {
    if (slot >= 1 && slot <= 4) {
      const roleKey = `ts${slot}`;
      const occupant = serverState.connectedClients[roleKey];
      if (occupant) {
        occupant.connected = true;
        occupant.lastSeen = now;
        if (clientSessionId) occupant.sessionId = clientSessionId;
        if (action.name) occupant.name = action.name;
      }
    }
  } else if (action.type === 'PLAYER_SUBMIT_ANSWER' || action.type === 'PLAYER_BUZZER_PRESS') {
    if (slot >= 1 && slot <= 4) {
      const roleKey = `ts${slot}`;
      const occupant = serverState.connectedClients[roleKey];
      if (occupant) {
        occupant.connected = true;
        occupant.lastSeen = now;
      }
    }
  }

  handleIncomingAction(action);
  res.json({
    success: true,
    receivedAt: Date.now(),
    wsReceivers: wsClients.size,
    sseReceivers: sseClients.size,
    roomCode: serverState.roomCode,
    roomAuth: serverState.roomAuth,
    slotAuth: getAllSlotAuths(),
    contestants: serverState.contestants
  });
};
app.post('/api/action', handlePostAction);
app.post('/action', handlePostAction);

// GET /api/buzzer-state & /buzzer-state - Fetch current buzzer lock status
const handleGetBuzzerState = (req, res) => {
  res.json(serverState.buzzerState);
};
app.get('/api/buzzer-state', handleGetBuzzerState);
app.get('/buzzer-state', handleGetBuzzerState);

// POST /api/broadcast - General broadcast API endpoint
app.post('/api/broadcast', (req, res) => {
  const { event, payload, ts, id } = req.body || {};
  const msgObj = {
    event,
    payload,
    ts: ts || Date.now(),
    id
  };
  handleIncomingAction(msgObj);
  res.json({ ok: true, wsReceivers: wsClients.size, buzzerState: serverState.buzzerState });
});

function getMediaMimeType(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  const mimeMap = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.ogv': 'video/ogg',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.bmp': 'image/bmp'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function findMediaFileInDirs(searchDirs, rawSubPath) {
  let cleanRel = '';
  try {
    cleanRel = decodeURIComponent(rawSubPath || '').replace(/^\/+/, '');
  } catch (e) {
    cleanRel = (rawSubPath || '').replace(/^\/+/, '');
  }
  const baseName = path.basename(cleanRel);
  if (!baseName) return null;

  for (const dir of searchDirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    const candidateExact = path.join(dir, cleanRel);
    if (fs.existsSync(candidateExact) && fs.statSync(candidateExact).isFile()) {
      return candidateExact;
    }
    const candidateBase = path.join(dir, baseName);
    if (fs.existsSync(candidateBase) && fs.statSync(candidateBase).isFile()) {
      return candidateBase;
    }
    try {
      const files = fs.readdirSync(dir);
      const match = files.find(f => f.toLowerCase() === baseName.toLowerCase());
      if (match) {
        const matchPath = path.join(dir, match);
        if (fs.statSync(matchPath).isFile()) return matchPath;
      }
    } catch (e) {}
  }
  return null;
}

const audioSearchDirs = [
  path.join(__dirname, 'SFX'),
  path.join(__dirname, 'sounds'),
  path.join(__dirname, '..', 'SFX'),
  path.join(__dirname, '..', 'sounds'),
  uploadsDir
];

const visualMediaSearchDirs = [
  path.join(__dirname, 'Media'),
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'assets'),
  path.join(__dirname, 'Images'),
  path.join(__dirname, 'images'),
  path.join(__dirname, 'videos'),
  path.join(__dirname, '..', 'Media'),
  path.join(__dirname, '..', 'uploads'),
  path.join(__dirname, '..', 'Images'),
  path.join(__dirname, '..', 'images'),
  path.join(__dirname, '..', 'videos'),
  __dirname,
  path.join(__dirname, '..')
];

// Robust Case-Insensitive Sound Route & Caching (checking SFX, sounds, and uploads)
app.get(['/sounds/:filename', '/SFX/:filename', '/sfx/:filename'], (req, res, next) => {
  const found = findMediaFileInDirs(audioSearchDirs, req.params.filename);
  if (found) {
    try {
      const stat = fs.statSync(found);
      if (stat.size === 0) return res.status(204).end();
    } catch (e) {}
    return streamMediaFile(req, res, found, getMediaMimeType(found));
  }
  next();
});

// Robust Case-Insensitive Images & Media Route & Caching (checking Media, uploads, Images, assets)
app.get(['/Images/*', '/images/*', '/Media/*', '/media/*', '/videos/*', '/uploads/*'], (req, res, next) => {
  const subPath = req.params[0] || '';
  const found = findMediaFileInDirs(visualMediaSearchDirs, subPath);
  if (found) {
    const mime = getMediaMimeType(found);
    if (mime.startsWith('video/') || mime.startsWith('audio/')) {
      return streamMediaFile(req, res, found, mime);
    }
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    return res.sendFile(found);
  }
  next();
});

// Dedicated High-Performance HTTP 206 Byte-Range Video Streaming Handler
function streamMediaFile(req, res, filePath, contentType = 'video/mp4') {
  if (!fs.existsSync(filePath)) {
    return res.status(404).end('Media file not found');
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).end();
    }

    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

// Dedicated streaming/fallback for bare media filenames in root (e.g. Opening.mp4, V1.mp4, hint.png, etc.)
app.get('/*.:ext(mp4|webm|mov|m4v|ogv|png|jpg|jpeg|gif|webp|svg|avif|mp3|wav|ogg)', (req, res, next) => {
  const found = findMediaFileInDirs([...visualMediaSearchDirs, ...audioSearchDirs], req.path);
  if (found) {
    const mime = getMediaMimeType(found);
    if (mime.startsWith('video/') || mime.startsWith('audio/')) {
      return streamMediaFile(req, res, found, mime);
    }
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    return res.sendFile(found);
  }
  next();
});

// Directory for HTML Designer imported pages
const designerImportDir = path.join(__dirname, 'uploads', 'imported_pages');
if (!fs.existsSync(designerImportDir)) {
  fs.mkdirSync(designerImportDir, { recursive: true });
}

// Serve designer imported pages directly with same-origin headers
app.use('/imported', express.static(designerImportDir, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
}));

// API: List all project HTML pages dynamically for Designer
app.get('/api/designer/pages', (req, res) => {
  try {
    const rootFiles = fs.readdirSync(__dirname);
    const publicFiles = fs.existsSync(path.join(__dirname, 'public')) ? fs.readdirSync(path.join(__dirname, 'public')) : [];
    const allHtml = Array.from(new Set([...rootFiles, ...publicFiles]));

    const mainPages = [
      { name: 'controller.html', label: '📱 Bảng Điều Khiển (Controller)' },
      { name: 'projector.html', label: '🖥️ Màn Hình Chiếu (Projector)' },
      { name: 'graphic.html', label: '🎨 Màn Hình Graphic' },
      { name: 'host.html', label: '🎤 Màn Hình MC (Host)' },
      { name: 'Scoreboard.html', label: '📊 Màn Hình Bảng Điểm (Chính)' },
      { name: 'scoreboard1.html', label: '📊 Bảng Điểm Thí Sinh 1' },
      { name: 'scoreboard2.html', label: '📊 Bảng Điểm Thí Sinh 2' },
      { name: 'scoreboard3.html', label: '📊 Bảng Điểm Thí Sinh 3' },
      { name: 'scoreboard4.html', label: '📊 Bảng Điểm Thí Sinh 4' },
      { name: 'player.html', label: '⚡ Màn Hình Thí Sinh (Player)' },
      { name: 'playerLogin.html', label: '🔑 Đăng Nhập Thí Sinh' },
      { name: 'player_scene1.html', label: '⚡ Player Scene 1' },
      { name: 'player_scene2.html', label: '⚡ Player Scene 2' },
      { name: 'player_scene3.html', label: '⚡ Player Scene 3' },
      { name: 'index.html', label: '🏠 Trang Chủ Giới Thiệu' },
      { name: 'answer.html', label: '📝 Bảng Câu Trả Lời' }
    ];

    // Other root HTML files
    const otherFiles = allHtml
      .filter(f => f.endsWith('.html') && f !== 'designer.html' && !mainPages.some(m => m.name === f))
      .map(f => ({ name: f, label: `📄 ${f}`, isImported: false }));

    // Imported HTML files
    let importedFiles = [];
    if (fs.existsSync(designerImportDir)) {
      importedFiles = fs.readdirSync(designerImportDir)
        .filter(f => f.endsWith('.html'))
        .map(f => ({ name: f, label: `📥 ${f} (Đã nhập)`, isImported: true, url: `/imported/${f}` }));
    }

    res.json({ success: true, pages: [...mainPages, ...otherFiles, ...importedFiles] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Import HTML file for Designer (stores server-side, 100% same-origin)
app.post('/api/designer/import', express.json({ limit: '50mb' }), (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!filename || !content) {
      return res.status(400).json({ success: false, error: 'Thiếu filename hoặc content' });
    }
    const safeName = path.basename(filename);
    const targetPath = path.join(designerImportDir, safeName);

    let finalContent = content;
    // Inject <base href="/"> if not present so relative paths like ./Images/ work smoothly
    if (!finalContent.includes('<base ') && !finalContent.includes('<base>')) {
      if (finalContent.includes('<head>')) {
        finalContent = finalContent.replace('<head>', '<head><base href="/">');
      } else if (finalContent.includes('<head ')) {
        finalContent = finalContent.replace(/<head[^>]*>/i, '$&<base href="/">');
      }
    }
    // Inject designer-runtime.js
    if (!finalContent.includes('designer-runtime.js')) {
      if (finalContent.includes('</head>')) {
        finalContent = finalContent.replace('</head>', '<script src="/designer-runtime.js"></script></head>');
      } else {
        finalContent = '<script src="/designer-runtime.js"></script>' + finalContent;
      }
    }

    fs.writeFileSync(targetPath, finalContent, 'utf-8');
    res.json({
      success: true,
      filename: safeName,
      url: `/imported/${safeName}`,
      message: 'Đã lưu file HTML thành công'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Static assets options
const staticOptions = {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.html$/i)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.match(/\.(js|css)$/i)) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(mp4|webm|ogg|mp3|wav|png|jpg|jpeg|gif|webp|ico|svg|woff|woff2|otf)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    }
  }
};

// Serve static assets prioritizing public/ directory, with fallback to root
const publicDir = __dirname;
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, staticOptions));
  app.use('/public', express.static(publicDir, staticOptions));
  app.use('/Olympia', express.static(publicDir, staticOptions));
}
app.use(express.static(__dirname, staticOptions));

// Helper to resolve pages from public first, fallback to root
function resolvePageFile(name) {
  const p = path.join(publicDir, name);
  if (fs.existsSync(p)) return p;
  return path.join(__dirname, name);
}

app.set('trust proxy', true);

// Helper to send page file safely
function sendPageOrFallback(res, filename, fallbackRedirect = null) {
  const filePath = resolvePageFile(filename);
  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(filePath);
  }
  if (fallbackRedirect) {
    return res.redirect(fallbackRedirect);
  }
  return res.status(404).send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>404 - Không tìm thấy trang</title></head><body style="font-family:sans-serif;padding:40px;background:#f8fafc;color:#1e293b;"><h2>Trang <code>${filename}</code> chưa có trong thư mục Public.</h2><p><a href="controller">Quay lại Bảng Điều Khiển (Controller)</a></p></body></html>`);
}

// Route shortcuts (Root & /Olympia subpath)
['/control', '/Olympia/control'].forEach(r => app.get(r, (req, res) => { sendPageOrFallback(res, 'controller.html'); }));
['/player', '/Olympia/player'].forEach(r => app.get(r, (req, res) => { sendPageOrFallback(res, 'player.html'); }));
['/host', '/Olympia/host'].forEach(r => app.get(r, (req, res) => { sendPageOrFallback(res, 'host.html'); }));
['/controller', '/Olympia/controller'].forEach(r => app.get(r, (req, res) => { sendPageOrFallback(res, 'controller.html'); }));
['/projector', '/Olympia/projector'].forEach(r => app.get(r, (req, res) => { sendPageOrFallback(res, 'projector.html'); }));
['/graphic', '/Olympia/graphic'].forEach(r => app.get(r, (req, res) => { sendPageOrFallback(res, 'graphic.html'); }));
['/scoreboard', '/Olympia/scoreboard', '/Scoreboard', '/Olympia/Scoreboard', '/scoreboard.html', '/Olympia/scoreboard.html'].forEach(r => app.get(r, (req, res) => { sendPageOrFallback(res, 'Scoreboard.html'); }));
[1, 2, 3, 4].forEach(n => {
  [`/scoreboard${n}`, `/Olympia/scoreboard${n}`, `/Scoreboard${n}`, `/Olympia/Scoreboard${n}`, `/Scoreboard${n}.html`, `/Olympia/Scoreboard${n}.html`].forEach(r => {
    app.get(r, (req, res) => { sendPageOrFallback(res, `scoreboard${n}.html`); });
  });
});
['/designer', '/Olympia/designer'].forEach(r => app.get(r, (req, res) => { sendPageOrFallback(res, 'designer.html'); }));
['/guide', '/Olympia/guide'].forEach(r => app.get(r, (req, res) => { sendPageOrFallback(res, 'guide.html'); }));
app.get('/Olympia', (req, res) => { sendPageOrFallback(res, 'index.html', '/Olympia/controller'); });
app.get('/Olympia/', (req, res) => { sendPageOrFallback(res, 'index.html', '/Olympia/controller'); });
app.get('/', (req, res) => { sendPageOrFallback(res, 'index.html', '/controller'); });

// Start HTTP + WebSocket server
server.listen(PORT, '0.0.0.0', () => {
  const lanAddresses = getLocalNetworkAddresses();
  console.log('================================================================');
  console.log('  🎮 ĐƯỜNG LÊN ĐỈNH OLYMPIA - MÁY CHỦ WEBSOCKET SẴN SÀNG HOẠT ĐỘNG');
  console.log('================================================================');
  console.log(`  🏠 Cục bộ (Localhost) : http://localhost:${PORT}`);
  console.log(`  ⚡ WebSocket URL     : ws://localhost:${PORT}/ws`);
  if (lanAddresses.length > 0) {
    console.log('  🌐 Mạng LAN (Điện thoại / Laptop cùng Wi-Fi):');
    lanAddresses.forEach(net => {
      console.log(`     👉 [${net.interface}] : ${net.url} (WS: ${net.url.replace('http', 'ws')}/ws)`);
    });
  } else {
    console.log(`  🌐 Mạng LAN/Internet  : http://0.0.0.0:${PORT}`);
  }
  console.log('----------------------------------------------------------------');
  console.log(`  📱 Điều khiển (Controller): http://localhost:${PORT}/controller`);
  console.log(`  🖥️  Máy chiếu (Projector) : http://localhost:${PORT}/projector`);
  console.log(`  🎤 Màn hình MC (Host)    : http://localhost:${PORT}/host`);
  console.log(`  ⚡ Thí sinh 1..4 (Player) : http://localhost:${PORT}/player`);
  console.log(`  📊 Bảng điểm (Scoreboard) : http://localhost:${PORT}/scoreboard`);
  console.log('================================================================');
});