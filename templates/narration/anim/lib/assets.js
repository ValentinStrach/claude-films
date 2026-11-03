// Polices et images du film (fichiers dans assets/, jamais versionnés) : listes vides par défaut.
// Police de charte : l'ajouter à FONTS, puis mettre sa famille en tête de FONT dans theme.js.
const FONTS = [
  // { family: 'Ma Police', url: '/assets/fonts/MaPolice-Regular.woff2', weight: '400', style: 'normal' },
];
// Pictos blancs sur fond transparent : assets/icons/<nom>.png, utilisés par badge() et iconCard({ icon }).
const ICONS = [];
// Illustrations et captures : assets/img/<fichier>, rangées sous leur nom sans extension.
const IMAGES = [];

// onload plutôt que decode() : decode() peut ne jamais aboutir dans un onglet headless en arrière-plan.
function image(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image introuvable : ${src}`));
    img.src = src;
  });
}

export async function loadAssets() {
  const faces = FONTS.map((f) => new FontFace(f.family, `url(${f.url})`, { weight: f.weight ?? '400', style: f.style ?? 'normal' }));
  for (const face of await Promise.all(faces.map((x) => x.load()))) document.fonts.add(face);
  const icons = Object.fromEntries(await Promise.all(ICONS.map(async (n) => [n, await image(`/assets/icons/${n}.png`)])));
  const img = Object.fromEntries(await Promise.all(IMAGES.map(async (n) => [n.replace(/\.\w+$/, ''), await image(`/assets/img/${n}`)])));
  return { icons, img };
}
