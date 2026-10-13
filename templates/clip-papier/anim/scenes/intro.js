// Exemple de module de scènes : un décor en papier, un titre, une étoile qui traverse puis saute sur les temps du refrain.
// Les personnages d'un film vivent dans anim/chars/ (un fichier par personnage, dessiné en pièces de papier).
// Une scène = { id, from, to, draw(ctx, t, { lt, p, dur, ASSETS }), transition?, chapter?, noKaraoke?, preload? }.
// from / to : secondes ou référence aux paroles [section, ligne, décalage, 'start'|'end'] (voir timeline.js).
import { W, H, TAU, lerp, ease, prog } from '/core/anim/engine.js';
import { cutout, cutPoly, rrect, ink } from '/core/anim/paper/paper.js';
import { sticker } from '/core/anim/paper/text.js';
import { beat } from '/core/anim/paper/timeline.js';

const SKY = cutPoly([[-40, -40], [W + 40, -40], [W + 40, H + 40], [-40, H + 40]], 3);
const HILL = cutPoly([[-60, 760], [420, 640], [900, 720], [1400, 600], [W + 60, 700], [W + 60, H + 60], [-60, H + 60]], 7, 2);
const BOARD = rrect(W / 2 - 520, 150, 1040, 220, 26);

// Personnage d'exemple : une étoile de papier avec deux yeux. Origine : son centre.
const STAR = cutPoly(Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * TAU) / 10, r = i % 2 ? 48 : 110;
  return [Math.cos(a) * r, Math.sin(a) * r];
}), 5);
function drawStar(ctx, { x, y, angle = 0, scale = 1, fill = '#f2c230' }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  cutout(ctx, STAR, { fill, outline: '#2a1a10', lw: 5, lift: 8 });
  for (const ex of [-20, 20]) ink(ctx, [[ex, -14], [ex, 2]], { lw: 9 });
  ink(ctx, [[-18, 22], [0, 32], [18, 22]], { lw: 5 });
  ctx.restore();
}

function backdrop(ctx, sky, hill) {
  cutout(ctx, SKY, { fill: sky, lift: 0, rim: 0 });
  cutout(ctx, HILL, { fill: hill, outline: '#2a1a10', lw: 4, lift: 8 });
}

export const scenes = [
  {
    id: 'intro',
    from: 0,
    to: ['c1', 0, -0.5],
    chapter: 'Intro',
    draw(ctx, t, { lt, dur }) {
      backdrop(ctx, '#9cc8d8', '#7fb069');
      const drop = ease.back(prog(lt, 0.2, 1.0));
      ctx.save();
      ctx.translate(0, lerp(-420, 0, drop));
      cutout(ctx, cutPoly(BOARD, 11), { fill: '#f2c230', outline: '#2a1a10', lw: 5, lift: 10 });
      sticker(ctx, 'MON NOUVEAU FILM', W / 2, 295, { size: 96 });
      ctx.restore();
      const x = lerp(-200, W + 200, lt / dur);
      drawStar(ctx, { x, y: 860 + Math.sin(lt * 6) * 30, angle: lt * 3 });
    },
  },
  {
    id: 'refrain',
    from: ['c1', 0, -0.5],
    to: ['c1', -1, 0, 'end'],
    transition: 'iris',
    chapter: 'Refrain',
    draw(ctx, t) {
      backdrop(ctx, '#f4b183', '#c96f4a');
      // Saut à chaque temps de la chanson.
      const b = beat(t);
      drawStar(ctx, { x: W / 2, y: 820 - 80 * b.pulse, scale: 1.3 + 0.1 * b.pulse, fill: '#e8574a' });
    },
  },
];
