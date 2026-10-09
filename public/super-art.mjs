import {flame,shard,line} from './attack-art.mjs?v=94266ab2688d52df';
const clamp=v=>Math.max(0,Math.min(1,v));
// A forward jet of filled, stepped flame tongues from Jin's punching hand.
export function fireSurge(c,u){
 if(u<0||u>35)return;
 const fade=1-clamp((u-18)/17),length=126+Math.min(u,6)*3,pulse=u*.43;
 c.save();c.translate(21,-29);c.globalAlpha*=fade;
 const palette=['#a52340','#d6393c','#ff7824','#ffcb48','#fffbc9'];
 for(let layer=0;layer<5;layer++){
  const h=31-layer*5.8,reach=length-layer*13;c.fillStyle=palette[layer];c.beginPath();c.moveTo(-4,-Math.max(3,h*.2));
  for(let n=0;n<=17;n++){const progress=n/17,x=progress*reach,envelope=Math.sin(progress*Math.PI*.84)*.76+.2;
   const flicker=Math.sin(n*1.8-pulse)*3+Math.sin(n*3.1-pulse*1.7)*2;c.lineTo(Math.round(x/2)*2,Math.round((-h*envelope+flicker*(1-layer*.15))/2)*2);}
  c.lineTo(reach+10+Math.sin(pulse)*4,0);
  for(let n=17;n>=0;n--){const progress=n/17,x=progress*reach,envelope=Math.sin(progress*Math.PI*.84)*.76+.2;
   c.lineTo(Math.round(x/2)*2,Math.round((h*envelope+Math.sin(n*2.3-pulse+2)*3*(1-layer*.15))/2)*2);}
  c.lineTo(-4,3);c.closePath();c.fill();
 }
 // Curling tongues break up the silhouette; the hotter filaments advect forward.
 for(let n=0;n<9;n++){
  const progress=(n*.137+u*.029)%1,x=18+progress*(length-15),side=n%2?1:-1,y=side*(10+Math.sin(progress*Math.PI)*14);
  c.save();c.translate(x,y);c.rotate(Math.PI/2+side*(.16+Math.sin(pulse+n)*.12));flame(c,0,0,7,21+progress*18,n%3?'#ff7824':'#d6393c',pulse+n);flame(c,0,-1,3,18+progress*10,'#ffdf53',pulse+n);c.restore();
 }
 for(let n=0;n<14;n++){const travel=(u*4+n*19)%(length+22),side=n%2?1:-1;shard(c,travel,side*(26+(n%3)*5)+Math.sin(pulse+n)*3,n%3?2:3,'#ffcb48',.2);}
 c.restore();
}
// Filled petals share the ordinary fire palette; veins remain small accents.
function petal(c,w,l,color,tip=0){c.fillStyle=color;c.beginPath();c.moveTo(0,4);c.bezierCurveTo(-w*.9,-l*.17,-w,-l*.54,-w*.45,-l*.77);c.bezierCurveTo(-w*.24,-l*.9,tip,-l*1.12,tip+2,-l);c.bezierCurveTo(w*.86,-l*.71,w*.77,-l*.23,0,4);c.closePath();c.fill();}
export function fireLotus(c,u){
 if(u<0||u>33)return;const bloom=.8+.2*clamp(u/4),fade=1-clamp((u-16)/17);
 c.save();c.globalAlpha*=fade;c.save();c.translate(21,-29);c.rotate(Math.PI/2);flame(c,0,0,9,65,'#d6393c',u*.2);flame(c,0,0,5,58,'#ff7824',u*.2);c.restore();
 c.translate(88+Math.min(u,12)*.65,-33);c.scale(bloom,bloom*.83);c.rotate(Math.sin(u*.12)*.025);
 for(let ring=0;ring<3;ring++){const count=ring===0?11:ring===1?8:6;
  for(let n=0;n<count;n++){const a=n*Math.PI*2/count+(ring===1?.22:ring===2?-.15:0),w=ring===2?11:14,l=(ring===0?43:ring===1?33:23)+Math.sin(n*2.1+u*.13)*2;
   c.save();c.rotate(a);c.translate(0,ring===0?-12:ring===1?-4:1);
   petal(c,w+1,l+2,ring===0?'#a52340':ring===1?'#d6393c':'#ff7824',Math.sin(n)*2);
   petal(c,w*.86,l,ring===0?'#e34832':ring===1?'#ff7824':'#ffcb48',Math.sin(n)*2);
   c.save();c.translate(1,-3);petal(c,w*.44,l*.82,ring===0?'#ff8d2f':ring===1?'#ffcf51':'#fff0a0',Math.sin(n));c.restore();
   c.strokeStyle=ring===0?'#a52340':'#e75b28';c.lineWidth=1;c.beginPath();c.moveTo(-1,-4);c.quadraticCurveTo(-w*.22,-l*.43,1,-l*.77);c.stroke();c.restore();
  }
 }
 flame(c,0,10,10,27,'#ff7824',u*.2);flame(c,0,9,6,24,'#ffdf53',u*.2);flame(c,0,8,2.5,19,'#fffbc9',u*.2);
 for(let n=0;n<9;n++){const a=n*2.399,r=58+(u+n%3)*.8;shard(c,Math.cos(a)*r,Math.sin(a)*r,2.5,'#ffcb48',a+u*.03);}c.restore();
}
function fistShape(c,color,inset=0){
 c.fillStyle=color;c.beginPath();c.moveTo(-16+inset,-60);c.lineTo(17-inset,-60);c.lineTo(23-inset,-18);c.bezierCurveTo(34-inset,-11,36-inset,1,30-inset,10);c.lineTo(25-inset,19);c.bezierCurveTo(24-inset,32,12,35,7,29);c.bezierCurveTo(2,38,-8,36,-12,29);c.bezierCurveTo(-22,34,-30+inset,28,-29+inset,18);c.bezierCurveTo(-38+inset,17,-40+inset,5,-33+inset,-4);c.lineTo(-24+inset,-20);c.closePath();c.fill();
}
export function flameFist(c,u,floorDistance=Infinity){
 if(u<0||u>28)return;const fade=1-clamp((u-13)/15),drop=Math.min(u,5)*5;c.save();c.globalAlpha*=fade;c.translate(0,Math.min(17+drop,floorDistance-34));
 // Solid wrist, thumb and four rounded knuckles point vertically down.
 for(let n=0;n<5;n++){const x=-19+n*9;flame(c,x,-28,8,55+(n%2)*16,'#d6393c',u*.17+n);flame(c,x,-27,4,48+(n%2)*12,'#ff7824',u*.17+n);}
 fistShape(c,'#a52340');fistShape(c,'#e34832',2);fistShape(c,'#ff8d2f',5);
 c.fillStyle='#ffcf51';c.beginPath();c.moveTo(-9,-52);c.lineTo(11,-52);c.lineTo(17,-17);c.bezierCurveTo(9,-10,-8,-11,-17,-17);c.closePath();c.fill();
 for(let n=0;n<4;n++){const x=-24+n*13;c.fillStyle='#ffdf53';c.beginPath();c.ellipse(x,17+Math.sin(n)*2,6,9,0,0,Math.PI*2);c.fill();line(c,'#c34331',x-5,8,x-5,23,1);}
 c.fillStyle='#ffb438';c.beginPath();c.moveTo(17,-15);c.bezierCurveTo(30,-15,33,-5,27,4);c.lineTo(12,8);c.bezierCurveTo(5,6,7,-4,17,-15);c.fill();line(c,'#fff0a0',-7,-46,6,-16,2);line(c,'#c34331',-19,0,13,0,2);
 for(let n=0;n<8;n++)shard(c,Math.sin(n*2.4)*(36+u*.6),-45+n*11-u*.8,2,'#ffcb48',Math.PI/2);c.restore();
}
export function iceSword(c,x,y,length=37,width=5,phase=0){
 c.save();c.translate(x,y);c.rotate(Math.sin(phase)*.04);
 // Tip, two bevels, fuller, crossguard and grip distinguish ice swords from pillars.
 c.fillStyle='#276dc4';c.beginPath();c.moveTo(-width,0);c.lineTo(width,0);c.lineTo(width*.7,length-10);c.lineTo(0,length);c.lineTo(-width*.7,length-10);c.closePath();c.fill();
 c.fillStyle='#48beef';c.beginPath();c.moveTo(-width+1,1);c.lineTo(0,1);c.lineTo(0,length-2);c.lineTo(-width*.55,length-11);c.closePath();c.fill();
 c.fillStyle='#99f8ff';c.beginPath();c.moveTo(0,1);c.lineTo(width-1,1);c.lineTo(width*.55,length-11);c.lineTo(0,length-2);c.closePath();c.fill();
 line(c,'#e8ffff',0,2,0,length-3,1);line(c,'#3878c9',-width+1,12,0,16,1);c.fillStyle='#276dc4';c.fillRect(-width-4,-3,width*2+8,4);c.fillStyle='#99f8ff';c.fillRect(-width-3,-3,width*2+6,1);c.fillStyle='#3878c9';c.fillRect(-2,-13,4,10);c.fillStyle='#72e9ff';c.fillRect(-1,-12,1,8);shard(c,0,-15,3,'#99f8ff',Math.PI/2);c.restore();
}
