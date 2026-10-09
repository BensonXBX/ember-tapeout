import {text} from './experience-text.mjs?v=06fc8452cd83ba41';
export const XLAYER={chainId:'0xc4',chainName:'X Layer',nativeCurrency:{name:'OKB',symbol:'OKB',decimals:18},rpcUrls:['https://rpc.xlayer.tech'],blockExplorerUrls:['https://www.okx.com/web3/explorer/xlayer']};
export const isMobile=win=>/Android|iPhone|iPad|iPod/i.test(win.navigator.userAgent)||(win.navigator.maxTouchPoints>1&&/Mac/.test(win.navigator.platform));
export function makeOKXConnection({window:win=globalThis.window,storage,onChange=()=>{},api:call,loadMobile=options=>import('./vendor/okx-connect.mjs?v=f7c29a24bd23cc2d').then(m=>m.createMobileWallet(options))}={}){
 let provider=null,mobile=null,mobileJob=null,epoch=0,cancelledEpoch=-1,pending=null,restoring=null,disposed=false,resumeForeground=null;
 let state={phase:'idle',nickname:'',address:'',chain:'',session:'',message:text('idle'),mobile:false,handoff:false};
 const listeners=[],valid=a=>typeof a==='string'&&/^0x[0-9a-f]{40}$/i.test(a);
 const publish=patch=>{if(!disposed){state={...state,...patch};onChange({...state});}};
 const get=()=>{try{return JSON.parse(storage?.getItem('ember-xlayer-login')||'null');}catch{return null;}};
 const remember=value=>{try{if(value)storage?.setItem('ember-xlayer-login',JSON.stringify(value));else storage?.removeItem('ember-xlayer-login');}catch{}};
 const changed=()=>{if(pending)return;epoch++;resumeForeground?.();remember(null);publish({phase:'idle',nickname:'',address:'',chain:'',session:'',message:text('WALLET_CHANGED')});};
 function watch(p){if(provider===p)return;for(const [old,event,fn]of listeners)old.removeListener?.(event,fn);listeners.length=0;provider=p;for(const event of ['accountsChanged','chainChanged','disconnect']){p.on?.(event,changed);listeners.push([p,event,changed]);}}
 function discover(){if(win.okxwallet?.request&&!provider)watch(win.okxwallet);win.dispatchEvent(new win.Event('eip6963:requestProvider'));return provider;}
 const announce=e=>{if(!provider&&e.detail?.provider?.request&&(/^(com\.okex\.wallet|com\.okx\.wallet)$/.test(e.detail.info?.rdns||'')||e.detail.provider.isOkxWallet))watch(e.detail.provider);};
 win.addEventListener('eip6963:announceProvider',announce);
 async function prepare(){if(win.isSecureContext===false)throw Error('preview');discover();if(provider||!isMobile(win))return;mobileJob??=loadMobile({onHandoff:ready=>publish({handoff:ready,...(!ready&&state.phase==='idle'?{message:text('idle')}:{})})}).catch(e=>{mobileJob=null;throw e;});mobile=await mobileJob;watch(mobile.provider);publish({mobile:true});}
 async function identity(){const accounts=await provider.request({method:'eth_accounts'}),chain=Number(await provider.request({method:'eth_chainId'}));return {address:valid(accounts?.[0])?accounts[0].toLowerCase():'',chain};}
 function errorMessage(e){if(Number(e.code)===4001||Number(e.code)===300)return text('cancelled');if(Number(e.code)===-32002)return text('pending');return text(e.message)===e.message?text('network'):text(e.message);}
 function foreground(g){if(!mobile||!win.document?.hidden||g!==epoch)return Promise.resolve();return new Promise(resolve=>{const done=()=>{win.document.removeEventListener('visibilitychange',check);win.removeEventListener('pageshow',check);resumeForeground=null;resolve();},check=()=>{if(!win.document.hidden||g!==epoch)done();};resumeForeground=done;win.document.addEventListener('visibilitychange',check);win.addEventListener('pageshow',check);check();});}
 async function login(g){
  publish({phase:'loading',message:text('loading')});await prepare();if(g!==epoch)return false;if(!provider)throw Error('unavailable');
  publish({phase:'connecting',message:text('connecting')});
  if(mobile)await mobile.connect();else await provider.request({method:'eth_requestAccounts'});
  if(g!==epoch)return false;
  let current=await identity();if(g!==epoch)return false;if(!valid(current.address))throw Error('WALLET_CHANGED');
  if(current.chain!==196){publish({phase:'switching',message:text('switching')});try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:XLAYER.chainId}]});}catch(e){if(Number(e.code)!==4902)throw e;await provider.request({method:'wallet_addEthereumChain',params:[XLAYER]});await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:XLAYER.chainId}]});}current=await identity();}
  if(g!==epoch)return false;if(current.chain!==196)throw Error('WRONG_NETWORK');
  await foreground(g);if(g!==epoch)return false;
  const address=current.address,challenge=await call({action:'challenge',address,chainId:196});
  if(g!==epoch)return false;current=await identity();if(current.address!==address||current.chain!==196)throw Error('WALLET_CHANGED');publish({phase:'signing',address,chain:'0xc4',message:text('signing')});
  const encoded='0x'+Array.from(new TextEncoder().encode(challenge.message),x=>x.toString(16).padStart(2,'0')).join('');
  const signature=await provider.request({method:'personal_sign',params:[encoded,address]});
  if(g!==epoch)return false;current=await identity();if(current.address!==address||current.chain!==196)throw Error('WALLET_CHANGED');
  publish({phase:'verifying',message:text('verifying')});await foreground(g);if(g!==epoch)return false;const result=await call({action:'verify',id:challenge.id,signature});
  if(g!==epoch){void call({action:'logout',session:result.session}).catch(()=>{});return false;}
  current=await identity();if(g!==epoch||current.address!==address||current.chain!==196||result.address!==address||result.chainId!==196){void call({action:'logout',session:result.session}).catch(()=>{});throw Error('WALLET_CHANGED');}
  remember({...result,mobile:!!mobile});publish({phase:'connected',nickname:result.nickname||'',address,chain:'0xc4',session:result.session,message:text('connected')});return true;
 }
 function connect(){if(pending)return pending;const g=++epoch;remember(null);publish({session:''});let timer;
  pending=Promise.race([login(g),new Promise((_,reject)=>{timer=win.setTimeout(()=>reject(Error('timeout')),240000);})]).catch(e=>{if(g===epoch){epoch++;resumeForeground?.();publish({phase:'idle',session:'',address:'',message:errorMessage(e)});}return false;}).finally(()=>{win.clearTimeout(timer);pending=null;if(cancelledEpoch===g&&state.phase!=='connected'&&!state.handoff)publish({phase:'idle',message:text('idle')});});return pending;
 }
 // Returning to free play must not trigger the next wallet confirmation. Keep
 // any request already sent recoverable; never manufacture a second request.
 function cancelLogin(){if(!pending)return;cancelledEpoch=epoch;epoch++;resumeForeground?.();}
 async function restore(){if(pending||restoring)return;const saved=get();if(!saved?.session)return;const g=epoch;
  restoring=(async()=>{try{if(saved.mobile)await prepare();else discover();if(!provider){remember(null);return;}const current=await identity();if(g!==epoch||pending)return;if(current.address!==saved.address||current.chain!==196){changed();return;}const result=await call({action:'session',session:saved.session});if(g!==epoch||pending)return;if(result.address!==saved.address)throw Error('WALLET_CHANGED');publish({phase:'connected',nickname:result.nickname||'',address:result.address,chain:'0xc4',session:saved.session,message:text('connected')});}
  catch(e){if(g!==epoch||pending)return;if(e.status===401||e.message==='WALLET_CHANGED')remember(null);publish({phase:'idle',session:'',address:'',message:errorMessage(e)});}})().finally(()=>{restoring=null;});return restoring;
 }
 async function disconnect(){const token=state.session||get()?.session;epoch++;resumeForeground?.();remember(null);publish({phase:'idle',session:'',address:'',chain:'',message:text('idle')});if(token)void call({action:'logout',session:token}).catch(()=>{});try{await provider?.disconnect?.();}catch{}}
 async function prepareTransaction(plan){if(!provider)throw Error('LOGIN_REQUIRED');const current=await identity();if(current.address!==state.address||plan.from!==current.address||current.chain!==196)throw Error('WALLET_CHANGED');const nonce=await provider.request({method:'eth_getTransactionCount',params:[current.address,'pending']});if(!/^0x[0-9a-f]{1,14}$/i.test(nonce||''))throw Error('BAD_TRANSACTION');return{...plan,nonce};}
 async function send(plan){if(pending||state.phase!=='connected')throw Error('LOGIN_REQUIRED');const current=await identity();if(current.address!==state.address||current.chain!==196||plan.chainId!==196||plan.from?.toLowerCase()!==current.address||!/^0x[0-9a-f]{40}$/i.test(plan.to)||!/^0x[0-9a-f]*$/i.test(plan.data)||!/^0x[0-9a-f]+$/i.test(plan.value))throw Error('WALLET_CHANGED');if(!/^0x[0-9a-f]{1,14}$/i.test(plan.nonce||''))throw Error('BAD_TRANSACTION');return provider.request({method:'eth_sendTransaction',params:[{from:current.address,to:plan.to,data:plan.data,value:plan.value,nonce:plan.nonce,chainId:'0xc4'}]});}
 async function failedReceipt(hash){if(!/^0x[0-9a-f]{64}$/i.test(hash)||!provider||Number(await provider.request({method:'eth_chainId'}))!==196)return false;const r=await provider.request({method:'eth_getTransactionReceipt',params:[hash]});return r&&Number(r.status)===0&&r.from?.toLowerCase()===state.address;}
 async function setNickname(value){const g=epoch,address=state.address,session=state.session;if(!session)throw Error('LOGIN_REQUIRED');const result=await call({action:'profile',session,nickname:value});if(g!==epoch||state.address!==address||result.address!==address)throw Error('SESSION_CHANGED');publish({nickname:result.nickname});return result.nickname;}
 discover();return {setNickname,send,prepareTransaction,failedReceipt,cancelLogin,get state(){return {...state};},get injected(){return !!provider&&!mobile;},get pending(){return !!pending;},prepare,connect,restore,disconnect,reopen:()=>mobile?.reopen()||false,dispose(){disposed=true;epoch++;resumeForeground?.();win.removeEventListener('eip6963:announceProvider',announce);for(const[p,event,fn]of listeners)p.removeListener?.(event,fn);}};
}
