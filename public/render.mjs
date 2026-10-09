import {costumeFor} from './costumes.mjs?v=cbe686a7709b3bbf';
// V36 supers and coatings use the shared vector/pixel shapes, with no material bitmap.
const MATERIAL_BYTES=0;
import {playerIdentity,drawPlayerIdentity} from './identity.mjs?v=ce959759e55c81be';
import {impactProfile,impactGuard,impactStop,impactShake,impactOwner} from './impact.mjs?v=76bc5d8c4221f74f';
import {pbase,elementImbued,PROJECTILE_COUNT,projectileBase} from './engine.mjs?v=ee9e0d5b4ef43ac9';
import {WORLD_WIDTH,FLOOR,platforms,MAP_BYTES,grounded} from './stage.mjs?v=2ae99339b7bcc18e';
import {fighter,SPRITE_BYTES,FIGHTER_SCRATCH_BYTES,artReady,rect as r} from './fighters.mjs?v=3227a19df8e902e1';
import {makeEffects} from './effects.mjs?v=b2de10dd801b106f';
import {attackBox,hurtBox,projectileBox,projectileSpeed,projectileRise} from './hitboxes.mjs?v=b3b85833e6633317';
export {fighter,artReady} from './fighters.mjs?v=3227a19df8e902e1';
export const STAGE_WIDTH=640,STAGE_HEIGHT=360,STAGE_BYTES=STAGE_WIDTH*STAGE_HEIGHT*4,CAMERA_BYTES=3*4,DEBUG_BYTES=16;
let stage=null;
export const stageReady=typeof Image==='undefined'?Promise.resolve():new Promise((ok,fail)=>{const image=new Image();image.onload=()=>{if(image.naturalWidth!==STAGE_WIDTH||image.naturalHeight!==STAGE_HEIGHT)return fail(Error('场景资源尺寸错误'));stage=image;ok();};image.onerror=()=>fail(Error('场景资源加载失败，请刷新重试'));image.src='/games/ember/assets/courtyard-v13.png';});
// Camera has no effect on world simulation. Its three floats are reused each frame.
export function fitCamera(s,out){const left=Math.min(s[16],s[44]),right=Math.max(s[16],s[44]),top=Math.min(22,s[17]-64,s[45]-64);out[2]=Math.min(1,320/(right-left+124),180/(170-top));const half=160/out[2];out[0]=half>=WORLD_WIDTH/2?WORLD_WIDTH/2:Math.max(half-32,Math.min(WORLD_WIDTH-half+32,(left+right)/2));out[1]=top<0?(170+top)/2:90;return out;}
// Static floor geometry is recorded once; each frame submits five color paths.
// No additional bitmap, texture upload, or change to collision geometry.
export function makeTerrainTiles(Path=globalThis.Path2D){
 if(typeof Path!=='function')return null;
 const colors=['#6c777e','#899095','#4b5a6a','#5b6878','#273747'],paths=colors.map(()=>new Path());
 for(let row=0;row<10;row++)for(let x=-64;x<WORLD_WIDTH+64;x+=32){const px=x+(row%2?16:0),y=FLOOR+4+row*18;paths[row<2?0:2].rect(px+1,y,30,16);paths[row<2?1:3].rect(px+2,y,29,1);paths[4].rect(px+31,y,1,17);}
 return {draw(c){for(let i=0;i<5;i++){c.fillStyle=colors[i];c.fill(paths[i]);}}};
}
function terrain(c,s,t,left=-64,right=WORLD_WIDTH+64,bottom=400,tiles=null){
 const groundLeft=Math.min(-64,left),groundRight=Math.max(WORLD_WIDTH+64,right);r(c,'#394451',groundLeft,FLOOR,groundRight-groundLeft,Math.max(220,bottom-FLOOR+8));r(c,'#8e9898',groundLeft,FLOOR,groundRight-groundLeft,3);r(c,'#d4d7bd',groundLeft,FLOOR,groundRight-groundLeft,1);
 if(tiles)tiles.draw(c);else for(let row=0;row<10&&FLOOR+4+row*18<bottom;row++)for(let x=Math.max(-64,Math.floor((left-32)/32)*32);x<Math.min(WORLD_WIDTH+64,right+32);x+=32){const px=x+(row%2?16:0),y=FLOOR+4+row*18;r(c,row<2?'#6c777e':'#4b5a6a',px+1,y,30,16);r(c,row<2?'#899095':'#5b6878',px+2,y,29,1);r(c,'#273747',px+31,y,1,17);}
 if(s[15])for(let n=0;n<platforms.length;n+=3){const x=platforms[n],end=platforms[n+1],y=platforms[n+2],w=end-x;
  for(let k=0;k<2;k++){const px=x+12+k*(w-24);r(c,'#283a50',px-4,y+7,9,FLOOR-y-7);r(c,'#657286',px-3,y+8,3,FLOOR-y-8);r(c,'#a7abb1',px-5,FLOOR-4,12,4);}
  r(c,'#182e43',x-4,y+1,w+8,7);r(c,'#3d5c70',x-2,y+1,w+4,3);r(c,'#78989c',x,y,w,2);r(c,'#c1e2cf',x+1,y,w-2,1);
  for(let px=x;px<end;px+=8){r(c,'#526c7f',px,y+5,6,3);r(c,'#9bad9f',px,y+2,1,3);}
  const rune=n===3?'#6bdded':'#f2d886';for(let k=0;k<3;k++)r(c,rune,x+w/2-7+k*6,y+3,2,2);
 }
 for(const x of [24,206,432,618]){r(c,'#26374e',x-4,120,9,24);r(c,'#617782',x-5,118,11,3);r(c,'#253d53',x-8,108,17,4);r(c,'#95c2b7',x-6,108,13,1);r(c,'#f4dd7b',x-2,113,5,4);}
 // Ambient petals and banners are drawings, with no particle allocation.
 for(let n=0;n<12;n++){const x=(n*67+t*.008)%WORLD_WIDTH,y=30+(n*29+t*.004)%102;r(c,'#ffe5cd',x,y,2,1);}
 r(c,'#22394b',8,44,3,80);r(c,'#922d3e',11,47,17,29);r(c,'#edac79',13,49,1,21);r(c,'#efcf97',16,60,8,2);
 r(c,'#22394b',629,44,3,80);r(c,'#285887',612,47,17,29);r(c,'#a5e4e7',626,49,1,21);r(c,'#a5e4e7',617,60,8,2);
}
export function makeRenderer(canvas,{ResizeObserver:Observer=globalThis.ResizeObserver,showcase=false}={}){const c=canvas.getContext('2d',{alpha:false}),effects=makeEffects(),camera=new Float32Array(3),box=new Float32Array(4),tiles=makeTerrainTiles();c.imageSmoothingEnabled=false;
 // Resize notifications avoid forced layout reads between HUD writes and drawing.
 let aspect=(canvas.clientWidth||canvas.width)/(canvas.clientHeight||canvas.height);
 const observer=Observer?new Observer(entries=>{for(const entry of entries){const {width,height}=entry.contentRect;if(entry.target===canvas&&width>0&&height>0)aspect=width/height;}}):null;
 observer?.observe(canvas);
 function drawBox(color){c.strokeStyle=color;c.fillStyle=color+'22';c.fillRect(box[0],box[1],box[2]-box[0],box[3]-box[1]);c.strokeRect(box[0],box[1],box[2]-box[0],box[3]-box[1]);}
 return {projectX(x){return .5+(x-camera[0])*camera[2]/Math.max(320,180*aspect);},dispose(){observer?.disconnect();},buffers:canvas.width*canvas.height*4*2+STAGE_BYTES+SPRITE_BYTES+FIGHTER_SCRATCH_BYTES+MAP_BYTES+CAMERA_BYTES+DEBUG_BYTES+effects.bytes+MATERIAL_BYTES,draw(s,t,debug=false,training=null,localSlot=0,mode='pvp'){effects.sync(s,training);fitCamera(s,camera);if(!observer)aspect=(canvas.clientWidth||canvas.width)/(canvas.clientHeight||canvas.height);const vw=Math.max(320,180*aspect),vh=Math.max(180,320/aspect),ox=(vw-320)/2,oy=(vh-180)/2;/* Portrait spends extra height above the fighters, not on an empty floor. */if(showcase){const top=Math.min(s[17],s[45])-68,bottom=Math.max(s[17],s[45])+12;camera[0]=(s[16]+s[44])/2;camera[1]=(top+bottom)/2;camera[2]=Math.min(1.9,vw/(Math.abs(s[16]-s[44])+116),vh/(bottom-top+30));}else if(aspect<1.2)camera[1]-=(vh-180)*.28/camera[2];c.save();c.scale(canvas.width/vw,canvas.height/vh);r(c,'#88aec9',0,0,vw,vh);
  if(stage){const drift=(camera[0]-WORLD_WIDTH/2)*.085;c.drawImage(stage,0,0,640,288,-90-drift,-3,Math.max(500,vw+180),Math.max(144,vh*.8));}
  c.save();if(s[8]>0){const profile=impactProfile(s[10]),guard=impactGuard(s[10]),strong=impactShake(profile,guard)*(.35+.65*s[8]/impactStop(profile,guard));if(profile===3&&!guard){const phase=10-s[8],ice=s[pbase(impactOwner(s[10]))+11];c.translate(Math.sin((phase+1)*1.12)*strong*(ice?1:.5),Math.sin((phase+1)*.76)*strong*(ice?.25:1));}else c.translate(((s[0]%3)-1)*strong*(profile===2?.45:1),(((s[0]*2)%3)-1)*strong);}
  c.translate(vw/2,vh/2);c.scale(camera[2],camera[2]);c.translate(-camera[0],-camera[1]);terrain(c,s,t,camera[0]-(vw/2+8)/camera[2],camera[0]+(vw/2+8)/camera[2],camera[1]+(vh/2+8)/camera[2],tiles);effects.under(c,s);
  const visualFrame=s[1]===0?t/16.667:s[0];for(let i=0;i<2;i++){const p=pbase(i),air=!grounded(s,p);c.fillStyle='#182e4666';c.beginPath();c.ellipse(s[p],s[p+1]+1,13,2,0,0,Math.PI*2);c.fill();fighter(c,s[p],s[p+1],s[p+11],s[p+6],s[p+7],s[p+8],visualFrame,s[p+13],s[p+16],s[p+18]&128,Math.abs(s[p+19])>.2,air,s[p+19],null,1,s[p+2],s[p+10],s[p+27]===4?1:s[p+27]===5?-1:0,s[p+15],s[p+9],elementImbued(s,p),costumeFor(s,i));
   if(s[p+5]<99&&s[1]===2){r(c,'#183259',s[p]-10,s[p+1]+4,20,2);r(c,'#bbf5cc',s[p]-10,s[p+1]+4,Math.round(s[p+5]/5),1);}
  }effects.over(c,s,t);if(debug){c.lineWidth=.7;for(let i=0;i<2;i++){const p=pbase(i);hurtBox(s,p,box);drawBox(s[p+7]===10?'#b0b5ca':'#66e7bc');if(attackBox(s,p,box,s[8]>0))drawBox('#ff657c');}for(let n=0;n<PROJECTILE_COUNT;n++){const z=projectileBase(n);if(s[z+3]>0){projectileBox(s,z,box,s[z]-s[z+2]*projectileSpeed(s[z+4]),s[z+1]-projectileRise(s[z+4]));drawBox('#ffd166');}}}c.restore();c.save();c.translate(ox,oy);if(!showcase)for(let i=0;i<2;i++){const p=pbase(i),sx=160+(s[p]-camera[0])*camera[2],sy=90+(s[p+1]-60-camera[1])*camera[2];drawPlayerIdentity(c,Math.max(21,Math.min(299,sx)),Math.max(45,Math.min(150,sy)),playerIdentity(i,localSlot,mode));}effects.screen(c,s,t);
  for(let i=0;i<2;i++){const p=pbase(i);if(s[p+14]>1&&!training){const x=i?252:8;c.font='bold 14px monospace';c.fillStyle='#172646';c.fillText(s[p+14]+' HIT',x+1,65);c.fillStyle='#fff695';c.fillText(s[p+14]+' HIT',x,64);c.font='6px monospace';c.fillStyle='#ffffff';c.fillText('COMBO!',x,73);}}
  if(!showcase){r(c,'#142841bb',113,171,94,6);r(c,'#778e9a',116,175,88,1);for(let n=0;n<platforms.length;n+=3)r(c,'#92c2ca',116+platforms[n]/WORLD_WIDTH*88,173,(platforms[n+1]-platforms[n])/WORLD_WIDTH*88,1);r(c,'#ffbe6b',115+s[16]/WORLD_WIDTH*88,172,2,3);r(c,'#9ef5ff',115+s[44]/WORLD_WIDTH*88,172,2,3);}c.restore();c.restore();}
 };
}
