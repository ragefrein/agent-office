export function createRuntimeCatalog(base,apiKey,http=fetch){
 let cached=null,pending;
 async function load(){
  if(cached&&Date.now()-cached.checked<60000)return cached;
  if(pending)return pending;
  pending=(async()=>{const result={skills:[],toolsets:[],errors:[],checked:Date.now()};await Promise.all(['skills','toolsets'].map(async type=>{
   try{const r=await http(base+`/v1/${type}`,{headers:{Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(7000)});if(!r.ok){result.errors.push(`${type}: HTTP ${r.status}`);return;}const d=await r.json(),rows=Array.isArray(d)?d:d.data||d[type];if(!Array.isArray(rows)){result.errors.push(type+': format katalog tidak dikenal');return;}
    result[type]=rows.filter(x=>typeof x.name==='string').slice(0,type==='skills'?500:100).map(x=>({name:x.name.slice(0,180),description:String(x.description||'').slice(0,800),...(type==='skills'?{category:String(x.category||'').slice(0,80)}:{enabled:x.enabled===true,configured:x.configured===true,tools:Array.isArray(x.tools)?x.tools.filter(t=>typeof t==='string').slice(0,100):[]})}));
   }catch{result.errors.push(type+': Hermes tidak dapat dijangkau');}
  }));cached=result;return result;})().finally(()=>{pending=null;});return pending;
 }
 return {load};
}
