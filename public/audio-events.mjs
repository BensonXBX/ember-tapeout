import {impactProfile} from './impact.mjs?v=76bc5d8c4221f74f';
// Audio observes combat; it never changes authoritative state or consumes inputs.
import {grounded} from './stage.mjs?v=2ae99339b7bcc18e';
export const AUDIO_EVENT_BYTES=2*8*4;
export function makeAudioEvents(emit){
 const prev=new Float32Array(16);let ready=false,frame=-1,high=-1,phase=0,epoch=-1,sequence=0;
 function seed(s){for(let i=0;i<2;i++){const p=16+i*28,z=i*8;prev[z]=s[p+7];prev[z+1]=s[p+8];prev[z+2]=s[p+3];prev[z+3]=s[p+5];prev[z+4]=Number(grounded(s,p));prev[z+5]=s[p+10];prev[z+6]=s[p+26];prev[z+7]=s[p+11];}frame=s[0];phase=s[1];ready=true;}
 return {bytes:prev.byteLength,reset(s){high=s[0];epoch=-1;sequence=0;seed(s);},observe(s,damage=null){
  if(!ready){high=s[0];seed(s);return;}
  const fresh=s[0]>high;
  if(s[0]<frame){seed(s);return;} // Server correction: never replay predicted sounds.
  if(fresh)for(let i=0;i<2;i++){
   const p=16+i*28,z=i*8,a=s[p+7]|0,type=s[p+11]|0;
   if(a&&(a!==prev[z]||s[p+8]<prev[z+1]))emit('attack',i,type,a);
   if(!damage){const loss=prev[z+2]-s[p+3];
    if(loss>.001)emit(s[p+5]<prev[z+3]?'guard':'hit',i,s[16+(1-i)*28+11]|0,loss,impactProfile(s[10]));
    else if(s[p+26]>prev[z+6]&&s[p+26]>=29)emit('parry',i,type,0);
   }
   const onGround=grounded(s,p);
   if(prev[z+4]&&!onGround&&s[p+2]<0&&!s[p+10]&&a!==10)emit('jump',i,type,0);
   if(!prev[z+4]&&onGround)emit('land',i,type,0);
  }
  if(damage){
   if(epoch!==damage.epoch){epoch=damage.epoch;sequence=0;}
   for(let n=0;n<damage.count;n++){const serial=damage.sequence-damage.count+n+1;
    if(serial<=sequence)continue;const z=((damage.cursor-damage.count+n+8)%8)*6;
    const tag=damage.records[z+5]|0;emit(tag&1?'guard':'hit',1,tag>>4,damage.records[z+1],(tag>>1)&7);
   }sequence=damage.sequence;
  }
  if(fresh&&phase!==s[1]&&(s[1]===3||s[1]===4)&&s[7]>=0)emit('win',s[7]|0,s[16+(s[7]|0)*28+11]|0,s[1]);
  high=Math.max(high,s[0]);seed(s);
 }};
}
