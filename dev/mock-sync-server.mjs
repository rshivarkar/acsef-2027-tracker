// Local stand-in for apps-script/Code.gs, for testing team sync without Google.
// Same request/response protocol, data kept in memory.
//   node dev/mock-sync-server.mjs            -> http://127.0.0.1:8787/  passcode "local-test"
//   PORT=9000 PASSCODE=abc DELAY=1500 node dev/mock-sync-server.mjs
import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const PASSCODE = process.env.PASSCODE || 'local-test';
const DELAY = Number(process.env.DELAY || 0); // ms, to make conflicts easy to reproduce

let revision = 0;
let state = null;
let updatedAt = 0;
let updatedBy = '';

const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

function handle(req) {
  if (!req || typeof req !== 'object') return { ok: false, error: 'bad_request' };
  if (req.passcode !== PASSCODE) return { ok: false, error: 'bad_passcode' };
  if (req.action === 'get') return { ok: true, revision, updatedAt, updatedBy, state };
  if (req.action === 'put') {
    if (!req.state || !Array.isArray(req.state.tasks)) return { ok: false, error: 'bad_request' };
    if (!req.force && req.baseRevision !== revision) {
      return { ok: false, error: 'conflict', revision, updatedAt, updatedBy, state };
    }
    revision += 1;
    state = req.state;
    updatedAt = Date.now();
    updatedBy = String(req.by || '').slice(0, 40);
    return { ok: true, revision };
  }
  return { ok: false, error: 'bad_request' };
}

http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true, service: 'acsef-tracker-sync (mock)', revision }));
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, headers);
    res.end('{}');
    return;
  }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const out = handle(parsed);
    setTimeout(() => {
      res.writeHead(200, headers);
      res.end(JSON.stringify(out));
    }, DELAY);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Mock sync server on http://127.0.0.1:${PORT}/ (passcode "${PASSCODE}")`);
});
