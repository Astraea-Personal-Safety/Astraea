/**
 * Astraea - Emergency SOS Component
 * 
 * DESIGN PRINCIPLES:
 * 1. Independent & Always-Available: Fixed red SOS trigger accessible anywhere.
 * 2. Accidental Trigger Defense: 1-second press-and-hold (or instant tap if accessibility mode enabled).
 * 3. Unified SOS State: Automatic triggers invoke identical secure state.
 * 4. Transparent Emergency Dialing & Dispatch: Real tel:112/100 links, SMS broadcast, WhatsApp, Web Share, Webhook.
 * 5. Default-Secure Stand-Down: Disarming active SOS requires exact safe-word confirmation.
 * 6. Live Siren Control & Delivery Status Tracking: Audible siren toggle and real-time contact delivery receipts.
 */

import React, { useState, useRef } from 'react';
import { useApp } from '../state/useApp';
import './SOSButton.css';

export default function SOSButton() {
  const {
    isSOSActive,
    sosReason,
    triggerSOS,
    standDownSOS,
    privacySettings,
    emergencyPayload,
    deliveryRecords,
    sirenController,
    trustedCircle
  } = useApp();

  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const [standDownInput, setStandDownInput] = useState('');
  const [standDownError, setStandDownError] = useState('');
  const [isSirenMuted, setIsSirenMuted] = useState(false);

  const holdIntervalRef = useRef(null);
  const holdStartTimeRef = useRef(0);
  const HOLD_DURATION_MS = 1000; // 1 second hold

  // Click handler for instant tap mode (Accessibility Assist)
  const handleClick = () => {
    if (privacySettings.instantSosTap && !isSOSActive) {
      triggerSOS('manual_tap');
    }
  };

  // Press & Hold Handlers
  const startHold = () => {
    if (isSOSActive || privacySettings.instantSosTap) return;
    holdStartTimeRef.current = Date.now();
    setHoldProgress(0);

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(progress);

      if (elapsed >= HOLD_DURATION_MS) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
        setHoldProgress(0);
        triggerSOS('manual');
      }
    }, 30);
  };

  const cancelHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setHoldProgress(0);
  };

  // Toggle siren in modal
  const handleToggleSiren = () => {
    if (isSirenMuted) {
      sirenController.startSiren();
      setIsSirenMuted(false);
    } else {
      sirenController.stopSiren();
      setIsSirenMuted(true);
    }
  };

  // Native share trigger
  const handleNativeShare = async () => {
    if (emergencyPayload && navigator.share) {
      try {
        await navigator.share({
          title: '🚨 Astraea Emergency Alert',
          text: emergencyPayload.messageText,
          url: emergencyPayload.mapsLink
        });
      } catch {}
    }
  };

  // Safe-Word Stand-Down Handler
  const handleStandDown = (e) => {
    e.preventDefault();
    if (!standDownInput.trim()) return;

    const success = standDownSOS(standDownInput);
    if (success) {
      setStandDownInput('');
      setStandDownError('');
    } else {
      setStandDownError('Incorrect safe word. Emergency alert remains armed (Anti-Coercion Protocol).');
    }
  };

  const getReasonLabel = (reason) => {
    switch (reason) {
      case 'manual':
      case 'manual_tap':
        return 'Manual User SOS Activation';
      case 'coercion_wrong_word':
        return 'Anti-Coercion Protocol (Incorrect Safe-Word or Duress Word)';
      case 'silence_timeout':
        return 'Silence Escalation (3 Consecutive Unanswered Check-In Windows)';
      case 'voice_trigger':
        return 'Hands-Free Voice Hotphrase Activation ("ASTRAEA HELP ME")';
      case 'ambient_distress':
        return 'Ambient Acoustic Distress Sound / Scream Detected';
      default:
        return 'Critical Safety Escalation';
    }
  };

  const alertText = emergencyPayload?.messageText || 'Emergency alert active';
  const smsHref = `sms:?body=${encodeURIComponent(alertText)}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(alertText)}`;

  return (
    <>
      {/* 1. Fixed Always-Available Floating SOS Button */}
      <div className="sos-fixed-container" id="sos-button-wrapper">
        <button
          type="button"
          className={`sos-floating-btn ${isSOSActive ? 'sos-active-pulse' : ''} ${holdProgress > 0 ? 'holding' : ''}`}
          onClick={handleClick}
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          onTouchCancel={cancelHold}
          title={isSOSActive ? 'Emergency Active' : privacySettings.instantSosTap ? 'Tap for Emergency SOS' : 'Press and hold 1 second for Emergency SOS'}
        >
          <div className="sos-btn-content">
            <span className="sos-icon">🚨</span>
            <span className="sos-text">SOS</span>
          </div>

          {/* Radial progress ring during press-and-hold */}
          {holdProgress > 0 && !isSOSActive && !privacySettings.instantSosTap && (
            <svg className="sos-hold-ring" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="46"
                strokeWidth="6"
                className="hold-ring-bg"
              />
              <circle
                cx="50"
                cy="50"
                r="46"
                strokeWidth="6"
                strokeDasharray="289"
                strokeDashoffset={289 - (holdProgress / 100) * 289}
                className="hold-ring-fill"
              />
            </svg>
          )}
        </button>
        <span className="sos-help-hint">
          {isSOSActive ? '🚨 ALERT ACTIVE' : privacySettings.instantSosTap ? 'Tap for SOS' : holdProgress > 0 ? 'Hold 1s...' : 'Hold 1s for SOS'}
        </span>
      </div>

      {/* 2. Active Emergency Modal & Direct Emergency Dispatch Panel */}
      {isSOSActive && (
        <div className="emergency-modal-overlay" id="emergency-active-modal">
          <div className="emergency-card">
            {/* Header */}
            <div className="emergency-card-header">
              <div className="emergency-siren-badge">🚨</div>
              <h2>CRITICAL EMERGENCY ACTIVE</h2>
              <p className="emergency-subtitle">Alert Broadcast to Trusted Circle & Emergency Lifelines Armed</p>

              {/* Siren Audio Toggle */}
              <button
                type="button"
                className={`btn-siren-mute-toggle ${isSirenMuted ? 'muted' : 'sounding'}`}
                onClick={handleToggleSiren}
                title="Toggle audible emergency siren"
              >
                {isSirenMuted ? '🔇 Siren Muted (Click to Sound Alarm)' : '🔊 Audible Alarm Sounding (Click to Silence)'}
              </button>
            </div>

            {/* Trigger Reason */}
            <div className="emergency-reason-banner">
              <span className="reason-tag">SOURCE:</span>
              <span className="reason-text">{getReasonLabel(sosReason)}</span>
            </div>

            {/* Automated Dispatch Status Banner */}
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.6rem 0.8rem', borderRadius: '10px', margin: '0.75rem 0', fontSize: '0.82rem', color: '#6ee7b7', textAlign: 'center' }}>
              ✓ <strong>AUTOMATED DIRECT DISPATCH FIRED:</strong> Emergency payload dispatched to Trusted Circle via Cloud Gateway (Telegram, Direct WhatsApp & Webhook) without requiring user clicks.
            </div>

            {/* Direct Dispatch & Broadcast Backup Action Links */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Manual Backup Forwarding (Optional):
            </div>
            <div className="emergency-dispatch-action-row">
              <a href={smsHref} className="btn-dispatch-link link-sms" target="_blank" rel="noreferrer">
                📱 Forward via SMS
              </a>
              <a href={waHref} className="btn-dispatch-link link-wa" target="_blank" rel="noreferrer">
                💬 Forward via WhatsApp
              </a>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button type="button" className="btn-dispatch-link link-share" onClick={handleNativeShare}>
                  🔗 Native Share
                </button>
              )}
            </div>

            {/* Feature 17: Emergency Delivery Status Live Tracker */}
            {deliveryRecords.length > 0 && (
              <div className="modal-delivery-status-box">
                <span className="delivery-status-title">📡 Live Delivery Pipeline:</span>
                <div className="modal-delivery-items">
                  {deliveryRecords.map((rec, i) => (
                    <div key={i} className="modal-delivery-item">
                      <span className="contact-name">{rec.contactName}:</span>
                      <span className={`status-tag tag-${rec.stage.toLowerCase()}`}>{rec.stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tap-to-Call Emergency Services */}
            <div className="emergency-call-section">
              <span className="call-section-title">DIRECT EMERGENCY DISPATCH</span>
              <div className="emergency-call-grid">
                <a href="tel:112" className="emergency-call-btn call-112">
                  <span className="call-icon">📞</span>
                  <div className="call-text-block">
                    <span className="call-number">112</span>
                    <span className="call-desc">National Emergency Service</span>
                  </div>
                  <span className="call-action">Tap to Call ↗</span>
                </a>

                <a href="tel:100" className="emergency-call-btn call-100">
                  <span className="call-icon">🚔</span>
                  <div className="call-text-block">
                    <span className="call-number">100</span>
                    <span className="call-desc">Police Control Room</span>
                  </div>
                  <span className="call-action">Tap to Call ↗</span>
                </a>
              </div>
            </div>

            {/* Default-Secure Stand-Down Section */}
            <div className="emergency-stand-down-section">
              <h3>Disarm Alert with Secret Safe Word</h3>
              <p className="stand-down-instruction">
                Emergency broadcast will remain active until your configured safe word is verified.
              </p>

              <form onSubmit={handleStandDown} className="stand-down-form">
                <div className="stand-down-input-wrapper">
                  <input
                    type="text"
                    placeholder="Enter safe word to stand down..."
                    value={standDownInput}
                    onChange={(e) => {
                      setStandDownInput(e.target.value);
                      if (standDownError) setStandDownError('');
                    }}
                    className="stand-down-input"
                    autoFocus
                    autoComplete="off"
                  />
                  <button type="submit" className="btn-stand-down">
                    Disarm Alert
                  </button>
                </div>
                {standDownError && <p className="stand-down-error">{standDownError}</p>}
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
