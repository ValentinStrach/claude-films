# Titre du film

Film en Canvas libre (modèle `templates/libre`) : pas de papier découpé ni de chanson calée. Pitch en deux phrases.

## Pipeline

1. **Image** : `anim/film.js` (`DURATION`, `preload`, `drawFrame`), en fonctions pures du temps.
2. **Son** : `audio/music.wav`, à fournir ou à composer en code (voir `films/exemple/audio/compose.py`). Sans lui, l'aperçu reste muet (Espace ne lance rien) et `render/mux.mjs` échoue ; le rendu de l'image, lui, n'en a pas besoin.
3. **Rendu** : `core/render/render.mjs`, puis `render/mux.mjs` pose la musique.

## Décisions

- (contraintes et choix du projet, à noter au fil de l'eau)
