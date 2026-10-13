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
