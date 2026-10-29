import React from 'react';
import { useApp } from '../state/useApp';
import './AccessibilityControls.css';

export default function AccessibilityControls() {
  const {
    privacySettings,
    updatePrivacySettings,
    sirenController
  } = useApp();

  const handleToggle = (key) => {
    updatePrivacySettings({
      [key]: !privacySettings[key]
    });
  };

  const handleTestHaptics = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([150, 80, 150]);
    }
  };

  const handleTestChime = () => {
    sirenController.playChime();
  };

  return (
    <div className="accessibility-card" id="accessibility-controls">
      <div className="accessibility-header">
        <span className="access-icon">♿</span>
        <div>
          <h3>Accessibility, Audio & Fallback Options</h3>
          <p>Alternative interaction methods, motor assist, and high-visibility modes</p>
        </div>
      </div>

      <div className="access-options-grid">
        {/* 1. Instant Single-Tap SOS (Motor Assistance) */}
        <div className="access-item">
          <div className="access-text">
            <span className="access-title">🚨 Instant Tap SOS (No 1s Hold Required)</span>
            <span className="access-desc">
              Allows immediate trigger on touch without requiring continuous pressure. Recommended for users with tremors or impaired dexterity.
            </span>
          </div>
          <button
            type="button"
            className={`access-switch ${privacySettings.instantSosTap ? 'active' : ''}`}
            onClick={() => handleToggle('instantSosTap')}
          >
            <span className="switch-knob" />
          </button>
        </div>

        {/* 2. High Contrast Mode */}
        <div className="access-item">
          <div className="access-text">
            <span className="access-title">👁️ High-Contrast Display Mode</span>
            <span className="access-desc">
              Increases borders, sharpens text contrast, and maximizes readability in harsh sunlight or for low-vision users.
            </span>
          </div>
          <button
            type="button"
            className={`access-switch ${privacySettings.highContrast ? 'active' : ''}`}
            onClick={() => handleToggle('highContrast')}
          >
            <span className="switch-knob" />
          </button>
        </div>

        {/* 3. Tactical Haptic Vibrations */}
        <div className="access-item">
          <div className="access-text">
            <span className="access-title">📳 Haptic Vibration Pulses</span>
            <span className="access-desc">
              Vibrates device on check-in alerts, countdown transitions, and SOS activation.
            </span>
          </div>
          <div className="access-action-wrap">
            <button
              type="button"
              className="btn-test-haptic"
              onClick={handleTestHaptics}
            >
              Test Vibration
            </button>
            <button
              type="button"
              className={`access-switch ${privacySettings.hapticsEnabled ? 'active' : ''}`}
              onClick={() => handleToggle('hapticsEnabled')}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </div>

        {/* 4. Audible Siren Synthesizer */}
        <div className="access-item">
          <div className="access-text">
            <span className="access-title">🔊 Emergency Siren Alarm Tone</span>
            <span className="access-desc">
              Emits a synthesized audio siren alarm upon SOS trigger. Disable for silent coercion protection.
            </span>
          </div>
          <div className="access-action-wrap">
            <button
              type="button"
              className="btn-test-haptic"
              onClick={handleTestChime}
            >
              Test Chime
            </button>
            <button
              type="button"
              className={`access-switch ${privacySettings.audibleSiren ? 'active' : ''}`}
              onClick={() => handleToggle('audibleSiren')}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
