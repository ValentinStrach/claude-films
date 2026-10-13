// Le film complet : les scènes de scenes/index.js, montées par core/anim/paper/filmcore.js.
import { T } from '/core/anim/paper/timeline.js';
import { createFilm } from '/core/anim/paper/filmcore.js';
import { SCENES } from './scenes/index.js';

const F = createFilm(SCENES, { duration: T.duration });
export const DURATION = F.DURATION;
export const preload = F.preload;
export const drawFrame = F.drawFrame;
// Musique composée par audio/compose.py (pas de chanson : audio/song.mp3 n'existe pas).
export const AUDIO = '/audio/music.wav';
