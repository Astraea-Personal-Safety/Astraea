/**
 * Astraea - Branch 5 Test Suite (Remaining work: relays, webhook, persistent store)
 *
 * Unlike the older suites this one uses node:assert, so any failure exits non-zero.
 * No real network calls are made: global fetch is replaced with an in-process fake
 * (including a tiny fake Upstash Redis REST server).
 */

import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;
const calls = [];
let handlers = [];

globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  for (const h of handlers) {
    const out = await h(String(url), init);
    if (out) return out;
  }
  throw new Error(`Unexpected fetch in test: ${url}`);
};

const jsonRes = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data)
});
const textRes = (text, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => JSON.parse(text),
  text: async () => text
});

function mockReqRes(method, body = {}, query = {}, headers = {}) {
  const req = { method, body, query, headers };
  const out = { statusCode: 200, data: null };
  const res = {
    setHeader() {},
    status(c) { out.statusCode = c; return res; },
    json(d) { out.data = d; return res; },
    end() { return res; }
  };
  return { req, res, out };
}

// ---------------------------------------------------------------------------
console.log('\n[TEST 1: Transcript analysis (callee-only, distress wins)]');
const {
  extractCalleeText, classifySafety, classifyContactResponse, analyzeCall, mapCallStatus
} = await import('../api/_callAnalysis.js');

assert.equal(classifySafety('Yes I am completely safe and reached home.'), 'SAFE');
assert.equal(classifySafety('Help me please someone is following me'), 'DURESS');
assert.equal(classifySafety("I'm safe but please help"), 'DURESS', 'distress must beat reassurance');
assert.equal(classifySafety('I am not safe'), 'DURESS');
assert.equal(classifySafety("I'm fine, no need for help"), 'SAFE', '"no need for help" is neutralised');
assert.equal(classifySafety('main theek hoon'), 'SAFE');
assert.equal(classifySafety('bachao'), 'DURESS');
assert.equal(classifySafety('I will book a cab'), 'NONE', '"book" must not match "ok"');
assert.equal(classifySafety(''), 'NONE');

const labelled = 'assistant: Hello, are you safe? Please say your safe word.\nuser: umm\nassistant: Are you okay?\nuser: help';
assert.equal(extractCalleeText(labelled).trim(), 'umm help');
const agentOnly = 'assistant: Are you safe? Are you okay and fine?\nassistant: Hello?';
assert.equal(extractCalleeText(agentOnly).trim(), '', 'agent script alone must never count as a user answer');
assert.equal(analyzeCall({ status: 'completed', transcript: agentOnly }, 'checkin').analyzedStatus, 'CALL_UNANSWERED');
assert.equal(
  analyzeCall({ status: 'completed', transcript: [{ role: 'assistant', content: 'Are you safe?' }, { role: 'user', content: "I'm okay" }] }, 'checkin').analyzedStatus,
  'USER_CONFIRMED_SAFE'
);
assert.equal(classifyContactResponse("Okay I'm on my way"), 'WILL_ASSIST');
assert.equal(classifyContactResponse('yes understood'), 'ACKNOWLEDGED');
assert.equal(classifyContactResponse('sorry wrong number'), 'DECLINED');
assert.equal(classifyContactResponse(''), 'NO_RESPONSE');
assert.equal(mapCallStatus('no-answer'), 'UNREACHED');
assert.equal(mapCallStatus('call-disconnected'), 'ENDED');
assert.equal(mapCallStatus('in-progress'), 'IN_PROGRESS');
assert.equal(analyzeCall({ status: 'busy' }, 'alert').analyzedStatus, 'CALL_UNANSWERED');
assert.equal(analyzeCall({ status: 'ringing' }, 'alert').terminal, false);
console.log('✓ Test 1 Passed');

// ---------------------------------------------------------------------------
console.log('\n[TEST 2: Webhook links calls to sessions, auth, no auto stand-down]');
const { store } = await import('../api/_store.js');
const callHandler = (await import('../api/bolna/call.js')).default;
const webhook = (await import('../api/bolna/webhook.js')).default;
const trackHandler = (await import('../api/track.js')).default;

// Dispatch (dry run) is recorded; use the real record path via saveCallResult directly for linkage
await store.createOrUpdateSession('sos-777', { userName: 'Tester', status: 'SOS_ACTIVE', tier: 'CRITICAL', circleContacts: [] });
await store.saveCallResult('exec-alert-1', { status: 'dispatched', callType: 'alert', sessionId: 'sos-777' });

let r = mockReqRes('POST', { execution_id: 'exec-alert-1', status: 'completed', transcript: 'assistant: Rishi may be in danger.\nuser: ok I am on my way' });
await webhook(r.req, r.res);
assert.equal(r.out.statusCode, 200);
assert.equal(r.out.data.callType, 'alert');
assert.equal(r.out.data.analyzedStatus, 'CONTACT_WILL_ASSIST');
const sess = await store.getSession('sos-777');
assert.equal(sess.contactAcknowledged, true);
assert.equal(sess.lastCall.analyzedStatus, 'CONTACT_WILL_ASSIST');
assert.equal(sess.status, 'SOS_ACTIVE', 'webhook must never stand an SOS down');

// A late in-progress event must not overwrite the final result
r = mockReqRes('POST', { execution_id: 'exec-alert-1', status: 'in-progress' });
await webhook(r.req, r.res);
assert.equal(r.out.data.analyzedStatus, 'CONTACT_WILL_ASSIST');

// Public tracking exposes the acknowledgement flag but never the transcript
r = mockReqRes('GET', {}, { id: 'sos-777' });
await trackHandler(r.req, r.res);
assert.equal(r.out.data.contactAcknowledged, true);
assert.ok(!JSON.stringify(r.out.data).includes('on my way'), 'transcript must not leak to /api/track');

// Secret enforcement
process.env.BOLNA_WEBHOOK_SECRET = 's3cret';
r = mockReqRes('POST', { execution_id: 'x', status: 'completed' });
await webhook(r.req, r.res);
assert.equal(r.out.statusCode, 401);
r = mockReqRes('POST', { execution_id: 'x', status: 'completed', transcript: 'fine' }, { secret: 's3cret' });
await webhook(r.req, r.res);
assert.equal(r.out.statusCode, 200);
delete process.env.BOLNA_WEBHOOK_SECRET;

// call.js records the session link (dry run path doesn't hit Bolna)
r = mockReqRes('POST', { phoneNumber: '+919000000001', dryRun: true, sessionId: 'sos-1' });
await callHandler(r.req, r.res);
assert.equal(r.out.data.dryRun, true);
console.log('✓ Test 2 Passed');

// ---------------------------------------------------------------------------
console.log('\n[TEST 3: Telegram relay]');
const telegram = (await import('../api/dispatch/telegram.js')).default;

r = mockReqRes('POST', {});
await telegram(r.req, r.res);
assert.equal(r.out.statusCode, 400);

r = mockReqRes('POST', { messageText: 'hi' });
await telegram(r.req, r.res);
assert.equal(r.out.statusCode, 503, 'unconfigured server must say so');
assert.equal(r.out.data.configured, false);

process.env.TELEGRAM_BOT_TOKEN = '123:ABC';
process.env.TELEGRAM_CHAT_ID = '999';
handlers = [(url) => url === 'https://api.telegram.org/bot123:ABC/sendMessage'
  ? jsonRes({ ok: true, result: {} }) : null];
r = mockReqRes('POST', { messageText: 'x'.repeat(5000) });
await telegram(r.req, r.res);
assert.equal(r.out.statusCode, 200);
const sent = JSON.parse(calls.at(-1).init.body);
assert.equal(sent.chat_id, '999');
assert.equal(sent.text.length, 1500, 'text is capped');

r = mockReqRes('POST', { messageText: 'again' });
await telegram(r.req, r.res);
assert.equal(r.out.statusCode, 429, 'cooldown blocks rapid repeats');

delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;
console.log('✓ Test 3 Passed');

// ---------------------------------------------------------------------------
console.log('\n[TEST 4: WhatsApp relay]');
const whatsapp = (await import('../api/dispatch/whatsapp.js')).default;

r = mockReqRes('POST', { phone: '+919035653251', messageText: 'hi' });
await whatsapp(r.req, r.res);
assert.equal(r.out.statusCode, 503);

process.env.CALLMEBOT_API_KEY = 'cmb-key';
r = mockReqRes('POST', { phone: '+919035653251', messageText: 'hi' });
await whatsapp(r.req, r.res);
assert.equal(r.out.statusCode, 403, 'empty VERIFIED_PHONE_NUMBERS must not send');

process.env.VERIFIED_PHONE_NUMBERS = '+919035653251, +911111111111';
r = mockReqRes('POST', { phone: '+910000000000', messageText: 'hi' });
await whatsapp(r.req, r.res);
assert.equal(r.out.statusCode, 403, 'unverified recipient blocked');

handlers = [(url) => url.startsWith('https://api.callmebot.com/whatsapp.php')
  ? textRes('<b>Message queued.</b> You will receive it in a few seconds.') : null];
r = mockReqRes('POST', { phone: '91 90356 53251', messageText: 'sos' });
await whatsapp(r.req, r.res);
assert.equal(r.out.statusCode, 200);
assert.equal(r.out.data.gateway, 'callmebot');
assert.ok(calls.at(-1).url.includes('apikey=cmb-key'));
assert.ok(calls.at(-1).url.includes('phone=%2B919035653251'));

handlers = [(url) => url.startsWith('https://api.callmebot.com/')
  ? textRes('ERROR: APIKey is invalid') : null];
r = mockReqRes('POST', { phone: '+911111111111', messageText: 'sos' });
await whatsapp(r.req, r.res);
assert.equal(r.out.statusCode, 502, 'gateway-reported failures are surfaced, not hidden');

delete process.env.CALLMEBOT_API_KEY;
delete process.env.VERIFIED_PHONE_NUMBERS;
console.log('✓ Test 4 Passed');

// ---------------------------------------------------------------------------
console.log('\n[TEST 5: Persistent store over Upstash REST (fake server)]');
const db = new Map();
const lists = new Map();
const exp = new Map();
const redisFake = (url, init) => {
  if (!url.startsWith('https://fake-redis.test/pipeline')) return null;
  assert.equal(init.headers.Authorization, 'Bearer tok');
  const cmds = JSON.parse(init.body);
  const results = cmds.map(([cmd, key, ...args]) => {
    switch (cmd) {
      case 'GET': return { result: db.get(key) ?? null };
      case 'SET': {
        if (args.includes('NX') && db.has(key)) return { result: null };
        db.set(key, args[0]);
        return { result: 'OK' };
      }
      case 'RPUSH': { const l = lists.get(key) || []; l.push(args[0]); lists.set(key, l); return { result: l.length }; }
      case 'LTRIM': { const l = lists.get(key) || []; const keep = args[0] < 0 ? l.slice(args[0]) : l.slice(args[0]); lists.set(key, keep); return { result: 'OK' }; }
      case 'EXPIRE': exp.set(key, args[0]); return { result: 1 };
      case 'LRANGE': {
        const l = lists.get(key) || [];
        const [a, b] = args;
        const start = a < 0 ? Math.max(l.length + a, 0) : a;
        const end = b < 0 ? l.length + b : b;
        return { result: l.slice(start, end + 1) };
      }
      default: return { error: `unknown ${cmd}` };
    }
  });
  return jsonRes(results);
};

process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
handlers = [redisFake];
const { isPersistent } = await import('../api/_store.js');
assert.equal(isPersistent(), true);

await store.createOrUpdateSession('persist-1', { userName: 'A', tier: 'LOW' });
await store.createOrUpdateSession('persist-1', { tier: 'HIGH' });
const ps = await store.getSession('persist-1');
assert.equal(ps.userName, 'A');
assert.equal(ps.tier, 'HIGH', 'second write merges over the first');
assert.ok(db.has('astraea:session:persist-1'), 'session really went to Redis');

// Simulate a cold start on another instance: nothing in memory, data still in Redis
db.set('astraea:session:cold-1', JSON.stringify({ sessionId: 'cold-1', userName: 'Cold' }));
assert.equal((await store.getSession('cold-1')).userName, 'Cold');

await store.addLocation('persist-1', { latitude: 1, longitude: 2 });
await store.addLocation('persist-1', { latitude: 3, longitude: 4 });
assert.equal((await store.getLocations('persist-1')).length, 2);
assert.equal((await store.getLatestLocation('persist-1')).latitude, 3);

await store.logCall({ phone: '+919999999999', agentId: 'a', executionId: 'e' });
assert.equal(await store.isCallRateLimited('+919999999999', 20), true);
assert.equal(await store.isCallRateLimited('+918888888888', 20), false);

assert.equal(await store.tryAcquire('k1', 10), true);
assert.equal(await store.tryAcquire('k1', 10), false, 'NX key blocks the second acquire');

// Redis outage -> graceful in-memory fallback (never throws into the emergency flow)
handlers = [() => { throw new Error('network down'); }];
const warn = console.warn; console.warn = () => {};
const fb = await store.createOrUpdateSession('outage-1', { userName: 'Fallback' });
assert.equal(fb.userName, 'Fallback');
assert.equal((await store.getSession('outage-1')).userName, 'Fallback');
console.warn = warn;

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
assert.equal(isPersistent(), false);
console.log('✓ Test 5 Passed');

// ---------------------------------------------------------------------------
console.log('\n[TEST 6: Client delivery service uses server relays as fallback]');
const { sendTelegramAlert, sendDirectWhatsAppAlert } = await import('../src/engine/deliveryService.js');

handlers = [(url) => url === '/api/dispatch/telegram' ? jsonRes({ success: true, gateway: 'telegram' }) : null];
let t = await sendTelegramAlert({ messageText: 'sos' });
assert.equal(t.success, true);
assert.equal(t.via, 'server');

handlers = [(url) => url === '/api/dispatch/telegram' ? jsonRes({ success: false, configured: false }, 503) : null];
t = await sendTelegramAlert({ messageText: 'sos' });
assert.equal(t.success, false);
assert.match(t.error, /credentials missing/i);

handlers = [(url) => url === '/api/dispatch/whatsapp' ? jsonRes({ success: true, gateway: 'callmebot' }) : null];
let w = await sendDirectWhatsAppAlert({ phone: '+919035653251', messageText: 'sos' });
assert.equal(w.success, true);
assert.equal(w.via, 'server');

handlers = [(url) => url.startsWith('https://api.callmebot.com/') ? { ok: true, status: 0 } : null];
w = await sendDirectWhatsAppAlert({ phone: '+919035653251', messageText: 'sos', gatewayType: 'callmebot', apiKey: 'k' });
assert.equal(w.success, true);
assert.equal(w.unverified, true, 'no-cors CallMeBot result is flagged as unverified');
console.log('✓ Test 6 Passed');

globalThis.fetch = realFetch;
console.log('\n' + '='.repeat(80));
console.log('ALL BRANCH 5 TESTS PASSED SUCCESSFULLY');
console.log('='.repeat(80));
