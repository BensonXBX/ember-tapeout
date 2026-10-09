import {allowOrigin} from './network-policy.mjs';
import {WebSocketServer} from './vendor/ws/wrapper.mjs';
import {handleArena} from './arena-server.mjs';
// The socket only changes transport: the same token, sequence, rate and input
// validators remain authoritative. No client health/position messages are used.
export function attachArenaSockets(server,database,base,allowedOrigins=[],finance=null){
 const wss=new WebSocketServer({noServer:true,maxPayload:3072,maxFragments:64,maxBufferedChunks:128,perMessageDeflate:false}),counts=new Map();
 server.on('upgrade',(req,socket,head)=>{
  const trusted=process.env.TRUST_PROXY==='1'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const protocol=trusted&&req.headers['x-forwarded-proto']==='https'?'https':'http';
  let url;try{url=new URL(req.url,`${protocol}://${req.headers.host}`);}catch{return socket.destroy();}
  const ip=trusted?String(req.headers['x-real-ip']||req.socket.remoteAddress):req.socket.remoteAddress;
  if(url.pathname!==`${base}api/arena/ws`||!allowOrigin(req.headers.origin,url.origin,allowedOrigins)||wss.clients.size>=256||(counts.get(ip)||0)>=8){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  wss.handleUpgrade(req,socket,head,ws=>{
   counts.set(ip,(counts.get(ip)||0)+1);let queue=Promise.resolve(),pending=0,identity=null,alive=true;
   ws.on('error',()=>{});ws.on('pong',()=>{alive=true;});
   const ping=setInterval(()=>{if(!alive)return ws.terminate();alive=false;ws.ping();},25000).unref();
   ws.on('close',()=>{clearInterval(ping);const count=(counts.get(ip)||1)-1;if(count)counts.set(ip,count);else counts.delete(ip);});
   ws.on('message',(buffer,binary)=>{
    if(binary||++pending>24){ws.close(1008,'Invalid or excessive messages');return;}
    queue=queue.then(async()=>{
     if(ws.readyState!==1)return;
     let message;try{message=JSON.parse(buffer.toString());}catch{ws.close(1007,'Invalid JSON');return;}
     const {id,body}=message||{};
     if(!Number.isSafeInteger(id)||id<1||!body||body.action!=='input'){ws.send(JSON.stringify({id,status:400,data:{error:'仅支持对战输入。'}}));return;}
     if(identity&&(body.code!==identity.code||body.token!==identity.token)){ws.send(JSON.stringify({id,status:401,data:{error:'长连接房间凭证不匹配。'}}));return;}
     const headers={'content-type':'application/json','origin':url.origin,'cf-connecting-ip':ip};
     const response=await handleArena(new Request(new URL(`${base}api/arena`,url),{method:'POST',headers,body:JSON.stringify(body)}),database,allowedOrigins,finance);
     const data=await response.json();if(response.ok&&!identity)identity={code:data.code||body.code,token:body.token};if(response.ok&&data.moved)identity={code:data.code,token:body.token};
     if(ws.readyState===1)ws.send(JSON.stringify({id,status:response.status,data}));
    }).catch(()=>{ws.close(1011,'Request failed');}).finally(()=>{pending--;});
   });
  });
 });
 return {close(){for(const ws of wss.clients)ws.terminate();wss.close();}};
}
