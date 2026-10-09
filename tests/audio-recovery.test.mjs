import test from 'node:test';
import assert from 'node:assert/strict';
import {makeAudio} from '../public/audio.mjs';
const settle=()=>new Promise(r=>setTimeout(r,65));
function fixture(t,settings={}){
 const old=globalThis.AudioContext,storage=globalThis.localStorage,instances=[];
 const param=()=>({value:0,cancelScheduledValues(){},setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),Q:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){}});
 class Context{
  state='suspended';currentTime=0;resumes=0;notes=0;destination={};fail=false;
  constructor(){instances.push(this);}
  createGain(){return node();}createDynamicsCompressor(){return node();}createBiquadFilter(){return node();}
  createBuffer(){return {getChannelData:()=>new Float32Array(4096)};}
  createOscillator(){return {...node(),start:()=>this.notes++,stop(){}};}
  createBufferSource(){return this.createOscillator();}
  async resume(){this.resumes++;if(this.fail)throw Error('interrupted');this.state='running';this.onstatechange?.();}
  async close(){this.state='closed';}
 }
 globalThis.AudioContext=Context;globalThis.localStorage={getItem:()=>JSON.stringify(settings),setItem(){}};
 const win=new EventTarget(),doc=new EventTarget();doc.hidden=false;let now=100;
 const audio=makeAudio({window:win,document:doc,clock:()=>now});
 t.after(()=>{audio.dispose();globalThis.AudioContext=old;globalThis.localStorage=storage;});
 return {audio,win,doc,instances,advance:n=>now+=n,start:async()=>{audio.begin(new Int32Array(80));await settle();}};
}
test('battle schedules music, resumes after returning from wallet, touch-end recovers interrupted context',async t=>{
 const f=fixture(t);await f.start();const c=f.instances[0];assert.ok(c.notes>0);assert.ok(f.audio.ready);
 f.doc.hidden=true;f.audio.activity(true,true);f.doc.dispatchEvent(new Event('visibilitychange'));
 c.state='interrupted';f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));f.audio.activity(true,false);await settle();
 assert.equal(c.state,'running');assert.ok(c.resumes>=2);assert.ok(f.audio.ready);
 c.state='interrupted';c.fail=true;f.win.dispatchEvent(new Event('touchend'));await settle();
 f.win.dispatchEvent(new Event('touchend'));await settle();assert.equal(f.instances.length,2);assert.equal(c.state,'closed');assert.ok(f.audio.ready);assert.ok(f.instances[1].notes>0);
});
test('running but frozen clock recovers on gesture without inheriting old music timeline',async t=>{
 const f=fixture(t);await f.start();const old=f.instances[0];old.currentTime=200;await settle();f.advance(1601);await settle();assert.equal(f.audio.ready,false);
 f.win.dispatchEvent(new Event('pointerup'));await settle();assert.equal(f.instances.length,2);assert.ok(f.audio.ready);assert.ok(f.instances[1].notes>0,'music must start at new context time');
 f.audio.dispose();f.win.dispatchEvent(new Event('touchend'));f.win.dispatchEvent(new Event('focus'));await settle();assert.equal(f.instances.length,2);
});
test('automatic lifecycle recovery respects disabled audio and zero music volume',async t=>{
 const f=fixture(t,{enabled:false,music:0});await f.start();f.win.dispatchEvent(new Event('touchend'));f.win.dispatchEvent(new Event('pageshow'));await settle();assert.equal(f.instances.length,0);
 f.audio.set('enabled',true);f.win.dispatchEvent(new Event('touchend'));await settle();assert.ok(f.audio.ready);assert.equal(f.instances[0].notes,0);assert.equal(f.audio.settings.music,0);
});
