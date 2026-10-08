import { PALETTE, SPRITE_SIZE } from '../core/palette.js';

// Draws an 8x8 palette sprite into a new canvas scaled by `scale`.
export function spriteCanvas(rows, scale = 3) {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE * scale;
  c.height = SPRITE_SIZE * scale;
  c.className = 'avatar';
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PALETTE[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return c;
}
