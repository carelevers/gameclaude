import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBoard } from '../game/core/board.js';

const classic = createBoard(JSON.parse(readFileSync(new URL('../content/boards/classic.json', import.meta.url))));

test('scores known points on the classic board', () => {
  assert.equal(classic.score(0, 0).score, 50);
  assert.equal(classic.score(0, 0).ring, 'bull');
  assert.equal(classic.score(0, -10).ring, 'outer_bull');
  assert.deepEqual([classic.score(0, -103).number, classic.score(0, -103).ring], [20, 'treble']);
  assert.equal(classic.score(0, -166).score, 40);
  assert.equal(classic.score(0, 103).score, 9); // treble 3 at the bottom
  assert.equal(classic.score(103, 0).score, 18); // treble 6 on the right
  assert.equal(classic.score(0, -180).ring, 'miss');
});

test('every aim point scores the area it aims at', () => {
  for (const number of classic.numbers) {
    for (const ring of ['single', 'double', 'treble']) {
      const p = classic.aimPoint({ number, ring });
      const d = classic.score(p.x, p.y);
      assert.equal(d.number, number, `${ring} ${number}`);
      assert.equal(d.ring, ring, `${ring} ${number}`);
    }
  }
  const bull = classic.aimPoint({ number: 25, ring: 'bull' });
  assert.equal(classic.score(bull.x, bull.y).ring, 'bull');
  const outer = classic.aimPoint({ number: 25, ring: 'outer_bull' });
  assert.equal(classic.score(outer.x, outer.y).ring, 'outer_bull');
});

test('aimPoint returns null for a number that is not on the board', () => {
  assert.equal(classic.aimPoint({ number: 33, ring: 'single' }), null);
});
