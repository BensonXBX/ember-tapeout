// Compact authoritative contact tag in header 10: owner + profile*4 + guard*32.
// No extra state, particles, textures or PCM buffers are allocated.
export const IMPACT={LIGHT:0,HEAVY:1,DRAGON:2,FINISH:3,SPECIAL:4};
export const impactOwner=tag=>(tag&3)-1;
export const impactProfile=tag=>(tag>>2)&7;
export const impactGuard=tag=>!!(tag&32);
export const impactStop=(profile,guard=false)=>guard?2:profile===0?3:profile===1?5:profile===2?7:profile===3?10:4;
export const impactShake=(profile,guard=false)=>guard?0:profile===0?.25:profile===1?1.2:profile===2?1.8:profile===3?3: .7;
export function moveImpact(act,age,type){
 if(act===12||act===19)return age===(act===19?type?30:14:type?41:20)?IMPACT.FINISH:IMPACT.SPECIAL;
 if(act===20||act===9)return IMPACT.DRAGON;
 if(act===2||act===6||act===8||act===14||act===16)return IMPACT.HEAVY;
 if(act===3||act===17||act===11||act===18)return IMPACT.SPECIAL;
 return IMPACT.LIGHT;
}
// LAB's existing sixth scalar retains guard in bit 0, then profile and source type.
export const trainingImpact=(tag,type)=>(impactGuard(tag)?1:0)+impactProfile(tag)*2+type*16;
