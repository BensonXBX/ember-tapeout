import test from 'node:test';
import assert from 'node:assert/strict';
import {makeComboShowcase} from '../public/training.mjs';
import {ROUTE_STEPS} from '../public/combos.mjs';
import {createState} from '../public/engine.mjs';
test('every showcase route lands for both fighters and loops without touching a live state',()=>{
 const live=createState(1,0),before=live.slice(),demo=makeComboShowcase(),events=demo.damageEvents,seen=new Map();
 for(let frame=0;frame<230*6;frame++){
  demo.tick();const v=demo.snapshot();assert.notEqual(v.routeStatus,'failed',JSON.stringify(v));
  if(v.routeStatus==='success'){assert.equal(v.routeIndex,ROUTE_STEPS[v.route].length);assert.ok(v.hits>=3);assert.ok(v.damage>0);seen.set(v.scene,[v.fighter,v.route]);}
 }
 assert.equal(seen.size,6);assert.equal(demo.snapshot().scene,0);assert.equal(demo.damageEvents,events);assert.deepEqual(live,before);
 const other=makeComboShowcase();demo.next();assert.equal(demo.snapshot().scene,1);assert.equal(other.snapshot().scene,0);assert.equal(demo.snapshot().clock,0);assert.equal(demo.snapshot().hits,0);
});
