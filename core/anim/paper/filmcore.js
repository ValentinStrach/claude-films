// Moteur de montage : résout les instants des scènes, enchaîne transitions, karaoké et habillage.
// Utilisé par anim/film.js (film complet) et anim/pages/only.js (quelques scènes seulement) de chaque film.
import { W, H, lerp, clamp, ease } from '../engine.js';
import { initPaper, cutout, cutPoly, poly } from './paper.js';
import { karaoke, sticker, FONT } from './text.js';
import { at, lineAt } from './timeline.js';

export const ASSETS = {};
let loaded = null;

// Préparation commune à toutes les scènes : papier et polices. ASSETS reste ouvert pour les preload des scènes.
export function loadAssets() {
  loaded ??= (async () => {
    initPaper();
    await Promise.all(['64px "Arial Rounded MT Bold"', '64px "Marker Felt"', '64px "Bradley Hand"', '64px "Snell Roundhand"', '64px "Apple Chancery"', '64px "Segoe UI"', '64px "Segoe Print"']
      .map((f) => document.fonts.load(f).catch(() => null)));
  })();
  return loaded;
}

// ---------- Transitions ----------
const TRANS = 0.5;

function paperEdge(x, seed) {
  const pts = [];
  for (let y = -40; y <= H + 40; y += 45) pts.push([x + Math.sin(y * 0.013 + seed) * 18 + ((y * 7919 + seed * 31) % 13) - 6, y]);
  return pts;
}

// La nouvelle scène arrive comme une feuille glissée depuis la droite.
function wipe(ctx, p, drawNew, seed) {
  const e = ease.inOut(p);
  const x = lerp(W + 120, -120, e);
  const edge = paperEdge(x, seed);
  const shape = poly([...edge, [W + 200, H + 60], [W + 200, -60]]);
  ctx.save();
  ctx.shadowColor = 'rgba(20,10,4,0.5)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = -14;
  ctx.fillStyle = '#e9dcc3';
  ctx.fill(shape);
  ctx.restore();
  ctx.save();
  ctx.clip(shape);
  ctx.translate((1 - e) * 60, 0);
  drawNew();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,250,235,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke(poly(edge, false));
  ctx.restore();
}

// Ouverture en iris (cercle), façon vieux dessin animé.
function iris(ctx, p, drawNew) {
  const r = ease.inOut(p) * Math.hypot(W, H) * 0.6;
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, Math.max(1, r), 0, Math.PI * 2);
  ctx.clip();
  drawNew();
  ctx.restore();
}

// ---------- Habillage ----------
let VIGNETTE;
function vignette(ctx) {
  if (!VIGNETTE) {
    VIGNETTE = document.createElement('canvas');
    VIGNETTE.width = W;
    VIGNETTE.height = H;
    const g = VIGNETTE.getContext('2d');
    const grd = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    grd.addColorStop(0, 'rgba(20,10,0,0)');
    grd.addColorStop(1, 'rgba(20,10,0,0.42)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }
  ctx.drawImage(VIGNETTE, 0, 0);
}

function captions(ctx, t, scene) {
  if (scene?.noKaraoke) return;
  const l = lineAt(t, 0.4);
  if (!l) return;
  const fadeIn = clamp((t - (l.start - 0.12)) / 0.15);
  const fadeOut = 1 - clamp((t - (l.end + 0.1)) / 0.3);
  karaoke(ctx, l.words, t, { alpha: Math.min(fadeIn, fadeOut) });
}

// Panneau de balisage jaune (en haut à gauche) qui annonce un chapitre.
const PLATE = cutPoly([[0, 0], [560, 0], [610, 42], [560, 84], [0, 84]], 91, 1.2);
function chapterSign(ctx, text, lt) {
  const inP = ease.back(clamp(lt / 0.5));
  const outP = clamp((lt - 3.2) / 0.4);
  if (outP >= 1 || lt < 0) return;
  ctx.save();
  ctx.translate(lerp(-680, 70, inP) - outP * 750, 70);
  ctx.rotate(-0.02);
  cutout(ctx, PLATE, { fill: '#f2c230', outline: '#2a1a10', lw: 4, lift: 7 });
  ctx.fillStyle = '#2a1a10';
  ctx.font = `38px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 26, 44, 520);
  ctx.restore();
}

// ---------- Montage ----------
// load(ASSETS), optionnel : données propres au film (traces, photos), chargées avant les preload des scènes.
export function createFilm(scenes, { duration, load }) {
  let RESOLVED = [];
  const resolve = () => {
    RESOLVED = scenes.map((s) => ({ ...s, t0: at(s.from), t1: at(s.to) })).sort((a, b) => a.t0 - b.t0);
    for (let i = 0; i < RESOLVED.length; i++) {
      const s = RESOLVED[i];
      s.t1 = i + 1 < RESOLVED.length ? RESOLVED[i + 1].t0 : Math.max(s.t1, duration);
    }
  };
  // Une scène qui plante ne doit pas contaminer l'image (pile d'états, transformations) : on la signale et on continue.
  const drawScene = (ctx, s, t) => {
    ctx.save();
    try {
      s.draw(ctx, t, { lt: t - s.t0, p: clamp((t - s.t0) / (s.t1 - s.t0)), dur: s.t1 - s.t0, ASSETS });
    } catch (e) {
      console.error(`scène ${s.id} à t=${t.toFixed(2)} : ${e.stack || e}`);
    }
    ctx.restore();
  };
  async function preload() {
    await loadAssets();
    if (load) await load(ASSETS);
    for (const s of scenes) if (s.preload) await s.preload(ASSETS);
    resolve();
  }
  function drawFrame(ctx, t) {
    if (!RESOLVED.length) resolve();
    let k = RESOLVED.findIndex((s) => t >= s.t0 && t < s.t1);
    if (k < 0) k = t < RESOLVED[0].t0 ? 0 : RESOLVED.length - 1;
    const cur = RESOLVED[k];
    const prev = RESOLVED[k - 1];
    const inTrans = prev && t < cur.t0 + TRANS && (cur.transition ?? 'wipe') !== 'cut';
    ctx.reset();
    ctx.save();
    ctx.fillStyle = '#1a120c';
    ctx.fillRect(0, 0, W, H);
    if (inTrans) {
      drawScene(ctx, prev, t);
      const p = (t - cur.t0) / TRANS;
      if (cur.transition === 'iris') iris(ctx, p, () => drawScene(ctx, cur, t));
      else wipe(ctx, p, () => drawScene(ctx, cur, t), k * 3.1);
    } else {
      drawScene(ctx, cur, t);
    }
    vignette(ctx);
    if (cur.chapter) chapterSign(ctx, cur.chapter, t - cur.t0 - 0.3);
    captions(ctx, t, cur);
    ctx.restore();
  }
  return { preload, drawFrame, DURATION: duration };
}
