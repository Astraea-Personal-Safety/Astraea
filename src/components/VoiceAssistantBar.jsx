import React, { useState } from 'react';
import { useApp } from '../state/useApp';
import { useScreenWakeLock } from '../signals/useScreenWakeLock';
import { URGENT_TRIGGERS, UNCERTAIN_TRIGGERS } from '../signals/voiceTriggers';
import './VoiceAssistantBar.css';

export default function VoiceAssistantBar() {
  const {
    speechEngine,
    privacySettings,
    voiceSosPhrase,
    triggerSafetyCheckIn
  } = useApp();

  const { isLocked: isWakeLockActive, isSupported: isWakeLockSupported } = useScreenWakeLock({
    enabled: speechEngine.isListening
  });

  const [selectedLanguage, setSelectedLanguage] = useState('All'); // 'All' | 'English' | 'Hindi'

  if (!privacySettings.sttVoiceCommandsEnabled && !privacySettings.ttsVoiceEnabled) {
    return null;
  }

  const handleSimulateTrigger = (phrase) => {
    speechEngine.simulateVoiceCommand(phrase);
  };

  return (
    <div className="voice-assistant-bar-shell" id="voice-assistant-bar">
      <div className="voice-bar-header">
        <div className="voice-title-group">
          <span className="voice-mic-icon">🎙️</span>
          <div>
            <span className="voice-bar-title">Multi-Language Voice Sentinel</span>
            <span className="voice-subtext">Hands-free English & Hindi triggers</span>
          </div>
        </div>

        <div className="voice-controls-row">
          {speechEngine.sttSupported ? (
            <button
              type="button"
              className={`btn-voice-listen ${speechEngine.isListening ? 'listening' : ''}`}
              onClick={speechEngine.isListening ? speechEngine.stopListening : speechEngine.startListening}
              title={speechEngine.isListening ? 'Stop voice recognition' : 'Start hands-free voice recognition'}
            >
              <span className="voice-pulse-ring" />
              <span>{speechEngine.isListening ? '● Listening' : 'Enable Mic'}</span>
            </button>
          ) : (
            <span className="voice-unsupported-tag">Voice Tap Ready</span>
          )}
        </div>
      </div>

      {/* Screen Wake Lock Status Strip */}
      <div className="wake-lock-status-row">
        <span className={`wake-lock-dot ${isWakeLockActive ? 'active' : ''}`} />
        <span className="wake-lock-text">
          {isWakeLockActive
            ? 'Screen Wake Lock Active (Display stays on hands-free)'
            : 'Screen Wake Lock Standby (Starts when listening)'}
        </span>
      </div>

      {/* Real-time transcript or last recognized command */}
      {speechEngine.transcript && (
        <div className="voice-live-transcript">
          <span className="transcript-label">Heard Speech:</span>
          <span className="transcript-content">"{speechEngine.transcript}"</span>
        </div>
      )}

      {/* Voice Trigger Simulation Suite for Judges & Demos */}
      <div className="voice-trigger-suite">
        <div className="trigger-suite-header">
          <span className="suite-title">⚡ Voice Trigger Presets (Click to Test)</span>
          <div className="lang-filter-pills">
            {['All', 'English', 'Hindi'].map(lang => (
              <button
                key={lang}
                type="button"
                className={`pill-btn ${selectedLanguage === lang ? 'active' : ''}`}
                onClick={() => setSelectedLanguage(lang)}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <div className="voice-trigger-chips-grid">
          {/* Urgent Triggers -> Silent Escalation */}
          {URGENT_TRIGGERS
            .filter(t => selectedLanguage === 'All' || t.lang === selectedLanguage || (selectedLanguage === 'Hindi' && t.lang === 'Hinglish'))
            .map(t => (
              <button
                key={t.phrase}
                type="button"
                className="cmd-chip cmd-chip-urgent"
                onClick={() => handleSimulateTrigger(t.phrase)}
                title={`Urgent trigger: Silently escalates to emergency (${t.lang})`}
              >
                🚨 "{t.phrase}" <span className="chip-lang-tag">[{t.lang}]</span>
              </button>
            ))}

          {/* Unease Triggers -> Initiates Voice Check-In */}
          {UNCERTAIN_TRIGGERS
            .filter(t => selectedLanguage === 'All' || t.lang === selectedLanguage || (selectedLanguage === 'Hindi' && t.lang === 'Hinglish'))
            .map(t => (
              <button
                key={t.phrase}
                type="button"
                className="cmd-chip cmd-chip-checkin"
                onClick={() => handleSimulateTrigger(t.phrase)}
                title={`Unease trigger: Initiates voice check-in prompt (${t.lang})`}
              >
                🛡️ "{t.phrase}" <span className="chip-lang-tag">[{t.lang}]</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
