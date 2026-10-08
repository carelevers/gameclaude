// Darts Royale: everyone throws three darts per round; the lowest-scoring
// 20% of the field is knocked out every round until one player is left.
const CUT = 0.2;

export default {
  id: 'royale',
  name: 'Royale',
  author: '@core-team',
  description: 'Everyone throws at once. Each round the lowest 20% is knocked out. Last player standing wins.',
  minPlayers: 2,
  maxPlayers: 100,
  maxRounds: 60,

  supportsBoard() {
    return true;
  },

  init({ players }) {
    const state = { field: players.length, alive: players.length, players: {}, order: players };
    for (const id of players) state.players[id] = { alive: true, total: 0, last: 0, place: null, outRound: null };
    return state;
  },

  isActive(state, id) {
    return state.players[id].alive;
  },

  aim(state, id, dartsSoFar, board) {
    const best = Math.max(...board.numbers);
    return best * 3 >= 50 ? { number: best, ring: 'treble' } : { number: 25, ring: 'bull' };
  },

  pressure(state) {
    return 1 - state.alive / state.field;
  },

  visit(state, id, darts) {
    const p = state.players[id];
    p.last = darts.reduce((sum, d) => sum + d.score, 0);
    p.total += p.last;
  },

  endRound(state, { round, rng }) {
    const alive = state.order.filter((id) => state.players[id].alive);
    const cut = Math.max(1, Math.floor(alive.length * CUT));
    // Lowest visit goes first; ties are broken by total score, then by a
    // simulated bull-off (a random draw).
    const tiebreak = new Map(alive.map((id) => [id, rng.next()]));
    alive.sort((a, b) => {
      const pa = state.players[a];
      const pb = state.players[b];
      return pa.last - pb.last || pa.total - pb.total || tiebreak.get(a) - tiebreak.get(b);
    });
    const events = [];
    alive.slice(0, cut).forEach((id, i) => {
      const p = state.players[id];
      p.alive = false;
      p.place = alive.length - i;
      p.outRound = round;
      events.push({ type: 'eliminated', player: id, text: `out with ${p.last} (place ${p.place})` });
    });
    state.alive = alive.length - cut;
    if (state.alive === 1) {
      const winner = alive[alive.length - 1];
      state.players[winner].place = 1;
    }
    return events;
  },

  isOver(state) {
    return state.alive <= 1;
  },

  standings(state) {
    return state.order
      .map((id) => ({ id, p: state.players[id] }))
      .sort((a, b) => {
        if (a.p.alive !== b.p.alive) return a.p.alive ? -1 : 1;
        if (a.p.alive) return b.p.last - a.p.last || b.p.total - a.p.total;
        return a.p.place - b.p.place;
      })
      .map(({ id, p }) => ({ player: id, value: p.alive ? `${p.last} (total ${p.total})` : `out R${p.outRound}`, out: !p.alive }));
  },
};
