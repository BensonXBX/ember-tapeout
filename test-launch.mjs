import assert from 'node:assert/strict';
import {Wallet} from 'ethers';
import { WebSocket } from './server/vendor/ws/wrapper.mjs';

// Use an isolated local database for these checks; no wallets or chain calls.
const origin = process.argv[2] || 'http://127.0.0.1:3276';
const base = `${origin}/games/ember/`;
const checks = [];
const auth=async body=>{const r=await fetch(base+'api/auth',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json();};
async function testLogin(){const signer=Wallet.createRandom();const challenge=await auth({action:'challenge',address:signer.address,chainId:196});return auth({action:'verify',id:challenge.id,signature:await signer.signMessage(challenge.message)});}
const login=await testLogin(),guestLogin=await testLogin();
const api = async (body, status = 200, source = origin, session = login.session) => {
  const response = await fetch(`${base}api/arena`, { method: 'POST',
    headers: { 'content-type': 'application/json', origin: source }, body: JSON.stringify(['create','join','match'].includes(body.action)?{...body,walletSession:session}:body) });
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
};
for (const file of ['', 'arena.mjs', 'engine.mjs', 'arena.css', 'assets/fighters-v34.png', 'assets/ember-logo.svg']) {
  const r = await fetch(base + file);
  assert.equal(r.status, 200, file);
  if (file.endsWith('.mjs') || file === '') assert.ok(!(await r.text()).includes("'/arena/"));
}
checks.push('page/assets and relocated API');
for (const path of ['server/server.mjs', 'release.json', 'data/arena.sqlite', '.env', '%2e%2e/%2e%2e/release.json']) {
  assert.equal((await fetch(base + path)).status, 404, path);
}
checks.push('private paths denied');
await api({ action: 'create', character: 0 }, 403, 'https://invalid.example');
await api({ action: 'create', character: 0, password: 'test-only-room' },400);
const host = await api({ action: 'create', character: 0 });
try {
  const listing = await api({ action: 'list' });
  assert.ok(listing.rooms.some(r => r.code === host.code && !r.locked));
  assert.ok(!JSON.stringify(listing).includes(host.token));
  const guest = await api({ action: 'join', code: host.code, character: 1 },200,origin,guestLogin.session);
  assert.equal(guest.status, 'playing');
  assert.equal(guest.slot, 1);
  checks.push('public room creation/list/join and token isolation');
  const socket = new WebSocket(base.replace(/^http/, 'ws') + 'api/arena/ws', { origin });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  try {
    const reply = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WS reply timeout')), 8000);
      socket.once('message', buffer => { clearTimeout(timer); resolve(JSON.parse(buffer.toString())); });
    });
    socket.send(JSON.stringify({ id: 1, body: { action: 'input', code: host.code, token: host.token, seq: 1, mask: 0, edges: 0 } }));
    assert.equal((await reply).status, 200);
    checks.push('WebSocket input');
  } finally { socket.close(); }
  await api({ action: 'input', code: host.code, token: host.token, seq: 1, mask: 0, edges: 0 }, 400);
  await api({ action: 'input', code: host.code, token: 'f'.repeat(48), seq: 1, mask: 0, edges: 0 }, 401);
  await api({ action: 'leave', code: guest.code, token: guest.token });
  const final = await api({ action: 'input', code: host.code, token: host.token, seq: 2, mask: 0, edges: 0 });
  assert.equal(final.status, 'finished');
  checks.push('replayed/invalid input rejection and leave settlement');
} finally { await api({ action: 'leave', code: host.code, token: host.token }); }
console.log(JSON.stringify({ origin, checks }, null, 2));
