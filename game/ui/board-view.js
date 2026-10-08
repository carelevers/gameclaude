// Draws a board definition on a canvas and turns pointer input into throws.
import { PALETTE } from '../core/palette.js';
import { createBoard, BOARD_RADIUS } from '../core/board.js';
import { sway, gaussian, HUMAN_SPREAD } from '../core/throw.js';

const VIEW_RADIUS = BOARD_RADIUS + 5; // mm visible from the centre

export function createBoardView(canvas, { onThrow }) {
  const g = canvas.getContext('2d');
  let board = null;
  let aim = null; // pointer position in mm, or null
  let enabled = false;
  let darts = []; // { x, y, score, ring } thrown this visit
  let ghosts = []; // other players' darts from the last round
  let hint = null;
  let swayAmount = 14;
  const random = { next: Math.random };
  let size = 0;

  function resize() {
    const css = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    size = Math.round(css * dpr);
    canvas.width = size;
    canvas.height = size;
  }

  const scale = () => size / (2 * VIEW_RADIUS);
  const toPx = (mm) => mm * scale() + size / 2;

  function toMm(evt) {
    const rect = canvas.getBoundingClientRect();
    const k = (2 * VIEW_RADIUS) / rect.width;
    return { x: (evt.clientX - rect.left) * k - VIEW_RADIUS, y: (evt.clientY - rect.top) * k - VIEW_RADIUS };
  }

  function reticle(t) {
    if (!aim) return null;
    const s = sway(t, swayAmount);
    return { x: aim.x + s.x, y: aim.y + s.y };
  }

  function drawBoard() {
    const c = board.def.colors;
    const col = (k) => PALETTE[c[k]];
    const r = board.rings;
    const k = scale();
    const cx = size / 2;
    g.fillStyle = col('surround');
    g.beginPath();
    g.arc(cx, cx, BOARD_RADIUS * k, 0, Math.PI * 2);
    g.fill();
    const n = board.segments.length;
    const wedge = (r0, r1, i, color) => {
      // Segment i is centred on angle i*step, clockwise from the top.
      const a0 = -Math.PI / 2 + (i - 0.5) * board.step;
      const a1 = a0 + board.step;
      g.fillStyle = color;
      g.beginPath();
      g.arc(cx, cx, r1 * k, a0, a1);
      g.arc(cx, cx, r0 * k, a1, a0, true);
      g.closePath();
      g.fill();
    };
    for (let i = 0; i < n; i++) {
      const even = i % 2 === 0;
      wedge(r.outerBull, r.doubleOuter, i, even ? col('dark') : col('light'));
      wedge(r.trebleInner, r.trebleOuter, i, even ? col('red') : col('green'));
      wedge(r.doubleInner, r.doubleOuter, i, even ? col('red') : col('green'));
    }
    g.fillStyle = col('green');
    g.beginPath();
    g.arc(cx, cx, r.outerBull * k, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col('red');
    g.beginPath();
    g.arc(cx, cx, r.bull * k, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = col('wire');
    g.lineWidth = Math.max(1, size / 600);
    for (const rad of [r.trebleInner, r.trebleOuter, r.doubleInner, r.doubleOuter]) {
      g.beginPath();
      g.arc(cx, cx, rad * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = PALETTE.w;
    g.font = `bold ${Math.round(size / 26)}px ui-monospace, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    board.segments.forEach((num, i) => {
      const a = i * board.step;
      const rad = (r.doubleOuter + BOARD_RADIUS) / 2;
      g.fillText(String(num), cx + Math.sin(a) * rad * k, cx - Math.cos(a) * rad * k);
    });
  }

  function dot(x, y, radius, fill, stroke) {
    g.beginPath();
    g.arc(toPx(x), toPx(y), radius, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = Math.max(1, size / 400);
      g.stroke();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!board || !size) return;
    g.clearRect(0, 0, size, size);
    drawBoard();
    const unit = size / 160;
    for (const d of ghosts) dot(d[0], d[1], unit * 0.9, 'rgba(244,244,244,0.35)');
    if (hint && enabled) {
      const p = board.aimPoint(hint);
      if (p) dot(p.x, p.y, unit * 3, 'rgba(0,0,0,0)', PALETTE.a);
    }
    for (const d of darts) dot(d.x, d.y, unit * 2.2, PALETTE.y, PALETTE.k);
    const rt = enabled ? reticle(now / 1000) : null;
    if (rt) {
      const px = toPx(rt.x);
      const py = toPx(rt.y);
      g.strokeStyle = PALETTE.a;
      g.lineWidth = Math.max(1.5, size / 300);
      g.beginPath();
      g.arc(px, py, unit * 4, 0, Math.PI * 2);
      g.moveTo(px - unit * 7, py);
      g.lineTo(px + unit * 7, py);
      g.moveTo(px, py - unit * 7);
      g.lineTo(px, py + unit * 7);
      g.stroke();
    }
  }

  function release(evt) {
    if (!enabled || !board) return;
    aim = toMm(evt);
    const rt = reticle(performance.now() / 1000);
    const landing = { x: rt.x + gaussian(random) * HUMAN_SPREAD, y: rt.y + gaussian(random) * HUMAN_SPREAD };
    const dart = board.score(landing.x, landing.y);
    darts.push(dart);
    onThrow(dart, darts.slice());
  }

  canvas.addEventListener('pointermove', (e) => (aim = toMm(e)));
  canvas.addEventListener('pointerdown', (e) => {
    aim = toMm(e);
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') aim = null;
  });
  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);

  return {
    setBoard(def) {
      board = createBoard(def);
      resize();
    },
    setEnabled(v) {
      enabled = v;
    },
    setHint(h) {
      hint = h;
    },
    setSway(mm) {
      swayAmount = mm;
    },
    setGhosts(list) {
      ghosts = list;
    },
    clearDarts() {
      darts = [];
    },
    dartsThrown: () => darts.length,
    resize,
  };
}
