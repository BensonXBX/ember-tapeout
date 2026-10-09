import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adaptMobileWallet} from '../build-tools/wallet-okx-adapter.mjs';
import {getOKXLink} from '@okxconnect/core/src/utils/url.js';
const address='0x'+'1'.repeat(40);
function fixture({link=getOKXLink,walletType}={}){
 const events=new Map(),requests=[],opens=[],states=[],listeners=new Map();let resolveConnect;
 const win={location:{set href(v){opens.push(v);}},document:{hidden:false}};
 const sdk={session:null,client:{sessionConfig:{openUniversalUrl:true},engine:{send:async(args,cb)=>requests.push({args,cb})}},on:(k,f)=>events.set(k,f),off:(k,f)=>{if(events.get(k)===f)events.delete(k);},connected:()=>!!sdk.session,disconnect:async()=>{sdk.session=null;events.get('session_delete')?.();},connect:args=>{assert.equal(args.sessionConfig.openUniversalUrl,false);sdk.client.sessionConfig={...args.sessionConfig,connectWalletType:walletType};return new Promise(r=>resolveConnect=()=>{sdk.session={namespaces:{eip155:{accounts:['eip155:196:'+address]}}};r(sdk.session);});},request:args=>new Promise((resolve,reject)=>{assert.equal(sdk.client.sessionConfig.openUniversalUrl,false);sdk.client.engine.send(args,{onAck:()=>{},resolve:r=>r.error?reject(r.error):resolve(r.result)});})};
 const mobile=adaptMobileWallet(sdk,{window:win,getLink:link,onHandoff:v=>states.push(v)});
 return{sdk,mobile,win,events,requests,opens,states,connect:()=>resolveConnect()};
}
test('PWA connection URL opens only when ready; signing is sent before opening; reopen never resends',async()=>{
 const f=fixture(),{mobile}=f;const connecting=mobile.connect();assert.equal(mobile.reopen(),false);f.events.get('okx_engine_connect_params')({connectRequest:{topic:'test'}});assert.equal(f.opens.length,1);f.connect();await connecting;assert.equal(mobile.reopen(),false);
 const signing=mobile.provider.request({method:'personal_sign',params:['0x61',address]});assert.equal(f.requests.length,1);assert.equal(f.opens.length,1);assert.equal(mobile.canReopen,false);
 f.requests[0].cb.onAck();assert.equal(f.opens.at(-1),'okxweb3://web3/wallet/connect');assert.equal(mobile.canReopen,true);const count=f.opens.length;f.requests[0].cb.onAck();assert.equal(f.opens.length,count);mobile.reopen();mobile.reopen();assert.equal(f.requests.length,1);
 await assert.rejects(mobile.provider.request({method:'personal_sign',params:['0x61',address]}),e=>e.code===-32002);
 f.requests[0].cb.resolve({result:'signature'});assert.equal(await signing,'signature');assert.equal(mobile.canReopen,false);
});
test('ACK while backgrounded keeps pending signature available for a real return click; rejection clears it',async()=>{
 const f=fixture();f.sdk.session={namespaces:{eip155:{accounts:['eip155:196:'+address]}}};const p=f.mobile.provider.request({method:'personal_sign',params:['0x61',address]});f.win.document.hidden=true;f.requests[0].cb.onAck();assert.equal(f.opens.length,0);assert.equal(f.mobile.canReopen,true);f.win.document.hidden=false;assert.equal(f.mobile.reopen(),true);f.requests[0].cb.resolve({error:{code:4001}});await assert.rejects(p,e=>e.code===4001);assert.equal(f.mobile.reopen(),false);
});
test('transaction handoff uses the same ACK guard; account listeners are removable',async()=>{
 const f=fixture();f.sdk.session={namespaces:{eip155:{accounts:['eip155:196:'+address]}}};let change;const listener=a=>change=a;f.mobile.provider.on('accountsChanged',listener);f.events.get('session_update')();assert.deepEqual(change,[address]);f.mobile.provider.removeListener('accountsChanged',listener);assert.equal(f.events.has('session_update'),false);
 const p=f.mobile.provider.request({method:'eth_sendTransaction',params:[{from:address,to:address,value:'0x0'}]});assert.equal(f.mobile.reopen(),false);f.requests[0].cb.onAck();f.requests[0].cb.resolve({result:'0x'+'a'.repeat(64)});assert.match(await p,/^0x[a-f0-9]{64}$/);assert.equal(f.mobile.canReopen,false);
});

test('actual pinned SDK links support combined OKX, standalone Wallet and legacy OKX app in connect and signature steps',async()=>{
 for(const [walletType,scheme]of [[undefined,'okxweb3:'],[120,'okxwallet:'],[100,'okx:']]){
  const f=fixture({walletType}),p=f.mobile.connect();
  const request={topic:'public-fixture-topic',clientId:'fixture',requests:[],redirect:'back'};
  f.events.get('okx_engine_connect_params')({connectRequest:request});assert.equal(f.opens.length,1);
  const u=new URL(f.opens[0]);assert.equal(u.protocol,scheme);assert.equal(u.hostname,'web3');assert.equal(u.pathname,'/wallet/connect');assert.equal(JSON.parse(Buffer.from(u.searchParams.get('param'),'base64').toString()).topic,request.topic);
  assert.equal(f.mobile.reopen(),true);assert.equal(f.opens[0],f.opens[1]);f.connect();await p;
  const sign=f.mobile.provider.request({method:'personal_sign',params:['0x61',address]});f.requests[0].cb.onAck();assert.equal(f.opens.at(-1),scheme+'//web3/wallet/connect');f.mobile.reopen();assert.equal(f.requests.length,1);f.requests[0].cb.resolve({result:'signature'});await sign;
 }
});
test('wallet launcher refuses non-wallet or malformed links without leaving the game',async()=>{
 for(const deepLink of ['https://web3.okx.com','javascript:alert(1)','okxweb3://evil/wallet/connect','okxwallet://web3/other','okx://user@web3/wallet/connect','okxweb3://web3:12/wallet/connect']){
  const f=fixture({link:()=>({deepLink})}),p=f.mobile.connect();f.events.get('okx_engine_connect_params')({connectRequest:{topic:'test'}});assert.equal(f.mobile.reopen(),false);assert.equal(f.opens.length,0);f.connect();await p;
 }
});

test('restored mobile namespace supplies account and chain without a relay RPC or opening OKX',async()=>{
 const f=fixture();f.sdk.session={namespaces:{eip155:{accounts:['eip155:196:'+address]}}};
 assert.equal(await f.mobile.provider.request({method:'eth_chainId'}),'0xc4');assert.deepEqual(await f.mobile.provider.request({method:'eth_accounts'}),[address]);await f.mobile.connect();assert.equal(f.requests.length,0);assert.equal(f.opens.length,0);
 f.sdk.session=null;assert.equal(await f.mobile.provider.request({method:'eth_chainId'}),'0x0');
});
