# claude-films

Films d'animation **entièrement faits en code** : Canvas 2D dessiné image par image dans Chrome sans écran, assemblé avec ffmpeg. Pas de logiciel de montage, pas de caméra. Le dépôt contient le framework (`core/`), deux modèles pour démarrer un film (`templates/`) et un film d'exemple (`films/exemple/`), pensés pour être écrits avec Claude Code (voir `CLAUDE.md`).

![Le petit bateau de papier, le film d'exemple](docs/exemple.mp4)

Le film d'exemple, « Le petit bateau de papier » (41 s), montre le kit papier découpé : pièces découpées aux ciseaux, mer à plusieurs plans avec écume, ciels en dégradé et halos, titre qui tombe mot par mot, karaoké, panneaux de chapitre, transitions, éclairs et tonnerre calés sur le tempo, caméra qui tremble. Sa musique (marimba, nappes, basse, percussions, réverbération) est synthétisée en Python : il se rend entièrement depuis un clone.

## Prérequis

- **Google Chrome** (ou Chromium ; sous Windows, Edge convient aussi). Il est cherché aux emplacements habituels ; sinon indiquer son chemin dans la variable `CHROME`.
- **Node.js 22+** (WebSocket et fetch natifs : aucune dépendance npm)
- **ffmpeg** et ffprobe dans le `PATH`
- **Python 3.10+** avec numpy, scipy, Pillow (`requirements.txt`), par exemple avec [uv](https://docs.astral.sh/uv/) :

```bash
uv venv .venv && uv pip install -p .venv -r requirements.txt
```

Sous Windows, l'interpréteur est `.venv\Scripts\python` au lieu de `.venv/bin/python` ; les commandes `node` sont identiques dans PowerShell.

Les polices du kit papier sont des polices système, macOS d'abord (Arial Rounded MT Bold, Marker Felt) avec repli sur Segoe UI / Segoe Print sous Windows et DejaVu Sans sous Linux : le rendu est proche mais pas identique d'un système à l'autre.

## Essayer avec le film d'exemple

```bash
.venv/bin/python films/exemple/audio/compose.py
```

```bash
node core/render/render.mjs exemple --stills 3.3,21,34.5
```

```bash
node core/render/render.mjs exemple --out out/film_video.mp4 --workers 6
```

```bash
node films/exemple/render/mux.mjs
```

Le film est dans `films/exemple/out/exemple.mp4`. L'aperçu du README (`docs/exemple.mp4`, 720p) se refait avec la commande de `films/exemple/README.md`. Aperçu en direct avec le son : `node core/render/serve.mjs exemple` puis http://127.0.0.1:8765/ (Espace : lecture/pause, flèches : ±5 s, `?t=10` pour démarrer à 10 s).

## Faire un nouveau film

1. Copier un modèle : `templates/clip-papier` (clip sur une chanson ou un texte : papier découpé, karaoké, panneaux de chapitre) ou `templates/libre` (Canvas libre).

```bash
cp -R templates/clip-papier films/mon-film
```

Un film peut aussi vivre hors du dépôt (par exemple dans un dépôt privé) : passer son chemin au lieu de son nom, `node core/render/render.mjs ../mes-films/mon-film --stills 2`.

2. Écrire le texte ou les paroles dans `anim/lyrics.js`, puis le minutage :
   - sans voix chantée (musique composée en code, ou en attendant la chanson), sur une grille de tempo :

```bash
node core/analysis/grid_timing.mjs mon-film --bpm 120 --beats 8 --duration 30
```

   - avec une chanson (`films/mon-film/audio/song.mp3`) : analyse, voix estimée, puis calage à la main (Espace au début de chaque ligne, enregistré dans `analysis/taps.json`) et minutage.

```bash
ffmpeg -i films/mon-film/audio/song.mp3 -ar 44100 films/mon-film/audio/song.wav
```

```bash
.venv/bin/python core/analysis/analyze.py mon-film && .venv/bin/python films/mon-film/analysis/repet.py
```

```bash
node core/render/serve.mjs mon-film 8765 anim/tapper.html
```

```bash
.venv/bin/python films/mon-film/analysis/timing.py
```

3. Écrire les scènes dans `anim/scenes/` (une scène = `{ id, from, to, draw }`, voir `films/exemple/anim/scenes/`), vérifier image par image :

```bash
node core/render/render.mjs mon-film --page only --query scenes=intro --stills 3,6
```

4. Rendu complet, son, version à partager (1080p, moins de 30 Mio) :

```bash
node core/render/render.mjs mon-film --out out/film_video.mp4 --workers 8
```

```bash
node films/mon-film/render/mux.mjs
```

```bash
node core/render/share.mjs films/mon-film/out/mon-film.mp4
```

## Structure

| Chemin | Contenu |
|---|---|
| `core/anim/` | `index.html` + `main.js` (page du film : mode rendu ou aperçu avec le son), `engine.js` (dimensions 1920×1080, maths, easing, hasard déterministe, bruit) |
| `core/anim/paper/` | kit papier découpé : `paper.js` (pièces, grain, ombres, formes), `text.js` (stickers, karaoké), `timeline.js` (minutage : lignes, mots, battements, bouche), `filmcore.js` (montage : transitions, karaoké, panneaux de chapitre) |
| `core/render/` | `render.mjs` (rendu headless parallèle → mp4), `serve.mjs` (aperçu et calage), `share.mjs` (version < 30 Mio), `paths.mjs` (dossier d'un film, recherche de Chrome) |
| `core/analysis/` | `analyze.py` (tempo, battements, activité vocale), `plot.py` (vue d'ensemble pour caler les sections), `grid_timing.mjs` (minutage sur grille de tempo) |
| `templates/` | `clip-papier/` (scènes, paroles, calage, analyse de la voix, montage du son), `libre/` |
| `films/exemple/` | le film d'exemple : `anim/` (film, scènes, décors, texte, minutage), `audio/compose.py`, `render/mux.mjs` |
| `docs/exemple.mp4` | aperçu du film d'exemple affiché en haut de ce README (seul média versionné) |

Le serveur de rendu sert `/core/...` depuis le dépôt et tout le reste depuis le dossier du film : dans un film, on importe le framework par `/core/anim/...` et ses propres fichiers par `/anim/...` ou en relatif.

## Licence

Code sous licence MIT (voir `LICENSE`).
