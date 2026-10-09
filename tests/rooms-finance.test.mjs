import test from 'node:test';import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {openArenaDatabase} from '../server/sqlite-db.mjs';import {handleArena} from '../server/arena-server.mjs';import {EmberFinance} from '../server/finance.mjs';
const schema=new URL('../server/schema.sql',import.meta.url),origin='https://ember.example';
const hash=s=>createHash('sha256').update(s).digest('hex');
async function fixture(){const db=openArenaDatabase(':memory:',schema);const wallets=['0x'+'1'.repeat(40),'0x'+'2'.repeat(40)],sessions=[randomBytes(24).toString('hex'),randomBytes(24).toString('hex')];for(let i=0;i<2;i++){await db.prepare('INSERT INTO ember_profiles VALUES(?,?,?)').bind(wallets[i],'Player '+i,Date.now()).run();await db.prepare('INSERT INTO ember_sessions VALUES(?,?,?,?)').bind(hash(sessions[i]),wallets[i],origin,Date.now()+3600000).run();}const finance={public:()=>({enabled:true}),balances:async()=>({}),terms:async()=>({key:'0x'+randomBytes(32).toString('hex'),asset:0,stake:'10000000000000000',escrow:'0x'+'3'.repeat(40),paid:[false,false],createdAt:Date.now()})};return{db,wallets,sessions,finance,async call(body){const res=await handleArena(new Request(origin+'/api/arena',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)}),db,[],finance);return{status:res.status,...await res.json()};}};}
test('created room remains in public list; payment terms cannot leak credentials; funding does not start fight',async()=>{const f=await fixture();try{const a=await f.call({action:'create',character:0,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}});assert.equal(a.status,'waiting');const list=await f.call({action:'list'});assert.equal(list.rooms[0].code,a.code);assert.equal(list.rooms[0].stake,'10000000000000000');assert.equal(JSON.stringify(list).includes(a.token),false);const b=await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[1]});assert.equal(b.status,'funding');assert.equal(b.state[1],0);let s=await f.call({action:'input',code:a.code,token:a.token,seq:1,mask:16,edges:16});assert.equal(s.status,'funding');let row=await f.db.prepare('SELECT * FROM arena_rooms WHERE code=?').bind(a.code).first(),p=JSON.parse(row.payload);p.payment.paid=[true,false];await f.db.prepare('UPDATE arena_rooms SET payload=? WHERE code=?').bind(JSON.stringify(p),a.code).run();s=await f.call({action:'input',code:a.code,token:a.token,seq:2,mask:0,edges:0});assert.equal(s.status,'funding');row=await f.db.prepare('SELECT * FROM arena_rooms WHERE code=?').bind(a.code).first();p=JSON.parse(row.payload);p.payment.paid=[true,true];await f.db.prepare('UPDATE arena_rooms SET payload=? WHERE code=?').bind(JSON.stringify(p),a.code).run();s=await f.call({action:'input',code:a.code,token:a.token,seq:3,mask:0,edges:0});assert.equal(s.status,'playing');assert.equal(s.state[1],1);await f.call({action:'leave',code:b.code,token:b.token});row=await f.db.prepare('SELECT * FROM arena_rooms WHERE code=?').bind(a.code).first();p=JSON.parse(row.payload);assert.equal(p.payment.winner,0);assert.ok(p.payment.endedAt);assert.ok(p.payment.evidence);}finally{f.db.close();}});
test('funding departure cancels instead of awarding a win; deposit room cannot be reused by same wallet',async()=>{const f=await fixture();try{const a=await f.call({action:'create',character:0,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}});assert.equal((await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[0]})).error,'SAME_WALLET');const b=await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[1]});await f.call({action:'leave',code:b.code,token:b.token});const row=await f.db.prepare('SELECT * FROM arena_rooms WHERE code=?').bind(a.code).first(),p=JSON.parse(row.payload);assert.equal(row.status,'cancelled');assert.equal(p.payment.cancelled,true);assert.equal(p.payment.winner,undefined);}finally{f.db.close();}});
test('unconfigured escrow rejects paid creation; free room still works',async()=>{const f=await fixture();try{f.finance.public=()=>({enabled:false});f.finance.terms=async()=>{throw Object.assign(Error('ESCROW_UNAVAILABLE'),{status:409})};assert.equal((await f.call({action:'create',character:0,walletSession:f.sessions[0],deposit:{asset:0,amount:'1'}})).error,'ESCROW_UNAVAILABLE');const a=await f.call({action:'create',character:0,walletSession:f.sessions[0]});assert.equal(a.status,'waiting');const b=await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[1]});assert.equal(b.status,'playing');}finally{f.db.close();}});

test('legacy quick matching cannot create or bypass a paid room',async()=>{const f=await fixture();try{const r=await f.call({action:'match',character:0,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}});assert.equal(r.error,'PAID_MATCH_REQUIRES_ROOM');assert.equal((await f.call({action:'list'})).rooms.length,0);}finally{f.db.close();}});

test('same-wallet concurrent create is atomic; an offline unpaired room cannot trap a refreshed client',async()=>{const f=await fixture();try{f.finance.terms=async()=>{await new Promise(r=>setTimeout(r,20));return{key:'0x'+randomBytes(32).toString('hex'),asset:0,stake:'10000000000000000',escrow:'0x'+'3'.repeat(40),paid:[false,false],createdAt:Date.now()}};const body={action:'create',character:0,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}};const results=await Promise.all([f.call(body),f.call(body)]);assert.equal(results.filter(r=>r.status==='waiting').length,1);assert.equal(results.filter(r=>r.error==='ACTIVE_ROOM').length,1);await f.db.prepare('UPDATE arena_rooms SET updated=?').bind(Date.now()-16000).run();const fresh=await f.call(body);assert.equal(fresh.status,'waiting');}finally{f.db.close();}});

test('anonymous and stale-session players can create/join free rooms; room secrets still protect controls',async()=>{const f=await fixture();try{
 const a=await f.call({action:'create',character:0}),other=await f.call({action:'create',character:1,walletSession:'expired'});assert.equal(a.status,'waiting');assert.equal(other.status,'waiting');assert.notEqual(a.token,other.token);
 const b=await f.call({action:'join',code:a.code,character:1,walletSession:'expired'});assert.equal(b.status,'playing');assert.equal(b.payment,null);
 assert.equal((await f.call({action:'input',code:a.code,token:other.token,seq:1,mask:2,edges:0})).status,401);
 assert.equal((await f.call({action:'leave',code:a.code,token:other.token})).status,401);
 assert.equal((await f.call({action:'leave',code:a.code,token:b.token})).ok,true);
 const p=JSON.parse((await f.db.prepare('SELECT payload FROM arena_rooms WHERE code=?').bind(a.code).first()).payload);assert.deepEqual(p.wallets,['','']);assert.equal(p.payment,undefined);
 }finally{f.db.close();}});
test('free choice cannot bypass deposit admission or origin-bound wallet auth',async()=>{const f=await fixture();try{
 assert.equal((await f.call({action:'create',character:0,deposit:{asset:0,amount:'0.01'}})).error,'LOGIN_REQUIRED');
 const a=await f.call({action:'create',character:0,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}});
 for(const walletSession of [undefined,'expired',randomBytes(24).toString('hex')])assert.equal((await f.call({action:'join',code:a.code,character:1,deposit:null,walletSession})).error,'LOGIN_REQUIRED');
 const row=await f.db.prepare('SELECT status,payload FROM arena_rooms WHERE code=?').bind(a.code).first();assert.equal(row.status,'waiting');assert.equal(JSON.parse(row.payload).tokens[1],'');
 }finally{f.db.close();}});
test('new passwords are rejected; legacy private rooms are neither exposed nor unlocked',async()=>{const f=await fixture();try{
 assert.equal((await f.call({action:'create',character:0,password:'secret'})).error,'PASSWORD_ROOMS_DISABLED');const a=await f.call({action:'create',character:0});
 const p=JSON.parse((await f.db.prepare('SELECT payload FROM arena_rooms WHERE code=?').bind(a.code).first()).payload);p.lock={salt:'old',hash:'old'};await f.db.prepare('UPDATE arena_rooms SET payload=? WHERE code=?').bind(JSON.stringify(p),a.code).run();
 assert.equal((await f.call({action:'list'})).rooms.length,0);assert.equal((await f.call({action:'join',code:a.code,character:1})).error,'PASSWORD_ROOMS_DISABLED');assert.equal((await f.call({action:'leave',code:a.code,token:a.token})).ok,true);
 }finally{f.db.close();}});
test('anonymous free play retains the existing IP admission throttle',async()=>{const f=await fixture();try{for(let i=0;i<20;i++)assert.equal((await f.call({action:'create',character:0})).status,'waiting');assert.equal((await f.call({action:'create',character:0})).status,429);}finally{f.db.close();}});

test('safe finality lag cannot expire a paid room before evidence catches up',async()=>{
 for(const paid of [[true,true],[true,false]]){const f=await fixture();try{
 const a=await f.call({action:'create',character:0,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}});await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[1]});
 const get=async()=>JSON.parse((await f.db.prepare('SELECT payload FROM arena_rooms WHERE code=?').bind(a.code).first()).payload);
 let p=await get();p.payment.fundUntil=Math.floor(Date.now()/1000)-5;p.payment.checkedChainTime=p.payment.fundUntil-200;await f.db.prepare('UPDATE arena_rooms SET payload=? WHERE code=?').bind(JSON.stringify(p),a.code).run();
 const input=seq=>f.call({action:'input',code:a.code,token:a.token,seq,mask:0,edges:0});assert.equal((await input(1)).status,'funding');
 p=await get();p.payment.paid=paid;p.payment.checkedChainTime=p.payment.fundUntil+1;await f.db.prepare('UPDATE arena_rooms SET payload=? WHERE code=?').bind(JSON.stringify(p),a.code).run();
 assert.equal((await input(2)).status,paid.every(Boolean)?'playing':'cancelled');
 }finally{f.db.close();}}
});
test('admission never performs RPC balances; payment checks remain in finance',async()=>{const f=await fixture();try{f.finance.balances=()=>{throw Error('unexpected slow balance admission')};const a=await f.call({action:'create',character:0,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}});assert.equal((await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[1]})).status,'funding');}finally{f.db.close();}});

test('paid selection is server-timed, shared, slot-bound, locked and starts only after ten seconds',async()=>{
 const f=await fixture();try{
 const a=await f.call({action:'create',character:0,selectionVersion:1,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}}),b=await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[1]});
 const read=async()=>JSON.parse((await f.db.prepare('SELECT payload FROM arena_rooms WHERE code=?').bind(a.code).first()).payload),write=p=>f.db.prepare('UPDATE arena_rooms SET payload=? WHERE code=?').bind(JSON.stringify(p),a.code).run();
 const input=(who,seq,extra={})=>f.call({action:'input',code:a.code,token:who.token,seq,mask:16,edges:16,...extra});
 assert.equal((await input(a,1,{character:1})).selection,null);
 let p=await read();p.payment.paid=[true,true];await write(p);
 let v=await input(a,2);assert.equal(v.status,'funding');assert.equal(v.state[1],0);assert.ok(v.selection.until-v.selection.serverTime>9900);
 v=await input(a,3,{character:1,locked:true});assert.equal(v.selection.characters[0],1);
 v=await input(b,1,{character:0});assert.deepEqual(v.selection.characters,[1,0]);assert.deepEqual(v.selection.locked,[true,false]);
 v=await input(a,4,{character:0});assert.equal(v.selection.characters[0],1);
 assert.equal((await input(b,2,{character:5})).status,400);
 p=await read();p.selection.until=Date.now()-1;await write(p);
 v=await input(b,3,{character:1});assert.equal(v.status,'playing');assert.equal(v.selection,null);assert.equal(v.state[27],1);assert.equal(v.state[55],0);assert.equal(v.state[1],1);
 }finally{f.db.close();}
});
test('leaving paid selection cancels for refund, never awards a forfeit',async()=>{
 const f=await fixture();try{const a=await f.call({action:'create',character:0,selectionVersion:1,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}});await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[1]});let p=JSON.parse((await f.db.prepare('SELECT payload FROM arena_rooms WHERE code=?').bind(a.code).first()).payload);p.payment.paid=[true,true];await f.db.prepare('UPDATE arena_rooms SET payload=? WHERE code=?').bind(JSON.stringify(p),a.code).run();assert.ok((await f.call({action:'input',code:a.code,token:a.token,seq:1,mask:0,edges:0})).selection);await f.call({action:'leave',code:a.code,token:a.token});const row=await f.db.prepare('SELECT * FROM arena_rooms WHERE code=?').bind(a.code).first();p=JSON.parse(row.payload);assert.equal(row.status,'cancelled');assert.equal(p.payment.cancelled,true);assert.equal(p.payment.winner,undefined);}finally{f.db.close();}
});

test('verified latest admission unlocks ten-second selection without modifying safe credit',async()=>{
 const f=await fixture();try{const a=await f.call({action:'create',character:0,selectionVersion:1,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}});const b=await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[1]});
 const read=async()=>JSON.parse((await f.db.prepare('SELECT payload FROM arena_rooms WHERE code=?').bind(a.code).first()).payload),write=p=>f.db.prepare('UPDATE arena_rooms SET payload=? WHERE code=?').bind(JSON.stringify(p),a.code).run();
 let p=await read();p.payment.latestPaid=[true,false];await write(p);let v=await f.call({action:'input',code:a.code,token:a.token,seq:1,mask:0,edges:0});assert.equal(v.selection,null);assert.deepEqual(v.payment.paid,[true,false]);
 p=await read();p.payment.admission={block:'0x100',hash:'canonical',fundedAt:Math.floor(Date.now()/1000),at:Date.now()};p.payment.latestPaid=[true,true];await write(p);
 v=await f.call({action:'input',code:a.code,token:a.token,seq:2,mask:0,edges:0});assert.ok(v.selection);assert.deepEqual((await read()).payment.paid,[false,false]);
 p=await read();p.selection.until=Date.now()-1;await write(p);v=await f.call({action:'input',code:a.code,token:b.token,seq:1,mask:0,edges:0});assert.equal(v.status,'playing');assert.equal(v.selection,null);assert.equal(v.state[1],1);
 }finally{f.db.close();}
});

test('latest admission does not await safe RPC and survives a new finance instance',async()=>{
 const f=await fixture(),live=new EmberFinance(f.db,null,{depositRoomsEnabled:true});try{const a=await f.call({action:'create',character:0,selectionVersion:1,walletSession:f.sessions[0],deposit:{asset:0,amount:'0.01'}});await f.call({action:'join',code:a.code,character:1,walletSession:f.sessions[1]});const row=await f.db.prepare('SELECT payload FROM arena_rooms WHERE code=?').bind(a.code).first(),p=JSON.parse(row.payload),q=p.payment;live.block=async tag=>{assert.equal(tag,'latest');live.liveBlock={hash:'canonical',timestamp:Math.floor(Date.now()/1000)};return'0x100';};live.call=async()=>[{state:2,paid:[true,true],players:p.wallets,stake:BigInt(q.stake),asset:q.asset,fundUntil:q.fundUntil,fundedAt:Math.floor(Date.now()/1000)}];live.sync=()=>new Promise(()=>{});
 const v=await Promise.race([live.handle(p.wallets[0],{action:'sync',key:q.key}),new Promise((_,reject)=>setTimeout(()=>reject(Error('safe RPC blocked admission')),200))]);assert.deepEqual(v.paid,[true,true]);assert.deepEqual(v.chainPaid,[false,false]);
 const restored=new EmberFinance(f.db,null);try{const pair=await restored.row(p.wallets[0],q.key),saved=restored.projection(pair.row,pair.p,p.wallets[0]);assert.deepEqual(saved.paid,[true,true]);assert.equal(saved.settlementReady,false);}finally{restored.close();}
 }finally{live.close();f.db.close();}
});


test('free rooms select after joining, share both cursors and start at the shared deadline',async()=>{
 const f=await fixture();try{
 const a=await f.call({action:'create',character:1,selectionVersion:1});assert.equal(a.status,'waiting');assert.equal(a.selection,undefined);
 const b=await f.call({action:'join',code:a.code,character:0});assert.equal(b.status,'funding');assert.equal(b.payment,null);assert.equal(b.state[1],0);assert.deepEqual(b.selection.characters,[0,1]);
 const input=(who,seq,extra={})=>f.call({action:'input',code:a.code,token:who.token,seq,mask:16,edges:16,...extra});
 let v=await input(a,1,{character:1});assert.deepEqual(v.selection.characters,[1,1]);assert.equal(v.selection.until,b.selection.until);assert.equal(v.state[1],0);
 v=await input(b,1,{character:0,locked:true});assert.deepEqual(v.selection.characters,[1,0]);assert.deepEqual(v.selection.locked,[false,true]);
 v=await input(b,2,{character:1});assert.deepEqual(v.selection.characters,[1,0]);
 v=await input(a,2,{locked:true});assert.equal(v.status,'funding');assert.deepEqual(v.selection.locked,[true,true]);
 let p=JSON.parse((await f.db.prepare('SELECT payload FROM arena_rooms WHERE code=?').bind(a.code).first()).payload);p.selection.until=Date.now()-1;await f.db.prepare('UPDATE arena_rooms SET payload=? WHERE code=?').bind(JSON.stringify(p),a.code).run();
 v=await input(a,3);assert.equal(v.status,'playing');assert.equal(v.selection,null);assert.equal(v.state[27],1);assert.equal(v.state[55],0);assert.equal(v.state[1],1);
 }finally{f.db.close();}
});
test('leaving free selection cancels preparation without a forfeit or payment',async()=>{
 const f=await fixture();try{const a=await f.call({action:'create',character:0,selectionVersion:1});const b=await f.call({action:'join',code:a.code,character:1});await f.call({action:'leave',code:a.code,token:b.token});const row=await f.db.prepare('SELECT * FROM arena_rooms WHERE code=?').bind(a.code).first();assert.equal(row.status,'cancelled');const p=JSON.parse(row.payload);assert.equal(p.payment,undefined);assert.equal(p.s[1],0);}finally{f.db.close();}
});
