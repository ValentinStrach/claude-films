# claude-films

Framework pour faire des films d'animation 100 % code (Canvas 2D → Chrome headless → ffmpeg). Lire `README.md` pour les commandes. Langue du projet : français (code commenté en français, docs en français).

Dépôt destiné à être public : n'y mettre aucune donnée personnelle ni d'entreprise (personnes réelles, noms, résultats, traces GPS, chartes, logos, chiffres internes). Les films personnels vivent dans un autre dossier ou dépôt et se rendent en passant leur chemin aux scripts.

## Architecture

- `core/` : framework commun. `core/render/render.mjs <film>` et `core/render/serve.mjs <film>` servent `/core/...` depuis le dossier `core/` et tout le reste depuis le dossier du film, rien d'autre (`staticFile` de `core/render/paths.mjs`) ; ils refusent les requêtes non locales (`isLocalRequest`) et `serve.mjs` n'enregistre que des `analysis/<nom>.json`. `<film>` : nom (`films/<nom>/` du dépôt) ou chemin (`./mon-film`, `../autre-depot/mon-film`), résolu par `core/render/paths.mjs`. Les chemins `--out` sont relatifs au dossier du film.
- Contrat d'un film (`<film>/anim/film.js`, chargé par `core/anim/main.js`) : exporter `DURATION` (s), `preload()` (async) et `drawFrame(ctx, t)`, plus `AUDIO` si le son d'aperçu n'est pas `/audio/song.mp3`. Les pages de test sont `anim/pages/<nom>.js` (`--page <nom>`), avec le même contrat. Si le film ne se charge pas (module introuvable, erreur dans `preload`), `main.js` met le message dans `window.__error` et `render.mjs` s'arrête aussitôt avec lui.
- Imports : le framework par chemin absolu (`/core/anim/engine.js`, `/core/anim/paper/paper.js`...), les fichiers du film en relatif ou par `/anim/...`. Dans `core/`, tout ce qui dépend du film passe par `/anim/...` (ex. `timeline.js` importe `/anim/timing.js`).
- Kit papier : `createFilm(scenes, { duration, load })` de `core/anim/paper/filmcore.js`. Une scène = `{ id, from, to, draw(ctx, t, { lt, p, dur, ASSETS }), transition?: 'wipe'|'iris'|'cut', chapter?, noKaraoke?, preload? }`, `from`/`to` en secondes ou `[section, ligne, décalage, 'start'|'end']`. `load(ASSETS)` charge les données propres au film. Personnages, décors et accessoires appartiennent au film (`anim/chars/`, `anim/sets/`), pas à `core/`.
- Minutage : `anim/lyrics.js` (format lu par regex dans `analysis/timing.py`, à respecter) → `anim/timing.js` (généré, ne pas éditer à la main), soit par `analysis/timing.py` (chanson analysée, calage à la main avec `anim/tapper.html` prioritaire), soit par `core/analysis/grid_timing.mjs` (grille de tempo, sans voix).
- `films/exemple/` : film de référence, reproductible depuis un clone (musique composée par `audio/compose.py`, minutage sur grille). Le garder rendable sans aucun média externe.

## Règles de dessin

- 1920×1080, 30 i/s. Tout est **fonction pure du temps** `t` : pas de `Math.random()`, pas d'état d'une image à l'autre (`rng(seed)`, `hash()`, `noise1()` de `core/anim/engine.js`). Les images sont rendues dans le désordre, par plusieurs pages en parallèle.
- Vérifier visuellement avec `--stills` (lire les PNG de `<film>/out/stills/`) avant un rendu complet ; `--page only --query scenes=<module>` isole un module de scènes.
- Polices : uniquement des polices système avec repli multi-plateforme (voir `FONT` et `HAND` de `core/anim/paper/text.js`), ou des polices libres embarquées par le film.

## Modifier `core/`

Tous les films en dépendent. Avant de toucher `core/`, rendre des images de référence des films concernés (au moins `films/exemple`, `--stills` à plusieurs instants, plus une page `only`), puis les rendre de nouveau après et comparer au pixel (Pillow `ImageChops.difference(...).getbbox()` doit valoir `None`), sauf changement voulu. Les rendus ne sont comparables que sur une même machine (polices système).

## Plateformes

macOS, Windows et Linux : navigateur trouvé par `findChrome()` (variable `CHROME`, sinon Chrome, Chromium ou Edge), chemins construits avec `path`, `os.devNull` plutôt que `/dev/null`, noms relatifs dans la liste de concaténation ffmpeg (aucun chemin à échapper), `encoding="utf-8"` sur toute lecture ou écriture de texte en Python (sinon cp1252 sous Windows). `render.mjs` arrête toujours Chrome et supprime son profil temporaire, même après une erreur. Toute nouvelle commande documentée doit marcher sous Windows (PowerShell) aussi.

## Médias et Git

- Jamais dans Git : images, vidéos, sons, polices, `.npz`, `out/`, et tout `films/*` sauf `films/exemple/` (voir `.gitignore`). Seules exceptions : `docs/exemple.mp4` (aperçu 720p du README, environ 4 Mo) et `docs/exemple.jpg` (image fixe cliquable du README, GitHub ne lisant pas les mp4 du dépôt en ligne), à refaire quand le film d'exemple change (commandes dans `films/exemple/README.md`).
- Python : `.venv` créé avec `uv` (`requirements.txt`), scripts documentés en `uv run python ...` (même commande sous Windows), sans `&&` (absent de Windows PowerShell 5.1).

## Conventions

- Commits : Conventional Commits (`feat(core): ...`, `docs: ...`), sans ligne `Co-Authored-By`.
- Pas de tiret cadratin (U+2014) dans les textes générés.
- Tenir à jour ce fichier et `README.md` à chaque changement de structure.
