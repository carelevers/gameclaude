// Runs one match: up to 100 players, one simultaneous visit per round.
// Used by the browser (solo vs bots), the multiplayer server and the
// headless simulator - always the same rules.
import { createRng } from './rng.js';
import { createBoard } from './board.js';
import { spreadFor, throwDart } from './throw.js';

export const DARTS_PER_VISIT = 3;

export class Match {
  // players: [{ id, name, kind: 'human' | 'bot', persona }]
  constructor({ mode, boardDef, players, seed = 1 }) {
    if (players.length < mode.minPlayers || players.length > mode.maxPlayers) {
      throw new Error(`${mode.name} needs ${mode.minPlayers}-${mode.maxPlayers} players, got ${players.length}`);
    }
    this.mode = mode;
    this.board = createBoard(boardDef);
    if (!mode.supportsBoard(this.board)) throw new Error(`${mode.name} cannot be played on ${boardDef.name}`);
    this.players = players;
    this.byId = new Map(players.map((p) => [p.id, p]));
    this.seed = seed;
    this.rng = createRng(seed);
    this.round = 0;
    this.over = false;
    this.pending = new Map();
    this.lastVisits = new Map();
    this.log = [];
    this.state = mode.init({ players: players.map((p) => p.id), board: this.board, rng: this.rng });
  }

  isActive(id) {
    return !this.over && this.mode.isActive(this.state, id);
  }

  activePlayers() {
    return this.players.filter((p) => this.isActive(p.id));
  }

  waitingFor() {
    return this.activePlayers().filter((p) => p.kind === 'human' && !this.pending.has(p.id));
  }

  // points: up to 3 landing points { x, y } in mm. Returns the scored darts.
  submit(id, points) {
    if (!this.isActive(id)) throw new Error('player is not active this round');
    if (this.pending.has(id)) throw new Error('already thrown this round');
    if (!Array.isArray(points) || points.length !== DARTS_PER_VISIT) throw new Error(`a visit is exactly ${DARTS_PER_VISIT} darts`);
    const darts = points.map((pt) => {
      const x = Number(pt?.x);
      const y = Number(pt?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 400 || Math.abs(y) > 400) throw new Error('invalid dart');
      return this.board.score(x, y);
    });
    this.pending.set(id, darts);
    return darts;
  }

  aimFor(id, dartsSoFar = []) {
    const target = this.mode.aim(this.state, id, dartsSoFar, this.board);
    return (target && this.board.aimPoint(target)) ?? { x: 0, y: 0 };
  }

  botVisit(player) {
    const persona = player.persona;
    const pressure = Math.max(0, Math.min(1, this.mode.pressure?.(this.state, player.id) ?? 0));
    const spread = spreadFor(persona.accuracy, persona.nerves, pressure);
    const darts = [];
    for (let i = 0; i < DARTS_PER_VISIT; i++) {
      const aim = this.aimFor(player.id, darts);
      const p = throwDart(this.rng, aim, spread);
      darts.push(this.board.score(p.x, p.y));
    }
    return darts;
  }

  resolveRound() {
    if (this.over) throw new Error('match is over');
    const visits = new Map();
    for (const p of this.activePlayers()) {
      let darts = this.pending.get(p.id);
      if (!darts) {
        darts = p.kind === 'bot' ? this.botVisit(p) : Array.from({ length: DARTS_PER_VISIT }, () => this.board.score(999, 999));
      }
      visits.set(p.id, darts);
      this.mode.visit(this.state, p.id, darts, this.board);
    }
    this.round += 1;
    const events = (this.mode.endRound(this.state, { round: this.round, rng: this.rng }) ?? []).map((e) => ({ ...e, round: this.round }));
    this.log.push(...events);
    this.pending.clear();
    this.lastVisits = visits;
    if (this.mode.isOver(this.state, this.round) || this.round >= this.mode.maxRounds) {
      this.over = true;
      const winner = this.standings()[0];
      this.log.push({ type: 'winner', player: winner.player, round: this.round, text: `${winner.name} wins!` });
    }
    return { round: this.round, events, visits };
  }

  standings() {
    return this.mode.standings(this.state).map((s, i) => {
      const p = this.byId.get(s.player);
      return { ...s, place: i + 1, name: p.name, kind: p.kind, color: p.persona?.color ?? 'w' };
    });
  }

  winner() {
    return this.over ? this.standings()[0] : null;
  }
}
