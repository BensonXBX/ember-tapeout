// Original themes; reference the rhythm-first approach, never existing SF6 notes.
const roots=[new Uint8Array([38,34,41,36]),new Uint8Array([42,38,45,40])];
const thirds=new Uint8Array([3,4,4,4]);
const motifs=[new Int8Array([74,-1,-1,77,-1,79,-1,81,-1,-1,79,-1,77,-1,74,72,69,-1,72,-1,-1,74,-1,77,-1,79,77,-1,74,-1,72,-1]),new Int8Array([78,-1,81,-1,83,81,-1,78,-1,85,-1,83,81,-1,78,-1,81,-1,-1,85,88,-1,85,-1,83,81,-1,78,-1,76,78,-1])];
const bassRhythm=new Uint8Array([0,3,6,8,11,14]),kickRhythm=new Uint8Array([0,6,9,14]);
export const MUSIC_BYTES=roots.reduce((n,a)=>n+a.byteLength,0)+thirds.byteLength+motifs.reduce((n,a)=>n+a.byteLength,0)+bassRhythm.byteLength+kickRhythm.byteLength;
export const MUSIC_THEMES=Object.freeze([{name:'赤焰破阵',bpm:104},{name:'霜月跃动',bpm:116}]);
export function musicTime(step,type=0){const sixteenth=60/MUSIC_THEMES[type===1?1:0].bpm/4;return step*sixteenth+(step%2?sixteenth*.13:0);}
// play(instrument, midiNote, seconds, amplitude, stereoPan)
export function composeMusic(step,type=0,lab=false,heat=false,play){
 type=type===1?1:0;const bar=Math.floor(step/16)%16,n=step%16,chord=Math.floor(bar/2)%4,root=roots[type][chord],beat=60/MUSIC_THEMES[type].bpm/4;
 const intro=bar<2,breakdown=bar===8||bar===9,climax=bar>=12||heat,soft=lab?.65:1;
 if(kickRhythm.includes(n)&&(!breakdown||n===0))play('kick',36,.18,.25*soft,0);
 if(n===4||n===12){play(breakdown||lab?'rim':'snare',65,.12,.14*soft,-.03);if(!lab&&!breakdown)play('clap',65,.13,.1,.13);}
 if(n%2===0||climax&&!lab)play(n===14&&!intro&&!lab?'openHat':'hat',100,n===14?.11:.035,(n%4===2?.055:.032)*soft,type?-.3:.3);
 if(!lab&&climax&&n>=14)play('tom',n===14?48:43,.11,.11,n===14?-.2:.2);
 if(bassRhythm.includes(n)&&(!breakdown||n%8===0)){const pitch=root+(n===14?12:n===6?7:0);play(type?'roundBass':'gritBass',pitch,beat*(n===0?2.1:1.25),.14*soft,0);}
 if(n===0&&!intro){play('chord',root+12,.4,.032*soft,-.25);play('chord',root+12+thirds[chord],.4,.027*soft,.25);play('chord',root+19,.4,.025*soft,0);}
 if((n===3||n===11)&&!lab&&!breakdown)play(type?'bell':'stab',root+24+thirds[chord],.12,.075,type?.32:-.32);
 const note=motifs[type][(bar%2)*16+n];
 if(note>=0&&(!intro||n===0||n===7)&&!breakdown&&(lab?n%4===0:true))play(type?'bell':'lead',note,beat*(type?1.5:1.1),.09*soft,type?.12:-.12);
 if(n===0&&(bar===2||bar===12)&&!lab)play('crash',100,.42,.09,0);
 if(breakdown&&n===15&&!lab)play('riser',75,.18,.1,0);
}
