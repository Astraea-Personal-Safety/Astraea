import React from 'react';
import { useApp } from '../state/useApp';
import VoiceAssistantBar from './VoiceAssistantBar';
import AmbientDistressMeter from './AmbientDistressMeter';
import './RiskDisplay.css';

export default function RiskDisplay() {
  const {
    riskAssessment,
    isCriticalFlash,
    checkInState,
    currentAttempt,
    countdown,
    isSOSActive,
    CHECKIN_MAX_ATTEMPTS,
    signalSourcesMeta,
    aiExplanation
  } = useApp();

  const { score, tier, contributingFactors } = riskAssessment;

  // Determine tier color class
  const tierClass = tier.toLowerCase(); // 'low' | 'elevated' | 'high' | 'critical'

  // Dynamic context message reflecting pipeline state
  let dynamicStatusMsg = '';
  if (isSOSActive) {
    dynamicStatusMsg = '🚨 EMERGENCY SOS ACTIVE • Dispatch Armed';
  } else if (checkInState === 'prompting') {
    dynamicStatusMsg = `Awaiting Safe-Word (Attempt ${currentAttempt}/${CHECKIN_MAX_ATTEMPTS} • ${countdown}s)`;
  } else if (checkInState === 'waiting_retry') {
    dynamicStatusMsg = `Check-In Standby • Re-prompting in ${countdown}s`;
  } else {
    const tierStatusDefaults = {
      LOW: 'Safe Baseline • Ambient Guard Active',
      ELEVATED: 'Caution Advisory • Anomaly Detected',
      HIGH: 'Threat Pattern • Verification Required',
      CRITICAL: 'Emergency Alarm • Circle Broadcast Ready'
    };
    dynamicStatusMsg = tierStatusDefaults[tier] || 'Monitoring active';
  }

  // Tier metadata for display
  const tierMeta = {
    LOW: {
      label: 'Safe Routine',
      icon: '🛡️',
      actionHint: 'Continuous AI telemetry monitoring. All indicators normal.'
    },
    ELEVATED: {
      label: 'Elevated Risk',
      icon: '⚠️',
      actionHint: 'Minor behavioral or environmental anomaly detected.'
    },
    HIGH: {
      label: 'High Threat',
      icon: '🚨',
      actionHint: 'Compounding threat signals. Requires safe-word confirmation.'
    },
    CRITICAL: {
      label: 'Critical Alert',
      icon: '🆘',
      actionHint: 'Critical threshold crossed. Stand-down requires exact safe-word.'
    }
  }[tier] || {
    label: tier,
    icon: '🛡️',
    actionHint: ''
  };

  // SVG circular gauge calculation
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`risk-guardian-container tier-${tierClass} ${isCriticalFlash ? 'critical-flash-trigger' : ''}`}>
      
      {/* Voice Assistant Bar (Hands-free voice recognition & commands) */}
      <VoiceAssistantBar />

      {/* 1. Hero Threat Radar Card */}
      <div className="guardian-radar-card">
        {/* Radar Ambient Pulse Wave */}
        <div className="radar-glow-aura" />

        <div className="radar-header-row">
          <div className="radar-status-badge">
            <span className="radar-beacon-dot" />
            <span>{dynamicStatusMsg}</span>
          </div>
          <span className={`radar-tier-tag tag-${tierClass}`}>
            {tierMeta.icon} {tierMeta.label}
          </span>
        </div>

        {/* Circular Gauge & Score Display */}
        <div className="radar-hero-meter">
          <div className="gauge-wrapper">
            <svg className="gauge-svg" viewBox="0 0 160 160">
              <circle
                className="gauge-track"
                cx="80"
                cy="80"
                r={radius}
                strokeWidth="11"
              />
              <circle
                className={`gauge-value gauge-val-${tierClass} ${isCriticalFlash ? 'urgent-snap' : ''}`}
                cx="80"
                cy="80"
                r={radius}
                strokeWidth="11"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="gauge-content">
              <span className="gauge-score-number">{score}</span>
              <span className="gauge-score-scale">/ 100</span>
              <span className="gauge-threat-label">{tier} RISK</span>
            </div>
          </div>

          <div className="radar-action-brief">
            <div className="spectrum-track">
              <div className="spectrum-seg seg-low" />
              <div className="spectrum-seg seg-elevated" />
              <div className="spectrum-seg seg-high" />
              <div className="spectrum-seg seg-critical" />
              <div
                className="spectrum-needle"
                style={{ left: `${Math.min(98, Math.max(2, score))}%` }}
              />
            </div>
            <p className="radar-guidance-text">{tierMeta.actionHint}</p>
          </div>
        </div>

        {/* 2. Live Telemetry HUD Quad-Grid */}
        <div className="telemetry-hud-grid">
          <div className="hud-tile">
            <span className="hud-tile-icon">📍</span>
            <div className="hud-tile-info">
              <span className="hud-tile-label">Zone & Geofence</span>
              <span className="hud-tile-val">{signalSourcesMeta.routeFamiliarity.displayVal === 'familiar' ? 'Familiar Zone' : 'Unfamiliar Area'}</span>
            </div>
          </div>

          <div className="hud-tile">
            <span className="hud-tile-icon">⚡</span>
            <div className="hud-tile-info">
              <span className="hud-tile-label">Battery Health</span>
              <span className="hud-tile-val">{signalSourcesMeta.battery.displayVal}</span>
            </div>
          </div>

          <div className="hud-tile">
            <span className="hud-tile-icon">🚶</span>
            <div className="hud-tile-info">
              <span className="hud-tile-label">Transit Pace</span>
              <span className="hud-tile-val">{signalSourcesMeta.pace.displayVal}</span>
            </div>
          </div>

          <div className="hud-tile">
            <span className="hud-tile-icon">🕒</span>
            <div className="hud-tile-info">
              <span className="hud-tile-label">Diurnal Window</span>
              <span className="hud-tile-val">{signalSourcesMeta.timeOfDay.displayVal}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 9: Real-time Ambient Audio Distress Meter */}
      <AmbientDistressMeter />

      {/* Feature 10: Context-Aware AI Reasoning & Intelligence Breakdown */}
      <div className="security-factors-card">
        <div className="factors-card-header">
          <div className="factors-title-group">
            <span className="factors-shield-icon">🤖</span>
            <div>
              <h4>Context-Aware AI Safety Reasoning</h4>
              <p className="ai-guardrail-subtitle">
                Deterministic Safety Guardrails Enforced (Decisions never hallucinated)
              </p>
            </div>
          </div>
          <span className="factors-pill-count">{contributingFactors.length} Active Signal{contributingFactors.length !== 1 ? 's' : ''}</span>
        </div>

        {/* AI Plain-Language Assessment Summary */}
        <div className="ai-explanation-box">
          <p className="ai-summary-text">
            <strong>AI Assessment:</strong> {aiExplanation.summary}
          </p>

          {aiExplanation.recommendations.length > 0 && (
            <div className="ai-recommendations-list">
              <span className="recs-title">Situational Guidance:</span>
              <ul>
                {aiExplanation.recommendations.map((rec, rIdx) => (
                  <li key={rIdx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Contributing Factors Breakdown */}
        <div className="factors-list">
          {contributingFactors.map((factor, index) => {
            const isCompounding = factor.includes('compounding');
            const isBattery = factor.includes('Battery') || factor.includes('battery');
            const isPace = factor.includes('pace') || factor.includes('sprint') || factor.includes('stillness');
            const isEmergency = factor.includes('CRITICAL') || factor.includes('SOS') || factor.includes('coercion');
            const isAudio = factor.includes('distress sound') || factor.includes('scream');
            const isMotion = factor.includes('impact') || factor.includes('fall');
            
            let factorIcon = '🟢';
            let tagLabel = 'BASELINE';
            let tagClass = 'tag-normal';

            if (isEmergency) {
              factorIcon = '🚨';
              tagLabel = 'EMERGENCY';
              tagClass = 'tag-emergency';
            } else if (isAudio) {
              factorIcon = '🎧';
              tagLabel = 'ACOUSTIC';
              tagClass = 'tag-emergency';
            } else if (isMotion) {
              factorIcon = '🏃';
              tagLabel = 'IMPACT';
              tagClass = 'tag-emergency';
            } else if (isCompounding) {
              factorIcon = '⚡';
              tagLabel = 'MULTIPLIER';
              tagClass = 'tag-multiplier';
            } else if (isBattery) {
              factorIcon = '🔋';
              tagLabel = 'POWER';
              tagClass = 'tag-modifier';
            } else if (isPace) {
              factorIcon = '🚶';
              tagLabel = 'KINEMATIC';
              tagClass = 'tag-kinematic';
            } else if (factor.includes('Night') || factor.includes('route')) {
              factorIcon = '🌙';
              tagLabel = 'CONTEXT';
              tagClass = 'tag-context';
            }

            return (
              <div key={index} className={`factor-card-item ${tagClass}`}>
                <span className="factor-item-icon">{factorIcon}</span>
                <span className="factor-item-text">{factor}</span>
                <span className="factor-category-tag">{tagLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
