# Titre du film

Clip animé en papier découpé (modèle `templates/clip-papier`). Pitch en deux phrases : sujet, ton, chute.

## Pipeline

1. **Son** : `audio/song.mp3` (chanson enregistrée ou générée à partir de `anim/lyrics.js`) ; en attendant, `core/analysis/grid_timing.mjs` fait un minutage sur grille. `core/analysis/analyze.py` (tempo, battements), `analysis/repet.py` (voix estimée), `analysis/timing.py` (lignes, mots, bouche) → `anim/timing.js`.
2. **Calage à la main** : `anim/tapper.html` → `analysis/taps.json`, prioritaire dans `timing.py`.
3. **Animation** : `anim/scenes/` (liste dans `scenes/index.js`), personnages dans `anim/chars/`, décors dans `anim/sets/`.
4. **Rendu** : `core/render/render.mjs`, puis `render/mux.mjs` pose la chanson.

## Décisions

- (contraintes et choix du projet, à noter au fil de l'eau)
