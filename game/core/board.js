// Dartboard geometry and scoring. All distances are in millimetres from the
// board centre; x grows to the right, y grows downwards (like a canvas).
//
// A board definition (content/boards/*.json) supplies the segment numbers
// (clockwise, starting at the top) and the ring radii. Everything else
// - scoring a landing point, finding where to aim - is derived here.

export const RINGS = ['bull', 'outer_bull', 'treble', 'double', 'single'];
export const BOARD_RADIUS = 225; // the physical board; beyond the double ring scores 0

export function createBoard(def) {
  const n = def.segments.length;
  const step = (2 * Math.PI) / n;
  const r = def.rings;

  // Angle of a segment's centre, measured clockwise from 12 o'clock.
  const segmentAngle = (index) => index * step;

  function score(x, y) {
    const dist = Math.hypot(x, y);
    if (dist <= r.bull) return { x, y, number: 25, multiplier: 2, score: 50, ring: 'bull' };
    if (dist <= r.outerBull) return { x, y, number: 25, multiplier: 1, score: 25, ring: 'outer_bull' };
    if (dist > r.doubleOuter) return { x, y, number: 0, multiplier: 0, score: 0, ring: 'miss' };
    let angle = Math.atan2(x, -y); // clockwise from the top, -PI..PI
    if (angle < 0) angle += 2 * Math.PI;
    const index = Math.floor(((angle + step / 2) % (2 * Math.PI)) / step);
    const number = def.segments[index];
    let multiplier = 1;
    let ring = 'single';
    if (dist > r.trebleInner && dist <= r.trebleOuter) {
      multiplier = 3;
      ring = 'treble';
    } else if (dist > r.doubleInner) {
      multiplier = 2;
      ring = 'double';
    }
    return { x, y, number, multiplier, score: number * multiplier, ring };
  }

  // The centre of a scoring area, used as an aim point.
  // target: { number, ring } with ring in RINGS ('single' aims at the fat
  // outer single area). Returns null if the number is not on this board.
  function aimPoint(target) {
    if (target.ring === 'bull' || target.ring === 'outer_bull' || target.number === 25) {
      if (target.ring === 'outer_bull') return { x: 0, y: -(r.bull + r.outerBull) / 2 };
      return { x: 0, y: 0 };
    }
    const index = def.segments.indexOf(target.number);
    if (index < 0) return null;
    let radius;
    if (target.ring === 'treble') radius = (r.trebleInner + r.trebleOuter) / 2;
    else if (target.ring === 'double') radius = (r.doubleInner + r.doubleOuter) / 2;
    else radius = (r.trebleOuter + r.doubleInner) / 2;
    const a = segmentAngle(index);
    return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
  }

  return {
    def,
    id: def.id,
    segments: def.segments,
    rings: r,
    numbers: [...new Set(def.segments)].sort((a, b) => a - b),
    hasNumber: (num) => num === 25 || def.segments.includes(num),
    segmentAngle,
    step,
    score,
    aimPoint,
  };
}

// The standard board's numbers, for modes that need them.
export const STANDARD_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);
