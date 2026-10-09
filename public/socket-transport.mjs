// A bounded full-duplex channel. Unsupported hosts use the existing HTTP API.
export function makeArenaTransport(fallback,{Socket=globalThis.WebSocket,schedule=setTimeout,cancel=clearTimeout,url=()=>{const u=new URL('/games/ember/api/arena',location.href);u.protocol=u.protocol==='https:'?'wss:':'ws:';u.pathname+='/ws';return u.href;}}={}){
 let socket=null,serial=0,epoch=0,retryTimer=0,openTimer=0,retries=0,enabled=false;const pending=new Map();
 const connectionError=(message,unsent=false)=>Object.assign(Error(message),{transport:true,unsent});
 function close(retry=false){epoch++;cancel(openTimer);openTimer=0;cancel(retryTimer);retryTimer=0;if(!retry)enabled=false;const previous=socket;socket=null;if(previous)previous.close();for(const request of pending.values()){clearTimeout(request.timeout);request.reject(connectionError('长连接已断开'));}pending.clear();if(retry&&enabled){retryTimer=schedule(()=>open(),Math.min(16000,1000*2**Math.min(retries++,4)));retryTimer?.unref?.();}}
 function open(){close(false);enabled=true;if(!Socket){enabled=false;return;}const generation=epoch;let ws;try{ws=new Socket(url());}catch{close(true);return;}socket=ws;openTimer=schedule(()=>{if(generation===epoch&&ws.readyState!==1)close(true);},1500);
   ws.onopen=()=>{if(generation===epoch){cancel(openTimer);openTimer=0;retries=0;}};ws.onerror=()=>{};
   ws.onclose=()=>{if(generation===epoch)close(true);};
   ws.onmessage=event=>{if(generation!==epoch)return;let message;try{message=JSON.parse(event.data);}catch{return;}const request=pending.get(message.id);if(!request)return;pending.delete(message.id);clearTimeout(request.timeout);if(message.status>=200&&message.status<300)request.resolve(message.data);else request.reject(Object.assign(Error(message.data?.error||'同步失败'),{status:message.status}));};
  }
 return {get fast(){return socket?.readyState===1;},get pending(){return pending.size;},close:()=>close(false),open(){if(enabled&&socket?.readyState<=1)return;enabled=true;open();},

  request(body){if(socket?.readyState!==1)return fallback(body);if(pending.size>=24){close(true);return Promise.reject(connectionError('长连接拥塞',true));}const id=++serial;
   return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pending.delete(id);reject(connectionError('长连接超时'));close(true);},2500);pending.set(id,{resolve,reject,timeout});try{socket.send(JSON.stringify({id,body}));}catch(error){clearTimeout(timeout);pending.delete(id);reject(connectionError(error.message,true));close(true);}});
  }
 };
}

// A successful room heartbeat restores transport health even while no combat
// frames advance (waiting/funding). Connection feedback is not payment evidence.
export function acceptRoomHeartbeat(session,now,rtt){
 const recovered=!!(session.failures||session.networkRecovering);
 session.failures=0;session.networkRecovering=false;session.lastReceived=now;session.lastRtt=rtt;
 return recovered;
}
