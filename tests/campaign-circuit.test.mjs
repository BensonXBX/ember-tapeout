import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,start,step,B,pbase} from '../public/engine.mjs';
import {campaignInput,legacyCampaignInput,campaignTrace,CampaignCircuit,evaluateNand,readCampaignAI,saveCampaignAI} from '../public/campaign.mjs';

test('NAND numerical comparators preserve integer, fractional, negative and IEEE boundary ordering',()=>{
 const c=new CampaignCircuit(),values=[0,-0,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,1,-1,65535,65536,1e12,-1e12,.1,.18,.35,.62,.72,.86,100.00001,99.99999];
 let seed=4721;for(let i=0;i<160;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;values.push((seed-2**31)/2**20);}
 for(const a of values)for(const b of values)assert.deepEqual(c.compare(a,b),[+(a<b),+(a===b),+(a>b)],[a,b].join(','));
 assert.throws(()=>c.compare(NaN,0),/Non-finite/);assert.throws(()=>c.compare(Infinity,0),/Non-finite/);
 for(let m=0;m<8192;m+=7){assert.equal(c.choose(1,m,8191-m),m);assert.equal(c.choose(0,m,8191-m),8191-m);assert.equal(c.merge(m,5421),m|5421);assert.equal(c.keep(m,2730),m&2730);}
});
test('all twelve circuit policies match retained original inputs, seeded RNG and full match state',()=>{
 for(let stage=1;stage<=12;stage++)for(let fighter=0;fighter<2;fighter++)for(const seed of [37,739,23983]){
  const a=createState(fighter,1-fighter,seed);start(a);const b=a.slice();
  for(let frame=0;frame<2800;frame++){
   const expected=legacyCampaignInput(a,stage),actual=campaignInput(b,stage,{trace:frame%4===0});assert.equal(actual,expected,`stage ${stage}, fighter ${fighter}, seed ${seed}, frame ${frame}`);
   const action=frame%97<35?B.RIGHT|((frame%17===0)?B.LIGHT:0):frame%97<55?B.LEFT:frame%97<75?B.JUMP|B.LIGHT:B.RIGHT|B.SKILL;
   step(a,action,expected);step(b,action,actual);assert.deepEqual(b,a);
  }
 }
});
test('decision edge states and energy thresholds are identical without reading hidden player inputs',()=>{
 let v=982;const rng=()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};
 for(let stage=1;stage<=12;stage++)for(let n=0;n<220;n++){
  const a=createState(n%2,1-n%2,n*139+31);a[1]=2;a[0]=100;const p=pbase(1),q=pbase(0);
  a[p]=20+rng()*600;a[q]=20+rng()*600;a[p+1]=40+rng()*104;a[q+1]=40+rng()*104;
  if(n%3===0)a[p+1]=144;if(n%3===1)a[q+1]=144;
  a[p+4]=[0,8,12,15,20,30,69.5,70,100][n%9];a[p+7]=n%21;a[q+7]=(n*3)%21;a[p+8]=4+n%30;a[q+8]=n%50;a[p+24]=n%2;a[12]=0;a[13]=0;a[14]=0;
  const b=a.slice();assert.equal(campaignInput(b,stage,{trace:true}),legacyCampaignInput(a,stage),`edge ${stage}/${n}`);assert.deepEqual(b,a);
 }
});
test('recorded board signals are the actual NAND evaluation, and disabling comparator outputs changes decisions',()=>{
 const s=createState();s[1]=2;s[0]=100;s[16]=40;s[44]=500;
 const original=s.slice(),normal=campaignInput(s,1,{trace:true}),machine=campaignTrace(s);assert.ok(machine.operations>100&&machine.calls>10);assert.ok(machine.traces.size>1);
 for(const trace of machine.traces.values()){
  const {board}=trace;for(let i=0;i<board.gates.length;i++){const [a,b]=board.gates[i];assert.ok(a<board.n+2+i&&b<board.n+2+i);}
  const actual=evaluateNand(board,trace.inputs);assert.deepEqual(actual.outputs,trace.outputs);assert.deepEqual(actual.wires,trace.wires);
 }
 const run=CampaignCircuit.prototype.run;
 try{CampaignCircuit.prototype.run=function(board,bits){const out=run.call(this,board,bits);return board.key.startsWith('CMP')?[0,1,0]:out;};assert.notEqual(campaignInput(original,1),normal,'comparison outputs must causally control the AI');}finally{CampaignCircuit.prototype.run=run;}
});
test('explicit original mode and saved preference retain an immediate, independent rollback',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(readCampaignAI(storage),'circuit');assert.equal(saveCampaignAI(storage,'legacy'),'legacy');assert.equal(readCampaignAI(storage),'legacy');assert.equal(saveCampaignAI(storage,'unexpected'),'circuit');
 const s=createState();s[1]=2;s[0]=100;campaignInput(s,9,{trace:true});assert.ok(campaignTrace(s));s[12]=0;s[13]=0;
 const old=s.slice();assert.equal(campaignInput(s,9,{mode:'legacy'}),legacyCampaignInput(old,9));assert.deepEqual(s,old);assert.equal(campaignTrace(s),undefined);
 const blocked={getItem(){throw Error();},setItem(){throw Error();}};assert.equal(readCampaignAI(blocked),'circuit');assert.equal(saveCampaignAI(blocked,'legacy'),'legacy');
});
