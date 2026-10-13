// Liste des scènes du film (chaque module exporte `scenes`, triées ensuite par début).
// Import protégé : un module absent ou cassé n'empêche pas le reste du film de tourner.
const NAMES = ['matin', 'tempete', 'arrivee'];
const mods = await Promise.all(NAMES.map((n) => import(`./${n}.js`).catch((e) => { console.error(`scenes/${n}.js : ${e}`); return { scenes: [] }; })));
export const SCENES = mods.flatMap((m) => m.scenes);
