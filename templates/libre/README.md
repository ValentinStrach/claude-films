# Titre du film

Film en Canvas libre (modèle `templates/libre`) : pas de papier découpé ni de chanson calée. Pitch en deux phrases.

## Pipeline

1. **Image** : `anim/film.js` (`DURATION`, `preload`, `drawFrame`), en fonctions pures du temps.
2. **Son** : `audio/music.wav` (composé en code ou fourni).
3. **Rendu** : `core/render/render.mjs`, puis `render/mux.mjs` pose la musique.

## Décisions

- (contraintes et choix du projet, à noter au fil de l'eau)
