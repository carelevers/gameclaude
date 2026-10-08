import { createBoard } from './core/board.js';
import { PALETTE } from './core/palette.js';
import { createBoardView } from './ui/board-view.js';
import { spriteCanvas } from './ui/sprites.js';
import { LocalSession, OnlineSession } from './ui/sessions.js';

const $ = (id) => document.getElementById(id);
const show = (id, on = true) => ($(id).hidden = !on);
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

const bundle = await (await fetch('content-bundle.json')).json();
const modes = new Map();
for (const id of bundle.modes) modes.set(id, (await import(`./content/modes/${id}.js`)).default);
const boards = new Map(bundle.boards.map((b) => [b.id, b]));
const personas = new Map(bundle.players.map((p) => [`bot:${p.id}`, p]));

const view = createBoardView($('board-canvas'), { onThrow });
let session = null;
let snap = null;
let feed = [];
let sending = false;
let fastForward = false;

// ---- menu --------------------------------------------------------------------

$('name').value = store.get('darts100:name') ?? '';
$('hand').value = store.get('darts100:hand') ?? '14';
for (const m of modes.values()) $('mode').append(new Option(m.name, m.id));
if (modes.has('royale')) $('mode').value = 'royale';
function fillBoards() {
  const mode = modes.get($('mode').value);
  $('mode-desc').textContent = `${mode.description} (by ${mode.author})`;
  const prev = $('board').value;
  $('board').innerHTML = '';
  for (const b of boards.values()) {
    if (mode.supportsBoard(createBoard(b))) $('board').append(new Option(`${b.name} (by ${b.author})`, b.id));
  }
  if ([...$('board').options].some((o) => o.value === prev)) $('board').value = prev;
}
$('mode').addEventListener('change', fillBoards);
fillBoards();

const playerName = () => $('name').value.trim().slice(0, 24) || 'Player';
function rememberMenu() {
  store.set('darts100:name', $('name').value.trim());
  store.set('darts100:hand', $('hand').value);
  view.setSway(Number($('hand').value));
}

$('solo').addEventListener('click', () => {
  rememberMenu();
  const seed = (Math.random() * 2 ** 32) >>> 0;
  startSession(new LocalSession({ mode: modes.get($('mode').value), boardDef: boards.get($('board').value), personas: bundle.players, name: playerName(), seed }));
});

async function online(fn) {
  rememberMenu();
  $('menu-error').textContent = '';
  try {
    startSession(await fn());
  } catch (err) {
    $('menu-error').textContent = err.message;
  }
}
$('create').addEventListener('click', () => online(() => OnlineSession.create({ name: playerName(), mode: $('mode').value, board: $('board').value })));
$('join').addEventListener('click', () => online(() => OnlineSession.join($('code').value.trim().toUpperCase(), playerName())));

fetch('api/health')
  .then((r) => r.ok && show('online'))
  .catch(() => {});
const roomParam = new URLSearchParams(location.search).get('room');
if (roomParam) $('code').value = roomParam.toUpperCase();

// ---- session -----------------------------------------------------------------

function startSession(s) {
  session?.close();
  session = s;
  snap = null;
  feed = [];
  fastForward = false;
  show('menu', false);
  s.onUpdate(onUpdate);
  s.start();
}

function backToMenu() {
  session?.close();
  session = null;
  show('game', false);
  show('lobby', false);
  show('menu');
}

function onUpdate(msg) {
  if (msg.type === 'lobby') return renderLobby(msg);
  if (msg.type === 'error') {
    $('menu-error').textContent = msg.error;
    return backToMenu();
  }
  if (msg.deadlineIn != null) msg.deadline = Date.now() + msg.deadlineIn;
  show('lobby', false);
  show('game');
  const firstRender = !snap;
  const newRound = !snap || msg.round !== snap.round;
  snap = msg;
  if (firstRender) view.setBoard(boards.get(msg.board));
  if (newRound) {
    if (msg.round > 0) recordRound(msg);
    view.clearDarts();
    sending = false;
    const all = Object.values(msg.visits).flat();
    view.setGhosts(all);
  }
  render();
  if (fastForward && session.local && !msg.over) setTimeout(() => session.advance(), 30);
}

function renderLobby(msg) {
  show('lobby');
  $('lobby-code').textContent = msg.room;
  const link = `${location.origin}${location.pathname}?room=${msg.room}`;
  $('lobby-link').textContent = link;
  $('lobby-link').href = link;
  $('lobby-info').textContent = `${msg.mode} on ${msg.board} · ${msg.players.length} people joined · ${msg.size - msg.players.length} seats will be filled with bots`;
  $('lobby-players').innerHTML = '';
  for (const name of msg.players) $('lobby-players').append(Object.assign(document.createElement('li'), { textContent: name }));
  show('lobby-start', msg.isHost);
  show('lobby-wait', !msg.isHost);
}
$('lobby-start').addEventListener('click', () => session.begin().catch((e) => alert(e.message)));

// ---- throwing ----------------------------------------------------------------

function canThrow() {
  return snap && !snap.over && snap.phase === 'throwing' && snap.you?.active && !snap.you.thrown && !sending;
}

function onThrow(dart, darts) {
  $('visit').textContent = visitText(darts);
  if (darts.length < 3) return;
  sending = true;
  view.setEnabled(false);
  setTimeout(() => {
    session.submit(darts.map((d) => ({ x: d.x, y: d.y }))).catch((err) => {
      sending = false;
      feedPush(`⚠ ${err.message}`);
      render();
    });
  }, 450);
}

const dartLabel = (d) =>
  ({ miss: 'MISS', bull: 'BULL', outer_bull: '25', single: `${d.number}`, double: `D${d.number}`, treble: `T${d.number}` })[d.ring];
const visitText = (darts) => (darts.length ? `${darts.map(dartLabel).join('  ')}  = ${darts.reduce((s, d) => s + d.score, 0)}` : '');

// ---- rendering ---------------------------------------------------------------

function feedPush(text, cls = '') {
  feed.push({ text, cls });
  if (feed.length > 80) feed.shift();
}

function recordRound(msg) {
  for (const e of msg.events) {
    const who = e.player === msg.you?.id ? 'You' : e.name;
    if (e.type === 'winner') feedPush(`🏆 ${who === 'You' ? 'You win' : `${who} wins`}!`, 'win');
    else if (e.type === 'finished') feedPush(`🎯 ${who}: ${e.text}`, 'win');
    else if (e.type === 'eliminated') feedPush(`✖ ${who}: ${e.text}`);
    else feedPush(e.name ? `${who}: ${e.text}` : e.text);
  }
  // The round's best visit gets to say something.
  let best = null;
  for (const [id, darts] of Object.entries(msg.visits)) {
    const total = darts.reduce((s, d) => s + d[2], 0);
    if (!best || total > best.total) best = { id, total };
  }
  const persona = best && personas.get(best.id);
  if (persona?.catchphrases?.length) {
    feedPush(`${persona.name} (${best.total}): "${persona.catchphrases[msg.round % persona.catchphrases.length]}"`, 'say');
  }
}

function render() {
  const s = snap;
  const me = s.standings.find((x) => x.id === s.you?.id);
  const alive = s.standings.filter((x) => !x.out).length;
  $('round-title').textContent = `${s.mode.name} · round ${s.round + (s.over ? 0 : 1)}`;
  let status;
  if (s.over) {
    const w = s.standings[0];
    status = w.id === s.you?.id ? '🏆 You won the match!' : `${w.name} won. You finished #${me?.place}.`;
  } else if (s.you?.active) {
    status = s.you.thrown || sending ? `Waiting for ${s.humansWaiting} other player(s)...` : 'Your turn: aim and release. Three darts.';
  } else {
    status = me?.out ? `You are out (#${me.place}). Watch the rest?` : `You are done (#${me?.place}). Watch the rest?`;
  }
  if (s.deadline && !s.over) status += ` · ${Math.max(0, Math.round((s.deadline - Date.now()) / 1000))}s`;
  $('status').textContent = `${status} · ${alive} still in`;
  if (!sending && view.dartsThrown() === 0) {
    const last = s.visits[s.you?.id];
    $('visit').textContent = last ? `last: ${last.map((d) => d[2]).join(' + ')} = ${last.reduce((a, d) => a + d[2], 0)}` : '';
  }
  view.setEnabled(canThrow());
  view.setHint(s.you?.hint ?? null);
  show('advance', session.local && !s.over && !s.you?.active);
  show('fast', session.local && !s.over && !s.you?.active);
  show('again', s.over || !s.you?.active);

  const banner = $('banner');
  if (s.over) {
    const w = s.standings[0];
    banner.innerHTML = '';
    banner.append(Object.assign(document.createElement('b'), { textContent: w.id === s.you?.id ? 'You win!' : `${w.name} wins` }));
    const p = personas.get(w.id);
    banner.append(document.createElement('br'), p ? `designed by ${p.author}` : w.kind === 'human' ? 'a real person!' : 'an open seat: design a player to take it');
    show('banner');
  } else show('banner', false);

  $('field-count').textContent = `(${s.standings.length})`;
  const list = $('standings');
  list.innerHTML = '';
  for (const row of s.standings) {
    const li = document.createElement('li');
    if (row.id === s.you?.id) li.className = 'you';
    if (row.out) li.classList.add('out');
    const persona = personas.get(row.id);
    const place = Object.assign(document.createElement('span'), { className: 'place', textContent: `${row.place}.` });
    const icon = persona ? spriteCanvas(persona.avatar, 2) : Object.assign(document.createElement('span'), { className: 'swatch' });
    if (!persona) icon.style.background = PALETTE[row.color] ?? PALETTE.w;
    const who = Object.assign(document.createElement('span'), { className: 'who', textContent: row.kind === 'human' ? `👤 ${row.name}` : row.name });
    if (persona) who.title = `${persona.bio} (by ${persona.author})`;
    const val = Object.assign(document.createElement('span'), { className: 'val', textContent: row.value });
    li.append(place, icon, who, val);
    list.append(li);
  }
  $('feed').innerHTML = '';
  for (const f of feed.slice(-40)) $('feed').append(Object.assign(document.createElement('li'), { textContent: f.text, className: f.cls }));
  $('feed').scrollTop = 1e9;
  list.querySelector('.you')?.scrollIntoView({ block: 'nearest' });
}

setInterval(() => snap?.deadline && !snap.over && render(), 1000);

$('advance').addEventListener('click', () => session.advance());
$('fast').addEventListener('click', () => {
  fastForward = true;
  session.advance();
});
$('again').addEventListener('click', backToMenu);

$('credits-link').addEventListener('click', (e) => {
  e.preventDefault();
  const counts = new Map();
  for (const c of [...bundle.players, ...bundle.boards]) counts.set(c.author, (counts.get(c.author) ?? 0) + 1);
  for (const m of modes.values()) counts.set(m.author, (counts.get(m.author) ?? 0) + 1);
  $('credit-list').innerHTML = '';
  for (const [a, n] of [...counts].sort((x, y) => y[1] - x[1])) {
    $('credit-list').append(Object.assign(document.createElement('li'), { textContent: `${a}: ${n} contribution${n === 1 ? '' : 's'}` }));
  }
  show('credits', $('credits').hidden);
  $('credits').scrollIntoView({ behavior: 'smooth' });
});
