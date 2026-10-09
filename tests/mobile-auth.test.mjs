import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Wallet} from 'ethers';
import {openArenaDatabase} from '../server/sqlite-db.mjs';
import {handleAuth,authenticate} from '../server/auth.mjs';
import {createState,start,step,pbase,MAX_HP} from '../public/engine.mjs';
import {makeReadyInputGuard} from '../public/ready-preview.mjs';
import {nextGuide,standalone} from '../public/experience.mjs';
import {makeOKXConnection} from '../public/wallet.mjs';
const schema=new URL('../server/schema.sql',import.meta.url),origin='https://game.example';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
function env(p){const w=new EventTarget();Object.assign(w,{Event,navigator:{userAgent:'iPhone',platform:'iPhone',maxTouchPoints:5},okxwallet:p,setTimeout,clearTimeout});return w;}
async function authFixture(){const db=openArenaDatabase(':memory:',schema);const signer=Wallet.createRandom();const call=body=>handleAuth(db,body,origin,'test');return {db,signer,call};}
test('X Layer nonce is signed, single-use, expiring and origin-bound; session revocable',async()=>{
 const {db,signer,call}=await authFixture();try{
 await assert.rejects(call({action:'challenge',address:signer.address,chainId:56}),/WRONG_NETWORK/);
 const c=await call({action:'challenge',address:signer.address,chainId:196});assert.match(c.message,/Chain ID: 196/);
 const signature=await signer.signMessage(c.message),body={action:'verify',id:c.id,signature};
 await assert.rejects(handleAuth(db,body,'https://other.example','other'),/LOGIN_EXPIRED/);
 const wrong=await Wallet.createRandom().signMessage(c.message);await assert.rejects(call({...body,signature:wrong}),/WALLET_CHANGED/);
 const results=await Promise.allSettled([call(body),call(body)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const login=results.find(x=>x.status==='fulfilled').value;assert.equal(await authenticate(db,login.session,origin),signer.address.toLowerCase());
 await assert.rejects(authenticate(db,login.session,'https://other.example'),/LOGIN_REQUIRED/);
 await assert.rejects(authenticate(db,login.session,origin,Date.now()+8*86400000),/LOGIN_REQUIRED/);
 await call({action:'logout',session:login.session});await assert.rejects(authenticate(db,login.session,origin),/LOGIN_REQUIRED/);
 const expired=await call({action:'challenge',address:signer.address,chainId:196});await assert.rejects(handleAuth(db,{action:'verify',id:expired.id,signature:await signer.signMessage(expired.message)},origin,'test',expired.expires+1),/LOGIN_EXPIRED/);
 }finally{db.close();}
});
test('ready keeps fighters still; held movement continues at FIGHT without queued attacks',()=>{
 const s=createState();start(s);const guard=makeReadyInputGuard();assert.equal(guard.sync(s),'reset');
 const fighters=Array.from(s.slice(pbase(0))),x=s[pbase(0)];
 for(let i=0;i<180;i++){assert.equal(guard.filter(s,2|16|2048),0);step(s,guard.filter(s,2|16|2048),0);}
 assert.equal(s[1],2);assert.deepEqual(Array.from(s.slice(pbase(0))),fighters);
 assert.equal(guard.sync(s,false,2|16|2048),'resume');assert.equal(guard.filter(s,2|16|2048),2);
 step(s,guard.filter(s,2|16|2048),0);assert.ok(s[pbase(0)]>x);assert.equal(s[pbase(0)+7],0);
 assert.equal(guard.sync(s),null);s[1]=1;assert.equal(guard.sync(s,false,2|16),'prepare');assert.equal(guard.filter(s,2),0);s[1]=2;assert.equal(guard.sync(s,false,2|16),'resume');assert.equal(guard.filter(s,2|16),2);guard.observe(2);assert.equal(guard.filter(s,2|16),2|16);
 assert.equal(guard.filter(s,2,true),0);
 s[1]=3;assert.equal(guard.sync(s),'reset');assert.equal(guard.filter(s,2048),0);
 s[1]=1;s[3]++;assert.equal(guard.sync(s),'reset');assert.equal(guard.filter(s,2),0);
});
test('guides serialize install, portrait and wallet with no install gate',()=>{
 const s={mobile:true,app:false,portrait:true,installDone:false,rotateDone:false,walletDone:false,pvp:true,connected:false,injected:false,busy:false};
 assert.equal(nextGuide(s),'install');assert.equal(nextGuide({...s,installDone:true}),null);assert.equal(nextGuide({...s,installDone:true,deposit:true}),'wallet');assert.equal(nextGuide({...s,app:true}),'rotate');assert.equal(nextGuide({...s,app:true,rotateDone:true}),null);assert.equal(nextGuide({...s,busy:true}),null);assert.equal(nextGuide({...s,installDone:true,injected:true}),null);
 assert.equal(standalone({navigator:{standalone:true},matchMedia:()=>({matches:false})}),true);
});
test('one login click continues connection → X Layer → signature; duplicate clicks share request; refresh and account switch checked',async()=>{
 const {db,signer,call}=await authFixture();let chain=56,address=signer.address,signs=0;const p=new EventTarget();p.on=(e,fn)=>p.addEventListener(e,fn);p.removeListener=(e,fn)=>p.removeEventListener(e,fn);
 p.request=async a=>{if(a.method==='eth_requestAccounts'||a.method==='eth_accounts')return[address];if(a.method==='eth_chainId')return '0x'+chain.toString(16);if(a.method==='wallet_switchEthereumChain'){assert.equal(a.params[0].chainId,'0xc4');chain=196;p.dispatchEvent(new Event('chainChanged'));return null;}if(a.method==='personal_sign'){signs++;return signer.signMessage(Buffer.from(a.params[0].slice(2),'hex'));}throw Error(a.method);};
 const store=storage(),w=env(p),client=makeOKXConnection({window:w,storage:store,api:call});try{const a=client.connect(),b=client.connect();assert.equal(a,b);assert.equal(await a,true);assert.equal(signs,1);assert.equal(client.state.phase,'connected');client.dispose();const restored=makeOKXConnection({window:w,storage:store,api:call});await restored.restore();assert.equal(restored.state.phase,'connected');assert.equal(signs,1);address=Wallet.createRandom().address;p.dispatchEvent(new Event('accountsChanged'));assert.equal(restored.state.session,'');restored.dispose();}finally{db.close();}
});
test('mobile provider continues same flow and exposes reopen, without injected wallet',async()=>{
 const {db,signer,call}=await authFixture();let opens=0,connections=0;const p={request:async a=>a.method==='eth_accounts'?[signer.address]:a.method==='eth_chainId'?196:signer.signMessage(Buffer.from(a.params[0].slice(2),'hex'))};
 const w=env(null),client=makeOKXConnection({window:w,storage:storage(),api:call,loadMobile:async()=>({provider:p,connect:async()=>connections++,reopen:()=>{opens++;return true;}})});
 try{assert.equal(await client.connect(),true);assert.equal(connections,1);assert.equal(client.state.mobile,true);assert.equal(client.reopen(),true);assert.equal(opens,1);}finally{client.dispose();db.close();}
});

test('guidance follows shared Scan language preference and explicit query overrides it',async()=>{
 const {language}=await import('../public/experience-text.mjs');
 const w={location:{href:'https://game.example/?lang=zh'},localStorage:{getItem:k=>k==='tapeoutscan.language.v1'?'en':null}};
 assert.equal(language(w),'zh');w.location.href='https://game.example/';assert.equal(language(w),'en');
 w.location.href='https://game.example/?lang=en';w.localStorage.getItem=()=>{throw Error('blocked');};assert.equal(language(w),'en');
});

test('touch combo copy uses the same action names as the controls, without keyboard letters',async()=>{
 const {controlSequence}=await import('../public/experience-text.mjs');
 const {COMBOS}=await import('../public/combos.mjs');
 for(const lang of ['zh','en'])for(const c of COMBOS){const labels=controlSequence(c.keys,true,lang);assert.doesNotMatch(labels,/\b[WASDJHKLUOEIFR]\b/);assert.equal(controlSequence(c.keys,false,lang),c.keys);}
 assert.equal(controlSequence('W＋J → K → J → J → H',true,'zh'),'摇杆↑＋普攻 → 跳跃 → 普攻 → 普攻 → 重击');
});

test('portrait pocket mode never gates combat when rotating or reopening the app',async()=>{
 const {makeMobileLayout}=await import('../public/mobile.mjs');
 const media=new Map(),win=new EventTarget(),classes=new Set(),changes=[];
 win.matchMedia=q=>{if(!media.has(q)){const m=new EventTarget();m.matches=true;media.set(q,m);}return media.get(q);};
 const doc={body:{dataset:{view:'battle'},classList:{toggle(k,v){v?classes.add(k):classes.delete(k);}}}};
 const mobile=makeMobileLayout({window:win,document:doc,onChange:x=>changes.push(x)});mobile.sync();
 assert.equal(mobile.touch,true);assert.equal(mobile.portrait,false);assert.ok(classes.has('mobile-battle'));assert.ok(classes.has('portrait-allowed'));
 const orientation=media.get('(orientation: portrait)');orientation.matches=false;orientation.dispatchEvent(new Event('change'));orientation.matches=true;orientation.dispatchEvent(new Event('change'));win.dispatchEvent(new Event('resize'));
 assert.equal(mobile.portrait,false);assert.ok(changes.every(v=>v===false));doc.body.dataset.view='lobby';mobile.sync();assert.equal(classes.has('mobile-battle'),false);
});

test('PWA background handoff waits for return before challenge/verification HTTP, preserving one signature',async()=>{
 const {db,signer,call}=await authFixture(),w=env(null),doc=new EventTarget();w.document=doc;doc.hidden=false;let challenges=0,verifications=0,signs=0;
 const api=body=>{if(body.action==='challenge'){challenges++;assert.equal(doc.hidden,false);}if(body.action==='verify'){verifications++;assert.equal(doc.hidden,false);}return call(body);};
 const p={request:async a=>{if(a.method==='eth_accounts')return[signer.address];if(a.method==='eth_chainId')return 196;signs++;doc.hidden=true;return signer.signMessage(Buffer.from(a.params[0].slice(2),'hex'));}};
 const client=makeOKXConnection({window:w,storage:storage(),api,loadMobile:async()=>({provider:p,connect:async()=>{doc.hidden=true;}})});
 try{const login=client.connect();await new Promise(r=>setTimeout(r,15));assert.equal(challenges,0);doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,20));assert.equal(challenges,1);assert.equal(signs,1);assert.equal(verifications,0);assert.equal(client.state.phase,'verifying');doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(await login,true);assert.equal(verifications,1);}finally{client.dispose();db.close();}
});

test('timed-out login retains handoff to the same request; a late signature cannot log in',async()=>{
 const {db,signer,call}=await authFixture(),w=env(null);w.setTimeout=(fn,ms)=>setTimeout(fn,ms===240000?35:ms);let handoff,resolveSign,opens=0;
 const p={request:async a=>a.method==='eth_accounts'?[signer.address]:a.method==='eth_chainId'?196:new Promise(resolve=>{handoff(true);resolveSign=()=>signer.signMessage(Buffer.from(a.params[0].slice(2),'hex')).then(s=>{handoff(false);resolve(s);});})};
 const client=makeOKXConnection({window:w,storage:storage(),api:call,loadMobile:async o=>{handoff=o.onHandoff;return{provider:p,connect:async()=>{},reopen:()=>{opens++;return true;}};}});
 try{assert.equal(await client.connect(),false);assert.equal(client.state.phase,'idle');assert.equal(client.state.handoff,true);assert.equal(client.reopen(),true);assert.equal(opens,1);await resolveSign();await new Promise(r=>setTimeout(r,5));assert.equal(client.state.session,'');assert.equal(client.state.handoff,false);}finally{client.dispose();db.close();}
});

test('returning to free mode during wallet connection prevents an automatic signature',async()=>{
 const {db,signer,call}=await authFixture(),w=env(null);let finish,signs=0,connections=0;
 const p={request:async a=>{if(a.method==='eth_accounts')return[signer.address];if(a.method==='eth_chainId')return 196;signs++;return signer.signMessage(Buffer.from(a.params[0].slice(2),'hex'));}};
 const client=makeOKXConnection({window:w,storage:storage(),api:call,loadMobile:async()=>({provider:p,connect:()=>{connections++;return new Promise(r=>finish=r);}})});
 try{const first=client.connect();while(!finish)await new Promise(r=>setTimeout(r,1));client.cancelLogin();assert.equal(client.connect(),first);finish();assert.equal(await first,false);assert.equal(signs,0);assert.equal(connections,1);assert.equal(client.state.session,'');assert.equal(client.state.phase,'idle');}finally{client.dispose();db.close();}
});

test('payment nonce is fixed before opening wallet; account changes and missing nonce stop sending',async()=>{
 const {db,signer,call}=await authFixture();let address=signer.address,sent=[];const provider={request:async q=>{if(q.method==='eth_accounts'||q.method==='eth_requestAccounts')return[address];if(q.method==='eth_chainId')return'0xc4';if(q.method==='personal_sign')return signer.signMessage(Buffer.from(q.params[0].slice(2),'hex'));if(q.method==='eth_getTransactionCount')return'0x4';if(q.method==='eth_sendTransaction'){sent.push(q.params[0]);return'0x'+'a'.repeat(64);}throw Error(q.method);}},client=makeOKXConnection({window:env(provider),storage:storage(),api:call});
 try{assert.equal(await client.connect(),true);const plan={chainId:196,from:signer.address.toLowerCase(),to:'0x'+'2'.repeat(40),data:'0x1234',value:'0x0'};await assert.rejects(client.send(plan),/BAD_TRANSACTION/);const fixed=await client.prepareTransaction(plan);assert.equal(fixed.nonce,'0x4');await client.send(fixed);assert.equal(sent[0].nonce,'0x4');assert.equal(sent[0].chainId,'0xc4');address='0x'+'3'.repeat(40);await assert.rejects(client.send(fixed),/WALLET_CHANGED/);assert.equal(sent.length,1);}finally{client.dispose();db.close();}
});
