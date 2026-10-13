#!/usr/bin/env node
// Minutage sur une grille de tempo, sans analyse audio : pour un film sans voix chantée (musique
// composée en code) ou en attendant la chanson. Chaque ligne de anim/lyrics.js dure `--beats` temps,
// ses mots se partagent les trois quarts de la ligne au prorata de leur longueur.
//   node core/analysis/grid_timing.mjs <film> [--bpm 120] [--beats 8] [--start 1] [--duration 20]
// Écrit <film>/anim/timing.js, au même format que analysis/timing.py (bouche fermée : mouth à 0).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { filmDir } from '../render/paths.mjs';

const args = process.argv.slice(3);
const KNOWN = ['bpm', 'beats', 'start', 'duration'];
for (const x of args) {
  if (x.startsWith('--') && !KNOWN.includes(x.slice(2))) {
    console.error(`option inconnue : ${x} (options : ${KNOWN.map((k) => `--${k}`).join(' ')})`);
    process.exit(1);
  }
}
// Valeur numérique d'une option, ou d si elle est absente ; une valeur manquante ou non numérique arrête tout.
function opt(k, d) {
  const i = args.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = Number(args[i + 1]);
  if (args[i + 1] === undefined || Number.isNaN(v) || v < 0) {
    console.error(`--${k} attend un nombre positif`);
    process.exit(1);
  }
  return v;
}
if (!process.argv[2]) {
  console.error('usage : node core/analysis/grid_timing.mjs <film> [--bpm 120] [--beats 8] [--start 1] [--duration s]');
  process.exit(1);
}
const ROOT = filmDir(process.argv[2]);
const { SECTIONS } = await import(pathToFileURL(path.join(ROOT, 'anim/lyrics.js')));
const bpm = opt('bpm', 120);
const beat = 60 / bpm;
const lineLen = opt('beats', 8) * beat;
const start = opt('start', 1);
const nLines = SECTIONS.reduce((n, s) => n + s.lines.length, 0);
const duration = opt('duration', start + nLines * lineLen + 2);
const r3 = (x) => Math.round(x * 1000) / 1000;

const lines = [];
const sections = {};
for (const s of SECTIONS) {
  s.lines.forEach((l, index) => {
    const t0 = start + lines.length * lineLen;
    const end = t0 + lineLen * 0.9;
    const words = l.text.split(/\s+/).filter(Boolean);
    const total = words.reduce((n, w) => n + w.length, 0) || 1;
    let acc = 0;
    const wt = words.map((w) => {
      const a = t0 + (acc / total) * lineLen * 0.75;
      acc += w.length;
      return { w, t0: r3(a), t1: r3(t0 + (acc / total) * lineLen * 0.75) };
    });
    if (wt.length) wt[wt.length - 1].t1 = r3(end);
    lines.push({ section: s.id, index, who: l.who, text: l.text, start: r3(t0), end: r3(end), words: wt });
    sections[s.id] ??= { start: r3(t0), end: r3(end) };
    sections[s.id].end = r3(end);
  });
}

// Décalage de la grille dans un temps (0 si --start tombe sur un temps), sans les erreurs du modulo flottant.
const frac = start / beat - Math.floor(start / beat);
const phase = frac < 1e-6 || frac > 1 - 1e-6 ? 0 : frac * beat;

const T = {
  source: 'grid',
  duration: r3(duration),
  bpm,
  // Grille calée sur --start : les débuts de ligne tombent toujours sur un temps.
  beats: Array.from({ length: Math.ceil(duration / beat) + 1 }, (_, i) => r3(phase + i * beat)).filter((b) => b < duration),
  sections,
  lines,
  mouth: new Array(Math.ceil(duration * 30) + 1).fill(0),
};
const late = lines.filter((l) => l.start >= duration);
if (late.length) console.error(`attention : ${late.length} ligne(s) commencent après --duration ${duration} s et ne s'afficheront pas`);
const out = path.join(ROOT, 'anim/timing.js');
fs.writeFileSync(out, `// Généré par core/analysis/grid_timing.mjs (grille à ${bpm} BPM) : ne pas modifier à la main.\nexport const TIMING = ${JSON.stringify(T)};\n`);
console.log(`${out} (${lines.length} lignes, ${r3(duration)} s)`);
