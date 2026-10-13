// Décors et personnages du film d'exemple : ciel, soleil, mer, bateau, poisson, mouettes, nuages,
// phare, éclair, île, étoiles. Tout est fonction du temps t et de graines fixes (aucun hasard d'une image à l'autre).
import { W, H, TAU, clamp, lerp, hash, noise1 } from '/core/anim/engine.js';
import { cutout, cutPoly, cutCurvy, ellipse, rrect, blob, ink } from '/core/anim/paper/paper.js';

export const INK = '#2a1a10';
const FULL = cutPoly([[-80, -80], [W + 80, -80], [W + 80, H + 80], [-80, H + 80]], 3);
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

// ---------- Ciel, lumière ----------

// Ciel en dégradé vertical, stops = [[position 0..1, couleur], ...], avec le grain du papier.
export function sky(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
  for (const [o, c] of stops) g.addColorStop(o, c);
  cutout(ctx, FULL, { fill: g, lift: 0, rim: 0 });
}

// Halo lumineux (soleil, phare, lanterne) : rgb = [r, g, b].
export function glow(ctx, x, y, r, rgb, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(rgb, alpha));
  g.addColorStop(0.4, rgba(rgb, alpha * 0.35));
  g.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

// Voile de couleur sur tout l'écran (crépuscule, éclair, fondu).
export function veil(ctx, rgb, alpha) {
  if (alpha <= 0.002) return;
  ctx.fillStyle = rgba(rgb, alpha);
  ctx.fillRect(-80, -80, W + 160, H + 160);
}

const SUN = cutCurvy(ellipse(0, 0, 100, 100), 5);
export function sun(ctx, x, y, r, fill, glowRgb) {
  glow(ctx, x, y, r * 3.4, glowRgb, 0.6);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r / 100, r / 100);
  cutout(ctx, SUN, { fill, outline: INK, lw: 4, lift: 4 });
  ctx.restore();
}

// Reflet du soleil sur l'eau : traits horizontaux qui scintillent.
export function sunGlints(ctx, x, y0, t, rgb, n = 9) {
  for (let i = 0; i < n; i++) {
    const y = y0 + i * 22;
    const w = (130 - i * 9) * (0.7 + 0.3 * Math.sin(t * 3 + i * 1.7));
    ink(ctx, [[x - w / 2 + noise1(t + i, 9) * 20, y], [x + w / 2 + noise1(t + i, 9) * 20, y]], { color: rgba(rgb, 0.75 - i * 0.06), lw: 6 });
  }
}

// ---------- Nuages, étoiles ----------

// Nuage en deux épaisseurs de papier (ombre dessous, reflet dessus).
export function puff(ctx, cx, cy, w, h, seed, base, light) {
  cutout(ctx, cutCurvy(blob(cx, cy, w / 2, h / 2, seed, 3, 0.16), seed), { fill: base, outline: INK, lw: 3, lift: 5 });
  cutout(ctx, cutCurvy(blob(cx - w * 0.08, cy - h * 0.12, w * 0.3, h * 0.26, seed + 1, 3, 0.12), seed + 1), { fill: light, lift: 0, rim: 0.3 });
}

// Nuages qui dérivent de gauche à droite, en boucle.
export function cloudBank(ctx, t, { n, y, w, h, speed, seed, base, light, spread = 620 }) {
  for (let i = 0; i < n; i++) {
    const cx = ((i * spread + hash(seed + i) * 300 + t * speed) % (W + 2 * w)) - w;
    puff(ctx, cx, y + hash(seed * 7 + i) * 90, w * (0.8 + hash(seed + i * 3) * 0.4), h, seed + i * 5, base, light);
  }
}

const STAR = (() => {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8, r = i % 2 ? 4 : 13;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return cutPoly(pts, 9, 0.4);
})();
export function stars(ctx, t, alpha, n = 40) {
  if (alpha <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const x = hash(i * 13 + 1) * W, y = hash(i * 13 + 2) * 420;
    const k = (0.6 + 0.4 * hash(i)) * (0.75 + 0.25 * Math.sin(t * 2.5 + i * 2.1));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    cutout(ctx, STAR, { fill: '#fff4c2', lift: 2, rim: 0, alpha: alpha * clamp((alpha * 40 - i) / 6 + 1) });
    ctx.restore();
  }
}

// ---------- Mer ----------

export function seaY(x, t, base, amp) {
  return base + Math.sin(x * 0.006 + t * 1.6) * 18 * amp + Math.sin(x * 0.013 - t * 2.3) * 9 * amp + noise1(x * 0.004 + t * 0.5, 3) * 10 * amp;
}

// Une couche de mer : bande découpée en dégradé, écume sur les crêtes et petits traits d'écume.
export function wave(ctx, t, { base, amp, top, deep, seed, foam = 0.8 }) {
  const pts = [];
  for (let x = -60; x <= W + 60; x += 24) pts.push([x, seaY(x, t, base, amp)]);
  const g = ctx.createLinearGradient(0, base - 40 * amp, 0, base + 260);
  g.addColorStop(0, top);
  g.addColorStop(1, deep);
  cutout(ctx, cutPoly([...pts, [W + 60, H + 80], [-60, H + 80]], seed, 1.4), { fill: g, outline: INK, lw: 3.5, lift: 6 });
  if (!foam) return;
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i][1] < pts[i - 1][1] && pts[i][1] <= pts[i + 1][1]) {
      ink(ctx, [[pts[i - 1][0] + 4, pts[i - 1][1] + 9], [pts[i][0], pts[i][1] + 7], [pts[i + 1][0] - 4, pts[i + 1][1] + 9]], { color: `rgba(255,255,255,${foam})`, lw: 5 });
    }
  }
  for (let k = 0; k < 14; k++) {
    const x = ((hash(seed * 31 + k) * (W + 200) + t * 25) % (W + 200)) - 100;
    const y = seaY(x, t, base, amp) + 30 + hash(seed * 17 + k) * 140;
    const w = 18 + hash(k + seed) * 34;
    ink(ctx, [[x, y], [x + w, y]], { color: `rgba(255,255,255,${foam * 0.35})`, lw: 4 });
  }
}

// ---------- Bateau ----------

const HULL = cutPoly([[-160, -42], [160, -42], [108, 32], [-108, 32]], 21);
const SAIL_R = cutPoly([[4, -48], [4, -250], [118, -64]], 22);
const SAIL_L = cutPoly([[-6, -48], [-6, -214], [-100, -64]], 23);
const MAST = cutPoly(rrect(-5, -262, 10, 222, 4), 24, 0.4);

// Bateau de papier plié : coque, mât, deux voiles, fanion qui flotte, lanterne optionnelle (lamp 0..1).
// Origine : milieu de la ligne de flottaison.
export function boat(ctx, { x, y, angle = 0, scale = 1, t = 0, lamp = 0 }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  cutout(ctx, MAST, { fill: '#9b6a3e', outline: INK, lw: 3, lift: 3 });
  const flag = [];
  for (let i = 0; i <= 6; i++) flag.push([5 + i * 12, -258 + Math.sin(t * 7 - i * 0.9) * i * 1.6]);
  for (let i = 6; i >= 0; i--) flag.push([5 + i * 12, -232 + Math.sin(t * 7 - i * 0.9) * i * 1.6 - i * 1.8]);
  cutout(ctx, cutPoly(flag, 25, 0.6), { fill: '#3f8fd2', outline: INK, lw: 3, lift: 3 });
  cutout(ctx, SAIL_L, { fill: '#f2c230', outline: INK, lw: 4, lift: 5 });
  cutout(ctx, SAIL_R, { fill: '#e8574a', outline: INK, lw: 4, lift: 5 });
  ink(ctx, [[4, -150], [70, -88]], { color: 'rgba(42,26,16,0.3)', lw: 3 });
  cutout(ctx, HULL, { fill: '#f6f1e4', outline: INK, lw: 4, lift: 7 });
  ink(ctx, [[-160, -42], [-80, 18], [0, -42], [80, 18], [160, -42]], { lw: 3, color: 'rgba(42,26,16,0.4)' });
  if (lamp > 0) {
    glow(ctx, 0, -120, 160, [255, 200, 90], 0.55 * lamp);
    cutout(ctx, cutPoly(rrect(-11, -134, 22, 28, 5), 26, 0.3), { fill: `rgb(255,${190 + 40 * lamp},${80 + 60 * lamp})`, outline: INK, lw: 3, lift: 2 });
  }
  ctx.restore();
}

// Bateau posé sur la mer : hauteur et inclinaison suivent la vague.
export function floatingBoat(ctx, x, t, sea, opt = {}) {
  const y = seaY(x, t, sea.base, sea.amp);
  const slope = (seaY(x + 50, t, sea.base, sea.amp) - seaY(x - 50, t, sea.base, sea.amp)) / 100;
  boat(ctx, { x, y: y - 10, angle: Math.atan(slope) * 0.9 + (opt.tilt ?? 0), scale: opt.scale ?? 1, t, lamp: opt.lamp ?? 0 });
  return y;
}

// Sillage : bulles d'écume qui s'éloignent derrière le bateau (dir = sens de la marche).
export function wake(ctx, x, t, sea, dir = 1, strength = 1) {
  for (let i = 0; i < 9; i++) {
    const age = (i + ((t * 2) % 1)) / 9;
    const xx = x - dir * (150 + age * 380);
    const y = seaY(xx, t, sea.base, sea.amp) + 6 + age * 14;
    const r = (16 - age * 10) * strength;
    cutout(ctx, cutCurvy(ellipse(xx, y, r * 1.8, r * 0.6), 30 + i), { fill: `rgba(255,255,255,${0.8 * (1 - age) * strength})`, lift: 0, rim: 0 });
  }
}

// ---------- Poisson, mouettes ----------

const FISH = cutCurvy([[-60, 0], [-20, -26], [30, -22], [62, 0], [30, 22], [-20, 26]], 41);
const TAIL = cutPoly([[-52, 0], [-92, -30], [-84, 0], [-92, 30]], 42);
// Saut de poisson entre t0 et t0 + dur, de x à x + dir * span, au-dessus de la vague `sea`.
export function fishJump(ctx, t, t0, { x, sea, dir = 1, span = 340, height = 250, dur = 1.2, color = '#f28a2a' }) {
  const u = (t - t0) / dur;
  if (u < -0.1 || u > 1.15) return;
  const uu = clamp(u);
  const px = x + dir * span * uu;
  const py = seaY(px, t, sea.base, sea.amp) - height * 4 * uu * (1 - uu);
  // Gerbes d'eau au départ et à l'arrivée.
  for (const [ux, su] of [[0, u], [1, u - 1]]) {
    if (su < 0 || su > 0.35) continue;
    const sx = x + dir * span * ux;
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.35;
      const d = su * 260;
      const dx = sx + Math.cos(a) * d * 0.6, dy = seaY(sx, t, sea.base, sea.amp) + Math.sin(a) * d + su * su * 900;
      cutout(ctx, cutCurvy(ellipse(dx, dy, 9, 9), 50 + k), { fill: 'rgba(255,255,255,0.9)', lift: 2, rim: 0 });
    }
  }
  if (u <= 0 || u >= 1) return;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(dir, 1);
  ctx.rotate(Math.atan2(-height * 4 * (1 - 2 * uu), span) * 0.8);
  cutout(ctx, TAIL, { fill: color, outline: INK, lw: 3, lift: 4 });
  cutout(ctx, FISH, { fill: color, outline: INK, lw: 4, lift: 5 });
  ink(ctx, [[-8, -18], [6, 0], [-8, 18]], { color: 'rgba(42,26,16,0.5)', lw: 3 });
  cutout(ctx, cutCurvy(ellipse(36, -6, 7, 7), 43), { fill: '#ffffff', outline: INK, lw: 2.5, lift: 0 });
  ink(ctx, [[37, -6], [38, -6]], { lw: 5 });
  ctx.restore();
}

const GULL_BODY = cutCurvy(ellipse(0, 0, 34, 14), 61);
// Mouette en papier, ailes battantes. Origine : le corps.
export function gull(ctx, x, y, t, { scale = 1, dir = 1, phase = 0 } = {}) {
  const f = Math.sin(t * 8 + phase);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * dir, scale);
  const wing = (off, fill, seed) => cutout(ctx, cutPoly([[-14 + off, -2], [14 + off, -4], [-18 + off, -50 * f - 4], [-42 + off, -40 * f + 6]], seed, 0.5), { fill, outline: INK, lw: 3, lift: 4 });
  wing(-12, '#e2ddd2', 62);
  cutout(ctx, GULL_BODY, { fill: '#ffffff', outline: INK, lw: 3, lift: 4 });
  wing(0, '#ffffff', 63);
  cutout(ctx, cutPoly([[32, -3], [50, 2], [32, 6]], 64, 0.3), { fill: '#f2a03d', outline: INK, lw: 2, lift: 1 });
  ink(ctx, [[22, -4], [23, -4]], { lw: 5 });
  ctx.restore();
}

// Petites mouettes lointaines, en trait.
export function farGull(ctx, x, y, t, s = 1) {
  const f = Math.sin(t * 8) * 12 * s;
  ink(ctx, [[x - 26 * s, y - f], [x - 9 * s, y - 8 * s], [x, y], [x + 9 * s, y - 8 * s], [x + 26 * s, y - f]], { lw: 4 * s });
}

// ---------- Phare, éclair ----------

const ROCK = cutCurvy(blob(1640, 720, 200, 90, 81, 4, 0.12), 81);
const TOWER = [[1600, 660], [1680, 660], [1666, 400], [1614, 400]];
// Phare sur son rocher ; le faisceau balaie la mer (angle en fonction de t).
export function lighthouse(ctx, t, beam = 1) {
  cutout(ctx, ROCK, { fill: '#59606b', outline: INK, lw: 4, lift: 6 });
  cutout(ctx, cutPoly(TOWER, 82), { fill: '#f4efe2', outline: INK, lw: 4, lift: 6 });
  ctx.save();
  ctx.clip(cutPoly(TOWER, 82));
  ctx.fillStyle = '#d8453a';
  for (const y of [430, 520, 610]) ctx.fillRect(1590, y, 110, 42);
  ctx.restore();
  cutout(ctx, cutPoly(rrect(1606, 360, 68, 46, 6), 83), { fill: '#ffe38a', outline: INK, lw: 4, lift: 3 });
  cutout(ctx, cutPoly([[1596, 362], [1684, 362], [1640, 318]], 84), { fill: '#d8453a', outline: INK, lw: 4, lift: 4 });
  if (beam <= 0) return;
  const a = Math.PI + Math.sin(t * 0.9) * 0.75;
  ctx.save();
  ctx.translate(1640, 383);
  ctx.rotate(a);
  const g = ctx.createLinearGradient(0, 0, 1300, 0);
  g.addColorStop(0, `rgba(255,236,150,${0.55 * beam})`);
  g.addColorStop(1, 'rgba(255,236,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(1300, -170);
  ctx.lineTo(1300, 170);
  ctx.lineTo(0, 14);
  ctx.fill();
  ctx.restore();
  glow(ctx, 1640, 383, 140, [255, 230, 140], 0.7 * beam);
}

// Éclair découpé dans du papier jaune, de (x, y0) jusqu'à la mer.
export function bolt(ctx, x, y0, y1, seed, alpha) {
  if (alpha <= 0.02) return;
  const pts = [[x, y0]];
  const n = 5;
  for (let i = 1; i <= n; i++) pts.push([x + (hash(seed * 11 + i) - 0.5) * 140, lerp(y0, y1, i / n)]);
  const left = pts.map(([px, py], i) => [px - 30 + i * 5, py]);
  const right = pts.map(([px, py], i) => [px + 30 - i * 5, py + 34]).reverse();
  cutout(ctx, cutPoly([...left, ...right], seed, 0.8), { fill: '#ffe25a', outline: INK, lw: 4, lift: 8, alpha });
}

// ---------- Île ----------

const ISLAND = cutCurvy(blob(1560, 770, 360, 120, 71, 4, 0.08), 71);
const TRUNK = cutCurvy([[1700, 700], [1722, 700], [1760, 560], [1782, 470], [1762, 466], [1736, 556]], 72);
const HUT = cutPoly([[1400, 720], [1400, 640], [1500, 640], [1500, 720]], 75);
const ROOF = cutPoly([[1380, 648], [1450, 584], [1520, 648]], 76);
export function island(ctx, t, lights = 0) {
  cutout(ctx, ISLAND, { fill: '#e9c46a', outline: INK, lw: 4, lift: 8 });
  for (let i = 0; i < 7; i++) {
    const x = 1300 + i * 70, y = 712 - Math.sin(i * 1.3) * 10;
    ink(ctx, [[x - 10, y + 8], [x, y - 14], [x + 10, y + 8]], { color: '#4f8f3f', lw: 4 });
  }
  cutout(ctx, HUT, { fill: '#b07a4a', outline: INK, lw: 4, lift: 5 });
  cutout(ctx, ROOF, { fill: '#7c4f2c', outline: INK, lw: 4, lift: 5 });
  cutout(ctx, cutPoly(rrect(1432, 660, 34, 34, 4), 77), { fill: lights > 0 ? `rgb(255,${180 + 50 * lights},90)` : '#4a3424', outline: INK, lw: 3, lift: 1 });
  if (lights > 0) glow(ctx, 1449, 677, 120, [255, 200, 90], 0.5 * lights);
  cutout(ctx, TRUNK, { fill: '#8a5a33', outline: INK, lw: 4, lift: 4 });
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.52 + Math.sin(t * 1.4 + i) * 0.05;
    ctx.save();
    ctx.translate(1772, 470);
    ctx.rotate(a);
    cutout(ctx, cutCurvy([[0, 0], [60, -24], [130, -14], [170, 10], [110, 12], [50, 14]], 73 + i), { fill: i % 2 ? '#4f9d55' : '#3f8a48', outline: INK, lw: 3, lift: 4 });
    ctx.restore();
  }
}

// ---------- Caméra ----------

// Zoom et décalage autour du centre de l'écran, appliqués à tout ce qui est dessiné dans fn.
export function camera(ctx, { zoom = 1, dx = 0, dy = 0, rot = 0 }, fn) {
  ctx.save();
  ctx.translate(W / 2 + dx, H / 2 + dy);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);
  fn();
  ctx.restore();
}

