import React from 'react';
import { useApp } from '../state/useApp';
import './AmbientDistressMeter.css';

export default function AmbientDistressMeter() {
  const {
    audioDistressSignal,
    privacySettings
  } = useApp();

  if (!privacySettings.micDistressEnabled) {
    return null;
  }

  const {
    audioSupported,
    permissionStatus,
    requestAudioPermission,
    stopAudio,
    volumeDb,
    screamRatio,
    distressDetected,
    frequencyData,
    simulateDistressScream
  } = audioDistressSignal;

  const isActive = permissionStatus === 'granted';

  return (
    <div className={`ambient-meter-card ${distressDetected ? 'distress-active' : ''}`} id="ambient-distress-meter">
      <div className="ambient-meter-header">
        <div className="ambient-title-block">
          <span className="ambient-mic-icon">{distressDetected ? '🚨' : '🎧'}</span>
          <div>
            <h4>Ambient Acoustic Distress Sentinel</h4>
            <span className="ambient-subtext">Passive scream & high-frequency panic detection</span>
          </div>
        </div>

        <div className="ambient-header-actions">
          {isActive ? (
            <button
              type="button"
              className="btn-mic-toggle active"
              onClick={stopAudio}
              title="Pause ambient audio monitoring"
            >
              <span className="live-audio-dot" />
              <span>Mic Active</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-mic-toggle start"
              onClick={requestAudioPermission}
              title="Authorize browser microphone for local panic sound detection"
            >
              🎤 Enable Mic Stream
            </button>
          )}
        </div>
      </div>

      {/* Spectrum & Level Visualizer */}
      <div className="audio-visualizer-container">
        <div className="spectrum-bars-row">
          {Array.from({ length: 16 }).map((_, idx) => {
            const rawVal = isActive ? (frequencyData[idx] || 0) : (idx === 7 || idx === 8 ? 20 : 8);
            const heightPercent = Math.min(100, Math.max(8, (rawVal / 255) * 100));
            const isScreamBand = idx >= 6 && idx <= 12; // 1.5 kHz - 4.5 kHz range

            return (
              <div
                key={idx}
                className={`spectrum-bar ${isScreamBand ? 'scream-band' : ''}`}
                style={{ height: `${heightPercent}%` }}
                title={isScreamBand ? 'Distress Vocal Band (1.5 - 4.5 kHz)' : 'Audio Spectrum'}
              />
            );
          })}
        </div>

        <div className="audio-stats-strip">
          <div className="audio-stat-item">
            <span className="stat-label">Volume Level</span>
            <span className="stat-value">{isActive ? `${volumeDb} dB` : '-∞ dB'}</span>
          </div>

          <div className="audio-stat-item">
            <span className="stat-label">Scream Band Energy</span>
            <span className={`stat-value ${screamRatio > 0.35 ? 'scream-warning' : ''}`}>
              {Math.round(screamRatio * 100)}%
            </span>
          </div>

          <div className="audio-stat-item">
            <span className="stat-label">Status</span>
            <span className={`stat-value ${distressDetected ? 'status-distress' : 'status-normal'}`}>
              {distressDetected ? '🚨 SCREAM DETECTED' : isActive ? 'Listening (Normal)' : 'Standby'}
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Guarantee & Simulator Strip */}
      <div className="ambient-footer-strip">
        <div className="privacy-lock-badge">
          <span>🔒 On-Device FFT Only • Zero audio recorded or sent to any server</span>
        </div>

        <button
          type="button"
          className="btn-simulate-scream"
          onClick={simulateDistressScream}
          title="Simulate acoustic distress scream signature for testing"
        >
          ⚡ Test Scream Trigger
        </button>
      </div>
    </div>
  );
}
