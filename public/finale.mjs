import {flame,shard,impact,frozenWave} from './attack-art.mjs?v=94266ab2688d52df';
import {fireSurge,flameFist,iceSword} from './super-art.mjs?v=e89a2e6a57becb6b';
import {FLOOR} from './stage.mjs?v=2ae99339b7bcc18e';
const clamp=v=>Math.max(0,Math.min(1,v));
export const superStart=(type,air)=>air?14:type?21:20;
export const superFinal=(type,air)=>type?air?30:41:superStart(type,air);
function fallingIce(c,u,last){if(u<0||u>20)return;c.save();c.globalAlpha*=clamp((21-u)/13);for(let n=0;n<5;n++){const x=42+n*20,y=-99+Math.min(u,13)*7+(n%2)*9;iceSword(c,x,y,last?45:35,last?6:4,u*.1+n);}if(last&&u>=6)for(let n=0;n<4;n++)iceSword(c,70+n*13,-44,44-(n%2)*9,5,n);c.restore();}
export function drawSuperBack(c,x,y,age,type,air=false,dir=1){
 const first=superStart(type,air);c.save();c.translate(x,y);c.scale(dir,1);
 if(!type){if(air)flameFist(c,age-first,FLOOR-y);else fireSurge(c,age-first);}
 else for(let n=0;n<3;n++){const u=age-first-n*(air?8:10),last=n===2;if(air)fallingIce(c,u,last);else frozenWave(c,u,last);}
 c.restore();
}
export function drawSuper(c,age,type,air=false,floorDistance=Infinity){
 const first=superStart(type,air);
 if(type){
  if(age<first){if(age<first-8)return;const prep=age-(first-8);c.save();c.globalAlpha*=.6;for(let n=0;n<3;n++)shard(c,18+n*7,-27-n*3,2+prep*.2,'#99f8ff',.5);c.restore();return;}
  for(let n=0;n<3;n++){const u=age-first-n*(air?8:10);if(u<0||u>15)continue;c.save();c.globalAlpha*=clamp((16-u)/12)*.7;const x=air?55+u*2:39+u*4,y=air?u*3-23:-29;for(let k=0;k<(n===2?8:4);k++){const a=k*2.4;shard(c,x+Math.cos(a)*(8+u*2.3),y+Math.sin(a)*(7+u*1.5),n===2?3:2,'#99f8ff',a+u*.09);}if(u<4)impact(c,air?42:29,air?-10:-28,n===2?12:7,true,.3);c.restore();}return;
 }
 if(age<first){if(age<first-8)return;const prep=age-(first-8);c.save();c.globalAlpha*=.65;
  if(type){for(let n=0;n<3;n++)shard(c,18+n*7,-27-n*3,2+prep*.2,'#99f8ff',.5);}
  else if(air){c.save();c.translate(0,-88);c.scale(.18+prep*.04,.18+prep*.04);flameFist(c,0);c.restore();}
  else{flame(c,15,-23,5,12+prep,'#ff7824',prep*.2);flame(c,15,-24,2.5,9+prep*.7,'#ffdf53',prep*.2);}
  c.restore();return;
 }
 const count=type?3:1,gap=air?8:10;
 for(let n=0;n<count;n++){const u=age-first-n*gap;if(u<0||u>19)continue;c.save();c.globalAlpha*=clamp((20-u)/16)*.7;
  const x=!type&&air?0:air?55+u*2:type?39+u*4:88,y=!type&&air?Math.min(47,floorDistance-2):air?u*3-23:-33;
  for(let k=0;k<(!type||n===2?8:4);k++){const a=k*2.4,dx=Math.cos(a)*(14+u*2.3),dy=Math.sin(a)*(12+u*1.5);shard(c,x+dx,y+dy,3,type?'#99f8ff':'#ffdf53',a+u*.09);}c.restore();
 }
}
export function drawFinishContact(c,x,y,type,progress){c.save();c.globalAlpha*=1-progress*.75;impact(c,x,y,16+progress*21,type,progress*.3);for(let n=0;n<7;n++){const a=n*Math.PI*2/7,r=17+progress*38;shard(c,x+Math.cos(a)*r,y+Math.sin(a)*r*.7,4-progress*2,type?'#72e9ff':'#ffcb48',a);}c.restore();}
export function drawSuperGround(c,x,y,age,type,air,dir=1){if(air){if(!type){const u=age-14;if(u>=5&&u<27){c.save();c.globalAlpha*=1-clamp((u-14)/13);for(let n=0;n<7;n++){const xx=x+(n-3)*11;flame(c,xx,FLOOR,6,8+Math.sin(n+u*.3)*3,'#ff7824',u*.2+n);shard(c,xx+(n-3)*u*.4,FLOOR-3-(u-5)*.7,2,'#ffcb48',n);}c.restore();}}return;}const u=age-superFinal(type,false);if(u<0||u>(type?22:28))return;c.save();c.translate(x,y);c.scale(dir,1);c.globalAlpha*=clamp(type?(23-u)/17:(29-u)/22)*.6;for(let n=0;n<(type?7:9);n++){const px=35+n*(type?15:13)+u*(n-(type?3:4))*.5;shard(c,px,2-Math.sin(n*2.3)*u*.6,3,type?'#48beef':'#ff7824',n+u*.1);}c.restore();}
