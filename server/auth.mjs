import {randomBytes,createHash} from 'node:crypto';
import {verifyMessage} from './vendor/verify-message.mjs';
export const CHAIN_ID=196;
export const PROFILE_SCHEMA="CREATE TABLE IF NOT EXISTS ember_profiles(address TEXT PRIMARY KEY,nickname TEXT NOT NULL,updated INTEGER NOT NULL);";
export async function nickname(db,address){return address?(await db.prepare('SELECT nickname FROM ember_profiles WHERE address=?').bind(address).first())?.nickname||'':'';}
export function validNickname(value){return typeof value==='string'&&/^[\p{L}\p{N} _.-]{2,16}$/u.test(value.trim())&&/[\p{L}\p{N}]/u.test(value);}
const hash=s=>createHash('sha256').update(s).digest('hex'),random=()=>randomBytes(24).toString('hex');
const fail=(code,status=400)=>{throw Object.assign(Error(code),{status});};
export async function authenticate(db,token,origin,now=Date.now()){
 if(typeof token!=='string'||!/^[a-f0-9]{48}$/.test(token))fail('LOGIN_REQUIRED',401);
 const row=await db.prepare('SELECT address FROM ember_sessions WHERE token_hash=? AND origin=? AND expires>?').bind(hash(token),origin,now).first();
 if(!row)fail('LOGIN_REQUIRED',401);return row.address;
}
export async function handleAuth(db,body,origin,ip,now=Date.now()){
 if(!origin)fail('ORIGIN_DENIED',403);
 const endpoint=new URL(origin);if(endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))fail('ORIGIN_DENIED',403);
 if(body.action==='session'){const address=await authenticate(db,body.session,origin,now);return {address,chainId:CHAIN_ID,nickname:await nickname(db,address)};}
 if(body.action==='logout'){
  if(typeof body.session==='string')await db.prepare('DELETE FROM ember_sessions WHERE token_hash=? AND origin=?').bind(hash(body.session),origin).run();
  return {ok:true};
 }
 const bucket='auth:'+hash(ip).slice(0,24)+':'+Math.floor(now/60000);
 const rate=await db.prepare('INSERT INTO arena_limits (key,since,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now).first();
 if(rate.count>20)fail('TOO_MANY_REQUESTS',429);
 if(body.action==='profile'){const address=await authenticate(db,body.session,origin,now);if(!validNickname(body.nickname))fail('INVALID_NICKNAME');const name=body.nickname.trim();await db.prepare('INSERT INTO ember_profiles VALUES(?,?,?) ON CONFLICT(address) DO UPDATE SET nickname=excluded.nickname,updated=excluded.updated').bind(address,name,now).run();return{address,nickname:name};}
 if(body.action==='challenge'){
  if(typeof body.address!=='string'||!/^0x[0-9a-f]{40}$/i.test(body.address)||body.chainId!==CHAIN_ID)fail('WRONG_NETWORK');
  const address=body.address.toLowerCase(),id=random(),expires=now+300000;
  const message=`${new URL(origin).host} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to EMBER on X Layer. No payment or token approval.\n\nURI: ${origin}/games/ember/\nVersion: 1\nChain ID: 196\nNonce: ${id}\nIssued At: ${new Date(now).toISOString()}\nExpiration Time: ${new Date(expires).toISOString()}`;
  await db.batch([db.prepare('DELETE FROM ember_challenges WHERE expires<=?').bind(now),db.prepare('INSERT INTO ember_challenges (id,address,origin,message,expires) VALUES (?,?,?,?,?)').bind(id,address,origin,message,expires)]);
  return {id,message,expires,chainId:CHAIN_ID};
 }
 if(body.action!=='verify'||typeof body.id!=='string'||!/^[a-f0-9]{48}$/.test(body.id)||typeof body.signature!=='string'||!/^0x[0-9a-f]{130}$/i.test(body.signature))fail('INVALID_SIGNATURE');
 const row=await db.prepare('SELECT * FROM ember_challenges WHERE id=? AND origin=? AND expires>?').bind(body.id,origin,now).first();
 if(!row)fail('LOGIN_EXPIRED',401);
 let signer;try{signer=verifyMessage(row.message,body.signature).toLowerCase();}catch{fail('INVALID_SIGNATURE');}
 if(signer!==row.address)fail('WALLET_CHANGED',401);
 // DELETE RETURNING consumes the nonce exactly once, even under concurrent verification.
 const consumed=await db.prepare('DELETE FROM ember_challenges WHERE id=? AND origin=? AND expires>? RETURNING id').bind(row.id,origin,now).first();
 if(!consumed)fail('LOGIN_EXPIRED',401);
 const session=random(),expires=now+30*86400000;
 await db.batch([db.prepare('DELETE FROM ember_sessions WHERE address=? AND origin=?').bind(signer,origin),db.prepare('INSERT INTO ember_sessions (token_hash,address,origin,expires) VALUES (?,?,?,?)').bind(hash(session),signer,origin,expires)]);
 return {session,address:signer,chainId:CHAIN_ID,expires,nickname:await nickname(db,signer)};
}
export const AUTH_SCHEMA=`CREATE TABLE IF NOT EXISTS ember_challenges (id TEXT PRIMARY KEY,address TEXT NOT NULL,origin TEXT NOT NULL,message TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ember_challenges_expiry ON ember_challenges(expires);
CREATE TABLE IF NOT EXISTS ember_sessions (token_hash TEXT PRIMARY KEY,address TEXT NOT NULL,origin TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ember_sessions_expiry ON ember_sessions(expires);`;
