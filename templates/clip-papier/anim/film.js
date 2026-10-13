// Le film complet : toutes les scènes listées dans scenes/index.js, monté par core/anim/paper/filmcore.js.
import { T } from '/core/anim/paper/timeline.js';
import { createFilm } from '/core/anim/paper/filmcore.js';
import { SCENES } from './scenes/index.js';

// duration : la vidéo peut dépasser la chanson (générique, post-générique).
// load(ASSETS) : données propres au film (traces, photos), chargées avant les scènes : fonction async (ASSETS) => { ASSETS.x = ... }.
const F = createFilm(SCENES, { duration: T.duration });
export const DURATION = F.DURATION;
export const preload = F.preload;
export const drawFrame = F.drawFrame;
