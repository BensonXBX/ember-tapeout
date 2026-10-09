import test from 'node:test';import assert from 'node:assert/strict';import {openArenaDatabase}from'../server/sqlite-db.mjs';import{EmberFinance}from'../server/finance.mjs';
test('claimable seek pages do not skip older rewards when safe reads mark a preceding page withdrawn',async()=>{
 const db=openArenaDatabase(':memory:',new URL('../server/schema.sql',import.meta.url)),f=new EmberFinance(db,null),user='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40),escrow='0x'+'3'.repeat(40);try{
 for(let i=1;i<=25;i++){const q={key:'0x'+i.toString(16).padStart(64,'0'),escrow,asset:0,stake:'100',paid:[true,true],createdAt:1000,endedAt:1,winner:0};await db.prepare('INSERT INTO arena_rooms VALUES(?,?,?,?,?,?,?)').bind(String(i).padStart(6,'0'),'finished',0,1000,2000,0,JSON.stringify({wallets:[user,other],payment:q})).run();}
 f.block=async()=>{f.safeBlock={timestamp:100};return'0x10'};f.call=async(name,[keys])=>[keys.map(key=>({state:3,players:[user,other],asset:0,stake:100n,paid:[true,true],withdrawn:[parseInt(key.slice(2),16)>5,false],payout:[180n,0n],fundedAt:0n}))];
 const first=await f.handle(user,{action:'claimable'});assert.equal(first.matches.length,20);assert.ok(first.matches.every(m=>m.withdrawn));assert.equal(first.nextCursor.code,'000006');
 const next=await f.handle(user,{action:'claimable',cursor:first.nextCursor});assert.equal(next.matches.length,5);assert.ok(next.matches.every(m=>!m.withdrawn));assert.equal(next.nextCursor,null);assert.equal(new Set([...first.matches,...next.matches].map(m=>m.key)).size,25);
 assert.equal((await f.handle(other,{action:'claimable'})).matches.length,0);await assert.rejects(f.handle(user,{action:'claimable',cursor:{createdAt:1000,code:"' OR 1=1"}}),/INVALID_ACTION/);
 }finally{f.close();db.close()}
});
