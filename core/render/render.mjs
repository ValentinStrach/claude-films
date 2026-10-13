#!/usr/bin/env node
// Rendu image par image dans Chrome headless, piloté par le protocole DevTools (aucune dépendance npm).
// Premier argument : le film, nom (films/<nom>/ du dépôt) ou chemin vers son dossier. Les chemins de sortie
// sont relatifs au dossier du film. Navigateur : variable CHROME, sinon Chrome, Chromium ou Edge (voir paths.mjs).
//
//   node core/render/render.mjs <nom> --stills 12.5,40          -> out/stills/film_t_12.50.png, film_t_40.00.png
//   node core/render/render.mjs <nom> --page gallery_chars --stills 0,1.5   (galerie anim/pages/gallery_chars.js)
//   node core/render/render.mjs <nom> --page only --query scenes=v1 --stills 20   (seulement anim/scenes/v1.js)
//   node core/render/render.mjs <nom> --from 0 --to 20 --out out/preview.mp4 --workers 4
//   node core/render/render.mjs <nom> --out out/film_video.mp4 --workers 6   (film entier)
//
// La page core/anim/index.html?render=1 expose window.__ready, window.__duration et
// window.__capture(t, format, qualité) qui dessine l'instant t et renvoie un data URL.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { filmDir, findChrome, staticFile, isLocalRequest } from './paths.mjs';

if (!process.argv[2] || process.argv[2].startsWith('--')) {
  console.error('usage : node core/render/render.mjs <film> [options]');
  process.exit(1);
}
const ROOT = filmDir(process.argv[2]);
const CHROME = findChrome();
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.bin': 'application/octet-stream',
};

// Options en --clé valeur ou --clé=valeur ; une option inconnue ou sans valeur arrête tout de suite.
function parseArgs(argv) {
  const a = { fps: 30, workers: 1, from: 0, to: null, out: 'out/render.mp4', stills: null, format: 'jpeg', quality: 0.95, crf: 17 };
  const NUM = ['fps', 'workers', 'from', 'to', 'quality', 'crf'];
  const STR = ['out', 'format', 'page', 'query'];
  const fail = (msg) => {
    console.error(`${msg}\noptions : --stills t1,t2 | --page nom | --query clé=valeur | --from s | --to s | --out fichier.mp4 | --workers n | --fps n | --crf n | --format jpeg|png | --quality 0..1`);
    process.exit(1);
  };
  for (let i = 3; i < argv.length; i++) {
    let [k, v] = argv[i].startsWith('--') ? argv[i].slice(2).split(/=(.*)/s) : [];
    if (!k || ![...NUM, ...STR, 'stills'].includes(k)) fail(`option inconnue : ${argv[i]}`);
    if (v === undefined) v = argv[++i];
    if (v === undefined || v.startsWith('--')) fail(`valeur manquante pour --${k}`);
    if (k === 'stills') {
      a.stills = v.split(',').filter(Boolean).map(Number);
      if (!a.stills.length || a.stills.some(Number.isNaN)) fail('--stills attend des instants séparés par des virgules, par exemple --stills 3,12.5');
    } else if (NUM.includes(k)) {
      a[k] = Number(v);
      if (Number.isNaN(a[k])) fail(`--${k} attend un nombre`);
    } else a[k] = v;
  }
  return a;
}

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      try {
        const f = staticFile(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (!f || !isLocalRequest(req, srv.address().port)) { res.writeHead(403); return res.end(); }
        const data = await fsp.readFile(f);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      } catch {
        res.writeHead(404); res.end();
      }
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Chrome choisit lui-même son port DevTools (0) et l'écrit dans DevToolsActivePort : pas de collision
// avec un autre Chrome. stop() l'arrête et supprime son profil temporaire, y compris après une erreur.
async function launchChrome() {
  const userDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'claude-films-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userDir}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--force-device-scale-factor=1', 'about:blank',
  ], { stdio: 'ignore' });
  let failed = null;
  proc.on('error', (e) => { failed = e; });
  const running = () => proc.pid !== undefined && proc.exitCode === null && proc.signalCode === null;
  const stop = async () => {
    if (running()) {
      const exited = new Promise((r) => proc.once('exit', r));
      proc.kill();
      await Promise.race([exited, sleep(3000)]);
    }
    await fsp.rm(userDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  };
  // Filet de sécurité si Node s'arrête sur une erreur imprévue : pas de Chrome orphelin ni de profil oublié.
  process.on('exit', () => {
    if (running()) proc.kill();
    try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
  });
  let wsUrl;
  for (let i = 0; i < 150 && !wsUrl && !failed && proc.exitCode === null; i++) {
    const [port, wsPath] = (await fsp.readFile(path.join(userDir, 'DevToolsActivePort'), 'utf8').catch(() => '')).split('\n');
    if (wsPath?.startsWith('/devtools/')) wsUrl = `ws://127.0.0.1:${port}${wsPath.trim()}`;
    else await sleep(100);
  }
  if (!wsUrl) {
    await stop();
    throw new Error(failed ? `impossible de lancer ${CHROME} : ${failed.message}` : `Chrome ne répond pas (${CHROME})`);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const pending = new Map();
  let id = 0;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      console.error('[page] exception:', m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      console.error(`[page ${m.params.type}]`, m.params.args.map((x) => x.value ?? x.description).join(' '));
    } else if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) {
      console.error(`[page log]`, m.params.entry.text, m.params.entry.url || '');
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
  return { send, stop };
}

async function openPage(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => cdp.send(m, p, sessionId);
  await s('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await s('Runtime.enable');
  await s('Log.enable');
  await s('Page.enable');
  await s('Page.navigate', { url });
  const evaluate = async (expression, timeoutMs = 60000) => {
    const r = await Promise.race([
      s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }),
      sleep(timeoutMs).then(() => { throw new Error(`pas de réponse de la page : ${expression.slice(0, 60)}`); }),
    ]);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  // Les réponses DevTools de plus de ~6 Mo se perdent : l'image est rapatriée par morceaux.
  const capture = async (t, format, quality) => {
    const len = await evaluate(`(window.__buf = window.__capture(${t}, '${format}', ${quality})).length`);
    let out = '';
    for (let o = 0; o < len; o += 2_000_000) out += await evaluate(`window.__buf.slice(${o}, ${o + 2_000_000})`);
    return out;
  };
  for (let i = 0; i < 300; i++) {
    if (await evaluate('window.__ready === true', 1000).catch(() => false)) return { evaluate, capture };
    const err = await evaluate('window.__error ?? null', 1000).catch(() => null);
    if (err) throw new Error(`le film ne se charge pas :\n${err}`);
    await sleep(100);
  }
  throw new Error('La page ne signale jamais __ready');
}

const decode = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

async function renderRange(page, from, to, a, outFile, label) {
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(a.fps),
    '-c:v', a.format === 'png' ? 'png' : 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(a.crf), '-pix_fmt', 'yuv420p', outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => {
    ff.on('error', (e) => rej(new Error(`impossible de lancer ffmpeg : ${e.message}`)));
    ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg a échoué (${c})`))));
  });
  // Si ffmpeg s'arrête, l'erreur remonte par done : on cesse d'écrire au lieu d'attendre un drain qui ne viendra pas.
  let failed = null;
  done.catch((e) => { failed = e; });
  ff.stdin.on('error', () => {});
  const t0 = Date.now();
  for (let f = from; f < to; f++) {
    if (failed) throw failed;
    const buf = decode(await page.capture(f / a.fps, a.format, a.quality));
    if (!ff.stdin.write(buf)) await Promise.race([new Promise((r) => ff.stdin.once('drain', r)), done]);
    if ((f - from) % 150 === 149) {
      const fps = (f - from + 1) / ((Date.now() - t0) / 1000);
      console.log(`${label} image ${f + 1 - from}/${to - from} (${fps.toFixed(1)} img/s)`);
    }
  }
  ff.stdin.end();
  await done;
}

const a = parseArgs(process.argv);
const srv = await serve();
const url = `http://127.0.0.1:${srv.address().port}/core/anim/index.html?render=1${a.page ? `&page=${encodeURIComponent(a.page)}` : ''}${a.query ? `&${a.query}` : ''}`;
let cdp = null;
try {
  cdp = await launchChrome();
  if (a.stills) {
    const page = await openPage(cdp, url);
    await fsp.mkdir(path.join(ROOT, 'out/stills'), { recursive: true });
    for (const t of a.stills) {
      const tag = (a.page || 'film') + (a.query ? '_' + a.query.replace(/[^\w,-]+/g, '').replace(/^scenes/, '') : '');
      const f = path.join(ROOT, `out/stills/${tag}_t_${t.toFixed(2)}.png`);
      await fsp.writeFile(f, decode(await page.capture(t, 'png', 1)));
      console.log(f);
    }
  } else {
    const first = await openPage(cdp, url);
    const duration = a.to ?? (await first.evaluate('window.__duration'));
    const f0 = Math.round(a.from * a.fps);
    const f1 = Math.round(duration * a.fps);
    const n = Math.max(1, a.workers);
    const pages = [first, ...(await Promise.all(Array.from({ length: n - 1 }, () => openPage(cdp, url))))];
    const segDir = path.join(ROOT, 'out/segments');
    await fsp.mkdir(segDir, { recursive: true });
    const chunk = Math.ceil((f1 - f0) / n);
    const segs = [];
    const t0 = Date.now();
    await Promise.all(pages.map((p, i) => {
      const s = f0 + i * chunk;
      const e = Math.min(f1, s + chunk);
      if (s >= e) return null;
      const seg = path.join(segDir, `seg_${String(i).padStart(2, '0')}.mp4`);
      segs[i] = seg;
      return renderRange(p, s, e, a, seg, `[w${i}]`);
    }));
    const list = path.join(segDir, 'list.txt');
    // Noms relatifs au dossier de list.txt : aucun chemin à échapper (apostrophes, antislashs de Windows).
    await fsp.writeFile(list, segs.filter(Boolean).map((s) => `file '${path.basename(s)}'`).join('\n'));
    const out = path.resolve(ROOT, a.out);
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out], { stdio: 'inherit' })
      .on('error', (e) => rej(new Error(`impossible de lancer ffmpeg : ${e.message}`)))
      .on('close', (c) => (c === 0 ? res() : rej(new Error('concat a échoué')))));
    console.log(`${out} (${f1 - f0} images en ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  // Sortie immédiate : sinon la fermeture de la WebSocket attend Chrome ~60 s.
  srv.closeAllConnections();
  srv.close();
  await cdp?.stop();
  process.exit(process.exitCode ?? 0);
}
