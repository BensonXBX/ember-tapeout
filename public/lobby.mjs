import {DEPOSIT_ROOMS_ENABLED} from './feature-policy.mjs?v=d17988207a17ee19';
import {amount,payText} from './payments.mjs?v=d865c5cbd284ae8f';
import {entryText} from './experience-text.mjs?v=06fc8452cd83ba41';
export function makeRoomLobby({api,connect,available,currentRoom=()=>'',document:doc=globalThis.document,window:win=globalThis.window}){
 const $=id=>doc.getElementById(id);let busy=false,request=0;const invalidate=()=>{request++;busy=false;$('refreshRooms').disabled=false;};
 async function refresh(){if(busy||!available())return;busy=true;const current=++request;$('refreshRooms').disabled=true;
  try{const {rooms}=await api({action:'list'});if(current!==request||!available())return;$('roomList').replaceChildren();
   $('roomListStatus').textContent=rooms.length?entryText('roomCount').replace('{n}',rooms.length):entryText('emptyRooms');
   for(const room of rooms){const row=doc.createElement('li');row.className='room-row';const detail=doc.createElement('div'),title=doc.createElement('b'),note=doc.createElement('small'),button=doc.createElement('button');const own=room.code===currentRoom();row.classList.toggle('own-room',own);title.textContent=own?entryText('yourRoom'):entryText('playerRoom').replace('{n}',room.hostName||(room.hostCharacter?'霜':'烬'));note.textContent=(room.stake?amount(room.stake,room.asset)+' '+(room.asset===0?'OKB':'BEM')+' · ':'')+(room.hostCharacter?'霜':'烬')+' · '+room.players+'/2 · '+entryText(room.status==='funding'?'fundingRoom':room.status==='playing'?'playingRoom':'waitingRoom');detail.append(title,note);button.className='text-btn';button.textContent=entryText(own?'yourRoom':room.status==='funding'?'fundingRoom':room.status==='playing'?'playingRoom':'join');if(room.stake&&!DEPOSIT_ROOMS_ENABLED)button.textContent=payText('DEPOSITS_UNAVAILABLE');button.disabled=!!room.stake&&!DEPOSIT_ROOMS_ENABLED||own||!!currentRoom()||room.status!=='waiting';button.setAttribute('aria-label',`${button.textContent} ${title.textContent}`);button.onclick=()=>connect('join',room.code,!!room.stake);row.append(detail,button);$('roomList').append(row);}
  }catch(error){if(current!==request||!available())return;$('roomListStatus').textContent=entryText('roomsOffline');}finally{if(current===request){busy=false;$('refreshRooms').disabled=false;}}
 }
 $('refreshRooms').onclick=refresh;
 const timer=win.setInterval(()=>{if(!doc.hidden)void refresh();},5000);win.addEventListener('pagehide',event=>{if(!event.persisted&&doc.body?.dataset.walletHandoff!=='true'){win.clearInterval(timer);request++;}});
 return {refresh,invalidate};
}
