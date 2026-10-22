// Parses public assistant output and tool names only. Private reasoning is never surfaced.
export async function readHermesResponse(response, onProgress=()=>{}) {
  if(!(response.headers.get('content-type')||'').includes('text/event-stream'))return response.json();
  let buffer='',content='',finish=null,lastUpdate=0;
  function frame(text){
    const lines=text.split(/\r?\n/),event=lines.find(l=>l.startsWith('event:'))?.slice(6).trim();
    const raw=lines.filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
    if(!raw||raw==='[DONE]')return;
    let data;try{data=JSON.parse(raw);}catch{return;}
    if(event==='hermes.tool.progress'){
      const name=data.tool_name||data.name||data.tool?.name;
      if(typeof name==='string')onProgress({type:'tool',text:`Menggunakan tool: ${name.replace(/[^a-zA-Z0-9_. -]/g,'').slice(0,60)}`});
      return;
    }
    const choice=data.choices?.[0];
    if(typeof choice?.delta?.content==='string')content=(content+choice.delta.content).slice(0,200000);
    if(choice?.finish_reason)finish=choice.finish_reason;
    if(data.error)finish='error';
    if(Date.now()-lastUpdate>1200&&content){onProgress({type:'output',text:content.slice(-240)});lastUpdate=Date.now();}
  }
  const decoder=new TextDecoder();
  for await(const bytes of response.body){buffer+=decoder.decode(bytes,{stream:true});if(buffer.length>1000000)throw Error('Hermes stream frame terlalu besar.');let match;while((match=/\r?\n\r?\n/.exec(buffer))){frame(buffer.slice(0,match.index));buffer=buffer.slice(match.index+match[0].length);}}
  buffer+=decoder.decode();if(buffer.trim())frame(buffer);
  return {choices:[{finish_reason:finish,message:{content}}]};
}
