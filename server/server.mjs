import {EmberMonitor} from './monitor.mjs';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {EmberFinance} from './finance.mjs';
import {authenticate} from './auth.mjs';
import {handleAuth} from './auth.mjs';
import {parseOrigins,allowOrigin} from './network-policy.mjs';
import {attachArenaSockets} from './arena-sockets.mjs';
import { createServer } from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { handleArena,expireRooms } from './arena-server.mjs';
import { openArenaDatabase } from './sqlite-db.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const base = config.basePath;
const allowedOrigins=parseOrigins(process.env.ARENA_ALLOWED_ORIGINS);
const database = openArenaDatabase(process.env.ARENA_DB || join(root, 'data', 'arena.sqlite'), join(root, 'server', 'schema.sql'));
const monitor=new EmberMonitor(database);
const finance=new EmberFinance(database,process.env.EMBER_FINANCE_CONFIG||null);if(finance.config?.escrow)void finance.configuration();
const adminKey=process.env.EMBER_ADMIN_KEY_FILE?readFileSync(process.env.EMBER_ADMIN_KEY_FILE,'utf8').trim():'';const adminNonces=new Map();
const publicRoot = join(root, 'public');
const publicFiles = new Set((await readdir(publicRoot, { recursive: true })).map(name => name.replaceAll('\\', '/')));
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest':'application/manifest+json', '.txt':'text/plain; charset=utf-8' };
const security = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${(config.connectOrigins||[]).join(' ')}; media-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'`,
};
function send(res, status, data, headers = {}) {
  res.writeHead(status, { ...security, 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}
const server = createServer(async (req, res) => {
  try {
    const trusted = process.env.TRUST_PROXY === '1' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const proto = trusted && req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const url = new URL(req.url, `${proto}://${req.headers.host || 'localhost'}`);
    const path = decodeURIComponent(url.pathname);
    if(path===`${base}internal/finance`){
      if(req.method!=='POST'||!adminKey||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return send(res,403,{error:'ADMIN_REQUIRED'});
      let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>4096)return send(res,413,{error:'TOO_LARGE'});}
      const stamp=String(req.headers['x-arena-time']||''),nonce=String(req.headers['x-arena-nonce']||''),signature=String(req.headers['x-arena-signature']||'');
      for(const[k,at]of adminNonces)if(Date.now()-at>30000)adminNonces.delete(k);
      const expected=createHmac('sha256',adminKey).update(stamp+'\n'+nonce+'\n'+body).digest('hex');
      if(!/^\d{13}$/.test(stamp)||Math.abs(Date.now()-Number(stamp))>30000||!/^[a-f0-9]{32}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(signature)||adminNonces.has(nonce)||!timingSafeEqual(Buffer.from(expected),Buffer.from(signature)))return send(res,403,{error:'ADMIN_REQUIRED'});
      adminNonces.set(nonce,Date.now());try{return send(res,200,await (async()=>{const data=JSON.parse(body);return (['ember-monitor','ember-ban'].includes(data.action)||data.game==='ember'&&!data.action)?monitor.admin(data,finance):finance.admin(data);})());}catch(e){return send(res,e.status||400,{error:/^[A-Z_]+$/.test(e.message)?e.message:'CHAIN_BUSY'});}
    }
    if (path === '/healthz') return send(res, 200, { service: 'ember-arena', version: config.version, ready: true });
    if (path === base.slice(0, -1) || path === '/') {
      res.writeHead(302, { ...security, Location: base });
      return res.end();
    }
    if (path === `${base}api/arena` || path === `${base}api/auth` || path===`${base}api/finance`) {
      const origin=req.headers.origin;
      if(origin&&!allowOrigin(origin,url.origin,allowedOrigins))return send(res,403,{error:'请求来源无效。'});
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      if(req.method==='OPTIONS'){
        const requested=String(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
        if(!origin||req.headers['access-control-request-method']!=='POST'||requested.some(s=>s!=='content-type'))return send(res,403,{error:'预检请求不被允许。'});
        res.writeHead(204,{...security,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Cache-Control':'no-store'});return res.end();
      }
      if (req.method === 'GET') return send(res, 200, { service: 'ember-arena', version: config.version, transport: 'authoritative-websocket+http', hz: 60 });
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, POST' });
      const bodyLimit=2048;
      if (Number(req.headers['content-length'] || 0) > bodyLimit) return send(res, 413, { error: '输入消息过大。' });
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > bodyLimit) return send(res, 413, { error: '输入消息过大。' });
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const name of ['content-type', 'origin']) if (req.headers[name]) headers.set(name, req.headers[name]);
      // Client-supplied forwarding/auth headers are never accepted as identity.
      headers.set('cf-connecting-ip', trusted ? String(req.headers['x-real-ip'] || req.socket.remoteAddress) : req.socket.remoteAddress);
      if(path===`${base}api/finance`){
        if(!origin)return send(res,403,{error:'ORIGIN_DENIED'});
        try{const body=JSON.parse(Buffer.concat(chunks));if(body.action==='config')return send(res,200,await finance.configuration());const user=await authenticate(database,body.walletSession,origin);return send(res,200,await finance.handle(user,body));}catch(e){return send(res,e.status||503,{error:/^[A-Z_]+$/.test(e.message)?e.message:'CHAIN_BUSY'});}
      }
      if(path === `${base}api/auth`){
        if(!origin)return send(res,403,{error:'ORIGIN_DENIED'});
        try { const body=JSON.parse(Buffer.concat(chunks));return send(res,200,await handleAuth(database,body,origin,headers.get('cf-connecting-ip'))); }
        catch(error){return send(res,error.status||400,{error:error.status?error.message:'INVALID_REQUEST'});}
      }
      const monitoring=JSON.parse(Buffer.concat(chunks));
      if(['run-start','run-end'].includes(monitoring.action)){if(!origin)return send(res,403,{error:'ORIGIN_DENIED'});try{return send(res,200,await monitor.run(monitoring,origin,headers.get('cf-connecting-ip')));}catch(e){return send(res,e.status||400,{error:'INVALID_ACTION'});}}
      const response = await handleArena(new Request(url, { method: 'POST', headers, body: Buffer.concat(chunks) }), database, allowedOrigins,finance);
      res.writeHead(response.status, { ...security, ...Object.fromEntries(response.headers) });
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
    if (!path.startsWith(base)) return send(res, 404, { error: 'Not found' });
    const name = path.slice(base.length) || 'arena.html';
    const type = types[extname(name)];
    if (!type || !publicFiles.has(name) || name.split('/').some(part => part.startsWith('.'))) return send(res, 404, { error: 'Not found' });
    const compressed = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && publicFiles.has(`${name}.gz`);
    const file = join(publicRoot, name + (compressed ? '.gz' : ''));
    const info = await stat(file);
    const etag = `"${info.size}-${Math.floor(info.mtimeMs)}${compressed ? '-gz' : ''}"`;
    const headers = { ...security, 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: etag, Vary: 'Accept-Encoding', ...(compressed ? { 'Content-Encoding': 'gzip' } : {}) };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    res.writeHead(200, { ...headers, 'Content-Length': info.size });
    if (req.method === 'HEAD') return res.end();
    await pipeline(createReadStream(file), res);
  } catch (error) {
    if (!res.headersSent) send(res, error instanceof URIError ? 400 : 500, { error: '请求无法处理，请稍后再试。' });
    else res.destroy();
    if (!(error instanceof URIError) && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('Request error:', error.message);
  }
});
const sockets=attachArenaSockets(server,database,base,allowedOrigins,finance);
server.requestTimeout = 10_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 40;
server.listen(Number(process.env.PORT || 3210), process.env.HOST || '127.0.0.1', () => console.log(`Ember Arena ${config.version} listening on ${JSON.stringify(server.address())}${base}`));
let lastCleanup=0;
const cleanup = setInterval(async () => {
  void finance.maintainFinality().then(result=>{if(result?.failed)console.error('Finality check: retrying',result.failed,'of',result.selected);}).catch(error=>console.error('Finality check:',error.message));
  if(Date.now()-lastCleanup<60_000)return;lastCleanup=Date.now();
  try {
    await expireRooms(database);
    await database.prepare("DELETE FROM arena_rooms WHERE expires < ? AND status IN ('finished','cancelled') AND json_type(payload,'$.payment') IS NULL").bind(Date.now()).run();
    await database.prepare('DELETE FROM ember_challenges WHERE expires <= ?').bind(Date.now()).run();
    await database.prepare('DELETE FROM ember_sessions WHERE expires <= ?').bind(Date.now()).run();
    await database.prepare('DELETE FROM arena_limits WHERE since < ?').bind(Date.now() - 120000).run();
  } catch (error) { console.error('Room cleanup:', error.message); }
}, 5_000).unref();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  clearInterval(cleanup);
  sockets.close();finance.close();
  server.close(() => { database.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
});
