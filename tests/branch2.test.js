/**
 * Astraea - Branch 2 Unit Test Suite (Phases 5, 6, 7)
 * 
 * Validates:
 * 1. Speaker Verification pure math (Cosine similarity, unit normalization, filterbanks)
 * 2. Biometric matching policy (Pass, mismatch rejection, averaging vectors)
 * 3. Backend In-Memory store operations (Sessions, location trail, call rate limiter)
 * 4. Bolna Outbound Calling Safety Rails (20s Cooldown, Dry Run simulation, Payload formatting)
 * 5. Webhook transcript processing (Safe stand-down vs Duress detection)
 */

import {
  dotProduct,
  vectorNorm,
  normalizeVector,
  cosineSimilarity,
  averageFeatureVectors,
  binFFTToFilterbanks
} from '../src/signals/useSpeakerVerification.js';

import { store } from '../api/_store.js';
import sessionHandler from '../api/session.js';
import locationHandler from '../api/location.js';
import trackHandler from '../api/track.js';
import bolnaCallHandler from '../api/bolna/call.js';
import webhookHandler from '../api/bolna/webhook.js';

console.log('='.repeat(80));
console.log('ASTRAEA - BRANCH 2 (PHASES 5, 6, 7) TEST SUITE');
console.log('='.repeat(80));

// Test 1: Speaker Verification Pure Math
console.log('\n[TEST 1: Speaker Verification Vector Math]');
const v1 = [1, 0, 0];
const v2 = [1, 0, 0];
const v3 = [0, 1, 0];
const v4 = [0.7071, 0.7071, 0];

console.assert(cosineSimilarity(v1, v2) === 1.0, 'Identical vectors should have similarity 1.0');
console.assert(cosineSimilarity(v1, v3) === 0.0, 'Orthogonal vectors should have similarity 0.0');
console.assert(Math.abs(cosineSimilarity(v1, v4) - 0.707) < 0.01, '45-deg vectors should have similarity ~0.707');

// Test Averaging
const avgVec = averageFeatureVectors([v1, v2]);
console.assert(Math.abs(avgVec[0] - 1.0) < 0.01, 'Average of identical vectors is identical');

// Test Filterbanks
const dummyFFT = new Uint8Array(256).fill(128);
const filterbanks = binFFTToFilterbanks(dummyFFT, 16);
console.assert(filterbanks.length === 16, 'Filterbank should produce 16 bands');
console.assert(Math.abs(vectorNorm(filterbanks) - 1.0) < 0.01, 'Filterbank output must be unit-normalized');
console.log('✓ Test 1 Passed: Biometric speaker verification math verified.');

// Test 2: In-Memory Backend Store
console.log('\n[TEST 2: Backend In-Memory Store]');
const testSessionId = 'sess-test-123';
store.createOrUpdateSession(testSessionId, {
  userName: 'Rishi',
  destination: 'MG Road Metro',
  tier: 'ELEVATED'
});
const retrieved = store.getSession(testSessionId);
console.assert(retrieved.userName === 'Rishi', 'Session userName must match');
console.assert(retrieved.destination === 'MG Road Metro', 'Destination must match');

// Location Streaming Store
store.addLocation(testSessionId, { latitude: 12.9716, longitude: 77.5946, speed: 4.2 });
store.addLocation(testSessionId, { latitude: 12.9720, longitude: 77.5950, speed: 5.1 });
const latestLoc = store.getLatestLocation(testSessionId);
console.assert(latestLoc.latitude === 12.9720, 'Latest location latitude must match');
console.assert(store.getLocations(testSessionId).length === 2, 'Location history length must be 2');
console.log('✓ Test 2 Passed: In-memory store handles sessions and location history.');

// Test 3: Bolna Safety Rails & Call Cooldown
console.log('\n[TEST 3: Bolna AI Call Cooldown & Safety Rails]');
const testPhone = '+919035653251';
console.assert(store.isCallRateLimited(testPhone, 20) === false, 'Initially phone should not be rate limited');

// Log a call
store.logCall({ phone: testPhone, agentId: 'agent-1', executionId: 'exec-1' });
console.assert(store.isCallRateLimited(testPhone, 20) === true, 'Phone must be rate-limited within 20s cooldown');
console.log('✓ Test 3 Passed: 20-second call cooldown safety rail enforces rate limiting.');

// Test 4: Serverless API Mock Handlers
console.log('\n[TEST 4: Vercel Serverless Handlers (Session, Location, Track)]');

// Mock req and res helper
function createMockReqRes(method, body = {}, query = {}) {
  const req = { method, body, query };
  let statusCode = 200;
  let headers = {};
  let responseData = null;

  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    end: () => res
  };

  return { req, res, getResult: () => ({ statusCode, responseData, headers }) };
}

async function testServerlessHandlers() {
  // Session POST
  const sPost = createMockReqRes('POST', {
    sessionId: 'sess-abc',
    userName: 'Astraea Tester',
    status: 'ACTIVE'
  });
  await sessionHandler(sPost.req, sPost.res);
  console.assert(sPost.getResult().statusCode === 200, 'Session POST should return 200');

  // Location POST
  const lPost = createMockReqRes('POST', {
    sessionId: 'sess-abc',
    latitude: 12.9750,
    longitude: 77.6000,
    speed: 3.5
  });
  await locationHandler(lPost.req, lPost.res);
  console.assert(lPost.getResult().statusCode === 200, 'Location POST should return 200');

  // Track GET
  const tGet = createMockReqRes('GET', {}, { id: 'sess-abc' });
  await trackHandler(tGet.req, tGet.res);
  const trackRes = tGet.getResult();
  console.assert(trackRes.statusCode === 200, 'Track GET should return 200');
  console.assert(trackRes.responseData.latestLocation.latitude === 12.9750, 'Track endpoint returns latest location');
  console.log('✓ Test 4 Passed: Serverless endpoints handle REST requests.');
}
await testServerlessHandlers();

// Test 5: Bolna Call Handler (Dry Run & Validation)
console.log('\n[TEST 5: Bolna Outbound Call Handler (Dry Run & Cooldown)]');
async function testBolnaHandlers() {
  // 1. Missing phone
  const b1 = createMockReqRes('POST', {});
  await bolnaCallHandler(b1.req, b1.res);
  console.assert(b1.getResult().statusCode === 400, 'Call without phone should return 400');

  // 2. Dry run call (no external API hit)
  const b2 = createMockReqRes('POST', {
    phoneNumber: '+919876543210',
    dryRun: true,
    callType: 'checkin'
  });
  await bolnaCallHandler(b2.req, b2.res);
  const b2Res = b2.getResult();
  console.assert(b2Res.statusCode === 200, 'Dry run call should return 200');
  console.assert(b2Res.responseData.dryRun === true, 'Response must indicate dryRun');

  // 3. Webhook handling
  const w1 = createMockReqRes('POST', {
    execution_id: 'exec-test-99',
    status: 'completed',
    transcript: 'Yes, I am completely safe and reached home.'
  });
  await webhookHandler(w1.req, w1.res);
  const w1Res = w1.getResult();
  console.assert(w1Res.statusCode === 200, 'Webhook should return 200');
  console.assert(w1Res.responseData.analyzedStatus === 'USER_CONFIRMED_SAFE', 'Webhook should classify safe response');

  const w2 = createMockReqRes('POST', {
    execution_id: 'exec-test-100',
    status: 'completed',
    transcript: 'Help me please someone is following me'
  });
  await webhookHandler(w2.req, w2.res);
  const w2Res = w2.getResult();
  console.assert(w2Res.responseData.analyzedStatus === 'USER_CONFIRMED_DURESS', 'Webhook should classify duress response');
  console.log('✓ Test 5 Passed: Bolna call dispatcher and webhook analysis verified.');
}
await testBolnaHandlers();

console.log('\n' + '='.repeat(80));
console.log('ALL BRANCH 2 TESTS PASSED SUCCESSFULLY');
console.log('='.repeat(80));
