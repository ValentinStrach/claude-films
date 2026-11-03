// Scènes de démonstration : titre, panneau de chapitre, deux scènes « band », conclusion plein cadre.
// Une scène = { layout: 'title'|'chapter'|'band'|'full', draw?(ctx, s), over?(ctx, s, w), + texte du panneau }.
// s.t : temps local ; s.cue(i) / s.end(i) : début et fin de la réplique i ; s.k(i) : apparition 0..1 calée sur elle.
import { H, W, clamp, ease, noise1 } from '/core/anim/engine.js';
import { C, appear, arrow, font, para, wordReveal } from '../lib/theme.js';
import { X0, CW, checkList, col3, iconCard, node } from '../lib/ui.js';

// Fondu de sortie commun aux textes posés sur le panneau.
const out = (s, d = 0.45) => 1 - clamp((s.t - (s.dur - d)) / d);

function glow(ctx, t, alpha) {
  const x = 1250 + noise1(t * 0.15, 3) * 260;
  const y = 420 + noise1(t * 0.12, 7) * 160;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 1100);
  g.addColorStop(0, `rgba(255, 255, 255, ${0.16 * alpha})`);
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export const titre = {
  layout: 'title',
  over(ctx, s) {
    const a = out(s);
    ctx.save();
    ctx.globalAlpha = a;
    const k1 = appear(s.t, 0.15, 0.8);
    const k2 = appear(s.t, 0.45, 0.8);
    const k3 = appear(s.t, s.cue(0) + 1.2, 0.8);
    ctx.textBaseline = 'top';
    ctx.globalAlpha = a * k1;
    ctx.font = font(58, 800);
    ctx.fillStyle = C.light;
    ctx.fillText('Modèle', 150 - (1 - k1) * 50, 300);
    ctx.globalAlpha = a * k2;
    ctx.font = font(150, 800);
    ctx.fillStyle = C.white;
    ctx.fillText('Narration', 140 - (1 - k2) * 70, 370);
    ctx.globalAlpha = a * k3;
    para(ctx, 'Une vidéo explicative, entièrement écrite en code', 152, 590 + (1 - k3) * 20, 800, { size: 32, color: 'rgba(255,255,255,0.85)', lh: 44 });
    ctx.restore();
  },
};

export const ch1 = {
  layout: 'chapter',
  over(ctx, s) {
    const a = out(s);
    const k = appear(s.t, 0.2, 0.8);
    ctx.save();
    ctx.globalAlpha = a * k;
    ctx.textBaseline = 'top';
    ctx.font = font(240, 800);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillText('01', 140 - (1 - k) * 60, 250);
    ctx.font = font(26, 800);
    ctx.fillStyle = C.light;
    ctx.fillText('PREMIÈRE PARTIE', 152, 520);
    ctx.font = font(84, 800);
    ctx.fillStyle = C.white;
    ctx.fillText('Le principe', 146 - (1 - k) * 40, 566);
    ctx.restore();
  },
};

export const script = {
  layout: 'band',
  label: 'Le script',
  title: 'Une voix off, réplique par réplique',
  sub: 'script/narration.json',
  steps: ['Script', 'Voix', 'Image'],
  step: 0,
  draw(ctx, s) {
    ctx.save();
    ctx.globalAlpha *= appear(s.t, 0.3, 0.6);
    ctx.font = font(22, 800);
    ctx.fillStyle = C.accent;
    ctx.textBaseline = 'top';
    ctx.fillText('CE QUE CONTIENT LE SCRIPT', X0, 360);
    ctx.restore();
    checkList(ctx, [
      'Les répliques, leur voix et les pauses entre elles',
      'Une seule synthèse par réplique, gardée en cache',
      'Le minutage du film, déduit de la durée de la voix',
    ], X0, 420, CW, s.t, [s.cue(0) + 0.6, s.cue(1), s.cue(2)], { size: 34, gap: 40 });
  },
};

const STEPS = [
  ['Voix off', 'Synthèse vocale, une réplique à la fois.'],
  ['Musique', 'Composée en code, calée sur les scènes.'],
  ['Mixage', 'La musique baisse quand la voix parle.'],
];

export const etapes = {
  layout: 'band',
  label: 'Le son',
  title: 'Trois étapes',
  num: '3',
  draw(ctx, s) {
    STEPS.forEach(([title, text], i) => {
      const { x, w } = col3(i);
      iconCard(ctx, s.A, x, 330, w, 330, s.k(i + 1, 0.7), { n: i + 1, title, text, badgeColor: i === 2 ? C.accent : C.primary });
      if (i) arrow(ctx, x - 30, 495, x - 4, 495, appear(s.t, s.cue(i + 1), 0.4), { color: C.muted, head: 10 });
    });
    node(ctx, 'audio/mix.wav', X0 + CW / 2, 750, appear(s.t, s.end(3) - 0.4, 0.6), { size: 22 });
  },
};

export const conclusion = {
  layout: 'full',
  over(ctx, s) {
    const a = out(s, 0.8);
    ctx.save();
    ctx.globalAlpha = a;
    glow(ctx, s.t, appear(s.t, 0, 2));
    wordReveal(ctx, 'Une phrase change ? Seule cette réplique est refaite, et tout le film se recale.',
      230, 380, 1420, s.t, s.cue(0), s.end(0) - 0.3, { size: 66, weight: 700, hi: ['réplique', 'recale'] });
    ctx.restore();
    const k = appear(s.t, s.end(0) + 0.2, 0.8, ease.back);
    ctx.save();
    ctx.globalAlpha = a * clamp(k * 1.5);
    ctx.fillStyle = C.accent;
    ctx.fillRect(232, 640, 150 * k, 10);
    ctx.restore();
  },
};
