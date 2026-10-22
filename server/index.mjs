import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const personas = [
  { id: 'atlas', name: 'Atlas', role: 'Lead orchestrator' },
  { id: 'nova', name: 'Nova', role: 'Research agent' },
  { id: 'pixel', name: 'Pixel', role: 'Developer agent' },
  { id: 'quill', name: 'Quill', role: 'Content agent' },
  { id: 'sage', name: 'Sage', role: 'Analyst agent' },
  { id: 'echo', name: 'Echo', role: 'Support agent' },
];

export function createOfficeServer(config) {
  if (!config.password || config.password.length < 16) throw new Error('OFFICE_PASSWORD minimal 16 karakter.');
  if (!config.hermesKey) throw new Error('HERMES_API_KEY wajib diisi di server.');
  const hermes = new URL(config.hermesUrl || 'http://127.0.0.1:8642');
  if (!['http:', 'https:'].includes(hermes.protocol) || hermes.username || hermes.password) throw new Error('HERMES_API_URL tidak valid.');
  hermes.pathname = hermes.pathname.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const base = hermes.href.replace(/\/$/, '');
  const origins = new Set(config.origins || ['https://rage.ai.id']);
  const dbPath = config.dbPath || resolve('data/office.sqlite');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, agent TEXT NOT NULL, prompt TEXT NOT NULL,
      status TEXT NOT NULL, result TEXT, error TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
  // Do not resend a job with an unknown upstream outcome after a process restart.
  db.prepare("UPDATE tasks SET status='interrupted', error=?, updated=? WHERE status='running'")
    .run('Backend restart saat tugas berjalan. Hasil Hermes belum dapat dipastikan; tugas tidak dikirim ulang otomatis.', Date.now());
  const salt = randomBytes(16), passwordHash = scryptSync(config.password, salt, 32);
  const digest = token => createHash('sha256').update(token).digest('hex');
  let running = false, closing = false, activeController;
  const attempts = new Map();
  const cookieName = config.secureCookies === false ? 'office_session' : '__Host-office_session';
  const cookie = (token, age = 43200) => `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${config.secureCookies === false ? '' : '; Secure'}`;
  function sessionToken(req) {
    const value = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='));
    return value?.slice(cookieName.length + 1) || '';
  }
  function authenticated(req) {
    const token = sessionToken(req);
    return token && db.prepare('SELECT hash FROM sessions WHERE hash=? AND expires>?').get(digest(token), Date.now());
  }
  function send(res, status, data, headers = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
    res.end(JSON.stringify(data));
  }
  async function body(req) {
    let value = '';
    for await (const chunk of req) {
      value += chunk.toString();
      if (Buffer.byteLength(value) > 32768) throw Object.assign(new Error('Permintaan terlalu besar.'), { status: 413 });
    }
    try { return JSON.parse(value); } catch { throw Object.assign(new Error('JSON tidak valid.'), { status: 400 }); }
  }
  async function readiness() {
    try {
      const res = await fetch(base + '/health', { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      return res.ok && ['ok', 'healthy'].includes(data.status);
    } catch { return false; }
  }
  async function pump() {
    if (running || closing) return;
    const job = db.prepare("SELECT * FROM tasks WHERE status='queued' ORDER BY created, rowid LIMIT 1").get();
    if (!job) return;
    running = true;
    db.prepare("UPDATE tasks SET status='running',updated=? WHERE id=?").run(Date.now(), job.id);
    const persona = personas.find(a => a.id === job.agent);
    activeController = new AbortController();
    const timeout = setTimeout(() => activeController?.abort(), config.taskTimeout || 1800000);
    try {
      const response = await fetch(base + '/v1/chat/completions', {
        method: 'POST', signal: activeController.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.hermesKey}`, 'Idempotency-Key': job.id },
        body: JSON.stringify({ model: config.model || 'hermes-agent', stream: false,
          messages: [{ role: 'system', content: `You are ${persona.name}, the ${persona.role} persona in the owner's AI office. Work on the owner's task using the available Hermes tools. Report the actual outcome and any limitations. Respond in the user's language. Do not claim to have delegated work to other office personas unless you actually did so.` }, { role: 'user', content: job.prompt }] }),
      });
      if (!response.ok) throw new Error(`Hermes mengembalikan HTTP ${response.status}. Periksa konfigurasi API di AWS.`);
      const data = await response.json();
      const choice = data.choices?.[0];
      if (choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) {
        throw new Error('Hermes tidak mengembalikan jawaban final sukses. Periksa hasil di Hermes sebelum mengulang tugas.');
      }
      db.prepare("UPDATE tasks SET status='completed',result=?,updated=? WHERE id=?")
        .run(choice.message.content.slice(0, 200000), Date.now(), job.id);
    } catch (error) {
      const status = closing || error.name === 'AbortError' ? 'interrupted' : 'failed';
      const message = activeController.signal.aborted ? 'Koneksi tugas terputus atau timeout. Hermes mungkin masih bekerja; periksa sebelum mengulang.' : error.message.startsWith('Hermes ') ? error.message : 'Tidak dapat membaca hasil Hermes. Periksa layanan AWS sebelum mengulang tugas.';
      db.prepare('UPDATE tasks SET status=?,error=?,updated=? WHERE id=?').run(status, message, Date.now(), job.id);
    } finally {
      clearTimeout(timeout); activeController = undefined; running = false;
      if (!closing) setImmediate(pump);
    }
  }
  const server = createServer(async (req, res) => {
    try {
      const origin = req.headers.origin;
      if (origin && !origins.has(origin)) return send(res, 403, { error: 'Origin tidak diizinkan.' });
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
        return res.end();
      }
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && path === '/health') return send(res, 200, { status: 'ok', service: 'hermes-office', version: 1 });
      // Require JSON on writes: prevents cross-site form submissions even without cookies' SameSite policy.
      if (req.method === 'POST' && !(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'Gunakan application/json.' });
      if (req.method === 'POST' && path === '/auth/login') {
        const ip = req.socket.remoteAddress || 'unknown', now = Date.now();
        for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
        const entry = attempts.get(ip) || { count: 0, until: now + 900000 };
        if (entry.count >= 10) return send(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });
        const data = await body(req);
        const candidate = typeof data.password === 'string' && data.password.length <= 1024 ? data.password : '';
        if (!timingSafeEqual(passwordHash, scryptSync(candidate, salt, 32))) {
          entry.count++; attempts.set(ip, entry);
          return send(res, 401, { error: 'Password kantor tidak sesuai.' });
        }
        attempts.delete(ip);
        db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
        const previous = sessionToken(req);
        if (previous) db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(previous));
        const token = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions VALUES (?,?)').run(digest(token), now + 43200000);
        return send(res, 200, { authenticated: true }, { 'Set-Cookie': cookie(token) });
      }
      if (!authenticated(req)) return send(res, 401, { error: 'Silakan masuk melalui Settings kantor.' });
      if (req.method === 'POST' && path === '/auth/logout') {
        db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(sessionToken(req)));
        return send(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
      }
      if (req.method === 'GET' && path === '/state') {
        const tasks = db.prepare('SELECT * FROM tasks ORDER BY created DESC, rowid DESC LIMIT 100').all();
        const agents = personas.map(agent => {
          const active = tasks.find(t => t.agent === agent.id && ['queued', 'running'].includes(t.status));
          const last = active || tasks.find(t => t.agent === agent.id);
          return { ...agent, status: active ? 'working' : 'idle', task: active?.prompt || 'Siap untuk tugas berikutnya', lastTask: last || null };
        });
        return send(res, 200, { agents, tasks, completed: db.prepare("SELECT count(*) AS count FROM tasks WHERE status='completed'").get().count, hermesReady: await readiness(), execution: 'personas-single-hermes' });
      }
      if (req.method === 'POST' && path === '/tasks') {
        const data = await body(req);
        if (!personas.some(a => a.id === data.agentId) || typeof data.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 12000 || typeof data.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId)) return send(res, 400, { error: 'Agent, tugas (maksimal 12.000 karakter), atau request ID tidak valid.' });
        const existing = db.prepare('SELECT * FROM tasks WHERE id=?').get(data.requestId);
        if (existing) {
          if (existing.agent !== data.agentId || existing.prompt !== data.prompt.trim()) return send(res, 409, { error: 'Request ID sudah dipakai untuk tugas lain.' });
          return send(res, 200, { task: existing });
        }
        const pending = db.prepare("SELECT count(*) AS count FROM tasks WHERE status IN ('queued','running')").get().count;
        if (pending >= 100) return send(res, 429, { error: 'Antrean penuh. Tunggu tugas selesai.' });
        if (!await readiness()) return send(res, 503, { error: 'Hermes belum dapat dijangkau dari backend AWS.' });
        const now = Date.now(), id = data.requestId || randomUUID();
        db.prepare('INSERT INTO tasks (id,agent,prompt,status,created,updated) VALUES (?,?,?,\'queued\',?,?)').run(id, data.agentId, data.prompt.trim(), now, now);
        send(res, 202, { task: db.prepare('SELECT * FROM tasks WHERE id=?').get(id) });
        setImmediate(pump); return;
      }
      send(res, 404, { error: 'Endpoint tidak ditemukan.' });
    } catch (error) {
      if (!res.headersSent) send(res, error.status || 500, { error: error.status ? error.message : 'Terjadi kesalahan pada backend kantor.' });
      else res.end();
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  setImmediate(pump);
  return { server, db, async close() {
    closing = true; activeController?.abort();
    await new Promise(resolve => server.close(resolve));
    while (running) await new Promise(resolve => setTimeout(resolve, 10));
    db.close();
  } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const office = createOfficeServer({
    password: process.env.OFFICE_PASSWORD, hermesKey: process.env.HERMES_API_KEY,
    hermesUrl: process.env.HERMES_API_URL, model: process.env.HERMES_MODEL,
    origins: (process.env.OFFICE_ORIGINS || 'https://rage.ai.id').split(',').map(v => v.trim()),
    dbPath: process.env.OFFICE_DB_PATH, secureCookies: process.env.OFFICE_COOKIE_SECURE !== 'false',
    taskTimeout: Number(process.env.OFFICE_TASK_TIMEOUT_MS) || 1800000,
  });
  office.server.listen(Number(process.env.PORT) || 8787, process.env.HOST || '127.0.0.1', () => console.log('Hermes Office backend siap.'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await office.close(); process.exit(0); });
}
