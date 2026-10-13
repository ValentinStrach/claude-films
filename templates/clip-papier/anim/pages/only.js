// Page de test : seulement quelques modules de scènes, choisis par ?scenes=a,b (fichiers anim/scenes/a.js...).
// node core/render/render.mjs <film> --page only --query scenes=v1 --stills 20,25
import { T } from '/core/anim/paper/timeline.js';
import { createFilm } from '/core/anim/paper/filmcore.js';

const names = (new URLSearchParams(location.search).get('scenes') || '').split(',').filter(Boolean);
const mods = await Promise.all(names.map((n) => import(`../scenes/${n}.js`)));
const F = createFilm(mods.flatMap((m) => m.scenes), { duration: T.duration + 20 });

export const DURATION = F.DURATION;
export const preload = F.preload;
export const drawFrame = F.drawFrame;
