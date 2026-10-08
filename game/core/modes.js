// The game-mode contract. A mode is a plain object (content/modes/<id>.js,
// default export) that the match runner drives round by round. Every active
// player throws one visit (3 darts) per round, all at the same time; that is
// what makes 100-player games possible.
//
// Modes must be deterministic and self-contained: no imports, no
// Math.random (use ctx.rng), no Date, no I/O. State must be plain JSON.

export const MODE_FIELDS = {
  id: 'string',
  name: 'string',
  author: 'string',
  description: 'string',
  minPlayers: 'number',
  maxPlayers: 'number',
  maxRounds: 'number',
};

export const MODE_FUNCTIONS = {
  supportsBoard: '(board) -> boolean: can this mode be played on this board?',
  init: '({ players, board, rng }) -> state: players is an array of player ids',
  isActive: '(state, playerId) -> boolean: does this player throw this round?',
  aim: '(state, playerId, dartsSoFar, board) -> { number, ring }: where a bot (or hint) aims next',
  visit: '(state, playerId, darts, board) -> void: apply one visit of up to 3 scored darts',
  endRound: '(state, { round, rng }) -> events[]: resolve the round; events are { type, player?, text }',
  isOver: '(state, round) -> boolean',
  standings: '(state) -> [{ player, value, out }]: every player, best first; value is a short display string',
};

export const MODE_OPTIONAL = {
  pressure: '(state, playerId) -> number 0..1: how much nerves matter right now (default 0)',
};

const FORBIDDEN = [
  [/\bimport\b|\brequire\s*\(/, 'modes must be self-contained (no import/require)'],
  [/Math\.random/, 'use ctx.rng instead of Math.random (games must be reproducible)'],
  [/\bDate\b|performance\.now/, 'modes must not read the clock'],
  [/\b(fetch|XMLHttpRequest|WebSocket|globalThis|window|document|eval)\s*[.(]|\bprocess\.|\bFunction\s*\(/, 'modes must not touch the environment'],
];

export function checkModeSource(source, where) {
  const errors = [];
  for (const [re, why] of FORBIDDEN) {
    if (re.test(source.replace(/^\s*\/\/.*$/gm, ''))) errors.push(`${where}: ${why}`);
  }
  return errors;
}

export function checkMode(mode, where) {
  const errors = [];
  if (!mode || typeof mode !== 'object') return [`${where}: must "export default" a mode object`];
  for (const [key, type] of Object.entries(MODE_FIELDS)) {
    if (typeof mode[key] !== type) errors.push(`${where}: "${key}" must be a ${type}`);
  }
  for (const key of Object.keys(MODE_FUNCTIONS)) {
    if (typeof mode[key] !== 'function') errors.push(`${where}: missing function ${key}${MODE_FUNCTIONS[key]}`);
  }
  if (mode.pressure !== undefined && typeof mode.pressure !== 'function') errors.push(`${where}: "pressure" must be a function`);
  const allowed = new Set([...Object.keys(MODE_FIELDS), ...Object.keys(MODE_FUNCTIONS), ...Object.keys(MODE_OPTIONAL)]);
  for (const key of Object.keys(mode)) {
    if (!allowed.has(key)) errors.push(`${where}: unknown property "${key}"`);
  }
  if (typeof mode.minPlayers === 'number' && (mode.minPlayers < 1 || mode.minPlayers > (mode.maxPlayers ?? 100))) errors.push(`${where}: minPlayers out of range`);
  if (typeof mode.maxPlayers === 'number' && (mode.maxPlayers < 2 || mode.maxPlayers > 100)) errors.push(`${where}: maxPlayers must be 2-100`);
  if (typeof mode.maxRounds === 'number' && (mode.maxRounds < 1 || mode.maxRounds > 100)) errors.push(`${where}: maxRounds must be 1-100`);
  return errors;
}
