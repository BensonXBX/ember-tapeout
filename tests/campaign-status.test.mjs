import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,start,step,pbase,B,A} from '../public/engine.mjs';
import {campaignInput,campaignStatus,campaignPanelSide,campaignPanelBounds} from '../public/campaign.mjs';
import {entryCopy} from '../public/experience-text.mjs';
test('campaign observer preserves every stage simulation, RNG and action output',()=>{
 for(let stage=1;stage<=12;stage++)for(let fighter=0;fighter<2;fighter++){
  const observed=createState(fighter,1-fighter,stage*739+42);start(observed);const control=observed.slice();
  for(let frame=0;frame<2200;frame++){
   const ai=campaignInput(observed,stage);assert.equal(ai,campaignInput(control,stage));
   const before=observed.slice(),v=campaignStatus(observed);assert.deepEqual(observed,before);assert.equal(v.distance,Math.round(Math.abs(observed[16]-observed[44])));assert.equal(v.energy,Math.floor(observed[48]));assert.ok(entryCopy['ai_'+v.action]?.every(Boolean));
   const own=frame%37===0?B.RIGHT|B.LIGHT:B.RIGHT;
   step(observed,own,ai);step(control,own,ai);
  }assert.deepEqual(observed,control);
 }
});
test('state diagram reports actual actions and phase, not planned inputs or random animation',()=>{
 const s=createState();s[1]=2;const p=pbase(1);s[p+18]=B.SUPER;assert.equal(campaignStatus(s).action,'idle');
 s[p+7]=A.SUPER;assert.equal(campaignStatus(s).action,'super');
 s[p+10]=3;assert.equal(campaignStatus(s).action,'hurt');
 s[p+10]=0;s[p+7]=0;s[p+18]=B.BLOCK;assert.equal(campaignStatus(s).action,'guard');
 s[p+1]-=20;assert.equal(campaignStatus(s).action,'jump');assert.equal(campaignStatus(s).air,true);
 s[1]=1;assert.equal(campaignStatus(s).action,'ready');s[1]=3;assert.equal(campaignStatus(s).action,'rest');
});
test('opposite side has a center deadband; typical phone panel clears left stick and keeps the same size on both sides',()=>{
 assert.equal(campaignPanelSide(.1),'right');assert.equal(campaignPanelSide(.9),'left');
 for(const x of [.45,.5,.55]){assert.equal(campaignPanelSide(x,'left'),'left');assert.equal(campaignPanelSide(x,'right'),'right');}
 const g={canvas:{left:0,right:844,width:844,bottom:390},hud:{left:54,right:790,bottom:92},stick:{top:238},mobile:true};
 const l=campaignPanelBounds(g,'left'),r=campaignPanelBounds(g,'right');assert.equal(l.width,r.width);assert.equal(l.height,r.height);assert.ok(l.top+l.height<g.stick.top);assert.ok(l.left+l.width<422);assert.ok(r.left>422);assert.ok(r.left+r.width<=790);
});

test('short landscape uses the inner left lane when the joystick reaches the HUD',()=>{
 const g={canvas:{left:0,right:568,width:568,bottom:260},hud:{left:12,right:556,bottom:81},stick:{top:82,right:154},menu:{bottom:109},mobile:true};
 const l=campaignPanelBounds(g,'left'),r=campaignPanelBounds(g,'right');
 assert.ok(l.left>=g.stick.right+8);assert.ok(l.top>=g.menu.bottom+6);assert.ok(l.left+l.width<284);assert.ok(l.top+l.height<260);assert.equal(l.width,r.width);assert.equal(l.height,r.height);
});
