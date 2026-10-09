import {text,guideText} from './experience-text.mjs?v=70f922bbef6f5838';
import {isMobile} from './wallet.mjs?v=e707770b310144b6';
export const standalone=win=>win.navigator.standalone===true||['standalone','minimal-ui'].some(mode=>win.matchMedia(`(display-mode: ${mode})`).matches);
export function nextGuide({mobile,app,portrait,installDone,rotateDone,walletDone,pvp,deposit=false,connected,busy}){
 if(busy)return null;if(mobile&&!app&&!installDone)return 'install';if(mobile&&app&&portrait&&!rotateDone)return 'rotate';if(pvp&&deposit&&!connected&&!walletDone)return 'wallet';return null;
}
export function makeExperience({window:win=window,document:doc=document,storage,panels,wallet,mobileLayout,onHome=()=>{}}){
 const $=id=>doc.getElementById(id),dialog=$('experienceDialog');let kind='',step=0,timer=0,walletSeen=false,platform=/Android/i.test(win.navigator.userAgent)?'android':'iphone';const seen=new Set();
 const read=k=>{if(seen.has(k))return true;try{return storage?.getItem('ember-guide-'+k)==='1';}catch{return false;}};
 const mark=k=>{seen.add(k);try{storage?.setItem('ember-guide-'+k,'1');}catch{}if(k==='rotate')mobileLayout.continuePortrait();};
 const node=(tag,cls,value)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(value)n.textContent=value;return n;};
 function picture(){
  const root=$('guidePicture');root.replaceChildren();root.dataset.step=step;
  const phone=node('div','guide-phone');const bar=node('div','phone-bar',step===2?'EMBER':guideText('browser'));phone.append(bar);
  if(step===0){phone.append(node('div','phone-game','余烬'));const tools=node('div','phone-toolbar');tools.append(node('span','','‹'),node('b','guide-highlight',platform==='iphone'?'↥ '+guideText('share'):'⋮ '+guideText('more')),node('span','','▢'));phone.append(tools);}
  else if(step===1){phone.append(node('div','phone-sheet','⊞ '+guideText(platform==='iphone'?'add':'install')));if(platform==='iphone'){const toggle=node('div','phone-toggle',guideText('webApp'));toggle.append(node('i','','✓'));phone.append(toggle);}phone.append(node('div','phone-confirm',guideText('confirm')));}
  else{const app=node('div','phone-app');const icon=node('img');icon.src='./assets/app-192.png';icon.alt='';app.append(icon,node('b','','余烬 · EMBER'));phone.append(app,node('span','phone-tap','↖'));}
  root.append(phone);
 }
 function render(){
  const tutorial=kind==='tutorial';dialog.dataset.kind=kind;$('guideTitle').textContent=tutorial?guideText('tutorial'):text(kind==='rotate'?'rotateTitle':kind==='wallet'?'walletTitle':'installTitle');
  $('guideSteps').hidden=!tutorial;$('guidePlatforms').hidden=!tutorial;$('guidePagination').hidden=!tutorial;$('guideIntro').hidden=tutorial;
  if(tutorial){const key=platform+(step+1);$('guideStepTitle').textContent=(step+1)+' / 3 · '+guideText(key+'Title');$('guideText').textContent=guideText(key);$('guideTip').textContent=guideText(key+'Tip');$('guideSource').textContent=guideText('official');$('guideSource').href=platform==='iphone'?'https://support.apple.com/guide/iphone/iphea86e5236/ios':'https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid';picture();}
  else{$('guideIntro').replaceChildren();if(kind==='wallet'){
    $('guideIntro').append(node('p','',guideText('walletRequired')));const steps=node('div','wallet-guide-steps');steps.hidden=wallet.injected;for(const key of ['connect','sign']){const card=node('section');card.append(node('h3','',guideText(key+'Step')),node('p','',guideText(key+'Detail')));steps.append(card);}$('guideIntro').append(steps);if(!wallet.injected)$('guideIntro').append(node('p','guide-tip',text('appReturn')));
   }else{$('guideIntro').append(node('p','',text(kind==='rotate'?'rotateText':'installText')));}}
  for(const b of doc.querySelectorAll('[data-guide-platform]'))b.setAttribute('aria-pressed',String(b.dataset.guidePlatform===platform));
  $('guidePage').textContent=(step+1)+' / 3';$('guidePrevious').textContent=guideText('previous');$('guideNext').textContent=guideText('next');$('guidePrevious').disabled=step===0;$('guideNext').disabled=step===2;
  $('guideRotate').hidden=kind!=='rotate';$('guideRotate').textContent=guideText('rotateReady');$('guideTutorial').hidden=tutorial||kind==='wallet';$('guideTutorial').textContent=guideText(kind==='rotate'?'rotationHelp':'tutorial');$('guideAccept').textContent=text(tutorial?'returnGame':kind==='rotate'?'portrait':kind==='wallet'?'connect':'continue');
  $('guideLater').hidden=kind!=='wallet';$('guideLater').textContent=guideText('returnHome');
 }
 function show(value){kind=value;step=0;render();panels.show(dialog);}
 function close(){if(kind==='install'||kind==='tutorial')mark('install');if(kind==='rotate')mark('rotate');if(kind==='wallet')walletSeen=true;panels.close(dialog);schedule();}
 function check(){
  const view=doc.body.dataset.view,pvp=doc.body.dataset.mode==='pvp'&&view==='lobby';if(!pvp||wallet.state.phase==='connected')walletSeen=false;
  if(dialog.open&&((kind==='rotate'&&win.innerWidth>=win.innerHeight)||(kind==='install'&&standalone(win))||(kind==='wallet'&&wallet.state.phase==='connected'))){close();return;}
  const value=nextGuide({mobile:isMobile(win),app:standalone(win),portrait:win.innerHeight>win.innerWidth,installDone:read('install'),rotateDone:read('rotate'),walletDone:walletSeen,pvp,connected:wallet.state.phase==='connected',busy:panels.open||['loading','connecting','switching','signing','verifying'].includes(wallet.state.phase)||!['home','lobby'].includes(view)||doc.hidden||doc.activeElement?.matches('input,select,textarea')});if(value)show(value);
 }
 function schedule(){win.clearTimeout(timer);timer=win.setTimeout(check,180);}
 $('guideRotate').onclick=close;$('guideTutorial').onclick=()=>{const rotate=kind==='rotate';if(rotate)mark('rotate');kind='tutorial';step=rotate?2:0;render();};$('guideNext').onclick=()=>{step=Math.min(2,step+1);render();};$('guidePrevious').onclick=()=>{step=Math.max(0,step-1);render();};
 for(const b of doc.querySelectorAll('[data-guide-platform]'))b.onclick=()=>{platform=b.dataset.guidePlatform;render();};
 $('guideAccept').onclick=()=>{const login=kind==='wallet';close();if(login){panels.show($('walletDialog'));void wallet.connect();}};
 $('guideLater').onclick=()=>{close();onHome();};dialog.addEventListener('cancel',e=>{e.preventDefault();const login=kind==='wallet';close();if(login)onHome();});
 $('experienceHelp').textContent=guideText('tutorial');$('experienceHelp').onclick=()=>show('tutorial');
 for(const d of doc.querySelectorAll('dialog'))d.addEventListener('close',schedule);
 const observer=new MutationObserver(schedule);observer.observe(doc.body,{attributes:true,attributeFilter:['data-view','data-mode','data-wallet-phase']});
 for(const event of ['resize','pageshow'])win.addEventListener(event,schedule);
 doc.addEventListener('visibilitychange',schedule);
 const displays=['standalone','minimal-ui'].map(mode=>win.matchMedia(`(display-mode: ${mode})`));for(const q of displays)q.addEventListener?.('change',schedule);if(read('rotate'))mobileLayout.continuePortrait();schedule();return {schedule,dispose(){observer.disconnect();for(const q of displays)q.removeEventListener?.('change',schedule);win.clearTimeout(timer);for(const event of ['resize','pageshow'])win.removeEventListener(event,schedule);doc.removeEventListener('visibilitychange',schedule);}};
}
