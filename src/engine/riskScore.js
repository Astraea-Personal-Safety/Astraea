/**
 * Astraea - Composite Risk Scoring Engine
 * 
 * DESIGN PRINCIPLES:
 * - Pure functions only: Zero DOM, zero React state, zero external dependencies.
 * - Framework-agnostic: Fully testable in isolation and directly reusable across
 *   Node.js microservices, Web Workers, edge functions, React Native, or wearable runtimes.
 * - Bias toward recall over precision ("better a false alert than a missed one").
 * - Multi-signal compounding: Correlated risks multiply rather than add linearly.
 * - Contextual battery modification: Hardware anomalies only amplify existing threat context.
 * - Asymmetric responsiveness: Immediate escalation on threat, graceful temporal decay on calm.
 */

/**
 * Signal Weight Constants
 * Calibrated for a 0-100 normalized risk score range.
 */
export const WEIGHTS = {
  // Movement & Pace signals
  PACE_RUNNING: 30,             // Sudden sprint or fleeing behavior
  PACE_INCREASING: 15,          // Accelerating cadence / potential evasion
  STILLNESS_PER_30S: 10,        // Stationary duration penalty (scales per 30s)
  STILLNESS_MAX_CAP: 30,        // Upper bound cap on stillness contribution

  // Environmental & Proximity signals
  CROWD_SMALL_GROUP: 20,       // 1-8 people nearby (loitering / potential tailing threat)
  CROWD_NONE: 10,              // Complete isolation (vulnerability factor)
  CROWD_LARGE: 0,              // Dense public crowd (protective witness density)

  // Contextual Baselines (ambient offsets, not independent alarms)
  NIGHT_BASE: 15,              // Elevated vulnerability baseline during late hours
  UNFAMILIAR_ROUTE: 12,        // Navigating outside historical geofenced comfort zones

  // Hardware / Power Modifiers
  BATTERY_INSTANT_DROP: 25,    // Sudden voltage plunge / potential device tampering or force-quit
  BATTERY_LOW_GRADUAL: 8,      // Depleted power reserve (< 20%) limiting rescue connectivity

  // Proactive User Protection
  JOURNEY_SHARE_ACTIVE: -5,    // Live session actively monitored by Trusted Circle (slight offset)

  // Real Sensor Hardware Additions
  DISTRESS_AUDIO: 35,          // Acoustic distress / screaming detected via Web Audio API
  DEVICE_IMPACT: 25,           // Sudden physical shock / fall detected via DeviceMotionEvent
  NETWORK_OFFLINE: 10          // Loss of network connectivity during active journey
};

/**
 * Escalation Tiers & Numeric Thresholds
 */
export const TIERS = {
  LOW: 'LOW',                  // 0-29: Normal routine, silent monitoring
  ELEVATED: 'ELEVATED',        // 30-59: Mild anomaly, silent self-check-in timer started
  HIGH: 'HIGH',                // 60-84: High threat, urgent safe-word verification required
  CRITICAL: 'CRITICAL'         // 85-100: Emergency escalation, Trusted Circle & SOS alert ready
};

export const TIER_THRESHOLDS = {
  LOW: 0,
  ELEVATED: 30,
  HIGH: 60,
  CRITICAL: 85
};

/**
 * Temporal Decay Configuration
 * Score drops by 0.5 points per second (30 pts per minute) when environmental signals return to calm.
 */
export const DECAY_RATE_PER_SECOND = 0.5;

/**
 * Pure helper to decay a risk score over elapsed time.
 * Score trends back toward 0 without abrupt visual flickering or jarring tier resets.
 * 
 * @param {number} currentScore - Existing numeric score (0-100)
 * @param {number} secondsSinceLastUpdate - Seconds elapsed since last evaluation
 * @returns {number} Decayed score clamped to [0, 100]
 */
export function decayScore(currentScore, secondsSinceLastUpdate = 0) {
  if (!currentScore || currentScore <= 0 || secondsSinceLastUpdate <= 0) {
    return Math.max(0, currentScore || 0);
  }
  const decayAmount = secondsSinceLastUpdate * DECAY_RATE_PER_SECOND;
  return Math.max(0, Math.round((currentScore - decayAmount) * 10) / 10);
}

/**
 * Resolves the numeric risk score to its corresponding Escalation Tier.
 * 
 * @param {number} score - Score between 0 and 100
 * @returns {'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL'}
 */
export function getTierFromScore(score) {
  if (score >= TIER_THRESHOLDS.CRITICAL) return TIERS.CRITICAL;
  if (score >= TIER_THRESHOLDS.HIGH) return TIERS.HIGH;
  if (score >= TIER_THRESHOLDS.ELEVATED) return TIERS.ELEVATED;
  return TIERS.LOW;
}

/**
 * Main Composite Risk Scoring Function
 * 
 * Evaluates behavioral and environmental signals to produce a compound risk score,
 * assigned tier, and transparent list of contributing factors for demo inspectability.
 * 
 * @param {Object} signals - Current telemetry snapshot
 * @param {('normal'|'increasing'|'running')} [signals.pace='normal'] - Movement speed
 * @param {number} [signals.stillnessSeconds=0] - Continuous seconds stationary
 * @param {('none'|'small'|'large')} [signals.crowdDensity='large'] - Nearby bystander density
 * @param {('day'|'night')} [signals.timeOfDay='day'] - Temporal environment
 * @param {('familiar'|'unfamiliar')} [signals.routeFamiliarity='familiar'] - Route deviation
 * @param {number} [signals.batteryLevel=100] - Device battery percentage (0-100)
 * @param {('none'|'gradual'|'instant')} [signals.batteryDropType='none'] - Battery discharge signature
 * @param {boolean} [signals.journeyShareActive=false] - Whether live session is monitored
 * @param {number} [previousScore=0] - Previous risk score for temporal smoothing and decay
 * @param {number} [secondsElapsed=0] - Seconds since previous evaluation
 * 
 * @returns {{ score: number, tier: 'LOW'|'ELEVATED'|'HIGH'|'CRITICAL', contributingFactors: string[] }}
 */
export function calculateRiskScore(signals = {}, previousScore = 0, secondsElapsed = 0) {
  const {
    pace = 'normal',
    stillnessSeconds = 0,
    crowdDensity = 'large',
    timeOfDay = 'day',
    routeFamiliarity = 'familiar',
    batteryLevel = 100,
    batteryDropType = 'none',
    journeyShareActive = false,
    distressAudio = false,
    deviceImpact = false,
    networkOffline = false
  } = signals;

  const contributingFactors = [];
  let baseScore = 0;
  let activeRiskSignalsCount = 0;

  // Real Hardware Sensor: Acoustic Distress Detection (Web Audio API)
  if (distressAudio) {
    baseScore += WEIGHTS.DISTRESS_AUDIO;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Ambient distress sound / scream signature detected (+${WEIGHTS.DISTRESS_AUDIO} pts)`);
  }

  // Real Hardware Sensor: Device Impact / Fall Detection (DeviceMotionEvent)
  if (deviceImpact) {
    baseScore += WEIGHTS.DEVICE_IMPACT;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Sudden physical impact or violent fall detected (+${WEIGHTS.DEVICE_IMPACT} pts)`);
  }

  // Real Hardware Sensor: Network Disconnection during transit
  if (networkOffline && journeyShareActive) {
    baseScore += WEIGHTS.NETWORK_OFFLINE;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Network connection lost during active journey (+${WEIGHTS.NETWORK_OFFLINE} pts)`);
  }

  // 1. Movement & Pace Evaluation
  if (pace === 'running') {
    baseScore += WEIGHTS.PACE_RUNNING;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Rapid / sprinting pace detected (+${WEIGHTS.PACE_RUNNING} pts)`);
  } else if (pace === 'increasing') {
    baseScore += WEIGHTS.PACE_INCREASING;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Sudden acceleration / evasive pace (+${WEIGHTS.PACE_INCREASING} pts)`);
  }

  // 2. Stillness Evaluation (Stationary in potentially vulnerable spot)
  if (stillnessSeconds > 30) {
    const intervals = Math.floor((stillnessSeconds - 30) / 30) + 1;
    const stillnessPoints = Math.min(WEIGHTS.STILLNESS_MAX_CAP, intervals * WEIGHTS.STILLNESS_PER_30S);
    baseScore += stillnessPoints;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Prolonged stillness (${stillnessSeconds}s stationary, +${stillnessPoints} pts)`);
  }

  // 3. Bystander & Crowd Density Evaluation
  if (crowdDensity === 'small') {
    baseScore += WEIGHTS.CROWD_SMALL_GROUP;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Isolated small group / loitering proximity (+${WEIGHTS.CROWD_SMALL_GROUP} pts)`);
  } else if (crowdDensity === 'none') {
    baseScore += WEIGHTS.CROWD_NONE;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Deserted area / zero bystander density (+${WEIGHTS.CROWD_NONE} pts)`);
  }

  // 4. Temporal Context
  if (timeOfDay === 'night') {
    baseScore += WEIGHTS.NIGHT_BASE;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Nighttime vulnerability baseline (+${WEIGHTS.NIGHT_BASE} pts)`);
  }

  // 5. Route Familiarity
  if (routeFamiliarity === 'unfamiliar') {
    baseScore += WEIGHTS.UNFAMILIAR_ROUTE;
    activeRiskSignalsCount += 1;
    contributingFactors.push(`Unfamiliar route / perimeter deviation (+${WEIGHTS.UNFAMILIAR_ROUTE} pts)`);
  }

  // 6. Proactive Safeguard Offset
  if (journeyShareActive) {
    baseScore += WEIGHTS.JOURNEY_SHARE_ACTIVE; // negative offset
    contributingFactors.push(`Live Journey Share actively streaming to Circle (${WEIGHTS.JOURNEY_SHARE_ACTIVE} pts)`);
  }

  /**
   * COMPOUNDING MULTIPLIER:
   * Real-world safety risks are not independent additive events.
   * For instance, walking at night on a familiar street is low risk, but walking at night on an
   * unfamiliar route while isolated with an accelerating pace represents strongly correlated danger.
   * Compounding scales the aggregate subtotal exponentially as multiple risk signals coincide.
   */
  let compoundingMultiplier = 1.0;
  if (activeRiskSignalsCount >= 4) {
    compoundingMultiplier = 1.35;
  } else if (activeRiskSignalsCount === 3) {
    compoundingMultiplier = 1.25;
  } else if (activeRiskSignalsCount === 2) {
    compoundingMultiplier = 1.15;
  }

  let subtotal = Math.max(0, baseScore) * compoundingMultiplier;

  if (compoundingMultiplier > 1.0) {
    contributingFactors.push(
      `Cross-signal compounding active (${activeRiskSignalsCount} simultaneous threat factors: ${compoundingMultiplier}x multiplier)`
    );
  }

  /**
   * CONTEXTUAL BATTERY MODIFIER:
   * Battery loss is a modifier, NOT a primary standalone threat trigger.
   * If a user is at home in daytime with no other danger, a 1% battery drop is harmless routine usage.
   * However, if the user is already in an ELEVATED or HIGH risk situation, an instant battery drop
   * indicates high danger (device destruction, battery sabotage, or imminent loss of rescue lifeline).
   * Therefore, battery weight is dynamically scaled by the current situational subtotal.
   */
  let batteryPoints = 0;
  if (batteryDropType === 'instant') {
    batteryPoints = WEIGHTS.BATTERY_INSTANT_DROP;
  } else if (batteryDropType === 'gradual' && batteryLevel <= 20) {
    batteryPoints = WEIGHTS.BATTERY_LOW_GRADUAL;
  }

  if (batteryPoints > 0) {
    // Battery relevance scales from 15% (when calm) to 100% (when already at or near Elevated tier >= 30 pts)
    const contextRelevanceFactor = Math.min(1.0, Math.max(0.15, subtotal / TIER_THRESHOLDS.ELEVATED));
    const effectiveBatteryWeight = Math.round(batteryPoints * contextRelevanceFactor);
    subtotal += effectiveBatteryWeight;

    if (contextRelevanceFactor < 0.5) {
      contributingFactors.push(
        `Battery anomaly detected (+${effectiveBatteryWeight} pts, attenuated because overall context is calm)`
      );
    } else {
      contributingFactors.push(
        `Battery anomaly in active risk zone (+${effectiveBatteryWeight} pts, full threat amplification)`
      );
    }
  }

  // Calculate instantaneous target score (clamped between 0 and 100)
  const instantaneousScore = Math.min(100, Math.max(0, Math.round(subtotal)));

  /**
   * ASYMMETRIC TEMPORAL RESPONSE:
   * - Threat Escalation: Instantaneous (bias toward recall - never delay an escalation).
   * - Threat De-escalation: Smooth decay over time to prevent jitter or premature stand-down.
   */
  let finalScore = instantaneousScore;
  if (previousScore > instantaneousScore && secondsElapsed > 0) {
    const decayedPrevious = decayScore(previousScore, secondsElapsed);
    finalScore = Math.max(instantaneousScore, Math.round(decayedPrevious));
  }

  // Determine final tier
  const tier = getTierFromScore(finalScore);

  // If no factors contributed, log baseline
  if (contributingFactors.length === 0) {
    contributingFactors.push('All environmental & behavioral indicators normal (Safe Baseline)');
  }

  return {
    score: finalScore,
    tier,
    contributingFactors
  };
}
