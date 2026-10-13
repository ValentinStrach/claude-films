// Accès au minutage de la chanson (anim/timing.js, généré par analysis/timing.py).
import { TIMING } from '/anim/timing.js';
import { clamp, invlerp } from '../engine.js';

export const T = TIMING;
const SECTION_IDS = Object.keys(T.sections);

// Ligne i de la section sid : { start, end, who, words: [{ w, t0, t1 }], text }.
export function L(sid, i = 0) {
  const n = T.lines.filter((l) => l.section === sid);
  if (!n.length) throw new Error(`section inconnue : ${sid}`);
  return n[Math.max(0, Math.min(n.length - 1, i < 0 ? n.length + i : i))];
}

// Instant d'une référence : nombre (secondes) ou [section, ligne, décalage, 'start'|'end'].
export function at(ref) {
  if (typeof ref === 'number') return ref;
  const [sid, i = 0, off = 0, edge = 'start'] = ref;
  return L(sid, i)[edge] + off;
}

// Ligne en cours (avec une petite traîne après la fin), ou null. Les lignes marquées « skip »
// (pas chantées, signalées au calage) ne s'affichent pas.
export function lineAt(t, tail = 0.35) {
  for (let k = T.lines.length - 1; k >= 0; k--) {
    const l = T.lines[k];
    if (!l.skip && t >= l.start - 0.12 && t < l.end + tail) return l;
  }
  return null;
}

// Mot en cours de la ligne en cours.
export function wordAt(t) {
  const l = lineAt(t, 0);
  if (!l) return null;
  for (let j = l.words.length - 1; j >= 0; j--) if (t >= l.words[j].t0) return l.words[j];
  return null;
}

// Vrai si le mot chanté est un écho du chœur (entre parenthèses dans les paroles).
export function isEcho(t) {
  const l = lineAt(t, 0);
  if (!l) return false;
  let depth = 0;
  for (const w of l.words) {
    if (w.w.startsWith('(')) depth = 1;
    if (t >= w.t0 && t < w.t1) return depth > 0;
    if (w.w.includes(')')) depth = 0;
  }
  return false;
}

// Qui chante à l'instant t : le champ `who` de la ligne (voir anim/lyrics.js), 'choir' pour un écho, ou null.
// Les échos entre parenthèses sont chantés par le chœur.
export function singerAt(t) {
  const l = lineAt(t, 0);
  if (!l) return null;
  return isEcho(t) ? 'choir' : l.who;
}

// Ouverture de bouche (0..1) d'après la voix isolée.
export function mouthAt(t) {
  const m = T.mouth;
  const f = t * 30;
  const i = Math.max(0, Math.min(m.length - 2, Math.floor(f)));
  return m[i] + (m[i + 1] - m[i]) * (f - i);
}

// Battement : index, fraction du temps écoulée, et « pulse » qui décroît après chaque temps.
export function beat(t) {
  const b = T.beats;
  let lo = 0, hi = b.length - 1;
  if (t < b[0]) return { i: -1, frac: 0, pulse: 0, bar: -1 };
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (b[mid] <= t) lo = mid; else hi = mid;
  }
  const len = (b[lo + 1] ?? b[lo] + 0.39) - b[lo];
  const frac = clamp((t - b[lo]) / len);
  return { i: lo, frac, pulse: Math.exp(-frac * 5), bar: Math.floor(lo / 4) };
}

export const section = (sid) => T.sections[sid];
export const sectionAt = (t) => SECTION_IDS.find((s) => t >= T.sections[s].start - 0.5 && t < T.sections[s].end + 0.5) || null;
export const progress = (t, a, b) => invlerp(at(a), at(b), t);
