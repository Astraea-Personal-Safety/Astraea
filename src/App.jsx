import React, { useState } from 'react';
import { AppProvider } from './state/AppContext';
import { useApp } from './state/useApp';
import OnboardingSetup from './components/OnboardingSetup';
import RiskDisplay from './components/RiskDisplay';
import CheckInPrompt from './components/CheckInPrompt';
import JourneyShare from './components/JourneyShare';
import SignalAvailabilityDashboard from './components/SignalAvailabilityDashboard';
import TrustedCircleManager from './components/TrustedCircleManager';
import EmergencyDeliveryTracker from './components/EmergencyDeliveryTracker';
import SafetyTimeline from './components/SafetyTimeline';
import SafePhraseConfig from './components/SafePhraseConfig';
import PrivacyControls from './components/PrivacyControls';
import AccessibilityControls from './components/AccessibilityControls';
import SOSButton from './components/SOSButton';
import './App.css';

function MainAppContent() {
  const {
    mode,
    safeWord,
    trustedCircle,
    familiarPlaces,
    timeSignal,
    batterySignal,
    geoSignals,
    audioDistressSignal,
    deviceMotionSignal,
    privacySettings,
    setShowSettingsModal,
    resetToSafeBaseline,
    updateSignals
  } = useApp();

  const [activeTab, setActiveTab] = useState('shield'); // 'shield' | 'journey' | 'circle' | 'timeline' | 'telemetry' | 'settings'
  const [showQuickPresets, setShowQuickPresets] = useState(false);

  // Quick preset scenarios for instant judge testing anywhere in the app
  const DEMO_PRESETS = [
    { label: 'Safe Baseline', icon: '🟢', values: { pace: 'normal', stillnessSeconds: 0, crowdDensity: 'large', routeFamiliarity: 'familiar', batteryLevel: 95, batteryDropType: 'none', distressAudio: false, deviceImpact: false } },
    { label: 'Night Walk', icon: '🌙', values: { pace: 'normal', stillnessSeconds: 0, crowdDensity: 'large', routeFamiliarity: 'familiar', batteryLevel: 80, batteryDropType: 'none', distressAudio: false, deviceImpact: false } },
    { label: 'Deserted Run (High)', icon: '⚠️', values: { pace: 'increasing', stillnessSeconds: 0, crowdDensity: 'none', routeFamiliarity: 'unfamiliar', batteryLevel: 65, batteryDropType: 'none', distressAudio: false, deviceImpact: false } },
    { label: 'Stationary Isolated (High)', icon: '🛑', values: { pace: 'normal', stillnessSeconds: 120, crowdDensity: 'none', routeFamiliarity: 'familiar', batteryLevel: 50, batteryDropType: 'none', distressAudio: false, deviceImpact: false } },
    { label: 'Scream Detected (High)', icon: '🎧', values: { pace: 'normal', stillnessSeconds: 0, crowdDensity: 'none', routeFamiliarity: 'familiar', batteryLevel: 75, batteryDropType: 'none', distressAudio: true, deviceImpact: false } },
    { label: 'Fall / Impact Detected', icon: '🏃', values: { pace: 'normal', stillnessSeconds: 0, crowdDensity: 'none', routeFamiliarity: 'familiar', batteryLevel: 75, batteryDropType: 'none', distressAudio: false, deviceImpact: true } },
    { label: 'Compound Threat + Battery Drop (Critical)', icon: '🚨', values: { pace: 'running', stillnessSeconds: 0, crowdDensity: 'small', routeFamiliarity: 'unfamiliar', batteryLevel: 8, batteryDropType: 'instant', distressAudio: true, deviceImpact: true } }
  ];

  return (
    <div className={`app-shell ${privacySettings?.highContrast ? 'high-contrast-mode' : ''}`}>
      {/* Mobile-Friendly App Container */}
      <div className="app-phone-frame">
        {/* Top App Header & Live Security Bar */}
        <header className="app-top-header">
          <div className="header-top-row">
            <div className="app-brand-lockup">
              <div className="brand-logo-icon">
                <span className="logo-symbol">🛡️</span>
                <span className="logo-halo" />
              </div>
              <div>
                <h1 className="brand-title">Astraea</h1>
                <span className="brand-subtitle">Adaptive Real-Time Safety Sentinel</span>
              </div>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className={`btn-header-settings ${activeTab === 'settings' ? 'active-settings' : ''}`}
                onClick={() => setActiveTab('settings')}
                title="Security, Privacy & Accessibility Settings"
              >
                <span className="settings-gear">⚙️</span>
                <span className="settings-text">Settings</span>
              </button>
            </div>
          </div>

          {/* Real-Time Live Signal Status Chips */}
          <div className="header-status-strip">
            <div className="status-chip live-guard-chip">
              <span className="pulsing-green-dot" />
              <span>Guard Active ({mode})</span>
            </div>

            <div className="status-chip" title="System Clock Signal">
              <span>{timeSignal.timeOfDay === 'day' ? '☀️' : '🌙'} {timeSignal.formattedTime}</span>
            </div>

            <div className="status-chip" title="Battery Status Signal">
              <span>⚡ {batterySignal.batteryLevel}%</span>
            </div>

            <div className={`status-chip ${geoSignals.isGeolocationActive ? 'chip-gps-active' : ''}`} title="GPS Kinematics">
              <span>📍 {geoSignals.isGeolocationActive ? `${geoSignals.speedKmh} km/h` : 'GPS Fallback'}</span>
            </div>

            <div className={`status-chip ${audioDistressSignal.permissionStatus === 'granted' ? 'chip-audio-active' : ''}`} title="Acoustic Sentinel">
              <span>🎧 {audioDistressSignal.permissionStatus === 'granted' ? 'Mic Active' : 'Audio Standby'}</span>
            </div>
          </div>
        </header>

        {/* Minimal Onboarding / Safe Word Security Bar */}
        <OnboardingSetup />

        {/* Navigation Tabs */}
        <nav className="app-navigation-tabs">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'shield' ? 'active' : ''}`}
            onClick={() => setActiveTab('shield')}
          >
            <span className="tab-icon">🛡️</span>
            <span className="tab-title">Guardian</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'journey' ? 'active' : ''}`}
            onClick={() => setActiveTab('journey')}
          >
            <span className="tab-icon">📍</span>
            <span className="tab-title">Live Walk</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'circle' ? 'active' : ''}`}
            onClick={() => setActiveTab('circle')}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-title">Circle & Dispatch</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <span className="tab-icon">📜</span>
            <span className="tab-title">Timeline</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveTab('telemetry')}
          >
            <span className="tab-icon">🧪</span>
            <span className="tab-title">Signal Lab</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="tab-icon">⚙️</span>
            <span className="tab-title">Privacy</span>
          </button>
        </nav>

        {/* Main Content Area */}
        <main className="app-main-content">
          {/* Active Check-In & Anti-Coercion Stand-Down Prompt (Universal Priority) */}
          <CheckInPrompt />

          {/* TAB 1: GUARDIAN SHIELD (Primary Safety Dashboard) */}
          {activeTab === 'shield' && (
            <div className="tab-view-container animate-fade-in">
              <RiskDisplay />

              {/* Quick Action Cards in Guardian View */}
              <div className="guardian-quick-cards">
                <div className="quick-action-card" onClick={() => setActiveTab('journey')}>
                  <div className="quick-card-icon">📍</div>
                  <div className="quick-card-content">
                    <h4>Live Walk & Map</h4>
                    <p>Track your live route with Leaflet OpenStreetMap and 500m geofence zones.</p>
                  </div>
                  <span className="quick-card-arrow">→</span>
                </div>

                <div className="quick-action-card" onClick={() => setActiveTab('circle')}>
                  <div className="quick-card-icon">📡</div>
                  <div className="quick-card-content">
                    <h4>Delivery Pipeline Status</h4>
                    <p>Track real-time carrier acknowledgment for emergency broadcasts.</p>
                  </div>
                  <span className="quick-card-arrow">→</span>
                </div>

                <div className="quick-action-card" onClick={() => setActiveTab('settings')}>
                  <div className="quick-card-icon">🛡️</div>
                  <div className="quick-card-content">
                    <h4>Safe Phrase Armed</h4>
                    <p>{safeWord ? `Active (${safeWord.length} chars) • Duress & Voice trigger ready` : 'Click to configure safe phrase'}</p>
                  </div>
                  <span className="quick-card-arrow">⚙️</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE JOURNEY SHARING & MAP */}
          {activeTab === 'journey' && (
            <div className="tab-view-container animate-fade-in">
              <JourneyShare />
            </div>
          )}

          {/* TAB 3: CIRCLE & EMERGENCY DISPATCH STATUS */}
          {activeTab === 'circle' && (
            <div className="tab-view-container animate-fade-in circle-zones-view">
              <TrustedCircleManager />
              <EmergencyDeliveryTracker />
            </div>
          )}

          {/* TAB 4: SAFETY TIMELINE & AUDIT LOG */}
          {activeTab === 'timeline' && (
            <div className="tab-view-container animate-fade-in">
              <SafetyTimeline />
            </div>
          )}

          {/* TAB 5: SIGNAL AVAILABILITY & TELEMETRY LAB */}
          {activeTab === 'telemetry' && (
            <div className="tab-view-container animate-fade-in">
              <SignalAvailabilityDashboard />
            </div>
          )}

          {/* TAB 6: SECURITY, PRIVACY & ACCESSIBILITY CONFIG */}
          {activeTab === 'settings' && (
            <div className="tab-view-container animate-fade-in settings-view-wrapper">
              <SafePhraseConfig />
              <PrivacyControls />
              <AccessibilityControls />
            </div>
          )}
        </main>

        {/* Floating Quick Scenario Injector for Judges/Evaluation */}
        <div className="judge-eval-fab-container">
          <button
            type="button"
            className={`btn-judge-fab ${showQuickPresets ? 'open' : ''}`}
            onClick={() => setShowQuickPresets(!showQuickPresets)}
            title="Open Benchmark Scenario Quick-Injector"
          >
            <span className="fab-icon">⚡</span>
            <span className="fab-label">Judge Presets</span>
          </button>

          {showQuickPresets && (
            <div className="quick-presets-flyout">
              <div className="flyout-header">
                <span className="flyout-title">⚡ Instant Scenario Injector</span>
                <button
                  type="button"
                  className="btn-close-flyout"
                  onClick={() => setShowQuickPresets(false)}
                >
                  ✕
                </button>
              </div>
              <p className="flyout-subtext">Click any preset to test the composite risk scoring engine live:</p>
              
              <div className="flyout-buttons">
                {DEMO_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="flyout-preset-btn"
                    onClick={() => {
                      updateSignals(p.values);
                      setShowQuickPresets(false);
                      setActiveTab('shield');
                    }}
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="flyout-preset-btn reset-flyout-btn"
                  onClick={() => {
                    resetToSafeBaseline();
                    setShowQuickPresets(false);
                    setActiveTab('shield');
                  }}
                >
                  <span>↺</span>
                  <span>Reset Safe Baseline</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Universal Floating Emergency SOS Button & Overlay */}
        <SOSButton />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
