// Paroles telles que chantées, découpées en sections (analysis/timing.py lit ce fichier).
// Garder exactement ce format (une ligne par objet, guillemets simples ou doubles) : timing.py le lit par regex.
// `who` : qui chante ('solo', 'choir', 'all'...). Les échos entre parenthèses sont chantés par le chœur.
export const SECTIONS = [
  { id: 'intro', label: 'Intro', lines: [
    { who: 'solo', text: 'Première ligne de la chanson,' },
    { who: 'solo', text: 'deuxième ligne (et son écho !)' },
  ] },
  { id: 'c1', label: 'Refrain 1', lines: [
    { who: 'all', text: 'Le refrain que tout le monde chante,' },
    { who: 'all', text: 'et la fin du refrain !' },
  ] },
];

// Liste à plat : [{ section, label, index, text, who }]
export const LINES = SECTIONS.flatMap((s) => s.lines.map((l, index) => ({ section: s.id, label: s.label, index, text: l.text, who: l.who })));
