import {BASE_STAGES,STAGE_COUNT,readCampaign,unlockedStage,winStage,saveCampaign,campaignInput,makeCampaignPanel,readCampaignAI,saveCampaignAI} from './campaign.mjs?v=c5c78f1d673a3db1';
import {makePayments,payText} from './payments.mjs?v=1811ce97d357a065';
const API_URL='/games/ember/api/arena',WSS_URL='';
import {text,entryText,controlSequence,language} from './experience-text.mjs?v=70f922bbef6f5838';
import {makeExperience} from './experience.mjs?v=e93af9340eaba32f';
import {makeReadyInputGuard} from './ready-preview.mjs?v=2ad087b437ff02f9';
import {makeOKXConnection,isMobile} from './wallet.mjs?v=e707770b310144b6';
import {makeDiagnostics} from './diagnostics.mjs?v=ac8b038e763b5a28';
import {makeViewport} from './viewport.mjs?v=a496f7140a47631c';
import {makeRoomCleanup} from './room-cleanup.mjs?v=4b998542fe356e64';
import {makeInputSources,bindTouchControls,makeMobileLayout,makeTouchPreferences} from './mobile.mjs?v=87f208c83d6ca858';
import {makeArenaTransport,acceptRoomHeartbeat} from './socket-transport.mjs?v=2bbf7da8630dce4a';
import {makePrediction} from './prediction.mjs?v=b4a5e757c7484e12';
import {makeFrameBudget} from './frame-budget.mjs?v=a6e4b5200f070703';
import {makeRoomLobby} from './lobby.mjs?v=79898314bcecfd4b';
import {makeMenuPanels} from './menu.mjs?v=4b1a3e4ca528349b';
import {createState,start,step,pbase,SIZE,ACTION_MASK,MAX_HP,elementImbued} from './engine.mjs?v=ee9e0d5b4ef43ac9';
import {makeRenderer,fighter,artReady,stageReady} from './render.mjs?v=b7005c16b606d5db';
import {COMBOS,ROUTE_STEPS} from './combos.mjs?v=1410d01635f97fbb';
import {makeTraining,makeComboShowcase,inputLabel,actionLabel} from './training.mjs?v=6deb00a3f38c9e14';
import {makeAudio} from './audio.mjs?v=1f651cd599e8271f';
const elements=new Map(),$=id=>{let node=elements.get(id);if(!node){node=document.getElementById(id);if(node)elements.set(id,node);}return node;},renderer=makeRenderer($('arena')),lab=makeTraining();
let connecting=false;const readyInput=makeReadyInputGuard();let waitingPractice=false;
let state=createState(),mode='pve',selected=0,opponent=1,level=1,unlocked=1,running=false,paused=false,mask=0,edgeBits=0,session=null,pollTimer=0,seq=0,generation=0,last=0,acc=0,finished=false;
const mixer=makeAudio({onStatus:updateAudioUI});
let touchControls=null;
const inputs=makeInputSources((next,added)=>{readyInput.observe(next);mask=readyInput.filter(state,next,waitingPractice);const accepted=readyInput.filter(state,added,waitingPractice);edgeBits|=accepted;predictionEdges|=accepted&ACTION_MASK;});
function syncCombatInput(){const change=readyInput.sync(state,waitingPractice,inputs.mask);if(change==='reset')clearCombatInput();else if(change==='resume'||change==='prepare'){mask=readyInput.filter(state,inputs.mask,waitingPractice);edgeBits=0;predictionEdges=0;}}
function clearCombatInput(){inputs.clear();touchControls?.clear();mask=0;edgeBits=0;predictionEdges=0;}
const mobile=makeMobileLayout({onChange:portrait=>{if(portrait)clearCombatInput();$('rotateStatus').textContent=mode==='pvp'?'在线对局仍在进行':'本地训练已暂停';}});
const campaignPanel=makeCampaignPanel({screen:document.querySelector('.screen'),canvas:$('arena'),hud:document.querySelector('.hud'),stick:document.querySelector('.joystick'),menu:$('fullscreenMenuBtn'),mobile:()=>mobile.touch,projectX:x=>renderer.projectX(x),t:entryText});
const panels=makeMenuPanels({closeLabel:()=>payText('closeWindow'),dialogs:[$('gameMenu'),$('audioSettings'),$('help'),$('comboDialog'),$('trainingDialog'),$('settingsDialog'),$('walletDialog'),$('exitDialog'),$('experienceDialog'),$('paymentDialog'),$('rewardsDialog'),$('amountDialog'),$('nicknameDialog')],localGame:()=>running&&mode!=='pvp',isPaused:()=>paused,togglePause,clearInput:()=>{clearCombatInput();acc=0;},getFocus:()=>document.activeElement,focusArena:()=>{if(running)$('arena').focus({preventScroll:true});}});
function battleView(on){if(on&&mode==='pve')activeCampaignAI=campaignAI;campaignPanel.root.hidden=true;campaignPanel.reset();readyInput.reset();document.querySelector('.screen').dataset.paused='false';const home=!on&&document.body.dataset.view==='home';document.body.dataset.view=on?'battle':home?'home':'lobby';$('home').hidden=!home;$('exitScreen').hidden=true;$('lobby').hidden=on||home;$('battleView').hidden=!on;$('labWorkbench').hidden=!on||mode!=='lab';if(mode==='lab'&&on)$('labWorkbench').prepend($('labPanel'));else $('setupOptions').append($('labPanel'));$('battleCoach').hidden=!on||mode!=='lab';if(on){panels.reset();$('coachBody').hidden=mode!=='lab';$('coachToggle').setAttribute('aria-expanded',String(mode==='lab'));updateCoach(true);window.scrollTo({top:0,left:0,behavior:'instant'});}else{$('lobbyActions').append($('primary'));panels.reset();}mobile.sync();}
const rooms=makeRoomLobby({api,connect:selectOnline,available:()=>document.body.dataset.view==='lobby'&&mode==='pvp'&&!running&&!connecting,currentRoom:()=>session?.code||''});
function lobbySummary(){
 $('lobbyHeading').textContent=entryText(mode==='pvp'?'pvpTitle':mode==='lab'?'labTitle':'soloTitle');
 $('launchSummary').textContent=mode==='pve'?names[selected]+' · '+levelNames[level-1]:mode==='lab'?entryText('training'):'';
 $('setupTitle').textContent=entryText(mode==='pve'?'selectStage':mode==='lab'?'trainingSettings':'create');
 $('setupHint').textContent=entryText(mode==='pve'?'soloHint':mode==='lab'?'labHint':'pvpIntro');
 $('roomHall').hidden=mode!=='pvp';$('rewardsOpen').hidden=mode!=='pvp';
 $('trainQuick').hidden=mode!=='pvp';$('cancelConnect').textContent=entryText('cancelConnect');
}

function openPanel(id){refreshControlCopy();if(id==='gameMenu'){$('menuStatus').textContent=running?(mode==='pvp'?'在线对局继续进行，菜单期间停止角色输入。':'已暂停，点击菜单外的画面或关闭菜单继续战斗。'):session?'等待好友加入，可退出并返回准备界面。':'选择角色与关卡，准备下一场对决。';$('leave').hidden=false;$('leave').disabled=!running&&!session&&!finished&&!connecting;$('menuReturn').textContent=running?'继续战斗':'返回准备界面';}if(id==='audioSettings')updateAudioUI();if(id==='trainingDialog'){$('trainingContent').append($('labWorkbench'));updateLab(true);}$('trainingMenuButton').hidden=mode!=='lab'||!running;panels.show($(id));}
document.querySelector('.brand').onclick=e=>{e.preventDefault();if(running||session)openPanel('gameMenu');else showHome();};$('menuBtn').onclick=$('battleMenuBtn').onclick=()=>openPanel('gameMenu');$('fullscreenMenuBtn').onclick=e=>{e.stopPropagation();openPanel('gameMenu');};$('menuClose').onclick=$('menuReturn').onclick=()=>panels.close($('gameMenu'),true);$('comboBtn').onclick=()=>openPanel('comboDialog');$('comboClose').onclick=()=>panels.close($('comboDialog'));document.addEventListener('fullscreenchange',()=>{$('fullscreenLabel').textContent=document.fullscreenElement?'返回窗口模式':'扩大游戏画面';});

function updateAudioUI(info){const prefs=info?.settings||mixer.settings;$('sound').textContent=entryText(prefs.enabled?'soundOn':'soundOff');$('sound').setAttribute('aria-label',entryText(prefs.enabled?'soundDisable':'soundEnable'));$('sound').setAttribute('aria-pressed',String(prefs.enabled));$('audioEnabled').checked=prefs.enabled;for(const key of ['music','sfx']){$(key+'Volume').value=prefs[key];$(key+'Value').textContent=prefs[key]+'%';}$('demoMusic').textContent=entryText(!prefs.enabled||!prefs.music?'demoMusicOff':info?.ready||mixer.ready?'demoMusicOn':'demoMusicStart');$('demoMusic').setAttribute('aria-pressed',String(prefs.enabled&&prefs.music>0));$('audioStatus').textContent=entryText(!prefs.enabled?'audioOff':info?.unavailable?'audioRetry':info?.ready?'audioOn':'audioStart');}
const live=makeArenaTransport(api,{url:()=>{const u=new URL(WSS_URL||API_URL,location.href);if(!WSS_URL){u.protocol=u.protocol==='https:'?'wss:':'ws:';u.pathname+='/ws';}return u.href;}}),prediction=makePrediction(),drawBudget=makeFrameBudget(),hudKeys=[{},{}];let predictionEdges=0,lastDraw=0;
function setHidden(id,value){const node=$(id);if(node.hidden!==value)node.hidden=value;}
function setText(id,value){const node=$(id),text=String(value);if(node.textContent!==text)node.textContent=text;}
const levelNames=Array.from({length:STAGE_COUNT},(_,i)=>entryText('stageName'+(i+1)));
const tips=Array.from({length:STAGE_COUNT},(_,i)=>entryText('stageHint'+(i+1)));
let artLoaded=false,campaignStorage;try{campaignStorage=localStorage;}catch{}
let campaignAI=readCampaignAI(campaignStorage),activeCampaignAI=campaignAI;
$('campaignAI').value=campaignAI;$('campaignAI').onchange=()=>{campaignAI=saveCampaignAI(campaignStorage,$('campaignAI').value);notice(entryText('campaignAISaved'));};
let cleared=readCampaign(campaignStorage),chapter=0;unlocked=unlockedStage(cleared);
if(cleared>=BASE_STAGES){level=unlocked;chapter=1;}
const stageStatus=()=>entryText('campaignStatus').replace('{n}',level).replace('{name}',levelNames[level-1]);
const names=['烬 · JIN','霜 · SHUANG'];

const characterStories=[
 {title:'不熄之拳',origin:'烬 · 23岁 · 铁炉城',quote:'“火可以烧毁一座城，也可以替人照亮回家的路。”',goal:'寻找失踪的父亲，查清赤炼之灾的真相。',paragraphs:[
  '烬是铁炉城铸剑师的女儿，却总把父亲教她的控火术用在街头拳赛上。她直率好胜，输了一场就会笑着约下一场；看见有人受欺负，又总是第一个冲上去。白色战裤上的赤焰纹，是父亲亲手绣下的家徽。',
  '赤炼之灾那夜，地底炉心被人夺走，失控的火焰吞没了城区。父亲将最后一枚炉火种交给她，转身进入火海，再也没有回来。烬以双拳吸住四散的火舌，为逃难的人打开了一条路。从那以后，她的拳头便再也没有真正冷却。',
  '她参加余烬比武，是为了赢得进入旧都封锁区的资格，追查炉心的去向。霜带来的冰晶上，竟有同样的家族锻印。两人从互相试探的对手，成为共同追查灾厄的伙伴；可只要站上擂台，烬仍会认真争胜。']},
 {title:'永夜中的月光',origin:'霜 · 22岁 · 北境月隐',quote:'“等雪停了，我们一起去看真正的春天。”',goal:'找到炉火种，让被封冻的故乡重新醒来。',paragraphs:[
  '霜是北境月隐剑馆最年轻的守剑人。她说话轻柔，出刀却干净利落；看起来总是从容，遇到喜欢的甜食又会藏不住笑。深蓝衣袍上的银月纹，记录着她与故乡的约定：剑锋所向，应当是需要守护的人身前。',
  '永夜寒潮降临时，师父以冰结太刀封住灾厄，也将整座城的居民封进了漫长的沉眠。霜带着太刀逃出结界，刀身从此凝着无法融化的寒霜。她知道故乡的人还活着，而能够唤醒他们的，是与这股寒潮同源的炉火种。',
  '循着冰晶上的锻印，她找到了烬，起初以为焰拳正是寒潮的源头。交锋后，两人发现焚城与永夜留下了相同的线索。霜也加入余烬比武，争取通往旧都的资格；她与烬既是同行的伙伴，也是互不相让的对手。']}
];
function characterStory(n){const story=characterStories[n];$('characterStory').dataset.element=n?'ice':'fire';$('storyTitle').textContent=story.title;$('storyOrigin').textContent=story.origin;$('storyQuote').textContent=story.quote;$('storyGoal').textContent=story.goal;$('storyText').replaceChildren(...story.paragraphs.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));}
function notice(t){$('notice').textContent=t;}
function levels(){document.querySelector('.campaign-chapters').setAttribute('aria-label',entryText('campaignChapters'));const container=$('levels');container.replaceChildren();for(let n=chapter*BASE_STAGES+1;n<=(chapter+1)*BASE_STAGES;n++){const b=document.createElement('button');b.className='level'+(level===n?' active':'');b.dataset.stage=n;b.disabled=n>unlocked;b.setAttribute('aria-pressed',String(level===n));b.setAttribute('aria-label',String(n).padStart(2,'0')+' '+levelNames[n-1]+(n>unlocked?' · '+entryText('campaignLocked'):''));b.innerHTML='<b>'+String(n).padStart(2,'0')+'</b><strong>'+levelNames[n-1]+'</strong><span>'+(n>unlocked?'◇':n<=cleared?'✓':n===level?'●':'→')+'</span><small>'+(n>unlocked?entryText('campaignLocked'):tips[n-1])+'</small>';b.onclick=()=>{if(running||session||connecting)return notice('请先退出当前对局。');level=n;levels();menu();};container.append(b);}$('progress').textContent=cleared+' / '+STAGE_COUNT;for(const b of document.querySelectorAll('[data-chapter]')){b.textContent=entryText(+b.dataset.chapter?'campaignAdvanced':'campaignBase');b.setAttribute('aria-pressed',String(+b.dataset.chapter===chapter));}}
for(const b of document.querySelectorAll('[data-chapter]'))b.onclick=()=>{if(running||session||connecting)return;chapter=+b.dataset.chapter;if(Math.floor((level-1)/BASE_STAGES)!==chapter)level=chapter*BASE_STAGES+1;levels();menu();};
let comboFilter='all';
function comboTable(){
 $('comboCharacter').textContent=selected?'霜 · 银月剑术':'烬 · 赤焰拳术';$('airMoveNames').textContent=selected?'霜：月轮追刃 / 回天双月 / 天霜剑雨':'烬：焰翼冲掌 / 焰陨连踢 / 坠日赤莲';
 for(const group of ['ground','air']){const body=$(group+'Combos');body.replaceChildren();for(const combo of COMBOS){if(combo.group!==group||combo.type>=0&&combo.type!==selected)continue;const row=document.createElement('tr');row.dataset.route=combo.id;const name=document.createElement('td'),keys=document.createElement('td'),cost=document.createElement('td');const title=document.createElement('b'),note=document.createElement('small');title.textContent=combo.name;note.textContent=combo.note;name.append(title,note);keys.textContent=controlSequence(combo.keys,mobile.touch);keys.className='combo-keys';cost.textContent=String(combo.cost);row.append(name,keys,cost);body.append(row);}document.querySelector('[data-group="'+group+'"]').hidden=comboFilter!=='all'&&comboFilter!==group;}
 document.querySelector('.combo-grid').classList.toggle('single',comboFilter!=='all');document.querySelectorAll('[data-combo]').forEach(b=>{const on=b.dataset.combo===comboFilter;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
}
document.querySelectorAll('[data-combo]').forEach(b=>b.onclick=()=>{comboFilter=b.dataset.combo;comboTable();});
function character(n){if(session?.selection){if(session.selectionLocked||session.selection.locked?.[session.slot])return;selected=n;paintOnlineSelection();return;}if(running||session||connecting)return notice('对局中不能更换角色。');selected=n;characterStory(n);document.querySelectorAll('[data-fighter]').forEach(b=>{const yes=+b.dataset.fighter===n;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});$('skillName').textContent=n?'霜月斩 / 永夜冰葬':'焰掌 / 赤莲焚城';$('skillDesc').textContent=n?'剑尖控距 · 冰结剑气 · 远程牵制':'贴身突进 · 连续拳脚 · 赤焰爆发';$('roleRange').textContent=n?'剑尖 36–60 · 远程 120–300':'贴身 18–40 · 前踏拳脚追击';$('roleWeak').textContent=n?'轻击6帧起手，贴身容易被抢先；剑气可对消':'拳短，远距需跳入或突进接近';$('roleRisk').textContent=n?'重击总长40帧／远程总长35帧，挥空易被突进反击':'突进被挡或落空不能取消，会停在对手面前';$('speedStat').textContent=n?'▰▰▰▱▱':'▰▰▰▰▱';$('rangeStat').textContent=n?'▰▰▰▰▱':'▰▰▱▱▱';state=createState(n,opponent);comboTable();labRoutes();updateHUD();lobbySummary();paintSelectionSides();}
function setMode(m){if(running||session||connecting)return notice('请先退出当前对局，再切换模式。');cancelSelection();document.body.dataset.view='lobby';document.body.dataset.mode=m;mode=m;window.scrollTo?.({top:0,left:0,behavior:'instant'});notice('');document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===m);b.setAttribute('aria-pressed',String(b.dataset.mode===m));});$('pvpPanel').hidden=m!=='pvp';$('pvePanel').hidden=m!=='pve';$('labPanel').hidden=m!=='lab';$('labWorkbench').hidden=true;$('modeLabel').textContent=m==='pvp'?'ONLINE DUEL':m==='lab'?'COMBO LAB':'AI ARCADE';$('tag1').textContent=m==='pvp'?'RIVAL':'AI';levels();menu();if(m==='pvp')void rooms.refresh();}
function menu(){battleView(false);lobbySummary();mixer.activity(false,true);finished=false;state=createState(selected,opponent);$('overlay').hidden=false;$('primary').disabled=false;$('primary').textContent=entryText(mode==='pvp'?'create':mode==='lab'?'startLab':level>unlocked?'campaignBaseLocked':'startSolo');document.querySelector('.start-card h2').innerHTML=mode==='pvp'?'像素格斗<br><span>邀请好友，准备开战</span>':mode==='lab'?'连段训练场<br><span>每一次命中，都看得清楚</span>':levelNames[level-1]+'<br><span>'+entryText('campaignAi')+'</span>';$('overlayText').textContent=mode==='pvp'?entryText('roomBeforeSelection'):mode==='lab'?'真实判定框 · 输入记录 · 连击伤害 · 路线练习':tips[level-1];$('trainQuick').hidden=mode!=='pvp';$('pause').hidden=true;$('leave').hidden=true;$('roomBox').hidden=true;$('battleStatus').textContent=mode==='pvp'?'等待挑战者':mode==='lab'?'连段训练 · 无限生命':stageStatus();$('connection').textContent='准备就绪';$('announcement').textContent='';unlockControls();updateHUD();}
function unlockControls(){$('cancelConnect').hidden=!connecting;$('backHome').disabled=!!session;$('primary').disabled=!artLoaded||connecting||!!session&&!finished||mode==='pve'&&level>unlocked;document.querySelectorAll('[data-fighter],#match,#joinForm button').forEach(b=>b.disabled=!artLoaded||connecting||running||!!session);}
// Analytics never gates play or handles payments. Solo outcomes are explicitly
// client-reported; server-issued run credentials make completion idempotent.
let monitoredRun=null;
function monitorStart(){monitorEnd('exit');const job=api({action:'run-start',mode,level,walletSession:wallet.state.session}).catch(()=>null);monitoredRun=job;}
function monitorEnd(result){const job=monitoredRun;monitoredRun=null;if(job)void job.then(r=>r&&api({action:'run-end',...r,result})).catch(()=>{});}
addEventListener('pagehide',()=>monitorEnd('exit'));
function beginTraining(){if(level>unlocked)return;if(!artLoaded)return notice('人物和场景正在载入，请稍候。');monitorStart();battleView(true);state=createState(selected,opponent,level*739+42);state[20]=state[48]=100;start(state);mixer.begin(state,false);mobile.sync();running=true;finished=false;paused=false;clearCombatInput();acc=0;$('overlay').hidden=true;$('arena').focus({preventScroll:true});$('pause').hidden=false;$('pause').textContent='暂停';$('leave').hidden=false;$('connection').textContent='AI 训练';$('battleStatus').textContent=stageStatus();unlockControls();notice('');}
function labRoutes(){const available=COMBOS.filter(c=>c.type<0||c.type===selected),old=lab.snapshot().route;$('labRoute').replaceChildren();for(const c of available){const option=document.createElement('option');option.value=c.id;option.textContent=entryText('route_'+c.id)+' · '+controlSequence(c.keys,mobile.touch);$('labRoute').append(option);}const id=available.some(c=>c.id===old)?old:available[0].id;$('labRoute').value=id;lab.select(id);updateLab(true);}
function resetLab(clear=false){if(mode!=='lab'||!running)return;clearCombatInput();acc=0;lab.reset(state,clear);mixer.reset(state);updateLab(true);updateHUD();$('arena').focus({preventScroll:true});}
function beginLab(){if(!artLoaded)return notice('人物和场景正在载入，请稍候。');monitorStart();battleView(true);state=createState(selected,opponent);running=true;paused=false;finished=false;lab.autoRetry=true;lab.reset(state);mixer.begin(state,true);mobile.sync();clearCombatInput();readyInput.sync(state);acc=0;$('overlay').hidden=true;$('pause').hidden=false;$('pause').textContent='暂停';$('leave').hidden=false;$('connection').textContent='训练场就绪';$('battleStatus').textContent='连段训练 · '+(mobile.touch?entryText('reset'):'R 重置位置');unlockControls();updateLab(true);updateHUD();$('arena').focus({preventScroll:true});notice('');}

let coachKey='';
function trainingFeedback(value){
 const rules=[['路线完成','coach_success'],['连段中断','coachBreak'],['招式顺序不符','coachOrder'],['超时','coachTimeout'],['距离不足','coachDistance'],['朝向相反','coachFacing'],['高度不符','coachHeight'],['格挡','coachBlocked'],['能量不足','coachEnergy'],['冷却','coachCooldown'],['指令未执行','coachTiming'],['衔接未执行','coachTiming'],['未命中','coachMiss'],['衔接成功','coach_progress']];
 return entryText(rules.find(([prefix])=>value?.includes(prefix))?.[1]||'coach_ready');
}
function updateCoach(force=false){
 const v=lab.snapshot(),practice=mode==='lab',route=practice?v.route:'ground-three',combo=COMBOS.find(c=>c.id===route);
 const key=[mode,mobile.touch,language(),v.serial,v.hits,v.damage,v.damageEvents.lastDamage,v.active,v.inputState].join(':');if(!force&&key===coachKey)return;coachKey=key;
 $('coachStats').hidden=$('coachActions').hidden=!practice;
 setText('coachToggle',entryText('route_'+route));setText('coachRoute',entryText('route_'+route));setText('coachProgress',practice?v.routeIndex+' / '+ROUTE_STEPS[route].length:'');
 $('coachSteps').replaceChildren(...combo.keys.split(' → ').map((key,i)=>{const li=document.createElement('li');li.textContent=controlSequence(key,mobile.touch);li.className=practice?(i<v.routeIndex?'done':i===v.routeIndex?'next':''):'';return li;}));
 const status=practice?v.routeStatus:'hint',terminal=status==='failed'||status==='success';
 const next=combo.keys.split(' → ')[v.routeIndex]||'';
 setText('coachNextMove',terminal?entryText('coach_'+status+'Title'):entryText(v.inputState==='waiting'?'coachExecuting':'coachNextMove').replace('{move}',controlSequence(next,mobile.touch)));
 const detail=terminal?entryText('coach_'+status)+(status==='failed'?' '+trainingFeedback(v.failure):''):v.inputState==='waiting'?entryText('coachWaitHit'):trainingFeedback(v.feedback);
 setText('coachFeedback',detail);$('coachFeedback').dataset.status=status;$('battleCoach').dataset.status=status;
 setText('coachLast',v.damageEvents.lastDamage.toFixed(1)+(v.damageEvents.lastGuard?' · '+entryText('coachGuard'):''));
 setText('coachCombo',v.hits+' HIT / '+v.damage.toFixed(1));setText('coachBest',v.bestHits+' HIT / '+v.bestDamage.toFixed(1));
}
$('coachToggle').onclick=()=>openPanel('trainingDialog');
$('coachReset').onclick=()=>resetLab();$('coachSettings').onclick=()=>openPanel('trainingDialog');
$('coachNext').onclick=()=>{const routes=COMBOS.filter(c=>c.type<0||c.type===selected),index=routes.findIndex(c=>c.id===lab.snapshot().route);$('labRoute').value=routes[(index+1)%routes.length].id;$('labRoute').onchange();};

let labSerial=-1;
function updateLab(force=false){updateCoach(force);if(!force&&!$('trainingDialog').open)return;const v=lab.snapshot(),d=v.damageEvents;setText('labLastDamage',d.lastDamage.toFixed(1));setText('labLastDamageKind',d.lastGuard?'格挡削血':'命中伤害');setText('labComboState',v.active?'连击中':v.hits?'已结束':'待机');setText('labHits',v.hits);setText('labDamage',v.damage.toFixed(1));setText('labBest',v.bestHits);setText('labBestDamage',v.bestDamage.toFixed(1));const p=pbase(0);if(mode==='lab'&&running)setText('battleStatus',v.hits+' HIT · '+v.damage.toFixed(1)+' 伤害 · '+(mobile.touch?entryText('reset'):'R 重置'));setText('labMove',actionLabel(state[p+7])+' · 动作第 '+Math.floor(state[p+8])+' 帧 · '+(state[p+17]?'有待执行输入':'无缓存')+(v.active?' · 连击进行中':''));if(!force&&labSerial===v.serial)return;labSerial=v.serial;$('labDamageLog').replaceChildren();if(!d.count){const li=document.createElement('li');li.className='empty';li.textContent='实际命中后显示伤害。';$('labDamageLog').append(li);}for(let n=0;n<d.count;n++){const z=((d.cursor-1-n+8)%8)*6,r=d.records,li=document.createElement('li'),value=document.createElement('b'),note=document.createElement('span');li.classList.toggle('guard-chip',!!(r[z+5]&1));value.textContent='−'+r[z+1].toFixed(1);note.textContent='#'+r[z]+' · '+((r[z+5]&1)?'格挡削血 · 不计连击':'累计 '+r[z+2].toFixed(1));li.append(value,note);$('labDamageLog').append(li);}const c=COMBOS.find(c=>c.id===v.route);$('labRouteKeys').textContent=controlSequence(c.keys,mobile.touch);$('labFeedback').textContent=trainingFeedback(v.routeStatus==='failed'?v.failure:v.feedback);$('labFeedback').dataset.status=v.routeStatus;$('labSteps').replaceChildren();ROUTE_STEPS[v.route].forEach((act,i)=>{const el=document.createElement('li');el.textContent=act===-1?'跳跃':actionLabel(act);el.className=i<v.routeIndex?'done':i===v.routeIndex?'next':'';$('labSteps').append(el);});$('labInputs').replaceChildren();if(!v.count){const el=document.createElement('li');el.textContent='等待输入…';$('labInputs').append(el);}for(let n=0;n<v.count;n++){const z=((v.cursor-1-n+16)%16)*3,el=document.createElement('li'),frame=document.createElement('small'),key=document.createElement('b');frame.textContent='#'+v.records[z];key.textContent=controlSequence(inputLabel(v.records[z+1]),mobile.touch)+(v.records[z+2]?' ★':'');el.append(frame,key);$('labInputs').append(el);}}
$('labRoute').onchange=()=>{lab.select($('labRoute').value);if(running&&mode==='lab')resetLab();else updateLab(true);};$('labDummy').onchange=()=>{lab.dummy=$('labDummy').value;resetLab();};$('labEnergy').onchange=()=>{lab.infiniteEnergy=$('labEnergy').checked;resetLab();};$('labBoxes').onchange=()=>{lab.showBoxes=$('labBoxes').checked;};for(const [id,key] of [['labDistance','distance'],['labStart','start'],['labHeight','airHeight']])$(id).onchange=()=>{lab[key]=key==='start'?$(id).value:Number($(id).value);resetLab();};$('labReset').onclick=()=>resetLab();$('labClearBest').onclick=()=>resetLab(true);
function setMeter(id,percent){const style=$(id).style;if(mobile.touch){if(style.width!=='100%')style.width='100%';style.transform='scaleX('+percent/100+')';}else{if(style.transform)style.transform='';style.width=percent+'%';}}
let networkPaintAt=0,networkPaintState='';
function updateNetworkHUD(){
 const active=mode==='pvp'&&!!session&&!session.done;
 setHidden('battleLatency',!active);if(!active){networkPaintAt=0;networkPaintState='';return;}
 const now=performance.now(),stale=session.lastReceived&&now-session.lastReceived>3000;
 const status=session.failures||session.networkRecovering?'reconnecting':stale?'waiting':Number.isFinite(session.lastRtt)?'live':'pending';
 const key=status+':'+language();if(key===networkPaintState&&now-networkPaintAt<250)return;
 networkPaintAt=now;networkPaintState=key;
 const rtt=Math.round(session.lastRtt),node=$('battleLatency');
 setText('battleLatency',entryText(status==='live'?'networkPing':status==='reconnecting'?'networkReconnecting':status==='waiting'?'networkWaiting':'networkPending').replace('{ms}',rtt));
 node.title=entryText('networkRttHint');node.dataset.quality=status!=='live'?'waiting':rtt<100?'good':rtt<250?'fair':'slow';
}
function updateHUD(){if(session?.selection)paintOnlineSelection();campaignPanel.update(state,{aiMode:activeCampaignAI,visible:mode==='pve'&&running&&document.body.dataset.view==='battle',level,now:performance.now()});updateNetworkHUD();for(let i=0;i<2;i++){
 const p=pbase(i),hp=Math.max(0,Math.min(MAX_HP,state[p+3])),energy=Math.max(0,Math.min(100,state[p+4])),type=state[p+11]|0,wins=state[4+i],key=hudKeys[i];
 const hud=$('playerHud'+i),hpMeter=$('hpMeter'+i),energyMeter=$('energyMeter'+i);
 if(key.hp!==hp){key.hp=hp;setMeter('hp'+i,hp/MAX_HP*100);setMeter('hpTrail'+i,hp/MAX_HP*100);setText('health'+i,Math.ceil(hp)+' / '+MAX_HP);hud.classList.toggle('low-health',hp<=MAX_HP*.3);hpMeter.setAttribute('aria-valuenow',Math.ceil(hp));}
 if(key.energy!==energy){key.energy=energy;setMeter('energy'+i,energy);}
 const whole=Math.floor(energy),ready=energy>=70;
 if(key.whole!==whole){key.whole=whole;setText('energyValue'+i,whole);energyMeter.setAttribute('aria-valuenow',whole);}
 if(key.ready!==ready){key.ready=ready;setText('energyLabel'+i,ready?(mobile.touch?'必杀就绪':'必杀就绪 · I'):'能量');hud.classList.toggle('super-ready',ready);}
 if(key.type!==type){key.type=type;const name=names[type];hud.dataset.type=type;hpMeter.setAttribute('aria-valuemax',MAX_HP);hpMeter.setAttribute('aria-label',name+'的生命');energyMeter.setAttribute('aria-label',name+'的能量');setText('name'+i,name);}setText('name'+i,mode==='pvp'&&session?.names?.[i]||names[type]);
 if(key.wins!==wins){key.wins=wins;setText('wins'+i,(wins>0?'●':'○')+' '+(wins>1?'●':'○'));}
 }const local=pbase(session?.slot??0);setText('abilityStatus',Math.floor(state[local+4])+' 能量 · '+(state[local+4]>=70?'I 必杀就绪':'大招需要 70 能量')+(state[local+26]>0?' · 反击就绪':'')+(state[local+22]>0?' · 冲刺冷却':'')+(state[local+23]>0?' · 小技能冷却':'')+(elementImbued(state,local)?state[local+11]?' · 冰结太刀 · 本小局':' · 火焰附拳 · 本小局':''));setText('timer',mode==='lab'?'∞':String(Math.ceil(state[2]/60)).padStart(2,'0'));setText('round','ROUND '+String(state[3]).padStart(2,'0'));for(let i=0;i<2;i++){const own=i===(session?.slot??0);setText('tag'+i,(i+1)+'P');}}
function endMatch(){if(finished)return;finished=true;$('resultActions').append($('primary'));running=false;clearCombatInput();const draw=state[7]<0,win=state[7]===(session?.slot??0);if(mode==='pve')monitorEnd(draw?'draw':win?'win':'loss');if(mode==='pve'&&win){cleared=winStage(cleared,level);unlocked=unlockedStage(cleared);saveCampaign(campaignStorage,cleared);levels();}$('overlay').hidden=false;document.querySelector('.start-card h2').innerHTML=mode==='pve'?entryText(draw?'campaignDraw':win?'campaignWin':'campaignLose'):(draw?'势均力敌。':win?'守夜人，胜利。':'火种尚未熄灭。')+'<br><span>'+(win?'下一场，继续前行。':'再来一次。')+'</span>';$('overlayText').textContent=mode==='pve'?entryText(win?(level===STAGE_COUNT?'campaignComplete':level===BASE_STAGES?'campaignBasePass':'campaignPass'):'campaignRetry'):session?.payment&&win?payText('wait'):'服务器已确认本场胜负。';$('primary').disabled=false;$('primary').textContent=entryText(mode==='pve'&&win&&level<STAGE_COUNT?'campaignNext':'campaignBack');$('trainQuick').hidden=true;$('pause').hidden=true;$('battleStatus').textContent=mode==='pve'?entryText(draw?'campaignDraw':win?'campaignWin':'campaignLose'):draw?'对局结束 · 平局':win?'对局结束 · 胜利':'对局结束 · 失败';if(session){session.done=true;clearTimeout(pollTimer);live.close();}unlockControls();}
async function api(body){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),['create','join'].includes(body.action)&&body.walletSession?50000:5000);try{const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});let data;try{data=await r.json();}catch{throw Error('对战服务暂不可用，请稍后再试。');}if(!r.ok)throw Object.assign(Error(text(data.error)||'对战服务暂不可用。'),{status:r.status});return data;}finally{clearTimeout(timeout);}}
async function connect(kind,code=''){if(session||running||connecting||!artLoaded)return false;if(cleanup.pending){notice('上一房间退出尚未确认，请先点击重试退出。');return false;}connecting=true;unlockControls();mobile.sync();void mixer.unlock();const g=++generation;$('primary').disabled=true;notice(entryText('connectingRoom'));try{const data=await api({action:kind,character:selected,code,walletSession:wallet.state.session,...(kind==='create'?{deposit:payments.choice(),selectionVersion:1}:{} )});if(g!==generation){await cleanup.leave(data);return false;}$('roomPrivacy').textContent=entryText('publicRoom');session={code:data.code,token:data.token,slot:data.slot,done:false,names:data.names,payment:data.payment};document.body.dataset.roomActive='true';seq=0;prediction.reset();state.set(data.state);$('ownRoomLabel').textContent=entryText('yourRoom');$('roomBox').hidden=false;$('primary').textContent=entryText('waitingPrimary');$('leave').hidden=false;$('trainQuick').hidden=true;$('connection').textContent=entryText('roomConnected');notice(entryText('roomCreated'));unlockControls();poll(g);payments.room(data.payment);return true;}catch(e){if(g===generation)notice(e.name==='AbortError'?'连接超时，请稍后重试。':e.message);return false;}finally{if(g===generation){connecting=false;unlockControls();void rooms.refresh();}}}
async function poll(g){if(!session||g!==generation||session.done)return;syncCombatInput();const streaming=live.fast;if(streaming)pollTimer=setTimeout(()=>poll(g),running?50:session.selection?150:450);const started=performance.now(),sentEdges=readyInput.filter(state,edgeBits,waitingPractice);edgeBits=0;try{const data=await live.request({action:'input',code:session.code,token:session.token,seq:++seq,mask:safeMask(),edges:sentEdges,...(session.selection?{character:selected,locked:!!session.selectionLocked}:{})});if(!session||g!==generation||session.done)return;if(Number.isSafeInteger(data.ack)&&data.ack<(session.lastAck??-1))return;if(data.names)session.names=data.names;if(data.payment){session.payment=data.payment;if(data.status==='funding'&&!data.selection)payments.room(data.payment);}if(data.selection){session.selection=data.selection;session.selectionClock=data.selection.serverTime-performance.now();showOnlineSelection();}if(data.moved){session.code=data.code;session.slot=data.slot;notice('已匹配到对手。');$('ownRoomLabel').textContent=entryText('yourRoom');}const queued=prediction.queue(data.state,performance.now(),performance.now()-started,session.slot,safeMask(),data.otherMask||0,data.pendingEdges||0);const received=performance.now();if(session.lastReceived)diagnostics.add('arrival',received-session.lastReceived);if(acceptRoomHeartbeat(session,received,received-started))notice('');if(data.status==='waiting'||data.status==='funding')setText('connection',entryText(data.selection?'selectionChoosing':data.status==='funding'?'fundingConnected':'roomConnected'));if(!queued)return;session.lastAck=data.ack;if(!running||data.state[1]===4||document.hidden)flushOnlineState();if(data.status==='playing'||data.status==='finished'){const wasRunning=running;running=data.status==='playing';if(running&&!wasRunning){session.selection=null;session.selectionLocked=false;$('characterSelect').hidden=true;payments.closed();waitingPractice=false;$('warmupBar').hidden=true;}if(running&&!wasRunning){live.open();battleView(true);mixer.begin(state,false,session.slot);notice('');$('arena').focus({preventScroll:true});}setHidden('roomBox',running);setHidden('overlay',running);setHidden('leave',false);if(!session.statusAt||performance.now()-session.statusAt>=250){session.statusAt=performance.now();setText('connection',(live.fast?'实时连接 · ':'HTTP · ')+Math.round(performance.now()-started)+' ms');}setText('battleStatus',entryText('pvpTitle'));}else if(data.status==='cancelled'){const paid=!!session.payment;await exit();return notice(paid?entryText('depositRefundNotice'):entryText('roomCancelled'));}if(data.warning)notice(data.warning);if(data.state[1]===4)endMatch();diagnostics.add('rtt',session.lastRtt);session.serverFrame=data.state[0];session.otherMask=data.otherMask||0;session.failures=0;/* Battle HUD is refreshed once by the frame loop. */}catch(e){if(!session||g!==generation)return;if(streaming&&e.transport){session.networkRecovering=true;if(e.unsent)edgeBits|=sentEdges;setText('connection',entryText('networkFallback'));return;}if(!session.failures)diagnostics.reconnect();session.failures=(session.failures||0)+1;$('connection').textContent=entryText('networkReconnecting');notice(entryText('networkRecoveryNotice'));if(e.status===401||e.status===404||session.failures>=8){await exit();return notice(e.status===401?'房间凭证失效，请重新加入。':'连接恢复失败，请重新进入擂台。');}}finally{if(!streaming&&session&&!session.done&&g===generation)pollTimer=setTimeout(()=>poll(g),Math.max(5,(running?80:session.selection?150:450)-(performance.now()-started)));}}
// Advancing a local stage must not hide or detach the fullscreen arena.
async function primaryAction(){
 if(mode==='pve'&&level>unlocked)return;
 if(finished){
  if(mode==='pve'&&state[7]===0&&level<STAGE_COUNT){level++;chapter=level>BASE_STAGES?1:0;levels();beginTraining();}
  else await exit();
  return;
 }
 if(mode==='pvp'){selectOnline('create');}else requestSelection(()=>{mode==='pve'?beginTraining():beginLab();});
}
async function exit(){monitorEnd('exit');payments.closed();document.body.dataset.roomActive='false';waitingPractice=false;$('warmupBar').hidden=true;readyInput.reset();cancelSelection();const old=session;++generation;connecting=false;clearTimeout(pollTimer);live.close();session=null;running=false;paused=false;finished=false;clearCombatInput();mobile.unlock();menu();notice('');if(old&&!old.done){const confirmed=await cleanup.leave(old);if(!confirmed)notice('已停止本地操作，服务器退出尚未确认，请点击重试退出。');}if(mode==='pvp')void rooms.refresh();}

function safeMask(){syncCombatInput();if(panels.open||mobile.portrait||!readyInput.filter(state,1,waitingPractice))return 0;let m=(mask&3)===3?mask&~3:mask;if(m&8&&!(m&(4|16|32|64|256|512|1024|2048)))m|=128;return m;}

const keys={KeyA:1,ArrowLeft:1,KeyD:2,ArrowRight:2,KeyW:4096,ArrowUp:4,KeyS:8,ArrowDown:8,KeyJ:16,KeyK:4,KeyL:512,KeyI:2048,KeyF:128,KeyE:64,KeyU:256,ShiftLeft:512,ShiftRight:512,KeyO:1024,KeyH:32};
addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||panels.open)return;if(e.code==='Escape'){e.preventDefault();openPanel('gameMenu');return;}if((!running&&!waitingPractice)||paused||mobile.portrait)return;if(e.code==='KeyR'&&mode==='lab'&&running){e.preventDefault();resetLab();return;}if(keys[e.code]){e.preventDefault();if(e.repeat)return;inputs.set('keyboard:'+e.code,keys[e.code]);}});addEventListener('keyup',e=>{if(keys[e.code]){inputs.set('keyboard:'+e.code,0);if(!(e.target instanceof HTMLInputElement))e.preventDefault();}});addEventListener('blur',()=>{mixer.activity(false,true);clearCombatInput();if(mode!=='pvp'&&running&&!paused)togglePause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){mixer.activity(false,true);clearCombatInput();if(mode!=='pvp'&&running&&!paused)togglePause();}last=performance.now();acc=0;});
touchControls=bindTouchControls($('touch'),{input:inputs,enabled:()=>(running||waitingPractice)&&!paused&&!panels.open&&!mobile.portrait});
const touchPreferences=makeTouchPreferences({onChange:layout=>{clearCombatInput();$('settingsTouchLabel').textContent=layout==='simple'?'标准尺寸 · 全部招式':'加大尺寸 · 全部招式';$('touchLayoutLabel').textContent=layout==='simple'?'标准 · 点击切换加大':'加大 · 点击切换标准';$('touchLayoutButton').setAttribute('aria-pressed',String(layout==='full'));}});
$('touchLayoutButton').onclick=()=>touchPreferences.toggle();
$('rotateStart').onclick=toggleFullscreen;$('rotateContinue').onclick=()=>mobile.continuePortrait();$('rotateMenu').onclick=()=>openPanel('gameMenu');
$('trainingMenuButton').onclick=()=>openPanel('trainingDialog');$('trainingClose').onclick=()=>panels.close($('trainingDialog'));
$('trainingDialog').addEventListener('close',()=>{$('battleView').append($('labWorkbench'));});
function resumeFromScreen(){if(!running||mode==='pvp'||!paused)return;if($('gameMenu').open)panels.close($('gameMenu'),true);else if(!panels.open)togglePause();}
document.querySelector('.screen').addEventListener('click',e=>{if(!e.target.closest('button'))resumeFromScreen();});
$('gameMenu').addEventListener('click',e=>{if(e.target!==$('gameMenu'))return;const r=$('gameMenu').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)resumeFromScreen();});
function togglePause(){if(mode==='pvp'||!running)return;paused=!paused;clearCombatInput();acc=0;mixer.activity(running&&!paused,document.hidden);if(!paused)void mixer.unlock();$('pause').textContent=paused?'继续':'暂停';document.querySelector('.screen').dataset.paused=String(paused);$('announcement').textContent=paused?'已暂停 · 点击画面继续':'';}
function flushOnlineState(){const began=performance.now();if(prediction.flush(state)){mixer.observe(state);diagnostics.add('reconcile',performance.now()-began);}}
const showcase=makeComboShowcase(),demoRenderer=makeRenderer($('demoCanvas'),{showcase:true});
const demoWide=matchMedia('(orientation:landscape), (min-width:1000px) and (any-pointer:fine)');
const roomHome=$('roomHall').parentElement;
let demoPaused=matchMedia('(prefers-reduced-motion:reduce)').matches,demoAcc=0,demoDraw=0,demoSerial='';
function arrangeShowcase(){
 const wide=demoWide.matches;demoDraw=0;document.body.dataset.showcase=String(wide);
 if(wide)$('lobbyShowcase').before($('roomHall'));else roomHome.append($('roomHall'));
}
demoWide.addEventListener('change',arrangeShowcase);addEventListener('resize',invalidateShowcase);arrangeShowcase();
function invalidateShowcase(){demoDraw=0;}
function updateShowcase(){
 const v=showcase.snapshot(),key=[v.scene,v.routeIndex,v.routeStatus,v.hits,demoPaused,language(),mobile.touch].join(':');
 if(demoSerial===key)return;demoSerial=key;
 const combo=COMBOS.find(c=>c.id===v.route);$('lobbyDemo').dataset.scene=String(v.scene);$('lobbyDemo').dataset.status=v.routeStatus;
 $('demoFighter').textContent=entryText(v.fighter?'demoShuang':'demoJin');$('demoRoute').textContent=entryText('route_'+v.route);
 $('demoPlatform').textContent=entryText(mobile.touch?'demoTouch':'demoKeys');$('demoPause').textContent=entryText(demoPaused?'demoPlay':'demoPause');$('demoPause').setAttribute('aria-pressed',String(demoPaused));
 $('demoSteps').replaceChildren(...combo.keys.split(' → ').map((key,i)=>{const el=document.createElement('li');if(mobile.touch)el.textContent=controlSequence(key,true);else{const code=document.createElement('kbd'),action=document.createElement('small');code.textContent=key;action.textContent=key==='W＋J'?entryText('demoLauncher'):controlSequence(key,true);el.append(code,action);}el.className=i<v.routeIndex?'done':i===v.routeIndex?'next':'';return el;}));
 $('demoHit').textContent=demoPaused?entryText('demoPaused'):v.routeStatus==='success'?entryText('demoComplete')+' · '+entryText('demoHits').replace('{n}',v.hits):v.hits?entryText('demoHits').replace('{n}',v.hits):entryText('demoReady');
 $('demoHint').textContent=entryText('demoHint');
}
$('demoMusic').onclick=()=>{if(!mixer.ready){if(!mixer.settings.enabled)mixer.set('enabled',true);if(!mixer.settings.music)mixer.set('music',35);void mixer.unlock();}else mixer.set('music',mixer.settings.music?0:35);};
// Unlock inside a real gesture; silent settings and a hidden page remain respected.
// Audio mixer owns gesture and wallet-return recovery for all game modes.
$('demoPause').onclick=()=>{demoPaused=!demoPaused;updateShowcase();};
$('demoNext').onclick=()=>{showcase.next();demoAcc=0;updateShowcase();demoRenderer.draw(showcase.state,performance.now(),false,showcase.damageEvents,0,'lab');};
function tickShowcase(t,delta){
 if(document.hidden||document.body.dataset.view!=='lobby'||!demoWide.matches||panels.open){demoAcc=0;return;}
 if(!demoPaused){demoAcc+=delta*.65;while(demoAcc>=1000/60){showcase.tick();demoAcc-=1000/60;}}
 if((!demoPaused||!demoDraw)&&t-demoDraw>=1000/30){demoDraw=t;demoRenderer.draw(showcase.state,showcase.state[0]*1000/60,false,showcase.damageEvents,0,'lab');updateShowcase();}
}
function frame(t){if(mode==='pvp'&&session)flushOnlineState();if(running&&!document.hidden&&last)diagnostics.add('frame',t-last);touchControls?.tick(t);const delta=Math.min(100,t-last||0);last=t;tickShowcase(t,delta);const portraitPause=mode!=='pvp'&&mobile.portrait;
 syncCombatInput();const demoMusic=!demoPaused&&document.body.dataset.view==='lobby'&&demoWide.matches&&!panels.open;if(demoMusic)mixer.demo(showcase.snapshot().fighter);mixer.activity((running&&!paused&&!portraitPause)||demoMusic,document.hidden);
 if(running&&!paused&&!portraitPause){const simulationStarted=performance.now();acc+=delta;let n=0;while(acc>=1000/60&&n++<6){const m=safeMask();if(mode==='lab'){lab.tick(state,m|(edgeBits&ACTION_MASK));edgeBits=0;}else if(mode==='pve'){step(state,m|(edgeBits&ACTION_MASK),campaignInput(state,level,{mode:activeCampaignAI,trace:true}));edgeBits=0;}else if(session&&prediction.canStep(state,t)){prediction.tick(state,m|predictionEdges,session.slot,session.otherMask||0);predictionEdges=0;}mixer.observe(state,mode==='lab'?lab.damageEvents:null);acc-=1000/60;}if(state[1]===4&&mode==='pve')endMatch();diagnostics.add('simulation',performance.now()-simulationStarted);}
 if(document.body.dataset.view==='battle'&&drawBudget.ready(t,document.hidden)){const renderStarted=performance.now();renderer.draw(mode==='pvp'&&session?prediction.drawState(state,t):state,t,mode==='lab'&&lab.showBoxes&&running,mode==='lab'&&running?lab.damageEvents:null,session?.slot??0,mode);diagnostics.add('render',performance.now()-renderStarted);if(lastDraw&&t-lastDraw<1000)diagnostics.add('draw',t-lastDraw);lastDraw=t;}else if(document.hidden||document.body.dataset.view!=='battle')lastDraw=0;
 if(!document.hidden&&document.body.dataset.view==='battle'&&Math.floor(t/50)!==Math.floor((t-delta)/50)){updateHUD();if(mode==='lab')updateLab();if(!paused)setText('announcement',waitingPractice?text('waiting'):state[1]===1?text('ready')+' · '+Math.max(1,Math.ceil(state[6]/60)):state[1]===3?(state[7]<0?'DRAW':state[7]===(session?.slot??0)?'ROUND WON':'ROUND LOST'):mode!=='lab'&&state[1]===2&&state[2]>3560?'FIGHT':'');}requestAnimationFrame(frame);}

document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));document.querySelectorAll('[data-fighter]').forEach(b=>b.onclick=()=>character(+b.dataset.fighter));$('primary').onclick=primaryAction;$('trainQuick').onclick=()=>setMode('pve');$('match').onclick=()=>selectOnline('match');$('leave').onclick=async()=>{await exit();$('primary').focus({preventScroll:true});};$('pause').onclick=togglePause;$('sound').onclick=()=>{mixer.set('enabled',!mixer.settings.enabled);if(mixer.settings.enabled)void mixer.unlock();};$('audioBtn').onclick=()=>openPanel('audioSettings');$('audioClose').onclick=()=>panels.close($('audioSettings'));$('audioEnabled').onchange=()=>{mixer.set('enabled',$('audioEnabled').checked);if(mixer.settings.enabled)void mixer.unlock();};for(const key of ['music','sfx'])$(key+'Volume').oninput=()=>{mixer.set(key,+$(key+'Volume').value);if(mixer.settings.enabled)void mixer.unlock();};document.querySelectorAll('[data-audio-preview]').forEach(b=>b.onclick=()=>{void mixer.preview(b.dataset.audioPreview,b.dataset.audioImpact===undefined?(+b.dataset.audioType||0):selected,b.dataset.audioImpact===undefined?null:+b.dataset.audioImpact);});addEventListener('pagehide',e=>{mixer.activity(false,true);});$('helpBtn').onclick=()=>openPanel('help');$('helpClose').onclick=()=>panels.close($('help'));$('fullscreen').onclick=toggleFullscreen;
addEventListener('focus',()=>{if(running&&paused&&mode!=='pvp'&&!panels.open)openPanel('gameMenu');});
const diagnostics=makeDiagnostics();
const viewport=makeViewport({onRecover:()=>{clearCombatInput();mobile.sync();}});
let tabStorage;try{tabStorage=sessionStorage;}catch{}
const cleanup=makeRoomCleanup({api,storage:tabStorage,onChange:n=>{$('retryLeave').hidden=!n;}});
if(cleanup.pending)void cleanup.flush();
async function authApi(body){const r=await fetch('./api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});let data;try{data=await r.json();}catch{throw Error('network');}if(!r.ok)throw Object.assign(Error(data.error||'network'),{status:r.status});return data;}
let walletPhase='idle',walletIntent=null;
function requestWallet(intent={purpose:'deposit'}){walletIntent=intent;$('walletPurpose').hidden=intent.purpose!=='deposit';$('walletPurpose').textContent=entryText('depositWallet');$('walletFree').hidden=intent.purpose!=='deposit';$('walletClose').hidden=intent.purpose==='deposit';openPanel('walletDialog');void wallet.prepare().catch(()=>{});}
function dismissWallet(){walletIntent=null;panels.close($('walletDialog'));}

let walletStorage;try{walletStorage=localStorage;if(!walletStorage.getItem('ember-xlayer-login')&&tabStorage?.getItem('ember-xlayer-login'))walletStorage.setItem('ember-xlayer-login',tabStorage.getItem('ember-xlayer-login'));tabStorage?.removeItem('ember-xlayer-login');}catch{}
const wallet=makeOKXConnection({storage:walletStorage,api:authApi,onChange:s=>{
 const signedIn=s.phase==='connected'&&walletPhase!=='connected';walletPhase=s.phase;
 document.body.dataset.walletPhase=s.phase;document.body.dataset.walletHandoff=String(s.handoff);$('walletStatus').textContent=s.message;$('walletStatus').hidden=s.phase==='idle'&&s.message===text('idle');$('walletAddress').textContent=s.address;$('walletChain').textContent=s.chain?'X Layer · OKB':'';
 const busy=['loading','connecting','switching','signing','verifying'].includes(s.phase);
 $('walletConnect').disabled=busy&&!s.handoff;$('walletConnect').textContent=s.handoff?entryText(s.phase==='connecting'?'walletOpenConnect':'walletOpenSign'):busy?entryText('walletSending'):text(s.phase==='connected'?'returnGame':'connect');$('walletDisconnect').hidden=!s.session;
 $('walletReopen').hidden=true;$('paymentReopen').disabled=s.mobile&&!s.handoff;
 for(const id of ['topWallet','lobbyWallet'])$(id).textContent=s.phase==='connected'?(s.nickname?s.nickname+' · ':'')+s.address.slice(0,6)+'…'+s.address.slice(-4):text('walletLabel');
 $('editNickname').hidden=!s.session;$('editNickname').textContent=payText('nickname');
 if(signedIn&&$('walletDialog').open){const intent=walletIntent;dismissWallet();if(!s.nickname)queueMicrotask(()=>requestNickname(intent?.action));else if(intent?.action)queueMicrotask(()=>{if(mode==='pvp'&&!running&&!session)void selectOnline(...intent.action);});}
 if(signedIn&&!s.nickname&&!$('walletDialog').open)queueMicrotask(()=>{if(!$('nicknameDialog').open)requestNickname();});
 }});
let nicknameIntent=null;
function requestNickname(action=null){nicknameIntent=action;$('nicknameInput').value=wallet.state.nickname||'';$('nicknameError').textContent='';panels.show($('nicknameDialog'));}
$('nicknameDialog').addEventListener('cancel',()=>{nicknameIntent=null;});
$('editNickname').onclick=()=>requestNickname();$('nicknameClose').onclick=()=>{nicknameIntent=null;panels.close($('nicknameDialog'));};$('nicknameForm').onsubmit=async e=>{e.preventDefault();$('nicknameSave').disabled=true;try{await wallet.setNickname($('nicknameInput').value);$('nicknameInput').blur();const action=nicknameIntent;nicknameIntent=null;panels.close($('nicknameDialog'));if(action)void selectOnline(...action);}catch(err){$('nicknameError').textContent=payText(err.message);}finally{$('nicknameSave').disabled=false;}};
$('walletTitle').textContent=text('walletTitle');$('walletIntro').textContent=isMobile(window)?text('walletGuide'):entryText('walletDesktopGuide');$('walletMobileHint').textContent=text('mobileHint');$('walletReturn').textContent=text('appReturn');
$('walletMobileHint').hidden=$('walletReturn').hidden=!isMobile(window)||wallet.injected;
$('walletDisconnect').textContent=text('disconnect');$('walletConnect').textContent=text('connect');$('walletReopen').textContent=text('openWallet');$('walletClose').textContent=entryText('walletDismiss');
for(const id of ['topWallet','lobbyWallet'])$(id).textContent=text('walletLabel');
for(const id of ['topWallet','lobbyWallet'])$(id).onclick=()=>requestWallet({purpose:'optional'});
$('walletClose').onclick=dismissWallet;$('walletFree').textContent=entryText('returnFree');$('walletFree').onclick=()=>{wallet.cancelLogin();dismissWallet();payments.free();};$('walletDialog').addEventListener('cancel',()=>{if(walletIntent?.purpose==='deposit'){wallet.cancelLogin();payments.free();}walletIntent=null;});$('walletConnect').onclick=()=>wallet.state.handoff?wallet.reopen():wallet.state.phase==='connected'?dismissWallet():wallet.connect();$('walletReopen').onclick=()=>wallet.reopen();$('walletDisconnect').onclick=()=>wallet.disconnect();
addEventListener('focus',()=>{void wallet.restore();});addEventListener('pageshow',()=>{void wallet.restore();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)void wallet.restore();});
void wallet.restore();
const payments=makePayments({wallet,panels,currentRoom:()=>session,leave:exit,onWalletRequired:(purpose='deposit')=>requestWallet({purpose})});
const experience=makeExperience({storage:tabStorage,panels,wallet,mobileLayout:mobile,onHome:showHome});
$('waitingPractice').textContent=text('trial');$('warmupLeave').textContent=text('back');
$('waitingPractice').onclick=()=>{if(!session||running)return;waitingPractice=true;battleView(true);$('overlay').hidden=true;$('warmupBar').hidden=false;$('warmupLabel').textContent=text('waiting');clearCombatInput();};
$('warmupLeave').onclick=()=>{waitingPractice=false;clearCombatInput();battleView(false);$('roomBox').hidden=false;$('warmupBar').hidden=true;};
addEventListener('online',()=>{void cleanup.flush();if(mode==='pvp')void rooms.refresh();});
addEventListener('pagehide',e=>{clearCombatInput();if(!e.persisted&&!wallet.state.handoff){viewport.dispose();experience.dispose();wallet.dispose();renderer.dispose?.();demoRenderer.dispose();demoWide.removeEventListener('change',arrangeShowcase);removeEventListener('resize',invalidateShowcase);}});
let exitTarget='exit';
function showHome(){cancelSelection();setMode('pve');$('exitScreen').hidden=true;rooms.invalidate();if(!mobile.touch)document.querySelector('.brand').focus({preventScroll:true});}
function askExit(target){exitTarget=target;$('exitTitle').textContent=target==='home'?'返回主界面？':'退出游戏？';$('exitMessage').textContent=mode==='pvp'&&(running||session)?'当前在线对局将退出，进行中的对局会判负。':running?'当前练习将结束，已解锁关卡会保留。':'返回时可以重新选择模式。';panels.show($('exitDialog'));}
let fullscreenChanging=false;
async function toggleFullscreen(){
 if(fullscreenChanging)return;fullscreenChanging=true;
 try{
  // A modal left below a new fullscreen top-layer entry can keep the page inert.
  // Close it synchronously, preserving the user gesture for requestFullscreen.
  panels.closeAll();clearCombatInput();acc=0;
  if(document.fullscreenElement){try{await document.exitFullscreen();mobile.unlock();}catch{notice('无法退出全屏，请使用浏览器的退出全屏操作。');}}
  else if(!await mobile.enter())notice('当前浏览器不支持全屏，可继续在窗口中游玩。');
 }finally{fullscreenChanging=false;syncDisplay();}
}
function syncDisplay(){const full=!!document.fullscreenElement;$('displayState').textContent=full?'全屏模式':'窗口模式';$('settingsFullscreen').textContent=full?'退出全屏':'开启全屏';$('fullscreenLabel').textContent=full?'返回窗口模式':'手动开启全屏';}
document.addEventListener('fullscreenchange',syncDisplay);syncDisplay();
for(const b of document.querySelectorAll('[data-home-mode]'))b.onclick=()=>setMode(b.dataset.homeMode);

$('homeSettings').onclick=$('settingsBtn').onclick=()=>openPanel('settingsDialog');
$('settingsClose').onclick=()=>panels.close($('settingsDialog'));$('settingsFullscreen').onclick=toggleFullscreen;
$('settingsAudio').onclick=()=>openPanel('audioSettings');$('settingsTouch').onclick=()=>touchPreferences.toggle();$('settingsCombos').onclick=()=>openPanel('comboDialog');
$('homeQuit').onclick=$('quitBtn').onclick=()=>askExit('exit');$('menuHome').onclick=()=>running||session||connecting?askExit('home'):showHome();
$('backHome').onclick=async()=>{await exit();showHome();};$('cancelConnect').onclick=()=>exit();$('waitingLeave').onclick=()=>exit();
$('retryLeave').onclick=async()=>{const ok=await cleanup.flush();notice(ok?'已确认退出房间。':'仍无法连接服务器，请恢复网络后重试。');};
$('exitCancel').onclick=()=>panels.close($('exitDialog'));
$('exitConfirm').onclick=async()=>{const target=exitTarget;$('exitConfirm').disabled=true;await exit();if(target==='home')showHome();else{document.body.dataset.view='exit';$('home').hidden=$('lobby').hidden=$('battleView').hidden=true;$('exitScreen').hidden=false;mobile.sync();mixer.activity(false,true);if(document.fullscreenElement)try{await document.exitFullscreen();}catch{}}$('exitConfirm').disabled=false;};
$('returnGame').onclick=showHome;
// Selection is explicit; READY/FIGHT remains part of the unchanged match rules.
let selectionJob=null;
function showOnlineSelection(){
 $('characterSelect').dataset.online='true';
 const entering=document.body.dataset.view!=='select';
 if(entering){payments.closed();panels.reset();waitingPractice=false;$('warmupBar').hidden=true;clearCombatInput();selected=session.selection.characters[session.slot];}
 document.body.dataset.view='select';$('lobby').hidden=$('home').hidden=$('battleView').hidden=true;$('characterSelect').hidden=false;
 $('opponentChoice').hidden=true;$('selectTitle').textContent=entryText('selectFighter');$('cancelSelection').textContent=entryText(session.payment?'leaveSelection':'leaveFreeSelection');
 paintOnlineSelection();mobile.sync();
}
// Local seat always stays left; the remote seat is display-only, even for player 2.
function paintSelectionSides(){
 const v=session?.selection,other=v?1-session.slot:1;
 const locked=!!(v&&(session.selectionLocked||v.locked[session.slot]));
 const remote=v?v.characters[other]:opponent;
 $('rivalLabel').textContent=entryText(v?'selectionOpponent':mode==='lab'?'selectDummy':'selectionCPU');
 $('selfPlayer').textContent=v?(session.names?.[session.slot]||''):'';
 $('rivalPlayer').textContent=v?(session.names?.[other]||''):'';
 $('selfSelectionStatus').textContent=entryText(locked?'selectionLocked':'selectionChoosing');
 $('rivalSelectionStatus').textContent=entryText(v?(v.locked[other]?'selectionLocked':'selectionChoosing'):'selectionAIChoice');
 $('opponentChoice').hidden=!!v;
 for(const [seat,n,dir] of [['self',selected,1],['rival',remote,-1]]){
  $(seat+'Fighter').textContent=entryText(n?'fighterShuang':'fighterJin');
  $(seat+'Style').textContent=entryText(n?'fighterShuangStyle':'fighterJinStyle');
  const canvas=$(seat+'Portrait');
  if(artLoaded&&canvas.dataset.hero!==String(n)){
   const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,96,112);ctx.imageSmoothingEnabled=false;ctx.scale(1.5,1.5);fighter(ctx,dir>0?28:36,68,n,dir);canvas.dataset.hero=String(n);
  }
 }
 for(const b of document.querySelectorAll('[data-fighter]')){const active=+b.dataset.fighter===selected;b.disabled=locked;b.setAttribute('aria-pressed',String(active));b.classList.toggle('selected',active);}
 for(const b of document.querySelectorAll('[data-opponent]'))b.setAttribute('aria-pressed',String(+b.dataset.opponent===opponent));
}
function paintOnlineSelection(){
 const v=session?.selection;if(!v)return;
 const seconds=Math.max(0,Math.ceil((v.until-(performance.now()+session.selectionClock))/1000));
 $('selectMode').textContent=entryText('selectionCountdown').replace('{s}',seconds);
 paintSelectionSides();
 const locked=session.selectionLocked||v.locked[session.slot];
 $('confirmSelection').disabled=!!locked;$('confirmSelection').textContent=entryText(locked?'selectionLocked':'confirmFighter');
}
function requestSelection(action){
 delete $('characterSelect').dataset.online;
 if(!artLoaded||running||session||connecting||selectionJob)return Promise.resolve(false);
 clearCombatInput();panels.reset();rooms.invalidate();
 document.body.dataset.view='select';$('lobby').hidden=true;$('home').hidden=true;$('characterSelect').hidden=false;
 paintSelectionSides();$('selectTitle').textContent=entryText('selectFighter');$('cancelSelection').textContent=entryText('backSetup');
 $('selectMode').textContent=mode==='pve'?entryText('stageNumber').replace('{n}',level):entryText(mode==='lab'?'training':'pvpTab');
 $('confirmSelection').textContent=entryText('confirmFighter');$('confirmSelection').disabled=false;window.scrollTo?.({top:0,left:0,behavior:'instant'});mobile.sync();$('confirmSelection').focus({preventScroll:true});
 return new Promise(resolve=>{selectionJob={action,resolve};});
}
function cancelSelection(){$('characterSelect').hidden=true;if(!selectionJob)return;const job=selectionJob;selectionJob=null;$('characterSelect').hidden=true;job.resolve(false);}
function confirmSelection(){
 if(session?.selection){session.selectionLocked=true;paintOnlineSelection();return;}
 if(!selectionJob||document.hidden||panels.open||document.body.dataset.view!=='select')return;
 $('confirmSelection').disabled=true;
 const job=selectionJob;selectionJob=null;$('characterSelect').hidden=true;document.body.dataset.view='lobby';$('lobby').hidden=false;
 Promise.resolve().then(job.action).then(job.resolve,error=>{notice(error.message);job.resolve(false);});
}
function selectOnline(kind,code='',deposit){
 try{if(deposit===undefined)deposit=kind==='create'&&!!payments.choice();}catch(e){notice(payText(e.message));return Promise.resolve(false);}
 if(deposit&&wallet.state.phase!=='connected'){requestWallet({purpose:'deposit',action:[kind,code,true]});return Promise.resolve(false);}
 if(deposit&&!wallet.state.nickname){requestNickname([kind,code,true]);return Promise.resolve(false);}
 if(kind==='create'&&!payments.enabled){notice(payText('ESCROW_UNAVAILABLE'));return Promise.resolve(false);}
 return connect(kind,code);
}
$('confirmSelection').onclick=confirmSelection;
$('cancelSelection').onclick=()=>{if(session?.selection){void exit();return;}cancelSelection();document.body.dataset.view='lobby';menu();};
for(const b of document.querySelectorAll('[data-opponent]'))b.onclick=()=>{if(session)return;opponent=+b.dataset.opponent;paintSelectionSides();};
// Preserve multi-touch combat input while blocking native pinch/double-tap zoom.
const preventGesture=e=>{if(e.cancelable)e.preventDefault();};
for(const type of ['gesturestart','gesturechange','gestureend','dblclick'])document.addEventListener(type,preventGesture,{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1)preventGesture(e);},{passive:false});
updateAudioUI();character(0);setMode(['pvp','lab'].includes(new URL(location.href).searchParams.get('mode'))?new URL(location.href).searchParams.get('mode'):'pve');Promise.all([artReady,stageReady]).then(()=>{artLoaded=true;paintSelectionSides();unlockControls();$('connection').textContent='准备就绪';updateShowcase();demoRenderer.draw(showcase.state,0,false,showcase.damageEvents,0,'lab');delete document.body.dataset.boot;requestAnimationFrame(frame);}).catch(e=>{notice(e.message);$('connection').textContent='资源加载失败';$('primary').disabled=true;document.querySelector('#bootScreen p').textContent=entryText('bootFailed');});
if(document.modelContext?.registerTool){const controller=new AbortController();const tools=[{name:'read_arena_status',description:'读取当前擂台模式、训练关卡及房间状态。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({mode,level,running,room:session?.code??null})},{name:'start_training',description:'选择已解锁关卡并开始本地 AI 训练。',inputSchema:{type:'object',properties:{level:{type:'integer',minimum:1,maximum:STAGE_COUNT}},required:['level'],additionalProperties:false},execute:input=>{if(!Number.isInteger(input.level)||input.level<1||input.level>unlocked)throw Error('关卡未解锁');if(running||session)throw Error('请先退出当前对局');level=input.level;chapter=level>BASE_STAGES?1:0;setMode('pve');beginTraining();return {mode,level,running};}}];for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{}addEventListener('pagehide',()=>controller.abort(),{once:true});}


function refreshControlCopy(){
 const touch=mobile.touch,suffix=touch?'Touch':'Keys';
 $('controlHelpTitle').textContent=entryText('helpTitle');$('controlHelpBody').replaceChildren();
 for(const key of ['helpMove'+suffix,'helpAttack'+suffix,'helpCombo'+suffix,'helpCombat','helpMenu']){const p=document.createElement('p');p.textContent=entryText(key);$('controlHelpBody').append(p);}
 $('helpCombos').textContent=entryText('combos');
 document.querySelector('.combo-note').textContent=entryText('comboNote'+suffix);
 document.querySelector('.air-moves>span:not([id])').textContent=controlSequence(entryText('airKeys'),touch);
 $('labReset').textContent=entryText('reset')+(touch?'':' / R');
 for(const button of document.querySelectorAll('#touch [data-key]')){const codes={16:'J',32:'H',4:'K',512:'L',256:'U',1024:'O',64:'E',2048:'I'},label=controlSequence(codes[button.dataset.key],true);(button.querySelector('b')||button).textContent=label;button.setAttribute('aria-label',label);}
 comboTable();
}
$('helpCombos').onclick=()=>openPanel('comboDialog');
for(const el of document.querySelectorAll('[data-entry]'))el.textContent=entryText(el.dataset.entry);
$('roomBox').querySelector('span').textContent=entryText('waitingTitle');$('waitingLeave').textContent=entryText('leaveRoom');
document.querySelector('.stick-hint').textContent=entryText('pocketHint');
for(const [id,key]of [['homeSettings','settings'],['homeQuit','quit']])$(id).textContent=entryText(key);
refreshControlCopy();
