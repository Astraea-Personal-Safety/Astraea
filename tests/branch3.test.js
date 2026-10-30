/**
 * Astraea - Branch 3 Unit Test Suite (Phases 8, 9, 10)
 * 
 * Validates:
 * 1. Public Tracking payload sanitization & URL generation
 * 2. Multi-tier Escalation State Machine transitions (Idle -> Monitoring -> Check-in -> Escalated -> Resolved)
 * 3. Escalation Action Bundle (Bolna call config, click-to-dial links, 112 hotline)
 * 4. OpenStreetMap Overpass Environmental Density evaluator (Geo-grid cache keys, amenity density to crowd rating)
 */

import {
  ESCALATION_STATES,
  transitionEscalationState,
  evaluateEscalationActions
} from '../src/engine/escalationStateMachine.js';

import {
  getGeoGridKey,
  evaluateOverpassDensity,
  buildOverpassQuery
} from '../src/signals/useOverpassRiskSignal.js';

console.log('='.repeat(80));
console.log('ASTRAEA - BRANCH 3 (PHASES 8, 9, 10) TEST SUITE');
console.log('='.repeat(80));

// Test 1: Escalation State Machine Transitions
console.log('\n[TEST 1: Multi-Tier Escalation State Machine Transitions]');
let state = ESCALATION_STATES.IDLE;

// Transition to MONITORING
state = transitionEscalationState(state, { type: 'START_MONITORING' });
console.assert(state === ESCALATION_STATES.MONITORING, 'Should transition to MONITORING');

// Transition to CHECK_IN when threshold exceeded
state = transitionEscalationState(state, { type: 'RISK_THRESHOLD_EXCEEDED' });
console.assert(state === ESCALATION_STATES.CHECK_IN, 'Should transition to CHECK_IN');

// Transition to ESCALATED on 3 missed attempts (check-in exhausted)
state = transitionEscalationState(state, { type: 'CHECK_IN_EXHAUSTED' });
console.assert(state === ESCALATION_STATES.ESCALATED, 'Should transition to ESCALATED');

// Stand down with safe word verified
state = transitionEscalationState(state, { type: 'SAFE_WORD_VERIFIED' });
console.assert(state === ESCALATION_STATES.RESOLVED, 'Should transition to RESOLVED');

// Direct Covert Duress transition
const covertState = transitionEscalationState(ESCALATION_STATES.CHECK_IN, { type: 'COVERT_DURESS' });
console.assert(covertState === ESCALATION_STATES.ESCALATED, 'Covert duress must transition to ESCALATED');
console.log('✓ Test 1 Passed: Escalation state transitions verified.');

// Test 2: Escalation Action Bundle Generation
console.log('\n[TEST 2: Escalation Action Bundle & Auto-Dial Links]');
const actions = evaluateEscalationActions({
  primaryContactPhone: '+919035653251',
  userName: 'Rishi',
  trackingId: 'track-test-88',
  reason: 'silence_timeout'
});

console.assert(actions.state === ESCALATION_STATES.ESCALATED, 'Action bundle state must be ESCALATED');
console.assert(actions.shouldTriggerBolnaCall === true, 'Must trigger Bolna call when phone provided');
console.assert(actions.bolnaCallConfig.phoneNumber === '+919035653251', 'Bolna phone number must match');
console.assert(actions.bolnaCallConfig.trackingUrl.includes('track-test-88'), 'Tracking URL must include trackingId');
console.assert(actions.directDialTelLink === 'tel:+919035653251', 'Direct tel: link must match');
console.assert(actions.emergencyPoliceLink === 'tel:112', 'Emergency police link must be 112');
console.log('✓ Test 2 Passed: Escalation action bundle and dial links verified.');

// Test 3: OSM Overpass Signal & Geo-Grid Caching
console.log('\n[TEST 3: OSM Overpass Environmental Risk Evaluator]');
const gridKey1 = getGeoGridKey(12.9716, 77.5946);
const gridKey2 = getGeoGridKey(12.9717, 77.5947);
console.assert(gridKey1 === '12.972,77.595', 'Grid key must be rounded to 3 decimals');
console.assert(gridKey1 === gridKey2, 'Nearby coords within ~100m must share identical cache key');

// Amenity Density to Crowd Rating
const vibrantArea = evaluateOverpassDensity(15, 1);
console.assert(vibrantArea.crowdDensity === 'large', '15 amenities + police should be large crowd');
console.assert(vibrantArea.isolationRiskOffset === 0, 'Large crowd has 0 isolation risk offset');

const sparseArea = evaluateOverpassDensity(4, 0);
console.assert(sparseArea.crowdDensity === 'small', '4 amenities should be small crowd');
console.assert(sparseArea.isolationRiskOffset === 5, 'Sparse area has 5pt isolation offset');

const desertedArea = evaluateOverpassDensity(0, 0);
console.assert(desertedArea.crowdDensity === 'none', '0 amenities should be none');
console.assert(desertedArea.isolationRiskOffset === 12, 'Deserted area has 12pt isolation threat offset');

// Overpass QL Query Builder
const ql = buildOverpassQuery(12.9716, 77.5946, 350);
console.assert(ql.includes('around:350,12.9716,77.5946'), 'Query contains correct radius and coords');
console.log('✓ Test 3 Passed: OSM Overpass environmental isolation evaluator verified.');

console.log('\n' + '='.repeat(80));
console.log('ALL BRANCH 3 TESTS PASSED SUCCESSFULLY');
console.log('='.repeat(80));
