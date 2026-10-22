import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOfficeServer } from './index.mjs';

test('AWS office authentication, queue, Hermes outcomes, and persistence', async t => {
  const password = randomBytes(24).toString('hex'), token = randomBytes(24).toString('hex');
  let calls = 0, health = true, finish = 'stop', release;
  const received = [];
  const hermes = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') { res.writeHead(health ? 200 : 503); res.end(JSON.stringify({ status: health ? 'ok' : 'down' })); return; }
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    let body = ''; for await (const chunk of req) body += chunk;
    received.push(JSON.parse(body)); calls++;
    if (release) await new Promise(resolve => { release.resolve = resolve; });
    res.end(JSON.stringify({ choices: [{ finish_reason: finish, message: { content: 'Hasil uji Hermes' } }] }));
  });
  await new Promise(resolve => hermes.listen(0, '127.0.0.1', resolve));
  const dbPath = join(mkdtempSync(join(tmpdir(), 'office-test-')), 'office.sqlite');
  const config = { password, hermesKey: token, hermesUrl: `http://127.0.0.1:${hermes.address().port}`, dbPath, secureCookies: false, origins: ['https://rage.ai.id'] };
  let office = createOfficeServer(config);
  await new Promise(resolve => office.server.listen(0, '127.0.0.1', resolve));
  let base = `http://127.0.0.1:${office.server.address().port}`, cookie = '';
  async function request(path, data, auth = true, origin = 'https://rage.ai.id') {
    return fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers: { Origin: origin, ...(auth && cookie ? { Cookie: cookie } : {}), ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  }
  async function waitTask(id, status) {
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      const task = office.db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
      if (task?.status === status) return task;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail(`Task did not reach ${status}`);
  }
  t.after(async () => { if (release?.resolve) release.resolve(); await office.close(); await new Promise(resolve => hermes.close(resolve)); });

  await t.test('public health is distinct from Hermes and state requires login', async () => {
    assert.equal((await (await request('/health')).json()).service, 'hermes-office');
    assert.equal((await request('/state', undefined, false)).status, 401);
    assert.equal((await request('/health', undefined, false, 'https://untrusted.example')).status, 403);
    assert.equal((await request('/auth/login', { password: 'wrong' }, false)).status, 401);
    const login = await request('/auth/login', { password }, false);
    assert.equal(login.status, 200); cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    const state = await request('/state');
    assert.equal(state.headers.get('access-control-allow-origin'), 'https://rage.ai.id');
    const data = await state.json(); assert.equal(data.agents.length, 6); assert.equal(data.hermesReady, true);
    assert.equal(JSON.stringify(data).includes(token), false);
  });
  let savedId;
  await t.test('a queued task survives browser disconnect and duplicate requests do not execute twice', async () => {
    savedId = randomUUID(); const payload = { requestId: savedId, agentId: 'pixel', prompt: 'Kerjakan tugas uji' };
    const response = await request('/tasks', payload); assert.equal(response.status, 202);
    await waitTask(savedId, 'completed');
    assert.equal((await request('/tasks', payload)).status, 200);
    assert.equal(calls, 1); assert.equal(received[0].stream, false); assert.equal(received[0].messages[1].content, payload.prompt);
    const state = await (await request('/state')).json(); assert.equal(state.completed, 1);
    assert.equal(state.tasks[0].result, 'Hasil uji Hermes');
    assert.equal((await request('/tasks', { ...payload, prompt: 'Berbeda' })).status, 409);
  });
  await t.test('failed completion semantics are never shown as successful', async () => {
    finish = 'error'; const id = randomUUID();
    assert.equal((await request('/tasks', { requestId: id, agentId: 'nova', prompt: 'Uji kegagalan' })).status, 202);
    const task = await waitTask(id, 'failed'); assert.equal(task.result, null); assert.match(task.error, /bukan|tidak/);
    assert.equal((await (await request('/state')).json()).completed, 1);
    finish = 'stop';
  });
  await t.test('unreachable Hermes rejects new jobs without adding work', async () => {
    health = false;
    assert.equal((await request('/tasks', { requestId: randomUUID(), agentId: 'atlas', prompt: 'Tidak dikirim' })).status, 503);
    assert.equal((await (await request('/state')).json()).hermesReady, false);
    health = true;
  });
  await t.test('database and sessions survive restart; interrupted work is not resent', async () => {
    const interruptedId = randomUUID();
    office.db.prepare('INSERT INTO tasks (id,agent,prompt,status,created,updated) VALUES (?,?,?,?,?,?)').run(interruptedId, 'atlas', 'Unknown outcome', 'running', Date.now(), Date.now());
    await office.close(); office = createOfficeServer(config);
    await new Promise(resolve => office.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${office.server.address().port}`;
    const state = await (await request('/state')).json(); assert.equal(state.completed, 1);
    assert.equal(state.tasks.find(task => task.id === savedId).result, 'Hasil uji Hermes');
    assert.equal(state.tasks.find(task => task.id === interruptedId).status, 'interrupted');
    assert.equal(calls, 2);
    assert.equal((await request('/auth/logout', {})).status, 200);
    assert.equal((await request('/state')).status, 401);
  });
});
