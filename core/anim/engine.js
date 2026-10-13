// Outils communs : dimensions, maths, easing, hasard déterministe.
export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, x) => clamp((x - a) / (b - a));
export const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
export const smooth = (t) => t * t * (3 - 2 * t);

export const ease = {
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  bounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// Progression 0..1 entre deux instants, avec easing optionnel.
export const prog = (t, a, b, e = (x) => x) => e(invlerp(a, b, t));

// Générateur pseudo-aléatoire déterministe (mulberry32).
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash entier -> [0, 1).
export function hash(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// Bruit de valeur 1D lissé, dans [-1, 1].
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i * 374761 + seed * 668265) * 2 - 1;
  const b = hash((i + 1) * 374761 + seed * 668265) * 2 - 1;
  return lerp(a, b, smooth(f));
}

// Oscillation "à la main" : sinus + un peu de bruit, pour les balancements.
export const wobble = (t, freq = 1, seed = 0) => Math.sin(t * TAU * freq) * 0.7 + noise1(t * freq * 2, seed) * 0.3;
