import { spriteCanvas } from './ui/sprites.js';
import { createBoardView } from './ui/board-view.js';

const bundle = await (await fetch('content-bundle.json')).json();
const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
};

const bar = (label, value, max) => {
  const b = el('div', { className: 'bar' }, el('div'));
  b.firstChild.style.width = `${(100 * value) / max}%`;
  return [el('div', { textContent: `${label} ${value}` }), b];
};

document.getElementById('player-count').textContent = `(${bundle.players.length} of 99 seats designed)`;
for (const p of bundle.players) {
  document.getElementById('players').append(
    el(
      'div',
      { className: 'card' },
      spriteCanvas(p.avatar, 6),
      el('h3', { textContent: p.name }),
      el('div', { className: 'muted', textContent: `by ${p.author}` }),
      el('p', { textContent: p.bio }),
      el('div', { className: 'stats' }, ...bar('accuracy', p.accuracy, 100), ...bar('nerves', p.nerves, 100)),
      el('p', { className: 'muted', textContent: p.catchphrases.map((c) => `“${c}”`).join(' ') }),
    ),
  );
}

for (const b of bundle.boards) {
  const canvas = el('canvas', { className: 'board' });
  const card = el('div', { className: 'card' }, el('h3', { textContent: b.name }), el('div', { className: 'muted', textContent: `by ${b.author}` }), canvas, el('p', { textContent: b.description }));
  document.getElementById('boards').append(card);
  createBoardView(canvas, { onThrow() {} }).setBoard(b);
}

for (const id of bundle.modes) {
  const m = (await import(`./content/modes/${id}.js`)).default;
  document.getElementById('modes').append(
    el('div', { className: 'card' }, el('h3', { textContent: m.name }), el('div', { className: 'muted', textContent: `by ${m.author} · ${m.minPlayers}-${m.maxPlayers} players` }), el('p', { textContent: m.description })),
  );
}
