// Chemins communs aux scripts de rendu : dossier du dépôt, dossier d'un film, navigateur.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Un nom simple désigne films/<nom>/ du dépôt ; un chemin (avec / ou \, ou commençant par .)
// désigne un film rangé ailleurs, par exemple dans un dépôt privé.
export function filmDir(arg) {
  const dir = /[\\/]/.test(arg) || arg.startsWith('.') ? path.resolve(arg) : path.join(REPO, 'films', arg);
  if (!fs.existsSync(path.join(dir, 'anim'))) throw new Error(`pas de dossier anim/ dans ${dir}`);
  return dir;
}

// Fichier servi pour un chemin d'URL : /core/... dans le dossier core/ du dépôt, le reste dans le
// dossier du film. Renvoie null si le chemin sort de ce dossier (.., %2f encodés...).
export function staticFile(film, urlPath) {
  const inCore = urlPath.startsWith('/core/');
  const base = inCore ? path.join(REPO, 'core') : film;
  const f = path.join(base, inCore ? urlPath.slice('/core'.length) : urlPath);
  return f.startsWith(base + path.sep) ? f : null;
}

// Seules les requêtes adressées à ce serveur local sont acceptées : un en-tête Host étranger
// (DNS rebinding) ou un Origin étranger (page web qui envoie une requête) est refusé.
export function isLocalRequest(req, port) {
  const ok = (h) => h === `127.0.0.1:${port}` || h === `localhost:${port}`;
  const origin = req.headers.origin;
  return ok(req.headers.host) && (!origin || ok(origin.replace(/^http:\/\//, '')));
}

// Chrome (ou Chromium, ou Edge sous Windows) : variable CHROME, sinon emplacements habituels.
export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const env = (k) => process.env[k] || '';
  const candidates = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    win32: [
      path.join(env('PROGRAMFILES'), 'Google/Chrome/Application/chrome.exe'),
      path.join(env('PROGRAMFILES(X86)'), 'Google/Chrome/Application/chrome.exe'),
      path.join(env('LOCALAPPDATA'), 'Google/Chrome/Application/chrome.exe'),
      path.join(env('PROGRAMFILES(X86)'), 'Microsoft/Edge/Application/msedge.exe'),
      path.join(env('PROGRAMFILES'), 'Microsoft/Edge/Application/msedge.exe'),
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
  }[process.platform] || [];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome introuvable : installer Google Chrome ou indiquer son chemin dans la variable CHROME');
  return found;
}
