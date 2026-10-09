import {moveImpact,impactStop} from './impact.mjs?v=76bc5d8c4221f74f';
import {WORLD_WIDTH,FLOOR,grounded,support,landing} from './stage.mjs?v=2ae99339b7bcc18e';
import {meleeContact,projectileContact,projectileSpeed,projectileRise} from './hitboxes.mjs?v=b3b85833e6633317';
// Deterministic 60 Hz combat shared by browser and authoritative server.
// 2 fighters + 4 ordinary projectile slots + 2 reserved third-wave slots: 432 bytes.
export const SIZE=108,BASE=16,STRIDE=28,PROJECTILE_BASE=72,PROJECTILE_STRIDE=6,PROJECTILE_COUNT=6;
export const MAX_MASK=8191,ACTION_MASK=8188;
// One cosmetic round flag in the unused high bit of the modifier scalar; input masks stay 13-bit.
export const ELEMENT_IMBUE=16384;
export const elementImbued=(s,p)=>!!(s[p+18]&ELEMENT_IMBUE);
export const F={X:0,Y:1,VY:2,HP:3,E:4,G:5,FACE:6,ACT:7,AGE:8,CD:9,STUN:10,TYPE:11,PREV:12,CROUCH:13,COMBO:14,HIT:15,FLASH:16};
export const B={LEFT:1,RIGHT:2,JUMP:4,DOWN:8,LIGHT:16,HEAVY:32,SKILL:64,BLOCK:128,RANGED:256,DASH:512,SMALL:1024,SUPER:2048,UP:4096};
export const A={JAB:1,HEAVY:2,SKILL:3,RANGED:4,AIR_LIGHT:5,AIR_HEAVY:6,LOW_LIGHT:7,SWEEP:8,ANTIAIR:9,DASH:10,SMALL:11,SUPER:12,JAB_TWO:13,JAB_FINISH:14,AIR_TWO:15,AIR_FINISH:16,AIR_SKILL:17,AIR_SMALL:18,AIR_SUPER:19,DRAGON:20};
export const JUMP_SPEED=-6.3,GRAVITY=.23;
// Discrete rise: v*n - gravity*n*(n+1)/2. Dragon apex is 60% of a normal jump (v0.19 height +20%).
const jumpFrames=Math.floor(-JUMP_SPEED/GRAVITY),jumpHeight=-JUMP_SPEED*jumpFrames-GRAVITY*jumpFrames*(jumpFrames+1)/2;
export const DRAGON_HEIGHT_SCALE=.6;
const dragonHeight=jumpHeight*DRAGON_HEIGHT_SCALE,dragonFrames=Math.round(Math.sqrt(2*dragonHeight/GRAVITY));
export const DRAGON_SPEED=-(dragonHeight+GRAVITY*dragonFrames*(dragonFrames+1)/2)/dragonFrames;
export const DRAGON_STARTUP=11,FINISH_KNOCKBACK=20;
export const KNOCKDOWN_RECOVERY=18;
// During hurt stun, unused HIT stores -1 falling knockdown, -2 landed, -3 heavy recoil.
function knockdown(s,q){s[q+15]=grounded(s,q)?-2:-1;s[q+8]=0;if(s[q+15]===-2)s[q+10]=Math.max(s[q+10],KNOCKDOWN_RECOVERY);}
export const MAX_HP=200,MOVEMENT_SCALE=1.3,AIR_DISTANCE_SCALE=.85;
export const SUPER_DAMAGE_SCALE=1.25*1.15,SPECIAL_DAMAGE_SCALE=.75;
// Change health damage only; retain hitstun, guard pressure and all frame data.
export const JIN_GROUND_SPECIAL_SCALE=.5;
export const jinSuperScale=air=>SUPER_DAMAGE_SCALE-8/((air?13:12)*3);
const lightBase={1:7,13:8,14:11,5:8,15:9,16:11,7:7};
const lightScale=act=>lightBase[act]?(lightBase[act]-1)/lightBase[act]:1;
export const DASH_DISTANCE_SCALE=1.3*1.2,DASH_FRAMES=16;
const dashWeights=[.18,.36,.65,1.12,1.46,1.5,1.35,1.15,.99,.8,.64,.47,.33,.2,.12,.07];
const dashNormalization=(16-136/24)/dashWeights.reduce((sum,value)=>sum+value,0);
export const dashTravel=age=>(dashWeights[age-1]||0)*dashNormalization;
export const airSpeed=type=>(type?2.75:3)*MOVEMENT_SCALE*AIR_DISTANCE_SCALE;
const counterable=a=>a===1||a===2||a===7||a===8||a===9||a===11||a===20;
const isAirChain=a=>a===5||a===15||a===16;
const isChain=a=>a===1||a===13||a===14;
function beginAttack(s,p,act,m=0){s[p+17]=0;s[p+7]=act;s[p+8]=s[p+26]>0&&counterable(act)?Math.max(0,moveStartup(act,s[p+11])-2):0;s[p+15]=0;s[p+24]=0;s[p+27]=s[p+26]>0&&counterable(act)?1:0;if(s[p+27])s[p+26]=0;if(act===17||act===18||act===19)s[p+2]=Math.max(-1,Math.min(s[p+2],.35));if(act===4)s[p+27]=m&B.UP?3:m&B.DOWN?2:0;}
export const moveDuration=(a,type=0)=>type&&a===1?24:type&&a===2?40:type&&a===4?35:type&&a===20?41:type&&a===3?45:!type&&a===2?35:[0,22,37,42,32,22,28,19,36,38,DASH_FRAMES,28,66,18,26,22,28,34,26,52,37][a];
export const moveStartup=(a,type=0)=>type&&a===1?6:type&&a===12?21:[0,5,11,9,8,4,8,4,10,6,0,7,20,5,7,5,7,7,5,14,DRAGON_STARTUP][a];
const costOf=a=>(a===12||a===19)?70:(a===11||a===18)?15:a===10?8:(a===3||a===17)?30:(a===9||a===20)?20:a===4?12:0;
export const moveCost=costOf;
export function commandAction(s,p,mask){return selectAttack(s,p,mask,!grounded(s,p),mask);}
function selectAttack(s,p,edge,air=!grounded(s,p),modifier=s[p+18]){const low=!!(modifier&B.DOWN)&&!air,up=!!(modifier&B.UP)&&!air;return edge&B.SUPER?(air?19:12):edge&B.DASH?10:edge&B.SMALL?(air?18:11):edge&B.SKILL?(air?17:(low||up)?9:3):edge&B.RANGED?4:edge&B.HEAVY?(air?6:low?8:2):edge&B.LIGHT?(air?5:up?20:low?7:1):0;}
function airCancelAllowed(act,next){return (isAirChain(act)&&(next===6||next===4||next===18||next===17||next===19))||(act===6&&(next===17||next===19))||(act===18&&(next===17||next===19))||(act===17&&next===19);}
function launch(s,p,act,m){beginAttack(s,p,act,m);s[p+4]-=costOf(act);if(act===11||act===18)s[p+23]=48;}
export const INPUT_BUFFER_FRAMES=10;
const ATTACK_BITS=B.LIGHT|B.HEAVY|B.SKILL|B.RANGED|B.DASH|B.SMALL|B.SUPER;
// Field 17 holds one bounded command: full directional mask plus its lifetime.
// The normal-chain counter and jump sentinel keep their existing compact forms.
export function bufferedMask(s,p){const v=s[p+17];return v>0?B.LIGHT:v===-6?B.JUMP:v<=-32?Math.floor(-v/32):0;}
function bufferCommand(s,p,m){
 if(s[p+10]>0){s[p+17]=0;return;}
 const edge=m&~s[p+12],act=s[p+7];
 if(edge&ATTACK_BITS){
  if((act===1||act===13)&&(edge&ATTACK_BITS)===B.LIGHT&&!(m&(B.DOWN|B.UP))&&grounded(s,p)){
   if(s[p+8]>=3)s[p+17]=INPUT_BUFFER_FRAMES;
  }else s[p+17]=-(((edge&ATTACK_BITS)|(m&(B.UP|B.DOWN)))*32+INPUT_BUFFER_FRAMES);
 }else if(edge&B.JUMP&&act&&act!==10&&grounded(s,p))s[p+17]=-(B.JUMP*32+INPUT_BUFFER_FRAMES);
}
function ageBuffer(s,p){const v=s[p+17];if(v>0)s[p+17]--;else if(v<=-32)s[p+17]=(-v)%32<=1?0:v+1;}
function commandMask(s,p,m){const queued=bufferedMask(s,p);return queued||m&~s[p+12];}
function commandMotion(m,command){return (m&~(B.UP|B.DOWN))|(command&(B.UP|B.DOWN));}
export const pbase=i=>BASE+i*STRIDE;
export const projectileOwner=n=>n<4?n>>1:n-4;
export const projectileBase=i=>PROJECTILE_BASE+i*PROJECTILE_STRIDE;
export function createState(a=0,b=1,seed=42){const s=new Float32Array(SIZE);s[3]=1;s[7]=-1;s[9]=seed;reset(s,a,b);s[1]=0;return s;}
export function reset(s,a=s[27],b=s[55]){
 for(let i=0;i<2;i++){const p=pbase(i),type=i?b:a;s.fill(0,p,p+STRIDE);s[p]=i?236:84;s[p+1]=144;s[p+3]=MAX_HP;s[p+4]=30;s[p+5]=100;s[p+6]=i?-1:1;s[p+11]=type;}
 s.fill(0,PROJECTILE_BASE);s.fill(0,11,16);s[15]=1;s[2]=3600;s[1]=1;s[6]=READY_FRAMES;s[8]=0;s[10]=0;
}
export const READY_FRAMES=180;
export function start(s){s[1]=1;s[6]=READY_FRAMES;}
function rand(s){let v=(s[9]|0)||1;v^=v<<13;v^=v>>>17;v^=v<<5;s[9]=v&0x7fffff;return s[9]/8388608;}
export function aiInput(s,level=1){
 const p=pbase(1),q=pbase(0);if(s[1]!==2)return 0;
 // Five unused header scalars hold bounded AI plans. No player input fields are read.
 level=Math.max(1,Math.min(6,level|0));
 if(s[0]<s[13])return s[11];
 if(s[0]<s[12])return s[11]&3;
 const d=s[q]-s[p],distance=Math.abs(d),r=rand(s),reaction=23-level*2,vertical=s[q+1]-s[p+1];
 s[12]=s[0]+reaction+Math.floor(rand(s)*7);s[11]=0;
 const act=s[q+7],age=s[q+8],visible=act>0&&act!==10&&age>=reaction&&age<=(act===12?43:act===3?21:moveStartup(act,s[q+11])+5);
 let projectileThreat=false;
 for(let n=0;n<PROJECTILE_COUNT;n++){if(projectileOwner(n)!==0)continue;const z=projectileBase(n);if(s[z+3]>0&&Math.abs(s[z]-s[p])<70&&(s[p]-s[z])*s[z+2]>0)projectileThreat=true;}
 const chance=level===1?0:.08+level*.035;
 if(s[0]>=s[14]&&s[p+10]===0&&!s[p+7]&&((visible&&distance<145)||projectileThreat||distance<42&&act===0&&r<.04)&&r<chance){
  // Even a successful decision can choose the wrong guard height. Never track the input.
  const low=(act===7||act===8)&&rand(s)<.55||rand(s)<.12;
  s[11]=B.BLOCK|(low?B.DOWN:0)|(d>0?B.RIGHT:B.LEFT);s[13]=s[0]+9+Math.floor(rand(s)*5);s[14]=s[13]+30+Math.floor(rand(s)*21);return s[11];
 }
 let mask=distance>32?(d>0?B.RIGHT:B.LEFT):0;
 if(vertical<-24&&grounded(s,p)&&r<.7)mask|=B.JUMP;
 if(vertical>24&&support(s,p)<FLOOR&&grounded(s,p))mask|=B.DOWN|B.JUMP;
 if(level===4&&distance<60&&s[p+4]>=12)mask=d>0?B.LEFT:B.RIGHT;
 // Counter opportunities use the same delayed decisions, not an automatic 2-frame reply.
 if(distance<44&&Math.abs(vertical)<35)mask|=r<.7?B.LIGHT:B.HEAVY;
 else if(level>=4&&s[p+4]>=12)mask|=r<.25&&s[p+4]>=30?B.SKILL:B.RANGED;
 if(level>=3&&s[q+1]<120&&distance<40&&r<.25&&s[p+4]>=20)mask=B.DOWN|B.SKILL;
 if(level>=5&&distance<45&&r>.75)mask|=B.DOWN;
 if(level>=5&&r<.1)mask|=B.JUMP;
 if(level>=5&&distance>55&&r>.8)mask|=B.DASH;
 if(level>=5&&distance<65&&r>.6&&s[p+4]>=15)mask|=B.SMALL;
 if(level===6&&s[p+4]>=70&&distance<120&&r<.18)mask|=B.SUPER;
 if(!grounded(s,p)&&level>=3&&distance<80&&Math.abs(vertical)<70)mask|=r<.4?B.LIGHT:r<.65?B.HEAVY:s[p+4]>=30?B.SKILL:B.LIGHT;
 // Aim every attack through the same directional input as a human player.
 if(mask&(B.LIGHT|B.HEAVY|B.SKILL|B.RANGED|B.SMALL|B.SUPER))mask=(mask&~3)|(d>0?B.RIGHT:B.LEFT);
 s[11]=mask&3;return mask;
}
function freeProjectile(s,who){for(let n=who*2;n<who*2+2;n++)if(s[projectileBase(n)+3]<=0)return n;return -1;}
// Look ahead to the same landing state used by command selection. Restore the
// two scalars immediately; no snapshot, allocation or client-supplied flag.
function commandAir(s,p,m,edge){const y=s[p+1],v=s[p+2];let ground=grounded(s,p);if(ground&&support(s,p)<FLOOR&&(edge&B.JUMP)&&(m&B.DOWN)){s[p+1]++;s[p+2]=.8;ground=false;}if(!ground||s[p+2]<0){const oldY=s[p+1];s[p+2]+=GRAVITY;s[p+1]+=s[p+2];const floor=landing(s,p,oldY);if(s[p+2]>=0&&s[p+1]>=floor){s[p+1]=floor;s[p+2]=0;}}const air=!grounded(s,p);s[p+1]=y;s[p+2]=v;return air;}
function dashDecision(s,p,i,m){
 if(s[p+10]>0)return 0;
 const edge=commandMask(s,p,m),active=s[p+7]===10;
 if(!active&&(s[p+7]||s[p+9]>1||s[p+22]>1||!(edge&B.DASH)||(edge&B.SUPER)))return 0;
 const air=commandAir(s,p,m,edge),energy=Math.min(100,s[p+4]+(s[0]%30===0?.5:0));
 if(active){
  if(s[p+8]>=6){const next=selectAttack(s,p,edge,air,edge),cost=costOf(next);if(next&&next!==10&&energy>=cost&&!((next===11||next===18)&&s[p+23]>1)&&(next!==4&&!((next===3||next===11||next===18)&&s[p+11])||freeProjectile(s,i)>=0))return 0;}
  return 1;
 }
 return energy>=8&&(!air||Math.abs(s[p+25])!==2)?2:0;
}
function shoot(s,who,kind,damage,height=21){
 let slot=freeProjectile(s,who);if(slot<0&&kind===3&&s[projectileBase(4+who)+3]<=0)slot=4+who;if(slot<0)return false;
 const p=pbase(who),z=projectileBase(slot);s[z]=s[p]+s[p+6]*17;s[z+1]=s[p+1]-height;s[z+2]=s[p+6];s[z+3]=kind===3?104:kind===1?108:96;s[z+4]=kind;s[z+5]=damage;
 return true;
}
// Health scaling stays separate from authoritative move-based hit stop.
// Return true only for an unguarded hit; visual effects never decide damage.
function hit(s,who,damage,knock,kind=0,direction=0,level=0,dodgeMask=0,damageScale=1,damagePulses=1){
 const p=pbase(who),q=pbase(1-who);if(dodgeMask&(1<<(1-who)))return false;
 // Hit stun never grants hidden immunity. Explicit dodge is decided above;
 // per-move contact consumption prevents repeated damage from a single swing.
 if(level===2&&s[q+7]===9&&s[q+8]<=11)return false;
 const blocking=!!(s[q+18]&B.BLOCK)&&s[q+6]===-(direction||s[p+6])&&s[q+5]>0&&s[q+7]===0&&s[q+10]===0&&grounded(s,q);
 if(blocking&&s[q+20]>0&&s[q+4]>=4){s[q+4]=Math.min(100,s[q+4]+6);s[q+20]=0;s[q+16]=7;s[q+26]=30;s[q+9]=0;if(!direction)s[p+10]=12;return false;}
 const guard=blocking&&(level===0||level===1&&s[q+13]||level===2&&!s[q+13]);
 if(guard){s[q+5]=Math.max(0,s[q+5]-damage*damagePulses*2.5);s[q+4]=Math.min(100,s[q+4]+4);s[q+10]=s[q+5]<=0?48:4;s[q+3]=Math.max(0,s[q+3]-1);s[q+26]=s[q+5]>0?24:0;s[q+9]=0;}
 else{
  const punish=s[q+7]&&s[q+8]>moveStartup(s[q+7],s[q+11])+5;
  // Combo count is display-only. Every pulse keeps its full base damage.
  // Jin combines three pulses into one contact; punish applies to its first pulse.
  let dealt=0;for(let n=0;n<damagePulses;n++)dealt+=Math.max(3,damage*(n===0&&punish?1.2:1)*damageScale);
  damage*=punish?1.2:1;s[q+3]=Math.max(0,s[q+3]-dealt);
  s[q+10]=kind===1||kind===3?22:damage>10?24:14;s[q+7]=0;s[q+8]=0;s[q+15]=damage>10?-3:0;s[q+17]=0;s[q+19]=0;s[q+26]=0;s[q+27]=(direction||s[p+6])>0?4:5;
  s[q+4]=Math.min(100,s[q+4]+3);
  // Projectile category survives cancels/recovery; never infer it from the owner's current move.
  const act=s[p+7],refund=direction?kind!==3&&kind!==4&&kind!==9:act!==3&&act!==9&&act!==11&&act!==12&&act!==17&&act!==18&&act!==19&&act!==20;
  if(refund)s[p+4]=Math.min(100,s[p+4]+8);s[p+14]++;s[p+21]=60;
  s[q]=Math.max(16,Math.min(WORLD_WIDTH-16,s[q]+(direction||s[p+6])*knock));s[q+16]=7;
 }
 const profile=direction?(kind===3||kind===4||kind===9?4:0):moveImpact(s[p+7],s[p+8],s[p+11]);s[8]=impactStop(profile,guard);s[10]=who+1+profile*4+(guard?32:0);return !guard;
}
function finish(s){const a=s[19],b=s[47],w=a===b?-1:a>b?0:1;s[7]=w;if(w>=0)s[4+w]++;s[1]=(s[4]>=2||s[5]>=2)?4:3;s[6]=120;}
export function step(s,m0=0,m1=0){
 s[0]++;if(s[1]===0||s[1]===4)return;
 if(s[1]===1){if(--s[6]<=0)s[1]=2;return;}
 if(s[1]===3){if(--s[6]<=0){s[3]++;reset(s);}return;}
 if(s[8]>0){for(let i=0;i<2;i++){const p=pbase(i),m=i?m1:m0;bufferCommand(s,p,m);const turn=(m&B.RIGHT?1:0)-(m&B.LEFT?1:0);if(turn&&s[p+10]<=1&&s[p+7]!==10&&s[p+7]!==12&&s[p+7]!==19)s[p+6]=turn;s[p+12]=(s[p+12]&~ACTION_MASK)|(m&ACTION_MASK);}s[8]--;return;}s[2]--;s[10]=0;
 // Resolve both defensive inputs before either player's attack to avoid slot-order bias.
 for(let i=0;i<2;i++){const p=pbase(i),m=i?m1:m0;s[p+18]=(s[p+18]&ELEMENT_IMBUE)|m;bufferCommand(s,p,m);const turn=(m&B.RIGHT?1:0)-(m&B.LEFT?1:0);if(turn&&s[p+10]<=1&&s[p+7]!==10&&s[p+7]!==12&&s[p+7]!==19)s[p+6]=turn;s[p+13]=(m&B.DOWN)&&grounded(s,p)?1:0;if(s[p+20]>0)s[p+20]--;if((m&B.BLOCK)&&!(s[p+12]&B.BLOCK)&&s[p+4]>=4&&!s[p+7]&&!s[p+10]){s[p+20]=5;s[p+4]-=4;}}
 // Decide invulnerability for both players before either attack resolves.
 // Includes the first and final dodge frame; an attack cancel removes it.
 let dodgeMask=0,dashStarts=0;for(let i=0;i<2;i++){const decision=dashDecision(s,pbase(i),i,i?m1:m0);if(decision)dodgeMask|=1<<i;if(decision===2)dashStarts|=1<<i;}
 for(let i=0;i<2;i++){
  const p=pbase(i),q=pbase(1-i),m=i?m1:m0,edge=m&~s[p+12],type=s[p+11];
  const command=commandMask(s,p,m),commandM=commandMotion(m,command);s[p+12]=m;
  if(s[p+21]>0&&--s[p+21]<=0)s[p+14]=0;
  if(s[p+22]>0)s[p+22]--;if(s[p+23]>0)s[p+23]--;
  if(s[p+26]>0)s[p+26]--;else if(s[p+27]<0)s[p+27]=0;
  const wasStunned=s[p+10]>0;if(!wasStunned&&s[p+27]>3)s[p+27]=0;
  if(s[p+16]>0)s[p+16]--;if(s[p+9]>0)s[p+9]--;if(s[p+10]>0){s[p+10]--;if(s[p+27]>3)s[p+8]++;if(s[p+15]===-1)s[p+10]=Math.max(1,s[p+10]);}s[p+5]=Math.min(100,s[p+5]+.13);if(s[0]%30===0)s[p+4]=Math.min(100,s[p+4]+.5);
  let onGround=grounded(s,p);if(onGround&&support(s,p)<FLOOR&&(edge&B.JUMP)&&(m&B.DOWN)){s[p+1]+=1;s[p+2]=.8;onGround=false;}const wasAir=!onGround||s[p+2]<0;
  if(wasAir){const oldY=s[p+1];s[p+2]+=GRAVITY;s[p+1]+=s[p+2];const floor=landing(s,p,oldY);if(s[p+2]>=0&&s[p+1]>=floor){s[p+1]=floor;s[p+2]=0;if(s[p+15]===-1&&wasStunned)knockdown(s,p);if(isAirChain(s[p+7])||s[p+7]===6||s[p+7]===18){s[p+7]=0;s[p+9]=4;}}}
  if(grounded(s,p)&&s[p+2]===0&&s[p+7]!==10)s[p+25]=0;
  const move=((m&B.RIGHT?1:0)-(m&B.LEFT?1:0)),target=s[p+10]?0:wasAir?(move&&!s[p+7]?move*airSpeed(type):s[p+19]*.99):!s[p+7]&&!(m&B.BLOCK)&&!s[p+13]?move*(type?1.7:1.85)*MOVEMENT_SCALE:0;
  s[p+19]+=(target-s[p+19])*(wasAir?.09:.32);if(Math.abs(s[p+19])<.02*MOVEMENT_SCALE*(wasAir?AIR_DISTANCE_SCALE:1))s[p+19]=0;s[p]+=s[p+19]*(dashStarts&(1<<i)?DASH_DISTANCE_SCALE:onGround&&!s[p+7]&&!s[p+10]&&(edge&B.JUMP)&&!(m&B.UP)&&!(edge&B.DASH)?AIR_DISTANCE_SCALE:1);
  // Buffer a counter pressed during the brief block stun, then execute on recovery.
  if(s[p+10]>0&&s[p+26]>0&&!s[p+7]){const queued=selectAttack(s,p,edge);if(counterable(queued))s[p+27]=-queued;}
  if(!s[p+10]){
   if(!s[p+7]){
    if(command&B.JUMP&&grounded(s,p)&&!(commandM&B.UP)&&!(command&B.DASH)){s[p+2]=JUMP_SPEED;s[p+13]=0;s[p+25]=0;s[p+19]=move*airSpeed(type);s[p+17]=0;}
    if(!s[p+9]){
     let act=selectAttack(s,p,command,!grounded(s,p),commandM)||(s[p+27]<0?-s[p+27]:0);
     const cost=costOf(act);
     const air=!grounded(s,p);
     if(s[p+4]<cost||act===10&&(wasStunned||s[p+22]>0||air&&Math.abs(s[p+25])===2)||(act===11||act===18)&&s[p+23]>0||((act===4||((act===3||act===11||act===18)&&type))&&freeProjectile(s,i)<0))act=0;
     if(act){beginAttack(s,p,act,commandM);s[p+4]-=cost;if(act===10){const rise=!!(commandM&(B.UP|B.JUMP))&&!air;s[p+22]=50;s[p+25]=(move||s[p+6])*(air||rise?2:1);if(rise)s[p+2]=-4.8;else if(air)s[p+2]=0;}if(act===11||act===18)s[p+23]=48;}else if(command&B.DASH)s[p+17]=0;
    }
   }else if((s[p+7]===1||s[p+7]===13)&&(command&ATTACK_BITS)===B.LIGHT&&!(command&(B.UP|B.DOWN))&&s[p+8]>=8&&grounded(s,p)&&!s[p+13]){beginAttack(s,p,s[p+7]===1?13:14);}else if(((isChain(s[p+7])||s[p+7]===7)&&s[p+24]&&((command&(B.HEAVY|B.SKILL|B.RANGED|B.SMALL|B.SUPER))||((command&B.UP)&&(command&B.LIGHT))))||(s[p+7]===2&&s[p+24]&&(command&(B.SKILL|B.RANGED|B.SMALL|B.SUPER)))||((s[p+7]===3||s[p+7]===9||s[p+7]===20||s[p+7]===11)&&s[p+24]&&(command&B.SUPER))){const next=selectAttack(s,p,command,!grounded(s,p),commandM),cost=costOf(next);if(next&&s[p+4]>=cost&&!((next===11||next===18)&&s[p+23]>0)&&(next!==4&&!((next===3||next===11||next===18)&&type)||freeProjectile(s,i)>=0)){beginAttack(s,p,next,commandM);s[p+4]-=cost;if(next===11||next===18)s[p+23]=48;}}
  }
  // New cancels require a real hit. Field 24 records confirmation, never client data.
  // One jump cancel consumes the confirmation by ending the source attack.
  if(!s[p+10]&&s[p+24]>0&&(isChain(s[p+7])||s[p+7]===2||s[p+7]===9||s[p+7]===20)&&(command&B.JUMP)&&grounded(s,p)){s[p+7]=0;s[p+8]=0;s[p+17]=0;s[p+15]=0;s[p+24]=0;s[p+9]=0;s[p+2]=JUMP_SPEED;s[p+13]=0;s[p+25]=0;s[p+19]=(move||s[p+6])*airSpeed(type);}
  if(!s[p+10]&&(s[p+7]===5||s[p+7]===15)&&s[p+24]>0&&(command&ATTACK_BITS)===B.LIGHT&&s[p+8]>=7){launch(s,p,s[p+7]===5?15:16,commandM);}
  const dashCancel=s[p+7]===10&&s[p+8]>=6,airCancel=s[p+24]>0&&(isAirChain(s[p+7])||s[p+7]===6||s[p+7]===17||s[p+7]===18);
  if(!s[p+10]&&(dashCancel||airCancel)){
   const next=selectAttack(s,p,command,!grounded(s,p),commandM),allowed=dashCancel?next&&next!==10:airCancelAllowed(s[p+7],next),cost=costOf(next);
   if(allowed&&s[p+4]>=cost&&!((next===11||next===18)&&s[p+23]>0)&&(next!==4&&!((next===3||next===11||next===18)&&type)||freeProjectile(s,i)>=0)){if(dashCancel&&move)s[p+6]=move;beginAttack(s,p,next,commandM);s[p+4]-=cost;if(next===11||next===18)s[p+23]=48;}
  }
  const act=s[p+7];
  if(act){
   const age=++s[p+8],begin=moveStartup(act,type),end=moveDuration(act,type);
   if((act===12&&age===(type?21:20))||(act===19&&age===14))s[p+18]|=ELEMENT_IMBUE;
   if(act===10){s[p]+=Math.sign(s[p+25])*(type?4.4:4.8)*dashTravel(age)*MOVEMENT_SCALE*DASH_DISTANCE_SCALE*(Math.abs(s[p+25])===2?AIR_DISTANCE_SCALE:1);s[p+19]=0;}
   if(!type&&(act===1||act===13)&&age>=3&&age<=5)s[p]+=s[p+6]*.8;
   if(act===2&&age>=9&&age<=13)s[p]+=s[p+6]*(type?.45:2);
   if(act===12&&!type&&age>=14&&age<=19)s[p]+=s[p+6]*4*MOVEMENT_SCALE;
   if((act===17||act===19)&&age<14)s[p+2]=Math.min(s[p+2],.35);
   if(act===19){if(type&&age<=30)s[p+2]=Math.min(s[p+2],.4);if(!type&&age===14)s[p+2]=3.2;}
   if(act===17&&!type&&age>=7&&age<=16){s[p]+=s[p+6]*1.5*MOVEMENT_SCALE*AIR_DISTANCE_SCALE;s[p+2]=Math.min(4.8,s[p+2]+.3);}
   if(act===18&&!type&&age>=3&&age<=8)s[p]+=s[p+6]*.9*MOVEMENT_SCALE*AIR_DISTANCE_SCALE;
   if(act===18&&type&&age===5)shoot(s,i,9,11,36);
   if(act===11&&type&&age===7)shoot(s,i,4,12,23);
   if(act===3&&!type&&age>=9&&age<=20)s[p]+=s[p+6]*4.1*MOVEMENT_SCALE;
   if(act===3&&type&&(age===9||age===17||age===25))shoot(s,i,3,age===25?8:28/3,age===17?16:25);
   if(act===4&&age===8){const variant=s[p+27];shoot(s,i,variant===3?(type?6:5):variant===2?(type?8:7):type?1:0,type?8:9,variant===2?9:21);}
   const contact=meleeContact(s,p,q);
   if(act===12&&(type?(age===21||age===31||age===41):age===20)&&contact){const last=!type||age===41,landed=hit(s,i,type?10:12,last?(type?10:22):2,type?3:0,0,0,dodgeMask,type?SUPER_DAMAGE_SCALE:jinSuperScale(false),type?1:3);s[p+15]=1;if(landed){s[p+24]++;if(type){s[q+2]=last?0:-.65;s[q+10]=last?32:24;}else{s[q+2]=3.8;s[q+10]=28;knockdown(s,q);}}}
   if(act===3&&!type&&(age===10||age===17||age===24)&&contact){const landed=hit(s,i,age===24?12:14,age===24?22:3,0,0,0,dodgeMask,JIN_GROUND_SPECIAL_SCALE);s[p+15]=1;if(landed)s[p+24]++;}
   if(act===17&&(age===7||age===14)&&contact){const landed=hit(s,i,type?12:13,age===14?10:2,0,0,2,dodgeMask,type?10/12:SPECIAL_DAMAGE_SCALE);s[p+15]=1;if(landed){s[p+24]++;s[q+2]=age===14?3.4:.6;s[q+10]=25;if(age===14)knockdown(s,q);}}
   if(act===19&&(type?(age===14||age===22||age===30):age===14)&&contact){const last=!type||age===30,landed=hit(s,i,type?11:13,last?(type?12:22):2,type?3:0,0,2,dodgeMask,type?SUPER_DAMAGE_SCALE:jinSuperScale(true),type?1:3);s[p+15]=1;if(landed){s[p+24]++;s[q+2]=last?(type?3.8:5):-.65;s[q+10]=28;if(last)knockdown(s,q);}}
   if(act!==3&&act!==4&&act!==10&&act!==12&&act!==17&&act!==19&&!((act===11||act===18)&&type)&&age>=begin&&age<=begin+4&&!s[p+15]&&contact){
    const landed=hit(s,i,act===16?11:act===15?9:act===18?11:act===14?11:act===13?8:act===11?11:act===1||act===7?7:act===5?8:act===6?12:act===8?13:act===9||act===20?16:act===2?14:22,act===5?3:act===15?2:act===16?7:act===18?4:act===13?3:act===14?FINISH_KNOCKBACK:act===20?4:act===1||act===7?4:act===2?9:18,0,0,act===7||act===8?1:isAirChain(act)||act===6||act===18?2:0,dodgeMask,act===9||act===20?SPECIAL_DAMAGE_SCALE:lightScale(act));
    if(landed)s[p+24]=1;
    if(landed&&act===2&&!type)s[q+2]=-2.4; // Ember's uppercut launches; Frost's sweep has longer reach.
    if(landed&&act===14){s[q+10]=26;}
    if(landed&&act===20){s[q+2]=DRAGON_SPEED;s[q+10]=34;}
    if(landed&&(act===5||act===15)){s[q+2]=act===5?-3.6:-2.2;s[q+10]=26;s[p+2]=Math.max(-3.6,Math.min(1.2,s[q+2]+(s[q+1]-s[p+1]+8)/10));}
    if(landed&&(act===16||act===6)){s[q+2]=3.8;s[q+10]=28;s[p+2]=1.2;knockdown(s,q);}
    if(landed&&act===13)s[q+10]=18;
    if(landed&&(act===1||act===7))s[q+10]=18;
    if(landed&&act===9){s[q+2]=-3.2;s[q+10]=28;}
    if(landed&&act===8){s[q+10]=36;knockdown(s,q);}
    s[p+15]=1;
   }
   if(age>=end){s[p+7]=0;s[p+27]=0;s[p+9]=act===4?12:5;if(!s[p+15])s[p+14]=0;}
  }
  ageBuffer(s,p);s[p]=Math.max(16,Math.min(WORLD_WIDTH-16,s[p]));
 }
 // Opposing projectiles neutralize each other; no client can force a hit through them.
 for(let a=0;a<PROJECTILE_COUNT;a++)for(let b=a+1;b<PROJECTILE_COUNT;b++){if(projectileOwner(a)===projectileOwner(b))continue;const u=projectileBase(a),v=projectileBase(b);if(s[u+3]>0&&s[v+3]>0&&Math.abs(s[u]-s[v])<12&&Math.abs(s[u+1]-s[v+1])<8){s[u+3]=s[v+3]=0;}}
 if(s[23]!==10&&s[51]!==10&&Math.abs(s[16]-s[44])<18&&Math.abs(s[17]-s[45])<30){const mid=(s[16]+s[44])/2,dir=s[16]<s[44]?-1:1;s[16]=mid+dir*9;s[44]=mid-dir*9;}
 s[16]=Math.max(16,Math.min(WORLD_WIDTH-16,s[16]));s[44]=Math.max(16,Math.min(WORLD_WIDTH-16,s[44]));
 for(let n=0;n<PROJECTILE_COUNT;n++){
  const z=projectileBase(n),owner=projectileOwner(n),q=pbase(1-owner);if(s[z+3]<=0)continue;
  const previousX=s[z],previousY=s[z+1];s[z+3]--;s[z]+=s[z+2]*projectileSpeed(s[z+4]);s[z+1]+=projectileRise(s[z+4]);
  if(!(dodgeMask&(1<<(1-owner)))&&projectileContact(s,z,q,previousX,previousY)){const landed=hit(s,owner,s[z+5],s[z+4]===0?10:7,s[z+4],s[z+2],0,dodgeMask,s[z+4]===3?SPECIAL_DAMAGE_SCALE:1);if(landed&&((s[z+4]===9&&s[pbase(owner)+7]===18&&s[z+3]>=55)||(s[z+4]===3&&s[pbase(owner)+7]===3))){s[pbase(owner)+15]=1;s[pbase(owner)+24]=1;}if(landed&&s[z+4]===4){s[q+10]=30;s[pbase(owner)+15]=1;if(s[pbase(owner)+7]===11)s[pbase(owner)+24]=1;}if(landed&&s[pbase(owner)+7]===4&&s[z+4]!==3&&s[z+4]!==4&&s[z+4]!==9){s[pbase(owner)+15]=1;s[pbase(owner)+24]++;}s[z+3]=0;}
  if(s[z]<-12||s[z]>WORLD_WIDTH+12)s[z+3]=0;
 }
 if(s[19]<=0||s[47]<=0||s[2]<=0)finish(s);
}
export function validMask(m){return Number.isInteger(m)&&m>=0&&m<=MAX_MASK&&!((m&3)===3);}
