// One bounded viewport recovery path. Never restarts a match or its renderer.
export function measureViewport(win, doc) {
 const v=win.visualViewport,field=doc.activeElement;
 // Native selects and checkboxes retain focus after rotation but do not open a keyboard.
 const editing=!!field&&!field.readOnly&&!field.disabled&&(field.tagName==='TEXTAREA'||field.tagName==='INPUT'&&!/^(checkbox|radio|range|button|submit|reset|color|file|hidden)$/.test(field.type||'text'));
 const standalone=win.navigator?.standalone===true||win.matchMedia('(display-mode: standalone)').matches||win.matchMedia('(display-mode: minimal-ui)').matches;
 // Mobile browsers may briefly report the previous orientation in visualViewport.
 const coherent=!!v&&Math.abs(v.width-win.innerWidth)<3&&(!v.scale||Math.abs(v.scale-1)<.02);
 const visual=!!v&&coherent&&(editing||!standalone);
 return {width:Math.max(1,visual?v.width:win.innerWidth),height:Math.max(1,visual?v.height:win.innerHeight),x:visual&&editing?v.offsetLeft:0,y:visual&&editing?v.offsetTop:0,editing};
}
export function makeViewport({window:win=window,document:doc=document,onRecover=()=>{}}={}) {
 let raf=0,timers=[],disposed=false,resetBudget=4;const listeners=[];
 // This is a fixed game surface, not a scroll-restored document. Only reset
 // the root; room lists, dialogs and keyboard-focused fields keep their scroll.
 let priorRestoration;try{priorRestoration=win.history.scrollRestoration;win.history.scrollRestoration='manual';}catch{}
 const nativeDynamic=win.CSS?.supports?.('height','100dvh')===true;
 function draw(){raf=0;if(disposed)return;const s=measureViewport(win,doc);for(const [k,v] of Object.entries({width:s.width,height:s.height,left:s.x,top:s.y}))doc.documentElement.style.setProperty('--visible-'+k,v+'px');doc.body.dataset.editing=String(s.editing);doc.body.dataset.shortViewport=String(!s.editing&&s.width>s.height&&s.height<=330);
  if(!nativeDynamic){doc.documentElement.style.setProperty('--app-width',s.width+'px');doc.documentElement.style.setProperty('--app-height',s.height+'px');}
  if(!s.editing&&!doc.hidden&&(!win.visualViewport?.scale||Math.abs(win.visualViewport.scale-1)<.02)&&resetBudget>0){
   const root=doc.scrollingElement;
   if(Math.abs(win.scrollY||0)>.5||Math.abs(win.scrollX||0)>.5||Math.abs(root?.scrollTop||0)>.5||Math.abs(root?.scrollLeft||0)>.5||Math.abs(win.visualViewport?.offsetTop||0)>.5||Math.abs(win.visualViewport?.offsetLeft||0)>.5){resetBudget--;win.scrollTo?.({top:0,left:0,behavior:'instant'});}
  }
 }
 function schedule(){if(!raf)raf=win.requestAnimationFrame(draw);}
 function recover(){if(disposed)return;resetBudget=4;for(const t of timers)win.clearTimeout(t);onRecover();schedule();timers=[80,320,1200].map(ms=>win.setTimeout(schedule,ms));}
 function listen(target,type,fn){if(!target?.addEventListener)return;target.addEventListener(type,fn);listeners.push([target,type,fn]);}
 for(const type of ['resize','orientationchange','pageshow','focus'])listen(win,type,recover);
 listen(win,'scroll',schedule);
 for(const type of ['resize','scroll'])listen(win.visualViewport,type,schedule);
 for(const type of ['focusin','focusout'])listen(doc,type,recover);
 listen(doc,'visibilitychange',recover);listen(doc,'fullscreenchange',recover);listen(win.screen?.orientation,'change',recover);schedule();
 return {recover,dispose(){disposed=true;win.cancelAnimationFrame(raf);for(const t of timers)win.clearTimeout(t);for(const [target,type,fn] of listeners)target?.removeEventListener(type,fn);try{if(priorRestoration!==undefined&&win.history.scrollRestoration==='manual')win.history.scrollRestoration=priorRestoration;}catch{}}};
}
