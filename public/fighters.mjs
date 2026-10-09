import {outfitFrame,COSTUME_BYTES} from './costumes.mjs?v=cbe686a7709b3bbf';
import {dashPose} from './dash-pose.mjs?v=d277ccb63a00cbcf';
// One bounded atlas: original locomotion plus dedicated aerial and super drawings.
// Animation switches whole drawings; no runtime skeleton deformation.
import {drawEnchantment,ATTACHMENT_BYTES} from './element-attachment.mjs?v=1a7274f3682a2fc5';
export const rect=(c,color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
export function pixelArc(c,color,x,y,rx,ry,a,b,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,rx,ry,0,a,b);c.stroke();}
export const ATLAS_WIDTH=512,ATLAS_HEIGHT=1536,CELL=64,SPRITE_BYTES=ATLAS_WIDTH*ATLAS_HEIGHT*4,FIGHTER_SCRATCH_BYTES=ATTACHMENT_BYTES+COSTUME_BYTES;
let atlas=null;
export const artReady=typeof Image==='undefined'?Promise.resolve():new Promise((ok,fail)=>{const image=new Image();image.onload=()=>{if(image.naturalWidth!==ATLAS_WIDTH||image.naturalHeight!==ATLAS_HEIGHT)return fail(Error('角色图集尺寸错误'));atlas=image;ok();};image.onerror=()=>fail(Error('人物资源加载失败，请刷新重试'));image.src='/games/ember/assets/fighters-v34.png';});
// Hurt phases are visual only. Recovery never extends combat stun or immunity.
export function hurtPhase(stun=0,air=false,vy=0,flash=0){if(stun<=0)return 0;if(flash>=5)return 1;if(stun<=6)return 6;if(!air)return 2;return vy<-1?3:vy>.9?5:4;}
export function spriteFrame(act=0,age=0,frame=0,crouch=0,block=0,moving=false,air=false,vx=0,vy=0,stun=0,flash=0){
 const hurt=hurtPhase(stun,air,vy,flash);if(hurt)return hurt===3?17:hurt===4?18:hurt===5?19:hurt===6?(air?(vy>.9?19:vy<-1?17:18):13):10;
 if(act===10)return air?age<3?18:age<7?20:age<12?21:19:age<3?15:age<5?4:age<8?6:age<11?7:age<14?5:15;
 if(act===1)return age<5?8:age<10?9:10;
 if(act===13)return age<5?11:age<10?12:13;
 if(act===14)return age<3?12:age<7?11:age<14?9:13;
 if(act===9)return age<6?24:age<16?25:13;
 if(act===20)return age<5?15:age<11?24:age<18?25:age<25?17:13;
 if(act===2)return age<11?11:age<20?12:13;
 if(act===3)return age<7?28:age<14?29:age<20?12:age<26?25:13;
 if(act===11)return age<7?28:age<19?29:13;
 if(act===4)return age<8?26:age<16?27:10;
 if(act===5||act===6)return age<4?18:age<16?22+(Math.floor(age/4)%2):19;
 if(act===7||act===8)return age<4?15:age<15?9:15;
 if(act===12)return age<12?30:age<20?28:age<28?31:age<36?25:age<45?31:13;
 if(act===15)return age<5?18:age<12?23:22;
 if(act===16)return age<7?24:age<17?23:19;
 if(act===17)return age<7?18:age<14?22:age<23?23:19;
 if(act===18)return age<5?26:age<13?27:18;
 if(act===19)return age<10?30:age<14?18:age<22?23:age<31?31:19;
 if(crouch)return 15;
 if(block)return 14;
 if(air)return vy<-.5?17:vy>.5?19:18;
 if(moving)return 4+(Math.floor(frame/5)%4);
 return Math.floor(frame/12)%4;
}
// Keep the V0.23 aerial light sequence; other aerial attacks and supers use dedicated phases.
export function actionFrame(act,age,type=0){
 const base=act===6?12:act===17?16:act===18?20:act===12?24:act===19?28:-1;
 if(base<0)return -1;
 let phase;
 if(act===17)phase=age<7?0:age<14?1:age<22?2:3;
 else if(act===12){if(!type)phase=age<20?0:age<25?1:age<37?2:3;else{const first=21,last=41,gap=10;phase=age<first?0:age>=last+10?3:age>=last?2:(age-first)%gap<gap-3?1:0;}}
 else if(act===19)phase=age<14?0:age<(type?22:19)?1:age<38?2:3;
 else{const start=act===18?5:8;phase=age<start?0:age<start+4?1:age<start+10?2:3;}
 return 64+type*32+base+phase;
}
const ease=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
// Contact drawings/timings stay intact; insert whole drawings only at anticipation and recovery.
export function transitionFrame(act,age,type=0,air=false,vy=0,cooldown=0,moving=false,crouch=0,block=0){
 let n=-1;
 if(act===1&&(age<2||age>=10&&age<13))n=0;
 else if(act===13)n=age<3?1:age>=10&&age<13?2:-1;
 else if(act===14)n=age<3?3:age>=12&&age<17?4:-1;
 else if(act===5&&(age<2||age>=16&&age<19))n=12;
 else if(act===15&&age<2)n=13;
 else if(act===16&&age>=12&&age<17)n=14;
 else if(!act&&!block&&!crouch){if(air)n=vy<-6?8:vy<-5?9:vy<-.8?-1:vy<.8?10:11;else if(cooldown>0&&cooldown<=4&&!moving)n=cooldown>2?6:7;}
 return n<0?-1:128+type*32+n;
}
export function hurtFrame(stun,air,vy,flash,type=0,kind=0,age=0){
 if(stun<=0)return -1;let n;
 if(kind===-2&&!air)n=age<3?25:age<5?26:stun>8?27+(Math.floor((age-5)/3)%2):stun>5?29:stun>2?30:31;
 else if(flash>=5)n=kind<0?18:16;
 else if(air)n=kind===-1?vy>3?24:vy>.9?23:vy<-1?21:22:vy<-1?20:vy>.9?23:22;
 else n=stun<=6?stun>3?30:31:kind===-3?19:17;
 return 128+type*32+n;
}
export function fighter(c,x,y,type=0,face=1,act=0,age=0,frame=0,crouch=0,flash=0,block=0,moving=false,air=false,vx=0,pose=null,turn=1,vy=0,stun=0,hurtDirection=0,hurtKind=0,cooldown=0,imbued=false,costume=0){
 if(!atlas)return;
 const dash=act===10&&!stun?dashPose(age,type,air):null;
 const hurt=hurtFrame(stun,air,vy,flash,type,hurtKind,age),transition=transitionFrame(act,act===1&&type?Math.max(0,age-1):age,type,air,vy,cooldown,moving,crouch,block),extra=act===3&&type?(age<7?60:age<12?61:age<15?60:age<20?61:age<23?60:age<29?61:45):actionFrame(act,age,type),index=hurt>=0?hurt:dash?dash.frame:transition>=0?transition:extra>=0?extra:spriteFrame(act,act===1&&type?Math.max(0,age-1):age,frame,crouch,block,moving,air,vx,vy,stun,flash)+(type?32:0);
 c.save();c.imageSmoothingEnabled=false;c.translate(Math.round(x),Math.round(y));c.scale(face<0?-1:1,1);
 // Move the complete drawing through anticipation, contact and recovery.
 // The atlas remains intact; there are no independently rotated body parts.
 let dx=0,dy=0,angle=0;
 if(stun){const phase=hurtPhase(stun,air,vy,flash),push=hurtDirection?(face<0?-hurtDirection:hurtDirection):-1,recover=phase===6?stun/6:1,impact=Math.min(1,flash/7);
  dx=push*(phase===1?2+impact*2:phase===2?2:1)*recover;
  dy=air?phase===3?-1:phase===5?1:0:phase===1?1:phase===6?1-recover:1;
  angle=hurtKind===-2?0:push*(phase===1?.035:phase===2?.02:0)*recover;
  if(hurtKind===-2){dx=0;dy=0;}
 }
 else if(act===2){dx=age<9?-3:age<19?5:2;dy=age<9?2:0;angle=age<9?-.07:age<19?.1:0;}
 else if(act===3){dx=age<7?-2:6;dy=age>=19&&age<=25?-3:0;angle=type?-.06:age<7?-.07:.1;}
 else if(act===5){angle=-.1;dx=3;}
 else if(act===6){const u=ease((age-3)/5),r=1-ease((age-16)/10);angle=(type?.1:.18)*u*r;dx=4*u*r;dy=type?u:3*u*r;}
 else if(act===13){const u=Math.min(1,Math.max(0,(age-2)/5));dx=4*u;angle=(type?-.04:.06)*u;}
 else if(act===14){const u=Math.min(1,Math.max(0,(age-3)/4)),recovery=Math.min(1,Math.max(0,(age-14)/12));dx=(4+3*u)*(1-recovery);dy=age<7?1:0;angle=(type?-.07:.1)*u*(1-recovery);}
 else if(act===9){dy=age>=6&&age<=16?-4:1;angle=age>=6&&age<=16?-.1:.03;}
 else if(act===20){const rise=Math.min(1,Math.max(0,(age-9)/6)),settle=Math.min(1,Math.max(0,(age-18)/12));dy=age<9?2:-16*rise*(1-settle);dx=3*rise;angle=(type?-.13:-.1)*rise*(1-settle);}
 else if(act===4||act===11){dx=age<7?-2:4;angle=age<7?-.04:.06;}
 else if(act===12){const first=type?21:20,last=type?41:20,gap=10,prep=ease(age/first),recovery=1-ease((age-(type?last+5:34))/16);let strike=0;for(let k=0;k<(type?3:1);k++){const local=age-first-k*gap;strike+=ease((local+3)/3)*(1-ease(local/(type?6:12)))*(k===2?1.3:1);}dx=(type?-2*prep+4*strike:-3*prep+11*strike)*recovery;dy=(type?-.8*strike:age<first?2*prep:-2*strike)*recovery;angle=(type?-.065*strike:-.045*prep+.13*strike)*recovery;}
 else if(dash){dx=dash.dx;dy=dash.dy;angle=dash.angle;}
 else if(act===15){angle=type?-.2:.14;dx=4;}
 else if(act===16){angle=type?.3:.4;dx=4;dy=2;}
 else if(act===17){const u=ease(age/7)*(1-ease((age-22)/10));angle=type?Math.sin(age*.2)*.07*u:.12*u;dx=(type?2:6)*u;dy=(type?-2:1)*u;}
 else if(act===18){const u=ease(age/5)*(1-ease((age-15)/10));angle=(type?-.04:.1)*u;dx=(type?2:5)*u;dy=-u;}
 else if(act===19){const prep=ease(age/14),recovery=1-ease((age-33)/16);if(type){dx=-2*prep*recovery;dy=-3*prep*recovery;angle=-.045*prep*recovery;}else{const slam=ease((age-11)/3)*(1-ease((age-24)/12));dx=0;dy=(-3*prep+8*slam)*recovery;angle=(-.04*prep+.12*slam)*recovery;}}
 else if(!act&&moving){dy=frame%10<5?-1:0;angle=type?.025:.065;}
 else if(!act&&!air&&!block&&!crouch){dy=type?Math.sin(frame*.09)*.6:Math.sin(frame*.11)*1.1;}
 if(dash){c.translate(dx,dy);c.rotate(angle);c.scale(dash.sx,dash.sy);}else{c.translate(dx,dy-26);c.rotate(angle);c.translate(0,26);}
 if(flash>0&&!stun)c.globalAlpha*=frame%2?.75:1;
 const alternate=costume?outfitFrame(atlas,index,type):null;
 if(alternate)c.drawImage(alternate,-28,-58);else c.drawImage(atlas,(index%8)*CELL,Math.floor(index/8)*CELL,CELL,CELL,-28,-58,CELL,CELL);if(imbued)drawEnchantment(c,index,type,frame);c.restore();
}
// Emission anchors use the same discrete attack phase as the sprite, not IK.
export function castAnchor(out,act,age,type=0){const strike=age>=(act===2?11:act===20?11:act===14?7:act===9?6:act===4?8:5);out[0]=strike?29:11;out[1]=act===7||act===8?-13:act===9||act===20?-45:act===14?-29:act===5||act===6?-30:-32;if(type&&act===2){out[0]=36;out[1]=-30;}if(act===6){out[0]=38;out[1]=type?-8:-5;}if(act===18){out[0]=strike?type?24:42:18;out[1]=type?-36:-30;}return out;}
