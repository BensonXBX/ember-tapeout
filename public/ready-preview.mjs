// Preparation previews the controls, never a second fighter simulation.
// Carry held movement into FIGHT, but never queue attacks pressed before FIGHT.
import {ACTION_MASK} from './engine.mjs?v=ee9e0d5b4ef43ac9';
export function makeReadyInputGuard(){
 let phase=null,round=null,blocked=0;
 return {
  sync(state,waiting=false,held=0){
   const next=waiting?0:state[1],changed=next!==phase||round!==state[3];
   const resume=phase===1&&next===2&&round===state[3],prepare=phase===2&&next===1&&round===state[3];
   phase=next;round=state[3];if(resume)blocked=held&(ACTION_MASK&~(4096|8|128));else if(changed)blocked=0;
   return resume?'resume':prepare?'prepare':changed?'reset':null;
  },
  observe(held){blocked&=held;},
  filter(state,mask,waiting=false){return !waiting&&state[1]===2?mask&~blocked:0;},
  reset(){phase=null;round=null;blocked=0;}
 };
}
