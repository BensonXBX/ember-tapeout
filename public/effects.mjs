import {costumeFor} from './costumes.mjs?v=cbe686a7709b3bbf';
import {makeSuperTitles,SUPER_TITLE_BYTES} from './super-title.mjs?v=2a74e07e5da9b178';
import {line,shard,slash,impact,blaze,explosion,flame,crystal,column,fireball,swordWave} from './attack-art.mjs?v=94266ab2688d52df';
import {drawSuper,drawSuperBack,drawFinishContact,drawSuperGround,superStart,superFinal} from './finale.mjs?v=6b77370875f77326';
import {impactProfile,impactGuard,impactOwner,impactStop} from './impact.mjs?v=76bc5d8c4221f74f';
import {WORLD_WIDTH,FLOOR} from './stage.mjs?v=2ae99339b7bcc18e';
import {pbase,projectileBase,PROJECTILE_COUNT,projectileOwner} from './engine.mjs?v=ee9e0d5b4ef43ac9';
import {rect,pixelArc,fighter,castAnchor} from './fighters.mjs?v=3227a19df8e902e1';
export const FX_CAPACITY=128,DAMAGE_LABEL_COUNT=8,FX_BYTES=128*9*4+20*4+8*6*4+17*4+SUPER_TITLE_BYTES;
const colors=[['#fffbc9','#ffdf53','#ff7824','#de2d48'],['#ffffff','#99f8ff','#48beef','#5367de'],['#ffffff','#c8ffb7','#8bbe9c','#457370']];
function dodgeWake(c,x,y,dir,age,ice,air){
 const launch=Math.min(1,Math.max(0,(age-2)/4)),brake=Math.min(1,Math.max(0,(age-10)/6));
 c.save();c.translate(x,y);c.scale(dir,1);
 if(age<=4){for(let n=0;n<5;n++){c.globalAlpha=.8;shard(c,-6-n*4,air?-18:1,ice?3:2,ice?'#99f8ff':'#ffcb48',n*.7);}}
 if(age>=3&&age<14){for(let n=0;n<8;n++){const travel=(age*3+n*7)%52,yy=air?-24+Math.sin(n*2)*11:-2-n%3*2;c.globalAlpha=(1-travel/60)*.75;if(ice)shard(c,-travel,yy,2+n%2,'#99f8ff',-.2);else flame(c,-travel,yy,2+n%3,5+n%4*2,'#ff7824',age*.5+n);}}
 if(brake>0&&!air){c.globalAlpha=(1-brake*.6)*.65;for(let n=0;n<6;n++){const px=3+n*brake*5;if(ice)shard(c,px,-2-(n%3)*brake*3,2+brake*2,'#99f8ff',-.6);else flame(c,px,0,2+brake*2,4+(n%3)*3,'#ffcb48',age*.3+n);}}
 c.restore();
}

// Separate combat languages: expanding heat pressure versus precise cold blades.
function iceBlade(c,x,y,length,angle,age=0){c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=Math.max(.12,1-age/18);c.fillStyle='#2857a8';c.beginPath();c.moveTo(-5,-4);c.lineTo(length,-2);c.lineTo(length+13,0);c.lineTo(length,3);c.lineTo(-5,5);c.closePath();c.fill();line(c,'#75e9ff',0,0,length+10,0,4);line(c,'#ffffff',4,-1,length+10,-1,1);line(c,'#acdfff',0,-7,0,7,2);c.restore();}
function frostSeal(c,x,y,r,age){c.save();c.globalAlpha*=.55;pixelArc(c,'#8cf5ff',x,y,r,r,0,Math.PI*2,1);pixelArc(c,'#4665c6',x,y,r*.8,r*.8,0,Math.PI*2,2);for(let n=0;n<6;n++){const a=n*Math.PI/3+age*.035;line(c,'#b1faff',x+Math.cos(a)*r*.65,y+Math.sin(a)*r*.65,x+Math.cos(a)*r,y+Math.sin(a)*r,1);}c.restore();}
function airCombat(c,act,age,ice){
 if(act===6&&age>=6&&age<=20){const u=age-6;if(ice){slash(c,15,-29,53,51,true,.75,6);iceBlade(c,14,-57,60,.98,u);line(c,'#b8f9ff',24,-51,54,12,3);shard(c,48,7,8,'#efffff',.9);}else{slash(c,9,-28,42,52,false,1.2,6);flame(c,37,11,10,53,'#f77438',u*.2);flame(c,38,8,5,45,'#ffe6a1',u*.2);blaze(c,37,-5,23,false,u);if(u<7)impact(c,40,9,13-u,false);}}
 else if(act===17&&age>=5&&age<26){if(ice){const phase=age<14?-age*.14:age*.17;slash(c,8,-28,72,37,true,phase,6);slash(c,8,-28,59,32,true,phase+Math.PI,3);for(let n=0;n<6;n++){const a=phase+n*Math.PI/3;shard(c,8+Math.cos(a)*59,-28+Math.sin(a)*32,5,'#c5ffff',a);}}else{const second=age>=13,angle=second?.75:-.35;slash(c,12,-28,56,44,false,angle,6);blaze(c,42,second?-5:-37,41,false,age);flame(c,40,second?11:-19,9,38,'#ffa94b',age*.3);explosion(c,46,second?0:-35,(age-7)%7,false,.8);}}
 else if(act===18){if(age<5){if(ice)frostSeal(c,23,-36,7+age,age);else flame(c,22,-29,5+age,11+age*2,'#ffd465',age);}else if(age<17){if(ice){slash(c,24,-35,29,24,true,age*.2,3);iceBlade(c,19,-37,21,.32,age-5);for(let n=0;n<4;n++)shard(c,22+n*6,-34+n*4,3,'#b8ffff',.3);}else{blaze(c,45,-30,50,false,age);impact(c,42,-30,15-(age-5)*.5,false);pixelArc(c,'#ffd65b',33,-30,18+age*.2,16,-1.7,1.7,4);}}}
}

export function makeEffects(){
 const titles=makeSuperTitles();
 const particles=new Float32Array(FX_CAPACITY*9),previous=new Float32Array(20),labels=new Float32Array(DAMAGE_LABEL_COUNT*6),anchor=new Float32Array(17);let cursor=0,lastTime=0,lastFrame=-1,lastRound=-1,labelCursor=0,trainingEpoch=-1,trainingSequence=0,wasTraining=false;
 function emit(x,y,count,palette,speed=1.5,gravity=.06,material=0){for(let n=0;n<count;n++){const z=(cursor++%FX_CAPACITY)*9,a=n*2.399+cursor*.31,v=speed*(.4+(n%5)*.16);particles[z]=x;particles[z+1]=y;particles[z+2]=Math.cos(a)*v;particles[z+3]=Math.sin(a)*v-.35;particles[z+4]=particles[z+5]=12+(n%6)*3;particles[z+6]=palette;particles[z+7]=material|| (n%4===0?2:1);particles[z+8]=gravity;}}
 function damageLabel(x,y,amount,guard,type){const z=(labelCursor++%DAMAGE_LABEL_COUNT)*6;labels[z]=x;labels[z+1]=y-19-(labelCursor%3)*6;labels[z+2]=amount;labels[z+3]=40;labels[z+4]=guard?1:0;labels[z+5]=type;}
 function sync(s,training=null){const changed=!!training!==wasTraining||training&&training.epoch!==trainingEpoch;if(changed){wasTraining=!!training;trainingEpoch=training?.epoch??-1;trainingSequence=0;}if(lastRound!==s[3]||s[1]===0||changed){titles.reset();particles.fill(0);labels.fill(0);lastRound=s[3];for(let i=0;i<2;i++){const p=pbase(i);previous[i*4]=s[p+3];previous[i*4+1]=s[p+5];previous[i*4+2]=s[p+7];previous[i*4+3]=s[p+8];}}if(s[0]===lastFrame)return;lastFrame=s[0];
  for(let i=0;i<2;i++){const p=pbase(i),v=i*4,x=s[p],y=s[p+1]-28,act=s[p+7],age=s[p+8],type=s[p+11],damage=previous[v]-s[p+3],blocked=previous[v+1]-s[p+5]>3&&damage<=1.1;
   if(damage>0){emit(x,y,blocked?12:damage>12?28:18,blocked?2:s[pbase(1-i)+11],blocked?1:2.6);damageLabel(x,y,damage,blocked,type);}
   if(act!==previous[v+2]&&act>=3&&act!==12&&act!==19)emit(x+s[p+6]*16,y,8,type,1.05,.01);
   if(act===10)emit(x-Math.sign(s[p+25])*8,s[p+1]-(Math.abs(s[p+25])===2?24:2),3,type,1.1,.06);
   if(previous[v+2]===10&&act!==10)emit(x,s[p+1]-24,18,type,1.8,.015);
   if(act===12||act===19){const first=superStart(type,act===19),gap=act===12?10:8;for(let k=0;k<(type?3:1);k++){const beat=first+k*gap;if(age>=beat&&(act!==previous[v+2]||previous[v+3]<beat))emit(!type&&act===19?x:x+s[p+6]*88,!type&&act===19?y+70:y,!type||k===2?24:8,type,!type||k===2?2.3:1.2,type?.015:.09,type?-3:-1);}}
   previous[v]=s[p+3];previous[v+1]=s[p+5];previous[v+2]=act;previous[v+3]=age;
  }
  if(training&&training.sequence>trainingSequence){for(let n=0;n<training.count;n++){if(training.sequence-training.count+n+1<=trainingSequence)continue;const z=((training.cursor-training.count+n+DAMAGE_LABEL_COUNT)%DAMAGE_LABEL_COUNT)*6,r=training.records;damageLabel(r[z+3],r[z+4],r[z+1],!!(r[z+5]&1),s[55]);emit(r[z+3],r[z+4],(r[z+5]&1)?12:r[z+1]>12?28:18,(r[z+5]&1)?2:s[27],(r[z+5]&1)?1:2.6);}trainingSequence=training.sequence;}
  for(let n=0;n<PROJECTILE_COUNT;n++){const z=projectileBase(n),v=8+n*2;if(previous[v]>0&&s[z+3]<=0&&s[z]>4&&s[z]<WORLD_WIDTH-4)emit(s[z],s[z+1],16,s[pbase(projectileOwner(n))+11],1.7,.035);previous[v]=s[z+3];previous[v+1]=s[z];}
 }
 function under(c,s){for(let i=0;i<2;i++){const p=pbase(i),act=s[p+7],age=s[p+8],x=s[p],y=s[p+1],dir=s[p+6],ice=s[p+11];
  if(act===10)dodgeWake(c,x,y,Math.sign(s[p+25])||dir,age,ice,Math.abs(s[p+25])===2);
  if(act===10&&age>=4&&age<=13||act===3&&!ice&&age>=9&&age<=20){const direction=act===10?Math.sign(s[p+25])||dir:dir;for(let n=act===10?3:5;n>=1;n--){c.save();c.globalAlpha=act===10?.06*(4-n):.07*(6-n);fighter(c,x-direction*n*(act===10?(age<9?8:5):10),y,ice,dir,act,Math.max(0,age-n*2),s[0],0,0,0,true,y<143,4,null,1,0,0,0,0,0,false,costumeFor(s,i));c.restore();}for(let n=0;n<5;n++)line(c,ice?'#b4f2ff':'#ffe896',x-direction*(35+n*4),y-14-n*7,x-direction*(14+n*3),y-14-n*7,1);}
  if(act===12||act===19){const air=act===19,first=superStart(ice,air),last=superFinal(ice,air),shade=age<first?.42*(1-age/first*.3):age<last?.13:.3*Math.max(0,1-(age-last)/24);c.save();c.globalAlpha=shade;rect(c,ice?'#0f1a24':'#201813',0,-160,WORLD_WIDTH,400);c.restore();drawSuperGround(c,x,y,age,ice,air,dir);drawSuperBack(c,x,y,age,ice,air,dir);}
 }}
 function over(c,s,t){const dt=Math.min(3,Math.max(0,(t-lastTime)/16.667));lastTime=t;c.save();
  for(let i=0;i<2;i++){const p=pbase(i),x=s[p],y=s[p+1],act=s[p+7],age=s[p+8],ice=s[p+11],dir=s[p+6];castAnchor(anchor,act,age,ice);const hx=anchor[0],hy=anchor[1];c.save();c.translate(x,y);c.scale(dir,1);if(ice&&[1,13,14,5,15,16,7].includes(act))c.scale(1.1,1);
   if((act===1||act===13)&&age>=(ice&&act===1?5:4)&&age<=(ice&&act===1?12:11)){if(ice)slash(c,8,-30,act===13?44:37,19,true,act===13?.4:0,1.7);else{blaze(c,hx,hy,22,false,age);line(c,'#fff7ad',9,hy-4,34,hy-4,1);}}
   if(act===14&&age>=6&&age<=15){const u=age-6;slash(c,13,-29,ice?53:45,ice?18:14,ice,ice?.1:0,5);line(c,ice?'#d5ffff':'#fff4b4',18,-30,43+u,-30,3);impact(c,38,-28,Math.max(4,13-u),ice);if(!ice)blaze(c,35,-29,28,false,age);}
   if(act===20&&age>=9&&age<=24){const u=age-9,height=Math.min(73,28+u*5);slash(c,8,-27,30,height,ice,-.65,6);slash(c,12,-28,22,height-7,ice,-.6,3);line(c,ice?'#dcffff':'#fff5ad',20,-14,30,-height,3);if(ice){for(let k=0;k<3;k++)shard(c,20+k*6,-25-u*3-k*7,10,'#c5f9ff',-.8);}else{flame(c,22,-6,13,height,'#f46b32',u*.18);flame(c,24,-8,7,height-9,'#ffed9b',u*.18);}if(age>=11&&age<=16)impact(c,28,-53,14-u*.3,ice,-1);}
   if(act===9&&age>=6&&age<=17){slash(c,3,-28,44,55,ice,-.5,6);slash(c,9,-29,39,49,ice,-.45,3);impact(c,26,-55,14,ice,-1);column(c,20,-4,ice,age-6,55);}
   if(act===2&&age>=10&&age<=23){slash(c,8,-29,ice?66:49,ice?36:49,ice,ice?.35:-.6,8);slash(c,12,-29,ice?57:42,ice?30:42,ice,ice?.4:-.55,4);if(!ice)blaze(c,35,-35,44,false,age);impact(c,ice?58:41,-27,14,ice,.3);}
   if((act===5||act===7||act===8)&&age>=4&&age<=16){const low=act===7||act===8;slash(c,12,low?-8:-28,act===8?47:38,low?11:25,ice,age*.07,3);if(!ice)blaze(c,31,low?-9:-28,23,false,age);}
   if((act===3||act===4||act===11)&&age<8){slash(c,hx,hy,5+age,5+age,ice,age*.3,1);rect(c,ice?'#d9ffff':'#fff9a5',hx,hy,3,3);}
   if(act===4&&age>=8&&age<15){impact(c,hx,hy,21,ice);slash(c,hx,hy,26,26,ice,age*.15,3);blaze(c,hx+8,hy,29,ice,age);}
   if(act===3&&ice&&(age===9||age===17||age===25)){impact(c,hx+8,hy,12,true);}
   if(act===3&&age>=9&&age<=28){slash(c,15,-30,61,42,ice,age*.15,6);slash(c,10,-30,49,32,ice,-age*.12,3);blaze(c,hx+7,hy,56,ice,age);if(!ice){const u=(age-10)%7;explosion(c,45,-26,u,false,1.5);if(age>=21)column(c,62,-2,false,age-21,72);}else for(let k=0;k<3;k++)shard(c,30+k*15,-27-Math.sin(age*.3+k)*22,18,'#dcffff',age*.15);}
   if(act===11&&age>=6&&age<19){slash(c,16,-28,59,39,ice,age*.08,6);blaze(c,hx+14,hy,48,ice,age);}
   if(act===12)drawSuper(c,age,ice,false);
   if((act===15||act===16)&&age>=4&&age<=18){const finish=act===16;slash(c,10,-27,finish?56:46,finish?38:30,ice,age*.09,finish?6:4);if(finish){line(c,ice?'#b7ffff':'#ffdc83',27,-51,47,-6,5);impact(c,35,-13,15,ice,.8);}else if(!ice)blaze(c,36,-28,30,false,age);}
   if(act===6||act===17||act===18)airCombat(c,act,age,ice);
   if(act===19)drawSuper(c,age,ice,true,FLOOR-y);
   if(s[p+18]&128&&s[p+5]>0&&s[p+7]===0){slash(c,15,-25,21,27,true,0,2);}
   c.restore();
  }
  if(s[8]>0&&s[10]){const profile=impactProfile(s[10]),guard=impactGuard(s[10]),owner=impactOwner(s[10]),p=pbase(1-owner),ice=s[pbase(owner)+11],x=s[p],y=s[p+1]-26,progress=1-s[8]/impactStop(profile,guard);c.save();c.globalAlpha=1-progress*.65;
   if(guard){pixelArc(c,'#bcffe9',x,y,11,16,-1.5,1.5,1);}
   else if(profile===0){shard(c,x,y,7,'#fffce1',.4);line(c,ice?'#93eeff':'#ffc365',x-11,y+4,x+11,y-4,1);}
   else if(profile===3)drawFinishContact(c,x,y,ice,progress);
   else{impact(c,x,y,profile===2?18:profile===1?14:10,ice,profile===2?-1:.3);if(profile===2){line(c,ice?'#d8ffff':'#fff5b8',x-3,y+24,x+5,y-32,3);}}
   c.restore();
  }
  for(let n=0;n<PROJECTILE_COUNT;n++){const z=projectileBase(n);if(s[z+3]<=0)continue;const x=s[z],y=s[z+1],dir=s[z+2],ice=s[z+4]!==0&&s[z+4]!==5&&s[z+4]!==7;c.save();c.translate(x,y);c.scale(dir,1);if(s[z+4]===3)swordWave(c,s[0]);else if(s[z+4]===4||s[z+4]===9){slash(c,0,0,s[z+4]===4?24:22,24,true,s[0]*.25,5);slash(c,0,0,18,18,true,-s[0]*.25,3);shard(c,0,0,13,'#e8ffff');}else if(ice){c.scale(1.3,1.3);swordWave(c,s[0],1.4);}else fireball(c,s[0]);c.restore();}
  for(let n=0;n<FX_CAPACITY;n++){const z=n*9;if(particles[z+4]<=0)continue;particles[z]+=particles[z+2]*dt;particles[z+1]+=particles[z+3]*dt;particles[z+3]+=particles[z+8]*dt;particles[z+4]-=dt;c.globalAlpha=Math.max(0,Math.min(1,particles[z+4]/8));const kind=particles[z+7],life=particles[z+4]/particles[z+5],x=particles[z],y=particles[z+1];if(kind===-1){line(c,life>.6?'#ffe47d':'#f46621',x,y,x-particles[z+2]*1.6,y-particles[z+3]*1.6,1);}else if(kind===-3){c.save();c.translate(x,y);c.rotate(particles[z+4]*.08);c.fillStyle=life>.6?'#b6f6ff':'#359bd8';c.beginPath();c.moveTo(-3,0);c.lineTo(0,-1);c.lineTo(4,0);c.lineTo(0,2);c.closePath();c.fill();c.restore();}else rect(c,colors[particles[z+6]|0][Math.min(3,Math.floor((1-life)*4))],x,y,kind,kind);}c.globalAlpha=1;
  for(let i=0;i<DAMAGE_LABEL_COUNT;i++){const z=i*6;if(labels[z+3]<=0)continue;labels[z+3]-=dt;labels[z+1]-=.22*dt;const amount=Math.abs(labels[z+2]-Math.round(labels[z+2]))<.005?String(Math.round(labels[z+2])):labels[z+2].toFixed(1),text=(labels[z+4]?'GUARD -':'-')+amount;c.font='bold '+(labels[z+4]?7:9)+'px monospace';c.globalAlpha=Math.min(1,labels[z+3]/10);c.fillStyle='#10203a';c.fillText(text,labels[z]+1,labels[z+1]+1);c.fillStyle=labels[z+4]?'#beffdf':'#fff0ae';c.fillText(text,labels[z],labels[z+1]);}c.globalAlpha=1;
  c.restore();
 }
 function screen(c,s,t){titles.observe(s,t);c.save();
  if(s[8]>0&&!impactGuard(s[10])&&impactProfile(s[10])===3){c.globalAlpha=s[8]>=9?.15:.035*s[8]/8;rect(c,s[pbase(impactOwner(s[10]))+11]?'#d9fbff':'#fff1bf',0,0,320,180);c.globalAlpha=1;}
  for(let i=0;i<2;i++){const title=titles.get(i,t);if(!title)continue;const {type:ice,air,elapsed}=title;
   const u=elapsed/1000,slide=Math.max(0,1-elapsed/120)*80,fade=Math.min(1,(1000-elapsed)/100);c.save();c.globalAlpha=fade;c.beginPath();c.moveTo(0,31);c.lineTo(320,25);c.lineTo(320,73);c.lineTo(0,80);c.closePath();c.clip();rect(c,ice?'#15242f':'#2b211b',0,25,320,56);
   for(let n=0;n<14;n++){const yy=28+n*4;line(c,ice?'#304655':'#4c3528',0,yy,320,yy-6,n%3?1:2);}
   line(c,ice?'#96adb5':'#c4a273',0,31,320,25,1);line(c,ice?'#526d7b':'#825338',0,80,320,73,2);
   c.save();c.translate(8-slide,4);c.scale(2.5,2.5);fighter(c,19,62,ice,1,0,0,s[0],0,0,0,false,false,0,null,1,0,0,0,0,0,false,costumeFor(s,i));c.restore();
   const x=116+slide*.3;c.font='bold 12px "Microsoft YaHei",sans-serif';c.fillStyle='#dedccd';c.fillText(air?(ice?'天霜剑雨':'坠日赤莲'):(ice?'永夜冰葬':'赤莲焚城'),x,48);c.font='6px monospace';c.fillStyle=ice?'#91a9b3':'#b5a083';c.fillText(air?(ice?'SKYFALL BLADES':'FALLING SUN'):(ice?'ETERNAL FROST':'CRIMSON LOTUS'),x,63);
   // Short broken material strokes replace sweeping neon speed lines.
   for(let n=0;n<7;n++)line(c,ice?'#5a7481':'#9c6842',228+n*13-u*17,37+n%3*8,235+n*13-u*17,36+n%3*8,1);c.restore();
  }c.restore();
 }

 return {sync,under,over,screen,bytes:particles.byteLength+previous.byteLength+labels.byteLength+anchor.byteLength+titles.bytes,get particleCount(){let count=0;for(let n=0;n<FX_CAPACITY;n++)if(particles[n*9+4]>0)count++;return count;}};
}
