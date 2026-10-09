export const SUPER_TITLE_MS=1000,SUPER_TITLE_BYTES=2*6*8;
export function makeSuperTitles(){
 const data=new Float64Array(12);data[0]=data[6]=-Infinity;
 let round=-1,frame=-1;
 return {bytes:data.byteLength,reset(){data.fill(0);data[0]=data[6]=-Infinity;round=-1;frame=-1;},observe(s,t){
  if(round!==s[3]||s[1]===0||s[0]<frame-30){data.fill(0);data[0]=data[6]=-Infinity;round=s[3];}frame=s[0];if(s[1]===0)return;
  for(let i=0;i<2;i++){const p=16+i*28,z=i*6,act=s[p+7],age=s[p+8];
   if((act===12||act===19)&&(data[z+3]!==act||age+4<data[z+4])&&t-data[z]>SUPER_TITLE_MS){data[z]=t;data[z+1]=s[p+11];data[z+2]=act===19?1:0;}
   data[z+3]=act;data[z+4]=age;
  }
 },get(slot,t){const z=slot*6,elapsed=t-data[z];return elapsed>=0&&elapsed<SUPER_TITLE_MS?{type:data[z+1],air:!!data[z+2],elapsed}:null;}};
}
