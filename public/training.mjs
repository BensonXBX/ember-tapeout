import {trainingImpact} from './impact.mjs?v=76bc5d8c4221f74f';
import {createState,B,MAX_HP,pbase,step,bufferedMask,INPUT_BUFFER_FRAMES,commandAction,moveCost,PROJECTILE_COUNT,projectileBase} from './engine.mjs?v=ee9e0d5b4ef43ac9';
import {ROUTE_STEPS} from './combos.mjs?v=1410d01635f97fbb';
import {grounded} from './stage.mjs?v=2ae99339b7bcc18e';
import {contactFailure} from './hitboxes.mjs?v=b3b85833e6633317';
export const TRAINING_INPUT_COUNT=16,TRAINING_DAMAGE_COUNT=8,TRAINING_DAMAGE_STRIDE=6,TRAINING_BYTES=(16*3+16+8*6)*4;
const labels=[[B.UP,'W'],[B.DOWN,'S'],[B.LEFT,'A'],[B.RIGHT,'D'],[B.JUMP,'K'],[B.LIGHT,'J'],[B.HEAVY,'H'],[B.SKILL,'E'],[B.RANGED,'U'],[B.DASH,'L'],[B.SMALL,'O'],[B.SUPER,'I'],[B.BLOCK,'F']];
export function inputLabel(mask){return labels.filter(([b])=>mask&b).map(([,name])=>name).join('＋');}
const actionNames=['待机','平击一段','重击','特殊技','远程','空中一段','空中重击','蹲轻击','扫腿','上挑','闪避','小技能','必杀','平击二段','平击终结','空中二段','空中终结','空中特殊技','空中小技能','空中必杀','升龙上挑'];
export const actionLabel=act=>actionNames[act]||'待机';
const chainNext={1:13,13:14,5:15,15:16};
function hasProjectiles(s){for(let i=0;i<PROJECTILE_COUNT;i++)if(s[projectileBase(i)+3]>0)return true;return false;}
export function makeTraining(){
 const records=new Float32Array(TRAINING_INPUT_COUNT*3),previous=new Float32Array(16);
 const damageEvents={records:new Float32Array(TRAINING_DAMAGE_COUNT*TRAINING_DAMAGE_STRIDE),cursor:0,count:0,sequence:0,epoch:0,hits:0,damage:0,lastDamage:0,lastGuard:false,active:false};
 let cursor=0,count=0,lastMask=0,route='ground-three',routeIndex=0,routeStatus='ready',routeClock=0;
 let hits=0,damage=0,bestHits=0,bestDamage=0,totalHits=0,active=false,feedback='选择路线，按 R 重置位置开始练习。',attemptAct=0,attemptHit=false,routeHitDone=false,serial=0,pendingBit=0,pendingAge=0,guarded=false,miss=0;
 let failure='',terminalFrames=0,inputState='ready';
 const p=pbase(0),q=pbase(1);
 const api={bytes:TRAINING_BYTES,damageEvents,autoRetry:false,dummy:'stand',infiniteEnergy:true,showBoxes:true,distance:24,start:'ground',airHeight:44,
  reset(s,clearBest=false){
   s.fill(0,72);s[1]=2;s[2]=3600;s[6]=0;s[8]=0;s[10]=0;s[4]=s[5]=0;
   for(const base of [p,q]){const type=s[base+11];s.fill(0,base,base+28);s[base+1]=144;s[base+3]=MAX_HP;s[base+4]=api.infiniteEnergy?100:30;s[base+5]=100;s[base+11]=type;}
   s[p]=300;s[q]=300+Math.max(18,Math.min(80,Number(api.distance)||24));s[p+6]=1;s[q+6]=-1;s[15]=0;
   if(api.start!=='ground'){s[p+1]=api.start==='apex'?75:100;s[p+2]=api.start==='rise'?-3.6:api.start==='fall'?2:0;}
   if(api.dummy==='air'){s[q+1]=144-Math.max(24,Math.min(80,Number(api.airHeight)||44));s[q+2]=-.23;}
   damageEvents.records.fill(0);damageEvents.cursor=damageEvents.count=damageEvents.sequence=damageEvents.hits=damageEvents.damage=damageEvents.lastDamage=0;damageEvents.lastGuard=damageEvents.active=false;damageEvents.epoch++;
   failure='';terminalFrames=0;inputState='ready';hits=damage=0;active=false;totalHits=0;routeIndex=0;routeStatus='ready';routeClock=0;
   lastMask=0;cursor=count=0;records.fill(0);attemptAct=pendingBit=pendingAge=miss=0;attemptHit=routeHitDone=false;guarded=false;
   if(clearBest)bestHits=bestDamage=0;feedback='面向假人，开始 '+routeTitle()+ '。';
   if(api.start!=='ground'&&ROUTE_STEPS[route][0]===-1){routeIndex=1;routeStatus='progress';feedback='已从空中起手，按路线下一步攻击。按 R 重置高度与距离。';}
   serial++;
  },
  select(id){if(!ROUTE_STEPS[id])throw Error('未知练习路线');route=id;failure='';terminalFrames=0;inputState='ready';routeIndex=0;routeStatus='ready';routeClock=0;feedback='路线已切换。按 R 重置位置。';serial++;},
  snapshot(){return {failure,inputState,hits,damage,bestHits,bestDamage,totalHits,active,feedback,route,routeIndex,routeStatus,count,cursor,serial,records,damageEvents};},
  tick(s,m){
   // Retry only after both fighters settle and all controls are released. Never
   // queue a held attack or reset a live match; the showcase opts out.
   if(api.autoRetry&&(routeStatus==='failed'||routeStatus==='success')){
    terminalFrames++;
    if(terminalFrames>=120&&!m&&!s[8]&&!s[p+7]&&!s[q+10]&&grounded(s,p)&&grounded(s,q)&&!hasProjectiles(s))api.reset(s);
   }
   // All training conveniences are local. They never modify PVP's engine rules.
   s[1]=2;s[2]=3600;s[p+3]=s[q+3]=MAX_HP;
   if(api.infiniteEnergy)s[p+4]=100;
   s[q+4]=100;s[q+5]=100;
   if(active&&s[q+10]===0&&s[8]===0){
    active=false;damageEvents.active=false;
    if(routeIndex>0&&routeStatus==='progress'){routeStatus='failed';feedback='连段中断：假人已恢复行动。按 R 重试。';serial++;}
   }
   if(api.dummy==='air'&&!active&&s[q+7]===0){s[q+1]=144-Math.max(24,Math.min(80,Number(api.airHeight)||44));s[q+2]=-.23;}
   if(api.dummy!=='air'&&!active&&s[q+2]===0&&s[q+1]===100)s[q+1]=144;
   const edge=m&~lastMask;lastMask=m;
   if(edge){const n=cursor*3;records[n]=s[0];records[n+1]=(edge&~3)|(m&3)|(m&(B.UP|B.DOWN));records[n+2]=s[8]?1:0;cursor=(cursor+1)%TRAINING_INPUT_COUNT;count=Math.min(TRAINING_INPUT_COUNT,count+1);serial++;}
   previous[0]=s[p+7];previous[1]=s[p+8];previous[2]=s[p+24];previous[3]=s[q+3];previous[4]=s[q+5];previous[5]=s[p+1];previous[6]=s[p+2];previous[7]=s[p+10];previous[8]=s[8];previous[9]=s[p+14];previous[10]=grounded(s,p)?1:0;previous[11]=bufferedMask(s,p);
   const attackEdge=edge&(B.LIGHT|B.HEAVY|B.SKILL|B.RANGED|B.DASH|B.SMALL|B.SUPER);
   if(attackEdge){pendingBit=attackEdge|(m&(B.UP|B.DOWN));pendingAge=0;if(previous[7]){pendingBit=0;feedback='受击僵直中：无法出招或闪避。';serial++;}}
   const guard=api.dummy==='guard'||api.dummy==='crouch-guard'||api.dummy==='after-hit'&&totalHits>0;
   const dm=(guard?B.BLOCK:0)|(api.dummy==='crouch'||api.dummy==='crouch-guard'?B.DOWN:0);
   step(s,m,dm);
   const act=s[p+7]|0,newAct=act&&(act!==previous[0]||s[p+8]<previous[1]);
   if(newAct){
    if(attemptAct&&!attemptHit&&attemptAct!==10){feedback='上一招未命中：调整距离、朝向或高度。';}
    attemptAct=act;attemptHit=routeHitDone=false;pendingBit=miss=0;serial++;
    if(act===10)advance(10,s);
   }
   if((edge|previous[11])&B.JUMP&&previous[10]&&s[p+2]<0&&s[p+7]===0&&previous[6]>=0&&!previous[7])advance(-1,s);
   const loss=previous[3]-s[q+3],isGuard=loss>0&&s[q+5]<previous[4];
   if(isGuard){guarded=true;feedback='被格挡：仅显示削血，不计入连击伤害，不能确认技能取消。';serial++;}
   if(loss>0&&!isGuard){
    if(!active){hits=0;damage=0;active=true;}
    hits++;totalHits++;damage+=loss;bestHits=Math.max(bestHits,hits);bestDamage=Math.max(bestDamage,damage);attemptHit=true;guarded=false;
    const source=act||attemptAct;
    if(!routeHitDone){advance(source,s);routeHitDone=true;}serial++;
   }
   if(loss>0){
    const z=damageEvents.cursor*TRAINING_DAMAGE_STRIDE,r=damageEvents.records;
    r[z]=s[0];r[z+1]=loss;r[z+2]=damage;r[z+3]=s[q];r[z+4]=s[q+1]-28;r[z+5]=trainingImpact(s[10],s[p+11]);
    damageEvents.cursor=(damageEvents.cursor+1)%TRAINING_DAMAGE_COUNT;damageEvents.count=Math.min(TRAINING_DAMAGE_COUNT,damageEvents.count+1);damageEvents.sequence++;
    damageEvents.hits=hits;damageEvents.damage=damage;damageEvents.lastDamage=loss;damageEvents.lastGuard=!!isGuard;damageEvents.active=active;
   }
   if(act&&!attemptHit)miss=contactFailure(s,p,q)||miss;
   if(attemptAct&&(!act||newAct)&&!newAct){if(!attemptHit&&attemptAct!==10){feedback=guarded?'被格挡：先确认命中再接技能。':miss===4?'未命中：朝向相反，按 A／D 回身。':miss===1?'未命中：距离不足，靠近后再出招。':miss===2?'未命中：高度不符，调整跳跃时机。':'未命中：出招接近落地，或目标已离开攻击范围。';if(routeStatus==='progress'){routeStatus='failed';}serial++;}attemptAct=0;}
   if(pendingBit&&!previous[8]&&++pendingAge>INPUT_BUFFER_FRAMES){
    const wanted=commandAction(s,p,pendingBit);
    feedback=s[p+4]<moveCost(wanted)?'能量不足：关闭无限能量时请预留技能费用。':wanted===10&&s[p+22]>0?'闪避冷却中。':(wanted===11||wanted===18)&&s[p+23]>0?'小技能冷却中。':previous[7]?'受击僵直中，指令未执行。':s[p+7]&&!s[p+24]?'未确认命中：衔接未执行，或输入早于缓存窗口。':'指令未执行：没有取消窗口，或按早了／弹丸已满。';
    pendingBit=0;serial++;
   }
   if(routeStatus==='progress'&&!previous[8]&&++routeClock>150){routeStatus='failed';feedback='练习超时：按 R 重置，再按路线衔接。';serial++;}
   if(routeStatus==='failed'&&!failure)failure=feedback;
   const expected=ROUTE_STEPS[route][routeIndex],queued=bufferedMask(s,p);
   const queuedAction=queued&B.JUMP?-1:queued&B.LIGHT&&chainNext[s[p+7]]?chainNext[s[p+7]]:commandAction(s,p,queued);
   inputState=(s[p+7]===expected&&expected!==10)||(queued&&queuedAction===expected)?'waiting':'ready';
   s[p+3]=s[q+3]=MAX_HP;s[1]=2;s[2]=3600;if(api.infiniteEnergy)s[p+4]=100;
  }
 };
 function routeTitle(){return route==='ground-three'?'三段起手':'所选路线';}
 function advance(action,s){
  const steps=ROUTE_STEPS[route];
  if(routeStatus==='success'||routeStatus==='failed')return;
  if(action===steps[routeIndex]){
   routeIndex++;routeClock=0;routeStatus=routeIndex===steps.length?'success':'progress';
   feedback=routeStatus==='success'?'路线完成！每一段攻击均已命中。按 R 再练一次。':'衔接成功，继续下一步。';serial++;
  }else if(routeIndex>0){routeStatus='failed';feedback='招式顺序不符：实际为 '+(action===-1?'跳跃':actionLabel(action))+'。按 R 重试。';serial++;}
 }
 return api;
}

// Presentation-only simulation: the same moves and hit-confirm windows as training.
// It owns its state and fixed-size event buffers; no player input, audio or room writes.
export function makeComboShowcase(){
 const scenes=[{route:'ground-three',keys:[B.LIGHT,B.LIGHT,B.LIGHT]},
  {route:'launcher-air',keys:[B.UP|B.LIGHT,B.JUMP,B.LIGHT,B.LIGHT,B.HEAVY]},
  {route:'ground-burst',keys:[B.LIGHT,B.HEAVY,B.SKILL,B.SUPER]}];
 const state=createState(),training=makeTraining();training.distance=36;let scene=0,clock=0;
 function reset(){state.set(createState(Math.floor(scene/scenes.length),1-Math.floor(scene/scenes.length)));training.select(scenes[scene%scenes.length].route);training.reset(state);clock=0;}
 const api={state,damageEvents:training.damageEvents,
  snapshot(){return {...training.snapshot(),scene,clock,fighter:Math.floor(scene/scenes.length)};},
  next(){scene=(scene+1)%(scenes.length*2);reset();},
  tick(){const v=training.snapshot(),done=v.routeStatus==='success'||v.routeStatus==='failed';
   training.tick(state,!done&&clock>=36&&clock%4===0?scenes[scene%scenes.length].keys[v.routeIndex]||0:0);
   if(++clock>=230)api.next();
  }
 };reset();return api;
}
