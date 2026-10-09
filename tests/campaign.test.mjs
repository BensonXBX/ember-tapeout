import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,start,step,aiInput,validMask,pbase,B,A} from '../public/engine.mjs';
import {readCampaign,saveCampaign,unlockedStage,winStage,campaignInput} from '../public/campaign.mjs';
const storage=initial=>{const values=new Map(Object.entries(initial||{}));return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
test('legacy six-stage progress migrates without granting twelve-stage completion',()=>{
 assert.equal(readCampaign(storage()),0);
 for(let stage=1;stage<=6;stage++)assert.equal(unlockedStage(readCampaign(storage({'ember-unlocked':String(stage)}))),stage);
 const old=storage({'ember-unlocked':'6','ember-complete':'1'});
 assert.equal(readCampaign(old),6);assert.equal(unlockedStage(readCampaign(old)),7);
 saveCampaign(old,7);assert.equal(readCampaign(old),7);assert.equal(old.getItem('ember-unlocked'),'6');
 assert.equal(old.getItem('ember-complete'),'1');
 assert.equal(readCampaign(storage({'ember-campaign-cleared':'bogus'})),0);
 assert.equal(readCampaign(storage({'ember-campaign-cleared':'-1'})),0);
 assert.equal(readCampaign(storage({'ember-campaign-cleared':'999'})),12);
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(readCampaign(blocked),0);assert.equal(saveCampaign(blocked,7),false);
});
test('wins unlock one stage at a time; replays preserve progress and final stage remains replayable',()=>{
 const saved=storage();let cleared=0;
 for(let n=1;n<=12;n++){
  assert.equal(unlockedStage(cleared),n);assert.equal(winStage(cleared,n+1),cleared);
  cleared=winStage(cleared,n);assert.equal(cleared,n);saveCampaign(saved,cleared);
  assert.equal(readCampaign(saved),n);assert.equal(winStage(cleared,1),n);
 }
 assert.equal(unlockedStage(cleared),12);assert.equal(winStage(cleared,12),12);
 assert.equal(winStage(cleared,13),12);assert.equal(winStage(3,0),3);
});
test('six basic opponents retain the exact original decisions and simulation',()=>{
 for(let level=1;level<=6;level++)for(let fighter=0;fighter<2;fighter++){
  const a=createState(fighter,1-fighter,739*level+42);start(a);const b=a.slice();
  for(let frame=0;frame<2000;frame++){
   const old=aiInput(a,level),now=campaignInput(b,level);assert.equal(now,old);
   const player=frame%31===0?B.LIGHT:B.RIGHT;step(a,player,old);step(b,player,now);
  }assert.deepEqual(b,a);
 }
});
test('advanced decisions are deterministic normal inputs with no health/resource or hidden-input access',()=>{
 for(let level=7;level<=12;level++)for(let fighter=0;fighter<2;fighter++){
  const a=createState(fighter,1-fighter,71);start(a);
  for(let frame=0;frame<2400&&a[1]!==4;frame++){
   const before=a.slice(),same=a.slice(),hidden=a.slice();
   // Opponent raw/previous input, command buffer and command modifiers are not visible tells.
   hidden[16+12]=B.SUPER;hidden[16+17]=B.SKILL*32+10;hidden[16+18]=B.DOWN|B.HEAVY;
   const mask=campaignInput(a,level);assert.ok(validMask(mask));
   assert.equal(campaignInput(same,level),mask);assert.deepEqual(same,a);
   assert.equal(campaignInput(hidden,level),mask);
   for(let i=0;i<a.length;i++)if(![9,11,12,13,14].includes(i))assert.equal(a[i],before[i],`mutated ${i}`);
   step(a,frame%41===0?B.RIGHT|B.LIGHT:frame%23===0?B.RANGED:B.RIGHT,mask);
   assert.ok(Number.isFinite(a[19])&&Number.isFinite(a[47]));
   assert.ok(a[19]<=200&&a[47]<=200);
  }
 }
});
test('advanced opponents complete real matches against an idle player, using unchanged match rules',()=>{
 for(let level=7;level<=12;level++)for(let fighter=0;fighter<2;fighter++){
  const s=createState(fighter,1-fighter,739*level+42);start(s);s[20]=s[48]=100;
  assert.equal(s[19],200);assert.equal(s[47],200);
  for(let f=0;f<15000&&s[1]!==4;f++)step(s,0,campaignInput(s,level));
  assert.equal(s[1],4,`stage ${level} did not finish`);assert.equal(s[7],1);assert.equal(s[5],2);
 }
});
test('advanced hit-confirm combos require a confirmed contact before requesting the next link',()=>{
 let confirmedLinks=0,unconfirmedLinks=0;
 for(let seed=1;seed<=50;seed++){
  const s=createState(0,1,seed*133);s[1]=2;s[0]=100;const p=pbase(1);s[p]=120;s[16]=100;s[p+7]=A.JAB;s[p+8]=10;s[p+4]=100;
  const unconfirmed=s.slice();s[p+24]=1;
  if(campaignInput(s,12)&B.HEAVY)confirmedLinks++;
  if(campaignInput(unconfirmed,12)&B.HEAVY)unconfirmedLinks++;
 }
 assert.ok(confirmedLinks>30);assert.equal(unconfirmedLinks,0);
});
