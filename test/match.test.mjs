import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../tools/lib/content.mjs';
import { Match } from '../game/core/match.js';
import { buildLineup } from '../game/core/lineup.js';

const content = await loadContent();
const mode = (id) => content.modes.find((m) => m.id === id);
const classic = content.boards.find((b) => b.id === 'classic');

test('a lineup always has exactly 100 unique players', () => {
  const players = buildLineup({ humans: [{ id: 'h1', name: 'Me' }], personas: content.players, seed: 3 });
  assert.equal(players.length, 100);
  assert.equal(new Set(players.map((p) => p.id)).size, 100);
  assert.equal(players[0].kind, 'human');
});

test('royale with 100 bots ends with one winner and is deterministic', () => {
  const run = () => {
    const m = new Match({ mode: mode('royale'), boardDef: classic, players: buildLineup({ personas: content.players, seed: 9 }), seed: 9 });
    while (!m.over) m.resolveRound();
    return m;
  };
  const a = run();
  const b = run();
  assert.equal(a.standings().filter((s) => !s.out).length, 1);
  assert.deepEqual(a.standings().map((s) => s.player), b.standings().map((s) => s.player));
});

test('submit validates visits', () => {
  const players = buildLineup({ humans: [{ id: 'me', name: 'Me' }], personas: content.players, size: 10, seed: 1 });
  const m = new Match({ mode: mode('royale'), boardDef: classic, players, seed: 1 });
  assert.throws(() => m.submit('me', [{ x: 0, y: 0 }]), /exactly 3/);
  assert.throws(() => m.submit('me', [{ x: 0, y: 0 }, { x: 'a', y: 0 }, { x: 0, y: 0 }]), /invalid/);
  const darts = m.submit('me', [{ x: 0, y: 0 }, { x: 0, y: -103 }, { x: 0, y: -103 }]);
  assert.equal(darts.reduce((s, d) => s + d.score, 0), 170);
  assert.throws(() => m.submit('me', [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]), /already/);
  m.resolveRound();
  assert.equal(m.standings()[0].player, 'me'); // 170 beats any bot visit
});

test('a human who does not throw scores three misses', () => {
  const players = buildLineup({ humans: [{ id: 'me', name: 'Me' }], personas: content.players, size: 5, seed: 2 });
  const m = new Match({ mode: mode('royale'), boardDef: classic, players, seed: 2 });
  m.resolveRound();
  assert.deepEqual(m.lastVisits.get('me').map((d) => d.score), [0, 0, 0]);
});

test('501: busts reset the visit and only a double finishes', () => {
  const x01 = mode('x01');
  const players = [{ id: 'me', name: 'Me', kind: 'human', persona: { accuracy: 50, nerves: 50 } }];
  const m = new Match({ mode: x01, boardDef: classic, players, seed: 1 });
  m.state.players.me.remaining = 40;
  m.submit('me', [{ x: 0, y: -103 }, { x: 0, y: 0 }, { x: 0, y: 0 }]); // T20 = 60 > 40: bust
  m.resolveRound();
  assert.equal(m.state.players.me.remaining, 40);
  m.submit('me', [{ x: 0, y: -140 }, { x: 0, y: -140 }, { x: 0, y: -140 }]); // single 20 x2 = 40, no double: bust
  m.resolveRound();
  assert.equal(m.state.players.me.remaining, 40);
  m.submit('me', [{ x: 0, y: -166 }, { x: 0, y: 0 }, { x: 0, y: 0 }]); // D20 finishes
  m.resolveRound();
  assert.equal(m.over, true);
  assert.equal(m.state.players.me.darts, 7);
});

test('around the clock advances on hits in order', () => {
  const atc = mode('around_the_clock');
  const players = [{ id: 'me', name: 'Me', kind: 'human', persona: { accuracy: 50, nerves: 50 } }];
  const m = new Match({ mode: atc, boardDef: classic, players, seed: 1 });
  const p1 = m.board.aimPoint({ number: 1, ring: 'single' });
  const p2 = m.board.aimPoint({ number: 2, ring: 'single' });
  const p20 = m.board.aimPoint({ number: 20, ring: 'single' });
  m.submit('me', [p20, p1, p2]);
  m.resolveRound();
  assert.equal(m.state.players.me.next, 3);
});
