# Titre du film

Vidéo commentée en motion design (modèle `templates/narration`) : voix off (synthèse locale ou voix enregistrée), panneau de titre animé d'une scène à l'autre, cartes et listes calées sur les répliques, musique composée en code. Pitch en deux phrases : public, message, durée.

## Pipeline

Commandes depuis le dossier du film, avec le Python du framework (`<framework>/.venv/Scripts/python.exe` sous Windows, `<framework>/.venv/bin/python` ailleurs).

0. **Source** (facultatif) : une présentation PowerPoint dans `source/`. `tools/slides.py` en extrait le texte et les notes (`source/slides.txt`), les images (`source/media/`) et un rendu de chaque slide (`source/slides_png/`, si LibreOffice et Poppler sont installés ; `--no-png` sinon).

```bash
python tools/slides.py source/presentation.pptx
```

1. **Script** : `script/narration.json`, scène par scène (`id`, répliques, voix, pauses `lead` / `gap` / `tail`, rôle musical `music`). Lexique `say` pour la prononciation (« FAQ » dit « F.A.Q. »), `say` sur une réplique pour un texte prononcé différent, `take` pour forcer une nouvelle prise.
2. **Voix** : chaque voix du script est soit synthétisée par [Piper](https://github.com/OHF-Voice/piper1-gpl) (libre, hors ligne : `"model"`, chemin d'un `.onnx`), soit enregistrée (`"record": true`).
   - Piper : l'installer dans le Python du framework (`uv pip install -p <framework>/.venv piper-tts`), puis déposer un modèle et son `.onnx.json` dans `voices/` (voix françaises `fr_FR-siwis-medium`, `fr_FR-tom-medium`, `fr_FR-upmc-medium`... sur [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices)). Seules les répliques modifiées sont refaites ; `tts.py sample voices/<modèle>.onnx` fait entendre un modèle.
   - Enregistrement : une prise par réplique dans `audio/record/<scène>-<n>.wav` (ou mp3, m4a...), n à partir de 1 ; `tts.py todo` liste les fichiers attendus avec leur texte. Une prise plus récente remplace l'ancienne au `build` suivant.

```bash
python audio/tts.py build
```

3. **Minutage** : `anim/timing.js` (généré), `audio/voice.wav`, `out/film.srt`. Sans voix synthétisée, chaque réplique reçoit une durée estimée : le film se rend déjà, musique seule.

```bash
python audio/timing.py
```

4. **Musique et mix** : `audio/music.wav` (sections calées sur les scènes qui portent `music`), puis `audio/mix.wav` (musique baissée sous la voix, -16 LUFS). À refaire dès que le minutage change.

```bash
python audio/compose.py
```

```bash
python audio/mix.py
```

5. **Image** (depuis le framework) : images fixes, puis le film entier. `render/sheet.py` fait une planche contact de `out/stills/`.

```bash
node core/render/render.mjs <film> --stills 3,10,20
```

```bash
node core/render/render.mjs <film> --out out/film_video.mp4 --workers 8
```

6. **Montage** : film + mix, précédés de `assets/intro.mp4` et suivis de `assets/outro.mp4` s'ils existent (fondu enchaîné), sous-titres recalés. Sortie `out/<film>.mp4` et `out/<film>.srt`.

```bash
node render/assemble.mjs
```

## Structure

| Chemin | Contenu |
|---|---|
| `anim/film.js` | orchestrateur : panneau de titre (`layout` : `title`, `chapter`, `band`, `full`), texte du panneau, transitions, travelling |
| `anim/lib/theme.js` | charte du film : couleurs `C`, police `FONT`, inclinaison du panneau `SLANT`, cartes, badges, flèches, texte mot à mot |
| `anim/lib/ui.js` | composants : colonnes, liste cochée, carte à picto, bandeau, encadré, bulle, nœud de schéma, ordinateur portable |
| `anim/lib/assets.js` | polices embarquées (`FONTS`), pictos (`ICONS`) et images (`IMAGES`) du film, dans `assets/` |
| `anim/scenes/` | une scène par `id` du script (`index.js` les rassemble) ; `demo.js` sert d'exemple |
| `audio/` | `tts.py` (Piper ou enregistrements → `audio/voice/`), `timing.py`, `compose.py`, `mix.py` |
| `render/` | `assemble.mjs` (montage final), `sheet.py` (planche contact) |
| `tools/slides.py` | extraction d'une présentation PowerPoint |

## Charte

Une charte d'entreprise s'applique dans le film, jamais dans le framework : couleurs dans `theme.js`, police embarquée dans `assets/fonts/` et déclarée dans `assets.js` puis en tête de `FONT`, pictos dans `assets/icons/`, génériques dans `assets/`. Polices, images, vidéos, sons, modèles de voix (`voices/`) et sources (`source/`) ne vont jamais dans Git.

## Décisions

- (contraintes et choix du projet, à noter au fil de l'eau)
