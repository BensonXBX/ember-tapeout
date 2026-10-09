import {createHash,randomBytes} from 'node:crypto';
import {authenticate} from './auth.mjs';
// The room writer remains authoritative. Triggers archive a redacted projection
// only on lifecycle/security changes, never a second poller or replay of history.
const project=`INSERT INTO ember_matches(id,code,created,updated,started,ended,status,a,b,c0,c1,score0,score1,winner,payment,evidence)
 SELECT NEW.code||':'||substr(coalesce(json_extract(NEW.payload,'$.tokens[0]'),json_extract(NEW.payload,'$.payment.key'),NEW.code),1,24),NEW.code,
 coalesce(json_extract(NEW.payload,'$.createdAt'),json_extract(NEW.payload,'$.payment.createdAt'),NEW.updated),NEW.updated,
 CASE WHEN NEW.status IN ('playing','finished') THEN NEW.updated END,CASE WHEN NEW.status IN ('finished','cancelled') THEN NEW.updated END,NEW.status,
 coalesce(nullif(json_extract(NEW.payload,'$.wallets[0]'),''),'guest:'||substr(json_extract(NEW.payload,'$.tokens[0]'),1,16)),
 coalesce(nullif(json_extract(NEW.payload,'$.wallets[1]'),''),'guest:'||substr(nullif(json_extract(NEW.payload,'$.tokens[1]'),''),1,16)),
 coalesce(json_extract(NEW.payload,'$.s[27]'),0),coalesce(json_extract(NEW.payload,'$.s[55]'),1),
 coalesce(json_extract(NEW.payload,'$.s[4]'),0),coalesce(json_extract(NEW.payload,'$.s[5]'),0),coalesce(json_extract(NEW.payload,'$.s[7]'),-1),
 json_object('key',json_extract(NEW.payload,'$.payment.key'),'asset',json_extract(NEW.payload,'$.payment.asset'),'stake',json_extract(NEW.payload,'$.payment.stake'),'escrow',json_extract(NEW.payload,'$.payment.escrow')),
 json_object('state',json_extract(NEW.payload,'$.s'),'inputs',json_extract(NEW.payload,'$.inputs'),'logs',json_extract(NEW.payload,'$.logs'))
 ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,started=coalesce(ember_matches.started,excluded.started),ended=coalesce(ember_matches.ended,excluded.ended),status=excluded.status,b=excluded.b,score0=excluded.score0,score1=excluded.score1,winner=excluded.winner,c1=excluded.c1,evidence=excluded.evidence;`;
export const MONITOR_SCHEMA=`
 CREATE TABLE ember_matches(id TEXT PRIMARY KEY,code TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,started INTEGER,ended INTEGER,status TEXT NOT NULL,a TEXT,b TEXT,c0 INTEGER,c1 INTEGER,score0 INTEGER,score1 INTEGER,winner INTEGER,payment TEXT NOT NULL,evidence TEXT NOT NULL);
 CREATE INDEX ember_matches_created ON ember_matches(created DESC);
 CREATE INDEX ember_matches_a ON ember_matches(a,created DESC);
 CREATE INDEX ember_matches_b ON ember_matches(b,created DESC);
 CREATE INDEX ember_matches_status ON ember_matches(status,updated);
 CREATE TABLE ember_runs(id TEXT PRIMARY KEY,token TEXT NOT NULL,user_id TEXT NOT NULL,mode TEXT NOT NULL,created INTEGER NOT NULL,ended INTEGER,result TEXT,duration REAL,level INTEGER);
 CREATE INDEX ember_runs_created ON ember_runs(created DESC);
 CREATE TABLE ember_players(id TEXT PRIMARY KEY,games INTEGER NOT NULL DEFAULT 0,wins INTEGER NOT NULL DEFAULT 0,last_seen INTEGER NOT NULL,bannedUntil INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL DEFAULT '');
 CREATE TABLE ember_activity(id TEXT NOT NULL,mode TEXT NOT NULL,created INTEGER NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(id,user_id));
 CREATE INDEX ember_activity_created ON ember_activity(created,mode,user_id);
 CREATE TABLE ember_totals(key TEXT PRIMARY KEY,n INTEGER NOT NULL DEFAULT 0);
 INSERT INTO ember_totals VALUES('matches',0),('runs',0),('players',0);
 CREATE TRIGGER ember_monitor_insert AFTER INSERT ON arena_rooms BEGIN ${project} END;
 CREATE TRIGGER ember_monitor_update AFTER UPDATE ON arena_rooms WHEN NEW.status<>OLD.status OR json_extract(NEW.payload,'$.flags') IS NOT json_extract(OLD.payload,'$.flags') BEGIN ${project} END;
 CREATE TRIGGER ember_match_count AFTER INSERT ON ember_matches BEGIN UPDATE ember_totals SET n=n+1 WHERE key='matches';END;
 CREATE TRIGGER ember_player_count AFTER INSERT ON ember_players BEGIN UPDATE ember_totals SET n=n+1 WHERE key='players';END;
 CREATE TRIGGER ember_match_players_insert AFTER INSERT ON ember_matches BEGIN
 INSERT INTO ember_players(id,last_seen) SELECT NEW.a,NEW.updated WHERE NEW.a IS NOT NULL ON CONFLICT(id) DO UPDATE SET last_seen=max(last_seen,excluded.last_seen);
 INSERT INTO ember_players(id,last_seen) SELECT NEW.b,NEW.updated WHERE NEW.b IS NOT NULL ON CONFLICT(id) DO UPDATE SET last_seen=max(last_seen,excluded.last_seen);
 INSERT OR IGNORE INTO ember_activity SELECT NEW.id,'pvp',NEW.started,NEW.a WHERE NEW.started IS NOT NULL AND NEW.a IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ember_activity WHERE id=NEW.id AND user_id=NEW.a);
 INSERT OR IGNORE INTO ember_activity SELECT NEW.id,'pvp',NEW.started,NEW.b WHERE NEW.started IS NOT NULL AND NEW.b IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ember_activity WHERE id=NEW.id AND user_id=NEW.b);
 UPDATE ember_players SET games=games+1,wins=wins+CASE WHEN (NEW.a=id AND NEW.winner=0) OR (NEW.b=id AND NEW.winner=1) THEN 1 ELSE 0 END WHERE NEW.status='finished' AND id IN(NEW.a,NEW.b);
 END;
 CREATE TRIGGER ember_match_players_update AFTER UPDATE ON ember_matches BEGIN
 INSERT INTO ember_players(id,last_seen) SELECT NEW.b,NEW.updated WHERE NEW.b IS NOT NULL ON CONFLICT(id) DO UPDATE SET last_seen=max(last_seen,excluded.last_seen);
 UPDATE ember_players SET last_seen=max(last_seen,NEW.updated),games=games+CASE WHEN NEW.status='finished' AND OLD.status<>'finished' THEN 1 ELSE 0 END,wins=wins+CASE WHEN NEW.status='finished' AND OLD.status<>'finished' AND ((NEW.a=id AND NEW.winner=0) OR (NEW.b=id AND NEW.winner=1)) THEN 1 ELSE 0 END WHERE id IN(NEW.a,NEW.b);
 INSERT OR IGNORE INTO ember_activity SELECT NEW.id,'pvp',NEW.started,NEW.a WHERE NEW.started IS NOT NULL AND NEW.a IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ember_activity WHERE id=NEW.id AND user_id=NEW.a);
 INSERT OR IGNORE INTO ember_activity SELECT NEW.id,'pvp',NEW.started,NEW.b WHERE NEW.started IS NOT NULL AND NEW.b IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ember_activity WHERE id=NEW.id AND user_id=NEW.b);
 END;
 CREATE TRIGGER ember_run_count AFTER INSERT ON ember_runs BEGIN
 UPDATE ember_totals SET n=n+1 WHERE key='runs';
 INSERT INTO ember_players(id,last_seen) VALUES(NEW.user_id,NEW.created) ON CONFLICT(id) DO UPDATE SET last_seen=max(last_seen,excluded.last_seen);
 INSERT INTO ember_activity VALUES(NEW.id,NEW.mode,NEW.created,NEW.user_id);
 END;
 -- Retain only evidence still present; never manufacture expired/deleted games.
 ${project.replaceAll('NEW.','r.').replace('ON CONFLICT(id) DO UPDATE',"FROM arena_rooms r WHERE true ON CONFLICT(id) DO UPDATE")}
`;
const fail=s=>{throw Object.assign(Error(s),{status:400})},hash=s=>createHash('sha256').update(s).digest('hex');
const name=(id,c)=>`${c===1?'霜 / Shuang':'烬 / Jin'} ${id?.startsWith('0x')?id.slice(-4):id?'· '+id.slice(-4):'—'}`;
const status=s=>({playing:'active',finished:'final',cancelled:'void',waiting:'funding',funding:'funding'})[s]||s;
export class EmberMonitor{
 constructor(db){this.db=db;this.cache=null;}
 async run(body,origin,ip,now=Date.now()){
  const bucket='monitor:'+hash(ip).slice(0,16)+':'+Math.floor(now/60000),rate=await this.db.prepare('INSERT INTO arena_limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now).first();if(rate.count>30)fail('TOO_MANY_REQUESTS');
  if(body.action==='run-start'){
   if(!['pve','lab'].includes(body.mode)||!Number.isInteger(body.level)||body.level<1||body.level>12)fail('INVALID_ACTION');
   let user='guest:'+randomBytes(8).toString('hex');if(body.walletSession)try{user=await authenticate(this.db,body.walletSession,origin,now);}catch{}
   const id=randomBytes(16).toString('hex'),token=randomBytes(24).toString('hex');
   await this.db.prepare('INSERT INTO ember_runs(id,token,user_id,mode,created,level) VALUES(?,?,?,?,?,?)').bind(id,hash(token),user,body.mode==='pve'?'campaign':'training',now,body.level).run();return{id,token};
  }
  if(body.action!=='run-end'||!/^\w{32}$/.test(body.id||'')||!/^\w{48}$/.test(body.token||'')||!['win','loss','draw','exit'].includes(body.result))fail('INVALID_ACTION');
  await this.db.prepare('UPDATE ember_runs SET ended=?,result=?,duration=(?-created)/1000.0 WHERE id=? AND token=? AND ended IS NULL').bind(now,body.result,now,body.id,hash(body.token)).run();return{ok:true};
 }
 async trend(step,now){
  if(this.cache&&this.cache.step===step&&now-this.cache.at<15000)return this.cache.data;
  const from=now-30*86400000,shift=step===86400000?28800000:0;
  const bin='CAST((created+?)/? AS INTEGER)*?-?',args=[shift,step,step,shift,from];
  const modes=(await this.db.prepare('SELECT '+bin+' AS bucket,mode,count(DISTINCT id) n FROM ember_activity WHERE created>=? GROUP BY bucket,mode').bind(...args).all()).results;
  const wallets=(await this.db.prepare("SELECT "+bin+" AS bucket,count(DISTINCT user_id) n FROM ember_activity WHERE created>=? AND user_id LIKE '0x%' GROUP BY bucket").bind(...args).all()).results;
  const counts=await this.db.prepare("SELECT count(DISTINCT id) plays,count(DISTINCT CASE WHEN user_id LIKE '0x%' THEN user_id END) AS uniqueWallets FROM ember_activity WHERE created>=?").bind(from).first();
  const data={step,from,to:now,unique:counts.uniqueWallets,plays:counts.plays,wallets,modes};this.cache={at:now,step,data};return data;
 }
 async admin(body,finance,now=Date.now()){
  if(body.action==='ember-ban'){
   if(!/^(0x[a-f0-9]{40}|guest:[a-f0-9]{16})$/.test(body.user||'')||![0,24,168].includes(Number(body.hours))||typeof body.note!=='string'||body.note.trim().length<5||body.note.length>1000)fail('BAD_REVIEW');
   await this.db.prepare('UPDATE ember_players SET bannedUntil=?,note=? WHERE id=?').bind(Number(body.hours)?now+Number(body.hours)*3600000:0,body.note,body.user).run();return{ok:true};
  }
  if(body.id){const r=await this.db.prepare('SELECT * FROM ember_matches WHERE id=?').bind(body.id).first();if(!r)fail('MATCH_NOT_FOUND');return{names:[name(r.a,r.c0),name(r.b,r.c1)],match:{id:r.id,created:r.created,ended:r.ended,ruleVersion:'ember-original-rules-1.1-scan.2',status:status(r.status),score:[r.score0,r.score1],reason:r.status,evidenceChunks:0,evidenceHash:hash(r.evidence)},payment:JSON.parse(r.payment),evidence:JSON.parse(r.evidence)};}
  const tab=body.tab||'matches',page=Number(body.page||1),step=Number(body.step||300000);if(!['matches','players','runs','security'].includes(tab)||!Number.isInteger(page)||page<1||page>100000||![300000,900000,3600000,21600000,86400000].includes(step))fail('BAD_REQUEST');
  const totals=Object.fromEntries((await this.db.prepare('SELECT * FROM ember_totals').all()).results.map(r=>[r.key,r.n]));totals.active=(await this.db.prepare("SELECT count(*) n FROM arena_rooms WHERE status='playing' AND updated>?").bind(now-15000).first()).n;
  let rows,total;const offset=(page-1)*30;
  if(tab==='matches'){
   const filter=body.user?' WHERE a=? OR b=?':'',args=body.user?[body.user,body.user]:[];
   total=body.user?(await this.db.prepare('SELECT count(*) n FROM ember_matches'+filter).bind(...args).first()).n:totals.matches;
   rows=(await this.db.prepare('SELECT * FROM ember_matches'+filter+' ORDER BY created DESC,id DESC LIMIT 30 OFFSET ?').bind(...args,offset).all()).results.map(r=>({id:r.id,names:[name(r.a,r.c0),name(r.b,r.c1)],created:r.created,status:status(r.status),score:[r.score0,r.score1]}));
  }else if(tab==='players'){total=totals.players;rows=(await this.db.prepare('SELECT * FROM ember_players ORDER BY last_seen DESC,id LIMIT 30 OFFSET ?').bind(offset).all()).results.map(r=>({...r,name:r.id.startsWith('0x')?r.id:'Guest '+r.id.slice(-4)}));
  }else if(tab==='runs'){total=totals.runs;rows=(await this.db.prepare('SELECT id,user_id,mode,created,ended,result,duration,level FROM ember_runs ORDER BY created DESC LIMIT 30 OFFSET ?').bind(offset).all()).results.map(r=>({...r,trust:'client_reported'}));
  }else{const sql="FROM ember_matches m,json_each(m.evidence,'$.logs') e";total=(await this.db.prepare('SELECT count(*) n '+sql).first()).n;rows=(await this.db.prepare("SELECT json_extract(e.value,'$.at') AS last,CASE json_extract(e.value,'$.slot') WHEN 0 THEN m.a ELSE m.b END AS user_id,json_extract(e.value,'$.kind') AS code,1 AS n "+sql+' ORDER BY last DESC LIMIT 30 OFFSET ?').bind(offset).all()).results;}
  return{stats:totals,rows,total,trend:await this.trend(step,now),payments:finance.public()};
 }
}
