// La tempête : ciel d'encre, phare dont le faisceau balaie la mer, pluie sur deux plans, houle qui
// grossit, éclairs découpés dans du papier jaune sur les temps de LIGHTNING (tonnerre au même instant
// dans audio/compose.py), la caméra tremble à chaque éclair.
import { W, H, lerp, ease, prog, hash, noise1 } from '/core/anim/engine.js';
import { ink } from '/core/anim/paper/paper.js';
import { sky, cloudBank, wave, floatingBoat, lighthouse, bolt, veil, camera } from '../sets/decor.js';

const BEAT = 0.6;
export const LIGHTNING = [24, 30, 32, 37]; // temps depuis le début (index), comme audio/compose.py

// Intensité de l'éclair en cours (1 au coup de tonnerre, décroît en 0,6 s) et son index.
function flashAt(t) {
  for (let k = LIGHTNING.length - 1; k >= 0; k--) {
    const dt = t - LIGHTNING[k] * BEAT;
    if (dt >= 0 && dt < 0.8) return { f: Math.exp(-dt * 5), k };
  }
  return { f: 0, k: -1 };
}

function rain(ctx, t, n, speed, len, lw, alpha, seed) {
  for (let i = 0; i < n; i++) {
    const x = (((hash(seed + i * 7) * (W + 400) - t * speed * 0.3) % (W + 400)) + W + 400) % (W + 400) - 200;
    const y = (hash(seed + i * 7 + 3) * H + t * speed) % (H + 100) - 50;
    ink(ctx, [[x, y], [x - len * 0.35, y + len]], { color: `rgba(215,228,240,${alpha})`, lw });
  }
}

function draw(ctx, t, { lt }) {
  const { f, k } = flashAt(t);
  const amp = lerp(1, 2.5, prog(lt, 0, 3, ease.inOut));
  const shake = f * 16;
  camera(ctx, { zoom: 1.04, dx: noise1(t * 40, 1) * shake, dy: noise1(t * 40, 2) * shake }, () => {
    sky(ctx, [[0, '#1f2633'], [0.6, '#3b4757'], [1, '#56657a']]);
    cloudBank(ctx, t, { n: 4, y: 40, w: 640, h: 200, speed: 120, seed: 51, base: '#323b4a', light: '#46516a', spread: 520 });
    if (k >= 0) bolt(ctx, (k % 2 ? 1050 : 260) + hash(k * 5 + 1) * 300, 120, 690, 60 + k, Math.min(1, f * 2));
    lighthouse(ctx, t);
    cloudBank(ctx, t + 3, { n: 3, y: 170, w: 520, h: 160, speed: 180, seed: 57, base: '#3d4656', light: '#4f5b70', spread: 700 });
    rain(ctx, t, 60, 900, 34, 2, 0.35, 11);
    wave(ctx, t, { base: 700, amp, top: '#3c6f8e', deep: '#2f5d7c', seed: 61, foam: 0.6 });
    floatingBoat(ctx, W / 2 - 40, t, { base: 770, amp }, { tilt: noise1(t * 1.3, 7) * 0.22 });
    wave(ctx, t + 1.1, { base: 830, amp: amp * 1.1, top: '#2f5d7c', deep: '#244b66', seed: 62, foam: 0.7 });
    wave(ctx, t + 2.3, { base: 960, amp: amp * 1.2, top: '#244b66', deep: '#1b3a52', seed: 63, foam: 0.8 });
    rain(ctx, t, 50, 1500, 60, 3.5, 0.5, 17);
  });
  veil(ctx, [255, 255, 235], f * 0.45);
}

export const scenes = [
  { id: 'tempete', from: ['tempete', 0, -0.4], to: ['arrivee', 0, -0.4], chapter: 'La tempête', draw },
];
