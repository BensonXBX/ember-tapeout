import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {openArenaDatabase} from '../server/sqlite-db.mjs';import {EmberFinance} from '../server/finance.mjs';
const schema=new URL('../server/schema.sql',import.meta.url),wallets=['0x'+'1'.repeat(40),'0x'+'2'.repeat(40)],escrow='0x'+'3'.repeat(40);
async function fixture(t){const db=openArenaDatabase(':memory:',schema),f=new EmberFinance(db,null);t.after(()=>{f.close();db.close()});return{db,f,async add(code,overrides={},status='funding'){const now=Math.floor(Date.now()/1000),payment={key:'0x'+code.padStart(64,'0'),asset:0,stake:'100',escrow,createdAt:Date.now(),fundUntil:now+180,paid:[false,false],...overrides};await db.prepare('INSERT INTO arena_rooms VALUES(?,?,?,?,?,?,?)').bind(code,status,0,Date.now(),Date.now()+600000,0,JSON.stringify({wallets,payment})).run();return payment;}};}
test('background safe validation begins before admission, continues after finish, and stops when ready without any claim request',async t=>{
 const {f,add}=await fixture(t),q=await add('1',{latestPaid:[true,false]}),now=Math.floor(Date.now()/1000);let paid=[true,false],time=now,block='0x10';
 f.block=async()=>{f.safeBlock={timestamp:time};return block};f.call=async()=>[{state:2,players:wallets,asset:0,stake:100n,paid,withdrawn:[false,false],payout:[0n,0n],fundedAt:BigInt(now)}];
 await f.maintainFinality();let pair=await f.row(wallets[0],q.key);assert.deepEqual(pair.p.payment.paid,[true,false]);assert.equal(pair.p.payment.admission,undefined);
 pair.p.payment.admission={block:'0x11',fundedAt:now};pair.p.payment.endedAt=now;pair.p.payment.checkedAt=0;await f.db.prepare('UPDATE arena_rooms SET status=?,payload=? WHERE code=?').bind('finished',JSON.stringify(pair.p),'1').run();
 block='0x12';paid=[true,true];time=now+10;await f.maintainFinality();pair=await f.row(wallets[0],q.key);assert.equal(f.settlementReady(pair.p.payment),true);assert.deepEqual(await f.maintainFinality(),{selected:0,failed:0});
});
test('cancelled single-sided deposit is checked in background before refunds are attempted',async t=>{
 const {f,add}=await fixture(t),now=Math.floor(Date.now()/1000),q=await add('2',{cancelled:true,endedAt:now,checkedChainTime:now-10,latestPaid:[true,false]},'cancelled');
 f.block=async()=>{f.safeBlock={timestamp:now+1};return '0x20'};f.call=async()=>[{state:1,players:wallets,asset:0,stake:100n,paid:[true,false],withdrawn:[false,false],payout:[0n,0n],fundedAt:0n}];
 await f.maintainFinality();const {p}=await f.row(wallets[0],q.key);assert.equal(f.settlementReady(p.payment),true);assert.deepEqual(p.payment.paid,[true,false]);assert.deepEqual(await f.maintainFinality(),{selected:0,failed:0});
});
test('failed oldest work rotates fairly within the bounded batch and no overlapping pass is started',async t=>{
 const {f,add}=await fixture(t);for(let i=1;i<=10;i++)await add(String(i));let release;const gate=new Promise(r=>release=r),seen=[];f.sync=async(_user,key)=>{seen.push(key);await gate;throw Error('CHAIN_BUSY')};
 const first=f.maintainFinality();await new Promise(r=>setImmediate(r));assert.equal(seen.length,8);await f.maintainFinality();assert.equal(seen.length,8);release();assert.deepEqual(await first,{selected:8,failed:8});await f.maintainFinality();assert.equal(new Set(seen).size,10);
});
test('existing service timer checks finality every five seconds and retains minute cleanup',()=>{const s=readFileSync(new URL('../server/server.mjs',import.meta.url),'utf8');assert.match(s,/}, 5_000\)\.unref/);assert.match(s,/Date\.now\(\)-lastCleanup<60_000/);assert.ok(s.indexOf('finance.maintainFinality()',s.indexOf('const cleanup'))<s.indexOf('lastCleanup<60_000'));});
