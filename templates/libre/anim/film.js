// Film libre : pas de papier découpé ni de chanson calée, juste Canvas 2D et core/anim/engine.js.
// Contrat avec core/anim/main.js : exporter DURATION (s), preload() et drawFrame(ctx, t).
// drawFrame doit être une fonction pure du temps (pas de Math.random, pas d'état d'une image à l'autre).
import { W, H, TAU, ease, prog, lerp, rng } from '/core/anim/engine.js';

export const DURATION = 8;
// Son de l'aperçu (core/render/serve.mjs) ; le son de la vidéo finale est posé par render/mux.mjs.
export const AUDIO = '/audio/music.wav';

const R = rng(42);
const DOTS = Array.from({ length: 80 }, () => ({ x: R() * W, y: R() * H, r: 4 + R() * 14, s: 0.5 + R() }));

export async function preload() {}

export function drawFrame(ctx, t) {
  ctx.reset();
  ctx.fillStyle = '#0d2a4a';
  ctx.fillRect(0, 0, W, H);
  for (const d of DOTS) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(d.x, (d.y - t * 60 * d.s + H) % H, d.r, 0, TAU);
    ctx.fill();
  }
  const k = prog(t, 0.5, 1.5, ease.back);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(k, k);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Mon nouveau film', 0, 0);
  ctx.restore();
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(0, H - 12, lerp(0, W, t / DURATION), 12);
}
