// Thème graphique du film : couleurs, typographie, panneau de titre, cartes, pictos, texte animé.
// À adapter à la charte du film (couleurs de C, police de FONT, inclinaison SLANT). Tout est fonction pure du temps.
import { W, H, clamp, ease, lerp } from '/core/anim/engine.js';

export const C = {
  primary: '#0F5C63',     // panneau de titre, titres, pictos
  primaryDark: '#0A3F44', // bande des panneaux de chapitre
  accent: '#E0782E',      // sur-titres, badges secondaires
  ink: '#22282E',
  muted: '#68717A',
  soft: '#EDF3F3',
  line: '#D6DFDF',
  light: '#9ED6CF',       // mots mis en valeur sur le panneau
  bg: '#F4F3EF',          // fond de la zone de contenu
  white: '#FFFFFF',
  green: '#1E8E4E', greenBg: '#E8F5EE',
  orange: '#D9841E', orangeBg: '#FCF1E3',
  red: '#C93B3B', redBg: '#FAEAEA',
  accentBg: '#FBEFE6',
};

// Police de la charte en tête (chargée par lib/assets.js si le film l'embarque), puis polices système.
export const FONT = '"Segoe UI", "Helvetica Neue", Arial, "DejaVu Sans", sans-serif';
export const font = (size, weight = 400, italic = false) => `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;

// Inclinaison du bord droit du panneau : tangente de l'angle (0 = bord droit vertical).
export const SLANT = 0;

// Progression 0..1 d'une apparition qui commence à `a` et dure `d` secondes.
export const appear = (t, a, d = 0.6, e = ease.out) => e(clamp((t - a) / d));

export function panel(ctx, w, color = C.primary, x0 = -10) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, -10);
  ctx.lineTo(w + 10 * SLANT, -10);
  ctx.lineTo(w - (H + 10) * SLANT, H + 10);
  ctx.lineTo(x0, H + 10);
  ctx.closePath();
  ctx.fill();
}

// Bord droit du panneau à la hauteur y.
export const panelEdge = (w, y) => w - y * SLANT;

export function background(ctx) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
}

// Typographie française : espaces insécables avant la ponctuation haute et dans les guillemets, apostrophe courbe.
const nbsp = (s) => s.replace(/ ([:;?!»])/g, ' $1').replace(/« /g, '« ').replace(/'/g, '’');

export function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of nbsp(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxW) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

// Paragraphe : renvoie la hauteur occupée. o = { size, weight, color, lh, align, italic, alpha }
export function para(ctx, text, x, y, maxW, o = {}) {
  const size = o.size ?? 22;
  const lh = o.lh ?? Math.round(size * 1.35);
  ctx.save();
  ctx.font = font(size, o.weight ?? 400, o.italic);
  ctx.fillStyle = o.color ?? C.ink;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'top';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const lines = wrap(ctx, text, maxW);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  ctx.restore();
  return lines.length * lh;
}

export function measure(ctx, text, maxW, size, weight = 400) {
  ctx.save();
  ctx.font = font(size, weight);
  const n = wrap(ctx, text, maxW).length;
  ctx.restore();
  return n * Math.round(size * 1.35);
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Carte blanche à ombre douce ; k (0..1) pilote l'apparition (montée + fondu).
export function card(ctx, x, y, w, h, k = 1, o = {}) {
  if (k <= 0) return false;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.4);
  ctx.translate(0, (1 - k) * 40);
  ctx.shadowColor = 'rgba(10, 40, 45, 0.13)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = o.fill ?? C.white;
  rrect(ctx, x, y, w, h, o.r ?? 18);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  if (o.stroke) {
    ctx.lineWidth = o.lineWidth ?? 3;
    ctx.strokeStyle = o.stroke;
    ctx.stroke();
  }
  ctx.restore();
  return true;
}

// Mise en avant de l'élément dont parle la voix : contour qui apparaît.
export function focusRing(ctx, x, y, w, h, k, color = C.primary, r = 18) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k);
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  rrect(ctx, x - 6, y - 6, w + 12, h + 12, r + 5);
  ctx.stroke();
  ctx.restore();
}

export function icon(ctx, img, cx, cy, size, alpha = 1) {
  if (!img) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

// Picto blanc (image) dans un disque de couleur.
export function badge(ctx, img, cx, cy, r, k = 1, color = C.primary) {
  if (k <= 0) return;
  const s = ease.back(clamp(k));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  icon(ctx, img, 0, 0, r * 1.05);
  ctx.restore();
}

export function numberBadge(ctx, n, cx, cy, r, k = 1, color = C.primary) {
  if (k <= 0) return;
  const s = ease.back(clamp(k));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.font = font(r * 1.05, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 0, r * 0.06);
  ctx.restore();
}

export function pill(ctx, text, x, y, o = {}) {
  const size = o.size ?? 18;
  ctx.save();
  ctx.font = font(size, o.weight ?? 700);
  const w = ctx.measureText(text).width + size * 1.6;
  const h = size * 1.9;
  const xx = o.align === 'center' ? x - w / 2 : x;
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.fillStyle = o.fill ?? C.primary;
  rrect(ctx, xx, y, w, h, h / 2);
  ctx.fill();
  if (o.stroke) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = o.stroke;
    ctx.stroke();
  }
  ctx.fillStyle = o.color ?? C.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, xx + w / 2, y + h / 2 + 1);
  ctx.restore();
  return w;
}

// Coche ou croix tracée progressivement (k 0..1).
export function mark(ctx, kind, cx, cy, s, k, color) {
  if (k <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.22;
  ctx.strokeStyle = color ?? (kind === 'check' ? C.green : C.red);
  const seg = (ax, ay, bx, by, a, b) => {
    const u = clamp((k - a) / (b - a));
    if (u <= 0) return;
    ctx.beginPath();
    ctx.moveTo(cx + ax * s, cy + ay * s);
    ctx.lineTo(cx + lerp(ax, bx, u) * s, cy + lerp(ay, by, u) * s);
    ctx.stroke();
  };
  if (kind === 'check') {
    seg(-0.42, 0.02, -0.12, 0.32, 0, 0.4);
    seg(-0.12, 0.32, 0.45, -0.3, 0.4, 1);
  } else {
    seg(-0.33, -0.33, 0.33, 0.33, 0, 0.5);
    seg(0.33, -0.33, -0.33, 0.33, 0.5, 1);
  }
  ctx.restore();
}

// Flèche (trait progressif + pointe), k 0..1. o = { color, width, head, dashed, both }
export function arrow(ctx, x1, y1, x2, y2, k, o = {}) {
  if (k <= 0) return;
  const x = lerp(x1, x2, clamp(k));
  const y = lerp(y1, y2, clamp(k));
  ctx.save();
  ctx.strokeStyle = o.color ?? C.primary;
  ctx.fillStyle = o.color ?? C.primary;
  ctx.lineWidth = o.width ?? 3;
  ctx.lineCap = 'round';
  if (o.dashed) ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);
  const head = (hx, hy, dx, dy) => {
    const a = Math.atan2(dy, dx);
    const s = o.head ?? 14;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - s * Math.cos(a - 0.45), hy - s * Math.sin(a - 0.45));
    ctx.lineTo(hx - s * Math.cos(a + 0.45), hy - s * Math.sin(a + 0.45));
    ctx.closePath();
    ctx.fill();
  };
  if (k >= 0.98) {
    head(x2, y2, x2 - x1, y2 - y1);
    if (o.both) head(x1, y1, x1 - x2, y1 - y2);
  }
  ctx.restore();
}

// Texte révélé mot à mot entre a et b ; les mots de `hi` prennent la couleur hiColor.
export function wordReveal(ctx, text, x, y, maxW, t, a, b, o = {}) {
  const size = o.size ?? 40;
  const lh = o.lh ?? Math.round(size * 1.3);
  ctx.save();
  const base = ctx.globalAlpha;
  ctx.font = font(size, o.weight ?? 700, o.italic);
  ctx.textBaseline = 'top';
  const lines = wrap(ctx, text, maxW);
  const total = lines.reduce((n, l) => n + l.split(' ').length, 0);
  let i = 0;
  const hi = (o.hi ?? []).map((s) => s.toLowerCase());
  lines.forEach((l, li) => {
    let cx = x;
    if (o.align === 'center') cx = x + (maxW - ctx.measureText(l).width) / 2;
    for (const w of l.split(' ')) {
      const u = clamp(((t - a) / Math.max(0.01, b - a)) * total - i, 0, 1);
      const bare = w.toLowerCase().replace(/’/g, "'").replace(/[^\p{L}']/gu, '');
      ctx.globalAlpha = base * (o.alpha ?? 1) * (o.dim !== undefined ? lerp(o.dim, 1, u) : u);
      ctx.fillStyle = hi.includes(bare) ? (o.hiColor ?? C.light) : (o.color ?? C.white);
      ctx.fillText(w, cx, y + li * lh + (o.dim !== undefined ? 0 : (1 - ease.out(u)) * 14));
      cx += ctx.measureText(w + ' ').width;
      i++;
    }
  });
  ctx.restore();
  return lines.length * lh;
}

export const isIn = (t, a, b) => t >= a && t < b;
