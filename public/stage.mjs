// Shared map geometry; both the server and browser resolve the same platforms.
export const WORLD_WIDTH=640,FLOOR=144,MAP_BYTES=9*4;
export const platforms=new Float32Array([48,146,103,270,370,83,492,598,103]);
export function support(s,p){
 if(s[p+1]>=FLOOR-.001)return FLOOR;
 if(s[15])for(let n=0;n<platforms.length;n+=3)if(s[p]>=platforms[n]&&s[p]<=platforms[n+1]&&Math.abs(s[p+1]-platforms[n+2])<.001)return platforms[n+2];
 return -1;
}
export const grounded=(s,p)=>s[p+2]===0&&support(s,p)>=0;
export function landing(s,p,oldY){let floor=FLOOR;if(s[15]&&s[p+2]>=0)for(let n=0;n<platforms.length;n+=3){const y=platforms[n+2];if(s[p]>=platforms[n]&&s[p]<=platforms[n+1]&&oldY<=y&&s[p+1]>=y)floor=Math.min(floor,y);}return floor;}
