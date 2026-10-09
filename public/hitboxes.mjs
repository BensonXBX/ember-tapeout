// Shared, world-space geometry. Rendering and server damage use these same boxes.
// [near, far, top, bottom, startup, last active frame], relative to the feet.
const moves = [
 [0,0,0,0,0,0], [7,25,-29,-13,5,9], [7,39,-32,-13,11,15],
 [7,55,-48,6,10,24], [0,0,0,0,0,0], [7,37,-38,22,4,8],
 [7,37,-38,22,8,12], [7,25,-16,0,4,8], [7,45,-15,-1,10,14],
 [7,31,-80,-34,6,10], [0,0,0,0,0,0], [7,53,-29,-13,7,11],
 [7,151,-78,36,20,36], [7,32,-29,-13,5,9], [7,41,-35,-13,7,11],
 [7,49,-38,22,5,9], [7,55,-54,22,7,11], [7,65,-55,38,7,14],
 [7,57,-38,22,5,9], [7,141,-115,73,14,30], [7,35,-74,-14,11,15]
];
const iceFar = [0,37,59,0,0,43,43,29,45,31,0,0,181,44,54,49,55,81,0,171,41];
const MOVE_COUNT=moves.length;
const data = new Float32Array(2*MOVE_COUNT*6);
for(let type=0;type<2;type++)for(let a=0;a<MOVE_COUNT;a++){
 const offset=(type*MOVE_COUNT+a)*6;data.set(moves[a],offset);
 if(type&&iceFar[a])data[offset+1]=iceFar[a];
 if(type&&[1,13,14,5,15,16,7].includes(a))data[offset+1]*=1.1;
 if(type&&a===1){data[offset+4]=6;data[offset+5]=10;}
 if(type&&a===12){data[offset+2]=-105;data[offset+3]=63;data[offset+4]=21;data[offset+5]=41;}
 if(!type&&a===19){data[offset]=-35;data[offset+1]=35;data[offset+2]=-34;data[offset+3]=120;data[offset+5]=14;}
}
export const HITBOX_DATA_BYTES=data.byteLength, HITBOX_SCRATCH_BYTES=32;
const attack=new Float32Array(4),hurt=new Float32Array(4);
export function overlaps(a,b){return a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];}
export function hurtBox(s,p,out){
 const down=s[p+10]>0&&s[p+15]===-2,low=s[p+13]||s[p+7]===7||s[p+7]===8;
 const height=down?(s[p+10]>8?16:32):low?16:42,half=down&&s[p+10]>8?18:low?10:9;
 out[0]=s[p]-half;out[1]=s[p+1]-height;out[2]=s[p]+half;out[3]=s[p+1];return out;
}
export function attackBox(s,p,out,includeConsumed=false){
 const a=s[p+7]|0,age=s[p+8],type=s[p+11]|0,offset=(type*MOVE_COUNT+a)*6;
 if(a<=0||a>=MOVE_COUNT||a===4||a===10||type&&(a===3||a===11||a===18))return false;
 if(a===3){if(age!==10&&age!==17&&age!==24)return false;}
 else if(a===12){if(type?age!==21&&age!==31&&age!==41:age!==20)return false;}
 else if(a===17){if(age!==7&&age!==14)return false;}
 else if(a===19){if(type?age!==14&&age!==22&&age!==30:age!==14)return false;}
 else if(s[p+15]&&!includeConsumed||age<data[offset+4]||age>data[offset+5])return false;
 // Jin's lotus uses its full forward lane; aerial fist is centered below the caster.
 const near=data[offset],far=a===3&&age===24?83:data[offset+1],face=s[p+6];
 out[0]=s[p]+(face>0?near:-far);out[2]=s[p]+(face>0?far:-near);
 out[1]=s[p+1]+data[offset+2];out[3]=s[p+1]+data[offset+3];return true;
}
export function meleeContact(s,p,q){return attackBox(s,p,attack)&&overlaps(attack,hurtBox(s,q,hurt));}
// Uses the same bounded scratch boxes as contact; training only reads the result.
export function contactFailure(s,p,q){if(!attackBox(s,p,attack))return 0;hurtBox(s,q,hurt);if(overlaps(attack,hurt))return 0;if((s[q]-s[p])*s[p+6]<0)return 4;return attack[0]>=hurt[2]||attack[2]<=hurt[0]?1:2;}
export function projectileBox(s,z,out,previousX=s[z],previousY=s[z+1]){
 const kind=s[z+4],scale=kind===1||kind===6||kind===8?1.3:1,rx=(kind===3?9:6)*scale,ry=(kind===3||kind===4||kind===9?4:2)*scale;
 out[0]=Math.min(previousX,s[z])-rx;out[1]=Math.min(previousY,s[z+1])-ry;
 out[2]=Math.max(previousX,s[z])+rx;out[3]=Math.max(previousY,s[z+1])+ry;return out;
}
export const projectileSpeed=kind=>kind===9?3.5:kind===4?4.2:kind===1||kind===6||kind===8?4.1:kind===0||kind>=5?3.7:3.6;
export const projectileRise=kind=>kind===5||kind===6?-1.5:kind===9?1.25:0;
export function projectileContact(s,z,q,previousX,previousY){return overlaps(projectileBox(s,z,attack,previousX,previousY),hurtBox(s,q,hurt));}
