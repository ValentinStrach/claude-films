#!/usr/bin/env node
// Pose la musique (audio/music.wav, composée par audio/compose.py) sur la vidéo muette.
//   node films/<film>/render/mux.mjs [out/film_video.mp4] [out/film.mp4]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const video = path.resolve(ROOT, process.argv[2] || 'out/film_video.mp4');
const out = path.resolve(ROOT, process.argv[3] || `out/${path.basename(ROOT)}.mp4`);

const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', path.join(ROOT, 'audio/music.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status);
console.log(out);
