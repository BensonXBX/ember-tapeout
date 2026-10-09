import {DEPOSIT_ROOMS_ENABLED} from '../public/feature-policy.mjs';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {randomBytes,createHash,createHmac} from 'node:crypto';
import {Wallet,Interface,JsonRpcProvider,FetchRequest,keccak256,toUtf8Bytes,getCreateAddress} from './vendor/finance-ethers.mjs';
export const BEM='0x60e62efa9405d6873c5deabd4e6cc91c25363952';
export const artifact=JSON.parse(readFileSync(new URL('./escrow-artifact.json',import.meta.url)));
const abi=new Interface(artifact.abi),token=new Interface(['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)','function approve(address,uint256) returns(bool)','function decimals() view returns(uint8)']);
const address=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/i.test(v),fail=s=>{throw Object.assign(Error(s),{status:409})};
const types={Ticket:[{name:'id',type:'bytes32'},{name:'a',type:'address'},{name:'b',type:'address'},{name:'asset',type:'uint8'},{name:'stake',type:'uint256'},{name:'fundUntil',type:'uint256'},{name:'rulesHash',type:'bytes32'}],Result:[{name:'id',type:'bytes32'},{name:'winner',type:'uint8'},{name:'endedAt',type:'uint256'},{name:'evidence',type:'bytes32'}],Cancel:[{name:'id',type:'bytes32'}]};
export function amountRaw(value,asset){const d=asset===0?18:8;if(typeof value!=='string'||!/^\d{1,6}(?:\.\d{1,3})?$/.test(value))fail('INVALID_AMOUNT');const [n,f='']=value.split('.'),raw=BigInt(n)*10n**BigInt(d)+BigInt(f.padEnd(d,'0'));if(raw<=0n||raw>(asset===0?10n*10n**18n:100000n*10n**8n))fail('INVALID_AMOUNT');return raw.toString();}
export function normalized(code){let bytes=code.slice(2).toLowerCase().split('');for(const list of Object.values(artifact.immutables))for(const{start,length}of list)bytes.fill('0',start*2,(start+length)*2);return bytes.join('');}
export function finishPayment(p,status,now){const q=p.payment;if(!q||q.endedAt)return;if(status==='cancelled'){q.cancelled=true;q.endedAt=Math.floor(now/1000);}else if(status==='finished'){q.endedAt=Math.floor(now/1000);q.winner=p.s[7]<0?2:p.s[7];q.score=[p.s[4],p.s[5]];q.evidence='0x'+createHash('sha256').update(JSON.stringify({state:p.s,inputs:p.inputs,logs:p.logs})).digest('hex');}}
export class EmberFinance {
 constructor(db,file,options={}){this.depositRoomsEnabled=options.depositRoomsEnabled??DEPOSIT_ROOMS_ENABLED;this.db=db;this.file=file;this.config=file&&existsSync(file)?JSON.parse(readFileSync(file)):null;this.signer=this.config?new Wallet(this.config.refereeKey):null;this.verified=false;this.busy=new Map();this.cache=new Map();this.providers=(options.urls||['https://rpc.xlayer.tech','https://xlayerrpc.okx.com']).map(url=>{const r=new FetchRequest(url);r.timeout=8000;return new JsonRpcProvider(r,196,{staticNetwork:true,batchMaxCount:1,cacheTimeout:-1});});this.urls=options.urls||['https://rpc.xlayer.tech','https://xlayerrpc.okx.com'];this.budgetKey=process.env.EMBER_ADMIN_KEY_FILE?readFileSync(process.env.EMBER_ADMIN_KEY_FILE,'utf8').trim():'';this.queues=this.providers.map(()=>Promise.resolve());this.calls=this.providers.map(()=>[]);}
 public(){return{depositRoomsEnabled:this.depositRoomsEnabled,chainId:196,bem:BEM,escrow:this.config?.escrow||null,enabled:!!this.config?.escrow&&this.verified&&!this.paused,paused:!!this.paused,configured:!!this.config?.escrow&&this.verified,legacy:(this.config?.legacy||[]).map(escrow=>({escrow})),feeBps:1000,claimDelay:60,fundSeconds:180,referee:this.signer?.address||null};}
 async budget(body){
  if(!this.budgetKey){if(process.env.NODE_ENV==='production')fail('BUDGET_UNAVAILABLE');return{ok:true};}
  const raw=JSON.stringify(body),stamp=String(Date.now()),nonce=randomBytes(16).toString('hex'),signature=createHmac('sha256',this.budgetKey).update(stamp+'\n'+nonce+'\n'+raw).digest('hex');
  const r=await fetch('http://127.0.0.1:3210/api/internal/ember-rpc-budget',{method:'POST',headers:{'Content-Type':'application/json','X-Arena-Time':stamp,'X-Arena-Nonce':nonce,'X-Arena-Signature':signature},body:raw,signal:AbortSignal.timeout(3000)});if(!r.ok)fail('BUDGET_UNAVAILABLE');return r.json();
 }
 async rpc(i,method,params){
  this.pendingCount=(this.pendingCount||0)+1;if(this.pendingCount>16){this.pendingCount--;fail('CHAIN_BUSY');}
  const deadline=Date.now()+30000;
  const task=this.queues[i].catch(()=>{}).then(async()=>{
   for(;;){const now=Date.now();this.calls[i]=this.calls[i].filter(t=>now-t<60000);const recent=this.calls[i].filter(t=>now-t<5000);const delay=Math.max(recent.length>=6?5005-(now-recent[0]):0,this.calls[i].length>=72?60005-(now-this.calls[i][0]):0);if(now+delay>deadline)fail('CHAIN_BUSY');if(delay<=0)break;await new Promise(r=>setTimeout(r,delay));}
   for(;;){const reserved=await this.budget({action:'reserve',url:this.urls[i]});if(reserved.ok)break;const ms=Math.max(50,Math.min(30000,reserved.waitMs||1000));if(Date.now()+ms>deadline)fail('CHAIN_BUSY');await new Promise(r=>setTimeout(r,ms));}
   this.calls[i].push(Date.now());
   const r=await fetch(this.urls[i],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(8000)});
   let data;try{data=await r.json();}catch{if(r.status===429)await this.budget({action:'response',url:this.urls[i],limited:true,retryAfter:r.headers.get('Retry-After')||'60'});fail('CHAIN_BUSY');}
   const limited=r.status===429||/rate.limit|too many|quota/i.test(data.error?.message||'');
   if(limited)await this.budget({action:'response',url:this.urls[i],limited:true,retryAfter:r.headers.get('Retry-After')||'60'});
   if(!r.ok||data.error||!Object.hasOwn(data,'result'))fail('CHAIN_BUSY');return data.result;
  });this.queues[i]=task;try{return await task;}finally{this.pendingCount--;}
 }
 async agreed(method,params){const r=await Promise.all(this.providers.map((_,i)=>this.rpc(i,method,params)));if(JSON.stringify(r[0])!==JSON.stringify(r[1]))fail('CHAIN_DISAGREEMENT');return r[0];}
 async block(){
  if(this.safeBlock&&Date.now()-this.safeBlock.at<2000)return this.safeBlock.number;
  if(this.blockJob)return this.blockJob;
  this.blockJob=(async()=>{if(!this.chainVerified){const chains=await Promise.all(this.providers.map((_,i)=>this.rpc(i,'eth_chainId',[])));if(chains.some(c=>Number(c)!==196))fail('WRONG_NETWORK');this.chainVerified=true;}
   const blocks=await Promise.all(this.providers.map((_,i)=>this.rpc(i,'eth_getBlockByNumber',['safe',false])));if(blocks.some(x=>!x?.number))fail('CHAIN_BUSY');const n=Math.min(...blocks.map(x=>Number(x.number))),number='0x'+n.toString(16);this.safeBlock={number,at:Date.now()};return number;
  })();try{return await this.blockJob;}finally{this.blockJob=null;}
 }
 async call(name,args,to,block,iface=abi){const data=await this.agreed('eth_call',[{to,data:iface.encodeFunctionData(name,args)},block]);return iface.decodeFunctionResult(name,data);}
 async verify(target=this.config?.escrow){if(!address(target)||!this.signer)fail('ESCROW_UNAVAILABLE');const block=await this.block();if(normalized(await this.agreed('eth_getCode',[target,block]))!==normalized(artifact.runtime))fail('CONTRACT_MISMATCH');const ref=await this.call('referee',[],target,block),bem=await this.call('bem',[],target,block);if(ref[0].toLowerCase()!==this.signer.address.toLowerCase()||bem[0].toLowerCase()!==BEM)fail('CONTRACT_MISMATCH');const owner=(await this.call('owner',[],target,block))[0],paused=(await this.call('paused',[],target,block))[0];if(this.config?.escrow?.toLowerCase()===target.toLowerCase()){this.verified=true;this.paused=paused;}return{...this.public(),escrow:target,owner,paused};}
 async activate(target){if(this.config?.escrow&&this.config.escrow.toLowerCase()!==String(target).toLowerCase()){const active=await this.db.prepare("SELECT 1 FROM arena_rooms WHERE status IN ('waiting','funding','playing') AND expires>? AND json_type(payload,'$.payment') IS NOT NULL LIMIT 1").bind(Date.now()).first();if(active)fail('UPGRADE_ACTIVE');}const v=await this.verify(target);const legacy=[...new Set([...(this.config.legacy||[]),...(this.config.escrow&&this.config.escrow.toLowerCase()!==target.toLowerCase()?[this.config.escrow]:[])])].filter(a=>a.toLowerCase()!==target.toLowerCase());this.config={...this.config,escrow:target,owner:v.owner,legacy};writeFileSync(this.file+'.next',JSON.stringify(this.config),{mode:0o600});renameSync(this.file+'.next',this.file);this.verified=true;this.paused=v.paused;return this.public();}
 domain(q){return{name:'TapeOutEmber',version:'1',chainId:196,verifyingContract:q.escrow};}
 signature(name,value,q){return this.signer.signTypedData(this.domain(q),{[name]:types[name]},value);}
 async balances(user,asset,raw='0'){const block=await this.block();const native=BigInt(await this.agreed('eth_getBalance',[user,block])),bem=BigInt((await this.call('balanceOf',[user],BEM,block,token))[0]);if((asset===0?native:bem)<BigInt(raw))fail('INSUFFICIENT_BALANCE');return{native:native.toString(),bem:bem.toString(),block};}
 async terms(user,body){if(!this.depositRoomsEnabled)fail('DEPOSITS_UNAVAILABLE');if(!this.public().configured)fail('ESCROW_UNAVAILABLE');if(![0,1].includes(body.asset))fail('INVALID_AMOUNT');const block=await this.block();this.paused=(await this.call('paused',[],this.config.escrow,block))[0];if(this.paused)fail('DEPOSITS_PAUSED');const stake=amountRaw(body.amount,body.asset);await this.balances(user,body.asset,stake);return{key:'0x'+randomBytes(32).toString('hex'),escrow:this.config.escrow,asset:body.asset,stake,paid:[false,false],createdAt:Date.now()};}
 ticket(p){const q=p.payment;return{id:q.key,a:p.wallets[0],b:p.wallets[1],asset:q.asset,stake:q.stake,fundUntil:q.fundUntil,rulesHash:keccak256(toUtf8Bytes('ember-original-rules-1.1-scan.2:best-of-three:fee1000:delay60'))};}
 result(p){const q=p.payment;return{id:q.key,winner:q.winner,endedAt:q.endedAt,evidence:q.evidence};}
 async row(user,key){const row=await this.db.prepare("SELECT * FROM arena_rooms WHERE json_extract(payload,'$.payment.key')=?").bind(key).first();if(!row)fail('MATCH_NOT_FOUND');const p=JSON.parse(row.payload);if(!p.wallets?.includes(user))fail('PARTICIPANT');if((row.status==='funding'&&p.payment.fundUntil*1000<=Date.now())||(['waiting','playing'].includes(row.status)&&row.expires<=Date.now())){
   finishPayment(p,'cancelled',Date.now());const r=await this.db.prepare("UPDATE arena_rooms SET payload=?,status='cancelled',version=version+1 WHERE code=? AND version=?").bind(JSON.stringify(p),row.code,row.version).run();if(!r.meta.changes)return this.row(user,key);row.status='cancelled';row.version++;
  }return{row,p};}
 projection(row,p,user){const q=p.payment,s=p.wallets.indexOf(user),snap=q.snapshot;const paid=!!snap?.paid?.[s],withdrawn=!!snap?.withdrawn?.[s];let payout='0';if(snap&&snap.state>=3)payout=snap.payout[s];else if(q.cancelled&&paid)payout=q.stake;else if(q.endedAt&&paid)payout=q.winner===2?q.stake:q.winner===s?(BigInt(q.stake)*18n/10n).toString():'0';return{key:q.key,code:row.code,asset:q.asset,stake:q.stake,escrow:q.escrow,createdAt:q.createdAt,endedAt:q.endedAt||null,fundUntil:q.fundUntil||null,status:row.status,cancelled:!!q.cancelled,score:q.score||null,winner:q.winner,seat:s,paid:q.paid||[false,false],chainPaid:snap?.paid||[false,false],withdrawn,payout,claimAt:q.endedAt?(q.endedAt+(q.cancelled?0:60))*1000:null,chainState:snap?.state||0,checkedAt:q.checkedAt||null,serverTime:Date.now()};}
 async sync(user,key){if(this.busy.has(key)){await this.busy.get(key);const{row,p}=await this.row(user,key);return this.projection(row,p,user);}const work=this._sync(user,key);this.busy.set(key,work);try{return await work;}finally{this.busy.delete(key);}}
 async storeSnapshot(user,key,m,block){
  let {row,p}=await this.row(user,key);const q=p.payment,snapshot={state:Number(m.state),paid:Array.from(m.paid),withdrawn:Array.from(m.withdrawn),payout:Array.from(m.payout,String)};
  if(snapshot.state>0&&(m.players[0].toLowerCase()!==p.wallets[0]||m.players[1].toLowerCase()!==p.wallets[1]||Number(m.asset)!==q.asset||m.stake.toString()!==q.stake))fail('CONTRACT_MISMATCH');
  for(let i=0;i<8;i++){({row,p}=await this.row(user,key));if(p.payment.checkedBlock&&BigInt(p.payment.checkedBlock)>BigInt(block))return this.projection(row,p,user);p.payment.checkedBlock=block;p.payment.snapshot=snapshot;p.payment.checkedAt=Date.now();p.payment.paid=snapshot.paid;const r=await this.db.prepare('UPDATE arena_rooms SET payload=?,version=version+1 WHERE code=? AND version=?').bind(JSON.stringify(p),row.code,row.version).run();if(r.meta.changes)return this.projection(row,p,user);}fail('ROOM_BUSY');
 }
 async _sync(user,key){const{row,p}=await this.row(user,key),q=p.payment;if(q.checkedAt&&Date.now()-q.checkedAt<4000)return this.projection(row,p,user);const block=await this.block(),m=(await this.call('getMatch',[key],q.escrow,block))[0];return this.storeSnapshot(user,key,m,block);}
 async history(user,{offset=0,claimable=false,keys=null}={}){
  let rows;
  if(keys){if(!Array.isArray(keys)||keys.length>20||keys.some(k=>!/^0x[0-9a-f]{64}$/i.test(k)))fail('INVALID_ACTION');rows={results:await Promise.all(keys.map(async k=>(await this.row(user,k)).row))};}
  else{
   if(!Number.isSafeInteger(offset)||offset<0||offset>100000)fail('INVALID_ACTION');
   const seat="CASE WHEN json_extract(payload,'$.wallets[0]')=? THEN 0 ELSE 1 END";
   const outstanding=claimable?` AND json_extract(payload,'$.payment.endedAt') IS NOT NULL AND coalesce(json_extract(payload,'$.payment.snapshot.withdrawn['||(${seat})||']'),0)=0 AND coalesce(json_extract(payload,'$.payment.paid['||(${seat})||']'),0)=1 AND (json_extract(payload,'$.payment.cancelled')=1 OR json_extract(payload,'$.payment.winner')=2 OR json_extract(payload,'$.payment.winner')=(${seat}))`:'';
   rows=await this.db.prepare("SELECT * FROM arena_rooms WHERE json_type(payload,'$.payment') IS NOT NULL AND (json_extract(payload,'$.wallets[0]')=? OR json_extract(payload,'$.wallets[1]')=?)"+outstanding+" ORDER BY json_extract(payload,'$.payment.createdAt') DESC,code DESC LIMIT 20 OFFSET ?").bind(user,user,...(claimable?[user,user,user]:[]),offset).all();
  }
  const list=await Promise.all(rows.results.map(async row=>{const pair=await this.row(user,JSON.parse(row.payload).payment.key);return this.projection(pair.row,pair.p,user)}));
  const stale=list.filter(v=>!v.withdrawn&&(!v.checkedAt||Date.now()-v.checkedAt>5000));
  if(stale.length){const block=await this.block();for(const escrow of new Set(stale.map(v=>v.escrow))){const group=stale.filter(v=>v.escrow===escrow),values=(await this.call('getMatches',[group.map(v=>v.key)],escrow,block))[0];for(let n=0;n<group.length;n++)list[list.findIndex(v=>v.key===group[n].key)]=await this.storeSnapshot(user,group[n].key,values[n],block);}}
  return list;
 }
 plan(user,to,data,value='0x0'){return{chainId:196,from:user,to,data,value};}
 async handle(user,body){
  if(!this.depositRoomsEnabled&&['approve','fund'].includes(body.action))fail('DEPOSITS_UNAVAILABLE');
  if(body.action!=='config'){const minute=Math.floor(Date.now()/60000);const row=await this.db.prepare('INSERT INTO arena_limits(key,since,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind('finance:'+user+':'+minute,Date.now()).first();if(row.count>24)fail('CHAIN_BUSY');}
  if(body.action==='config')return this.public();
  if(body.action==='balances')return this.balances(user,0);
  if(body.action==='payment-status')return this.paymentStatus(user,body.transaction);
  if(body.action==='history')return{matches:await this.history(user,{offset:body.offset||0})};
  if(body.action==='claimable')return{matches:await this.history(user,{claimable:true})};
  if(body.action==='status-keys')return{matches:await this.history(user,{keys:body.keys})};
  if(body.action==='collect'){
   if(!Array.isArray(body.keys)||body.keys.length<1||body.keys.length>20||new Set(body.keys).size!==body.keys.length)fail('INVALID_ACTION');
   const results=[],refunds=[],signatures=[];let escrow='';
   for(const key of body.keys){const{row,p}=await this.row(user,key),q=p.payment,v=this.projection(row,p,user);if(!q.endedAt||Date.now()<v.claimAt)fail('CLAIM_WAIT');if(escrow&&escrow.toLowerCase()!==q.escrow.toLowerCase())fail('CONTRACT_MISMATCH');escrow=q.escrow;const result=q.cancelled?{id:key,winner:2,endedAt:0,evidence:'0x'+'0'.repeat(64)}:this.result(p);results.push(result);refunds.push(!!q.cancelled);signatures.push(await this.signature(q.cancelled?'Cancel':'Result',q.cancelled?{id:key}:result,q));}
   return this.plan(user,escrow,abi.encodeFunctionData('collect',[results,refunds,signatures]));
  }
  if(!/^0x[0-9a-f]{64}$/i.test(body.key||''))fail('MATCH_NOT_FOUND');
  const view=await this.sync(user,body.key);if(body.action==='sync')return view;
  const{row,p}=await this.row(user,body.key),q=p.payment;let data,to=q.escrow,value='0x0';
  if(body.action==='approve'||body.action==='fund'){
   if(row.status!=='funding'||q.fundUntil<=Math.floor(Date.now()/1000))fail('PREPARATION_ENDED');if(view.paid[view.seat])return{complete:true,match:view};
   await this.balances(user,q.asset,q.stake);
   if(q.asset===1){const allowance=(await this.call('allowance',[user,q.escrow],BEM,await this.block(),token))[0];if(body.action==='approve'){if(allowance>=BigInt(q.stake))return{complete:true};to=BEM;data=token.encodeFunctionData('approve',[q.escrow,q.stake]);}else if(allowance<BigInt(q.stake))fail('APPROVAL_REQUIRED');}
   if(!data){if(body.action==='approve')return{complete:true};const t=this.ticket(p);data=abi.encodeFunctionData('fund',[t,await this.signature('Ticket',t,q)]);value=q.asset===0?'0x'+BigInt(q.stake).toString(16):'0x0';}
  }else if(body.action==='claim'){
   if(view.withdrawn||BigInt(view.payout)===0n)return{complete:true,match:view};
   if(q.cancelled){data=abi.encodeFunctionData('refundAndWithdraw',[q.key,await this.signature('Cancel',{id:q.key},q)]);}
   else{if(!q.endedAt||Date.now()<view.claimAt)fail('CLAIM_WAIT');const r=this.result(p);data=abi.encodeFunctionData('claim',[r,await this.signature('Result',r,q)]);}
  }else fail('INVALID_ACTION');
  return this.plan(user,to,data,value);
 }
 deployment(owner){if(!address(owner)||!this.signer)fail('CONFIG_REQUIRED');return{chainId:196,version:1,reportWindow:60,owner,referee:this.signer.address,bem:BEM,feeBps:1000,claimDelay:60,data:artifact.bytecode+abi.encodeDeploy([this.signer.address,owner,BEM]).slice(2),value:'0x0'};}
 async admin(body){
  if(body.action==='ember-init'){
   if(!this.config){if(!this.file)fail('CONFIG_REQUIRED');const config={refereeKey:Wallet.createRandom().privateKey};writeFileSync(this.file,JSON.stringify(config),{mode:0o600,flag:'wx'});this.config=config;this.signer=new Wallet(config.refereeKey);}
   return this.public();
  }
  if(body.action==='ember-status'){if(this.config?.escrow&&!this.verified)await this.verify();return this.public();}
  if(body.action==='ember-bind')return this.activate(body.address);
  if(body.action==='ember-deployment')return this.deployment(body.address);
  if(['ember-deploy','ember-deployment-preflight'].includes(body.action))return this.preflight(body.transaction?.from||body.address,body.transaction?.nonce);
  if(body.action==='ember-transaction-status')return this.transactionStatus(body.transaction);
  if(body.action==='ember-deploy-status'){const v=await this.transactionStatus({...body.transaction,kind:'deploy'});return{...v,complete:v.status==='complete',failed:['failed','consumed'].includes(v.status)};}
  if(body.action==='ember-treasury'){
   if(!this.config?.escrow)return this.public();if(!this.verified)await this.verify();
   const block=await this.block(),a=body.address||this.config.escrow;
   if(![this.config.escrow,...(this.config.legacy||[])].some(v=>v.toLowerCase()===a.toLowerCase()))fail('CONTRACT_MISMATCH');
   const owner=(await this.call('owner',[],a,block))[0],paused=(await this.call('paused',[],a,block))[0],assets=[];
   for(const asset of[0,1]){const liability=BigInt((await this.call('liability',[asset],a,block))[0]),surplus=BigInt((await this.call('surplus',[asset],a,block))[0]);assets.push({asset,liability:String(liability),surplus:String(surplus),withdrawable:String(surplus),balance:String(liability+surplus)});}
   if(a.toLowerCase()===this.config.escrow.toLowerCase())this.paused=paused;return{...this.public(),escrow:a,activeEscrow:this.config.escrow,owner,paused,assets};
  }
  if(body.action==='ember-plan')return this.adminPlan(body.transaction);
  if(body.action==='ember-withdraw'){
   const r=body.transaction;if(![0,1].includes(r?.asset))fail('BAD_TRANSACTION');
   return this.adminPlan({...r,kind:'withdraw',amount:amountRaw(r.amount,r.asset),escrow:this.config?.escrow});
  }
  fail('INVALID_ACTION');
 }
 async paymentStatus(user,r){
  if(!r||r.from!==user||!['approve','fund','claim','collect'].includes(r.kind)||!/^0x[0-9a-f]{64}$/i.test(r.commitment||''))fail('BAD_TRANSACTION');
  const nonce=this.nonce(r.nonce),block=await this.block();
  const confirmed=BigInt(await this.agreed('eth_getTransactionCount',[user,block]));if(confirmed>nonce)return{status:'consumed'};
  if(BigInt(await this.agreed('eth_getTransactionCount',[user,'pending']))>nonce)return{status:'pending'};if(confirmed!==nonce)fail('PAYMENT_MISMATCH');
  const plan=await this.handle(user,{action:r.kind,key:r.key,keys:r.keys});if(plan.complete)return{status:'complete'};
  const commitment='0x'+createHash('sha256').update(JSON.stringify([plan.to.toLowerCase(),plan.data,BigInt(plan.value).toString()])).digest('hex');if(commitment!==r.commitment)fail('PAYMENT_MISMATCH');
  return{status:'resumable',plan:{...plan,nonce:r.nonce}};
 }
 async preflight(from,resumeNonce){
  const d=this.deployment(from),block=await this.block();
  const nonce=await this.agreed('eth_getTransactionCount',[from,'pending']),confirmed=await this.agreed('eth_getTransactionCount',[from,block]);
  if(BigInt(nonce)!==BigInt(confirmed)||resumeNonce!==undefined&&this.nonce(resumeNonce)!==BigInt(nonce))fail('WALLET_PENDING');
  const tx={from,data:d.data,value:'0x0',nonce},gasValues=await Promise.all(this.providers.map((_,i)=>this.rpc(i,'eth_estimateGas',[tx]).then(BigInt))),gas=gasValues.reduce((a,b)=>a>b?a:b)*125n/100n;
  // Gas quotes may legitimately differ between providers. Use the bounded higher quote.
  const prices=await Promise.all(this.providers.map((_,i)=>this.rpc(i,'eth_gasPrice',[]).then(BigInt))),gasPrice=prices.reduce((a,b)=>a>b?a:b);
  if(gas<=0n||gas>8000000n||gasPrice<=0n||gasPrice>10n**12n)fail('DEPLOY_ESTIMATE_FAILED');if(BigInt(await this.agreed('eth_getBalance',[from,block]))<gas*gasPrice)fail('INSUFFICIENT_GAS');
  return{...d,from,nonce,gas:'0x'+gas.toString(16),gasPrice:'0x'+gasPrice.toString(16),maxFeeWei:String(gas*gasPrice),expectedAddress:getCreateAddress({from,nonce:BigInt(nonce)}),expiresAt:Date.now()+60000};
 }
 nonce(v){if(typeof v!=='string'||!/^0x[0-9a-f]{1,14}$/i.test(v))fail('BAD_TRANSACTION');const n=BigInt(v);if(n>BigInt(Number.MAX_SAFE_INTEGER))fail('BAD_TRANSACTION');return n;}
 async adminPlan(r){
  if(!r||!['withdraw','pause'].includes(r.kind))fail('BAD_TRANSACTION');const summary=await this.admin({action:'ember-treasury',address:r.escrow});if(!summary.configured)fail('ESCROW_UNAVAILABLE');
  let data;if(r.kind==='withdraw'){
   if(![0,1].includes(r.asset)||!address(r.to)||/^0x0{40}$/i.test(r.to)||r.to.toLowerCase()===summary.escrow.toLowerCase()||typeof r.amount!=='string'||!/^\d{1,78}$/.test(r.amount))fail('BAD_TRANSACTION');
   const n=BigInt(r.amount);if(n<=0n||n>BigInt(summary.assets[r.asset].surplus))fail('SURPLUS_ONLY');data=abi.encodeFunctionData('withdrawPlatform',[r.asset,r.to,n]);
  }else{if(typeof r.paused!=='boolean')fail('BAD_TRANSACTION');data=abi.encodeFunctionData('setPaused',[r.paused]);}
  return this.plan(summary.owner,summary.escrow,data);
 }
 async transactionStatus(r){
  if(!r||!address(r.from)||!['deploy','withdraw','pause'].includes(r.kind))fail('BAD_TRANSACTION');const nonce=this.nonce(r.nonce),block=await this.block();
  const target=r.kind==='deploy'?getCreateAddress({from:r.from,nonce}):r.escrow;
  if(r.kind==='deploy'&&await this.agreed('eth_getCode',[target,block])!=='0x'){const v=await this.verify(target);if(v.owner.toLowerCase()!==r.from.toLowerCase())fail('CONTRACT_MISMATCH');return{status:'complete',...v};}
  if(r.hash){
   if(!/^0x[0-9a-f]{64}$/i.test(r.hash))fail('BAD_TRANSACTION');
   const receipts=await Promise.all(this.providers.map((_,i)=>this.rpc(i,'eth_getTransactionReceipt',[r.hash]))),receipt=receipts[0];
   if(receipt&&receipts[1]&&Number(receipt.blockNumber)<=Number(block)&&receipt.blockHash===receipts[1].blockHash&&receipt.status===receipts[1].status){
    const tx=await this.agreed('eth_getTransactionByHash',[r.hash]);if(!tx||tx.from?.toLowerCase()!==r.from.toLowerCase()||BigInt(tx.nonce)!==nonce||BigInt(tx.value)!==0n)fail('PAYMENT_MISMATCH');
    const expected=r.kind==='deploy'?this.deployment(r.from).data:r.kind==='pause'?abi.encodeFunctionData('setPaused',[r.paused]):abi.encodeFunctionData('withdrawPlatform',[r.asset,r.to,r.amount]);
    if((tx.input||tx.data)!==expected||(tx.to||'').toLowerCase()!==(r.kind==='deploy'?'':target||'').toLowerCase())fail('PAYMENT_MISMATCH');
    return{status:Number(receipt.status)===1?'complete':'failed'};
   }
  }
  const confirmed=BigInt(await this.agreed('eth_getTransactionCount',[r.from,block]));if(confirmed>nonce)return{status:'consumed'};
  const pending=BigInt(await this.agreed('eth_getTransactionCount',[r.from,'pending']));if(pending>nonce)return{status:'pending'};if(confirmed!==nonce||pending!==nonce)fail('PAYMENT_MISMATCH');
  const plan=r.kind==='deploy'?{chainId:196,from:r.from,data:this.deployment(r.from).data,value:'0x0'}:await this.adminPlan(r);
  if(plan.from.toLowerCase()!==r.from.toLowerCase())fail('CONTRACT_OWNER_REQUIRED');return{status:'resumable',plan:{...plan,nonce:r.nonce}};
 }
 close(){for(const p of this.providers)p.destroy();}
}
