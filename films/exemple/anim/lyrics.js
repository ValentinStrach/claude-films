// Texte du conte, affiché en karaoké sur la musique (minutage : core/analysis/grid_timing.mjs).
// Même format que les paroles d'un clip chanté, lu aussi par analysis/timing.py dans le modèle clip-papier.
export const SECTIONS = [
  { id: 'matin', label: 'Le matin', lines: [
    { who: 'conte', text: 'Un petit bateau de papier' },
    { who: 'conte', text: 'part au matin sur la mer calme.' },
  ] },
  { id: 'tempete', label: 'La tempête', lines: [
    { who: 'conte', text: 'Le vent se lève, la vague gronde,' },
    { who: 'conte', text: 'il tient bon dans la tempête !' },
  ] },
  { id: 'arrivee', label: "L'arrivée", lines: [
    { who: 'conte', text: 'Le soir, il touche une île au loin :' },
    { who: 'conte', text: 'fin du voyage, tout va bien.' },
  ] },
];

// Liste à plat : [{ section, label, index, text, who }]
export const LINES = SECTIONS.flatMap((s) => s.lines.map((l, index) => ({ section: s.id, label: s.label, index, text: l.text, who: l.who })));
