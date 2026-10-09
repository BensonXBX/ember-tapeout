import {aiInput,B,A,pbase,moveStartup,PROJECTILE_COUNT,projectileBase,projectileOwner} from './engine.mjs?v=ee9e0d5b4ef43ac9';
import {grounded,FLOOR,support} from './stage.mjs?v=2ae99339b7bcc18e';
export const BASE_STAGES=6,STAGE_COUNT=12;
const cap=n=>Math.max(0,Math.min(STAGE_COUNT,Number.isFinite(Number(n))?Math.floor(Number(n)):0));
// The legacy completion flag means six foundational wins, never twelve wins.
export function readCampaign(storage){
 let cleared=0;try{cleared=cap(storage?.getItem('ember-campaign-cleared'));cleared=Math.max(cleared,Math.min(BASE_STAGES-1,cap(storage?.getItem('ember-unlocked'))-1));if(storage?.getItem('ember-complete')==='1')cleared=Math.max(cleared,BASE_STAGES);}catch{}
 return Math.max(0,cleared);
}
export const unlockedStage=cleared=>Math.min(STAGE_COUNT,cap(cleared)+1);
export function winStage(cleared,stage){return Number.isInteger(stage)&&stage>=1&&stage<=unlockedStage(cleared)?Math.max(cap(cleared),stage):cap(cleared);}
export function saveCampaign(storage,cleared){try{storage?.setItem('ember-campaign-cleared',String(cap(cleared)));storage?.setItem('ember-unlocked',String(Math.min(BASE_STAGES,unlockedStage(cleared))));if(cleared>=BASE_STAGES)storage?.setItem('ember-complete','1');return true;}catch{return false;}}
// Only advance the AI's input strategy. The shared engine controls every hit,
// health value, cost, recovery and cancel exactly as it does for the player.
export const ADVANCED=Object.freeze([
 {reaction:10,guard:.32,chain:.32,spacing:38,air:.12,burst:.05},
 {reaction:9,guard:.38,chain:.42,spacing:66,air:.18,burst:.08},
 {reaction:8,guard:.44,chain:.52,spacing:44,air:.28,burst:.10},
 {reaction:7,guard:.50,chain:.62,spacing:42,air:.36,burst:.13},
 {reaction:6,guard:.56,chain:.74,spacing:36,air:.44,burst:.17},
 {reaction:5,guard:.62,chain:.86,spacing:32,air:.52,burst:.21}
].map(Object.freeze));
function random(s){let v=(s[9]|0)||1;v^=v<<13;v^=v>>>17;v^=v<<5;s[9]=v&0x7fffff;return s[9]/8388608;}
export function legacyCampaignInput(s,stage){
 if(stage<=BASE_STAGES)return aiInput(s,stage);
 if(s[1]!==2)return 0;
 const profile=ADVANCED[Math.max(0,Math.min(5,(stage|0)-7))],tier=Math.max(0,Math.min(5,(stage|0)-7)),p=pbase(1),q=pbase(0),frame=s[0];
 if(s[p+10]>0)return 0;
 if(frame<s[13])return s[11];
 if(frame<s[12])return s[11]&3;
 const r=random(s),d=s[q]-s[p],distance=Math.abs(d),toward=d>0?B.RIGHT:B.LEFT,away=d>0?B.LEFT:B.RIGHT,vertical=s[q+1]-s[p+1],air=!grounded(s,p),energy=s[p+4],act=s[p+7];
 s[12]=frame+profile.reaction+Math.floor(random(s)*4);s[11]=distance>profile.spacing?toward:0;
 const send=buttons=>{s[11]=buttons&3;return buttons;};
 // Hit-confirmed routes use only the AI's own confirmed contacts and resources.
 // No human input, queued commands or hidden opponent plans are inspected.
 if(s[p+24]>0&&s[p+8]>=4&&r<profile.chain){
  let next=0;
  if(act===A.JAB||act===A.JAB_TWO)next=tier>=3&&energy>=30?B.HEAVY:B.LIGHT;
  else if(act===A.JAB_FINISH||act===A.HEAVY)next=energy>=30?B.SKILL:0;
  else if(act===A.DRAGON||act===A.ANTIAIR)next=tier>=2?B.JUMP:0;
  else if(act===A.AIR_LIGHT)next=B.LIGHT;
  else if(act===A.AIR_TWO)next=tier>=4&&energy>=30?B.SKILL:B.HEAVY;
  else if([A.SKILL,A.SMALL,A.AIR_SKILL,A.AIR_SMALL].includes(act)&&energy>=70&&tier>=3)next=B.SUPER;
  if(next)return send(toward|next);
 }
 const enemyAct=s[q+7],age=s[q+8],visible=enemyAct>0&&enemyAct!==A.DASH&&age>=profile.reaction;
 let projectile=false;for(let n=0;n<PROJECTILE_COUNT;n++){if(projectileOwner(n)!==0)continue;const z=projectileBase(n);if(s[z+3]>0&&Math.abs(s[z]-s[p])<85&&(s[p]-s[z])*s[z+2]>0&&Math.abs(s[z+1]-(s[p+1]-20))<30)projectile=true;}
 if(!act&&!air&&frame>=s[14]&&((visible&&distance<105)||projectile)&&r<profile.guard){
  const low=(enemyAct===A.LOW_LIGHT||enemyAct===A.SWEEP)?random(s)<.72:random(s)<.1;
  s[11]=toward|B.BLOCK|(low?B.DOWN:0);s[13]=frame+10+Math.floor(random(s)*6);s[14]=s[13]+24;return s[11];
 }
 if(act)return send(s[11]);
 let mask=distance>profile.spacing?toward:distance<profile.spacing-14&&r<.28?away:0;
 if(vertical>24&&support(s,p)<FLOOR&&!air)return send(toward|B.DOWN|B.JUMP);
 if(vertical<-25&&!air){if(distance<52&&energy>=20&&r<profile.air)return send(toward|B.UP|B.LIGHT);mask|=B.JUMP;}
 if(air&&distance<82&&Math.abs(vertical)<70)return send(toward|(r<.66?B.LIGHT:energy>=30?B.SKILL:B.HEAVY));
 const punish=visible&&age>moveStartup(enemyAct,s[q+11])+5;
 if(distance<100&&energy>=70&&((punish&&r<profile.burst+.15)||r<profile.burst*.45))return send(toward|B.SUPER);
 if(distance<48&&Math.abs(vertical)<34){
  if(tier>=2&&energy>=20&&r<profile.air*.55)return send(toward|B.UP|B.LIGHT);
  if(energy>=15&&r>.82)return send(toward|B.SMALL);
  return send(toward|(r<.72?B.LIGHT:B.HEAVY)|(r>.6&&r<.78?B.DOWN:0));
 }
 if(punish&&distance<110&&energy>=30&&r<.50)return send(toward|B.SKILL);
 if(distance>60&&distance<155&&energy>=8&&r>.82-tier*.02)return send(toward|B.DASH);
 if(distance>85&&energy>=12&&r<(tier===1?.62:.25+tier*.025))return send(toward|(energy>=30&&r<.12?B.SKILL:B.RANGED));
 return send(mask);
}

// Read-only view of the existing rule AI, not a NAND netlist or another AI run.
export function campaignPanelSide(playerX,previous='right'){
 if(playerX<.44)return 'right';
 if(playerX>.56)return 'left';
 return previous;
}
export function campaignStatus(s){
 const p=pbase(1),q=pbase(0),act=s[p+7]|0;
 let action='idle';
 if(s[p+10]>0)action='hurt';
 else if(act)action=({1:'light',13:'light2',14:'light3',5:'airLight',15:'airLight',16:'airLight',2:'heavy',6:'heavy',7:'low',8:'low',3:'skill',17:'skill',4:'ranged',9:'launch',20:'launch',10:'dash',11:'small',18:'small',12:'super',19:'super'})[act]||'idle';
 else if((s[p+18]&B.BLOCK)&&s[p+5]>0&&grounded(s,p))action='guard';
 else if(!grounded(s,p))action='jump';
 else if(Math.abs(s[p+19])>.1)action='move';
 if(s[1]!==2)action=s[1]===1?'ready':'rest';
 return {distance:Math.round(Math.abs(s[p]-s[q])),energy:Math.floor(s[p+4]),air:!grounded(s,p),action};
}
// Coordinates are local to the screen. Geometry is measured only on resize.
export function campaignPanelBounds({canvas,hud,stick,menu,mobile=false},side){
 const portrait=mobile&&canvas.width<500;
 let width=Math.min(mobile?(portrait?144:168):204,(canvas.width-24)*.44);
 let left=Math.max(canvas.left+8,hud.left),right=Math.min(canvas.right-8,hud.right),top=hud.bottom+6;
 const space=stick?stick.top-top-8:Infinity;
 let height=Math.min(mobile?(portrait?96:112):130,canvas.bottom-top-8,space);
 if(mobile&&stick&&space<68){
  // Extremely short landscape: there is no strip above the stick. Use the
  // inner part of the left half, below the menu, rather than covering a control.
  left=Math.max(left,stick.right+8);
  width=Math.min(width,(canvas.left+canvas.right)/2-8-left);
  top=Math.max(top,menu?.bottom+6||0);
  height=Math.min(112,canvas.bottom-top-8);
 }
 return {left:side==='left'?left:right-width,top,width,height};
}
const circuitLayout=new WeakMap();
function drawCampaignNetwork(canvas,trace){
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(globalThis.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 const g=canvas.getContext('2d');if(!g||!w||!h)return;g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);if(!trace)return;
 const {board,wires}=trace;let layout=circuitLayout.get(board);
 if(!layout){const levels=Array(board.n+2).fill(0);for(const[a,b]of board.gates)levels.push(Math.max(levels[a],levels[b])+1);
  const depth=Math.max(...levels),buckets=Array.from({length:depth+1},()=>[]);levels.forEach((l,i)=>buckets[l].push(i));
  const positions=levels.map((l,i)=>[l/Math.max(1,depth),(buckets[l].indexOf(i)+.5)/buckets[l].length]);
  layout={positions,outputs:new Set(board.outputs)};circuitLayout.set(board,layout);
 }
 const point=i=>[5+layout.positions[i][0]*(w-10),3+layout.positions[i][1]*(h-6)];g.lineWidth=.65;
 board.gates.forEach(([a,b],i)=>{const q=point(board.n+2+i);for(const n of [a,b]){const p=point(n);g.strokeStyle=wires[n]?'#89d3b4a8':'#58757e58';g.beginPath();g.moveTo(...p);g.lineTo((p[0]+q[0])/2,p[1]);g.lineTo((p[0]+q[0])/2,q[1]);g.lineTo(...q);g.stroke();}});
 for(let i=0;i<wires.length;i++){const p=point(i);g.fillStyle=wires[i]?(layout.outputs.has(i)?'#f6d585':'#a5e7c9'):'#405967';g.fillRect(p[0]-1.1,p[1]-1.1,2.2,2.2);}
}
const circuitHex=bits=>{let out='';for(let i=0;i<bits.length;i+=4)out=fromBits(bits.slice(i,i+4)).toString(16)+out;return out.toUpperCase();};
export function makeCampaignPanel({screen,canvas,hud,stick,menu,mobile,projectX,t}){
 const doc=screen.ownerDocument,root=doc.createElement('aside');root.id='campaignStatus';root.className='campaign-status';root.hidden=true;
 root.innerHTML='<header><strong></strong><span></span></header><div class="ai-board-meta"><b></b><small></small></div><canvas class="ai-network" aria-hidden="true"></canvas><div class="ai-board-bits"><span>IN <b></b></span><span>OUT <b></b></span></div>';
 screen.append(root);
 const title=root.querySelector('header strong'),stage=root.querySelector('header span'),role=root.querySelector('.ai-board-meta b'),gates=root.querySelector('.ai-board-meta small'),network=root.querySelector('canvas'),bits=[...root.querySelectorAll('.ai-board-bits b')];
 let side='right',bounds=null,lastPaint=-Infinity,placed='';const put=(node,value)=>{if(node.textContent!==String(value))node.textContent=value;};
 function measure(){const base=screen.getBoundingClientRect();if(!base.width||!base.height)return;
  const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left-base.left,right:r.right-base.left,top:r.top-base.top,bottom:r.bottom-base.top,width:r.width,height:r.height};};
  const pad=rect(stick);bounds={canvas:rect(canvas),hud:rect(hud),menu:rect(menu),stick:mobile()&&pad.width?pad:null,mobile:mobile()};placed='';place();
 }
 function place(){if(!bounds||root.hidden||placed)return;const b=campaignPanelBounds(bounds,side);placed=JSON.stringify(b);for(const k of ['left','top','width','height'])root.style[k]=b[k]+'px';root.dataset.compact=String(b.height<90);root.dataset.side=side;}
 const observer=new ResizeObserver(measure);for(const node of [screen,canvas,hud,stick,menu])observer.observe(node);
 return {root,reset(){side='right';lastPaint=-Infinity;placed='';},
  update(s,{visible,level,now,aiMode='circuit'}){
   visible=visible&&aiMode==='circuit';if(root.hidden===visible){root.hidden=!visible;placed='';if(visible)measure();}if(!visible)return;
   const next=campaignPanelSide(projectX(s[pbase(0)]),side);if(next!==side){side=next;placed='';}place();if(now-lastPaint<100)return;lastPaint=now;
   const machine=campaignTrace(s),traces=machine?[...machine.traces.values()].filter(v=>v.board.n<=32):[],trace=traces.length?traces[Math.floor(now/1300)%traces.length]:null;
   put(title,t('circuitBoard'));put(stage,t('aiStage').replace('{n}',String(level).padStart(2,'0')));
   put(role,t(trace?'circuit_'+trace.role:'circuitWaiting'));put(gates,trace?trace.board.gates.length+' NAND':'—');
   put(bits[0],trace?circuitHex(trace.inputs):'—');put(bits[1],trace?circuitHex(trace.outputs):'—');
   root.dataset.board=trace?.board.key||'';root.dataset.tick=trace?String(trace.tick):'';
   root.setAttribute('aria-label',t('circuitBoard')+' · '+role.textContent);root.title=t('circuitHint');
   drawCampaignNetwork(network,trace);
  }
 };
}

// Local NAND netlists for the existing policy, not an on-chain Circuit NFT.
// Sensing, clocks and seeded RNG stay in the game; comparisons, Boolean decisions
// and emitted button selection execute these gates. The old policy stays above.
const netlists=new Map();
function netlist(key,n,compile){
 if(netlists.has(key))return netlists.get(key);
 const gates=[],input=Array.from({length:n},(_,i)=>i+2);
 const nand=(a,b)=>{gates.push([a,b]);return n+1+gates.length;};
 const not=a=>nand(a,a),and=(a,b)=>not(nand(a,b)),or=(a,b)=>nand(not(a),not(b));
 const xor=(a,b)=>{const c=nand(a,b);return nand(nand(a,c),nand(b,c));};
 const mux=(a,b,s)=>nand(nand(a,not(s)),nand(b,s)); // s ? b : a
 const outputs=compile(input,{nand,not,and,or,xor,mux});
 const board=Object.freeze({key,n,gates:Object.freeze(gates.map(Object.freeze)),outputs:Object.freeze(outputs)});
 netlists.set(key,board);return board;
}
function comparator(width,float=false){return netlist(float?'CMP64':'CMP16',width*2,(pins,g)=>{
 let less=0,equal=1;const magnitude=float?width-1:width;
 for(let i=0;i<magnitude;i++){
  const a=pins[i],b=pins[width+i],same=g.not(g.xor(a,b));
  less=g.or(g.and(g.not(a),b),g.and(same,less));equal=g.and(equal,same);
 }
 let greater=g.and(g.not(less),g.not(equal));
 if(float){const sa=pins[width-1],sb=pins[width*2-1],signDiff=g.xor(sa,sb);
  less=g.mux(g.mux(less,greater,sa),sa,signDiff);equal=g.and(equal,g.not(signDiff));greater=g.and(g.not(less),g.not(equal));
 }
 return [less,equal,greater];
});}
export function evaluateNand(board,bits,buffer=new Uint8Array(board.n+2+board.gates.length)){
 if(bits.length!==board.n)throw Error('Invalid NAND input width');buffer[0]=0;buffer[1]=1;
 for(let i=0;i<bits.length;i++){if(bits[i]!==0&&bits[i]!==1)throw Error('Invalid NAND signal');buffer[i+2]=bits[i];}
 for(let i=0;i<board.gates.length;i++){const [a,b]=board.gates[i];buffer[board.n+2+i]=1-(buffer[a]&buffer[b]);}
 return {outputs:board.outputs.map(i=>buffer[i]),wires:buffer};
}
const numberBuffer=new DataView(new ArrayBuffer(8));
function numberBits(value,width){
 if(!Number.isFinite(value))throw Error('Non-finite AI sensor');
 if(width===16)return Array.from({length:16},(_,i)=>(value>>>i)&1);
 // Normalize signed zero so the circuit has the same equality as JS numbers.
 numberBuffer.setFloat64(0,value===0?0:value,true);
 return Array.from({length:64},(_,i)=>(numberBuffer.getUint8(i>>3)>>(i&7))&1);
}
const maskBits=n=>Array.from({length:13},(_,i)=>(n>>>i)&1),fromBits=b=>b.reduce((v,x,i)=>v|(x<<i),0);
export class CampaignCircuit {
 constructor(){this.buffers=new Map();this.traces=new Map();this.capture=false;this.tick=0;this.calls=0;this.operations=0;this.role='move';}
 begin(tick,capture){this.tick=tick;this.capture=capture;this.traces.clear();this.calls=0;this.operations=0;this.role='move';}
 run(board,bits){
  let buffer=this.buffers.get(board.key);if(!buffer){buffer=new Uint8Array(board.n+2+board.gates.length);this.buffers.set(board.key,buffer);}
  const result=evaluateNand(board,bits,buffer);this.calls++;this.operations+=board.gates.length;
  if(this.capture)this.traces.set(this.role,{board,inputs:bits.slice(),outputs:result.outputs.slice(),wires:buffer.slice(),tick:this.tick,role:this.role});
  return result.outputs;
 }
 compare(a,b){const narrow=Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<65536&&b<65536,w=narrow?16:64;
  return this.run(comparator(w,!narrow),[...numberBits(a,w),...numberBits(b,w)]);
 }
 lt(a,b){return this.compare(a,b)[0];}eq(a,b){return this.compare(a,b)[1];}gt(a,b){return this.compare(a,b)[2];}
 le(a,b){return this.not(this.gt(a,b));}ge(a,b){return this.not(this.lt(a,b));}
 not(a){return this.run(netlist('NOT',1,(p,g)=>[g.not(p[0])]),[+!!a])[0];}
 and(...a){return this.run(netlist('AND'+a.length,a.length,(p,g)=>[p.reduce(g.and,1)]),a.map(x=>+!!x))[0];}
 or(...a){return this.run(netlist('OR'+a.length,a.length,(p,g)=>[p.reduce(g.or,0)]),a.map(x=>+!!x))[0];}
 choose(s,a,b){return fromBits(this.run(netlist('MUX13',27,(p,g)=>p.slice(1,14).map((x,i)=>g.mux(p[i+14],x,p[0]))),[+!!s,...maskBits(a),...maskBits(b)]));}
 merge(a,b){return fromBits(this.run(netlist('OR13',26,(p,g)=>p.slice(0,13).map((x,i)=>g.or(x,p[i+13]))),[...maskBits(a),...maskBits(b)]));}
 keep(a,b){return fromBits(this.run(netlist('AND13',26,(p,g)=>p.slice(0,13).map((x,i)=>g.and(x,p[i+13]))),[...maskBits(a),...maskBits(b)]));}
 member(a,...values){return this.or(...values.map(b=>this.eq(a,b)));}
 output(mask){this.role='output';return this.keep(mask,8191);}
}
const circuitMachines=new WeakMap();
export const campaignTrace=s=>circuitMachines.get(s);
export const CAMPAIGN_AI_DEFAULT='circuit';
export function readCampaignAI(storage){try{return storage?.getItem('ember-campaign-ai')==='legacy'?'legacy':CAMPAIGN_AI_DEFAULT;}catch{return CAMPAIGN_AI_DEFAULT;}}
export function saveCampaignAI(storage,value){const mode=value==='legacy'?'legacy':'circuit';try{storage?.setItem('ember-campaign-ai',mode);}catch{}return mode;}
export function campaignInput(s,stage,options={}){
 if(options.mode==='legacy'){circuitMachines.delete(s);return legacyCampaignInput(s,stage);}
 return circuitCampaignInput(s,stage,!!options.trace);
}
export function circuitCampaignInput(s,stage,capture=false){
 // The clock/controller only decides when to evaluate, as in the retained policy.
 if(s[1]!==2){circuitMachines.delete(s);return 0;}
 const basic=stage<=BASE_STAGES,p=pbase(1),q=pbase(0),frame=s[0];
 if(!basic&&s[p+10]>0)return 0;
 if(frame<s[13])return s[11];if(frame<s[12])return s[11]&3;
 let c=circuitMachines.get(s);if(!c){c=new CampaignCircuit();circuitMachines.set(s,c);}c.begin(frame,capture);
 return basic?basicCircuitInput(s,Math.max(1,Math.min(6,stage|0)),c):advancedCircuitInput(s,stage,c);
}
function basicCircuitInput(s,level,c){
 const p=pbase(1),q=pbase(0),d=s[q]-s[p],distance=Math.abs(d),r=random(s),reaction=23-level*2,vertical=s[q+1]-s[p+1];
 s[12]=s[0]+reaction+Math.floor(random(s)*7);s[11]=0;
 const act=s[q+7],age=s[q+8];c.role='guard';
 const visible=c.and(c.gt(act,0),c.not(c.eq(act,10)),c.ge(age,reaction),c.le(age,c.eq(act,12)?43:c.eq(act,3)?21:moveStartup(act,s[q+11])+5));
 let threat=0;for(let n=0;n<PROJECTILE_COUNT;n++){if(projectileOwner(n)!==0)continue;const z=projectileBase(n);threat=c.or(threat,c.and(c.gt(s[z+3],0),c.lt(Math.abs(s[z]-s[p]),70),c.gt((s[p]-s[z])*s[z+2],0)));}
 const chance=level===1?0:.08+level*.035;
 if(c.and(c.ge(s[0],s[14]),c.eq(s[p+10],0),c.not(s[p+7]),c.or(c.and(visible,c.lt(distance,145)),threat,c.and(c.lt(distance,42),c.eq(act,0),c.lt(r,.04))),c.lt(r,chance))){
  // Preserve RNG short-circuit order exactly; each branch result comes from gates.
  let low=0;if(c.member(act,7,8))low=c.lt(random(s),.55);if(!low)low=c.lt(random(s),.12);
  const toward=c.choose(c.gt(d,0),B.RIGHT,B.LEFT);s[11]=c.merge(c.merge(B.BLOCK,c.choose(low,B.DOWN,0)),toward);
  s[13]=s[0]+9+Math.floor(random(s)*5);s[14]=s[13]+30+Math.floor(random(s)*21);return c.output(s[11]);
 }
 c.role='move';const toward=c.choose(c.gt(d,0),B.RIGHT,B.LEFT),away=c.choose(c.gt(d,0),B.LEFT,B.RIGHT);
 let mask=c.choose(c.gt(distance,32),toward,0);
 if(c.and(c.lt(vertical,-24),grounded(s,p),c.lt(r,.7)))mask=c.merge(mask,B.JUMP);
 if(c.and(c.gt(vertical,24),c.lt(support(s,p),FLOOR),grounded(s,p)))mask=c.merge(mask,c.merge(B.DOWN,B.JUMP));
 if(c.and(c.eq(level,4),c.lt(distance,60),c.ge(s[p+4],12)))mask=away;
 c.role='attack';
 if(c.and(c.lt(distance,44),c.lt(Math.abs(vertical),35)))mask=c.merge(mask,c.choose(c.lt(r,.7),B.LIGHT,B.HEAVY));
 else if(c.and(c.ge(level,4),c.ge(s[p+4],12)))mask=c.merge(mask,c.choose(c.and(c.lt(r,.25),c.ge(s[p+4],30)),B.SKILL,B.RANGED));
 if(c.and(c.ge(level,3),c.lt(s[q+1],120),c.lt(distance,40),c.lt(r,.25),c.ge(s[p+4],20)))mask=c.merge(B.DOWN,B.SKILL);
 if(c.and(c.ge(level,5),c.lt(distance,45),c.gt(r,.75)))mask=c.merge(mask,B.DOWN);
 if(c.and(c.ge(level,5),c.lt(r,.1)))mask=c.merge(mask,B.JUMP);
 if(c.and(c.ge(level,5),c.gt(distance,55),c.gt(r,.8)))mask=c.merge(mask,B.DASH);
 if(c.and(c.ge(level,5),c.lt(distance,65),c.gt(r,.6),c.ge(s[p+4],15)))mask=c.merge(mask,B.SMALL);
 if(c.and(c.eq(level,6),c.ge(s[p+4],70),c.lt(distance,120),c.lt(r,.18)))mask=c.merge(mask,B.SUPER);
 if(c.and(c.not(grounded(s,p)),c.ge(level,3),c.lt(distance,80),c.lt(Math.abs(vertical),70)))mask=c.merge(mask,c.choose(c.lt(r,.4),B.LIGHT,c.choose(c.lt(r,.65),B.HEAVY,c.choose(c.ge(s[p+4],30),B.SKILL,B.LIGHT))));
 if(c.keep(mask,B.LIGHT|B.HEAVY|B.SKILL|B.RANGED|B.SMALL|B.SUPER))mask=c.merge(c.keep(mask,8191^3),toward);
 s[11]=c.keep(mask,3);return c.output(mask);
}
function advancedCircuitInput(s,stage,c){
 const tier=Math.max(0,Math.min(5,(stage|0)-7)),profile=ADVANCED[tier],p=pbase(1),q=pbase(0),frame=s[0];
 const r=random(s),d=s[q]-s[p],distance=Math.abs(d),toward=c.choose(c.gt(d,0),B.RIGHT,B.LEFT),away=c.choose(c.gt(d,0),B.LEFT,B.RIGHT),vertical=s[q+1]-s[p+1],air=c.not(grounded(s,p)),energy=s[p+4],act=s[p+7];
 s[12]=frame+profile.reaction+Math.floor(random(s)*4);s[11]=c.choose(c.gt(distance,profile.spacing),toward,0);
 const send=buttons=>{s[11]=c.keep(buttons,3);return c.output(buttons);};c.role='combo';
 if(c.and(c.gt(s[p+24],0),c.ge(s[p+8],4),c.lt(r,profile.chain))){
  let next=0;
  if(c.member(act,A.JAB,A.JAB_TWO))next=c.choose(c.and(c.ge(tier,3),c.ge(energy,30)),B.HEAVY,B.LIGHT);
  else if(c.member(act,A.JAB_FINISH,A.HEAVY))next=c.choose(c.ge(energy,30),B.SKILL,0);
  else if(c.member(act,A.DRAGON,A.ANTIAIR))next=c.choose(c.ge(tier,2),B.JUMP,0);
  else if(c.eq(act,A.AIR_LIGHT))next=B.LIGHT;
  else if(c.eq(act,A.AIR_TWO))next=c.choose(c.and(c.ge(tier,4),c.ge(energy,30)),B.SKILL,B.HEAVY);
  else if(c.and(c.member(act,A.SKILL,A.SMALL,A.AIR_SKILL,A.AIR_SMALL),c.ge(energy,70),c.ge(tier,3)))next=B.SUPER;
  if(next)return send(c.merge(toward,next));
 }
 c.role='guard';const enemyAct=s[q+7],age=s[q+8],visible=c.and(c.gt(enemyAct,0),c.not(c.eq(enemyAct,A.DASH)),c.ge(age,profile.reaction));
 let projectile=0;for(let n=0;n<PROJECTILE_COUNT;n++){if(projectileOwner(n)!==0)continue;const z=projectileBase(n);projectile=c.or(projectile,c.and(c.gt(s[z+3],0),c.lt(Math.abs(s[z]-s[p]),85),c.gt((s[p]-s[z])*s[z+2],0),c.lt(Math.abs(s[z+1]-(s[p+1]-20)),30)));}
 if(c.and(c.not(act),c.not(air),c.ge(frame,s[14]),c.or(c.and(visible,c.lt(distance,105)),projectile),c.lt(r,profile.guard))){
  const low=c.lt(random(s),c.member(enemyAct,A.LOW_LIGHT,A.SWEEP)?.72:.1);
  s[11]=c.merge(c.merge(toward,B.BLOCK),c.choose(low,B.DOWN,0));s[13]=frame+10+Math.floor(random(s)*6);s[14]=s[13]+24;return c.output(s[11]);
 }
 if(act)return send(s[11]);c.role='move';
 let mask=c.choose(c.gt(distance,profile.spacing),toward,c.choose(c.and(c.lt(distance,profile.spacing-14),c.lt(r,.28)),away,0));
 if(c.and(c.gt(vertical,24),c.lt(support(s,p),FLOOR),c.not(air)))return send(c.merge(toward,c.merge(B.DOWN,B.JUMP)));
 if(c.and(c.lt(vertical,-25),c.not(air))){if(c.and(c.lt(distance,52),c.ge(energy,20),c.lt(r,profile.air)))return send(c.merge(toward,c.merge(B.UP,B.LIGHT)));mask=c.merge(mask,B.JUMP);}
 c.role='attack';
 if(c.and(air,c.lt(distance,82),c.lt(Math.abs(vertical),70)))return send(c.merge(toward,c.choose(c.lt(r,.66),B.LIGHT,c.choose(c.ge(energy,30),B.SKILL,B.HEAVY))));
 const punish=c.and(visible,c.gt(age,moveStartup(enemyAct,s[q+11])+5));
 if(c.and(c.lt(distance,100),c.ge(energy,70),c.or(c.and(punish,c.lt(r,profile.burst+.15)),c.lt(r,profile.burst*.45))))return send(c.merge(toward,B.SUPER));
 if(c.and(c.lt(distance,48),c.lt(Math.abs(vertical),34))){
  if(c.and(c.ge(tier,2),c.ge(energy,20),c.lt(r,profile.air*.55)))return send(c.merge(toward,c.merge(B.UP,B.LIGHT)));
  if(c.and(c.ge(energy,15),c.gt(r,.82)))return send(c.merge(toward,B.SMALL));
  return send(c.merge(c.merge(toward,c.choose(c.lt(r,.72),B.LIGHT,B.HEAVY)),c.choose(c.and(c.gt(r,.6),c.lt(r,.78)),B.DOWN,0)));
 }
 if(c.and(punish,c.lt(distance,110),c.ge(energy,30),c.lt(r,.50)))return send(c.merge(toward,B.SKILL));
 if(c.and(c.gt(distance,60),c.lt(distance,155),c.ge(energy,8),c.gt(r,.82-tier*.02)))return send(c.merge(toward,B.DASH));
 if(c.and(c.gt(distance,85),c.ge(energy,12),c.lt(r,tier===1?.62:.25+tier*.025)))return send(c.merge(toward,c.choose(c.and(c.ge(energy,30),c.lt(r,.12)),B.SKILL,B.RANGED)));
 return send(mask);
}
