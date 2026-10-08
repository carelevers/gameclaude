# Instructions for coding agents

You are helping build **Darts 100**: a darts game where up to 100 players throw
at the same time. Many volunteers run agents like you in parallel, each on one
small task. The project only works if every agent stays inside its lane.

## Golden rules

1. **Stay in scope.** The task lists the files you may touch. A pattern that
   starts with `+` means you may only *add* new files there, never edit
   existing ones. `node tools/scope-check.mjs --scope "<glob>"` checks this.
2. **`npm test` must pass** before you finish. It runs, in order:
   - `node tools/validate.mjs`: content rules (docs/CONTENT.md)
   - `node --test "test/**/*.test.mjs"`: unit tests
   - `node tools/simulate.mjs --runs 10`: plays every mode on every board with 100 bots
3. **No dependencies.** Plain JavaScript (ES modules), Node >= 20, no npm
   packages, no build step. The browser loads the files directly.
4. **Determinism.** Game modes use `ctx.rng` (passed to `init` and
   `endRound`), never `Math.random`, `Date` or any I/O.
5. **Do not commit, push or open pull requests.** The volunteer's worker
   script does that after checking your work.
6. **Be original and kind.** No real people, brands or copyrighted
   characters; nothing offensive. This is a pub game for everyone.

## Where things live

| Path | What | Who changes it |
| --- | --- | --- |
| `content/players/*.json` | One opponent per file (bio, skill, 8x8 avatar) | anyone, via tasks |
| `content/boards/*.json` | Board layouts and colors | anyone, via tasks |
| `content/modes/*.js` | Game modes (rules), one per file | anyone, extra review |
| `game/core/` | Engine: board scoring, throw model, match runner | core team |
| `game/ui/`, `game/*.html` | Browser client | core team |
| `server/server.mjs` | Online rooms for 100 people | core team |
| `tools/` | Validation, simulation, worker, metrics | core team |
| `test/` | Unit tests | anyone |

## Content formats (short version, full spec in docs/CONTENT.md)

**Player** (`content/players/<id>.json`, id = file name, snake_case):

```json
{
  "id": "oma_jo",
  "name": "Oma Jo",
  "author": "@your-github-handle",
  "bio": "10-160 characters.",
  "accuracy": 64,
  "nerves": 5,
  "color": "p",
  "avatar": ["8 strings", "of 8 chars", "...", "...", "...", "...", "...", "..."],
  "catchphrases": ["0-3 lines", "max 60 chars"]
}
```

- `accuracy` 1-95, `nerves` 0-100, and **accuracy + (100 - nerves) / 2 <= 120**.
- Avatar and `color` use only these palette keys (max 6 colors per avatar),
  `.` is transparent: `k` ink, `p` plum, `r` red, `o` orange, `y` yellow,
  `l` lime, `g` green, `t` teal, `n` navy, `b` blue, `c` cyan, `a` aqua,
  `w` white, `s` silver, `m` slate, `d` dark.

**Game mode** (`content/modes/<id>.js`): `export default { id, name, author,
description, minPlayers, maxPlayers, maxRounds, supportsBoard, init, isActive,
aim, visit, endRound, isOver, standings, pressure? }`. Every active player
throws one visit of 3 darts per round, simultaneously. Read
`content/modes/royale.js` (elimination) and `content/modes/x01.js` (race) as
examples, and the contract in `game/core/modes.js`. State must be plain JSON.
`standings` must list every player exactly once, best first.

**Board** (`content/boards/<id>.json`): segment numbers clockwise from the
top, ring radii in mm, colors as palette keys. See `content/boards/classic.json`.

## Useful commands

```sh
npm test                         # everything CI runs
node tools/simulate.mjs --runs 40  # more thorough balance report
npm start                        # play at http://localhost:8080 (gallery: /gallery.html)
```
