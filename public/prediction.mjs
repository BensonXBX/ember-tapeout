import {SIZE,step,pbase,ACTION_MASK} from './engine.mjs?v=ee9e0d5b4ef43ac9';
export const PREDICTION_BYTES=120*4+120*2+SIZE*4*2+4*4;
export function makePrediction(){
 const frames=new Int32Array(120),inputs=new Uint16Array(120),view=new Float32Array(SIZE),offset=new Float32Array(4),pending=new Float32Array(SIZE);
 let queued=false,pendingTime=0,pendingLatency=0,pendingSlot=0,pendingMask=0,pendingOther=0,pendingActions=0;
 let serverFrame=0,received=-Infinity,rtt=100,visualTime=0,initialized=false,ackEdges=0;
 function reset(){queued=false;frames.fill(-1);offset.fill(0);serverFrame=0;received=-Infinity;rtt=100;visualTime=0;initialized=false;ackEdges=0;}
 function validate(snapshot){if(snapshot.length!==SIZE||!snapshot.every(Number.isFinite))throw Error('游戏版本不一致，请刷新页面后重新加入。');}
 reset();
 const horizon=()=>Math.max(18,Math.min(45,Math.ceil(rtt*.09)+8));
 return {bytes:PREDICTION_BYTES,reset,
  // Keep only the newest authoritative state until the next animation frame.
  // This bounds replay work when several callbacks arrive before one paint.
  queue(snapshot,now,latency,slot,mask,otherMask,pendingEdges=0){
   validate(snapshot);if(initialized&&snapshot[0]<serverFrame||queued&&snapshot[0]<pending[0])return false;
   pending.set(snapshot);pendingTime=now;pendingLatency=latency;pendingSlot=slot;pendingMask=mask;pendingOther=otherMask;pendingActions=pendingEdges;queued=true;return true;
  },
  flush(s){if(!queued)return false;queued=false;return this.receive(s,pending,pendingTime,pendingLatency,pendingSlot,pendingMask,pendingOther,pendingActions);},
  canStep(s,now){return initialized&&now-received<750&&s[0]<serverFrame+horizon();},
  tick(s,mask,slot,otherMask){mask|=ackEdges;ackEdges=0;const frame=s[0]+1,index=frame%120;frames[index]=frame;inputs[index]=mask;step(s,slot?otherMask:mask,slot?mask:otherMask);},
  receive(s,snapshot,now,latency,slot,mask,otherMask,pendingEdges=0){
   validate(snapshot);
   if(initialized&&snapshot[0]<serverFrame)return false;
   const oldFrame=s[0],continuous=initialized&&s[3]===snapshot[3]&&s[1]===2&&snapshot[1]===2&&now-received<750;
   const x0=s[16]+offset[0],y0=s[17]+offset[1],x1=s[44]+offset[2],y1=s[45]+offset[3];
   rtt=Math.max(0,Math.min(2000,latency));serverFrame=snapshot[0];received=now;initialized=true;
   s.set(snapshot);ackEdges=pendingEdges&ACTION_MASK;
   // Catch an older packet up to the local presentation frame before displaying it.
   // Re-simulation uses only recorded inputs and the shared authoritative rules.
   if(continuous){const lead=Math.min(12,Math.ceil(rtt*.03)),target=Math.min(serverFrame+horizon(),Math.max(oldFrame,serverFrame+lead));
    for(let frame=serverFrame+1;frame<=target;frame++){const index=frame%120,local=(frames[index]===frame?inputs[index]:mask)|ackEdges;ackEdges=0;step(s,slot?otherMask:local,slot?local:otherMask);}
    offset[0]=x0-s[16];offset[1]=y0-s[17];offset[2]=x1-s[44];offset[3]=y1-s[45];
    // Teleports, round changes and large corrections must not slide across the arena.
    for(let i=0;i<2;i++)if(Math.hypot(offset[i*2],offset[i*2+1])>48)offset[i*2]=offset[i*2+1]=0;
   }else{frames.fill(-1);offset.fill(0);}
   return true;
  },
  drawState(s,now){const dt=visualTime?Math.max(0,Math.min(100,now-visualTime)):16.667;visualTime=now;const decay=Math.exp(-dt/45);view.set(s);for(let i=0;i<2;i++){const p=pbase(i);offset[i*2]*=decay;offset[i*2+1]*=decay;view[p]+=offset[i*2];view[p+1]+=offset[i*2+1];}return view;}
 };
}
