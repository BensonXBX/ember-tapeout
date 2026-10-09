import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTraining} from '../public/training.mjs';
import {COMBOS,ROUTE_STEPS} from '../public/combos.mjs';
import {createState,B,pbase} from '../public/engine.mjs';
const p=pbase(0),q=pbase(1);
const keys={J:B.LIGHT,K:B.JUMP,H:B.HEAVY,E:B.SKILL,I:B.SUPER,L:B.DASH,O:B.SMALL,U:B.RANGED,'W＋J':B.UP|B.LIGHT,'A/D＋J':B.LIGHT};
function play(type,combo,{distance=24,autoRetry=false}={}){
 const s=createState(type,1-type),lab=makeTraining();Object.assign(lab,{distance,autoRetry});lab.select(combo.id);lab.reset(s);
 const seq=combo.keys.split(' → ');let frames=0;
 while(frames<260){const v=lab.snapshot();if(['success','failed'].includes(v.routeStatus))break;let m=frames%4===0?keys[seq[v.routeIndex]]||0:0;if(m&&seq[v.routeIndex]==='A/D＋J')m|=s[q]>s[p]?B.RIGHT:B.LEFT;lab.tick(s,m);frames++;}
 return {s,lab};
}
test('all 24 fighter/route combinations advance only through actual engine hits at two starting ranges',()=>{
 for(let type=0;type<2;type++)for(const c of COMBOS.filter(c=>c.type<0||c.type===type))for(const distance of [24,36]){
  const {lab}=play(type,c,{distance}),v=lab.snapshot();
  assert.equal(v.routeStatus,'success',`${type} ${c.id} ${v.feedback}`);
  assert.equal(v.routeIndex,ROUTE_STEPS[c.id].length);assert.ok(v.damage>0);assert.ok(v.totalHits>=ROUTE_STEPS[c.id].filter(x=>x!==-1&&x!==10).length);
 }
});
test('a failed attempt cannot stick forever; retry waits for neutral controls and preserves the failure reason',()=>{
 const s=createState(),lab=makeTraining();lab.autoRetry=true;lab.reset(s);lab.tick(s,B.LIGHT);
 for(let f=0;f<100;f++)lab.tick(s,0);
 assert.equal(lab.snapshot().routeStatus,'failed');assert.match(lab.snapshot().failure,/恢复行动/);
 // Holding an action never teleports the fighter or queues an automatic retry.
 for(let f=0;f<160;f++)lab.tick(s,B.LEFT);
 assert.equal(lab.snapshot().routeStatus,'failed');assert.match(lab.snapshot().failure,/恢复行动/);
 lab.tick(s,0);assert.equal(lab.snapshot().routeStatus,'ready');assert.equal(lab.snapshot().routeIndex,0);assert.equal(lab.snapshot().totalHits,0);
 const combo=COMBOS[0],seq=combo.keys.split(' → ');
 for(let f=0;f<160&&lab.snapshot().routeStatus!=='success';f++)lab.tick(s,f%4===0?keys[seq[lab.snapshot().routeIndex]]||0:0);
 assert.equal(lab.snapshot().routeStatus,'success');assert.ok(lab.snapshot().bestDamage>0);
});
test('success is visible before automatic retry; default showcase/manual training never resets itself',()=>{
 for(const autoRetry of [false,true]){
  const {s,lab}=play(0,COMBOS[0],{autoRetry});
  for(let f=0;f<90;f++)lab.tick(s,0);assert.equal(lab.snapshot().routeStatus,'success');
  for(let f=0;f<120;f++)lab.tick(s,0);
  assert.equal(lab.snapshot().routeStatus,autoRetry?'ready':'success');assert.ok(lab.snapshot().bestHits>=3);
 }
});
test('misses and blocked hits are never counted as completed moves; pending attacks wait for a hit',()=>{
 const s=createState(),lab=makeTraining();lab.reset(s);lab.tick(s,B.LIGHT);
 assert.equal(lab.snapshot().routeIndex,0);assert.equal(lab.snapshot().inputState,'waiting');
 lab.distance=70;lab.reset(s);lab.tick(s,B.LIGHT);for(let f=0;f<50;f++)lab.tick(s,0);
 assert.equal(lab.snapshot().routeIndex,0);assert.equal(lab.snapshot().totalHits,0);
 lab.distance=24;lab.dummy='guard';lab.reset(s);lab.tick(s,0);lab.tick(s,B.LIGHT);for(let f=0;f<60;f++)lab.tick(s,0);
 assert.equal(lab.snapshot().routeIndex,0);assert.equal(lab.snapshot().totalHits,0);
});
