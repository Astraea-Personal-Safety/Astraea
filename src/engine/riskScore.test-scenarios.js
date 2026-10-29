/**
 * Astraea - Risk Scoring Engine Test Scenarios
 * 
 * Demonstrates and validates the deterministic behavior of calculateRiskScore()
 * across key benchmark scenarios.
 */

import { calculateRiskScore, decayScore, TIER_THRESHOLDS } from './riskScore.js';

const scenarios = [
  {
    name: '1. Fully Normal Day',
    description: 'Daytime walk on familiar route in a populated area with normal pace.',
    signals: {
      pace: 'normal',
      stillnessSeconds: 0,
      crowdDensity: 'large',
      timeOfDay: 'day',
      routeFamiliarity: 'familiar',
      batteryLevel: 95,
      batteryDropType: 'none',
      journeyShareActive: false
    },
    previousScore: 0,
    secondsElapsed: 0
  },
  {
    name: '2. Normal Night',
    description: 'Nighttime walk on familiar route with normal pace and bystanders present.',
    signals: {
      pace: 'normal',
      stillnessSeconds: 0,
      crowdDensity: 'large',
      timeOfDay: 'night',
      routeFamiliarity: 'familiar',
      batteryLevel: 80,
      batteryDropType: 'none',
      journeyShareActive: false
    },
    previousScore: 0,
    secondsElapsed: 0
  },
  {
    name: '3. Accelerating Pace + Deserted + Night + Unfamiliar Route',
    description: 'Nighttime, off-route, deserted area, accelerating pace (correlated danger).',
    signals: {
      pace: 'increasing',
      stillnessSeconds: 0,
      crowdDensity: 'none',
      timeOfDay: 'night',
      routeFamiliarity: 'unfamiliar',
      batteryLevel: 65,
      batteryDropType: 'none',
      journeyShareActive: false
    },
    previousScore: 0,
    secondsElapsed: 0
  },
  {
    name: '4. Prolonged Stillness Alone',
    description: '120 seconds stationary in an isolated spot at night.',
    signals: {
      pace: 'normal',
      stillnessSeconds: 120,
      crowdDensity: 'none',
      timeOfDay: 'night',
      routeFamiliarity: 'familiar',
      batteryLevel: 50,
      batteryDropType: 'none',
      journeyShareActive: false
    },
    previousScore: 0,
    secondsElapsed: 0
  },
  {
    name: '5. Running Pace Alone (Everything Else Normal)',
    description: 'Sprinting during daytime on familiar route (e.g., jogging or rushed errand).',
    signals: {
      pace: 'running',
      stillnessSeconds: 0,
      crowdDensity: 'large',
      timeOfDay: 'day',
      routeFamiliarity: 'familiar',
      batteryLevel: 88,
      batteryDropType: 'none',
      journeyShareActive: false
    },
    previousScore: 0,
    secondsElapsed: 0
  },
  {
    name: '6. Battery Instant-Drop While Otherwise Calm',
    description: 'Instant battery plunge during calm daytime with no active environmental threats.',
    signals: {
      pace: 'normal',
      stillnessSeconds: 0,
      crowdDensity: 'large',
      timeOfDay: 'day',
      routeFamiliarity: 'familiar',
      batteryLevel: 8,
      batteryDropType: 'instant',
      journeyShareActive: false
    },
    previousScore: 0,
    secondsElapsed: 0
  },
  {
    name: '7. Battery Instant-Drop While Already Elevated',
    description: 'Instant battery plunge while in an unfamiliar area at night with a small group tailing.',
    signals: {
      pace: 'normal',
      stillnessSeconds: 0,
      crowdDensity: 'small',
      timeOfDay: 'night',
      routeFamiliarity: 'unfamiliar',
      batteryLevel: 10,
      batteryDropType: 'instant',
      journeyShareActive: false
    },
    previousScore: 0,
    secondsElapsed: 0
  },
  {
    name: '8. Full Critical Scenario (Compound Worst-Case)',
    description: 'Night + Unfamiliar + Small loitering group + Sprinting/Fleeing + Instant battery drop.',
    signals: {
      pace: 'running',
      stillnessSeconds: 0,
      crowdDensity: 'small',
      timeOfDay: 'night',
      routeFamiliarity: 'unfamiliar',
      batteryLevel: 4,
      batteryDropType: 'instant',
      journeyShareActive: false
    },
    previousScore: 0,
    secondsElapsed: 0
  },
  {
    name: '9. Temporal Decay Validation (De-escalation)',
    description: 'Previous score of 70 (High) decays after 40 seconds of returning to calm baseline.',
    signals: {
      pace: 'normal',
      stillnessSeconds: 0,
      crowdDensity: 'large',
      timeOfDay: 'day',
      routeFamiliarity: 'familiar',
      batteryLevel: 90,
      batteryDropType: 'none',
      journeyShareActive: false
    },
    previousScore: 70,
    secondsElapsed: 40
  },
  {
    name: '10. Instant Escalation Over Previous Low Score',
    description: 'Previous score of 20 (Low) confronted with a fresh high-threat burst (running + night + unfamiliar + isolated). Must instantly jump to 90 without blending or sluggish drag.',
    signals: {
      pace: 'running',
      stillnessSeconds: 0,
      crowdDensity: 'none',
      timeOfDay: 'night',
      routeFamiliarity: 'unfamiliar',
      batteryLevel: 80,
      batteryDropType: 'none',
      journeyShareActive: false
    },
    previousScore: 20,
    secondsElapsed: 5
  }
];

console.log('='.repeat(80));
console.log('ASTRAEA - RISK SCORING ENGINE SCENARIO VALIDATION');
console.log('Thresholds:', JSON.stringify(TIER_THRESHOLDS));
console.log('='.repeat(80));

scenarios.forEach((sc, idx) => {
  const result = calculateRiskScore(sc.signals, sc.previousScore, sc.secondsElapsed);
  console.log(`\nScenario ${idx + 1}: ${sc.name}`);
  console.log(`Context: ${sc.description}`);
  console.log(`Inputs:`, JSON.stringify(sc.signals));
  if (sc.previousScore) {
    console.log(`Previous Score: ${sc.previousScore} (Elapsed: ${sc.secondsElapsed}s)`);
  }
  console.log(`>> RESULT -> SCORE: ${result.score}/100 | TIER: [${result.tier}]`);
  console.log(`>> Contributing Factors (${result.contributingFactors.length}):`);
  result.contributingFactors.forEach(f => console.log(`   - ${f}`));
  console.log('-'.repeat(80));
});

console.log('\n[TEST DECAY DIRECTLY]');
console.log(`decayScore(80, 20s) => ${decayScore(80, 20)} (expected 70 with 0.5/s decay)`);
console.log(`decayScore(50, 60s) => ${decayScore(50, 60)} (expected 20 with 0.5/s decay)`);
console.log(`decayScore(15, 60s) => ${decayScore(15, 60)} (expected 0 clamped)`);
console.log('='.repeat(80));
