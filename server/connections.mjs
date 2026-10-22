import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

export const accountProviders = ['gmail','calendar','notion','github'];
export function createConnections(db,options={}){
 const env=options.env||process.env,http=options.fetch||fetch;
 const raw=env.OFFICE_VAULT_KEY||'',key=/^[0-9a-f]{64}$/i.test(raw)?Buffer.from(raw,'hex'):null;
 const base=env.OFFICE_PUBLIC_URL||'http://localhost:8787';
 const publicUrl=new URL(base);
 if(publicUrl.username||publicUrl.password||publicUrl.search||publicUrl.hash||!['http:','https:'].includes(publicUrl.protocol)||(publicUrl.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(publicUrl.hostname)))throw Error('OFFICE_PUBLIC_URL harus HTTPS atau localhost.');
 db.exec('CREATE TABLE IF NOT EXISTS account_connections (provider TEXT PRIMARY KEY,cipher TEXT NOT NULL,label TEXT NOT NULL,updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS oauth_states (hash TEXT PRIMARY KEY,provider TEXT NOT NULL,session TEXT NOT NULL,verifier TEXT NOT NULL,expires INTEGER NOT NULL)');
 const hash=v=>createHash('sha256').update(v).digest('hex');
 function encrypt(value){if(!key)throw Error('OFFICE_VAULT_KEY belum diatur.');const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');}
 function decrypt(value){if(!key)throw Error('Vault key tidak tersedia.');const b=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8'));}
 function client(provider){return provider==='gmail'||provider==='calendar'?{id:env.GOOGLE_CLIENT_ID,secret:env.GOOGLE_CLIENT_SECRET}:provider==='github'?{id:env.GITHUB_CLIENT_ID,secret:env.GITHUB_CLIENT_SECRET}:{id:env.NOTION_CLIENT_ID,secret:env.NOTION_CLIENT_SECRET};}
 const callback=p=>new URL(`/connections/callback/${p}`,publicUrl).href;
 const scope=p=>p==='gmail'?'https://www.googleapis.com/auth/gmail.readonly':p==='calendar'?'https://www.googleapis.com/auth/calendar.readonly':p==='github'?'read:user':'';
 function summary(){return accountProviders.map(provider=>{const c=client(provider),row=db.prepare('SELECT provider,label,updated FROM account_connections WHERE provider=?').get(provider);return {provider,configured:Boolean(key&&c.id&&c.secret),connected:Boolean(row&&key),label:row?.label||null,updated:row?.updated||null,callback:callback(provider),access:provider==='github'?'Public profile & public repositories · read-only':provider==='notion'?'Selected workspace pages · read-only':'Read-only',setup:!key?'OFFICE_VAULT_KEY belum diatur':!c.id||!c.secret?'OAuth client belum diatur':null};});}
 function start(provider,session){
  if(!accountProviders.includes(provider))throw Object.assign(Error('Provider tidak dikenal.'),{status:400});
  const c=client(provider);if(!key||!c.id||!c.secret)throw Object.assign(Error('Atur vault key dan OAuth client di backend dahulu. Lihat docs/ACCOUNTS.md.'),{status:409});
  db.prepare('DELETE FROM oauth_states WHERE expires<?').run(Date.now());
  const state=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO oauth_states VALUES (?,?,?,?,?)').run(hash(state),provider,session,verifier,Date.now()+600000);
  const url=new URL(provider==='github'?'https://github.com/login/oauth/authorize':provider==='notion'?'https://api.notion.com/v1/oauth/authorize':'https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v]of Object.entries({client_id:c.id,redirect_uri:callback(provider),response_type:'code',state}))url.searchParams.set(k,v);
  if(provider!=='notion'){url.searchParams.set('scope',scope(provider));url.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));url.searchParams.set('code_challenge_method','S256');}
  if(provider==='gmail'||provider==='calendar'){url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');}
  if(provider==='notion')url.searchParams.set('owner','user');
  return {url:url.href};
 }
 async function json(url,init){const r=await http(url,{...init,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Provider menolak permintaan (HTTP '+r.status+'). Hubungkan ulang akun bila sesi kedaluwarsa.');const data=await r.json();if(data.error)throw Error('Provider menolak otorisasi akun.');return data;}
 function save(provider,tokens,label){db.prepare('INSERT INTO account_connections VALUES (?,?,?,?) ON CONFLICT(provider) DO UPDATE SET cipher=excluded.cipher,label=excluded.label,updated=excluded.updated').run(provider,encrypt(tokens),label,Date.now());}
 async function exchange(provider,values){const c=client(provider),notion=provider==='notion';return json(provider==='github'?'https://github.com/login/oauth/access_token':notion?'https://api.notion.com/v1/oauth/token':'https://oauth2.googleapis.com/token',{method:'POST',headers:notion?{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(c.id+':'+c.secret).toString('base64')}:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:notion?JSON.stringify(values):new URLSearchParams({...values,client_id:c.id,client_secret:c.secret}).toString()});}
 async function complete(provider,params,session){
  if(!accountProviders.includes(provider)||!params.get('state'))throw Object.assign(Error('OAuth callback tidak valid.'),{status:400});
  const id=hash(params.get('state')),state=db.prepare('SELECT * FROM oauth_states WHERE hash=?').get(id);
  if(!state||state.provider!==provider||state.session!==session||state.expires<Date.now())throw Object.assign(Error('Sesi OAuth tidak cocok atau kedaluwarsa. Mulai koneksi ulang dari menu Akun.'),{status:400});
  db.prepare('DELETE FROM oauth_states WHERE hash=?').run(id);
  if(params.has('error')||!params.get('code'))throw Object.assign(Error('Otorisasi akun dibatalkan atau kode tidak tersedia.'),{status:400});
  const tokens=await exchange(provider,{grant_type:'authorization_code',code:params.get('code'),redirect_uri:callback(provider),...(provider==='notion'?{}:{code_verifier:state.verifier})});
  if(!tokens.access_token)throw Error('Provider tidak memberikan token akses.');
  if(tokens.expires_in)tokens.expires_at=Date.now()+tokens.expires_in*1000;
  let label=provider==='notion'?(tokens.workspace_name||'Notion workspace'):provider==='github'?'GitHub account':'Google account';
  if(provider!=='notion'){
    const profile=await json(provider==='gmail'?'https://gmail.googleapis.com/gmail/v1/users/me/profile':provider==='calendar'?'https://www.googleapis.com/calendar/v3/calendars/primary':'https://api.github.com/user',{headers:{Authorization:`Bearer ${tokens.access_token}`,Accept:'application/json'}});
    label=String(profile.emailAddress||profile.summary||profile.login||label).slice(0,120);
  }
  save(provider,tokens,label);
 }
 const refreshing=new Map();
 async function token(provider){
  const row=db.prepare('SELECT * FROM account_connections WHERE provider=?').get(provider);if(!row)throw Error('Akun '+provider+' belum terhubung.');
  let t=decrypt(row.cipher);
  if(t.expires_at&&t.expires_at<Date.now()+60000){
   if(!t.refresh_token)throw Error('Sesi akun kedaluwarsa. Hubungkan ulang.');
   if(!refreshing.has(provider))refreshing.set(provider,(async()=>{const fresh=await exchange(provider,{grant_type:'refresh_token',refresh_token:t.refresh_token});if(!fresh.access_token)throw Error('Refresh akun gagal.');const next={...t,...fresh,expires_at:Date.now()+(fresh.expires_in||3600)*1000};save(provider,next,row.label);return next;})().finally(()=>refreshing.delete(provider)));
   t=await refreshing.get(provider);
  }
  return t.access_token;
 }
 async function context(provider){
  const access=await token(provider),headers={Authorization:`Bearer ${access}`,Accept:'application/json'};
  if(provider==='gmail'){
   const list=await json('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&labelIds=INBOX',{headers});
   return Promise.all((list.messages||[]).map(async m=>{const d=await json(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,{headers});return {id:d.id,headers:d.payload?.headers,snippet:d.snippet};}));
  }
  if(provider==='calendar'){
   const u=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');u.search=new URLSearchParams({timeMin:new Date().toISOString(),timeMax:new Date(Date.now()+7*86400000).toISOString(),maxResults:'10',singleEvents:'true',orderBy:'startTime'}).toString();const d=await json(u.href,{headers});return (d.items||[]).map(e=>({title:e.summary,start:e.start,end:e.end,description:e.description?.slice(0,1500),link:e.htmlLink}));
  }
  if(provider==='github'){const d=await json('https://api.github.com/user/repos?visibility=public&per_page=10&sort=updated',{headers});return d.filter(r=>!r.private).map(r=>({name:r.full_name,description:r.description,language:r.language,updated:r.updated_at,url:r.html_url}));}
  const h={...headers,'Notion-Version':'2022-06-28','Content-Type':'application/json'};
  const d=await json('https://api.notion.com/v1/search',{method:'POST',headers:h,body:JSON.stringify({page_size:5,filter:{value:'page',property:'object'}})});
  return Promise.all((d.results||[]).map(async p=>{const title=Object.values(p.properties||{}).find(v=>v.type==='title')?.title?.map(t=>t.plain_text).join('')||'Untitled';const blocks=await json(`https://api.notion.com/v1/blocks/${encodeURIComponent(p.id)}/children?page_size=20`,{headers:h});return {title,url:p.url,text:blocks.results.map(b=>(b[b.type]?.rich_text||[]).map(t=>t.plain_text).join('')).filter(Boolean).join('\n').slice(0,5000)};}));
 }
 function disconnect(provider){if(!accountProviders.includes(provider))throw Object.assign(Error('Provider tidak dikenal.'),{status:400});db.prepare('DELETE FROM account_connections WHERE provider=?').run(provider);db.prepare('DELETE FROM oauth_states WHERE provider=?').run(provider);}
 return {summary,start,complete,context,disconnect};
}
