/**
 * Astraea - CheckInPrompt (Anti-Coercion Voice & Text Check-in Pipeline)
 * 
 * DESIGN PRINCIPLES:
 * 1. Default-Secure: Only exact safe word stands down the alert.
 * 2. Anti-Coercion: Any wrong word, generic "I'm fine", or duress phrase triggers INSTANT EMERGENCY SOS.
 * 3. Silence Escalation: Complete silence gives 3 progressive retry windows before automated SOS dispatch.
 * 4. Multimodal Accessibility: Voice response via Web Speech API or discreet text input fallback.
 */

import React, { useState } from 'react';
import { useApp } from '../state/useApp';
import { CHECKIN_RESPONSE_WINDOW_SECONDS, CHECKIN_MAX_ATTEMPTS, CHECKIN_RETRY_INTERVAL_SECONDS } from '../engine/checkInConfig';
import './CheckInPrompt.css';

export { CHECKIN_RESPONSE_WINDOW_SECONDS, CHECKIN_MAX_ATTEMPTS, CHECKIN_RETRY_INTERVAL_SECONDS };

export default function CheckInPrompt() {
  const {
    checkInState,
    currentAttempt,
    countdown,
    checkInFeedback,
    submitCheckIn,
    isSOSActive,
    speechEngine
  } = useApp();

  const [inputWord, setInputWord] = useState('');

  // If SOS is already active or prompt is idle with no toast, render nothing
  if (isSOSActive) {
    return null;
  }

  if (checkInState === 'idle' && !checkInFeedback) {
    return null;
  }

  // Render stand-down success toast if resolved
  if (checkInFeedback && checkInFeedback.type === 'success') {
    return (
      <div className="checkin-toast-success" id="checkin-success-toast">
        <span className="toast-icon">✅</span>
        <span>{checkInFeedback.message}</span>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputWord.trim()) return;

    /**
     * ANTI-COERCION PROTOCOL:
     * If input != safeWord (or matches duressWord), submitCheckIn triggers instant SOS immediately.
     */
    submitCheckIn(inputWord);
    setInputWord('');
  };

  const handleVoiceResponse = () => {
    if (speechEngine.sttSupported) {
      speechEngine.startListening();
    }
  };

  // If waiting in gap interval between attempts
  if (checkInState === 'waiting_retry') {
    return (
      <div className={`checkin-card checkin-retry-waiting attempt-${currentAttempt}`} id="checkin-prompt">
        <div className="checkin-header">
          <span className="retry-beacon" />
          <div className="checkin-titles">
            <span className="checkin-eyebrow">Awaiting Response • Standby</span>
            <h3>No response received (Attempt {currentAttempt} of {CHECKIN_MAX_ATTEMPTS})</h3>
          </div>
          <div className="countdown-pill waiting">
            Re-prompting in {countdown}s
          </div>
        </div>
        <p className="checkin-subtext">
          Silently waiting before retry {currentAttempt + 1}. If unanswered after {CHECKIN_MAX_ATTEMPTS} attempts, Emergency SOS will automatically trigger.
        </p>
      </div>
    );
  }

  // Active Prompting State
  return (
    <div className={`checkin-card checkin-active attempt-${currentAttempt}`} id="checkin-prompt">
      <div className="checkin-header">
        <div className="pulse-indicator">
          <span className="pulse-ring" />
          <span className="pulse-dot" />
        </div>
        <div className="checkin-titles">
          <div className="eyebrow-row">
            <span className="checkin-eyebrow">SAFETY CHECK-IN REQUIRED</span>
            <span className="attempt-badge">Attempt {currentAttempt} of {CHECKIN_MAX_ATTEMPTS}</span>
          </div>
          <h3 className="checkin-prompt-title">Are you safe? Speak or enter your secret safe word</h3>
        </div>
        <div className="countdown-pill active">
          ⏱️ {countdown}s remaining
        </div>
      </div>

      <p className="checkin-guidance">
        Speak or type your secret safe word to stand down this alert. 
        <span className="coercion-warning-inline"> (Typing incorrect words, duress phrase, or generic phrases immediately arms Emergency SOS).</span>
      </p>

      {/* Progress Bar for Current Window */}
      <div className="window-progress-bar">
        <div
          className="window-progress-fill"
          style={{ width: `${(countdown / CHECKIN_RESPONSE_WINDOW_SECONDS) * 100}%` }}
        />
      </div>

      <form onSubmit={handleSubmit} className="checkin-form">
        <div className="checkin-input-wrapper">
          <input
            type="text"
            placeholder="Type secret safe word to confirm safety..."
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            className="checkin-text-input"
            autoFocus
            autoComplete="off"
          />

          {speechEngine.sttSupported && (
            <button
              type="button"
              className={`btn-checkin-voice ${speechEngine.isListening ? 'listening' : ''}`}
              onClick={handleVoiceResponse}
              title="Speak safe word using microphone"
            >
              🎙️ {speechEngine.isListening ? 'Listening...' : 'Speak'}
            </button>
          )}

          <button type="submit" className="btn-checkin-submit">
            Confirm Safe Word ↵
          </button>
        </div>
      </form>
    </div>
  );
}
