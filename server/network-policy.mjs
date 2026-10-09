export function parseOrigins(value=''){
 return value.split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const u=new URL(s);if(s.includes('*')||u.origin!==s||u.username||u.password||!(['https:'].includes(u.protocol)||(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))))throw Error('ARENA_ALLOWED_ORIGINS requires exact HTTPS origins (or local HTTP), without paths or wildcards');return s;});
}
// Only numeric sites on the managed TapeOutScan DeWeb gateway. Custom domains
// still require an exact ARENA_ALLOWED_ORIGINS entry. Never allow null or suffix lookalikes.
export function dewebOrigin(origin){try{const u=new URL(origin);return u.origin===origin&&u.protocol==='https:'&&!u.port&&/^[1-9][0-9]{0,77}-(?:2-)?(?:0|[1-9][0-9]{0,77})\.deweb\.tapeoutexplorer\.com$/.test(u.hostname);}catch{return false;}}
export function allowOrigin(origin,target,allowed=[]){return !!origin&&(origin===target||allowed.includes(origin)||dewebOrigin(origin));}
