import {allowOrigin} from './network-policy.mjs';
import {finishPayment,readyDeposits} from './finance.mjs';
import {authenticate,nickname} from './auth.mjs';
import { createState, start, step, validMask, MAX_MASK, ACTION_MASK } from '../public/engine.mjs';
class GameError extends Error {
    status;
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
const response = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const codePattern = /^[A-Z2-9]{6}$/;
async function digest(v) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))), x => x.toString(16).padStart(2, '0')).join(''); }
function token() { return Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2, '0')).join(''); }
function roomCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = crypto.getRandomValues(new Uint8Array(6)); return Array.from(a, x => chars[x % chars.length]).join(''); }
function event(p, slot, kind, now) { p.flags[slot]++; p.logs.push({ frame: p.s[0], slot, kind, at: now }); if (p.logs.length > 128)
    p.logs.shift(); }
async function read(db, code) { return db.prepare("SELECT r.*,coalesce(a.bannedUntil,0) ban0,coalesce(b.bannedUntil,0) ban1 FROM arena_rooms r LEFT JOIN ember_players a ON a.id=coalesce(nullif(json_extract(r.payload,'$.wallets[0]'),''),'guest:'||substr(json_extract(r.payload,'$.tokens[0]'),1,16)) LEFT JOIN ember_players b ON b.id=coalesce(nullif(json_extract(r.payload,'$.wallets[1]'),''),'guest:'||substr(json_extract(r.payload,'$.tokens[1]'),1,16)) WHERE code=?").bind(code).first(); }
async function save(db, row, p, status, now) { finishPayment(p,status,now);return (await db.prepare('UPDATE arena_rooms SET payload = ?, status = ?, version = version + 1, updated = ?, expires = ? WHERE code = ? AND version = ?').bind(JSON.stringify(p), status, now, now + 600000, row.code, row.version).run()).meta.changes === 1; }
function publicState(row, p, slot) { return { code: row.code, slot, status: row.status, state: p.s,names:p.names||['',''], selection:p.selection?{...p.selection,serverTime:Date.now()}:null,payment:p.payment?{key:p.payment.key,asset:p.payment.asset,stake:p.payment.stake,fundUntil:p.payment.fundUntil,paid:readyDeposits(p.payment)}:null,otherMask: p.m[1 - slot], ack: p.seq[slot], pendingEdges: p.pulse[slot], warning: p.flags[slot] ? '服务器已记录 ' + p.flags[slot] + ' 次异常输入。' : undefined }; }
function advance(p, now) { const s = new Float32Array(p.s), frames = Math.min(36000, Math.max(0, Math.floor((now - p.last) * 60 / 1000))); for (let n = 0; n < frames; n++) {
    const frameAt = p.last + (n + 1) * 1000 / 60;
    for (let i = 0; i < 2; i++)
        if (frameAt - p.seen[i] > 1000)
            p.m[i] = 0;
    if (frameAt - p.seen[0] > 10000 || frameAt - p.seen[1] > 10000) {
        const stale0 = frameAt - p.seen[0] > 10000, stale1 = frameAt - p.seen[1] > 10000;
        s[7] = stale0 && stale1 ? -1 : stale0 ? 1 : 0;
        s[1] = 4;
        if (s[7] >= 0)
            s[4 + s[7]] = 2;
        break;
    }
    step(s, p.m[0] | (n === 0 ? p.pulse[0] : 0), p.m[1] | (n === 0 ? p.pulse[1] : 0));
} if (frames > 0) {
    p.pulse = [0, 0];
    p.last += frames * 1000 / 60;
} p.s = Array.from(s); }
async function rateLimit(db, key, now) { const bucket = Math.floor(now / 60000); const k = key + ':' + bucket; const row = await db.prepare('INSERT INTO arena_limits (key,since,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(k, now).first(); if (row.count > 20)
    throw new GameError('创建或加入房间过于频繁，请一分钟后再试。', 429); await db.prepare('DELETE FROM arena_limits WHERE since < ?').bind(now - 120000).run(); }
// Permit brief network bursts while retaining a sustained 30-input/second limit.
// Legacy payloads store Unix seconds in buckets; current payloads store milliseconds.
export function consumeInputBudget(p, slot, now) {
    const previous = p.buckets[slot], legacy = previous < 100000000000;
    const elapsed = legacy ? 0 : Math.max(0, now - previous);
    const credits = legacy ? 60 : Math.min(60, p.counts[slot] + elapsed * 0.03);
    p.buckets[slot] = legacy ? now : Math.max(previous, now);
    const allowed = credits >= 1;
    p.counts[slot] = allowed ? credits - 1 : credits;
    return allowed;
}
export async function handleArena(request, db, allowedOrigins = [], finance = null) {
    try {
        if (!db)
            throw new GameError('对战服务正在准备，请稍后再试。', 503);
        const origin = request.headers.get('origin');
        if (origin && !allowOrigin(origin,new URL(request.url).origin,allowedOrigins))
            throw new GameError('请求来源无效。', 403);
        if (!request.headers.get('content-type')?.includes('application/json'))
            throw new GameError('请求格式无效。');
        if (Number(request.headers.get('content-length') || 0) > 2048)
            throw new GameError('输入消息过大。', 413);
        const raw = await request.text();
        if (raw.length > 2048)
            throw new GameError('输入消息过大。', 413);
        let body;
        try {
            body = JSON.parse(raw);
        }
        catch {
            throw new GameError('输入消息格式错误。');
        }
        if (!body || typeof body !== 'object' || Array.isArray(body))
            throw new GameError('请求格式无效。');
        const now = Date.now(), action = body.action;
        if (action === 'list') {
            // Only a public projection leaves the server: never payloads, tokens or hashes.
            const rows = await db.prepare("SELECT code,status,quick,json_extract(payload,'$.names[0]') AS hostName,json_extract(payload,'$.s[27]') AS hostCharacter,json_extract(payload,'$.s[55]') AS guestCharacter,CASE WHEN json_extract(payload,'$.lock') IS NULL THEN 0 ELSE 1 END AS locked,json_extract(payload,'$.payment.asset') AS asset,json_extract(payload,'$.payment.stake') AS stake FROM arena_rooms WHERE status IN ('waiting','funding','playing') AND json_extract(payload,'$.lock') IS NULL AND expires > ? AND updated > ? ORDER BY CASE status WHEN 'waiting' THEN 0 ELSE 1 END, updated DESC LIMIT 40").bind(now, now - 15000).all();
            return response({ rooms: rows.results.map((row) => ({ code: row.code, status: row.status, hostCharacter: row.hostCharacter,hostName:row.hostName||'', guestCharacter: row.status === 'playing' ? row.guestCharacter : null, players: row.status !== 'waiting' ? 2 : 1,asset:row.asset,stake:row.stake, locked: !!row.locked, quick: !!row.quick })) });
        }
        if (['create', 'match', 'join'].includes(action)) {
            // Free rooms use their existing random room credentials. Never make an
            // expired optional wallet session a barrier to free play.
            let wallet = '';if(body.walletSession)try{wallet=await authenticate(db,body.walletSession,origin||new URL(request.url).origin,now);}catch{}
            if(wallet&&(await db.prepare('SELECT bannedUntil FROM ember_players WHERE id=?').bind(wallet).first())?.bannedUntil>now)throw new GameError('PLAYER_RESTRICTED',403);
            const playerName=await nickname(db,wallet);
            if (body.character !== 0 && body.character !== 1)
                throw new GameError('角色选择无效。');
            if (body.password) throw new GameError('PASSWORD_ROOMS_DISABLED');
            if (action === 'match' && body.deposit) throw new GameError('PAID_MATCH_REQUIRES_ROOM');
            const actor = request.headers.get('cf-connecting-ip') || request.headers.get('oai-authenticated-user-id') || 'local';
            await rateLimit(db, (await digest(actor)).slice(0, 16), now);
            await expireRooms(db,now);
            await db.prepare("DELETE FROM arena_rooms WHERE expires < ? AND status IN ('finished','cancelled') AND json_type(payload,'$.payment') IS NULL").bind(now).run();
            const tk = token(), hash = await digest(tk);
            let target = body.code;
            if (action === 'match') {
                const waiting = await db.prepare("SELECT code FROM arena_rooms WHERE status = 'waiting' AND quick = 1 AND json_type(payload,'$.payment') IS NULL AND json_extract(payload, '$.lock') IS NULL AND updated > ? ORDER BY updated LIMIT 1").bind(now - 15000).first();
                target = waiting?.code;
            }
            if (action === 'join' || target) {
                if (typeof target !== 'string' || !codePattern.test(target))
                    throw new GameError('房间码格式无效。');
                const admission=await read(db,target);const deposit=admission?JSON.parse(admission.payload).payment:null;
                if(deposit){if(finance?.public().depositRoomsEnabled===false)throw new GameError('DEPOSITS_UNAVAILABLE');wallet=await authenticate(db,body.walletSession,origin||new URL(request.url).origin,now);if(!playerName)throw new GameError('NICKNAME_REQUIRED');if(!finance?.public().enabled)throw new GameError('ESCROW_UNAVAILABLE');}
                for (let attempt = 0; attempt < 5; attempt++) {
                    const row = await read(db, target);
                    if (!row || row.expires < now)
                        throw new GameError('房间不存在或已过期。', 404);
                    if (row.status !== 'waiting')
                        throw new GameError('房间已满或对局已经结束。', 409);
                    const p = JSON.parse(row.payload);
                    if (now - p.seen[0] > 15000)
                        throw new GameError('房主已离线，请重新匹配。', 409);
                    // Legacy private rooms remain private until they expire.
                    if (p.lock) throw new GameError('PASSWORD_ROOMS_DISABLED', 403);
                    p.wallets ??= ['', '']; if(wallet&&p.wallets[0]===wallet)throw new GameError('SAME_WALLET');if(p.payment&&(!wallet||!deposit||deposit.key!==p.payment.key))throw new GameError('ROOM_CHANGED');p.wallets[1] = wallet;p.names??=['',''];p.names[1]=playerName;
                    p.tokens[1] = hash;
                    p.s = Array.from(createState(p.s[27], body.character));
                    const s = new Float32Array(p.s);
                    if(p.payment)p.payment.fundUntil=Math.floor(now/1000)+180;
                    else if(p.selectionVersion===1)p.selection={until:now+10000,characters:[0,1],locked:[false,false]};
                    else start(s);
                    p.s = Array.from(s);
                    p.last = now;
                    p.seen = [now, now];
                    if (await save(db, row, p, p.payment||p.selection?'funding':'playing', now))
                        return response({ ...publicState({ ...row, status: p.payment||p.selection?'funding':'playing' }, p, 1), token: tk });
                }
                throw new GameError('房间繁忙，请重新加入。', 409);
            }
            if(body.deposit){if(finance?.public().depositRoomsEnabled===false)throw new GameError('DEPOSITS_UNAVAILABLE');wallet=await authenticate(db,body.walletSession,origin||new URL(request.url).origin,now);if(!playerName)throw new GameError('NICKNAME_REQUIRED');}
            const active=wallet&&await db.prepare("SELECT code FROM arena_rooms WHERE status IN ('waiting','funding','playing') AND expires>? AND (status<>'waiting' OR updated>?) AND (json_extract(payload,'$.wallets[0]')=? OR json_extract(payload,'$.wallets[1]')=?) LIMIT 1").bind(now,now-15000,wallet,wallet).first();if(active)throw new GameError('ACTIVE_ROOM');
            const payment=body.deposit?await finance?.terms(wallet,body.deposit):null;if(body.deposit&&!payment)throw new GameError('ESCROW_UNAVAILABLE');
            for (let attempt = 0; attempt < 5; attempt++) {
                const code = roomCode(), p = { createdAt:now,selectionVersion:body.selectionVersion===1?1:0,...(payment?{payment}:{}),wallets:[wallet,''],names:[playerName,''], s: Array.from(createState(body.character, 1 - body.character)), tokens: [hash, ''], m: [0, 0], pulse: [0, 0], seq: [0, 0], seen: [now, now], last: now, flags: [0, 0], logs: [], lastMask: [0, 0], buckets: [0, 0], counts: [0, 0] };
                try {
                    const inserted=await db.prepare("INSERT INTO arena_rooms (code,status,quick,updated,expires,version,payload) SELECT ?,'waiting',?,?,?,0,? WHERE ?='' OR NOT EXISTS (SELECT 1 FROM arena_rooms WHERE status IN ('waiting','funding','playing') AND expires>? AND (status<>'waiting' OR updated>?) AND (json_extract(payload,'$.wallets[0]')=? OR json_extract(payload,'$.wallets[1]')=?))").bind(code, action === 'match' ? 1 : 0, now, now + 600000, JSON.stringify(p),wallet,now,now-15000,wallet,wallet).run();if(!inserted.meta.changes)throw new GameError('ACTIVE_ROOM');
                    return response({ code, token: tk, slot: 0, state: p.s,names:p.names, status: 'waiting', locked: false,payment:payment?{key:payment.key,asset:payment.asset,stake:payment.stake,paid:payment.paid}:null });
                }
                catch (e) {
                    if (attempt === 4 || e.message==='ACTIVE_ROOM')
                        throw e;
                }
            }
        }
        if (action !== 'input' && action !== 'leave')
            throw new GameError('未知操作。');
        if (typeof body.code !== 'string' || !codePattern.test(body.code) || typeof body.token !== 'string' || !/^[a-f0-9]{48}$/.test(body.token))
            throw new GameError('房间凭证无效。', 401);
        const hash = await digest(body.token);
        for (let attempt = 0; attempt < 6; attempt++) {
            const row = await read(db, body.code);
            if (!row || row.expires < now)
                throw new GameError('房间已过期。', 404);
            const p = JSON.parse(row.payload), slot = p.tokens.indexOf(hash);
            if(slot>=0&&row['ban'+slot]>now&&action!=='leave')throw new GameError('PLAYER_RESTRICTED',403);
            if (slot < 0)
                throw new GameError('房间凭证无效。', 401);
            if (action === 'leave') {
                if(['finished','cancelled'].includes(row.status))return response({ok:true});
                if (row.status === 'playing') {
                    p.s[1] = 4;
                    p.s[7] = 1 - slot;
                    p.s[4 + 1 - slot] = 2;
                }
                const status = ['waiting','funding'].includes(row.status) ? 'cancelled' : 'finished';
                if (await save(db, row, p, status, now))
                    return response({ ok: true });
                continue;
            }
            const allowed = new Set(['action', 'code', 'token', 'seq', 'mask', 'edges', 'character', 'locked']);
            let invalid = '';
            if (Object.keys(body).some(k => !allowed.has(k)))
                invalid = 'unexpected_field';
            else if ((body.character!==undefined&&body.character!==0&&body.character!==1)||(body.locked!==undefined&&typeof body.locked!=='boolean'))
                invalid = 'invalid_selection';
            else if (!validMask(body.mask) || !Number.isInteger(body.edges) || body.edges < 0 || body.edges > MAX_MASK)
                invalid = 'invalid_input';
            else if (!Number.isSafeInteger(body.seq) || body.seq <= p.seq[slot] || body.seq > p.seq[slot] + 1000)
                invalid = 'replayed_sequence';
            if (!consumeInputBudget(p, slot, now))
                invalid = 'message_rate';
            if (invalid) {
                event(p, slot, invalid, now);
                if (await save(db, row, p, row.status, now))
                    return response({ error: '服务器拒绝异常输入：' + invalid }, invalid === 'message_rate' ? 429 : 400);
                continue;
            }
            // Atomically pair simultaneous quick-match entrants. Lower room code stays host.
            if (row.status === 'waiting' && row.quick && !p.payment && slot === 0) {
                const candidate = await db.prepare("SELECT * FROM arena_rooms WHERE status = 'waiting' AND quick = 1 AND json_type(payload,'$.payment') IS NULL AND json_extract(payload, '$.lock') IS NULL AND code < ? AND updated > ? ORDER BY code LIMIT 1").bind(row.code, now - 15000).first();
                if (candidate) {
                    const other = JSON.parse(candidate.payload);
                    other.wallets ??= ['', '']; other.wallets[1] = p.wallets?.[0] || '';
                    other.tokens[1] = hash;
                    other.s = Array.from(createState(other.s[27], p.s[27]));
                    const fight = new Float32Array(other.s);
                    start(fight);
                    other.s = Array.from(fight);
                    other.last = now;
                    other.seen = [now, now];
                    other.seq[1] = body.seq;
                    other.m[1] = body.mask;
                    other.flags[1] = p.flags[0];
                    const results = await db.batch([
                        db.prepare("UPDATE arena_rooms SET payload = ?, status = 'playing', version = version + 1, updated = ?, expires = ? WHERE code = ? AND version = ? AND status = 'waiting' AND EXISTS (SELECT 1 FROM arena_rooms WHERE code = ? AND version = ? AND status = 'waiting')").bind(JSON.stringify(other), now, now + 600000, candidate.code, candidate.version, row.code, row.version),
                        db.prepare("UPDATE arena_rooms SET status = 'cancelled', version = version + 1 WHERE code = ? AND version = ? AND EXISTS (SELECT 1 FROM arena_rooms WHERE code = ? AND status = 'playing' AND json_extract(payload, '$.tokens[1]') = ?)").bind(row.code, row.version, candidate.code, hash)
                    ]);
                    if (results[0].meta.changes && results[1].meta.changes)
                        return response({ ...publicState({ ...candidate, status: 'playing' }, other, 1), moved: true });
                    continue;
                }
            }
            let phase=row.status;
            if(phase==='funding'){
                // Free rooms share the preparation phase without payment or RPC work.
                if(!p.payment||p.payment.admission||p.payment.paid.every(Boolean)){
                    if(p.selectionVersion===1){
                        p.selection??={until:now+10000,characters:[p.s[27],p.s[55]],locked:[false,false]};
                        if(now<p.selection.until&&!p.selection.locked[slot]){if(body.character!==undefined)p.selection.characters[slot]=body.character;if(body.locked===true)p.selection.locked[slot]=true;}
                    }
                    if(!p.selection||now>=p.selection.until){const fight=p.selection?createState(...p.selection.characters):new Float32Array(p.s);start(fight);p.s=Array.from(fight);p.last=now;p.seen=[now,now];p.m=[0,0];p.pulse=[0,0];delete p.selection;phase='playing';}
                }
                else if(now>=p.payment.fundUntil*1000&&p.payment.checkedChainTime>=p.payment.fundUntil){phase='cancelled';}
            }
            if (phase === 'playing')advance(p, now);
            p.seq[slot] = body.seq;
            p.seen[slot] = now;
            p.m[slot] = body.mask;
            p.pulse[slot] |= body.edges & ACTION_MASK;
            p.inputs ??= [];
            p.inputs.push([p.s[0], slot, body.seq, body.mask, body.edges]);
            if (p.inputs.length > 256)
                p.inputs.shift();
            const status = p.s[1] === 4 ? 'finished' : phase;
            if (await save(db, row, p, status, now))
                return response(publicState({ ...row, status }, p, slot));
        }
        throw new GameError('对局同步繁忙，请稍后重试。', 409);
    }
    catch (e) {
        if (e instanceof GameError || Number.isInteger(e?.status))
            return response({ error: e.message }, e.status);
        console.error('Arena service error', e instanceof Error ? e.message : 'unknown');
        return response({ error: '对战服务暂不可用，请稍后再试。' }, 503);
    }
}

// Reuse the service's existing bounded cleanup tick; no extra scheduler.
export async function expireRooms(db,now=Date.now()){
 const rows=(await db.prepare("SELECT * FROM arena_rooms WHERE status IN ('waiting','funding','playing') AND expires<? ORDER BY expires LIMIT 100").bind(now).all()).results;
 for(const row of rows){const p=JSON.parse(row.payload);await save(db,row,p,'cancelled',now);}
 return rows.length;
}
