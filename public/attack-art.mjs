// Shared stepped palettes and integer contours for all combat effects.
const rect=(c,color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
const pixelArc=(c,color,x,y,rx,ry,a,b,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,rx,ry,0,a,b);c.stroke();};
export function fireball(c,age=0){
 const phase=age*.24;
 // A round hot core and three tapering tongues; no sword crescent around the ball.
 c.save();c.translate(-4,0);c.rotate(-Math.PI/2);
 flame(c,0,7,6,32,'#d6393c',phase);flame(c,0,6,4,26,'#ff7824',phase+.6);flame(c,0,5,2,20,'#ffcb48',phase);c.restore();
 for(let layer=0;layer<3;layer++){const r=10-layer*2.4;c.fillStyle=layer===0?'#d6393c':layer===1?'#ff7824':'#ffdf53';c.beginPath();for(let n=0;n<16;n++){const a=n*Math.PI/8,rr=r+(layer===0?Math.sin(n*3+phase)*1.5:0),x=Math.round(Math.cos(a)*rr),y=Math.round(Math.sin(a)*rr);if(n)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();c.fill();}
 shard(c,2,-1,4,'#fffbc9');rect(c,'#ffcb48',-19,Math.sin(phase)*4,3,2);
}
export function iceChunk(c,age=0){
 c.fillStyle='#276dc4';c.beginPath();c.moveTo(-10,-7);c.lineTo(3,-10);c.lineTo(11,-4);c.lineTo(10,7);c.lineTo(-3,10);c.lineTo(-11,4);c.closePath();c.fill();
 c.fillStyle='#48beef';c.beginPath();c.moveTo(-9,-6);c.lineTo(2,-8);c.lineTo(4,2);c.lineTo(-4,8);c.lineTo(-9,3);c.closePath();c.fill();
 c.fillStyle='#99f8ff';c.beginPath();c.moveTo(3,-8);c.lineTo(9,-3);c.lineTo(4,2);c.closePath();c.fill();
 c.fillStyle='#72e9ff';c.beginPath();c.moveTo(4,3);c.lineTo(9,-2);c.lineTo(8,6);c.lineTo(-2,8);c.closePath();c.fill();
 line(c,'#e8ffff',-8,-5,1,-7,1);line(c,'#c4fdff',2,-7,4,1,1);line(c,'#3878c9',-6,1,2,3,1);
 for(let n=0;n<3;n++){const u=(age*.1+n*.37)%1;shard(c,-13-u*16,Math.sin(n*2.3+age*.12)*7,2,'#99f8ff',.7);}
}
export function swordWave(c,age=0,scale=1){c.save();c.scale(scale,scale);slash(c,-5,0,14,18,true,-.1,2.2);shard(c,5,-12,2,'#99f8ff',-.7);shard(c,7,11,2,'#72e9ff',.7);c.restore();}
export function fireBurst(c,age,finisher=false){
 if(age<0||age>17)return;const release=Math.min(1,(age+2)/4),fade=Math.max(0,1-(age-7)/10),length=(finisher?102:74)+age*2,width=(finisher?27:19)*release;
 c.save();c.globalAlpha*=fade;c.translate(19,-29);c.rotate(Math.PI/2);
 flame(c,0,0,width,length,'#d6393c',age*.3);flame(c,0,-1,width*.77,length*.94,'#ff7824',age*.3+.4);flame(c,0,-3,width*.48,length*.8,'#ffcb48',age*.3);flame(c,0,-5,width*.18,length*.63,'#fffbc9',age*.3);c.restore();
 if(finisher){c.save();c.globalAlpha*=fade;for(let n=0;n<6;n++){const u=age+n*.7;shard(c,55+u*4,-29+Math.sin(n*2.3)*u*2,3,'#ffdf53',n+age*.1);}c.restore();}
}
export function frozenWave(c,age,finisher=false){
 if(age<0||age>19)return;c.save();c.globalAlpha*=Math.max(0,1-(age-9)/10);const x=22+age*4.4,rx=finisher?37:28,ry=finisher?47:33;
 slash(c,x,-29,rx,ry,true,-.1,finisher?9:6);
 for(let n=0;n<5;n++){const a=-1.3+n*.58;shard(c,x+Math.cos(a)*(rx-7),-29+Math.sin(a)*(ry-5),finisher?5:3,n%2?'#48beef':'#99f8ff',a);}
 c.restore();
}
export function frostEdge(c,length,frame){
 c.fillStyle='#276dc4';c.beginPath();c.moveTo(-1,-2);c.lineTo(length-2,-2);c.lineTo(length+1,0);c.lineTo(length-3,3);c.lineTo(-1,2);c.closePath();c.fill();
 c.fillStyle='#99f8ff';c.beginPath();c.moveTo(0,-1);c.lineTo(length-2,-1);c.lineTo(length,0);c.lineTo(0,1);c.closePath();c.fill();
 for(let n=0;n<3;n++){const x=(n+.5)*length/3;shard(c,x,Math.sin(frame*.1+n)*1.5,2.1,'#72e9ff',n*.8);}
}
export function line(c,color,x,y,tx,ty,width=1){c.strokeStyle=color;c.lineWidth=width;c.lineCap='butt';c.beginPath();c.moveTo(Math.round(x),Math.round(y));c.lineTo(Math.round(tx),Math.round(ty));c.stroke();}
export function shard(c,x,y,r,color,phase=0){c.fillStyle=color;c.beginPath();for(let n=0;n<4;n++){const a=phase+n*Math.PI/2,rr=n%2?r*.3:r;const px=Math.round(x+Math.cos(a)*rr),py=Math.round(y+Math.sin(a)*rr);if(n)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.fill();}
export function slash(c,x,y,rx,ry,ice,phase=0,thick=3){
 // Three nested, filled crescents: a continuous blade with a tapered white edge.
 for(let layer=0;layer<3;layer++){c.fillStyle=layer===0?(ice?'#276dc4':'#d6393c'):layer===1?(ice?'#72e9ff':'#ffcb48'):'#fffde3';c.beginPath();const inset=layer*.8,weight=layer===0?thick*2.2:layer===1?thick*1.35:Math.max(.9,thick*.3);for(let n=0;n<=26;n++){const a=-2+phase+n*3.1/26,px=Math.round(x+Math.cos(a)*(rx-inset)),py=Math.round(y+Math.sin(a)*(ry-inset));if(n)c.lineTo(px,py);else c.moveTo(px,py);}for(let n=26;n>=0;n--){const a=-2+phase+n*3.1/26,w=weight*Math.sin(n*Math.PI/26);c.lineTo(Math.round(x+Math.cos(a)*(rx-inset-w)),Math.round(y+Math.sin(a)*(ry-inset-w)));}c.closePath();c.fill();}
}
export function impact(c,x,y,r,ice,phase=0){for(let n=0;n<8;n++){const a=phase+n*Math.PI/4;shard(c,x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55,r*.8,ice?'#81efff':'#ffd352',a);}shard(c,x,y,r*.6,'#fffbe5',phase);shard(c,x,y,r*.45,'#ffffff',phase+Math.PI/2);}
export function blaze(c,x,y,len,ice,phase){for(let n=6;n>=0;n--){const u=n/6,px=x-len*u,py=y+Math.sin(phase+n)*3,h=(1-u)*11+2;rect(c,ice?'#3268c9':'#e83832',px,py-h/2,5,h);rect(c,ice?'#78f1ff':'#ffbf3b',px+1,py-h/3,4,h*.65);rect(c,'#fffce1',px+2,py-h/6,2,h*.35);}shard(c,x+4,y,10,ice?'#e4ffff':'#fff7cb');}
export function explosion(c,x,y,age,ice,size=1){if(age<0||age>18)return;const r=(8+age*2)*size;c.save();c.globalAlpha*=Math.max(0,(18-age)/14);impact(c,x,y,r,ice,age*.04);slash(c,x,y,r,r*.4,ice,age*.1,3);for(let n=0;n<7;n++){const a=n*Math.PI*2/7;rect(c,ice?'#94faff':'#ffa434',x+Math.cos(a)*r*1.3,y+Math.sin(a)*r*.65,3,3);}c.restore();}
export function flame(c,x,y,w,h,color,phase){c.fillStyle=color;c.beginPath();c.moveTo(x-w,y);c.lineTo(x-w*.7,y-h*.3);c.lineTo(x-w*.95,y-h*.63);c.lineTo(x-w*.35,y-h*.53);c.lineTo(x+Math.sin(phase)*w*.4,y-h);c.lineTo(x+w*.4,y-h*.66);c.lineTo(x+w*.6,y-h*.77);c.lineTo(x+w,y-h*.38);c.lineTo(x+w*.65,y);c.closePath();c.fill();}
export function crystal(c,x,y,w,h){c.fillStyle='#3878c9';c.beginPath();c.moveTo(x-w,y-2);c.lineTo(x-w*.8,y-h*.72);c.lineTo(x+2,y-h);c.lineTo(x+w,y-h*.7);c.lineTo(x+w*.8,y);c.closePath();c.fill();c.fillStyle='#85edff';c.beginPath();c.moveTo(x-w*.65,y-2);c.lineTo(x-w*.5,y-h*.7);c.lineTo(x+2,y-h+2);c.lineTo(x+1,y);c.closePath();c.fill();c.fillStyle='#e9ffff';c.beginPath();c.moveTo(x+2,y-h+2);c.lineTo(x+w*.65,y-h*.69);c.lineTo(x+3,y-5);c.closePath();c.fill();line(c,'#c4fdff',x-w*.5,y-h*.7,x+2,y-h+3,1);}
export function column(c,x,y,ice,age,height){if(age<0||age>19)return;const f=Math.sin(Math.min(1,(age+1)/7)*Math.PI/2),h=height*f;c.save();c.globalAlpha=Math.max(.05,1-age/21);for(let n=-2;n<=2;n++){const px=x+n*9,hh=h*(1-Math.abs(n)*.16);if(ice)crystal(c,px,y,9,hh);else{flame(c,px,y,13,hh,'#bd2946',age*.2+n);flame(c,px,y,10,hh*.91,'#ff7836',age*.2+n);flame(c,px,y,7,hh*.74,'#ffd356',age*.2+n);flame(c,px,y,3,hh*.54,'#fff4b5',age*.2+n);}}slash(c,x,y,32+age*3,7+age*.4,ice,0,3);for(let n=0;n<8;n++){const px=x+Math.sin(n*2.4)*28,py=y-((age*4+n*19)%height);shard(c,px,py,ice?3:2,ice?'#c1ffff':'#ffe59b',age*.2);}c.restore();}
