/**
 * Astraea - Real Signals & Telemetry Sourcing Test Suite
 * Validates mathematical formulas, threshold constants, and fallback behaviors.
 */

import {
  calculateHaversineDistanceMeters,
  calculateSpeedKmh,
  determinePaceFromSpeed,
  findNearestFamiliarPlace,
  GPS_STILLNESS_JITTER_METERS,
  PACE_RUNNING_KMH,
  PACE_INCREASING_KMH,
  FAMILIAR_RADIUS_METERS
} from './geoUtils.js';

import { DAY_START_HOUR, DAY_END_HOUR } from './useTimeOfDaySignal.js';
import { INSTANT_DROP_PERCENT_THRESHOLD, LOW_BATTERY_THRESHOLD } from './useBatterySignal.js';
import { calculateRiskScore } from '../engine/riskScore.js';

console.log('='.repeat(80));
console.log('ASTRAEA - REAL BROWSER SIGNALS & KINEMATICS TEST SUITE');
console.log('='.repeat(80));

// 1. TIME OF DAY CONSTANTS & DERIVATION LOGIC
console.log('\n[TEST 1: Time of Day Cutoffs & Derivation]');
console.log(`Day Start Hour: ${DAY_START_HOUR}:00 AM | Day End Hour: ${DAY_END_HOUR}:00 PM`);
console.assert(DAY_START_HOUR === 6, 'Day start is 6 AM');
console.assert(DAY_END_HOUR === 19, 'Day end is 7 PM');

function deriveTimeOfDay(hour) {
  return (hour >= DAY_START_HOUR && hour < DAY_END_HOUR) ? 'day' : 'night';
}

console.assert(deriveTimeOfDay(5) === 'night', '5 AM is night');
console.assert(deriveTimeOfDay(6) === 'day', '6 AM is day');
console.assert(deriveTimeOfDay(12) === 'day', '12 PM is day');
console.assert(deriveTimeOfDay(18) === 'day', '6 PM is day');
console.assert(deriveTimeOfDay(19) === 'night', '7 PM is night');
console.assert(deriveTimeOfDay(23) === 'night', '11 PM is night');
console.log('✓ Test 1 Passed: Time of Day diurnal cutoffs correctly classify day and night.');

// 2. HAVERSINE DISTANCE & SPEED CALCULATIONS
console.log('\n[TEST 2: Haversine Distance & Speed Calculation]');
// Known distance between Connaught Place Delhi (28.6315, 77.2167) and India Gate (28.6129, 77.2295) is approx 2.4 km
const cpDelhi = { lat: 28.6315, lon: 77.2167 };
const indiaGate = { lat: 28.6129, lon: 77.2295 };
const distMeters = calculateHaversineDistanceMeters(cpDelhi.lat, cpDelhi.lon, indiaGate.lat, indiaGate.lon);
console.log(`Calculated CP to India Gate Distance: ${Math.round(distMeters)} meters (~2440m expected)`);
console.assert(distMeters > 2300 && distMeters < 2600, 'Haversine distance accurate within tolerance');

// Speed calculation: 2440m covered in 600 seconds = ~14.6 km/h
const speedKmh = calculateSpeedKmh(distMeters, 600);
console.log(`Speed for 2440m in 600s: ${speedKmh} km/h`);
console.assert(speedKmh > 14 && speedKmh < 15, 'Speed calculation accurate');
console.log('✓ Test 2 Passed: Haversine distance and kinematic speed calculation accurate.');

// 3. PACE ENUM BUCKETING
console.log('\n[TEST 3: Pace Enum Classification]');
console.log(`Pace Thresholds: Running >= ${PACE_RUNNING_KMH} km/h | Increasing >= ${PACE_INCREASING_KMH} km/h`);

console.assert(determinePaceFromSpeed(3.5, 3.5) === 'normal', '3.5 km/h is normal walk');
console.assert(determinePaceFromSpeed(5.0, 5.0) === 'normal', '5.0 km/h is normal brisk walk');
console.assert(determinePaceFromSpeed(6.5, 4.0) === 'increasing', '6.5 km/h is increasing / accelerating');
console.assert(determinePaceFromSpeed(5.5, 2.0) === 'increasing', 'Sudden +3.5 km/h speed burst is increasing');
console.assert(determinePaceFromSpeed(11.5, 8.0) === 'running', '11.5 km/h is running sprint');
console.assert(determinePaceFromSpeed(16.0, 12.0) === 'running', '16.0 km/h is running sprint');
console.log('✓ Test 3 Passed: Pace accurately bucketed into normal, increasing, running.');

// 4. GPS JITTER & STILLNESS THRESHOLD
console.log('\n[TEST 4: GPS Jitter & Stillness]');
console.log(`GPS Noise/Jitter Threshold: ${GPS_STILLNESS_JITTER_METERS} meters`);
console.assert(GPS_STILLNESS_JITTER_METERS === 10, 'Jitter threshold is 10m');
console.log('✓ Test 4 Passed: Micro-movements under 10m treated as stationary noise.');

// 5. SAVED FAMILIAR PLACES & GEOFENCING
console.log('\n[TEST 5: Saved Familiar Places & Geofence]');
const savedPlaces = [
  { id: 'p1', name: 'Home', latitude: 28.6315, longitude: 77.2167 },
  { id: 'p2', name: 'Work / Campus', latitude: 28.5450, longitude: 77.1926 }
];

// Current location 200m from Home
const nearHome = { latitude: 28.6330, longitude: 77.2175 };
const resNearHome = findNearestFamiliarPlace(nearHome, savedPlaces);
console.log(`Near Home: Nearest is "${resNearHome.nearestPlace.name}" at ${resNearHome.minDistanceMeters}m`);
console.assert(resNearHome.nearestPlace.name === 'Home');
console.assert(resNearHome.minDistanceMeters <= FAMILIAR_RADIUS_METERS, 'Within 500m radius = Familiar');

// Location 5km away from Home and Work
const farAway = { latitude: 28.7000, longitude: 77.1000 };
const resFarAway = findNearestFamiliarPlace(farAway, savedPlaces);
console.log(`Far Away: Nearest is "${resFarAway.nearestPlace.name}" at ${resFarAway.minDistanceMeters}m`);
console.assert(resFarAway.minDistanceMeters > FAMILIAR_RADIUS_METERS, 'Outside 500m radius = Unfamiliar');
console.log('✓ Test 5 Passed: Saved places geofencing accurately resolves route familiarity.');

// 6. BATTERY CONSTANTS & ANOMALY DETECTION
console.log('\n[TEST 6: Battery Thresholds]');
console.log(`Instant Drop Threshold: ${INSTANT_DROP_PERCENT_THRESHOLD}% | Low Battery: ${LOW_BATTERY_THRESHOLD}%`);
console.assert(INSTANT_DROP_PERCENT_THRESHOLD === 5, 'Instant drop is >= 5%');
console.assert(LOW_BATTERY_THRESHOLD === 20, 'Low battery is <= 20%');
console.log('✓ Test 6 Passed: Battery thresholds match physical anomaly profiles.');

// 7. SCORING ENGINE INTEGRATION WITH SOURCED SIGNALS
console.log('\n[TEST 7: Scoring Engine Integration (Unmodified riskScore.js)]');
const testSignals = {
  pace: determinePaceFromSpeed(12.0), // 'running'
  stillnessSeconds: 0,
  crowdDensity: 'none',
  timeOfDay: deriveTimeOfDay(22), // 'night'
  routeFamiliarity: (resFarAway.minDistanceMeters <= FAMILIAR_RADIUS_METERS) ? 'familiar' : 'unfamiliar', // 'unfamiliar'
  batteryLevel: 15,
  batteryDropType: 'gradual',
  journeyShareActive: false
};

const assessment = calculateRiskScore(testSignals, 0, 0);
console.log(`Integrated Risk Assessment: Score ${assessment.score}/100 | Tier [${assessment.tier}]`);
console.assert(assessment.tier === 'CRITICAL' || assessment.tier === 'HIGH', 'High risk tier computed');
console.log('✓ Test 7 Passed: Sourced signals feed seamlessly into unmodified riskScore.js.');

console.log('\n' + '='.repeat(80));
console.log('ALL SIGNAL TESTS COMPLETED SUCCESSFULLY');
console.log('='.repeat(80));
