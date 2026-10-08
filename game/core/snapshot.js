// What one player gets to see of a match. Produced by the multiplayer server
// and by the local (solo) session, so the UI only has to understand one shape.
const r1 = (n) => Math.round(n * 10) / 10;

export function snapshot(match, { you, phase, deadline = null, room = null }) {
  const me = match.byId.get(you);
  const visits = {};
  for (const [id, darts] of match.lastVisits) visits[id] = darts.map((d) => [r1(d.x), r1(d.y), d.score, d.ring]);
  const lastRound = match.log.filter((e) => e.round === match.round);
  return {
    room,
    phase, // 'throwing' | 'results' | 'over'
    deadline,
    round: match.round,
    over: match.over,
    mode: { id: match.mode.id, name: match.mode.name, description: match.mode.description },
    board: match.board.id,
    you: me
      ? {
          id: you,
          name: me.name,
          active: match.isActive(you),
          thrown: match.pending.has(you),
          hint: match.isActive(you) ? match.mode.aim(match.state, you, [], match.board) : null,
        }
      : null,
    humansWaiting: match.waitingFor().length,
    standings: match.standings().map((s) => ({ id: s.player, name: s.name, value: s.value, out: s.out, place: s.place, kind: s.kind, color: s.color })),
    visits,
    events: lastRound.map((e) => ({ ...e, name: e.player ? match.byId.get(e.player)?.name : null })),
  };
}
