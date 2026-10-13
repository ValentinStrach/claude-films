// Textes : sous-titres karaoké (mot en cours surligné), étiquettes et cartons.
import { W, H, clamp, ease } from '../engine.js';

// Polices système : celles de macOS d'abord, puis des équivalents Windows et Linux (rendu proche, pas identique).
export const FONT = '"Arial Rounded MT Bold", "SF Compact Rounded", "Segoe UI", "DejaVu Sans", sans-serif';
export const HAND = '"Marker Felt", "Chalkboard SE", "Segoe Print", "Comic Sans MS", sans-serif';

// Texte détouré façon sticker : contour épais foncé + ombre.
export function sticker(ctx, text, x, y, { size = 64, fill = '#ffffff', stroke = '#2a1a10', lw = null, font = FONT, align = 'center', alpha = 1, shadow = true } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = lw ?? size * 0.2;
  if (shadow) {
    ctx.shadowColor = 'rgba(20,10,4,0.45)';
    ctx.shadowBlur = size * 0.1;
    ctx.shadowOffsetX = size * 0.05;
    ctx.shadowOffsetY = size * 0.08;
  }
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Ligne karaoké : words = [{ w, t0, t1 }]. Le mot chanté grossit et passe en jaune.
export function karaoke(ctx, words, t, { y = H - 70, size = 66, maxWidth = W - 160, alpha = 1 } = {}) {
  if (!words?.length) return;
  ctx.save();
  ctx.font = `${size}px ${FONT}`;
  const space = size * 0.4;
  const widths = words.map((w) => ctx.measureText(w.w).width);
  let total = widths.reduce((s, v) => s + v, 0) + space * (words.length - 1);
  const k = total > maxWidth ? maxWidth / total : 1;
  total *= k;
  let x = W / 2 - total / 2;
  words.forEach((w, i) => {
    const on = t >= w.t0;
    const grow = Math.min(0.18, 14 / (widths[i] * k)); // 7 px de chaque côté au plus : le mot ne mange pas l'espace
    const pop = on ? 1 + grow * (1 - clamp((t - w.t0) / 0.18)) * clamp((t - w.t0) / 0.05) : 1;
    const cx = x + (widths[i] * k) / 2;
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(k * pop, k * pop);
    sticker(ctx, w.w, 0, 0, { size, fill: on ? '#ffd23f' : '#ffffff', alpha });
    ctx.restore();
    x += widths[i] * k + space * k;
  });
  ctx.restore();
}

// Apparition "tampon" : grossit puis s'écrase avec un léger rebond.
export function stampScale(t, t0, dur = 0.35) {
  const p = clamp((t - t0) / dur);
  if (p <= 0) return 0;
  return 1 + 1.4 * (1 - ease.out(p)) * (p < 1 ? 1 : 0);
}
