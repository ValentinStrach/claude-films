// Vidéo commentée en motion design, calée sur la voix off.
// Le minutage vient de anim/timing.js (généré par audio/timing.py) ; chaque scène dessine la zone de contenu,
// le film dessine le panneau de titre (largeur animée d'une scène à l'autre) et son texte.
import { W, H, clamp, ease, lerp } from '/core/anim/engine.js';
import { DURATION as VOICE_END, SCENES as TIMING } from './timing.js';
import { C, SLANT, background, font, panel, panelEdge, para } from './lib/theme.js';
import { loadAssets } from './lib/assets.js';
import { SCENES } from './scenes/index.js';

export const DURATION = VOICE_END;
export const AUDIO = '/audio/mix.wav';

// Largeur du panneau selon la mise en page de la scène (`layout`).
const WIDTH = { band: 600, title: 1200, chapter: 1280, full: W + H * SLANT + 60 };
const EXIT = 0.35;
const MORPH = [0.5, 0.45];

let A;
const scenes = TIMING.map((tm) => {
  const def = SCENES[tm.id];
  if (!def) throw new Error(`scène sans dessin : ${tm.id}`);
  return { ...def, ...tm };
});

export async function preload() {
  A = await loadAssets();
}

// Contexte passé aux scènes : temps local, durée, début (cue) et fin (end) de chaque réplique, assets.
function ctxFor(sc, t) {
  const lt = t - sc.t0;
  const cue = (i) => sc.cues[Math.min(i, sc.cues.length - 1)]?.t ?? 0;
  const end = (i) => (sc.cues[i] ? sc.cues[i].t + sc.cues[i].d : sc.t1 - sc.t0);
  return { t: lt, dur: sc.t1 - sc.t0, cue, end, cues: sc.cues, A, k: (i, d = 0.6, e = ease.out) => e(clamp((lt - cue(i)) / d)) };
}

const isWide = (sc) => (sc.layout === 'chapter' || sc.layout === 'title' ? 1 : 0);

// Largeur du panneau et part de la bande foncée (titres et chapitres) à l'instant t.
function panelAt(t, i) {
  const sc = scenes[i];
  const w = WIDTH[sc.layout];
  const prev = scenes[i - 1];
  const next = scenes[i + 1];
  if (prev && t < sc.t0 + MORPH[1]) {
    const u = ease.inOut(clamp((t - (sc.t0 - MORPH[0])) / (MORPH[0] + MORPH[1])));
    return [lerp(WIDTH[prev.layout], w, u), lerp(isWide(prev), isWide(sc), u)];
  }
  if (next && t > sc.t1 - MORPH[0]) {
    const u = ease.inOut(clamp((t - (sc.t1 - MORPH[0])) / (MORPH[0] + MORPH[1])));
    return [lerp(w, WIDTH[next.layout], u), lerp(isWide(sc), isWide(next), u)];
  }
  return [w, isWide(sc)];
}

// Texte du panneau en mise en page « band » : étapes, sur-titre, titre, sous-titre, grand numéro.
function panelText(ctx, sc, s, w) {
  const enter = ease.out(clamp(s.t / 0.7));
  const exit = clamp((s.t - (s.dur - EXIT)) / EXIT);
  const alpha = enter * (1 - exit);
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, (1 - enter) * 30 - exit * 20);
  const x = 84;
  const maxW = panelEdge(w, 560) - x - 48;
  let y = 188;
  if (sc.steps) stepper(ctx, sc.steps, sc.step, x, 104);
  if (sc.label) {
    ctx.font = font(19, 800);
    ctx.fillStyle = C.light;
    ctx.textBaseline = 'top';
    ctx.fillText(sc.label.toUpperCase().replace(/'/g, '’'), x, y);
    y += 44;
  }
  y += para(ctx, sc.title, x, y, maxW, { size: sc.titleSize ?? 50, weight: 800, color: C.white, lh: (sc.titleSize ?? 50) * 1.18 });
  if (sc.sub) para(ctx, sc.sub, x, y + 26, maxW - 10, { size: 22, color: 'rgba(255,255,255,0.78)', lh: 32 });
  ctx.restore();
  if (sc.num) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.18;
    ctx.font = font(330, 800);
    ctx.fillStyle = C.white;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(sc.num, 40 - (1 - enter) * 40, H + 70);
    ctx.restore();
  }
}

// Fil d'étapes (ex. ['Avant', 'Pendant', 'Après']), l'étape `step` en surbrillance.
function stepper(ctx, steps, step, x, y) {
  ctx.save();
  ctx.font = font(17, 800);
  ctx.textBaseline = 'middle';
  let cx = x;
  steps.forEach((label, i) => {
    const on = i === step;
    const w = ctx.measureText(label.toUpperCase()).width + 30;
    ctx.fillStyle = on ? C.white : 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(cx, y - 17, w, 34, 17);
    ctx.fill();
    ctx.fillStyle = on ? C.primary : 'rgba(255,255,255,0.75)';
    ctx.fillText(label.toUpperCase(), cx + 15, y + 1);
    cx += w + 10;
  });
  ctx.restore();
}

function drawContent(ctx, sc, s, t) {
  // Sortie : la zone de contenu glisse et s'efface juste avant la coupe.
  const exit = clamp((s.t - (s.dur - EXIT)) / EXIT);
  if (exit >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - exit;
  ctx.translate(-50 * ease.in(exit), 0);
  // Léger travelling avant tout au long de la scène.
  const z = 1 + 0.018 * clamp(s.t / s.dur);
  ctx.translate(1250, 540);
  ctx.scale(z, z);
  ctx.translate(-1250, -540);
  sc.draw?.(ctx, s, t);
  ctx.restore();
}

export function drawFrame(ctx, t) {
  ctx.reset();
  let i = scenes.findIndex((sc) => t >= sc.t0 && t < sc.t1);
  if (i < 0) i = scenes.length - 1;
  const sc = scenes[i];
  const s = ctxFor(sc, t);

  background(ctx);
  drawContent(ctx, sc, s, t);
  const [w, g] = panelAt(t, i);
  if (g > 0.001) panel(ctx, w + 220 * g, C.primaryDark);
  panel(ctx, w);
  if (sc.layout === 'band') panelText(ctx, sc, s, w);
  sc.over?.(ctx, s, w);
}
