import test from 'node:test';import assert from 'node:assert/strict';import{EmberFinance}from'../server/finance.mjs';
const good=result=>({ok:true,status:200,headers:new Headers(),json:async()=>({result})});
const bad=(status=403)=>({ok:false,status,headers:new Headers({'Retry-After':'2'}),json:async()=>({error:{message:status===429?'too many requests':'Forbidden'}})});
test('unavailable witness falls back with chain validation, coalesces and preserves fixed-block agreement',async t=>{
 const f=new EmberFinance(null,null);t.after(()=>f.close());const calls=[];
 t.mock.method(globalThis,'fetch',async(url,o)=>{const q=JSON.parse(o.body);calls.push({url,...q});if(url.includes('drpc'))return bad();if(q.method==='eth_chainId')return good('0xc4');assert.ok(['0x100','0x101'].includes(q.params.at(-1)));return good('0x12');});
 assert.deepEqual(await Promise.all([f.agreed('eth_getBalance',['wallet','0x100']),f.agreed('eth_getBalance',['wallet','0x100'])]),['0x12','0x12']);
 assert.equal(await f.agreed('eth_getBalance',['wallet','0x101']),'0x12'); // separate block still respects endpoint cooldown
 assert.equal(calls.filter(c=>c.url.includes('drpc')).length,1);assert.equal(calls.filter(c=>c.url.includes('thirdweb')&&c.method==='eth_chainId').length,1);
 assert.equal(calls.filter(c=>c.method==='eth_getBalance'&&c.params[1]==='0x100').length,3);
});
test('fallback never accepts mismatching evidence or wrong chain',async t=>{
 const f=new EmberFinance(null,null);t.after(()=>f.close());t.mock.method(globalThis,'fetch',async(url,o)=>{const q=JSON.parse(o.body);if(url.includes('drpc'))return bad();return good(q.method==='eth_chainId'?'0xc4':url.includes('thirdweb')?'0x2':'0x1');});
 await assert.rejects(f.agreed('eth_getBalance',['wallet','0x100']),/CHAIN_DISAGREEMENT/);
 f.rpcChainChecks.clear();t.mock.method(globalThis,'fetch',async url=>url.includes('thirdweb')?good('0x38'):bad());await assert.rejects(f.rpc(1,'eth_getBalance',['wallet','0x101']),/WRONG_NETWORK/);
});
test('provider cooldown is respected, all unavailable fails closed, RPC semantic errors do not trigger fallback',async t=>{
 const f=new EmberFinance(null,null);t.after(()=>f.close());let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return bad(429)});
 await assert.rejects(f.rpc(1,'eth_blockNumber',[]),/CHAIN_BUSY/);assert.equal(calls,2);await assert.rejects(f.rpc(1,'eth_blockNumber',[]),/CHAIN_BUSY/);assert.equal(calls,2);
 f.priorityBackoff.clear();f.rpcChainChecks.clear();calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return{...good(null),json:async()=>({error:{code:3,message:'execution reverted'}})}});
 await assert.rejects(f.rpc(1,'eth_call',[{},'0x1']),/CHAIN_BUSY/);assert.equal(calls,1);
});
test('explicit test/private endpoint pairs never fall back to public services',async t=>{
 const f=new EmberFinance(null,null,{urls:['https://one.example','https://two.example']});t.after(()=>f.close());let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return bad()});await assert.rejects(f.rpc(1,'eth_chainId',[]),/CHAIN_BUSY/);assert.equal(calls,1);
});
