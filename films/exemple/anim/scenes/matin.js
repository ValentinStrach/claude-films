// Le matin : l'aube sur la mer, le titre tombe mot par mot sur les temps de l'ouverture, le soleil se lève,
// le bateau tangue, un poisson saute, une mouette passe. La caméra recule doucement.
import { W, lerp, ease, prog } from '/core/anim/engine.js';
import { cutout, cutPoly, rrect, tape } from '/core/anim/paper/paper.js';
import { sticker, FONT } from '/core/anim/paper/text.js';
import { beat } from '/core/anim/paper/timeline.js';
import { sky, sun, sunGlints, cloudBank, wave, floatingBoat, fishJump, gull, farGull, camera, INK } from '../sets/decor.js';

const BEAT = 0.6;
const ROWS = [
  [{ w: 'LE', fill: '#f2c230', rot: -0.05 }, { w: 'PETIT', fill: '#e8574a', rot: 0.03 }, { w: 'BATEAU', fill: '#3f8fd2', rot: -0.02 }],
  [{ w: 'DE', fill: '#4f9d55', rot: 0.04 }, { w: 'PAPIER', fill: '#f28a2a', rot: -0.03 }],
];
const SIZE = 104;
const GAP = 34;
let WORDS = null;

// Mise en page mesurée une fois : chaque mot sur une bande de papier à sa largeur, lignes centrées.
function layout(ctx) {
  ctx.save();
  ctx.font = `${SIZE}px ${FONT}`;
  WORDS = [];
  ROWS.forEach((row, r) => {
    const ws = row.map((o) => ctx.measureText(o.w).width + 64);
    let x = W / 2 - (ws.reduce((a, b) => a + b, 0) + GAP * (row.length - 1)) / 2;
    row.forEach((o, i) => {
      const k = WORDS.length;
      WORDS.push({ ...o, x: x + ws[i] / 2, y: 230 + r * 150, strip: cutPoly(rrect(-ws[i] / 2, -86, ws[i], 124, 14), 90 + k), half: ws[i] / 2 });
      x += ws[i] + GAP;
    });
  });
  ctx.restore();
}

function title(ctx, t) {
  if (!WORDS) layout(ctx);
  WORDS.forEach((o, i) => {
    const tin = BEAT * (i + 1);
    const drop = ease.back(prog(t, tin - 0.25, tin + 0.15));
    const away = ease.in(prog(t, 7.0 + i * 0.08, 7.8 + i * 0.08));
    if (drop <= 0 || away >= 1) return;
    ctx.save();
    ctx.translate(o.x, lerp(-200, o.y, drop) - away * 700);
    ctx.rotate(o.rot + away * (i % 2 ? 0.4 : -0.4));
    cutout(ctx, o.strip, { fill: o.fill, outline: INK, lw: 5, lift: 10 });
    if (i === 0 || i === 3) tape(ctx, -o.half + 16, -80, 90, -0.5, 7 + i);
    sticker(ctx, o.w, 0, 10, { size: SIZE });
    ctx.restore();
  });
}

const FAR = { base: 640, amp: 0.35 };
const MID = { base: 740, amp: 0.6 };

function draw(ctx, t) {
  const b = beat(t);
  const zoom = lerp(1.1, 1.0, prog(t, 0, 9, ease.inOut));
  camera(ctx, { zoom, dy: lerp(-30, 0, prog(t, 0, 9, ease.inOut)) }, () => {
    sky(ctx, [[0, '#6fa9cf'], [0.55, '#b9dcea'], [1, '#ffdcae']]);
    const sy = lerp(760, 300, prog(t, 0.5, 10, ease.out));
    sun(ctx, 1460, sy, 105, '#ffd23f', [255, 214, 120]);
    cloudBank(ctx, t, { n: 4, y: 120, w: 330, h: 110, speed: 22, seed: 31, base: '#fbfaf5', light: '#ffffff' });
    wave(ctx, t * 0.7, { ...FAR, top: '#8fcbdc', deep: '#5fa8c4', seed: 41, foam: 0.5 });
    sunGlints(ctx, 1460, 668, t, [255, 236, 170]);
    farGull(ctx, 420 + Math.sin(t * 0.5) * 40, 300, t, 0.9);
    farGull(ctx, 500 + Math.sin(t * 0.6 + 1) * 40, 270, t + 0.3, 0.6);
    wave(ctx, t, { ...MID, top: '#5fa8c4', deep: '#3a86a8', seed: 42 });
    floatingBoat(ctx, 820, t, { base: 770, amp: 0.6 }, { scale: 1 + 0.015 * b.pulse });
    fishJump(ctx, t, 11.4, { x: 1120, sea: { base: 820, amp: 0.7 }, dir: 1 });
    wave(ctx, t + 1.3, { base: 830, amp: 0.7, top: '#3a86a8', deep: '#2a6f93', seed: 43 });
    wave(ctx, t + 2.1, { base: 950, amp: 0.8, top: '#2a6f93', deep: '#1f5878', seed: 44 });
    const gx = lerp(W + 150, -150, prog(t, 5.5, 13.5));
    if (gx < W + 140 && gx > -140) gull(ctx, gx, 470 + Math.sin(t * 1.3) * 30, t, { dir: -1, scale: 1.9 });
  });
  title(ctx, t);
}

export const scenes = [
  { id: 'matin', from: 0, to: ['tempete', 0, -0.4], draw },
];
