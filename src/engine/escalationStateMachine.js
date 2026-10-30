/**
 * Astraea - Multi-Tier Escalation State Machine
 * 
 * Formal States:
 * - IDLE: App is inactive or standby
 * - MONITORING: Active walk/journey or sensor background monitoring
 * - CHECK_IN: Prompt active awaiting safe word verification (Window 1, 2, or 3)
 * - ESCALATED: Emergency state active (Circle broadcast, Bolna outbound AI call, 112 hotline)
 * - RESOLVED: Stood down via secret safe phrase or explicit user reset
 */

export const ESCALATION_STATES = {
  IDLE: 'IDLE',
  MONITORING: 'MONITORING',
  CHECK_IN: 'CHECK_IN',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED'
};

export const ESCALATION_TIERS = {
  TIER_0_NORMAL: 'TIER_0_NORMAL',       // Low risk (< 30)
  TIER_1_ELEVATED: 'TIER_1_ELEVATED',   // 30 - 59: Visual prompt & circle ping if journey active
  TIER_2_HIGH: 'TIER_2_HIGH',           // 60 - 84: Audio chirp & 20s check-in countdown
  TIER_3_CRITICAL: 'TIER_3_CRITICAL'    // >= 85 or 3 missed check-ins: Full escalation
};

/**
 * Pure transition function for the escalation state machine
 */
export function transitionEscalationState(currentState, event) {
  const { type } = event;

  switch (currentState) {
    case ESCALATION_STATES.IDLE:
      if (type === 'START_MONITORING') return ESCALATION_STATES.MONITORING;
      if (type === 'TRIGGER_SOS') return ESCALATION_STATES.ESCALATED;
      return ESCALATION_STATES.IDLE;

    case ESCALATION_STATES.MONITORING:
      if (type === 'RISK_THRESHOLD_EXCEEDED') return ESCALATION_STATES.CHECK_IN;
      if (type === 'TRIGGER_SOS') return ESCALATION_STATES.ESCALATED;
      if (type === 'STOP_MONITORING') return ESCALATION_STATES.IDLE;
      return ESCALATION_STATES.MONITORING;

    case ESCALATION_STATES.CHECK_IN:
      if (type === 'SAFE_WORD_VERIFIED') return ESCALATION_STATES.RESOLVED;
      if (type === 'CHECK_IN_EXHAUSTED' || type === 'TRIGGER_SOS' || type === 'COVERT_DURESS') {
        return ESCALATION_STATES.ESCALATED;
      }
      return ESCALATION_STATES.CHECK_IN;

    case ESCALATION_STATES.ESCALATED:
      if (type === 'SAFE_WORD_VERIFIED') return ESCALATION_STATES.RESOLVED;
      return ESCALATION_STATES.ESCALATED;

    case ESCALATION_STATES.RESOLVED:
      if (type === 'RESET_TO_IDLE') return ESCALATION_STATES.IDLE;
      if (type === 'RESUME_MONITORING') return ESCALATION_STATES.MONITORING;
      return ESCALATION_STATES.RESOLVED;

    default:
      return ESCALATION_STATES.IDLE;
  }
}

/**
 * Evaluates the required action bundle when reaching ESCALATED state
 */
export function evaluateEscalationActions({
  primaryContactPhone,
  userName = 'User',
  trackingId = '',
  reason = 'silence_timeout',
  isDryRun = false
}) {
  const trackingUrl = trackingId ? `https://astraea-safety.vercel.app/track/${trackingId}` : '';
  
  return {
    state: ESCALATION_STATES.ESCALATED,
    shouldTriggerBolnaCall: Boolean(primaryContactPhone),
    bolnaCallConfig: primaryContactPhone ? {
      phoneNumber: primaryContactPhone,
      callType: 'alert',
      recipientName: userName,
      trackingUrl,
      emergencyReason: reason,
      dryRun: isDryRun
    } : null,
    directDialTelLink: primaryContactPhone ? `tel:${primaryContactPhone}` : null,
    emergencyPoliceLink: 'tel:112',
    timestamp: Date.now()
  };
}
