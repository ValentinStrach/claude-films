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
const { dir, name } = path.parse(src);
const out = path.join(dir, `${name}_partage.mp4`);
const LIMIT_MIB = 30;
const log = path.join(os.tmpdir(), `share-${process.pid}`);

// Lance un outil ffmpeg et lève une erreur lisible s'il est absent ou échoue.
function tool(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, opts);
  if (r.error) throw new Error(`impossible de lancer ${cmd} : ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} a échoué (code ${r.status})`);
  return r;
}

try {
  const duration = Number(tool('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).stdout.toString());
  if (!(duration > 0)) throw new Error(`durée illisible pour ${src}`);
  const kbps = Math.min(6000, Math.floor(((LIMIT_MIB - 1) * 8 * 1024 * 1024) / duration / 1000) - 96);
  const run = (args) => tool('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=-2:1080', '-c:v', 'libx264', '-preset', 'slow',
    '-b:v', `${kbps}k`, '-pix_fmt', 'yuv420p', '-passlogfile', log, ...args], { stdio: 'inherit' });
  run(['-pass', '1', '-an', '-f', 'mp4', os.devNull]);
  run(['-pass', '2', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
  const mib = fs.statSync(out).size / 2 ** 20;
  console.log(`${out} (${mib.toFixed(1)} Mio, ${kbps} kb/s)`);
  if (mib > LIMIT_MIB) console.error(`attention : plus de ${LIMIT_MIB} Mio, certaines messageries la refuseront`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  for (const f of fs.readdirSync(os.tmpdir())) if (f.startsWith(path.basename(log))) fs.rmSync(path.join(os.tmpdir(), f), { force: true });
}
