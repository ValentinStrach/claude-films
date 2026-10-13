#!/usr/bin/env node
// Petit serveur local pour l'aperçu d'un film (core/anim/index.html) et son outil de calage (anim/tapper.html).
// /core/... est servi depuis le framework, le reste depuis le dossier du film.
// POST /save/<nom>.json enregistre le corps dans <film>/analysis/<nom>.json (JSON seulement, depuis ce serveur seulement).
import http from 'node:http';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { filmDir, staticFile, isLocalRequest } from './paths.mjs';

// node core/render/serve.mjs <film> [port] [page servie à la racine] ; <film> : nom ou chemin, comme render.mjs.
if (!process.argv[2]) {
  console.error('usage : node core/render/serve.mjs <film> [port] [page]');
  process.exit(1);
}
const ROOT = filmDir(process.argv[2]);
const PORT = Number(process.argv[3] || 8765);
const HOME = '/' + (process.argv[4] || 'core/anim/index.html');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.bin': 'application/octet-stream',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (!isLocalRequest(req, PORT)) { res.writeHead(403); return res.end(); }
    if (req.method === 'POST' && url.pathname.startsWith('/save/')) {
      const name = url.pathname.slice('/save/'.length);
      if (!/^[\w-]+\.json$/.test(name)) { res.writeHead(400); return res.end(); }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      await fsp.writeFile(path.join(ROOT, 'analysis', name), Buffer.concat(chunks));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{"ok":true}');
    }
    const p = url.pathname === '/' ? HOME : decodeURIComponent(url.pathname);
    const f = staticFile(ROOT, p);
    if (!f) { res.writeHead(403); return res.end(); }
    const data = await fsp.readFile(f);
    const type = MIME[path.extname(f)] || 'application/octet-stream';
    // Requêtes partielles : indispensables pour pouvoir se déplacer dans l'audio.
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
      return res.end(data.subarray(start, end + 1));
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, '127.0.0.1', () => console.log(`http://localhost:${PORT}/`));
