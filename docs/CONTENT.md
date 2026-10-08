# Content reference

Everything in `content/` is loaded automatically: drop a file in, run
`npm test`, and it is in the game. `tools/validate.mjs` enforces every rule
below and explains what to fix.

## Common rules

- One item per file. The file name is the `id` (`snake_case`, 3-40 chars).
- Unknown fields are errors (typos should not silently do nothing).
- `author` is your GitHub handle, e.g. `"@octocat"`. It is shown in the game's credits.
- Original work only: no real people, brands or copyrighted characters.

## Players: `content/players/<id>.json`

| field | rule |
| --- | --- |
| `name` | 2-40 characters |
| `bio` | 10-160 characters |
| `accuracy` | integer 1-95. Spread of a throw: about 60 mm at 1, 8 mm at 100 |
| `nerves` | integer 0-100. How much pressure (checkouts, final rounds) widens the spread |
| skill budget | `accuracy + (100 - nerves) / 2 <= 120`: great players crack under pressure |
| `color` | a palette key, used for the player's marker |
| `avatar` | 8 strings of 8 palette keys; `.` is transparent; at most 6 colors |
| `catchphrases` | 0-3 strings of at most 60 characters, shown when they throw the round's best visit |

The field of 100 should feel like a real darts night: a handful of stars, many
club players, plenty of beginners. Tasks say which tier to design.

## Boards: `content/boards/<id>.json`

| field | rule |
| --- | --- |
| `description` | 5-160 characters |
| `segments` | 8-24 integers from 1 to 60, clockwise starting at the top |
| `rings` | `bull`, `outerBull`, `trebleInner`, `trebleOuter`, `doubleInner`, `doubleOuter` in mm; increasing, at least 4 mm apart, `bull` >= 4, `doubleOuter` <= 200 |
| `colors` | `dark`, `light` (singles), `red`, `green` (doubles/trebles/bull), `wire`, `surround`, all palette keys |

A mode decides which boards it supports (`supportsBoard`); 501 needs all of 1-20.

## Game modes: `content/modes/<id>.js`

A mode is a plain object, default-exported. The match runner calls it like this:

```
state = init({ players, board, rng })          // once
every round:
  for each player where isActive(state, id):
      darts = the player's 3 darts (bots use aim() for each dart)
      visit(state, id, darts, board)
  events = endRound(state, { round, rng })
until isOver(state, round) or round == maxRounds
standings(state)                                // anytime, best first
```

- A dart is `{ x, y, number, multiplier, score, ring }`, `ring` is one of
  `miss`, `single`, `double`, `treble`, `outer_bull`, `bull` (bull has
  number 25, multiplier 2).
- `aim(state, id, dartsSoFar, board)` returns `{ number, ring }`; the engine
  turns it into a point and applies the bot's skill.
- `pressure(state, id)` (optional) returns 0..1; with the player's `nerves`
  it widens their spread.
- `endRound` returns events: `{ type: 'eliminated' | 'finished' | 'info', player?, text }`.
- `standings` returns `[{ player, value, out }]` for every player; `value`
  is a short display string (max 40 chars).
- Modes must be deterministic and self-contained: no `import`, no
  `Math.random` (use `rng.next()`, `rng.int(a, b)`, `rng.pick(arr)`,
  `rng.shuffle(arr)`), no `Date`, no I/O. State must survive `JSON.stringify`.
- `tools/simulate.mjs` plays your mode with 100 bots on every supported board,
  checks the standings, determinism and that games end, and reports whether
  skill matters (winner accuracy vs field accuracy).

## The palette

Sweetie 16 by GrafxKid. Keys: `k` #1a1c2c, `p` #5d275d, `r` #b13e53, `o` #ef7d57,
`y` #ffcd75, `l` #a7f070, `g` #38b764, `t` #257179, `n` #29366f, `b` #3b5dc9,
`c` #41a6f6, `a` #73eff7, `w` #f4f4f4, `s` #94b0c2, `m` #566c86, `d` #333c57.
