// Two ways to play, one interface: subscribe with onUpdate(fn), call submit().
import { Match } from '../core/match.js';
import { buildLineup, FIELD_SIZE } from '../core/lineup.js';
import { snapshot } from '../core/snapshot.js';

export class LocalSession {
  constructor({ mode, boardDef, personas, name, seed }) {
    const players = buildLineup({ humans: [{ id: 'you', name }], personas, size: Math.min(FIELD_SIZE, mode.maxPlayers), seed });
    this.match = new Match({ mode, boardDef, players, seed });
    this.listeners = [];
    this.local = true;
  }
  onUpdate(fn) {
    this.listeners.push(fn);
  }
  emit() {
    const snap = { type: 'match', ...snapshot(this.match, { you: 'you', phase: this.match.over ? 'over' : 'throwing' }) };
    for (const fn of this.listeners) fn(snap);
  }
  start() {
    this.emit();
  }
  async submit(points) {
    this.match.submit('you', points);
    this.match.resolveRound();
    this.emit();
  }
  // Plays one round without you (after you are out or finished).
  advance() {
    if (!this.match.over) this.match.resolveRound();
    this.emit();
  }
  close() {}
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export class OnlineSession {
  static async create(opts) {
    return new OnlineSession(await post('/api/rooms', opts));
  }
  static async join(code, name) {
    return new OnlineSession(await post(`/api/rooms/${encodeURIComponent(code)}/join`, { name }));
  }
  constructor({ code, player, token }) {
    this.code = code;
    this.player = player;
    this.token = token;
    this.listeners = [];
    this.local = false;
  }
  onUpdate(fn) {
    this.listeners.push(fn);
  }
  start() {
    const q = new URLSearchParams({ player: this.player, token: this.token });
    this.source = new EventSource(`/api/rooms/${this.code}/events?${q}`);
    this.source.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      for (const fn of this.listeners) fn(msg);
    };
  }
  begin() {
    return post(`/api/rooms/${this.code}/start`, { player: this.player, token: this.token });
  }
  submit(points) {
    return post(`/api/rooms/${this.code}/throw`, { player: this.player, token: this.token, darts: points });
  }
  close() {
    this.source?.close();
  }
}
