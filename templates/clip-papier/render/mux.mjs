#!/usr/bin/env node
// Pose la chanson (audio/song.mp3) sur la vidéo muette.
//   node films/<film>/render/mux.mjs [out/film_video.mp4] [out/film.mp4]
// Pour un montage plus riche (fondus, passage rejoué sous un post-générique), écrire ici un
// -filter_complex ffmpeg (asplit, atrim, afade, adelay, amix).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const video = path.resolve(ROOT, process.argv[2] || 'out/film_video.mp4');
const out = path.resolve(ROOT, process.argv[3] || `out/${path.basename(ROOT)}.mp4`);

const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', path.join(ROOT, 'audio/song.mp3'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
console.log(out);
