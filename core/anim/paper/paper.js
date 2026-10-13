// Bibliothèque "papier découpé" : textures procédurales, formes coupées aux ciseaux,
// ombres portées de papier superposé, scotch, punaises, attaches parisiennes.
import { rng, TAU, lerp } from '../engine.js';

const TEX = {};
const PATTERNS = new WeakMap();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Dessine 9 fois pour que la texture se répète sans couture.
function tiled(size, fn) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) fn(dx, dy);
}

// Grain de papier : taches douces + fibres + bruit, centré sur le gris 128 (neutre en soft-light).
function makeGrain(size, seed, fibers, blotches, noiseAmp) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const R = rng(seed);
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < blotches; i++) {
    const x = R() * size, y = R() * size, rad = 20 + R() * 90, v = R() < 0.5 ? 100 : 156;
    tiled(size, (dx, dy) => {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.22)`);
      gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    });
  }
  g.lineCap = 'round';
  for (let i = 0; i < fibers; i++) {
    const x = R() * size, y = R() * size, len = 5 + R() * 24, a = R() * TAU, v = R() < 0.5 ? 70 : 200;
    g.strokeStyle = `rgba(${v},${v},${v},${0.08 + R() * 0.16})`;
    g.lineWidth = 0.5 + R() * 0.9;
    const bend = (R() - 0.5) * 1.2;
    tiled(size, (dx, dy) => {
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.quadraticCurveTo(
        x + dx + Math.cos(a + bend) * len * 0.5, y + dy + Math.sin(a + bend) * len * 0.5,
        x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len,
      );
      g.stroke();
    });
  }
  const im = g.getImageData(0, 0, size, size);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * noiseAmp;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(im, 0, 0);
  return c;
}

// Carton : ondulations horizontales douces + mouchetures sombres.
function makeCard(size, seed) {
  const c = makeGrain(size, seed, 400, 30, 18);
  const g = c.getContext('2d');
  const R = rng(seed + 1);
  for (let y = 0; y < size; y += 16) {
    const gr = g.createLinearGradient(0, y, 0, y + 16);
    gr.addColorStop(0, 'rgba(160,160,160,0.10)');
    gr.addColorStop(0.5, 'rgba(96,96,96,0.10)');
    gr.addColorStop(1, 'rgba(160,160,160,0.10)');
    g.fillStyle = gr;
    g.fillRect(0, y, size, 16);
  }
  for (let i = 0; i < 900; i++) {
    const x = R() * size, y = R() * size, r = 0.4 + R() * 1.3;
    g.fillStyle = `rgba(40,40,40,${0.12 + R() * 0.25})`;
    tiled(size, (dx, dy) => { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); });
  }
  return c;
}

export function initPaper() {
  TEX.grain = makeGrain(512, 7, 700, 60, 26);
  TEX.fine = makeGrain(256, 3, 260, 16, 20);
  TEX.card = makeCard(512, 11);
}

export function pattern(ctx, name) {
  let m = PATTERNS.get(ctx);
  if (!m) { m = {}; PATTERNS.set(ctx, m); }
  if (!m[name]) m[name] = ctx.createPattern(TEX[name], 'repeat');
  return m[name];
}

// ---------- Générateurs de formes (tableaux de points [x, y]) ----------

export function ellipse(cx, cy, rx, ry, n = 44, a0 = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

export function rrect(x, y, w, h, r, seg = 5) {
  r = Math.min(r, w / 2, h / 2);
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return pts;
}

// Forme organique (rocher, tête, buisson) : rayon modulé par quelques sinus.
export function blob(cx, cy, rx, ry, seed, lumps = 5, amt = 0.12, n = 60) {
  const R = rng(seed);
  const waves = Array.from({ length: 3 }, (_, k) => ({ f: lumps + k * 2 + Math.floor(R() * 3), p: R() * TAU, a: amt / (k + 1) }));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    let k = 1;
    for (const w of waves) k += Math.sin(a * w.f + w.p) * w.a;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

// Nuage : bosses rondes en haut, base presque plate.
export function cloud(cx, cy, w, h, seed, bumps = 5) {
  const R = rng(seed);
  const pts = [];
  const left = cx - w / 2, right = cx + w / 2, base = cy + h * 0.35;
  pts.push([right - h * 0.2, base]);
  for (let i = 0; i <= 10; i++) pts.push([lerp(right - h * 0.2, left + h * 0.2, i / 10), base + Math.sin(i * 1.7 + seed) * 2]);
  const centers = [];
  for (let i = 0; i < bumps; i++) {
    const u = (i + 0.5) / bumps;
    const bh = h * (0.45 + 0.55 * Math.sin(Math.PI * u)) * (0.85 + R() * 0.3);
    centers.push([lerp(left + h * 0.25, right - h * 0.25, u), base - bh * 0.55, bh * 0.62]);
  }
  // Contour supérieur : arcs successifs de gauche à droite.
  pts.push([left + h * 0.05, base - h * 0.05]);
  for (const [bx, by, br] of centers) {
    for (let j = 0; j <= 8; j++) {
      const a = Math.PI + (j / 8) * Math.PI;
      pts.push([bx + Math.cos(a) * br, by + Math.sin(a) * br * 0.95]);
    }
  }
  pts.push([right - h * 0.05, base - h * 0.05]);
  return pts;
}

// Rééchantillonne un contour fermé puis le décale légèrement : coupe "aux ciseaux".
export function jitter(pts, seed, amp = 1.3, step = 16) {
  const R = rng(seed);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const o = (R() - 0.5) * 2 * amp;
      out.push([lerp(x0, x1, t) + nx * o, lerp(y0, y1, t) + ny * o]);
    }
  }
  return out;
}

export function poly(pts, closed = true) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (closed) p.closePath();
  return p;
}

// Contour lissé (courbes quadratiques passant par les milieux).
export function curvy(pts) {
  const p = new Path2D();
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

// Raccourcis : forme coupée aux ciseaux, prête à dessiner.
export const cutPoly = (pts, seed = 1, amp = 1.2) => poly(jitter(pts, seed, amp));
export const cutCurvy = (pts, seed = 1, amp = 1.0) => curvy(jitter(pts, seed, amp, 12));

// ---------- Rendu d'une pièce de papier ----------

function currentScale(ctx) {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b);
}

// Dessine une pièce : ombre de papier surélevé, couleur, grain, liseré de coupe clair, contour.
export function cutout(ctx, path, o = {}) {
  const {
    fill = '#cccccc', tex = 'grain', texAlpha = 0.55, outline = null, lw = 4,
    lift = 5, shadowAlpha = 0.32, rim = 0.2, alpha = 1,
  } = o;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  if (lift > 0) {
    const k = currentScale(ctx);
    ctx.save();
    ctx.shadowColor = `rgba(30,18,8,${shadowAlpha * alpha})`;
    ctx.shadowBlur = (2 + lift * 1.1) * k;
    ctx.shadowOffsetX = lift * 0.6 * k;
    ctx.shadowOffsetY = lift * k;
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.restore();
  } else {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }
  if (tex) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = texAlpha * alpha;
    ctx.fillStyle = pattern(ctx, tex);
    ctx.fill(path);
    ctx.restore();
  }
  if (rim) {
    ctx.save();
    ctx.clip(path);
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(255,252,240,${rim})`;
    ctx.stroke(path);
    ctx.restore();
  }
  if (outline) {
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = outline;
    ctx.stroke(path);
  }
  ctx.restore();
}

// Trait "feutre" (sourcils, bouche, lignes de détail).
export function ink(ctx, pts, { color = '#2a1a10', lw = 4, close = false, fill = null } = {}) {
  const p = poly(pts, close);
  ctx.save();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (fill) { ctx.fillStyle = fill; ctx.fill(p); }
  ctx.strokeStyle = color;
  ctx.stroke(p);
  ctx.restore();
}

// ---------- Accessoires de bricolage ----------

// Morceau de scotch translucide aux bouts dentelés.
export function tape(ctx, x, y, w, angle = 0, seed = 1, h = 30) {
  const R = rng(seed);
  const pts = [];
  const teeth = 5;
  for (let i = 0; i <= teeth; i++) pts.push([-w / 2 + (R() - 0.5) * 5, -h / 2 + (i / teeth) * h]);
  const right = [];
  for (let i = 0; i <= teeth; i++) right.push([w / 2 + (R() - 0.5) * 5, h / 2 - (i / teeth) * h]);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  cutout(ctx, poly([...pts, ...right]), { fill: 'rgba(238,228,196,0.62)', tex: 'fine', texAlpha: 0.5, lift: 1.5, shadowAlpha: 0.15, rim: 0 });
  ctx.restore();
}

// Punaise vue de dessus.
export function pin(ctx, x, y, color = '#d8342c', r = 11) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(30,18,8,0.45)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.1)');
  g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Attache parisienne dorée (articulation des marionnettes).
export function fastener(ctx, x, y, r = 6, angle = 0.6) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 0.5, 0, 0, r);
  g.addColorStop(0, '#fff3b8');
  g.addColorStop(0.45, '#d9a93a');
  g.addColorStop(1, '#8a5f14');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,45,10,0.8)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0);
  ctx.lineTo(r * 0.55, 0);
  ctx.stroke();
  ctx.restore();
}

// Baguette en bois (pour les soleils, lunes et panneaux tenus "à la main").
export function stick(ctx, x0, y0, x1, y1, w = 12) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const len = Math.hypot(x1 - x0, y1 - y0);
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(a);
  cutout(ctx, poly([[0, -w / 2], [len, -w / 2 + 1], [len, w / 2 - 1], [0, w / 2]]), { fill: '#b98a52', tex: 'card', texAlpha: 0.7, lift: 3, rim: 0.1 });
  ctx.restore();
}
