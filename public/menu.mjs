// Dialog navigation clears held combat input. Only local games may be paused.
export function makeMenuPanels({dialogs,localGame,isPaused,togglePause,clearInput,focusArena,getFocus=()=>null,closeLabel=()=>'关闭窗口'}){
 let resume=false,switching=false,returnFocus=null;
 const anyOpen=()=>dialogs.some(d=>d.open);
 function settled(){if(switching||anyOpen())return;clearInput();if(resume&&localGame()&&isPaused())togglePause();resume=false;const target=returnFocus;returnFocus=null;if(target?.isConnected&&!target.closest('[hidden]'))target.focus({preventScroll:true});else focusArena();}
 for(const d of dialogs){
  d.addEventListener('close',settled);
  const button=d.querySelector('button.close')||d.ownerDocument.createElement('button');
  button.type='button';button.classList.add('dialog-x');button.textContent='×';button.setAttribute('aria-label',closeLabel());
  if(!button.parentNode)d.prepend(button);
  // Use the same cancel path as Escape, including guide acknowledgement and wallet cleanup.
  button.onclick=()=>{const event=new Event('cancel',{cancelable:true});if(d.dispatchEvent(event)&&d.open)d.close();};
 }
 return {get open(){return anyOpen();},
  show(dialog){clearInput();if(!anyOpen()){returnFocus=getFocus();if(localGame()&&!isPaused()){togglePause();resume=true;}}switching=true;try{for(const d of dialogs)if(d!==dialog&&d.open)d.close();if(!dialog.open)dialog.showModal();}finally{switching=false;}},
  close(dialog,continueGame=false){if(continueGame&&localGame()&&isPaused())resume=true;if(dialog.open)dialog.close();settled();},
  closeAll(){switching=true;try{for(const d of dialogs)if(d.open)d.close();}finally{switching=false;}settled();},
  reset(){resume=false;returnFocus=null;switching=true;try{for(const d of dialogs)if(d.open)d.close();}finally{switching=false;}clearInput();}
 };
}
