// Composants de mise en page des scènes : colonnes de la zone de contenu, listes cochées, cartes, bandeaux, bulles.
import { clamp, ease, lerp } from '/core/anim/engine.js';
import { C, appear, badge, card, font, icon, mark, measure, numberBadge, para, rrect, wordReveal } from './theme.js';

// Zone de contenu, à droite du panneau en mise en page « band » (largeur 600 dans film.js).
export const X0 = 700;
export const CW = 1140;
export const col3 = (i) => ({ x: X0 + i * 390, w: 360 });
export const col2 = (i) => ({ x: X0 + i * 585, w: 555 });

const tinted = new Map();
// Picto blanc recoloré (cache : même résultat à chaque image).
export function tint(img, color) {
  const key = `${img.src}|${color}`;
  if (!tinted.has(key)) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tinted.set(key, c);
  }
  return tinted.get(key);
}

// Liste à puces cochées ; items apparaissent à times[i]. Renvoie la hauteur.
export function checkList(ctx, items, x, y, w, t, times, o = {}) {
  const size = o.size ?? 19;
  let yy = y;
  items.forEach((txt, i) => {
    const k = appear(t, times[i] ?? times[times.length - 1], 0.5);
    const h = measure(ctx, txt, w - 40, size);
    if (k > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp(k * 1.5);
      ctx.translate((1 - k) * 18, 0);
      mark(ctx, o.kind ?? 'check', x + 12, yy + size * 0.7, size * 0.95, clamp(k * 1.3), o.markColor ?? C.primary);
      para(ctx, txt, x + 40, yy, w - 40, { size, color: o.color ?? C.ink, weight: o.weight ?? 400 });
      ctx.restore();
    }
    yy += h + (o.gap ?? 14);
  });
  return yy - y;
}

// Carte : badge (picto A.icons[o.icon] ou numéro o.n), petit sur-titre, titre, texte. k = apparition.
export function iconCard(ctx, A, x, y, w, h, k, o) {
  if (!card(ctx, x, y, w, h, k, { fill: o.fill, stroke: o.stroke })) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.4);
  ctx.translate(0, (1 - k) * 40);
  const pad = o.pad ?? 30;
  let yy = y + pad;
  if (o.icon || o.n !== undefined) {
    const kb = clamp((k - 0.2) * 1.6);
    if (o.icon) badge(ctx, A.icons[o.icon], x + pad + 34, yy + 34, 34, kb, o.badgeColor ?? C.primary);
    else numberBadge(ctx, o.n, x + pad + 34, yy + 34, 34, kb, o.badgeColor ?? C.primary);
    yy += 92;
  }
  if (o.kicker) {
    ctx.font = font(15, 800);
    ctx.fillStyle = C.accent;
    ctx.textBaseline = 'top';
    ctx.fillText(o.kicker.toUpperCase(), x + pad, yy);
    yy += 26;
  }
  if (o.title) yy += para(ctx, o.title, x + pad, yy, w - 2 * pad, { size: o.titleSize ?? 26, weight: 800, color: o.titleColor ?? C.primary, lh: (o.titleSize ?? 26) * 1.2 }) + 12;
  if (o.text) para(ctx, o.text, x + pad, yy, w - 2 * pad, { size: o.textSize ?? 19, color: o.textColor ?? C.ink });
  ctx.restore();
}

// Bandeau de couleur avec un badge à gauche (citation, principe, rappel).
export function banner(ctx, A, x, y, w, h, k, o) {
  if (!card(ctx, x, y, w, h, k, { fill: o.fill ?? C.primary })) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.4);
  ctx.translate(0, (1 - k) * 40);
  badge(ctx, A.icons[o.icon], x + 62, y + h / 2, 34, clamp((k - 0.2) * 1.6), o.badgeColor ?? C.accent);
  let yy = y + (o.top ?? 26);
  if (o.kicker) {
    ctx.font = font(15, 800);
    ctx.fillStyle = o.kickerColor ?? C.light;
    ctx.textBaseline = 'top';
    ctx.fillText(o.kicker.toUpperCase(), x + 124, yy);
    yy += 28;
  }
  if (o.draw) o.draw(x + 124, yy, w - 160);
  else para(ctx, o.text, x + 124, yy, w - 160, { size: o.size ?? 26, weight: o.weight ?? 700, color: o.color ?? C.white, italic: o.italic });
  ctx.restore();
}

// Encadré « bon à savoir » : badge, phrase d'accroche en gras (o.lead), texte.
export function note(ctx, A, x, y, w, h, k, o) {
  if (!card(ctx, x, y, w, h, k, { fill: o.fill ?? C.white })) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.4);
  ctx.translate(0, (1 - k) * 40);
  badge(ctx, A.icons[o.icon], x + 52, y + h / 2, 28, clamp((k - 0.2) * 1.6), C.accent);
  const size = o.size ?? 19;
  const th = (o.lead ? size * 1.45 : 0) + measure(ctx, o.text, w - 130, size);
  let ty = y + (h - th) / 2;
  if (o.lead) {
    para(ctx, o.lead, x + 100, ty, w - 130, { size, weight: 800, color: C.primary });
    ty += size * 1.45;
  }
  para(ctx, o.text, x + 100, ty, w - 130, { size, color: C.ink });
  ctx.restore();
}

// Bulle de parole, texte révélé mot à mot entre a et b (pendant la réplique).
export function bubble(ctx, text, x, y, w, t, a, b, k, o = {}) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.4);
  const s = lerp(0.85, 1, ease.back(clamp(k)));
  ctx.translate(x + 30, y);
  ctx.scale(s, s);
  ctx.translate(-x - 30, -y);
  const size = o.size ?? 21;
  const h = measure(ctx, text, w - 48, size, 600) + 44;
  ctx.fillStyle = o.fill ?? C.primary;
  rrect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 34, y);
  ctx.lineTo(x + 54, y - 22);
  ctx.lineTo(x + 70, y);
  ctx.fill();
  wordReveal(ctx, text, x + 24, y + 22, w - 48, t, a, b, { size, weight: 600, italic: true, color: C.white, dim: 0.28, lh: Math.round(size * 1.35) });
  ctx.restore();
  return h;
}

// Étiquette de schéma (nœud), centrée en (cx, cy) ; \n pour plusieurs lignes.
export function node(ctx, text, cx, cy, k, o = {}) {
  if (k <= 0) return;
  const size = o.size ?? 18;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.5);
  const s = ease.back(clamp(k));
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.font = font(size, 700);
  const lines = text.split('\n');
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 34;
  const h = lines.length * size * 1.25 + 18;
  ctx.fillStyle = o.fill ?? C.white;
  rrect(ctx, -w / 2, -h / 2, w, h, Math.min(h / 2, 22));
  ctx.fill();
  if (o.stroke !== false) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = o.stroke ?? C.line;
    ctx.stroke();
  }
  ctx.fillStyle = o.color ?? C.primary;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * size * 1.25 + 1));
  ctx.restore();
}

// Ordinateur portable stylisé ; draw(x, y, w, h) remplit l'écran (capture d'un outil, par exemple).
export function laptop(ctx, x, y, w, k, draw) {
  if (k <= 0) return;
  const sh = w * 0.56;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.4);
  ctx.translate(0, (1 - k) * 40);
  ctx.shadowColor = 'rgba(10, 40, 45, 0.18)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#1C1F24';
  rrect(ctx, x, y, w, sh + 36, 18);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#C9CED2';
  ctx.beginPath();
  ctx.moveTo(x - 46, y + sh + 36);
  ctx.lineTo(x + w + 46, y + sh + 36);
  ctx.lineTo(x + w + 20, y + sh + 58);
  ctx.lineTo(x - 20, y + sh + 58);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  rrect(ctx, x + 16, y + 18, w - 32, sh, 4);
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 16, y + 18, w - 32, sh);
  draw(x + 16, y + 18, w - 32, sh);
  ctx.restore();
  ctx.restore();
}

export { icon };
