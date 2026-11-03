#!/usr/bin/env node
// Montage final : film (out/film_video.mp4) et mix (audio/mix.wav), précédés et suivis, s'ils existent, du générique
// d'ouverture assets/intro.mp4 et de fin assets/outro.mp4, en fondu enchaîné. Sous-titres out/film.srt recalés.
//   node render/assemble.mjs   (depuis le dossier du film) -> out/<film>.mp4 et out/<film>.srt
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const f = (p) => path.join(ROOT, p);
const VIDEO = f('out/film_video.mp4');
const MIX = f('audio/mix.wav');
const INTRO = f('assets/intro.mp4');
const OUTRO = f('assets/outro.mp4');
const OUT = f(`out/${path.basename(ROOT)}.mp4`);

// Coupe de l'intro (s) si sa fin ne doit pas être reprise ; null = intro entière.
const INTRO_CUT = null;
const XFADE = 0.5;

for (const p of [VIDEO, MIX]) if (!fs.existsSync(p)) { console.error(`manquant : ${p}`); process.exit(1); }

function duration(p) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' });
  if (r.error) { console.error(`impossible de lancer ffprobe : ${r.error.message}`); process.exit(1); }
  return Number(r.stdout.trim());
}
const hasAudio = (p) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', p], { encoding: 'utf8' }).stdout.trim() !== '';

const inputs = [];
const graph = [];
const V = 'fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1,setsar=1,format=yuv420p';
const A = 'aresample=48000,aformat=channel_layouts=stereo';

// Chaque segment : [vN][aN] de durée connue ; intro et outro sans piste son reçoivent un silence.
function segment(video, audio, dur, trim) {
  const n = inputs.length;
  inputs.push('-i', video);
  const cut = trim ? `,trim=0:${trim},setpts=PTS-STARTPTS` : '';
  const i = n / 2;
  graph.push(`[${i}:v]${V}${cut}[v${i}]`);
  if (audio === video && !hasAudio(video)) graph.push(`aevalsrc=0:d=${dur}:s=48000,${A}[a${i}]`);
  else {
    let j = i;
    let fit = trim ? `,atrim=0:${trim},asetpts=PTS-STARTPTS` : '';
    if (audio !== video) {
      j = inputs.length / 2;
      inputs.push('-i', audio);
      fit = `,apad,atrim=0:${dur}`;
    }
    graph.push(`[${j}:a]${A}${fit}[a${i}]`);
  }
  return { v: `v${i}`, a: `a${i}`, dur };
}

const parts = [];
let shift = 0;
if (fs.existsSync(INTRO)) {
  const d = INTRO_CUT ?? duration(INTRO);
  parts.push(segment(INTRO, INTRO, d, INTRO_CUT));
  shift = d - XFADE;
}
parts.push(segment(VIDEO, MIX, duration(VIDEO)));
if (fs.existsSync(OUTRO)) parts.push(segment(OUTRO, OUTRO, duration(OUTRO)));

let cur = parts[0];
let len = cur.dur;
parts.slice(1).forEach((p, k) => {
  const v = `vx${k}`;
  const a = `ax${k}`;
  graph.push(`[${cur.v}][${p.v}]xfade=transition=fade:duration=${XFADE}:offset=${(len - XFADE).toFixed(3)}[${v}]`);
  graph.push(`[${cur.a}][${p.a}]acrossfade=d=${XFADE}[${a}]`);
  len += p.dur - XFADE;
  cur = { v, a };
});

const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'];
const args = ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', graph.join(';'), '-map', `[${cur.v}]`, '-map', `[${cur.a}]`, ...enc, OUT];
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.error || r.status !== 0) {
  console.error(r.error ? `impossible de lancer ffmpeg : ${r.error.message}` : 'ffmpeg a échoué');
  process.exit(r.status || 1);
}
console.log(`${OUT} (${duration(OUT).toFixed(1)} s${parts.length > 1 ? `, ${parts.length - 1} générique(s)` : ''})`);

// Sous-titres du film décalés de la durée de l'intro.
const SRT = f('out/film.srt');
if (fs.existsSync(SRT)) {
  const ts = (s) => {
    const [h, m, rest] = s.split(':');
    const ms = Math.round(((+h * 60 + +m) * 60 + Number(rest.replace(',', '.')) + shift) * 1000);
    const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  const srt = fs.readFileSync(SRT, 'utf8').replace(/(\d+:\d+:\d+,\d+) --> (\d+:\d+:\d+,\d+)/g, (_, a, b) => `${ts(a)} --> ${ts(b)}`);
  fs.writeFileSync(OUT.replace(/\.mp4$/, '.srt'), srt, 'utf8');
  console.log(OUT.replace(/\.mp4$/, '.srt'));
}
