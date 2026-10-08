// Around the Clock: hit 1, 2, 3 ... 20 in order, then the bull.
// Any part of the segment counts. Fewest darts wins.
export default {
  id: 'around_the_clock',
  name: 'Around the Clock',
  author: '@core-team',
  description: 'Hit 1 to 20 in order, then the bull. Everyone plays at once; the first to hit the bull wins.',
  minPlayers: 1,
  maxPlayers: 100,
  maxRounds: 40,

  supportsBoard(board) {
    for (let n = 1; n <= 20; n++) if (!board.hasNumber(n)) return false;
    return true;
  },

  init({ players }) {
    const state = { order: players, players: {}, done: 0 };
    for (const id of players) state.players[id] = { next: 1, darts: 0, finishedRound: null };
    return state;
  },

  isActive(state, id) {
    return state.players[id].finishedRound === null;
  },

  aim(state, id, dartsSoFar) {
    let next = state.players[id].next;
    for (const d of dartsSoFar) if (d.number === next) next = next === 20 ? 25 : next + 1;
    return next === 25 ? { number: 25, ring: 'bull' } : { number: next, ring: 'single' };
  },

  pressure(state, id) {
    return state.players[id].next === 25 ? 1 : 0;
  },

  visit(state, id, darts) {
    const p = state.players[id];
    for (const d of darts) {
      p.darts += 1;
      if (d.number !== p.next) continue;
      if (p.next === 25) {
        p.finishedRound = -1; // marked; endRound fills in the round number
        return;
      }
      p.next = p.next === 20 ? 25 : p.next + 1;
    }
  },

  endRound(state, { round }) {
    const events = [];
    for (const id of state.order) {
      const p = state.players[id];
      if (p.finishedRound === -1) {
        p.finishedRound = round;
        state.done += 1;
        events.push({ type: 'finished', player: id, text: `round the clock in ${p.darts} darts` });
      }
    }
    return events;
  },

  isOver(state) {
    return state.done > 0;
  },

  standings(state) {
    const progress = (p) => (p.next === 25 ? 21 : p.next - 1);
    return state.order
      .map((id) => ({ id, p: state.players[id] }))
      .sort((a, b) => {
        const fa = a.p.finishedRound !== null;
        const fb = b.p.finishedRound !== null;
        if (fa !== fb) return fa ? -1 : 1;
        if (fa) return a.p.darts - b.p.darts;
        return progress(b.p) - progress(a.p) || a.p.darts - b.p.darts;
      })
      .map(({ id, p }) => ({
        player: id,
        value: p.finishedRound !== null ? `done, ${p.darts} darts` : p.next === 25 ? 'on the bull' : `on ${p.next}`,
        out: false,
      }));
  },
};
