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
  await t.test('role settings persist, paused queue waits, and role instructions are used', async () => {
    const login=await request('/auth/login',{password},false);cookie=login.headers.get('set-cookie').split(';')[0];
    const state=await (await request('/state')).json();
    const config={revision:state.revision,settings:{...state.settings,paused:true,language:'en',focus:'Test shared office objective'},agents:state.agents.map(a=>({...a,instructions:a.id==='pixel'?'Verify and explain the implementation carefully.':a.instructions,enabled:a.id!=='echo'}))};
    assert.equal((await request('/settings',config,false)).status,401);
    const save=await request('/settings',config);assert.equal(save.status,200);let saved=await save.json();
    assert.equal(saved.revision,state.revision+1);
    assert.equal((await request('/settings',config)).status,409);
    assert.equal((await request('/tasks',{requestId:randomUUID(),agentId:'echo',prompt:'Disabled role'})).status,409);
    const before=calls,id=randomUUID();
    assert.equal((await request('/tasks',{requestId:id,agentId:'pixel',prompt:'Pause test'})).status,202);
    await new Promise(resolve=>setTimeout(resolve,80));
    assert.equal(calls,before);assert.equal(office.db.prepare('SELECT status FROM tasks WHERE id=?').get(id).status,'queued');
    saved.settings.paused=false;saved.agents=saved.agents.map(a=>({...a,enabled:true}));
    assert.equal((await request('/settings',saved)).status,200);
    await waitTask(id,'completed');
    assert.match(received.at(-1).messages[0].content,/Verify and explain/);
    assert.match(received.at(-1).messages[0].content,/English/);
    assert.match(received.at(-1).messages[0].content,/Test shared office objective/);
  });
  await t.test('team missions execute sequentially and hand off the previous result', async () => {
    const before=calls, id=randomUUID(),payload={requestId:id,title:'Team handoff',prompt:'Prepare a test plan',agentIds:['atlas','nova','echo']};
    const create=await request('/workflows',payload);assert.equal(create.status,202);
    assert.equal((await request('/workflows',payload)).status,200);
    const steps=office.db.prepare('SELECT * FROM tasks WHERE workflow=? ORDER BY position').all(id);
    assert.equal(steps.length,3);
    await waitTask(steps[2].id,'completed');assert.equal(calls,before+3);
    assert.equal(received[before].messages[1].content,'Prepare a test plan');
    assert.match(received[before+1].messages[1].content,/HANDOFF FROM PREVIOUS TEAM STEP/);
    assert.match(received[before+1].messages[1].content,/Hasil uji Hermes/);
    const state=await (await request('/state')).json();
    assert.equal(state.workflows.find(w=>w.id===id).steps.filter(s=>s.status==='completed').length,3);
    assert.equal((await request('/workflows',{...payload,prompt:'Conflicting request'})).status,409);
    assert.equal((await request('/workflows',{...payload,requestId:randomUUID(),agentIds:['atlas','atlas']})).status,400);
  });
  await t.test('mission failure blocks remaining roles without running them', async () => {
    finish='error';const before=calls,id=randomUUID();
    assert.equal((await request('/workflows',{requestId:id,title:'Stop on failure',prompt:'Test stop',agentIds:['atlas','pixel','echo']})).status,202);
    const steps=office.db.prepare('SELECT * FROM tasks WHERE workflow=? ORDER BY position').all(id);
    await waitTask(steps[0].id,'failed');await waitTask(steps[2].id,'blocked');
    assert.equal(calls,before+1);finish='stop';
  });
  await t.test('settings survive restart and queued dependents of interrupted jobs are blocked', async () => {
    const id=randomUUID(),first=randomUUID(),second=randomUUID(),now=Date.now();
    office.db.prepare('INSERT INTO workflows VALUES (?,?,?,?,?)').run(id,'Recovery','Test',JSON.stringify(['atlas','echo']),now);
    office.db.prepare('INSERT INTO tasks (id,agent,prompt,status,created,updated,workflow,position) VALUES (?,?,?,?,?,?,?,?)').run(first,'atlas','Test','running',now,now,id,0);
    office.db.prepare('INSERT INTO tasks (id,agent,prompt,status,created,updated,workflow,position,previous) VALUES (?,?,?,?,?,?,?,?,?)').run(second,'echo','Test','queued',now,now,id,1,first);
    const before=calls;
    await office.close();office=createOfficeServer(config);
    await new Promise(resolve=>office.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${office.server.address().port}`;
    const state=await (await request('/state')).json();
    assert.equal(state.settings.focus,'Test shared office objective');
    assert.equal(state.agents.find(a=>a.id==='pixel').instructions,'Verify and explain the implementation carefully.');
    assert.equal(office.db.prepare('SELECT status FROM tasks WHERE id=?').get(second).status,'blocked');assert.equal(calls,before);
  });
});
