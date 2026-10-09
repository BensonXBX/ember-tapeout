// Keep failed departures recoverable. Credentials stay in this tab, never logs.
export function makeRoomCleanup({api,storage,onChange=()=>{}}) {
 const pending=new Map();let active=null;
 try{for(const item of JSON.parse(storage?.getItem('ember-pending-leaves')||'[]'))if(typeof item.code==='string'&&typeof item.token==='string'&&Date.now()-item.at<600000)pending.set(item.token,item);}catch{}
 function publish(){try{storage?.setItem('ember-pending-leaves',JSON.stringify([...pending.values()]));}catch{}onChange(pending.size);}
 function flush(){if(active)return active;active=(async()=>{for(const [key,item] of [...pending]){try{await api({action:'leave',code:item.code,token:item.token});pending.delete(key);}catch(e){if(e.status===401||e.status===404)pending.delete(key);}}publish();return pending.size===0;})().finally(()=>{active=null;});return active;}
 return {get pending(){return pending.size;},flush,async leave(room){if(!room||room.done)return true;pending.set(room.token,{code:room.code,token:room.token,at:Date.now()});publish();await flush();if(pending.has(room.token))await flush();return !pending.has(room.token);}};
}
