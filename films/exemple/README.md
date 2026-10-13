# Le petit bateau de papier

Film d'exemple du framework (41 s, 16:9) : un bateau de papier part à l'aube, traverse une tempête sous le faisceau d'un phare et arrive au couchant sur une île, où la nuit tombe. Il montre le kit papier découpé (`core/anim/paper/`) et se rend entièrement depuis un clone : aucun média externe, musique synthétisée en Python.

## Pipeline

1. **Texte** : `anim/lyrics.js` (trois sections de deux lignes), minutage sur une grille à 100 BPM par `core/analysis/grid_timing.mjs` → `anim/timing.js`. Deux mesures d'ouverture (4,8 s) pour le titre, puis une ligne toutes les deux mesures.
2. **Musique** : `audio/compose.py`, même tempo et même plan que l'image : ouverture (nappe, clochettes), matin (mélodie au marimba en ré majeur), tempête (si mineur, cordes graves, toms, tonnerre aux temps `LIGHTNING`), arrivée (reprise avec glockenspiel), cadence finale ; réverbération par convolution → `audio/music.wav`.
3. **Image** : `anim/sets/decor.js` (ciel, soleil, mer et écume, bateau, sillage, poisson, mouettes, nuages, phare, éclair, île, étoiles, caméra) et trois modules de scènes dans `anim/scenes/` : `matin.js` (titre mot par mot), `tempete.js` (éclairs sur les temps de `LIGHTNING`, partagés avec la musique), `arrivee.js` (crépuscule, FIN), montés par `core/anim/paper/filmcore.js`.
4. **Rendu** : `core/render/render.mjs`, puis `render/mux.mjs` pose la musique.

## Commandes (depuis la racine du dépôt)

```bash
node core/analysis/grid_timing.mjs exemple --bpm 100 --beats 8 --start 4.8 --duration 41
```

```bash
uv run python films/exemple/audio/compose.py
```

```bash
node core/render/render.mjs exemple --page only --query scenes=tempete --stills 15,19
```

```bash
node core/render/render.mjs exemple --out out/film_video.mp4 --workers 8
```

```bash
node films/exemple/render/mux.mjs
```

Aperçu du README (720p, environ 4 Mo) et son image fixe (le titre, à 3,3 s) :

```bash
ffmpeg -y -i films/exemple/out/exemple.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart docs/exemple.mp4
```

```bash
ffmpeg -y -ss 3.3 -i docs/exemple.mp4 -frames:v 1 -q:v 4 docs/exemple.jpg
```
