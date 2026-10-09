export function playerIdentity(slot,localSlot=0,mode='pvp'){
 const own=slot===localSlot;return {own,color:own?'#65f6c3':'#ffb0c2',label:own?'你':mode==='pve'?'电脑':mode==='lab'?'假人':'对手',number:slot+1};
}
export function drawPlayerIdentity(c,x,y,identity){
 c.save();c.globalAlpha*=.38;c.fillStyle=identity.color;
 c.beginPath();c.moveTo(x-3,y-3);c.lineTo(x+3,y-3);c.lineTo(x,y+1);c.closePath();c.fill();c.restore();
}
