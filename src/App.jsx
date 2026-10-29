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
import PrivacyControls from './components/PrivacyControls';
import AccessibilityControls from './components/AccessibilityControls';
import SecurityVault from './components/SecurityVault';
import VoiceAssistantBar from './components/VoiceAssistantBar';
import SOSButton from './components/SOSButton';
import './App.css';

function MainAppContent() {
  const {
    mode,
    setMode,
    isDevMode,
    safeWord,
    trustedCircle,
    journey,
    startJourney,
    endJourney,
    timeSignal,
    batterySignal,
    geoSignals,
    audioDistressSignal,
    privacySettings,
    resetToSafeBaseline,
    updateSignals
  } = useApp();

  // 4 Bottom Tabs: 'home' | 'contacts' | 'locations' | 'settings'
  const [activeTab, setActiveTab] = useState('home');
  const [showDevModal, setShowDevModal] = useState(false);
  const [showQuickPresets, setShowQuickPresets] = useState(false);
  const [fakeCallTriggered, setFakeCallTriggered] = useState(false);

  // Quick preset scenarios for instant judge testing in ?dev=1
  const DEMO_PRESETS = [
    { label: 'Safe Baseline', icon: '🟢', values: { pace: 'normal', stillnessSeconds: 0, crowdDensity: 'large', routeFamiliarity: 'familiar', batteryLevel: 95, batteryDropType: 'none', distressAudio: false, deviceImpact: false } },
    { label: 'Night Walk', icon: '🌙', values: { pace: 'normal', stillnessSeconds: 0, crowdDensity: 'large', routeFamiliarity: 'familiar', batteryLevel: 80, batteryDropType: 'none', distressAudio: false, deviceImpact: false } },
    { label: 'Deserted Run (High)', icon: '⚠️', values: { pace: 'increasing', stillnessSeconds: 0, crowdDensity: 'none', routeFamiliarity: 'unfamiliar', batteryLevel: 65, batteryDropType: 'none', distressAudio: false, deviceImpact: false } },
    { label: 'Stationary Isolated (High)', icon: '🛑', values: { pace: 'normal', stillnessSeconds: 120, crowdDensity: 'none', routeFamiliarity: 'familiar', batteryLevel: 50, batteryDropType: 'none', distressAudio: false, deviceImpact: false } },
    { label: 'Scream Detected (High)', icon: '🎧', values: { pace: 'normal', stillnessSeconds: 0, crowdDensity: 'none', routeFamiliarity: 'familiar', batteryLevel: 75, batteryDropType: 'none', distressAudio: true, deviceImpact: false } },
    { label: 'Fall / Impact Detected', icon: '🏃', values: { pace: 'normal', stillnessSeconds: 0, crowdDensity: 'none', routeFamiliarity: 'familiar', batteryLevel: 75, batteryDropType: 'none', distressAudio: false, deviceImpact: true } },
    { label: 'Compound Threat + Battery Drop (Critical)', icon: '🚨', values: { pace: 'running', stillnessSeconds: 0, crowdDensity: 'small', routeFamiliarity: 'unfamiliar', batteryLevel: 8, batteryDropType: 'instant', distressAudio: true, deviceImpact: true } }
  ];

  const handleToggleCircleSharing = () => {
    setMode(mode === 'Connected' ? 'Solo' : 'Connected');
  };

  const handleTriggerFakeCall = () => {
    setFakeCallTriggered(true);
    setTimeout(() => {
      alert('📞 Incoming Call from "Mom": Astraea escape call simulation active.');
      setFakeCallTriggered(false);
    }, 1500);
  };

  return (
    <div className={`app-shell ${privacySettings?.highContrast ? 'high-contrast-mode' : ''}`}>
      {/* Dev Mode Floating Trigger (?dev=1 only) */}
      {isDevMode && (
        <button
          type="button"
          className="dev-lab-trigger"
          onClick={() => setShowDevModal(true)}
          title="Open Developer & Judge Lab"
        >
          <span>🧪</span>
          <span>Dev Tools (?dev=1)</span>
        </button>
      )}

      {/* Mobile-First Frame */}
      <div className="app-phone-frame">
        {/* Top Header */}
        <header className="app-top-header">
          <div className="header-top-row">
            <div className="app-brand-lockup">
              <div className="brand-logo-icon">
                <span className="logo-symbol">🛡️</span>
                <span className="logo-halo" />
              </div>
              <div>
                <h1 className="brand-title">Astraea</h1>
                <span className="brand-subtitle">Voice-First Autonomous Safety Sentinel</span>
              </div>
            </div>

            {/* Simplified Circle Sharing Toggle */}
            <div className="circle-sharing-toggle-wrap">
              <button
                type="button"
                className={`circle-toggle-btn ${mode === 'Connected' ? 'sharing-on' : 'sharing-off'}`}
                onClick={handleToggleCircleSharing}
                title="Toggle sharing alerts with your trusted emergency circle"
              >
                <span className="toggle-dot" />
                <span className="toggle-text">
                  {mode === 'Connected' ? 'Circle Active' : 'Solo Mode'}
                </span>
              </button>
            </div>
          </div>

          {/* Real-Time Live Signal Status Chips */}
          <div className="header-status-strip">
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
              <span>🎧 {audioDistressSignal.permissionStatus === 'granted' ? 'Mic Active' : 'Standby'}</span>
            </div>
          </div>
        </header>

        {/* Minimal Onboarding Setup */}
        <OnboardingSetup />

        {/* Universal Check-In Prompt (Takes priority over all views) */}
        <CheckInPrompt />

        {/* Main View Area */}
        <main className="app-main-content">
          {/* TAB 1: HOME (Sentinel, Risk Ring, Voice, Live Walk, SOS) */}
          {activeTab === 'home' && (
            <div className="tab-view-container animate-fade-in">
              {/* Central Risk Ring */}
              <RiskDisplay />

              {/* Multi-Language Voice Sentinel Bar */}
              <VoiceAssistantBar />

              {/* Live Walk & Journey Quick Action Card */}
              <div className="home-action-card">
                <div className="home-action-card-header">
                  <div className="action-card-title-group">
                    <span className="action-card-icon">🚶</span>
                    <div>
                      <h4 className="action-card-title">Live Walk Journey</h4>
                      <p className="action-card-subtitle">
                        {journey.isActive
                          ? `Monitoring active: "${journey.label}"`
                          : 'Share route & anomaly alerts with trusted circle'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`btn-journey-toggle ${journey.isActive ? 'journey-stop' : 'journey-start'}`}
                    onClick={journey.isActive ? endJourney : () => startJourney('Walking Home')}
                  >
                    {journey.isActive ? 'Stop Walk' : 'Start Walk'}
                  </button>
                </div>
              </div>

              {/* Escape / Fake-Call Button */}
              <div className="escape-call-row">
                <button
                  type="button"
                  className={`btn-escape-call ${fakeCallTriggered ? 'triggering' : ''}`}
                  onClick={handleTriggerFakeCall}
                >
                  <span>📞</span>
                  <span>{fakeCallTriggered ? 'Calling your phone...' : 'Simulate Escape Call'}</span>
                </button>
                <span className="escape-call-hint">Generates an immediate call to exit uncomfortable situations</span>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACTS (Trusted Circle & Escalation Pipeline) */}
          {activeTab === 'contacts' && (
            <div className="tab-view-container animate-fade-in">
              <TrustedCircleManager />
              <EmergencyDeliveryTracker />
            </div>
          )}

          {/* TAB 3: LOCATIONS (Interactive Leaflet Map & Safe Zones) */}
          {activeTab === 'locations' && (
            <div className="tab-view-container animate-fade-in">
              <JourneyShare />
            </div>
          )}

          {/* TAB 4: SETTINGS (Security Vault, Privacy, Timeline, Accessibility) */}
          {activeTab === 'settings' && (
            <div className="tab-view-container animate-fade-in settings-view-wrapper">
              <SecurityVault />
              <PrivacyControls />
              <SafetyTimeline />
              <AccessibilityControls />
            </div>
          )}
        </main>

        {/* Instagram-Style Bottom Navigation Bar */}
        <nav className="app-bottom-nav">
          <button
            type="button"
            className={`bottom-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span className="tab-icon">🛡️</span>
            <span className="tab-label">Home</span>
            <span className="tab-indicator" />
          </button>

          <button
            type="button"
            className={`bottom-tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            <span className="tab-icon">👥</span>
            <span className="tab-label">Contacts</span>
            <span className="tab-indicator" />
          </button>

          <button
            type="button"
            className={`bottom-tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
            onClick={() => setActiveTab('locations')}
          >
            <span className="tab-icon">📍</span>
            <span className="tab-label">Locations</span>
            <span className="tab-indicator" />
          </button>

          <button
            type="button"
            className={`bottom-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <span className="tab-icon">⚙️</span>
            <span className="tab-label">Settings</span>
            <span className="tab-indicator" />
          </button>
        </nav>

        {/* Universal Floating SOS Trigger */}
        <SOSButton />
      </div>

      {/* Dev Mode Slide-Over Modal (?dev=1 only) */}
      {isDevMode && showDevModal && (
        <div className="dev-modal-overlay animate-fade-in">
          <div className="dev-modal-card">
            <div className="dev-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🧪</span>
                <h3 style={{ margin: 0, color: '#f9fafb' }}>Developer & Judge Telemetry Lab</h3>
              </div>
              <button
                type="button"
                className="btn-close-dev-modal"
                onClick={() => setShowDevModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="dev-modal-content">
              {/* Scenario Presets */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h5 style={{ margin: '0 0 0.5rem', color: '#60a5fa' }}>⚡ Quick Benchmark Presets</h5>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {DEMO_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="flyout-preset-btn"
                      onClick={() => {
                        updateSignals(p.values);
                        setShowDevModal(false);
                        setActiveTab('home');
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
                      setShowDevModal(false);
                      setActiveTab('home');
                    }}
                  >
                    <span>↺</span>
                    <span>Reset Safe Baseline</span>
                  </button>
                </div>
              </div>

              {/* Full Hardware Signal Availability Dashboard */}
              <SignalAvailabilityDashboard />
            </div>
          </div>
        </div>
      )}
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
