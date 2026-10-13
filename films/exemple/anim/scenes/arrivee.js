// L'arrivée : couchant, le bateau rejoint l'île en laissant un sillage, les mouettes tournent autour
// du palmier ; puis le crépuscule tombe, les étoiles et les lanternes s'allument, tampon FIN et fondu.
import { W, lerp, ease, prog } from '/core/anim/engine.js';
import { sticker, stampScale } from '/core/anim/paper/text.js';
import { at } from '/core/anim/paper/timeline.js';
import { sky, sun, sunGlints, cloudBank, wave, floatingBoat, wake, island, gull, stars, veil, camera } from '../sets/decor.js';

const SEA = { base: 770, amp: 0.45 };

function draw(ctx, t, { lt }) {
  const tEnd = at(['arrivee', 1, 0, 'end']);
  const dusk = prog(t, tEnd - 1.5, tEnd + 3.5, ease.inOut);
  const sail = prog(lt, 0.4, 7.5, ease.inOut);
  const bx = lerp(260, 1150, sail);
  camera(ctx, { zoom: lerp(1.0, 1.06, prog(lt, 0, 14, ease.inOut)), dx: lerp(40, -60, prog(lt, 0, 14, ease.inOut)) }, () => {
    sky(ctx, [[0, '#4d3f6e'], [0.5, '#d9736b'], [1, '#f9c784']]);
    stars(ctx, t, dusk);
    sun(ctx, 720, lerp(640, 700, prog(lt, 0, 16)), 170, '#f28a2a', [255, 160, 90]);
    cloudBank(ctx, t, { n: 3, y: 150, w: 420, h: 90, speed: 12, seed: 71, base: '#f0a07a', light: '#f8c29a', spread: 720 });
    wave(ctx, t * 0.7, { base: 700, amp: 0.3, top: '#e79a6f', deep: '#c9775a', seed: 82, foam: 0.35 });
    sunGlints(ctx, 720, 724, t, [255, 220, 150], 7);
    island(ctx, t, prog(t, tEnd - 0.5, tEnd + 2));
    for (let i = 0; i < 2; i++) {
      const a = t * 0.8 + i * Math.PI;
      gull(ctx, 1600 + Math.cos(a) * 260, 330 + Math.sin(a) * 60, t + i * 0.4, { scale: 1.2, dir: Math.sin(a) > 0 ? -1 : 1, phase: i });
    }
    wave(ctx, t, { ...SEA, top: '#c9775a', deep: '#a8604e', seed: 83, foam: 0.5 });
    if (sail < 1) wake(ctx, bx, t, SEA, 1, 1 - sail);
    floatingBoat(ctx, bx, t, SEA, { scale: 0.92, lamp: prog(t, tEnd - 1, tEnd + 1.5) });
    wave(ctx, t + 1.4, { base: 840, amp: 0.5, top: '#a8604e', deep: '#8e4c3e', seed: 84, foam: 0.5 });
    wave(ctx, t + 2.2, { base: 950, amp: 0.55, top: '#8e4c3e', deep: '#6e3a35', seed: 85, foam: 0.45 });
  });
  veil(ctx, [24, 22, 52], dusk * 0.38);
  const k = stampScale(t, tEnd + 0.3);
  if (k > 0) {
    ctx.save();
    ctx.translate(W / 2, 330);
    ctx.rotate(-0.08);
    ctx.scale(k, k);
    sticker(ctx, 'FIN', 0, 0, { size: 230, fill: '#e8574a' });
    ctx.restore();
  }
  const credit = prog(t, tEnd + 2.0, tEnd + 2.8, ease.out);
  if (credit > 0) sticker(ctx, 'Fait entièrement en code', W / 2, 470 + (1 - credit) * 30, { size: 50, alpha: credit });
  veil(ctx, [10, 8, 14], prog(t, 39.2, 41));
}

export const scenes = [
  { id: 'arrivee', from: ['arrivee', 0, -0.4], to: ['arrivee', 1, 0, 'end'], transition: 'iris', chapter: "L'arrivée", draw },
];
