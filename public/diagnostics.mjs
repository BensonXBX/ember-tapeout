// Bounded samples; transport RTT includes client callback and server processing.
export function makeDiagnostics(){
 const buffers={rtt:new Float32Array(120),frame:new Float32Array(120),arrival:new Float32Array(120),draw:new Float32Array(120),render:new Float32Array(120),simulation:new Float32Array(120),reconcile:new Float32Array(120)},counts={rtt:0,frame:0,arrival:0,draw:0,render:0,simulation:0,reconcile:0};let reconnects=0;
 return {add(kind,value){if(buffers[kind]&&Number.isFinite(value)&&value>=0)buffers[kind][counts[kind]++%120]=value;},reconnect(){reconnects++;},snapshot(){const result={reconnects};for(const [kind,b] of Object.entries(buffers)){const values=Array.from(b.subarray(0,Math.min(120,counts[kind]))).sort((a,b)=>a-b);result[kind]={count:values.length,p50:values[Math.floor((values.length-1)*.5)]||0,p95:values[Math.floor((values.length-1)*.95)]||0};}return result;}};
}
