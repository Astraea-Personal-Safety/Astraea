import React, { useState } from 'react';
import { useApp } from '../state/useApp';
import './PrivacyControls.css';

export default function PrivacyControls() {
  const {
    privacySettings,
    updatePrivacySettings,
    purgeAllData
  } = useApp();

  const [confirmPurge, setConfirmPurge] = useState(false);

  const handleToggle = (key) => {
    updatePrivacySettings({
      [key]: !privacySettings[key]
    });
  };

  const handleRetentionChange = (e) => {
    updatePrivacySettings({
      dataRetention: e.target.value
    });
  };

  const handleExecutePurge = () => {
    purgeAllData();
    setConfirmPurge(false);
  };

  return (
    <div className="privacy-controls-card" id="privacy-controls">
      <div className="privacy-header">
        <span className="privacy-icon">🛡️</span>
        <div>
          <h3>Privacy, Sensor Permissions & Data Retention</h3>
          <p>Granular on-device privacy toggles and data governance controls</p>
        </div>
      </div>

      <div className="privacy-toggles-list">
        {/* 1. Microphone & Ambient Distress Detection */}
        <div className="privacy-toggle-item">
          <div className="toggle-text-block">
            <span className="toggle-title">🎤 Microphone & Ambient Distress Detection</span>
            <span className="toggle-desc">
              Allows real-time frequency analysis for screams or violent impacts. Runs strictly in browser memory (zero recording or uploads).
            </span>
          </div>
          <button
            type="button"
            className={`switch-btn ${privacySettings.micDistressEnabled ? 'checked' : ''}`}
            onClick={() => handleToggle('micDistressEnabled')}
          >
            <span className="switch-thumb" />
          </button>
        </div>

        {/* 2. Device Motion & Fall/Impact Detection */}
        <div className="privacy-toggle-item">
          <div className="toggle-text-block">
            <span className="toggle-title">🏃 Accelerometer & Fall/Impact Sensor</span>
            <span className="toggle-desc">
              Detects sudden physical collisions, drops, or violent shaking via device motion kinematics.
            </span>
          </div>
          <button
            type="button"
            className={`switch-btn ${privacySettings.motionSensorEnabled ? 'checked' : ''}`}
            onClick={() => handleToggle('motionSensorEnabled')}
          >
            <span className="switch-thumb" />
          </button>
        </div>

        {/* 3. Text-to-Speech Voice Check-in */}
        <div className="privacy-toggle-item">
          <div className="toggle-text-block">
            <span className="toggle-title">🗣️ Discreet Voice Check-In Prompts</span>
            <span className="toggle-desc">
              Initiates a spoken prompt ("Astraea safety check-in: Are you safe?") when threat score crosses Elevated tier.
            </span>
          </div>
          <button
            type="button"
            className={`switch-btn ${privacySettings.ttsVoiceEnabled ? 'checked' : ''}`}
            onClick={() => handleToggle('ttsVoiceEnabled')}
          >
            <span className="switch-thumb" />
          </button>
        </div>

        {/* 4. Speech Recognition Hotphrase Listening */}
        <div className="privacy-toggle-item">
          <div className="toggle-text-block">
            <span className="toggle-title">🎙️ Hands-Free Voice SOS Detection</span>
            <span className="toggle-desc">
              Continuously listens for your emergency phrase ("ASTRAEA HELP ME") to trigger hands-free assistance.
            </span>
          </div>
          <button
            type="button"
            className={`switch-btn ${privacySettings.sttVoiceCommandsEnabled ? 'checked' : ''}`}
            onClick={() => handleToggle('sttVoiceCommandsEnabled')}
          >
            <span className="switch-thumb" />
          </button>
        </div>

        {/* 5. Automatic Live Location Sharing */}
        <div className="privacy-toggle-item">
          <div className="toggle-text-block">
            <span className="toggle-title">📍 Session-Scoped Location Sharing</span>
            <span className="toggle-desc">
              Shares live GPS coordinates with Trusted Circle exclusively during active walks or SOS events (never continuous).
            </span>
          </div>
          <button
            type="button"
            className={`switch-btn ${privacySettings.autoLocationSharing ? 'checked' : ''}`}
            onClick={() => handleToggle('autoLocationSharing')}
          >
            <span className="switch-thumb" />
          </button>
        </div>
      </div>

      {/* Data Retention Governance */}
      <div className="retention-selector-block">
        <label htmlFor="retention-select">Local Audit Log Retention Policy:</label>
        <p className="retention-sub">Controls how long safety events, check-ins, and GPS coordinates remain in browser storage before automatic purge:</p>
        <select
          id="retention-select"
          value={privacySettings.dataRetention || '7d'}
          onChange={handleRetentionChange}
          className="retention-dropdown"
        >
          <option value="session">Ephemeral (Purge on tab close / reload)</option>
          <option value="24h">24 Hours (Daily Auto-Purge)</option>
          <option value="7d">7 Days (Standard Local Rolling Window)</option>
          <option value="indefinite">Manual Purge Only (Indefinite)</option>
        </select>
      </div>

      {/* Emergency Data Purge */}
      <div className="purge-data-block">
        <div className="purge-info">
          <h5>Instant Local Data Wipe</h5>
          <p>Instantly deletes all saved safe phrases, contact circles, telemetry logs, and browser local storage.</p>
        </div>

        {confirmPurge ? (
          <div className="purge-confirm-row">
            <span>Confirm complete data wipe?</span>
            <button
              type="button"
              className="btn-confirm-purge"
              onClick={handleExecutePurge}
            >
              Yes, Wipe Everything
            </button>
            <button
              type="button"
              className="btn-cancel-purge"
              onClick={() => setConfirmPurge(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-start-purge"
            onClick={() => setConfirmPurge(true)}
          >
            🗑️ Purge All Stored Data
          </button>
        )}
      </div>
    </div>
  );
}
