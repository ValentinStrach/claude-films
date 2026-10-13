#!/usr/bin/env node
// Version à partager (messageries, réseaux) : 1080p, moins de 30 Mio. Deux passes libx264 à débit calculé
// d'après la durée (29 Mio visés, son AAC 96 kb/s), plafonné à 6 Mb/s pour les films courts.
//   node core/render/share.mjs <film>/out/<film>.mp4   -> <film>/out/<film>_partage.mp4
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const src = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(src)) {
  console.error('usage : node core/render/share.mjs <vidéo.mp4>');
  process.exit(1);
}
const out = src.replace(/\.mp4$/, '_partage.mp4');
const duration = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).stdout.toString());
const kbps = Math.min(6000, Math.floor((29 * 8 * 1024 * 1024) / duration / 1000) - 96);
const log = path.join(os.tmpdir(), `share-${process.pid}`);
const run = (args) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=-2:1080', '-c:v', 'libx264', '-preset', 'slow',
    '-b:v', `${kbps}k`, '-pix_fmt', 'yuv420p', '-passlogfile', log, ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
};
run(['-pass', '1', '-an', '-f', 'mp4', os.devNull]);
run(['-pass', '2', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
for (const f of fs.readdirSync(os.tmpdir())) if (f.startsWith(path.basename(log))) fs.rmSync(path.join(os.tmpdir(), f));
console.log(`${out} (${(fs.statSync(out).size / 2 ** 20).toFixed(1)} Mio, ${kbps} kb/s)`);
