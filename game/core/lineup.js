// Builds the field for a match: the humans first, then community-designed
// players, then generated fillers for any seats still empty.
import { createRng } from './rng.js';
import { fillerPersona } from './fillers.js';

export const FIELD_SIZE = 100;

// humans: [{ id, name }]. personas: content players. Returns match players.
export function buildLineup({ humans = [], personas, size = FIELD_SIZE, seed = 1 }) {
  const rng = createRng(seed ^ 0x5eed);
  const players = humans.map((h) => ({ id: h.id, name: h.name, kind: 'human', persona: { accuracy: 50, nerves: 50, color: h.color ?? 'w' } }));
  const seats = Math.max(0, size - players.length);
  for (const persona of rng.shuffle(personas).slice(0, seats)) {
    players.push({ id: `bot:${persona.id}`, name: persona.name, kind: 'bot', persona });
  }
  const names = new Set(players.map((p) => p.name));
  for (let seat = 1; players.length < size; seat++) {
    let persona = fillerPersona(rng, seat);
    for (let tries = 0; names.has(persona.name) && tries < 8; tries++) persona = fillerPersona(rng, seat);
    names.add(persona.name);
    players.push({ id: `bot:${persona.id}`, name: persona.name, kind: 'bot', persona });
  }
  return players;
}
