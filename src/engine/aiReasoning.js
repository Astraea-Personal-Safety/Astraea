/**
 * Astraea - Context-Aware AI Reasoning Engine
 * 
 * DESIGN PRINCIPLE (Feature 10):
 * - Interprets supported voice requests and explains risk signals in natural language.
 * - STRICT SAFETY GUARDRAIL: Emergency escalation and stand-down decisions are strictly
 *   governed by deterministic, predefined safety rules (safe words, silence timeouts,
 *   compounding sensor thresholds), NEVER probabilistic LLM hallucinations.
 * - AI serves as an analytical explainer and intent interpreter, leaving decision enforcement
 *   to hardcoded, auditable safety logic.
 */

/**
 * Generates an interpretable AI summary explaining the exact threat context.
 * 
 * @param {Object} signals - Telemetry inputs
 * @param {Object} riskAssessment - Output from calculateRiskScore
 * @returns {{ summary: string, recommendations: string[], confidence: number }}
 */
export function explainRiskAssessment(signals = {}, riskAssessment = {}) {
  const { score = 0, tier = 'LOW', contributingFactors = [] } = riskAssessment;
  const {
    pace = 'normal',
    stillnessSeconds = 0,
    timeOfDay = 'day',
    routeFamiliarity = 'familiar',
    batteryLevel = 100,
    distressAudio = false,
    deviceImpact = false,
    networkOffline = false,
    journeyShareActive = false
  } = signals;

  const recommendations = [];
  let summary = '';

  if (tier === 'CRITICAL') {
    summary = `Critical threat detected (${score}/100). Compounding emergency indicators require immediate verification. Emergency links armed.`;
    recommendations.push('Enter or speak your secret safe word immediately if you are safe.');
    recommendations.push('If under coercion, enter any other word or remain silent to silently dispatch emergency alerts.');
  } else if (tier === 'HIGH') {
    summary = `High risk pattern detected (${score}/100): Correlated danger signals identified. Multiple vulnerability factors active simultaneously.`;
    recommendations.push('Prepare for an upcoming discreet check-in.');
    recommendations.push('Move toward populated, well-lit areas.');
  } else if (tier === 'ELEVATED') {
    summary = `Elevated risk advisory (${score}/100): Anomaly detected in behavioral or environmental telemetry.`;
    recommendations.push('Maintain awareness of your surroundings.');
    if (!journeyShareActive) {
      recommendations.push('Consider starting a Live Journey session with your Trusted Circle.');
    }
  } else {
    summary = `Safe baseline (${score}/100): All behavioral, kinematic, and environmental indicators are within normal parameters.`;
    recommendations.push('Guardian shield is actively monitoring passive background telemetry.');
  }

  // Contextual Recommendations
  if (batteryLevel < 20) {
    recommendations.push(`Battery low (${batteryLevel}%). Telemetry refresh throttled to conserve power.`);
  }

  if (timeOfDay === 'night' && routeFamiliarity === 'unfamiliar') {
    recommendations.push('You are outside your saved familiar zones at night. Stick to main thoroughfares.');
  }

  if (pace === 'running') {
    recommendations.push('Sustained rapid pace detected. If you are jogging or in transit, this will gradually decay.');
  }

  if (distressAudio) {
    recommendations.push('Acoustic scream frequency spike detected. Voice check-in armed.');
  }

  if (deviceImpact) {
    recommendations.push('Sudden physical shock/impact recorded. Verifying user mobility.');
  }

  if (networkOffline) {
    recommendations.push('Device is offline. Local emergency stand-down remains fully operational on-device.');
  }

  return {
    summary,
    recommendations,
    confidence: 0.96,
    ruleEnforced: true
  };
}

/**
 * Natural-Language Safety Command & Query Intent Parser
 * 
 * Maps open-ended conversational phrases to structured application actions.
 * 
 * @param {string} userQuery - Natural language input
 * @param {Object} currentContext - Current app context
 * @returns {{ intent: string, responseText: string, actionPayload?: Object }}
 */
export function interpretSafetyCommand(userQuery = '', currentContext = {}) {
  const clean = userQuery.trim().toLowerCase();

  // Status inquiries
  if (clean.includes('status') || clean.includes('score') || clean.includes('am i safe') || clean.includes('how am i')) {
    const score = currentContext.score || 0;
    const tier = currentContext.tier || 'LOW';
    return {
      intent: 'GET_STATUS',
      responseText: `Your risk score is ${score} out of 100, which is classified as ${tier} risk. ${currentContext.activeFactorsCount || 0} active signals are being monitored.`
    };
  }

  // Journey start
  if (clean.includes('start walk') || clean.includes('start journey') || clean.includes('walk home') || clean.includes('heading home')) {
    return {
      intent: 'START_JOURNEY',
      responseText: 'Starting Live Journey Share. Live location updates will stream to your Trusted Circle.',
      actionPayload: { label: 'Walk Home' }
    };
  }

  // Journey end
  if (clean.includes('arrived') || clean.includes('end walk') || clean.includes('end journey') || clean.includes('i am safe') || clean.includes('i am home')) {
    return {
      intent: 'END_JOURNEY',
      responseText: 'Ending active journey. Your circle will be notified that you arrived safely.'
    };
  }

  // Emergency SOS
  if (clean.includes('help') || clean.includes('emergency') || clean.includes('call police') || clean.includes('sos') || clean.includes('code red')) {
    return {
      intent: 'TRIGGER_SOS',
      responseText: 'Emergency SOS activated. Local alarm and notification broadcast are now armed.'
    };
  }

  // Location share inquiry
  if (clean.includes('share') || clean.includes('where am i') || clean.includes('location')) {
    return {
      intent: 'SHARE_LOCATION',
      responseText: 'Your live location link is ready to share with your Trusted Circle.'
    };
  }

  // Advice inquiry
  if (clean.includes('advice') || clean.includes('what should i do') || clean.includes('recommend')) {
    const recs = currentContext.recommendations || ['Stay on well-lit streets', 'Keep your safe word in mind'];
    return {
      intent: 'GIVE_ADVICE',
      responseText: recs.join('. ')
    };
  }

  return {
    intent: 'UNKNOWN',
    responseText: "I didn't quite catch that. You can say 'Start walk', 'End journey', 'Status report', or 'Help me'."
  };
}

/**
 * Live Google Gemini API Safety Advisor
 * Sends contextual threat telemetry to Gemini REST API for situational analysis.
 */
export async function fetchGeminiSafetyAnalysis({ apiKey, signals = {}, riskAssessment = {}, userQuery = '' }) {
  if (!apiKey) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = `You are Astraea AI, an expert personal safety advisor.
Analyze the user's situation strictly within safety guardrails:
Context:
- Threat Level: ${riskAssessment.tier} (Score: ${riskAssessment.score}/100)
- Pace: ${signals.pace}
- Time of Day: ${signals.timeOfDay}
- Route: ${signals.routeFamiliarity}
- Battery: ${signals.batteryLevel}%
- Distress Audio Spike: ${signals.distressAudio ? 'YES' : 'NO'}
- Fall / High-G Impact: ${signals.deviceImpact ? 'YES' : 'NO'}
- Network Status: ${signals.networkOffline ? 'OFFLINE' : 'ONLINE'}
User Query: "${userQuery || 'Assess my risk'}"

Provide a concise 2-sentence situational assessment and 2 bullet points of actionable safety advice. Never reveal safe words or give reckless instructions.`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 150, temperature: 0.2 }
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.warn('Gemini API call failed:', err);
    return null;
  }
}
