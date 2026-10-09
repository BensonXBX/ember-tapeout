// Stable DeWeb loader. Only index.html selects a release; payloads are immutable.
const selection=JSON.parse(document.getElementById('ember-release').textContent),base=new URL('./',location.href),decoder=new TextDecoder();
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
async function bytes(stream,limit){const reader=stream.getReader(),parts=[];let length=0;try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Error('Resource too large');parts.push(value);}}finally{await reader.cancel();}if(length!==limit)throw Error('Resource length mismatch');const out=new Uint8Array(length);let i=0;for(const part of parts){out.set(part,i);i+=part.length;}return out;}
async function verified(item){const r=await fetch(new URL(item.path,base),{credentials:'omit'});if(!r.ok||!r.body)throw Error('Resource missing: '+item.path);const stored=await bytes(r.body,item.bytes);if(await sha(stored)!==item.sha256)throw Error('Resource checksum mismatch');const raw=item.gzip?await bytes(new Blob([stored]).stream().pipeThrough(new DecompressionStream('gzip')),item.rawBytes):stored;if(await sha(raw)!==item.rawSha256)throw Error('Unpacked checksum mismatch');return raw;}
try{
 if(!crypto.subtle||typeof DecompressionStream==='undefined')throw Error('请使用新版 HTTPS 浏览器 / Use a current HTTPS browser');
 const release=JSON.parse(decoder.decode(await verified(selection.manifest)));
 if(release.format!==1)throw Error('Unsupported release format');
 const [markup,...styles]=await Promise.all([verified(release.page),...release.styles.map(verified)]);
 const parsed=new DOMParser().parseFromString(decoder.decode(markup),'text/html');
 // Keep the gateway-owned navigation, whose script may have loaded before us.
 const gateway=[...document.body.children].filter(n=>n.hasAttribute('data-tapeoutscan-gateway-nav')||n.hasAttribute('data-tapeoutscan-gateway-nav-host')||n.id.startsWith('tapeoutscan-deweb'));
 document.head.replaceChildren(...parsed.head.childNodes);document.body.replaceChildren(...parsed.body.childNodes,...gateway);
 for(const a of [...document.body.attributes])document.body.removeAttribute(a.name);for(const a of parsed.body.attributes)document.body.setAttribute(a.name,a.value);
 await Promise.all(styles.map(raw=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.onload=resolve;link.onerror=()=>reject(Error('Stylesheet unavailable'));const css=decoder.decode(raw).replace(/url\((['"]?)(\.\/media\/[^)'"\s]+)\1\)/g,(_,q,path)=>'url('+JSON.stringify(new URL(path,base).href)+')');link.href=URL.createObjectURL(new Blob([css],{type:'text/css'}));document.head.append(link);}))); 
 const urls=new Map();
 function moduleUrl(id,parents=[]){if(parents.includes(id)||!Object.hasOwn(release.modules,id))return Promise.reject(Error('Invalid module graph'));if(urls.has(id))return urls.get(id);const promise=(async()=>{const item=release.modules[id];let code=decoder.decode(await verified(item));const refs=await Promise.all(item.edges.filter(e=>!e.dynamic).map(async e=>[e,await moduleUrl(e.id,[...parents,id])]));for(const[e,url]of refs)code=code.split(e.literal).join(JSON.stringify(url));return URL.createObjectURL(new Blob([code],{type:'text/javascript'}));})();urls.set(id,promise);promise.catch(()=>urls.delete(id));return promise;}
 globalThis.__EMBER_IMPORT__=async id=>import(await moduleUrl(id));await globalThis.__EMBER_IMPORT__(release.entry);
}catch(e){const note=document.createElement('section');note.style.cssText='position:fixed;inset:0;padding:24px;background:#11283c;color:#f0d39b;font:16px system-ui;z-index:99999';note.textContent='余烬 · 加载失败 / Loading failed: '+e.message;const retry=document.createElement('button');retry.textContent='重新载入 / Reload';retry.onclick=()=>location.reload();note.append(document.createElement('br'),retry);document.body.append(note);console.error(e);}
