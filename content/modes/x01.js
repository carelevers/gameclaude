// 501 race: everyone starts on 501 at the same time. Finish exactly on zero
// with a double (or the bull). The first player(s) to check out win;
// ties are broken by fewest darts.
const START = 501;

function isDouble(d) {
  return d.ring === 'double' || d.ring === 'bull';
}

// A simple checkout brain for bots. Returns { number, ring }.
function target(rem) {
  if (rem === 50) return { number: 25, ring: 'bull' };
  if (rem <= 40 && rem % 2 === 0) return { number: rem / 2, ring: 'double' };
  if (rem <= 41) return { number: rem > 32 ? rem - 32 : 1, ring: 'single' };
  if (rem <= 60) {
    if (rem - 40 <= 20) return { number: rem - 40, ring: 'single' };
    return { number: rem - 32, ring: 'single' };
  }
  if (rem <= 100) {
    for (let t = 20; t >= 1; t--) {
      const left = rem - 3 * t;
      if (left >= 2 && left <= 40 && left % 2 === 0) return { number: t, ring: 'treble' };
    }
  }
  for (let t = 20; t >= 1; t--) {
    if (rem - 3 * t >= 2) return { number: t, ring: 'treble' };
  }
  return { number: 1, ring: 'single' };
}

export default {
  id: 'x01',
  name: '501 Race',
  author: '@core-team',
  description: 'Everyone races from 501 to zero at the same time. Double out. First to check out wins, fewest darts breaks ties.',
  minPlayers: 1,
  maxPlayers: 100,
  maxRounds: 40,

  supportsBoard(board) {
    for (let n = 1; n <= 20; n++) if (!board.hasNumber(n)) return false;
    return true;
  },

  init({ players }) {
    const state = { order: players, round: 0, players: {}, finishers: 0 };
    for (const id of players) state.players[id] = { remaining: START, darts: 0, finishedRound: null };
    return state;
  },

  isActive(state, id) {
    return state.players[id].finishedRound === null;
  },

  aim(state, id, dartsSoFar) {
    let rem = state.players[id].remaining;
    for (const d of dartsSoFar) rem -= d.score;
    return target(rem);
  },

  pressure(state, id) {
    return state.players[id].remaining <= 60 ? 1 : 0;
  },

  visit(state, id, darts) {
    const p = state.players[id];
    const before = p.darts;
    let rem = p.remaining;
    for (const d of darts) {
      p.darts += 1;
      const next = rem - d.score;
      if (next < 0 || next === 1 || (next === 0 && !isDouble(d))) {
        // Bust: the score resets and the whole visit is used up.
        p.darts = before + darts.length;
        return;
      }
      rem = next;
      if (rem === 0) {
        p.remaining = 0;
        p.finishedRound = state.round + 1;
        return;
      }
    }
    p.remaining = rem;
  },

  endRound(state, { round }) {
    state.round = round;
    const events = [];
    for (const id of state.order) {
      const p = state.players[id];
      if (p.finishedRound === round) events.push({ type: 'finished', player: id, text: `checked out in ${p.darts} darts` });
    }
    state.finishers += events.length;
    return events;
  },

  isOver(state) {
    return state.finishers > 0;
  },

  standings(state) {
    return state.order
      .map((id) => ({ id, p: state.players[id] }))
      .sort((a, b) => {
        const fa = a.p.finishedRound !== null;
        const fb = b.p.finishedRound !== null;
        if (fa !== fb) return fa ? -1 : 1;
        if (fa) return a.p.darts - b.p.darts;
        return a.p.remaining - b.p.remaining;
      })
      .map(({ id, p }) => ({ player: id, value: p.finishedRound !== null ? `done, ${p.darts} darts` : `${p.remaining} left`, out: false }));
  },
};
