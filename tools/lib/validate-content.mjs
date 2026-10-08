// Content rules: the contract between the core team and every contributor,
// human or agent. If validation passes, the game can load the content.
import { PALETTE, SPRITE_SIZE, MAX_SPRITE_COLORS } from '../../game/core/palette.js';
import { createBoard } from '../../game/core/board.js';
import { checkMode, checkModeSource } from '../../game/core/modes.js';

const ID_RE = /^[a-z][a-z0-9_]{2,39}$/;
const AUTHOR_RE = /^@?[A-Za-z0-9][A-Za-z0-9_.-]{0,38}$/;
const KEYS = {
  players: ['id', 'name', 'author', 'bio', 'accuracy', 'nerves', 'color', 'avatar', 'catchphrases'],
  boards: ['id', 'name', 'author', 'description', 'segments', 'rings', 'colors'],
};
const RING_ORDER = ['bull', 'outerBull', 'trebleInner', 'trebleOuter', 'doubleInner', 'doubleOuter'];
const BOARD_COLORS = ['dark', 'light', 'red', 'green', 'wire', 'surround'];

// Nobody gets to be perfect: high accuracy has to be paid for with nerves.
export const SKILL_BUDGET = 120;
export const skillScore = (p) => p.accuracy + (100 - p.nerves) / 2;

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const isText = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;

function checkCommon(f, errors) {
  const { data, rel } = f;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push(`${rel}: must be a JSON object`);
    return false;
  }
  for (const key of Object.keys(data)) {
    if (!KEYS[f.kind].includes(key)) errors.push(`${rel}: unknown field "${key}" (allowed: ${KEYS[f.kind].join(', ')})`);
  }
  return checkIdentity(data, rel, f.name.replace(/\.(json|js)$/, ''), errors);
}

function checkIdentity(data, rel, fileId, errors) {
  let ok = true;
  if (!ID_RE.test(data.id ?? '')) {
    errors.push(`${rel}: "id" must be snake_case, 3-40 characters (${ID_RE})`);
    ok = false;
  } else if (fileId !== data.id) {
    errors.push(`${rel}: file name must match the id "${data.id}"`);
  }
  if (!isText(data.name, 2, 40)) errors.push(`${rel}: "name" must be 2-40 characters`);
  if (!AUTHOR_RE.test(data.author ?? '')) errors.push(`${rel}: "author" is required: your GitHub handle, e.g. "@octocat"`);
  return ok;
}

export function checkSprite(sprite, where, errors) {
  if (!Array.isArray(sprite) || sprite.length !== SPRITE_SIZE) {
    errors.push(`${where}: "avatar" must be an array of ${SPRITE_SIZE} strings of ${SPRITE_SIZE} characters`);
    return;
  }
  const colors = new Set();
  sprite.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== SPRITE_SIZE) {
      errors.push(`${where}: avatar row ${y} must be exactly ${SPRITE_SIZE} characters`);
      return;
    }
    for (const ch of row) {
      if (ch === '.') continue;
      if (!(ch in PALETTE)) errors.push(`${where}: avatar row ${y} uses "${ch}"; allowed: ${Object.keys(PALETTE).join('')} or "." (transparent)`);
      else colors.add(ch);
    }
  });
  if (colors.size === 0) errors.push(`${where}: avatar is fully transparent`);
  if (colors.size > MAX_SPRITE_COLORS) errors.push(`${where}: avatar uses ${colors.size} colors; the art direction allows at most ${MAX_SPRITE_COLORS}`);
}

function checkPlayer(p, rel, errors) {
  if (!isText(p.bio, 10, 160)) errors.push(`${rel}: "bio" must be 10-160 characters`);
  if (!isInt(p.accuracy, 1, 95)) errors.push(`${rel}: "accuracy" must be an integer 1-95`);
  if (!isInt(p.nerves, 0, 100)) errors.push(`${rel}: "nerves" must be an integer 0-100`);
  if (isInt(p.accuracy, 1, 95) && isInt(p.nerves, 0, 100) && skillScore(p) > SKILL_BUDGET) {
    errors.push(`${rel}: too good to be true: accuracy + (100 - nerves) / 2 = ${skillScore(p)} > ${SKILL_BUDGET}. Lower accuracy or raise nerves.`);
  }
  if (!(p.color in PALETTE)) errors.push(`${rel}: "color" must be a palette key (${Object.keys(PALETTE).join('')})`);
  checkSprite(p.avatar, rel, errors);
  if (!Array.isArray(p.catchphrases) || p.catchphrases.length > 3 || p.catchphrases.some((c) => !isText(c, 1, 60))) {
    errors.push(`${rel}: "catchphrases" must be an array of 0-3 strings of at most 60 characters`);
  }
}

function checkBoard(b, rel, errors) {
  if (!isText(b.description, 5, 160)) errors.push(`${rel}: "description" must be 5-160 characters`);
  const s = b.segments;
  if (!Array.isArray(s) || s.length < 8 || s.length > 24 || s.some((n) => !isInt(n, 1, 60))) {
    errors.push(`${rel}: "segments" must be 8-24 integers between 1 and 60 (clockwise from the top)`);
  }
  const r = b.rings ?? {};
  const keys = Object.keys(r);
  if (keys.length !== RING_ORDER.length || RING_ORDER.some((k) => typeof r[k] !== 'number')) {
    errors.push(`${rel}: "rings" must have exactly ${RING_ORDER.join(', ')} (radii in mm)`);
  } else {
    for (let i = 1; i < RING_ORDER.length; i++) {
      if (r[RING_ORDER[i]] - r[RING_ORDER[i - 1]] < 4) errors.push(`${rel}: rings.${RING_ORDER[i]} must be at least 4mm larger than rings.${RING_ORDER[i - 1]}`);
    }
    if (r.bull < 4) errors.push(`${rel}: rings.bull must be at least 4mm`);
    if (r.doubleOuter > 200) errors.push(`${rel}: rings.doubleOuter must be at most 200mm`);
  }
  const c = b.colors ?? {};
  if (BOARD_COLORS.some((k) => !(c[k] in PALETTE)) || Object.keys(c).length !== BOARD_COLORS.length) {
    errors.push(`${rel}: "colors" must map ${BOARD_COLORS.join(', ')} to palette keys`);
  }
}

function checkModeFile(f, errors) {
  const m = f.data;
  const fileId = f.name.replace(/\.js$/, '');
  errors.push(...checkModeSource(f.source, f.rel));
  const contract = checkMode(m, f.rel);
  errors.push(...contract);
  if (contract.length === 0) checkIdentity(m, f.rel, fileId, errors);
}

export function validateContent(loaded) {
  const errors = [...loaded.parseErrors];
  const warnings = [];
  const seen = new Map();
  for (const f of loaded.files) {
    if (f.kind === 'modes') checkModeFile(f, errors);
    else if (!checkCommon(f, errors)) continue;
    else if (f.kind === 'players') checkPlayer(f.data, f.rel, errors);
    else if (f.kind === 'boards') checkBoard(f.data, f.rel, errors);
    const key = `${f.kind}:${f.data?.id}`;
    if (seen.has(key)) errors.push(`${f.rel}: id "${f.data.id}" is already used by ${seen.get(key)}`);
    else seen.set(key, f.rel);
  }
  const playable = [];
  for (const m of loaded.modes) {
    for (const b of loaded.boards) {
      try {
        if (m.supportsBoard?.(createBoard(b))) playable.push(`${m.id}@${b.id}`);
      } catch (err) {
        errors.push(`content/modes/${m.id}.js: supportsBoard crashed on board "${b.id}": ${err.message}`);
      }
    }
  }
  if (!loaded.boards.some((b) => b.id === 'classic')) errors.push('content/boards/classic.json is required');
  if (!loaded.modes.some((m) => m.id === 'royale')) errors.push('content/modes/royale.js is required');
  if (loaded.players.length < 99) warnings.push(`${99 - loaded.players.length} of 99 opponent seats are still generated fillers: design a player!`);
  return { errors, warnings, playable };
}
