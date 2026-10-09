// Mirror matches assign the alternate outfit to 2P on both clients.
export const costumeFor=(s,slot)=>slot===1&&s[27]===s[55]?1:0;
export const COSTUME_CACHE_SIZE=8,COSTUME_BYTES=(COSTUME_CACHE_SIZE*2+2)*64*64*4+COSTUME_CACHE_SIZE*2;
// Clothing-only palette swaps: Jin's ivory trousers become jade; Shuang's
// midnight-blue uniform becomes wine red. Preserve skin, hair and ice steel.
export function recolorClothes(data,type){
 for(let i=0;i<data.length;i+=4){if(data[i+3]<16)continue;const r=data[i],g=data[i+1],b=data[i+2];
  if(!type&&r>90&&g>85&&b>65&&r-g<33&&g-b<36&&b>=r*.65){const l=(r+g+b)/3;data[i]=Math.round(l*.29);data[i+1]=Math.round(l*.75);data[i+2]=Math.round(l*.68);}
  else if(type&&g-r>7&&b-g>20&&g<155){const l=Math.max(r,g,b);data[i]=Math.min(255,Math.round(l*1.08));data[i+1]=Math.round(l*.4);data[i+2]=Math.round(l*.57);}
 }
 return data;
}
const keys=new Uint16Array(COSTUME_CACHE_SIZE);keys.fill(65535);
const frames=[];let cursor=0,scratch=null;
function surface(){if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(64,64);if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=c.height=64;return c;}return null;}
export function outfitFrame(atlas,index,type){
 const key=index*2+type,found=keys.indexOf(key);if(found>=0)return frames[found];
 scratch??=surface();if(!scratch)return null;
 const slot=cursor++%COSTUME_CACHE_SIZE,c=scratch.getContext('2d',{willReadFrequently:true});c.clearRect(0,0,64,64);c.drawImage(atlas,index%8*64,Math.floor(index/8)*64,64,64,0,0,64,64);
 const pixels=c.getImageData(0,0,64,64);recolorClothes(pixels.data,type);frames[slot]??=surface();frames[slot].getContext('2d').putImageData(pixels,0,0);keys[slot]=key;return frames[slot];
}
