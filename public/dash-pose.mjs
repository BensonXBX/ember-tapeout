const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const airFrames=[18,17,20,21,22,21,19,18],groundFrames=[[4,5,6,7,4,5,4,0],[4,6,7,4,5,6,4,0]];
// Whole-body drawings: compress, drive, exchange feet, plant heel, recover.
// Ground foot contacts remain at y=0; the airborne sequence folds then extends.
export function dashPose(age,type=0,air=false){
 const a=Math.max(0,Math.min(16,age)),push=smooth(a/4),brake=smooth((a-10)/6),drive=push*(1-brake);
 const phase=a<2?0:a<4?1:a<6?2:a<8?3:a<10?4:a<12?5:a<14?6:7;
 const frames=air?airFrames:groundFrames[type];
 return {frame:frames[phase]+type*32,dx:(type?4:6)*drive-1.5*brake*(1-brake),dy:air?-Math.sin(a/16*Math.PI)*(type?3:5):-(Math.sin(Math.max(0,a-2)*Math.PI/5)**2)*drive*(type?1:2),
  angle:(air?(type?.09:.2):(type?.13:.22))*drive-(type?.025:.045)*Math.sin(brake*Math.PI),
  sx:1+(air?.035:.06)*drive,sy:1-(a<4?.1*(1-push):.035*drive)};
}
