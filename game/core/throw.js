// The throwing model. A dart lands at the aim point plus a normally
// distributed error. Skill is expressed as `accuracy` (1-100); pressure from
// the game mode combined with a player's `nerves` widens the spread.

export function gaussian(rng) {
  let u = 0;
  while (u === 0) u = rng.next();
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// accuracy 100 -> ~8mm spread (world class), accuracy 1 -> ~60mm (first time in a pub)
export function spreadFor(accuracy, nerves = 0, pressure = 0) {
  const base = 60 - 0.52 * (Math.max(1, Math.min(100, accuracy)) - 1);
  return base * (1 + (nerves / 100) * pressure * 0.6);
}

export function throwDart(rng, aim, spread) {
  return { x: aim.x + gaussian(rng) * spread, y: aim.y + gaussian(rng) * spread };
}

// Human aiming: the reticle sways around the pointer. `t` is time in seconds.
export function sway(t, amount = 14) {
  return {
    x: Math.sin(t * 1.7) * amount + Math.sin(t * 4.3) * amount * 0.35,
    y: Math.cos(t * 1.3) * amount + Math.sin(t * 3.1) * amount * 0.35,
  };
}

export const HUMAN_SPREAD = 5; // extra mm of randomness after a human releases
