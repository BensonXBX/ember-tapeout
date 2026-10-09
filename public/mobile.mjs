// Merge physical keys and pointer IDs so lifting one finger cannot release another.
export function makeInputSources(onChange){
 const sources=new Map();let mask=0;
 function publish(){let next=0;for(const value of sources.values())next|=value;const added=next&~mask;mask=next;onChange(next,added);}
 return {get mask(){return mask;},set(id,value){if((sources.get(id)||0)===value)return;if(!value)sources.delete(id);else if(sources.has(id)||sources.size<32)sources.set(id,value);publish();},clear(){sources.clear();publish();}};
}
export function joystickState(x,y,width,height){
 const radius=Math.max(1,Math.min(width,height)*.3),dx=x-width/2,dy=y-height/2,length=Math.hypot(dx,dy);
 const scale=length>radius?radius/length:1;
 // Circular dead zone and eight sectors avoid accidental diagonals near center.
 const mask=length<radius*.22?0:
  (dx/length<-.3827?1:dx/length>.3827?2:0)|(dy/length<-.3827?4096:dy/length>.3827?136:0);
 return {x:dx*scale,y:dy*scale,mask};
}
export const directionMask=(x,y,width,height)=>joystickState(x,y,width,height).mask;
export function bindTouchControls(root,{input,enabled}){
 const pointers=new Map();
 const viewport=root.ownerDocument?.defaultView?.visualViewport;
 // Browser chrome can move the fixed controls without a window resize.
 for(const type of ['resize','scroll'])viewport?.addEventListener(type,()=>{for(const record of pointers.values())record.rect=null;});
 function paint(){for(const button of root.querySelectorAll('[data-key]'))button.classList.toggle('pressed',[...pointers.values()].some(p=>p.target===button));}
 function update(id,x,y,immediate=false){const record=pointers.get(id);if(!record)return;let value=+record.target.dataset.key;
  if(record.pad){const rect=record.rect??(record.rect=record.target.getBoundingClientRect()),stick=joystickState(x-rect.left,y-rect.top,rect.width,rect.height);value=stick.mask;record.x=stick.x.toFixed(1)+'px';record.y=stick.y.toFixed(1)+'px';record.direction=String(value);record.dirty=true;if(immediate)paintStick(record);}
  input.set('touch:'+id,value);
 }
 function paintStick(record){if(!record.dirty)return;record.dirty=false;const target=record.target;if(target.dataset.direction!==record.direction)target.dataset.direction=record.direction;target.style.setProperty('--stick-x',record.x);target.style.setProperty('--stick-y',record.y);}
 function release(id){const record=pointers.get(id);if(!record)return;pointers.delete(id);input.set('touch:'+id,0);if(record.pad){record.target.dataset.direction='0';record.target.classList.remove('active');record.target.style.setProperty('--stick-x','0px');record.target.style.setProperty('--stick-y','0px');}paint();}
 root.addEventListener('pointerdown',event=>{
  const target=event.target.closest('[data-key],[data-pad]');if(!target||!root.contains(target)||!enabled()||event.button>0)return;
  event.preventDefault();const pad=target.hasAttribute('data-pad');if(pad&&[...pointers.values()].some(p=>p.pad))return;
  // Viewport recovery clears gestures; measure again only on the next press.
  pointers.set(event.pointerId,{target,pad,rect:pad?target.getBoundingClientRect():null});if(pad)target.classList.add('active');root.setPointerCapture(event.pointerId);update(event.pointerId,event.clientX,event.clientY,true);paint();
 });
 root.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId))return;event.preventDefault();if(!enabled())release(event.pointerId);else if(pointers.get(event.pointerId).pad)update(event.pointerId,event.clientX,event.clientY);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,event=>release(event.pointerId));
 root.addEventListener('contextmenu',event=>event.preventDefault());
 return {
  // A held pointer is one press. New attacks require release and another tap.
  tick(){if(!pointers.size)return;if(!enabled()){for(const id of [...pointers.keys()])release(id);return;}for(const record of pointers.values())if(record.pad)paintStick(record);},
  clear(){for(const id of [...pointers.keys()])release(id);}
 };
}
export function makeTouchPreferences({document:doc=globalThis.document,storage,onChange=()=>{}}={}){
 let layout='simple';try{storage??=globalThis.localStorage;if(storage?.getItem('ember-touch-layout')==='full')layout='full';}catch{}
 function apply(){doc.body.dataset.touchLayout=layout;onChange(layout);}
 apply();return {get layout(){return layout;},toggle(){layout=layout==='simple'?'full':'simple';try{storage?.setItem('ember-touch-layout',layout);}catch{}apply();}};
}
export function makeMobileLayout({onChange=()=>{},window:win=globalThis.window,document:doc=globalThis.document}={}){
 const touch=win.matchMedia('(any-pointer: coarse)'),vertical=win.matchMedia('(orientation: portrait)');
 // Portrait is a complete pocket-console layout, never a combat gate.
 const sync=()=>{const active=touch.matches&&doc.body.dataset.view==='battle';doc.body.classList.toggle('mobile-battle',active);doc.body.classList.toggle('portrait-allowed',touch.matches&&vertical.matches);onChange(false);};
 for(const query of [touch,vertical]){if(query.addEventListener)query.addEventListener('change',sync);else query.addListener?.(sync);}win.addEventListener('resize',sync);
 return {get touch(){return touch.matches;},get portrait(){return false;},sync,
  continuePortrait(){sync();},
  // Only a fullscreen button calls this; launching a mode never does.
  async enter(){try{if(!doc.fullscreenElement)await doc.body.requestFullscreen?.();}catch{}if(touch.matches)try{await win.screen.orientation?.lock?.('landscape');}catch{}sync();return !!doc.fullscreenElement;},
  unlock(){try{win.screen.orientation?.unlock?.();}catch{}sync();}
 };
}
