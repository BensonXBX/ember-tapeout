import test from 'node:test';import assert from 'node:assert/strict';import {EmberFinance} from '../server/finance.mjs';
const response=result=>({ok:true,status:200,headers:new Headers(),json:async()=>({result})});
test('deposit RPC bypasses scanner budget, delayed provider queue and local pacing; identical requests coalesce',async t=>{
 const p=new EmberFinance(null,null);t.after(()=>p.close());p.budget=()=>{throw Error('scanner reservation forbidden')};p.queues=[new Promise(()=>{}),new Promise(()=>{})];p.calls=[Array(72).fill(Date.now()),Array(72).fill(Date.now())];let release;const gate=new Promise(r=>release=r);let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;await gate;return response('0x1')});
 const first=p.rpc(0,'eth_call',[{},'0x1']),duplicate=p.priority(()=>p.rpc(0,'eth_call',[{},'0x1'])),other=p.priority(()=>p.rpc(0,'eth_call',[{},'0x2']));await new Promise(r=>setImmediate(r));assert.equal(calls,2);release();assert.deepEqual(await Promise.all([first,duplicate,other]),['0x1','0x1','0x1']);assert.equal(p.priorityReads.size,0);
});
test('provider Retry-After remains effective without an internal wait queue',async t=>{const p=new EmberFinance(null,null);t.after(()=>p.close());let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return{ok:false,status:429,headers:new Headers({'Retry-After':'2'}),json:async()=>({error:{message:'too many requests'}})}});await assert.rejects(p.priority(()=>p.rpc(0,'eth_blockNumber',[])),/CHAIN_BUSY/);await assert.rejects(p.priority(()=>p.rpc(0,'eth_blockNumber',[])),/CHAIN_BUSY/);assert.equal(calls,1);assert.equal(p.priorityReads.size,0);});
test('safe verification still requires both providers and is not held by a background block job',async t=>{const p=new EmberFinance(null,null);t.after(()=>p.close());p.chainVerified=true;p.safeBlockJob=new Promise(()=>{});p.budget=()=>{throw Error('queued')};let calls=0;t.mock.method(globalThis,'fetch',async(_,o)=>{calls++;const q=JSON.parse(o.body);assert.equal(q.params[0],'safe');return response({number:'0x100',timestamp:'0x123',hash:'0xabc'});});assert.equal(await p.priority(()=>p.block()),'0x100');assert.equal(calls,2);p.safeBlock=null;t.mock.method(globalThis,'fetch',async url=>response({number:'0x101',timestamp:'0x123',hash:url.includes('drpc')?'0xdef':'0xabc'}));await assert.rejects(p.priority(()=>p.block()),/CHAIN_DISAGREEMENT/);});
test('all player finance routes bypass the old quota, including reward history, balances and claims',async t=>{
 const p=new EmberFinance(null,null);t.after(()=>p.close());const immediate=()=>{assert.equal(p.priorityContext.getStore(),true);return {priority:true}};
 p.row=async()=>({row:{status:'playing'},p:{payment:{}}});p.sync=async()=>immediate();p.history=async(_user,options)=>options?.page?{matches:[immediate()],nextCursor:null}:[immediate()];p.balances=async()=>immediate();p.paymentStatus=async()=>immediate();p.agreed=async()=>{immediate();return '0x1'};p.settlement=async()=>{immediate();throw Error('SETTLEMENT_PENDING')};p.db={prepare(){throw Error('regular quota')}};
 for(const action of ['history','status-keys'])assert.deepEqual(await p.handle('user',{action,keys:[]}),{matches:[{priority:true}]});assert.deepEqual(await p.handle('user',{action:'claimable'}),{matches:[{priority:true}],nextCursor:null});
 for(const action of ['balances','payment-status','sync'])assert.deepEqual(await p.handle('user',{action,key:'0x'+'a'.repeat(64)}),{priority:true});
 for(const action of ['claim','collect'])await assert.rejects(p.handle('user',{action,key:'0x'+'a'.repeat(64),keys:['0x'+'a'.repeat(64)]}),/SETTLEMENT_PENDING/);
 assert.equal(p.priorityContext.getStore(),undefined);
});
test('configuration and admin verification also start without scanner queues',async t=>{
 const p=new EmberFinance(null,null);t.after(()=>p.close());p.config={escrow:'0x'+'1'.repeat(40)};p.verify=async()=>{assert.equal(p.priorityContext.getStore(),true);p.verified=true};await p.configuration();p.verified=false;await p.admin({action:'ember-status'});assert.equal(p.verified,true);
});


test('a reverted receipt unlocks retries only after two-node safe canonical and exact transaction checks',async t=>{
 const {createHash}=await import('node:crypto'),p=new EmberFinance(null,null);t.after(()=>p.close());const user='0x'+'1'.repeat(40),hash='0x'+'a'.repeat(64),blockHash='0x'+'b'.repeat(64),tx={from:user,to:'0x'+'2'.repeat(40),nonce:'0x4',value:'0x0',input:'0x1234',blockHash},commitment='0x'+createHash('sha256').update(JSON.stringify([tx.to,tx.input,'0'])).digest('hex'),r={from:user,kind:'fund',hash,nonce:'0x4',commitment};
 p.block=async()=>'0x10';p.rpc=async()=>({blockHash,blockNumber:'0xf',status:'0x0'});p.agreed=async method=>method==='eth_getTransactionByHash'?tx:{hash:blockHash};assert.equal((await p.paymentStatus(user,r)).status,'failed');
 p.agreed=async method=>method==='eth_getTransactionByHash'?{...tx,to:user}:{hash:blockHash};await assert.rejects(p.paymentStatus(user,r),/PAYMENT_MISMATCH/);
 p.agreed=async method=>method==='eth_getTransactionByHash'?tx:{hash:'0xother'};await assert.rejects(p.paymentStatus(user,r),/PAYMENT_MISMATCH/);
 p.block=async()=>'0xe';p.agreed=async()=>'0x5';assert.equal((await p.paymentStatus(user,r)).status,'consumed');
 p.rpc=async i=>({blockHash:i?'0xother':blockHash,blockNumber:'0xf',status:'0x0'});p.block=async()=>'0x10';assert.equal((await p.paymentStatus(user,r)).status,'consumed');
});
