import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../state/useApp';
import {
  verifyVaultPin,
  updateVaultPin,
  isUserInTrustedLocation,
  getPendingSecurityChange,
  queueSecurityChange,
  cancelPendingSecurityChange
} from '../engine/securityVault';
import SafePhraseConfig from './SafePhraseConfig';
import './SecurityVault.css';

export default function SecurityVault() {
  const {
    geoSignals,
    familiarPlaces,
    isDevMode,
    safeWord,
    duressWord,
    voiceSosPhrase,
    updateSafePhrases
  } = useApp();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [pendingChange, setPendingChange] = useState(() => getPendingSecurityChange());
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // New PIN form state
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState(null);

  const inputRefs = useRef([]);

  // Check if currently within 500m of a trusted safe zone
  const isTrustedLoc = isUserInTrustedLocation(geoSignals.coordinates, familiarPlaces);

  // Countdown timer for pending security delay
  useEffect(() => {
    if (!pendingChange) {
      setSecondsRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((pendingChange.unlocksAt - now) / 1000));
      setSecondsRemaining(left);

      // If countdown finished
      if (left === 0 && pendingChange.status === 'pending') {
        setPendingChange(prev => prev ? { ...prev, status: 'ready_to_commit' } : null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pendingChange]);

  // Handle single digit input with auto-advance
  const handleDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = clean;
    setPinDigits(next);
    setPinError('');

    if (clean && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus();
    }
  };

  // Attempt PIN Unlock
  const handleUnlock = async () => {
    const entered = pinDigits.join('');
    if (entered.length < 6) {
      setPinError('Please enter all 6 digits');
      return;
    }

    const isValid = await verifyVaultPin(entered);
    if (isValid) {
      setIsUnlocked(true);
      setPinError('');
      setPinDigits(['', '', '', '', '', '']);
    } else {
      setPinError('Incorrect PIN. Default is 123456');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setIsChangingPin(false);
    setPinDigits(['', '', '', '', '', '']);
    setPinError('');
  };

  // Handle Phrase Update with Location Guard
  const handleRequestPhraseUpdate = (newSafe, newDuress, newSos) => {
    if (isTrustedLoc) {
      // Immediate update inside trusted zone
      updateSafePhrases({
        safeWord: newSafe,
        duressWord: newDuress,
        voiceSosPhrase: newSos
      });
      alert('✅ Security phrases updated immediately (Trusted Safe Zone Verified).');
    } else {
      // Away from trusted locations -> Queue 2-hour delay (or 60s in ?dev=1)
      const queued = queueSecurityChange({
        type: 'PHRASE_UPDATE',
        payload: { safeWord: newSafe, duressWord: newDuress, voiceSosPhrase: newSos },
        isDevMode
      });
      setPendingChange(queued);
    }
  };

  // Commit pending change after delay expires
  const handleCommitPendingChange = () => {
    if (!pendingChange || secondsRemaining > 0) return;
    if (pendingChange.type === 'PHRASE_UPDATE' && pendingChange.payload) {
      updateSafePhrases(pendingChange.payload);
      cancelPendingSecurityChange();
      setPendingChange(null);
      alert('✅ Security delay completed. New phrases are now active.');
    }
  };

  const handleCancelPending = () => {
    cancelPendingSecurityChange();
    setPendingChange(null);
  };

  // Update 6-Digit PIN
  const handleSaveNewPin = async () => {
    if (!/^\d{6}$/.test(newPin)) {
      setPinChangeMsg({ type: 'error', text: 'PIN must be exactly 6 numeric digits' });
      return;
    }
    await updateVaultPin(newPin);
    setPinChangeMsg({ type: 'success', text: 'Vault PIN updated successfully' });
    setNewPin('');
    setTimeout(() => {
      setIsChangingPin(false);
      setPinChangeMsg(null);
    }, 2000);
  };

  // Format seconds into HH:MM:SS or MM:SS
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="security-vault-panel">
      {/* Vault Header */}
      <div className="vault-header">
        <div className="vault-title-wrap">
          <span className="vault-icon">🔐</span>
          <div>
            <h3 className="vault-title">Security Vault</h3>
            <p className="vault-subtitle">Hardware-isolated protection & anti-coercion delay</p>
          </div>
        </div>
        <span className={`vault-badge ${isUnlocked ? 'badge-unlocked' : 'badge-locked'}`}>
          {isUnlocked ? 'Unlocked' : 'Locked'}
        </span>
      </div>

      {/* Pending Security Delay Banner (Visible in both locked & unlocked states) */}
      {pendingChange && (
        <div className="security-delay-banner">
          <div className="delay-banner-header">
            <span className="delay-banner-title">
              ⏳ Security Delay in Progress
            </span>
            <span className="delay-countdown font-mono">
              {secondsRemaining > 0 ? formatTime(secondsRemaining) : 'READY'}
            </span>
          </div>
          <p className="delay-banner-desc">
            {secondsRemaining > 0 ? (
              <>
                A change to safety phrases was initiated away from your trusted locations. 
                Existing phrases remain active until the countdown ends.
                {isDevMode && <em> (Dev mode: 60s demo delay)</em>}
              </>
            ) : (
              'Security delay has completed! Click commit below to finalize the changes.'
            )}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            {secondsRemaining === 0 ? (
              <button type="button" className="btn-vault-primary" onClick={handleCommitPendingChange}>
                Apply Changes Now
              </button>
            ) : null}
            <button type="button" className="btn-cancel-delay" onClick={handleCancelPending}>
              Cancel Request
            </button>
          </div>
        </div>
      )}

      {/* Locked State: 6-Digit PIN Keypad */}
      {!isUnlocked ? (
        <div className="vault-pin-prompt">
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#d1d5db' }}>
            Enter your 6-digit Security PIN to access protected safety configuration
          </p>

          <div className="pin-input-group">
            {pinDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={el => inputRefs.current[idx] = el}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                className="pin-digit-box font-mono"
              />
            ))}
          </div>

          {pinError && <div className="vault-error-msg">{pinError}</div>}
          <span className="vault-hint">Default demo PIN: <strong>123456</strong></span>

          <div className="vault-actions-row">
            <button type="button" className="btn-vault-primary" onClick={handleUnlock}>
              Unlock Vault
            </button>
          </div>
        </div>
      ) : (
        /* Unlocked State: Protected Controls */
        <div className="vault-unlocked-content animate-fade-in">
          {/* Location Safety Status Indicator */}
          <div className={`vault-location-status ${isTrustedLoc ? 'location-trusted' : 'location-untrusted'}`}>
            <span>{isTrustedLoc ? '📍' : '⚠️'}</span>
            <span>
              {isTrustedLoc
                ? 'Inside Trusted Safe Zone: Immediate phrase changes permitted.'
                : 'Away from Trusted Locations: Changes require a 2-hour delay (60s in ?dev=1).'}
            </span>
          </div>

          {/* Quick Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <button
              type="button"
              className="btn-vault-secondary"
              onClick={() => setIsChangingPin(!isChangingPin)}
            >
              {isChangingPin ? 'Cancel PIN Change' : '🔑 Change 6-Digit PIN'}
            </button>
            <button type="button" className="btn-vault-secondary" onClick={handleLock}>
              🔒 Lock Vault
            </button>
          </div>

          {/* Change PIN Form */}
          {isChangingPin && (
            <div style={{ background: '#1f2937', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
              <h5 style={{ margin: '0 0 0.5rem', color: '#f9fafb' }}>Set New 6-Digit PIN</h5>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="New 6-digit PIN"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="font-mono"
                  style={{
                    background: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '0.375rem',
                    padding: '0.4rem 0.75rem',
                    color: '#f9fafb',
                    fontSize: '1rem'
                  }}
                />
                <button type="button" className="btn-vault-primary" onClick={handleSaveNewPin}>
                  Save PIN
                </button>
              </div>
              {pinChangeMsg && (
                <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: pinChangeMsg.type === 'error' ? '#f87171' : '#34d399' }}>
                  {pinChangeMsg.text}
                </div>
              )}
            </div>
          )}

          {/* Safe & Duress Phrase Configuration */}
          <SafePhraseConfig onInterceptSave={handleRequestPhraseUpdate} />
        </div>
      )}
    </div>
  );
}
