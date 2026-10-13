// Point d'entrée : mode rendu (piloté par core/render/render.mjs) ou mode aperçu (lecture avec le son).
// Le film vient de anim/film.js du dossier servi (films/<nom>/), qui exporte DURATION, preload,
// drawFrame et, s'il n'utilise pas audio/song.mp3, AUDIO (chemin du son de l'aperçu).
import { W, H } from './engine.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const renderMode = params.has('render');
// ?page=nom charge anim/pages/nom.js (galeries de test) au lieu du film.
const page = params.get('page');
const { drawFrame, preload, DURATION, AUDIO = '/audio/song.mp3' } = await import(page ? `/anim/pages/${page}.js` : '/anim/film.js');

await preload();
window.__duration = DURATION;
window.renderFrame = (t) => drawFrame(ctx, t);
window.__capture = (t, fmt = 'jpeg', q = 0.95) => {
  drawFrame(ctx, t);
  return canvas.toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', q);
};
window.__ready = true;

if (renderMode) {
  document.body.classList.add('render');
} else {
  // Aperçu : le son pilote l'horloge, l'image s'adapte à la fenêtre.
  const audio = new Audio(AUDIO);
  const fit = () => {
    const k = Math.min(innerWidth / W, innerHeight / H);
    canvas.style.transform = `scale(${k}) translate(-50%, -50%)`;
  };
  addEventListener('resize', fit);
  fit();
  let t = Number(params.get('t') || 0);
  audio.currentTime = t;
  const loop = () => {
    if (!audio.paused) t = audio.currentTime;
    drawFrame(ctx, Math.min(t, DURATION - 1e-3));
    requestAnimationFrame(loop);
  };
  loop();
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { audio.paused ? audio.play() : audio.pause(); e.preventDefault(); }
    if (e.code === 'ArrowRight') { t = Math.min(DURATION, t + 5); audio.currentTime = t; }
    if (e.code === 'ArrowLeft') { t = Math.max(0, t - 5); audio.currentTime = t; }
  });
  canvas.addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
}
