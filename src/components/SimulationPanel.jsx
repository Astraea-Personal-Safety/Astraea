import React, { useState } from 'react';
import { useApp } from '../state/useApp';
import './SimulationPanel.css';

export default function SimulationPanel() {
  const {
    signals,
    manualSignals,
    updateSignal,
    updateSignals,
    resetToSafeBaseline,
    geoSignals,
    batterySignal,
    timeSignal,
    signalSourcesMeta,
    familiarPlaces
  } = useApp();

  const [showGpsExplanation, setShowGpsExplanation] = useState(false);

  // Preset scenarios for judge convenience during demo (drives manual simulation fallbacks)
  const PRESETS = [
    {
      label: 'Safe Baseline (Day)',
      values: {
        pace: 'normal',
        stillnessSeconds: 0,
        crowdDensity: 'large',
        routeFamiliarity: 'familiar',
        batteryLevel: 95,
        batteryDropType: 'none'
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
        batteryDropType: 'none'
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
        batteryDropType: 'none'
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
        batteryDropType: 'none'
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
        batteryDropType: 'instant'
      }
    }
  ];

  return (
    <div className="simulation-panel-wrapper" id="simulation-panel">
      {/* Simulation Header & Transparency Notice */}
      <div className="simulation-header">
        <div className="simulation-tags-row">
          <div className="simulation-tag-pill">SIGNAL TELEMETRY & SENSOR DASHBOARD</div>
          <div className="sensors-live-pill">
            <span className="live-dot" />
            <span>HYBRID SENSOR & SIMULATION ENGINE</span>
          </div>
        </div>
        <h2 className="simulation-title">Live Behavioral & Environmental Telemetry</h2>
        <p className="simulation-notice">
          Astraea automatically captures <strong>real browser signals</strong> (System Clock, Battery API, and Geolocation Kinematics) where available, and falls back to manual simulation controls when sensors are restricted or unpermitted.
        </p>
      </div>

      {/* Quick Scenario Preset Strip */}
      <div className="presets-container">
        <div className="presets-header-row">
          <span className="presets-label">BENCHMARK PRESETS (SIMULATION DRIVER):</span>
          <button
            type="button"
            className="preset-btn reset-btn"
            onClick={resetToSafeBaseline}
          >
            ↺ Reset Safe Baseline
          </button>
        </div>
        <div className="presets-buttons">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              className="preset-btn"
              onClick={() => updateSignals(preset.values)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sensor Feeds & Interactive Drivers */}
      <div className="controls-grid">

        {/* 1. TIME OF DAY (Fully Real from Browser System Clock) */}
        <div className="control-group signal-card signal-real">
          <div className="control-label-row">
            <div className="signal-title-wrap">
              <span className="signal-badge badge-real">● REAL SIGNAL</span>
              <label>Time of Day (System Clock)</label>
            </div>
            <span className="control-val-badge badge-time">
              {timeSignal.formattedTime} — {timeSignal.timeOfDay === 'day' ? '☀️ Day (6 AM - 7 PM)' : '🌙 Night'}
            </span>
          </div>
          <p className="signal-source-note">
            Derived directly from browser system clock (`new Date().getHours()`). Updates continuously without user permission.
          </p>
        </div>

        {/* 2. GEOLOCATION-DERIVED PACE & STILLNESS (Real GPS with Pre-Permission & Graceful Fallback) */}
        <div className={`control-group signal-card ${geoSignals.isGeolocationActive ? 'signal-real' : 'signal-simulated'}`}>
          <div className="control-label-row">
            <div className="signal-title-wrap">
              <span className={`signal-badge ${geoSignals.isGeolocationActive ? 'badge-real' : 'badge-fallback'}`}>
                {geoSignals.isGeolocationActive ? '● REAL GPS ACTIVE' : '○ SIMULATION FALLBACK'}
              </span>
              <label>Pace & Stillness (Kinematics)</label>
            </div>

            {geoSignals.isGeolocationActive ? (
              <button
                type="button"
                className="btn-gps-toggle btn-gps-pause"
                onClick={geoSignals.stopTracking}
              >
                ⏸ Pause Live GPS
              </button>
            ) : (
              <button
                type="button"
                className="btn-gps-toggle btn-gps-start"
                onClick={() => setShowGpsExplanation(true)}
              >
                📡 Enable Live GPS Telemetry
              </button>
            )}
          </div>

          {/* Pre-Permission Modal / Explanation Box */}
          {showGpsExplanation && !geoSignals.isGeolocationActive && (
            <div className="gps-pre-permission-box">
              <div className="pre-perm-header">
                <span>📍 Location Permission Explanation</span>
                <button
                  type="button"
                  className="btn-close-prem"
                  onClick={() => setShowGpsExplanation(false)}
                >
                  ✕
                </button>
              </div>
              <p className="pre-perm-text">
                Astraea calculates transit velocity and stationary duration in real time using the Haversine distance formula between consecutive GPS coordinates. <strong>All coordinates remain strictly on-device in browser memory.</strong>
              </p>
              <div className="pre-perm-actions">
                <button
                  type="button"
                  className="btn-grant-gps"
                  onClick={() => {
                    setShowGpsExplanation(false);
                    geoSignals.requestPermission();
                  }}
                >
                  Authorize Browser GPS Stream ↗
                </button>
              </div>
            </div>
          )}

          {/* GPS ACTIVE STATE: Readout Panel */}
          {geoSignals.isGeolocationActive ? (
            <div className="live-gps-telemetry-panel">
              <div className="telemetry-stat-tile">
                <span className="telemetry-label">Calculated Speed</span>
                <span className="telemetry-val">{geoSignals.speedKmh} km/h</span>
              </div>
              <div className="telemetry-stat-tile">
                <span className="telemetry-label">Derived Pace</span>
                <span className="telemetry-val pace-val">{geoSignals.pace}</span>
              </div>
              <div className="telemetry-stat-tile">
                <span className="telemetry-label">Stationary Time</span>
                <span className="telemetry-val">{geoSignals.stillnessSeconds}s</span>
              </div>
              <div className="telemetry-stat-tile">
                <span className="telemetry-label">Coordinates</span>
                <span className="telemetry-val coords-mini">
                  {geoSignals.coordinates ? `${geoSignals.coordinates.latitude.toFixed(4)}, ${geoSignals.coordinates.longitude.toFixed(4)}` : 'Locking...'}
                </span>
              </div>
            </div>
          ) : (
            /* GPS INACTIVE: Manual Sliders Fallback */
            <div className="manual-kinematics-fallback">
              <div className="fallback-explanation-strip">
                <span className="fallback-icon">ℹ️</span>
                <span>{signalSourcesMeta.pace.fallbackReason}</span>
              </div>

              {/* Manual Pace */}
              <div className="sub-control-block">
                <div className="control-label-row">
                  <label htmlFor="pace-control">Simulated Pace:</label>
                  <span className="control-val-badge badge-pace">{signals.pace}</span>
                </div>
                <div className="segmented-control" id="pace-control">
                  {[
                    { id: 'normal', label: 'Normal Walk' },
                    { id: 'increasing', label: 'Accelerating / Evasive' },
                    { id: 'running', label: 'Running / Sprint' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`segment-btn ${manualSignals.pace === opt.id ? 'active' : ''}`}
                      onClick={() => updateSignal('pace', opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Stillness */}
              <div className="sub-control-block">
                <div className="control-label-row">
                  <label htmlFor="stillness-slider">Simulated Stationary Duration:</label>
                  <span className="control-val-badge">{manualSignals.stillnessSeconds} seconds</span>
                </div>
                <input
                  id="stillness-slider"
                  type="range"
                  min="0"
                  max="180"
                  step="5"
                  value={manualSignals.stillnessSeconds}
                  onChange={(e) => updateSignal('stillnessSeconds', Number(e.target.value))}
                  className="range-slider"
                />
                <div className="slider-ticks-labels">
                  <span>0s (Moving)</span>
                  <span>30s (Threshold)</span>
                  <span>90s</span>
                  <span>180s (Max)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. BATTERY RESERVE & ANOMALY (Real API with Fallback) */}
        <div className={`control-group signal-card ${batterySignal.isBatterySupported ? 'signal-real' : 'signal-simulated'}`}>
          <div className="control-label-row">
            <div className="signal-title-wrap">
              <span className={`signal-badge ${batterySignal.isBatterySupported ? 'badge-real' : 'badge-fallback'}`}>
                {batterySignal.isBatterySupported ? '● REAL BATTERY API' : '○ SIMULATION FALLBACK'}
              </span>
              <label>Battery Reserve & Voltage Signature</label>
            </div>
            <span className={`control-val-badge ${signals.batteryLevel < 20 ? 'badge-danger' : ''}`}>
              {signals.batteryLevel}% {batterySignal.isCharging ? '⚡ (Charging)' : ''}
            </span>
          </div>

          {batterySignal.isBatterySupported ? (
            <div className="real-battery-readout">
              <div className="battery-stat-row">
                <span>Hardware Charge Level: <strong>{batterySignal.batteryLevel}%</strong></span>
                <span>Power Source: <strong>{batterySignal.isCharging ? 'Plugged In (Charging)' : 'Battery Power'}</strong></span>
                <span>Anomaly Signature: <strong>{batterySignal.batteryDropType}</strong></span>
              </div>
              <p className="signal-source-note">
                Monitored continuously via `navigator.getBattery()`. Tracks voltage gradient to detect sudden drop tampering anomalies.
              </p>
            </div>
          ) : (
            <div className="manual-battery-fallback">
              <div className="fallback-explanation-strip">
                <span className="fallback-icon">ℹ️</span>
                <span>{signalSourcesMeta.battery.fallbackReason}</span>
              </div>

              <input
                id="battery-slider"
                type="range"
                min="1"
                max="100"
                value={manualSignals.batteryLevel}
                onChange={(e) => updateSignal('batteryLevel', Number(e.target.value))}
                className="range-slider"
              />

              <div className="sub-control-block" style={{ marginTop: '10px' }}>
                <div className="control-label-row">
                  <label htmlFor="battery-drop-control">Discharge Anomaly Signature:</label>
                  <span className="control-val-badge badge-discharge">{manualSignals.batteryDropType}</span>
                </div>
                <div className="segmented-control" id="battery-drop-control">
                  {[
                    { id: 'none', label: 'Stable / Normal' },
                    { id: 'gradual', label: 'Gradual (< 20%)' },
                    { id: 'instant', label: 'Instant Drop (Tamper Risk)' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`segment-btn ${manualSignals.batteryDropType === opt.id ? 'active' : ''}`}
                      onClick={() => updateSignal('batteryDropType', opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. ROUTE FAMILIARITY (Real via Saved Places Geofence with Fallback) */}
        <div className={`control-group signal-card ${(geoSignals.isGeolocationActive && familiarPlaces.length > 0) ? 'signal-real' : 'signal-simulated'}`}>
          <div className="control-label-row">
            <div className="signal-title-wrap">
              <span className={`signal-badge ${(geoSignals.isGeolocationActive && familiarPlaces.length > 0) ? 'badge-real' : 'badge-fallback'}`}>
                {(geoSignals.isGeolocationActive && familiarPlaces.length > 0) ? '● REAL GEOFENCE' : '○ SIMULATION FALLBACK'}
              </span>
              <label>Route Familiarity & Perimeter</label>
            </div>
            <span className="control-val-badge">
              {signals.routeFamiliarity === 'familiar' ? '📍 Familiar Zone' : '❓ Unfamiliar Route'}
            </span>
          </div>

          {(geoSignals.isGeolocationActive && familiarPlaces.length > 0) ? (
            <div className="real-geofence-readout">
              {geoSignals.nearestPlaceInfo ? (
                <p className="geofence-status-text">
                  Nearest Safe Zone: <strong>{geoSignals.nearestPlaceInfo.name}</strong> ({geoSignals.nearestPlaceInfo.distanceMeters}m away). 
                  {geoSignals.nearestPlaceInfo.isFamiliar ? ' Within 500m geofence perimeter (Familiar).' : ' Outside 500m perimeter (Unfamiliar).'}
                </p>
              ) : (
                <p className="geofence-status-text">Evaluating live GPS distance against saved places...</p>
              )}
            </div>
          ) : (
            <div className="manual-familiarity-fallback">
              <div className="fallback-explanation-strip">
                <span className="fallback-icon">ℹ️</span>
                <span>{signalSourcesMeta.routeFamiliarity.fallbackReason}</span>
              </div>
              <div className="segmented-control" id="route-control">
                <button
                  type="button"
                  className={`segment-btn ${manualSignals.routeFamiliarity === 'familiar' ? 'active' : ''}`}
                  onClick={() => updateSignal('routeFamiliarity', 'familiar')}
                >
                  📍 Familiar Route
                </button>
                <button
                  type="button"
                  className={`segment-btn ${manualSignals.routeFamiliarity === 'unfamiliar' ? 'active' : ''}`}
                  onClick={() => updateSignal('routeFamiliarity', 'unfamiliar')}
                >
                  ❓ Unfamiliar Route
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5. CROWD DENSITY (Deliberately Manual Simulation Only) */}
        <div className="control-group signal-card signal-simulated">
          <div className="control-label-row">
            <div className="signal-title-wrap">
              <span className="signal-badge badge-simulated">○ SIMULATED INPUT</span>
              <label htmlFor="crowd-control">Bystander & Crowd Density</label>
            </div>
            <span className="control-val-badge">
              {signals.crowdDensity === 'none' ? 'None (Deserted)' : signals.crowdDensity === 'small' ? 'Small Group (1-8)' : 'Large Crowd'}
            </span>
          </div>

          <div className="segmented-control" id="crowd-control">
            {[
              { id: 'large', label: 'Large Crowd (Safer)' },
              { id: 'none', label: 'Deserted / Isolated' },
              { id: 'small', label: 'Small Group / Loitering' }
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                className={`segment-btn ${manualSignals.crowdDensity === opt.id ? 'active' : ''}`}
                onClick={() => updateSignal('crowdDensity', opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="crowd-density-note">
            * <strong>Architecture Note:</strong> Real-time crowd density requires a paid location-density API (e.g. telecom cell aggregation) or live user-base telemetry neither available at hackathon scale — manually simulated here, noted as future production integration scope.
          </p>
        </div>

      </div>
    </div>
  );
}
