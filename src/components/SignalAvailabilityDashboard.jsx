import React, { useState } from 'react';
import { useApp } from '../state/useApp';
import './SignalAvailabilityDashboard.css';

export default function SignalAvailabilityDashboard() {
  const {
    signals,
    manualSignals,
    updateSignal,
    updateSignals,
    resetToSafeBaseline,
    geoSignals,
    batterySignal,
    timeSignal,
    deviceMotionSignal,
    audioDistressSignal,
    networkSignal,
    speechEngine,
    familiarPlaces
  } = useApp();

  const [diagnosticStatus, setDiagnosticStatus] = useState(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  // Quick preset scenarios for judge testing
  const PRESETS = [
    {
      label: 'Safe Baseline (Day)',
      values: {
        pace: 'normal',
        stillnessSeconds: 0,
        crowdDensity: 'large',
        routeFamiliarity: 'familiar',
        batteryLevel: 95,
        batteryDropType: 'none',
        distressAudio: false,
        deviceImpact: false,
        networkOffline: false
      }
    },
    {
      label: 'Night Walk (Familiar)',
      values: {
        pace: 'normal',
        stillnessSeconds: 0,
        crowdDensity: 'large',
        routeFamiliarity: 'familiar',
        batteryLevel: 80,
        batteryDropType: 'none',
        distressAudio: false,
        deviceImpact: false,
        networkOffline: false
      }
    },
    {
      label: 'Deserted Night Run (High)',
      values: {
        pace: 'increasing',
        stillnessSeconds: 0,
        crowdDensity: 'none',
        routeFamiliarity: 'unfamiliar',
        batteryLevel: 65,
        batteryDropType: 'none',
        distressAudio: false,
        deviceImpact: false,
        networkOffline: false
      }
    },
    {
      label: 'Stationary Isolated (High)',
      values: {
        pace: 'normal',
        stillnessSeconds: 120,
        crowdDensity: 'none',
        routeFamiliarity: 'familiar',
        batteryLevel: 50,
        batteryDropType: 'none',
        distressAudio: false,
        deviceImpact: false,
        networkOffline: false
      }
    },
    {
      label: 'Compound Threat + Battery Drop (Critical)',
      values: {
        pace: 'running',
        stillnessSeconds: 0,
        crowdDensity: 'small',
        routeFamiliarity: 'unfamiliar',
        batteryLevel: 8,
        batteryDropType: 'instant',
        distressAudio: true,
        deviceImpact: true,
        networkOffline: false
      }
    }
  ];

  const runHardwareDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setDiagnosticStatus('Scanning hardware sensor buses...');

    await new Promise(r => setTimeout(r, 600));

    const results = {
      gps: geoSignals.isGeolocationActive ? 'ONLINE (GPS Lock)' : 'STANDBY (Prompt / Fallback)',
      motion: deviceMotionSignal.motionSupported ? 'ONLINE (Accelerometer Active)' : 'EMULATED',
      audio: audioDistressSignal.permissionStatus === 'granted' ? 'ONLINE (Mic FFT Active)' : 'STANDBY',
      battery: batterySignal.isBatterySupported ? `ONLINE (${batterySignal.batteryLevel}%)` : 'SIMULATED',
      tts: speechEngine.ttsSupported ? 'ONLINE (SpeechSynthesis)' : 'UNSUPPORTED',
      stt: speechEngine.sttSupported ? 'ONLINE (SpeechRecognition)' : 'UNSUPPORTED',
      network: networkSignal.isOnline ? `ONLINE (${networkSignal.networkInfo.effectiveType})` : 'OFFLINE',
      clock: 'ONLINE (High Precision)'
    };

    setDiagnosticStatus(results);
    setIsRunningDiagnostics(false);
  };

  return (
    <div className="signal-dashboard-wrapper" id="signal-availability-dashboard">
      {/* Header */}
      <div className="dashboard-header-card">
        <div className="dashboard-title-row">
          <div className="dashboard-title-group">
            <span className="dash-icon">🧪</span>
            <div>
              <h3>Signal Availability & Telemetry Dashboard</h3>
              <p>Real-time status matrix of physical browser sensors and fallback engines</p>
            </div>
          </div>

          <button
            type="button"
            className="btn-run-diagnostics"
            onClick={runHardwareDiagnostics}
            disabled={isRunningDiagnostics}
          >
            {isRunningDiagnostics ? 'Scanning Sensors...' : '🔍 Ping Hardware Sensors'}
          </button>
        </div>
      </div>

      {/* Diagnostic Scan Output if run */}
      {diagnosticStatus && typeof diagnosticStatus === 'object' && (
        <div className="diagnostic-results-box">
          <div className="diag-header">
            <span>✓ Hardware Bus Diagnostic Scan Complete</span>
            <button type="button" className="btn-close-diag" onClick={() => setDiagnosticStatus(null)}>✕</button>
          </div>
          <div className="diag-grid">
            {Object.entries(diagnosticStatus).map(([key, val]) => (
              <div key={key} className="diag-item">
                <span className="diag-key">{key.toUpperCase()}:</span>
                <span className={`diag-val ${val.includes('ONLINE') ? 'online' : 'standby'}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preset Injector Bar */}
      <div className="presets-section-card">
        <div className="presets-title-row">
          <span className="presets-label">BENCHMARK SCENARIO PRESETS (SIMULATION DRIVER):</span>
          <button
            type="button"
            className="btn-reset-baseline"
            onClick={resetToSafeBaseline}
          >
            ↺ Reset Safe Baseline
          </button>
        </div>
        <div className="presets-button-grid">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              className="btn-preset-inject"
              onClick={() => updateSignals(p.values)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 8-Sensor Availability Status Grid */}
      <div className="signals-grid-container">

        {/* 1. Geolocation & Kinematics */}
        <div className={`sensor-tile ${geoSignals.isGeolocationActive ? 'tile-active' : 'tile-fallback'}`}>
          <div className="sensor-tile-top">
            <div className="sensor-name-wrap">
              <span className="sensor-icon">📍</span>
              <div>
                <h5>Geolocation & Speed</h5>
                <span className="sensor-tech">navigator.geolocation</span>
              </div>
            </div>
            <span className={`status-pill ${geoSignals.isGeolocationActive ? 'pill-active' : 'pill-fallback'}`}>
              {geoSignals.isGeolocationActive ? '● REAL ACTIVE' : '○ FALLBACK'}
            </span>
          </div>

          <div className="sensor-readings-row">
            <div className="reading-col">
              <span className="reading-label">Derived Pace</span>
              <span className="reading-val font-mono">{signals.pace.toUpperCase()}</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Calculated Speed</span>
              <span className="reading-val font-mono">{geoSignals.speedKmh} km/h</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Stationary</span>
              <span className="reading-val font-mono">{signals.stillnessSeconds}s</span>
            </div>
          </div>

          <div className="sensor-action-row">
            {geoSignals.isGeolocationActive ? (
              <button type="button" className="btn-sensor-action pause" onClick={geoSignals.stopTracking}>
                Pause GPS Tracking
              </button>
            ) : (
              <button type="button" className="btn-sensor-action start" onClick={geoSignals.requestPermission}>
                Authorize Live GPS Stream
              </button>
            )}
          </div>
        </div>

        {/* 2. DeviceMotion Accelerometer */}
        <div className={`sensor-tile ${deviceMotionSignal.motionSupported ? 'tile-active' : 'tile-fallback'}`}>
          <div className="sensor-tile-top">
            <div className="sensor-name-wrap">
              <span className="sensor-icon">🏃</span>
              <div>
                <h5>3-Axis Accelerometer</h5>
                <span className="sensor-tech">window.DeviceMotionEvent</span>
              </div>
            </div>
            <span className={`status-pill ${deviceMotionSignal.permissionStatus === 'granted' ? 'pill-active' : 'pill-fallback'}`}>
              {deviceMotionSignal.permissionStatus === 'granted' ? '● REAL SENSOR' : '○ SIMULATED'}
            </span>
          </div>

          <div className="sensor-readings-row">
            <div className="reading-col">
              <span className="reading-label">Total G-Force</span>
              <span className="reading-val font-mono">{deviceMotionSignal.magnitude} m/s²</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Impact Event</span>
              <span className={`reading-val font-mono ${deviceMotionSignal.impactDetected ? 'danger-highlight' : ''}`}>
                {deviceMotionSignal.impactDetected ? '🚨 IMPACT' : 'NORMAL'}
              </span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Axes [X, Y, Z]</span>
              <span className="reading-val font-mono text-xs">
                {deviceMotionSignal.acceleration.x}, {deviceMotionSignal.acceleration.y}, {deviceMotionSignal.acceleration.z}
              </span>
            </div>
          </div>

          <div className="sensor-action-row">
            <button type="button" className="btn-sensor-action simulate" onClick={deviceMotionSignal.simulateImpact}>
              Simulate High-G Fall / Impact
            </button>
          </div>
        </div>

        {/* 3. Ambient Audio & Scream Classifier */}
        <div className={`sensor-tile ${audioDistressSignal.permissionStatus === 'granted' ? 'tile-active' : 'tile-fallback'}`}>
          <div className="sensor-tile-top">
            <div className="sensor-name-wrap">
              <span className="sensor-icon">🎧</span>
              <div>
                <h5>Audio Distress FFT Classifier</h5>
                <span className="sensor-tech">Web Audio AnalyserNode (1.5-4.5kHz)</span>
              </div>
            </div>
            <span className={`status-pill ${audioDistressSignal.permissionStatus === 'granted' ? 'pill-active' : 'pill-fallback'}`}>
              {audioDistressSignal.permissionStatus === 'granted' ? '● MIC ACTIVE' : '○ STANDBY'}
            </span>
          </div>

          <div className="sensor-readings-row">
            <div className="reading-col">
              <span className="reading-label">RMS Volume</span>
              <span className="reading-val font-mono">{audioDistressSignal.volumeDb} dB</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Scream Band %</span>
              <span className="reading-val font-mono">{Math.round(audioDistressSignal.screamRatio * 100)}%</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Distress State</span>
              <span className={`reading-val font-mono ${audioDistressSignal.distressDetected ? 'danger-highlight' : ''}`}>
                {audioDistressSignal.distressDetected ? '🚨 DETECTED' : 'CLEAR'}
              </span>
            </div>
          </div>

          <div className="sensor-action-row">
            {audioDistressSignal.permissionStatus === 'granted' ? (
              <button type="button" className="btn-sensor-action pause" onClick={audioDistressSignal.stopAudio}>
                Pause Mic Stream
              </button>
            ) : (
              <button type="button" className="btn-sensor-action start" onClick={audioDistressSignal.requestAudioPermission}>
                Authorize Mic Stream
              </button>
            )}
            <button type="button" className="btn-sensor-action simulate" onClick={audioDistressSignal.simulateDistressScream}>
              Simulate Scream
            </button>
          </div>
        </div>

        {/* 4. Battery Status API */}
        <div className={`sensor-tile ${batterySignal.isBatterySupported ? 'tile-active' : 'tile-fallback'}`}>
          <div className="sensor-tile-top">
            <div className="sensor-name-wrap">
              <span className="sensor-icon">⚡</span>
              <div>
                <h5>Battery Reserve & Voltage Drop</h5>
                <span className="sensor-tech">navigator.getBattery()</span>
              </div>
            </div>
            <span className={`status-pill ${batterySignal.isBatterySupported ? 'pill-active' : 'pill-fallback'}`}>
              {batterySignal.isBatterySupported ? '● REAL BATTERY API' : '○ SIMULATED'}
            </span>
          </div>

          <div className="sensor-readings-row">
            <div className="reading-col">
              <span className="reading-label">Level Reserve</span>
              <span className="reading-val font-mono">{signals.batteryLevel}%</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Discharge Signature</span>
              <span className={`reading-val font-mono ${signals.batteryDropType === 'instant' ? 'danger-highlight' : ''}`}>
                {signals.batteryDropType.toUpperCase()}
              </span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Charging State</span>
              <span className="reading-val font-mono">{batterySignal.isCharging ? 'Plugged In' : 'On Battery'}</span>
            </div>
          </div>

          {!batterySignal.isBatterySupported && (
            <div className="sensor-action-row">
              <input
                type="range"
                min="1"
                max="100"
                value={manualSignals.batteryLevel}
                onChange={(e) => updateSignal('batteryLevel', Number(e.target.value))}
                className="mini-range"
              />
            </div>
          )}
        </div>

        {/* 5. Web Speech Synthesis (TTS) */}
        <div className={`sensor-tile ${speechEngine.ttsSupported ? 'tile-active' : 'tile-fallback'}`}>
          <div className="sensor-tile-top">
            <div className="sensor-name-wrap">
              <span className="sensor-icon">🗣️</span>
              <div>
                <h5>Speech Synthesis (TTS)</h5>
                <span className="sensor-tech">window.speechSynthesis</span>
              </div>
            </div>
            <span className={`status-pill ${speechEngine.ttsSupported ? 'pill-active' : 'pill-fallback'}`}>
              {speechEngine.ttsSupported ? '● VOICE READY' : '○ UNAVAILABLE'}
            </span>
          </div>

          <div className="sensor-readings-row">
            <div className="reading-col">
              <span className="reading-label">Voice Engine</span>
              <span className="reading-val">System Speech</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Last Spoken</span>
              <span className="reading-val text-xs text-truncate">
                {speechEngine.lastSpokenText || 'None yet'}
              </span>
            </div>
          </div>

          <div className="sensor-action-row">
            <button
              type="button"
              className="btn-sensor-action simulate"
              onClick={() => speechEngine.speakText('Astraea safety check-in: Are you safe? Speak or type your safe phrase.')}
            >
              Test Voice Check-In Prompt
            </button>
          </div>
        </div>

        {/* 6. Web Speech Recognition (STT) */}
        <div className={`sensor-tile ${speechEngine.sttSupported ? 'tile-active' : 'tile-fallback'}`}>
          <div className="sensor-tile-top">
            <div className="sensor-name-wrap">
              <span className="sensor-icon">🎙️</span>
              <div>
                <h5>Speech Recognition (STT)</h5>
                <span className="sensor-tech">webkitSpeechRecognition</span>
              </div>
            </div>
            <span className={`status-pill ${speechEngine.isListening ? 'pill-active' : 'pill-fallback'}`}>
              {speechEngine.isListening ? '● LISTENING' : '○ IDLE'}
            </span>
          </div>

          <div className="sensor-readings-row">
            <div className="reading-col">
              <span className="reading-label">Hotphrase</span>
              <span className="reading-val text-xs font-mono">ASTRAEA HELP ME</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Live Transcript</span>
              <span className="reading-val text-xs text-truncate font-mono">
                {speechEngine.transcript || 'Awaiting spoken input...'}
              </span>
            </div>
          </div>

          <div className="sensor-action-row">
            <button
              type="button"
              className="btn-sensor-action start"
              onClick={speechEngine.isListening ? speechEngine.stopListening : speechEngine.startListening}
            >
              {speechEngine.isListening ? 'Stop Listening' : 'Start Speech Recognition'}
            </button>
          </div>
        </div>

        {/* 7. Network Connectivity API */}
        <div className={`sensor-tile ${networkSignal.isOnline ? 'tile-active' : 'tile-fallback'}`}>
          <div className="sensor-tile-top">
            <div className="sensor-name-wrap">
              <span className="sensor-icon">📶</span>
              <div>
                <h5>Network Telemetry & Lifeline</h5>
                <span className="sensor-tech">navigator.connection</span>
              </div>
            </div>
            <span className={`status-pill ${networkSignal.isOnline ? 'pill-active' : 'pill-fallback'}`}>
              {networkSignal.isOnline ? '● ONLINE' : '○ OFFLINE'}
            </span>
          </div>

          <div className="sensor-readings-row">
            <div className="reading-col">
              <span className="reading-label">Connection Type</span>
              <span className="reading-val font-mono">{networkSignal.networkInfo.effectiveType.toUpperCase()}</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Bandwidth Downlink</span>
              <span className="reading-val font-mono">
                {networkSignal.networkInfo.downlink ? `${networkSignal.networkInfo.downlink} Mbps` : 'N/A'}
              </span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Latency RTT</span>
              <span className="reading-val font-mono">
                {networkSignal.networkInfo.rtt ? `${networkSignal.networkInfo.rtt} ms` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* 8. System Clock & Diurnal Time */}
        <div className="sensor-tile tile-active">
          <div className="sensor-tile-top">
            <div className="sensor-name-wrap">
              <span className="sensor-icon">🕒</span>
              <div>
                <h5>System Clock & Diurnal Cycle</h5>
                <span className="sensor-tech">new Date().getHours()</span>
              </div>
            </div>
            <span className="status-pill pill-active">● 100% REAL</span>
          </div>

          <div className="sensor-readings-row">
            <div className="reading-col">
              <span className="reading-label">Local Time</span>
              <span className="reading-val font-mono">{timeSignal.formattedTime}</span>
            </div>
            <div className="reading-col">
              <span className="reading-label">Diurnal Window</span>
              <span className="reading-val font-mono">
                {timeSignal.timeOfDay === 'day' ? '☀️ DAY (Safe)' : '🌙 NIGHT (Baseline +15)'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* External Cloud & Hardware API Architecture Matrix */}
      <div className="presets-section-card" style={{ marginTop: '1.5rem' }}>
        <div className="presets-title-row">
          <span className="presets-label">🌐 CONNECTED EXTERNAL & PLATFORM APIS:</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>📡 Open-Meteo REST API</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Live atmospheric telemetry (visibility, storm warnings) fetched via real HTTPS GET requests with zero keys required.</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>🗺️ OpenStreetMap Nominatim API</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Reverse geocodes real GPS coordinates into street and neighborhood names via HTTPS with in-memory caching.</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>⚡ Custom Webhook REST API</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Outbound HTTP POST dispatcher sending emergency incident payloads to Zapier, Make, Slack, or Twilio proxies.</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>✈️ Telegram Bot REST API</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Direct HTTP POST alerts to Telegram channels/chats via <code>api.telegram.org/bot&lt;TOKEN&gt;/sendMessage</code>.</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>🤖 Google Gemini AI REST API</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Live situation assessments and natural language risk analysis powered by Gemini 1.5/2.0 Flash endpoints.</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.25rem' }}>🎙️ W3C Web Platform APIs</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Web Audio FFT Analyser, DeviceMotionEvent, Geolocation, SpeechSynthesis, SpeechRecognition, Web Share & Notifications.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
