import {makeAudioEvents,AUDIO_EVENT_BYTES} from './audio-events.mjs?v=2535be1c57f47850';
import {MUSIC_BYTES,MUSIC_THEMES,musicTime,composeMusic} from './music.mjs?v=44baa40f23beb99c';
export const NOISE_SAMPLES=4096;
export const AUDIO_BYTES=NOISE_SAMPLES*4+AUDIO_EVENT_BYTES+MUSIC_BYTES;
export const AUDIO_LIMITS=Object.freeze({sources:24,sampleRate:16000});
const DEFAULTS={enabled:true,music:35,sfx:70};
export function audioSettings(value={}){const settings={...DEFAULTS};if(typeof value.enabled==='boolean')settings.enabled=value.enabled;for(const k of ['music','sfx'])if(Number.isFinite(value[k]))settings[k]=Math.max(0,Math.min(100,Math.round(value[k])));return settings;}
const hz=n=>440*2**((n-69)/12);
export function makeAudio({onStatus=()=>{},window:win=globalThis.window,document:doc=globalThis.document,clock=()=>performance.now()}={}){
 let settings;try{settings=audioSettings(JSON.parse(localStorage.getItem('ember-audio-v21')||'{}'));}catch{settings=audioSettings();}
 let ctx=null,bus=null,noise=null,battle=false,quiet=true,lab=false,previewUntil=0,next=0,index=0,timer=null,disposed=false,musicType=0,heat=false;
 let resumeFailed=false,stalled=false,clockAt=0,audioAt=0,recoveryTimer=null;
 const sources=new Set(),reader=makeAudioEvents(event);
 function status(){onStatus({enabled:settings.enabled,ready:ctx?.state==='running'&&!stalled,active:battle&&!quiet,theme:MUSIC_THEMES[musicType].name,settings:{...settings}});}
 function save(){try{localStorage.setItem('ember-audio-v21',JSON.stringify(settings));}catch{}status();}
 function gains(){if(!ctx)return;const t=ctx.currentTime;
  for(const k of ['music','sfx']){const p=bus[k].gain;p.cancelScheduledValues(t);p.setTargetAtTime(settings[k]/100,t,.04);}
  bus.master.gain.setTargetAtTime(settings.enabled&&!quiet?.72:0,t,.025);
 }
 function clean(item){if(!sources.delete(item))return;for(const n of item.nodes)n.disconnect();}
 function stop(item){try{item.source.stop();}catch{}clean(item);}
 function stopAll(){for(const item of [...sources])stop(item);}
 function track(source,nodes,channel){
  if(sources.size>=AUDIO_LIMITS.sources){const victim=[...sources].find(x=>x.channel==='music')||[...sources].find(x=>x.channel==='sfx');if(victim)stop(victim);else{for(const n of nodes)n.disconnect();return null;}}
  const item={source,nodes,channel};sources.add(item);source.onended=()=>clean(item);return item;
 }
 function tone(channel,freq,duration,volume,type='sine',when=ctx.currentTime,end=freq,pan=0){
  if(settings[channel]===0)return;const o=ctx.createOscillator(),g=ctx.createGain(),p=ctx.createStereoPanner?.();o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),when);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),when+duration);g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),when+.004);g.gain.exponentialRampToValueAtTime(.0001,when+duration);
  o.connect(g);if(p){p.pan.value=pan;g.connect(p);p.connect(bus[channel]);}else g.connect(bus[channel]);
  if(track(o,p?[o,g,p]:[o,g],channel)){o.start(when);o.stop(when+duration+.01);}
 }
 function hiss(channel,duration,volume,freq=1500,when=ctx.currentTime,end=freq,pan=0){
  if(settings[channel]===0)return;const o=ctx.createBufferSource(),g=ctx.createGain(),f=ctx.createBiquadFilter(),p=ctx.createStereoPanner?.();o.buffer=noise;o.loop=true;f.type='bandpass';f.Q.value=.7;f.frequency.setValueAtTime(freq,when);f.frequency.exponentialRampToValueAtTime(Math.max(40,end),when+duration);g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),when+.003);g.gain.exponentialRampToValueAtTime(.0001,when+duration);o.connect(f);f.connect(g);if(p){p.pan.value=pan;g.connect(p);p.connect(bus[channel]);}else g.connect(bus[channel]);if(track(o,p?[o,f,g,p]:[o,f,g],channel)){o.start(when);o.stop(when+duration+.01);}
 }
 function sound(kind,type=0,value=0,slot=0,profile=0){if(!ctx||ctx.state!=='running'||!settings.enabled||quiet)return;
  const t=ctx.currentTime,pan=slot===0?-.22:.22,ice=type===1;
  if(kind==='hit'){
   const heavy=profile===1,dragon=profile===2,final=profile===3,d=final?.32:dragon?.22:heavy?.16:.07,v=final?.44:dragon?.32:heavy?.28:.17;
   tone('sfx',final?65:dragon?100:heavy?130:200,d,v,'sine',t,final?28:45,pan);
   hiss('sfx',d*.8,v*.8,ice?4600:final?650:1300,t,ice?final?700:1800:340,pan);
   if(ice&&!final)tone('sfx',final?2400:dragon?2100:heavy?1700:1900,d*1.2,v*.45,'triangle',t,final?280:700,pan);
   if(dragon)hiss('sfx',.18,.15,650,t+.025,3200,pan);
   if(final){if(ice){hiss('sfx',.035,.23,5600,t+.018,1800,pan);hiss('sfx',.2,.13,3600,t+.065,700,pan);tone('sfx',920,.23,.065,'sine',t+.045,430,pan);}else{hiss('sfx',.06,.25,1400,t+.015,300,pan);tone('sfx',85,.45,.2,'sine',t+.035,30,pan);hiss('sfx',.44,.13,490,t+.09,95,pan);}}
   return;
  }
  if(kind==='guard'||kind==='parry'){tone('sfx',kind==='parry'?1568:880,.2,.25,'triangle',t,kind==='parry'?2093:540,pan);hiss('sfx',.09,.14,4000,t,1800,pan);return;}
  if(kind==='land'){hiss('sfx',.1,.12,260,t,90,pan);return;}
  if(kind==='jump'){hiss('sfx',.12,.1,600,t,2300,pan);return;}
  if(kind==='win'){for(let k=0;k<4;k++)tone('sfx',hz([74,77,81,86][k]),.3,.14,'triangle',t+k*.1);return;}
  const a=value;
  if(a===10){hiss('sfx',.22,.22,ice?4200:1200,t,300,pan);tone('sfx',300,.15,.07,'sine',t,70,pan);}
  else if(a===12||a===19){if(ice){hiss('sfx',.3,.17,2100,t,5600,pan);tone('sfx',760,.21,.055,'sine',t,970,pan);}else{tone('sfx',46,.29,.2,'sine',t,92,pan);hiss('sfx',.32,.16,160,t,1250,pan);}hiss('sfx',.04,.12,ice?4900:900,t+.21,ice?1800:350,pan);}
  else if(a===3||a===17||a===11||a===18||a===4||a===9||a===20){const strong=a===3||a===17||a===20;hiss('sfx',strong?.25:.18,.22,ice?4200:700,t,ice?1700:2600,pan);tone('sfx',ice?1568:120,strong?.28:.18,.16,ice?'triangle':'sawtooth',t,ice?500:330,pan);if(strong)tone('sfx',70,.2,.2,'sine',t,35,pan);}
  else{hiss('sfx',a===2||a===6||a===14||a===16?.16:.09,ice?.2:.15,ice?3400:1500,t,ice?650:500,pan);if(a===2||a===6||a===14||a===16)tone('sfx',ice?740:160,.16,.15,ice?'triangle':'sine',t,ice?290:65,pan);}
 }
 function event(kind,slot,type,value,profile){sound(kind,type,value,slot,profile);if(kind==='win'&&value===4&&ctx)previewUntil=ctx.currentTime+.65;}
 function musicInstrument(kind,note,duration,volume,pan,when){const f=hz(note);
  if(kind==='kick'){tone('music',155,duration,volume,'sine',when,38);tone('music',850,.022,volume*.15,'triangle',when,180);}
  else if(kind==='snare'){hiss('music',duration,volume*1.8,1850,when,850,pan);tone('music',185,.09,volume*.5,'triangle',when,95,pan);}
  else if(kind==='rim')tone('music',620,.045,volume,'triangle',when,320,pan);
  else if(kind==='clap'){for(let k=0;k<3;k++)hiss('music',.05,volume,2800,when+k*.011,1900,pan);}
  else if(kind==='hat'||kind==='openHat')hiss('music',duration,volume*1.5,6500,when,4300,pan);
  else if(kind==='tom')tone('music',f,duration,volume,'sine',when,f*.42,pan);
  else if(kind==='crash')hiss('music',duration,volume,4800,when,1800,pan);
  else if(kind==='riser')hiss('music',duration,volume,700,when,5200,pan);
  else if(kind==='gritBass'){tone('music',f,duration,volume,'triangle',when,f*.98);tone('music',f*2,duration*.6,volume*.22,'sawtooth',when,f*1.98);}
  else if(kind==='roundBass')tone('music',f,duration,volume*1.15,'sine',when,f*.99);
  else if(kind==='bell'){tone('music',f,duration,volume,'sine',when,f,pan);tone('music',f*2.01,duration*.5,volume*.22,'sine',when,f*2,pan);}
  else if(kind==='stab'){tone('music',f,duration,volume,'sawtooth',when,f*.99,pan);tone('music',f/2,duration,volume*.3,'triangle',when,f/2,pan);}
  else tone('music',f,duration,volume,kind==='lead'?'triangle':'sine',when,f,pan);
 }
 function schedule(){if(!ctx||ctx.state!=='running'||quiet||!settings.enabled)return;const t=ctx.currentTime,wall=clock();
  if(t!==audioAt){audioAt=t;clockAt=wall;if(stalled){stalled=false;status();}}else if(clockAt&&wall-clockAt>1500&&!stalled){stalled=true;status();}
  if(stalled)return;
  if(settings.music===0||!(battle||t<previewUntil))return;
  if(next<t-.1)next=t+.025;
  while(next<t+.12){composeMusic(index,musicType,lab,heat,(kind,note,duration,volume,pan)=>musicInstrument(kind,note,duration,volume,pan,next));next+=musicTime(index+1,musicType)-musicTime(index,musicType);index++;}
 }
 function resetContext(){stopAll();clearInterval(timer);timer=null;const old=ctx;ctx=null;bus=null;noise=null;if(old){old.onstatechange=null;void old.close().catch(()=>{});}resumeFailed=false;stalled=false;next=0;audioAt=0;clockAt=0;}
 async function unlock(rebuild=false){if(disposed||!settings.enabled||doc?.hidden)return false;let target;try{
  if(rebuild||ctx?.state==='closed')resetContext();
  if(!ctx){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw Error('unsupported');ctx=new Audio();bus={};for(const key of ['master','music','sfx'])bus[key]=ctx.createGain();for(const key of ['music','sfx'])bus[key].connect(bus.master);
   const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=15;limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.15;bus.master.connect(limiter);limiter.connect(ctx.destination);
   noise=ctx.createBuffer(1,NOISE_SAMPLES,16000);const data=noise.getChannelData(0);let seed=7123;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
   timer=setInterval(schedule,50);ctx.onstatechange=()=>{if(ctx?.state==='running'){clockAt=clock();audioAt=ctx.currentTime;stalled=false;gains();schedule();}status();};
  }
  target=ctx;let timeout;
  try{await Promise.race([target.resume(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('resume timeout')),1200);})]);}finally{clearTimeout(timeout);}
  if(target!==ctx||disposed)return false;resumeFailed=false;clockAt=clock();audioAt=ctx.currentTime;gains();schedule();status();return ctx.state==='running';
 }catch{if(disposed||target&&target!==ctx)return false;resumeFailed=true;onStatus({enabled:settings.enabled,ready:false,unavailable:true,settings:{...settings}});return false;}}
 // Foreground recovery is bounded; a real touch-end can rebuild a stuck iOS context.
 const gesture=e=>{if(e.target?.closest?.('#demoMusic'))return;if(settings.enabled&&(!ctx||ctx.state!=='running'||stalled||resumeFailed))void unlock(stalled||resumeFailed);};
 const foreground=()=>{clearTimeout(recoveryTimer);if(doc?.hidden){clockAt=0;return;}if(ctx&&settings.enabled){void unlock();recoveryTimer=setTimeout(()=>{if(!disposed&&!doc?.hidden&&ctx?.state!=='running')void unlock();},300);}};
 for(const event of ['pointerdown','pointerup','touchend','keydown'])win?.addEventListener(event,gesture,{capture:true,passive:true});
 win?.addEventListener('pageshow',foreground);win?.addEventListener('focus',foreground);doc?.addEventListener('visibilitychange',foreground);
 return {
  bytes:AUDIO_BYTES,get ready(){return ctx?.state==='running'&&!stalled;},get settings(){return {...settings};},unlock,
  begin(s,isLab=false,slot=0){stopAll();previewUntil=0;reader.reset(s);battle=true;quiet=false;lab=isLab;heat=false;musicType=s[16+slot*28+11]|0;index=0;if(ctx){next=ctx.currentTime+.03;gains();}void unlock();},
  demo(type){if(musicType!==type||!lab){musicType=type;lab=true;heat=false;index=0;stopAll();if(ctx)next=ctx.currentTime+.025;}},
  reset(s){stopAll();reader.reset(s);if(ctx)next=ctx.currentTime+.025;},observe(s,damage=null){heat=!lab&&s[1]===2&&(Math.min(s[19],s[47])<=45||s[2]<=1200);reader.observe(s,damage);},
  activity(active,hidden=false){if(hidden)previewUntil=0;const hush=hidden||(!active&&(!ctx||ctx.currentTime>=previewUntil)),changed=battle!==active||hush!==quiet;battle=active;if(hush!==quiet){quiet=hush;if(quiet)stopAll();else if(ctx)next=ctx.currentTime+.025;gains();}if(changed)status();},
  set(key,value){if(key==='enabled')settings.enabled=!!value;else if(['music','sfx'].includes(key))settings[key]=Math.max(0,Math.min(100,Number(value)||0));if(!settings.enabled)stopAll();if(settings.music===0)for(const item of [...sources])if(item.channel==='music')stop(item);if(settings.sfx===0)for(const item of [...sources])if(item.channel==='sfx')stop(item);gains();save();},
  async preview(kind,type=0,profile=null){if(!['music','sfx'].includes(kind))return;settings.enabled=true;save();if(!await unlock())return;quiet=false;previewUntil=ctx.currentTime+(kind==='music'?8:3);gains();if(kind==='music'){for(const item of [...sources])if(item.channel==='music')stop(item);musicType=type===1?1:0;next=ctx.currentTime+.03;index=32;}else if(kind==='sfx'){if(profile===null)sound('attack',type,type===0?12:20,0);else sound('hit',type,0,0,profile);} status();},
  dispose(){disposed=true;clearTimeout(recoveryTimer);for(const event of ['pointerdown','pointerup','touchend','keydown'])win?.removeEventListener(event,gesture,true);win?.removeEventListener('pageshow',foreground);win?.removeEventListener('focus',foreground);doc?.removeEventListener('visibilitychange',foreground);resetContext();}
 };
}
