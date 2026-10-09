import test from 'node:test';
import assert from 'node:assert/strict';
import {measureViewport,makeViewport} from '../public/viewport.mjs';
function env(){
 const frames=new Map(),timers=new Map(),styles=new Map();let id=0;
 const win=Object.assign(new EventTarget(),{innerWidth:844,innerHeight:390,scrollX:0,scrollY:0,navigator:{standalone:true},matchMedia:()=>({matches:false}),CSS:{supports:()=>true},history:{scrollRestoration:'auto'},screen:{orientation:new EventTarget()},visualViewport:Object.assign(new EventTarget(),{width:844,height:390,offsetTop:0,offsetLeft:0,scale:1}),requestAnimationFrame:f=>(frames.set(++id,f),id),cancelAnimationFrame:i=>frames.delete(i),setTimeout:f=>(timers.set(++id,f),id),clearTimeout:i=>timers.delete(i)});
 const doc=Object.assign(new EventTarget(),{hidden:false,activeElement:null,scrollingElement:{scrollTop:0,scrollLeft:0},documentElement:{style:{setProperty:(k,v)=>styles.set(k,v)}},body:{dataset:{}}});let resets=0;
 win.scrollTo=()=>{resets++;win.scrollY=win.scrollX=doc.scrollingElement.scrollTop=doc.scrollingElement.scrollLeft=0;};
 return {win,doc,styles,frames,timers,get resets(){return resets},flush(){const q=[...frames.values()];frames.clear();for(const f of q)f();}};
}
test('rotation rejects stale visual orientation; standalone uses full surface and browser respects chrome',()=>{
 const e=env();e.win.visualViewport.height=337;assert.equal(measureViewport(e.win,e.doc).height,390);
 e.win.navigator.standalone=false;assert.equal(measureViewport(e.win,e.doc).height,337);
 e.win.visualViewport.width=390;e.win.visualViewport.height=844;assert.equal(measureViewport(e.win,e.doc).height,390);
 e.win.visualViewport.width=844;e.win.visualViewport.scale=2;assert.equal(measureViewport(e.win,e.doc).height,390);
});
test('negative Safari root overscroll and positive restored offsets reset without disturbing inner scroll',()=>{
 const e=env(),inner={scrollTop:120};let recoveries=0;e.win.scrollY=-53;
 const v=makeViewport({window:e.win,document:e.doc,onRecover:()=>recoveries++});e.flush();assert.equal(e.resets,1);assert.equal(e.win.history.scrollRestoration,'manual');assert.equal(e.styles.get('--visible-top'),'0px');
 e.win.scrollY=53;e.doc.scrollingElement.scrollTop=53;e.win.dispatchEvent(new Event('pageshow'));e.flush();assert.equal(e.resets,2);assert.equal(recoveries,1);assert.equal(inner.scrollTop,120);
 // A normal visual scroll is layout-only; it must not clear active combat input.
 e.win.visualViewport.dispatchEvent(new Event('scroll'));e.flush();assert.equal(recoveries,1);
 e.win.visualViewport.offsetTop=-53;e.win.dispatchEvent(new Event('pageshow'));e.flush();assert.equal(e.resets,3);
 v.dispose();assert.equal(e.win.history.scrollRestoration,'auto');assert.equal(e.frames.size,0);assert.equal(e.timers.size,0);
});
test('keyboard pan is retained while editing, then normalized after focusout; zoom and hidden pages are left alone',()=>{
 const e=env();e.doc.activeElement={tagName:'INPUT',type:'text'};e.win.visualViewport.height=190;e.win.visualViewport.offsetTop=65;e.win.scrollY=65;
 const v=makeViewport({window:e.win,document:e.doc});e.flush();assert.equal(e.resets,0);assert.equal(e.styles.get('--visible-top'),'65px');assert.equal(e.styles.get('--visible-height'),'190px');
 e.doc.activeElement=null;e.doc.dispatchEvent(new Event('focusout'));e.flush();assert.equal(e.resets,1);assert.equal(e.styles.get('--visible-top'),'0px');
 e.win.scrollY=20;e.win.visualViewport.scale=2;v.recover();e.flush();assert.equal(e.resets,1);
 e.win.visualViewport.scale=1;e.doc.hidden=true;v.recover();e.flush();assert.equal(e.resets,1);
 e.doc.hidden=false;e.doc.dispatchEvent(new Event('visibilitychange'));e.flush();assert.equal(e.resets,2);v.dispose();
});
test('failed scroll normalization is bounded; native dvh sizing and active-field scroll are preserved',()=>{
 const e=env();e.win.scrollY=-53;let attempts=0;e.win.scrollTo=()=>attempts++;
 const v=makeViewport({window:e.win,document:e.doc});
 for(let i=0;i<20;i++){e.win.dispatchEvent(new Event('scroll'));e.flush();}
 assert.equal(attempts,4);assert.equal(e.styles.has('--app-height'),false);
 v.recover();e.flush();assert.equal(attempts,5);v.dispose();e.win.dispatchEvent(new Event('scroll'));assert.equal(e.frames.size,0);
});
