import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOfficeServer } from './index.mjs';
import {readHermesResponse} from './hermes-response.mjs';
import {deskPosition,officeObstacles,findOfficePath,leisureSpots} from '../shared/office-layout.js';
import {createConnections} from './connections.mjs';
import {DatabaseSync} from 'node:sqlite';
import {createRuntimeCatalog} from './runtime-catalog.mjs';

test('AWS office authentication, queue, Hermes outcomes, and persistence', async t => {
  const password = randomBytes(24).toString('hex'), token = randomBytes(24).toString('hex');
  let calls = 0, health = true, finish = 'stop', release, reply;
  const received = [];
  const hermes = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') { res.writeHead(health ? 200 : 503); res.end(JSON.stringify({ status: health ? 'ok' : 'down' })); return; }
    assert.equal(req.headers.authorization, `Bearer ${token}`);
    let body = ''; for await (const chunk of req) body += chunk;
    received.push(JSON.parse(body)); calls++;
    if (release) await new Promise(resolve => { release.resolve = resolve; });
    res.end(JSON.stringify({ choices: [{ finish_reason: finish, message: { content: reply?reply(JSON.parse(body)):'Hasil uji Hermes' } }] }));
  });
  await new Promise(resolve => hermes.listen(0, '127.0.0.1', resolve));
  const dbPath = join(mkdtempSync(join(tmpdir(), 'office-test-')), 'office.sqlite');
  const config = { password, hermesKey: token, hermesUrl: `http://127.0.0.1:${hermes.address().port}`, dbPath, stream:false, secureCookies: false, origins: ['https://rage.ai.id'] };
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
    office.db.prepare('INSERT INTO workflows (id,title,prompt,agents,created) VALUES (?,?,?,?,?)').run(id,'Recovery','Test',JSON.stringify(['atlas','echo']),now);
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
  await t.test('new subagents persist and receive direct tasks',async()=>{
    const state=await(await request('/state')).json();const agents=[...state.agents,{id:'orbit-seo',name:'Orbit',role:'SEO specialist',specialty:'On-page SEO audit',skills:['seo-audit'],permissions:[],instructions:'Audit SEO with evidence; state missing data.',enabled:true,color:'#a4bad5'}];
    assert.equal((await request('/settings',{revision:state.revision,settings:state.settings,agents})).status,200);
    const id=randomUUID();assert.equal((await request('/tasks',{requestId:id,agentId:'orbit-seo',prompt:'Audit page titles'})).status,202);await waitTask(id,'completed');assert.match(received.at(-1).messages[0].content,/seo-audit/);
  });
  await t.test('team lead plans against declared skills, delegates, then returns a final report',async()=>{
    const before=calls,id=randomUUID();reply=data=>data.messages[0].content.includes('Decompose the owner')?JSON.stringify({steps:[{agentId:'orbit-seo',skill:'seo-audit',task:'Audit page titles in the supplied brief',expectedOutput:'SEO issues and evidence'}]}):data.messages[1].content.includes('Prepare the final owner report')?'Final lead report: SEO audit completed with stated limitations.':'SEO issues: duplicate page titles. Evidence supplied.';
    const payload={requestId:id,prompt:'Review SEO of the supplied titles',title:'Lead managed SEO'};
    assert.equal((await request('/lead',payload,false)).status,401);assert.equal((await request('/lead',payload)).status,202);assert.equal((await request('/lead',payload)).status,200);
    const until=Date.now()+5000;let final;
    while(Date.now()<until){final=office.db.prepare("SELECT * FROM tasks WHERE workflow=? AND kind='report'").get(id);if(final?.status==='completed')break;await new Promise(r=>setTimeout(r,20));}
    assert.equal(final?.status,'completed');assert.match(final.result,/Final lead report/);assert.equal(calls,before+3);
    const steps=office.db.prepare('SELECT * FROM tasks WHERE workflow=? ORDER BY position').all(id);assert.deepEqual(steps.map(s=>s.kind),['plan','work','report']);assert.equal(steps[1].agent,'orbit-seo');assert.equal(steps[1].skill,'seo-audit');
    const state=await(await request('/state')).json();assert.ok(state.events.some(e=>e.type==='delegation'&&e.target==='orbit-seo'));assert.equal(state.workflows.find(w=>w.id===id).finalReport.status,'completed');assert.match(received.at(-1).messages[1].content,/duplicate page titles/);reply=null;
  });
  await t.test('lead rejects invented skills and does not enqueue arbitrary subagent work',async()=>{
    reply=()=>JSON.stringify({steps:[{agentId:'orbit-seo',skill:'send-money',task:'Transfer funds',expectedOutput:'receipt'}]});const id=randomUUID(),before=calls;
    assert.equal((await request('/lead',{requestId:id,prompt:'An out-of-scope job'})).status,202);
    let first;const until=Date.now()+4000;while(Date.now()<until){first=office.db.prepare('SELECT * FROM tasks WHERE workflow=?').get(id);if(first?.status==='failed')break;await new Promise(r=>setTimeout(r,20));}
    assert.equal(first.status,'failed');assert.equal(office.db.prepare('SELECT count(*) AS n FROM tasks WHERE workflow=?').get(id).n,1);assert.equal(calls,before+1);reply=null;
  });
  await t.test('account menu reports missing setup and refuses account use without connection',async()=>{
    const state=await(await request('/state')).json();assert.equal(state.connections.length,4);assert.equal(state.connections.every(c=>!c.connected),true);
    assert.equal((await request('/connections/gmail/start',{})).status,409);
    assert.equal((await request('/lead',{requestId:randomUUID(),prompt:'Read inbox',accounts:['gmail']})).status,409);
    assert.equal((await request('/connections/gmail/preview',{},false)).status,401);
  });
});

test('campus paths reach all rooms and return home without crossing furniture or walls',()=>{
 const obstacles=officeObstacles(18);
 for(let i=0;i<18;i++){const p=deskPosition(i),home={x:p.x,z:p.z+1.05};for(const target of leisureSpots){const path=findOfficePath(home,target,obstacles);assert.ok(path.length>0,`Agent ${i} cannot reach ${target.room}`);for(const point of path)assert.equal(obstacles.some(o=>Math.abs(point.x-o.x)<o.w/2+.23&&Math.abs(point.z-o.z)<o.d/2+.23),false);assert.ok(findOfficePath(target,home,obstacles).length>0);}}
});

test('Hermes SSE parser exposes public output/tool names and discards private reasoning',async()=>{
 const text='data: '+JSON.stringify({choices:[{delta:{reasoning_content:'private reasoning must not be emitted'}}]})+'\r\n\r\nevent: hermes.tool.progress\r\ndata: '+JSON.stringify({tool_name:'web_search',arguments:{secret:'hidden'}})+'\r\n\r\ndata: '+JSON.stringify({choices:[{delta:{content:'Public result'}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
 const bytes=new TextEncoder().encode(text);const body=new ReadableStream({start(c){c.enqueue(bytes.slice(0,43));c.enqueue(bytes.slice(43,113));c.enqueue(bytes.slice(113));c.close();}});const progress=[];const result=await readHermesResponse(new Response(body,{headers:{'Content-Type':'text/event-stream'}}),p=>progress.push(p));assert.equal(result.choices[0].message.content,'Public result');assert.equal(result.choices[0].finish_reason,'stop');assert.match(JSON.stringify(progress),/web_search/);assert.doesNotMatch(JSON.stringify(progress),/private reasoning|arguments|hidden/);
});

test('OAuth binds callback to session, encrypts tokens, and does not expose them in status',async()=>{
 const db=new DatabaseSync(':memory:'),access=randomBytes(16).toString('hex');let requests=[];
 const vault=createConnections(db,{env:{OFFICE_VAULT_KEY:randomBytes(32).toString('hex'),OFFICE_PUBLIC_URL:'http://localhost:8787',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'},fetch:async(url,init)=>{requests.push(String(url));return new Response(JSON.stringify({access_token:access,refresh_token:'local-test-refresh',expires_in:3600}),{headers:{'Content-Type':'application/json'}});}});
 const start=vault.start('gmail','session-a'),state=new URL(start.url).searchParams.get('state');assert.equal(new URL(start.url).hostname,'accounts.google.com');assert.ok(new URL(start.url).searchParams.get('code_challenge'));
 await assert.rejects(()=>vault.complete('gmail',new URLSearchParams({state,code:'local-test-code'}),'session-b'),/Sesi OAuth/);assert.equal(requests.length,0);
 await vault.complete('gmail',new URLSearchParams({state,code:'local-test-code'}),'session-a');assert.equal(vault.summary().find(c=>c.provider==='gmail').connected,true);
 const row=db.prepare('SELECT * FROM account_connections').get();assert.equal(row.cipher.includes(access),false);assert.equal(JSON.stringify(vault.summary()).includes(access),false);await assert.rejects(()=>vault.complete('gmail',new URLSearchParams({state,code:'replay'}),'session-a'),/Sesi OAuth/);vault.disconnect('gmail');assert.equal(vault.summary().find(c=>c.provider==='gmail').connected,false);db.close();
});

test('runtime catalog keeps skills failure explicit while reporting verified toolsets',async()=>{
 let calls=0;const catalog=createRuntimeCatalog('https://runtime.example','local-test-token',async url=>{calls++;return url.endsWith('/skills')?new Response('{}',{status:500}):new Response(JSON.stringify({data:[{name:'core',enabled:true,configured:true,tools:['read_file'],secret:'must-not-leak'}]}),{headers:{'Content-Type':'application/json'}});});
 const result=await catalog.load();assert.deepEqual(result.skills,[]);assert.deepEqual(result.errors,['skills: HTTP 500']);assert.equal(result.toolsets[0].name,'core');assert.equal(result.toolsets[0].enabled,true);assert.equal(JSON.stringify(result).includes('must-not-leak'),false);await catalog.load();assert.equal(calls,2);
});

test('revoking account permission stops queued data access before any account content is read',async t=>{
 const password=randomBytes(24).toString('hex');let accountReads=0;
 const hermes=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/health'){res.end('{"status":"ok"}');return;}for await(const c of req){}res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({steps:[{agentId:'nova',skill:'research',task:'Summarize the permitted inbox snapshot',expectedOutput:'Inbox summary'}]})}}]}));});
 await new Promise(r=>hermes.listen(0,'127.0.0.1',r));
 const office=createOfficeServer({password,hermesKey:'local-only',hermesUrl:`http://127.0.0.1:${hermes.address().port}`,dbPath:':memory:',stream:false,secureCookies:false,integrations:{env:{OFFICE_VAULT_KEY:randomBytes(32).toString('hex'),OFFICE_PUBLIC_URL:'http://localhost:8787',GOOGLE_CLIENT_ID:'local-client',GOOGLE_CLIENT_SECRET:'local-secret'},fetch:async url=>{if(String(url).includes('/messages'))accountReads++;return new Response(JSON.stringify(String(url).includes('/profile')?{emailAddress:'test@example.invalid'}:{access_token:'local-account-token',refresh_token:'local-refresh',expires_in:3600}),{headers:{'Content-Type':'application/json'}});}}});
 await new Promise(r=>office.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${office.server.address().port}`;let cookie;
 const post=async(path,data)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
 t.after(async()=>{await office.close();await new Promise(r=>hermes.close(r));});
 const login=await post('/auth/login',{password});cookie=login.headers.get('set-cookie').split(';')[0];
 const start=await(await post('/connections/gmail/start',{})).json(),state=new URL(start.url).searchParams.get('state');
 assert.equal((await fetch(base+'/connections/callback/gmail?'+new URLSearchParams({state,code:'local-test-code'}),{headers:{Cookie:cookie}})).status,200);
 let data=await(await fetch(base+'/state',{headers:{Cookie:cookie}})).json();
 let saved=await(await post('/settings',{revision:data.revision,settings:{...data.settings,paused:true},agents:data.agents.map(a=>({...a,permissions:a.id==='nova'?['gmail']:[]}))})).json();
 const id=randomUUID();assert.equal((await post('/lead',{requestId:id,prompt:'Summarize my permitted inbox',accounts:['gmail']})).status,202);
 assert.equal((await post('/settings',{...saved,settings:{...saved.settings,paused:false},agents:saved.agents.map(a=>({...a,permissions:[]}))})).status,200);
 const until=Date.now()+4000;let worker;while(Date.now()<until){worker=office.db.prepare("SELECT * FROM tasks WHERE workflow=? AND kind='work'").get(id);if(worker?.status==='failed')break;await new Promise(r=>setTimeout(r,20));}
 assert.equal(worker?.status,'failed');assert.match(worker.error,/dicabut/);assert.equal(accountReads,0);
});
