// The pinned SDK opens iOS before publishing a request. Keep its protocol/relay,
// but only offer app handoff after the relay ACK, and never replace the PWA with
// a timed website fallback. A second click reopens the same pending request.
export function adaptMobileWallet(sdk,{getLink,window:win=window,onHandoff=()=>{}}){
 let action=null,ready=false;
 const accounts=()=>sdk.session?(sdk.session.namespaces?.eip155?.accounts||[]).filter(a=>a.startsWith('eip155:196:')).map(a=>a.split(':')[2]).filter(a=>/^0x[0-9a-f]{40}$/i.test(a)):[];
 const setReady=value=>{ready=value;onHandoff(value);};
 function reopen(){
  if(!ready||!action)return false;
  try{
   // SDK 1.9.1 defaults to okxweb3 (common app). Its standalone wallet uses
   // okxwallet; accepting only the legacy okx scheme silently blocks both.
   const link=getLink(action.info?.connectRequest,sdk.client.sessionConfig?.connectWalletType).deepLink,u=new URL(link);
   if(!['okx:','okxwallet:','okxweb3:'].includes(u.protocol)||u.hostname!=='web3'||u.pathname!=='/wallet/connect'||u.username||u.password||u.port)return false;
   // Remain synchronous: a repeat tap must preserve iOS user activation and
   // open this existing request, not send another connection/signature.
   win.location.href=link;return true;
  }catch{return false;}
 }
 function handoff(target){if(action!==target||ready)return;setReady(true);if(!win.document?.hidden)reopen();}
 const send=sdk.client.engine.send.bind(sdk.client.engine);
 sdk.client.engine.send=(args,callbacks={},...rest)=>{const target=action;if(target?.kind!=='request'||!['personal_sign','eth_sendTransaction'].includes(args.method))return send(args,callbacks,...rest);return send(args,{...callbacks,onAck(...values){callbacks.onAck?.(...values);handoff(target);}},...rest);};
 sdk.on('okx_engine_connect_params',info=>{if(action?.kind==='connect'){action.info=info;handoff(action);}});
 const mapped=new Map();
 function on(event,fn){const name=event==='accountsChanged'?'session_update':event==='disconnect'?'session_delete':null;if(!name)return;const cb=()=>{if(event==='disconnect'){action=null;setReady(false);}fn(event==='accountsChanged'?accounts():undefined);};let group=mapped.get(event);if(!group)mapped.set(event,group=new Map());group.set(fn,cb);sdk.on(name,cb);}
 function removeListener(event,fn){const cb=mapped.get(event)?.get(fn);if(cb){sdk.off?.(event==='accountsChanged'?'session_update':'session_delete',cb);mapped.get(event).delete(fn);}}
 async function request(args){
  if(args.method==='eth_accounts'||args.method==='eth_requestAccounts')return accounts();
  if(args.method==='eth_chainId')return accounts().length?'0xc4':'0x0';
  // The SDK still checks approved namespaces and the requested chain.
  if(!['personal_sign','eth_sendTransaction'].includes(args.method))return sdk.request({...args,redirect:'back'},'eip155:196');
  if(action)throw Object.assign(Error('pending'),{code:-32002});
  const target=action={kind:'request'};setReady(false);
  if(sdk.client.sessionConfig)sdk.client.sessionConfig.openUniversalUrl=false;
  try{return await sdk.request({...args,redirect:'back'},'eip155:196');}
  finally{if(action===target){action=null;setReady(false);}}
 }
 return{connected:()=>!!accounts().length,reopen,get canReopen(){return ready;},
  async connect(){if(sdk.connected()&&accounts().length)return;if(action)throw Object.assign(Error('pending'),{code:-32002});if(sdk.connected())await sdk.disconnect();const target=action={kind:'connect'};setReady(false);try{await sdk.connect({namespaces:{eip155:{chains:['eip155:196'],defaultChain:'196',rpcMap:{'196':'https://rpc.xlayer.tech'}}},sessionConfig:{redirect:'back',openUniversalUrl:false}});if(!accounts().length)throw Error('WALLET_CHANGED');}finally{if(action===target){action=null;setReady(false);}}},
  provider:{request,on,removeListener,disconnect:()=>sdk.disconnect()}
 };
}
