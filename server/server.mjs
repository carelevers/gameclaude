#!/usr/bin/env node
// Darts 100 server: serves the game and runs online rooms for up to 100
// people each. No dependencies; realtime updates use Server-Sent Events.
//
//   node server/server.mjs            (PORT=8080, ROUND_SECONDS=30)
//
// The same process is the local dev server: content is re-read for every
// new room, so edits to content/players and content/boards show up without a
// restart (game modes are ES modules and need a restart).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
import { randomUUID, randomInt, timingSafeEqual } from 'node:crypto';
import { loadContent, toBundle, ROOT } from '../tools/lib/content.mjs';
import { validateContent } from '../tools/lib/validate-content.mjs';
import { Match } from '../game/core/match.js';
import { createBoard } from '../game/core/board.js';
import { buildLineup, FIELD_SIZE } from '../game/core/lineup.js';
import { snapshot } from '../game/core/snapshot.js';

const PORT = Number(process.env.PORT ?? 8080);
const ROUND_MS = Number(process.env.ROUND_SECONDS ?? 30) * 1000;
const RESULTS_MS = Number(process.env.RESULTS_MS ?? 2500);
const MAX_ROOMS = 500;
const ROOM_IDLE_MS = 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const STATIC_ROOTS = [
  { prefix: '/content/', dir: join(ROOT, 'content') },
  { prefix: '/', dir: join(ROOT, 'game') },
];

const rooms = new Map();

// ---- helpers ---------------------------------------------------------------------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw new HttpError(413, 'request too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'invalid JSON');
  }
}

const cleanName = (name) =>
  String(name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, 24) || 'Player';

function newCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function getRoom(code) {
  const room = rooms.get(String(code).toUpperCase());
  if (!room) throw new HttpError(404, 'room not found');
  room.touched = Date.now();
  return room;
}

function auth(room, body) {
  const human = room.humans.find((h) => h.id === body.player);
  if (!human || !safeEqual(human.token, body.token)) throw new HttpError(403, 'not a player in this room');
  return human;
}

// ---- rooms -----------------------------------------------------------------------

async function createRoom({ name, mode: modeId, board: boardId }) {
  if (rooms.size >= MAX_ROOMS) throw new HttpError(503, 'server is full, try again later');
  const loaded = await loadContent();
  const { errors } = validateContent(loaded);
  if (errors.length) throw new HttpError(500, `content is invalid: ${errors[0]}`);
  const mode = loaded.modes.find((m) => m.id === modeId);
  const boardDef = loaded.boards.find((b) => b.id === boardId);
  if (!mode || !boardDef) throw new HttpError(400, 'unknown mode or board');
  if (!mode.supportsBoard(createBoard(boardDef))) throw new HttpError(400, `${mode.name} cannot be played on ${boardDef.name}`);
  const room = {
    code: newCode(),
    mode,
    boardDef,
    personas: loaded.players,
    size: Math.min(FIELD_SIZE, mode.maxPlayers),
    humans: [],
    clients: new Map(),
    match: null,
    phase: 'lobby',
    deadline: null,
    timer: null,
    touched: Date.now(),
  };
  rooms.set(room.code, room);
  const host = addHuman(room, name);
  room.hostId = host.id;
  return { code: room.code, player: host.id, token: host.token };
}

function addHuman(room, name) {
  if (room.phase !== 'lobby') throw new HttpError(409, 'this match has already started');
  if (room.humans.length >= room.size) throw new HttpError(409, 'this room is full');
  const human = { id: `human:${randomUUID().slice(0, 8)}`, name: cleanName(name), token: randomUUID() };
  room.humans.push(human);
  broadcast(room);
  return human;
}

function startMatch(room) {
  if (room.phase !== 'lobby') throw new HttpError(409, 'already started');
  const seed = randomInt(2 ** 31);
  const players = buildLineup({ humans: room.humans, personas: room.personas, size: room.size, seed });
  room.match = new Match({ mode: room.mode, boardDef: room.boardDef, players, seed });
  beginThrowing(room);
}

function beginThrowing(room) {
  room.phase = 'throwing';
  room.deadline = Date.now() + ROUND_MS;
  clearTimeout(room.timer);
  room.timer = setTimeout(() => resolve(room), ROUND_MS);
  broadcast(room);
  maybeResolveEarly(room);
}

function maybeResolveEarly(room) {
  if (room.phase !== 'throwing') return;
  // Only people who are connected can hold up a round.
  const waiting = room.match.waitingFor().filter((p) => room.clients.get(p.id)?.size);
  if (waiting.length === 0) resolve(room);
}

function resolve(room) {
  if (room.phase !== 'throwing') return;
  clearTimeout(room.timer);
  room.match.resolveRound();
  room.deadline = null;
  if (room.match.over) {
    room.phase = 'over';
    broadcast(room);
    return;
  }
  room.phase = 'results';
  broadcast(room);
  room.timer = setTimeout(() => beginThrowing(room), RESULTS_MS);
}

function messageFor(room, playerId) {
  if (room.phase === 'lobby') {
    return {
      type: 'lobby',
      room: room.code,
      mode: room.mode.name,
      board: room.boardDef.name,
      size: room.size,
      players: room.humans.map((h) => h.name),
      isHost: playerId === room.hostId,
    };
  }
  const snap = snapshot(room.match, { you: playerId, phase: room.phase, room: room.code });
  return { type: 'match', ...snap, deadlineIn: room.deadline ? room.deadline - Date.now() : null };
}

function broadcast(room) {
  for (const [playerId, set] of room.clients) {
    const data = `data: ${JSON.stringify(messageFor(room, playerId))}\n\n`;
    for (const res of set) res.write(data);
  }
}

function subscribe(room, req, res, url) {
  const human = auth(room, { player: url.searchParams.get('player'), token: url.searchParams.get('token') });
  const set = room.clients.get(human.id) ?? new Set();
  if (set.size >= 3) throw new HttpError(429, 'too many connections');
  room.clients.set(human.id, set);
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
  res.write(`data: ${JSON.stringify(messageFor(room, human.id))}\n\n`);
  set.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    clearInterval(ping);
    set.delete(res);
    if (room.match) maybeResolveEarly(room);
  });
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const connected = [...room.clients.values()].some((s) => s.size);
    if (!connected && now - room.touched > ROOM_IDLE_MS) {
      clearTimeout(room.timer);
      rooms.delete(code);
    }
  }
}, 60000).unref();

// ---- http ------------------------------------------------------------------------

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  if (req.method === 'GET' && parts[1] === 'health') return sendJson(res, 200, { ok: true, rooms: rooms.size });
  if (req.method === 'POST' && parts.length === 2 && parts[1] === 'rooms') return sendJson(res, 200, await createRoom(await readBody(req)));
  if (parts[1] === 'rooms' && parts[2]) {
    const room = getRoom(parts[2]);
    const action = parts[3];
    if (req.method === 'GET' && action === 'events') return subscribe(room, req, res, url);
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (action === 'join') {
        const h = addHuman(room, body.name);
        return sendJson(res, 200, { code: room.code, player: h.id, token: h.token });
      }
      const human = auth(room, body);
      if (action === 'start') {
        if (human.id !== room.hostId) throw new HttpError(403, 'only the host can start');
        startMatch(room);
        return sendJson(res, 200, { ok: true });
      }
      if (action === 'throw') {
        if (room.phase !== 'throwing') throw new HttpError(409, 'not throwing right now');
        try {
          room.match.submit(human.id, body.darts);
        } catch (err) {
          throw new HttpError(400, err.message);
        }
        broadcast(room);
        maybeResolveEarly(room);
        return sendJson(res, 200, { ok: true });
      }
    }
  }
  throw new HttpError(404, 'not found');
}

async function serveStatic(req, res, url) {
  if (url.pathname === '/content-bundle.json') {
    return sendJson(res, 200, toBundle(await loadContent()));
  }
  const root = STATIC_ROOTS.find((r) => url.pathname.startsWith(r.prefix));
  const rel = decodeURIComponent(url.pathname.slice(root.prefix.length)) || 'index.html';
  const file = normalize(join(root.dir, rel));
  if (!file.startsWith(root.dir + sep)) throw new HttpError(403, 'forbidden');
  try {
    if (!(await stat(file)).isFile()) throw new Error();
  } catch {
    throw new HttpError(404, 'not found');
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(await readFile(file));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD') await serveStatic(req, res, url);
    else throw new HttpError(405, 'method not allowed');
  } catch (err) {
    const status = err.status ?? 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'internal error' : err.message });
    else res.end();
  }
});

server.listen(PORT, () => console.log(`Darts 100 running at http://localhost:${PORT}`));
