import React, { useState } from 'react';
import { useApp } from '../state/useApp';
import './OnboardingSetup.css';

export default function OnboardingSetup() {
  const {
    safeWord,
    mode,
    trustedCircle,
    familiarPlaces,
    isOnboarded,
    completeOnboarding,
    showSettingsModal,
    setShowSettingsModal
  } = useApp();

  // Wizard step state (Step 1 = Safe Word, Step 2 = Mode, Circle & Familiar Places)
  const [step, setStep] = useState(1);
  const [inputWord, setInputWord] = useState(safeWord || '');
  const [selectedMode, setSelectedMode] = useState(mode || 'Solo');
  const [contacts, setContacts] = useState(
    trustedCircle.length > 0
      ? trustedCircle
      : [
          { id: '1', name: '', phone: '' },
          { id: '2', name: '', phone: '' },
          { id: '3', name: '', phone: '' }
        ]
  );

  const [places, setPlaces] = useState(
    familiarPlaces.length > 0
      ? familiarPlaces
      : [
          { id: 'p1', name: 'Home', latitude: null, longitude: null },
          { id: 'p2', name: 'Work / Campus', latitude: null, longitude: null }
        ]
  );

  const [gpsCaptureStatus, setGpsCaptureStatus] = useState({});
  const [errorMsg, setErrorMsg] = useState('');

  // Minimal Status Bar when onboarded
  if (isOnboarded && !showSettingsModal) {
    return (
      <div className="onboarding-minimal-bar" id="safe-word-bar">
        <div className="safe-word-info">
          <span className="mode-pill-badge">{mode} Mode</span>
          <span className="safe-word-label">Safe Word:</span>
          <span className="safe-word-value">
            {safeWord ? '•'.repeat(Math.min(8, safeWord.length)) : 'None'}
          </span>
          {mode === 'Connected' && (
            <span className="circle-count-tag">
              👥 {trustedCircle.filter(c => c.name.trim()).length} in Circle
            </span>
          )}
          {familiarPlaces.length > 0 && (
            <span className="places-count-tag">
              📍 {familiarPlaces.length} Saved Place{familiarPlaces.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          type="button"
          className="settings-toggle-btn"
          onClick={() => {
            setInputWord(safeWord);
            setSelectedMode(mode);
            setContacts(
              trustedCircle.length > 0
                ? trustedCircle
                : [
                    { id: '1', name: '', phone: '' },
                    { id: '2', name: '', phone: '' },
                    { id: '3', name: '', phone: '' }
                  ]
            );
            setPlaces(
              familiarPlaces.length > 0
                ? familiarPlaces
                : [
                    { id: 'p1', name: 'Home', latitude: null, longitude: null },
                    { id: 'p2', name: 'Work / Campus', latitude: null, longitude: null }
                  ]
            );
            setStep(1);
            setShowSettingsModal(true);
          }}
          title="Open Security & Sharing Settings"
        >
          ⚙️ Settings
        </button>
      </div>
    );
  }

  // Handlers
  const handleStep1Next = (e) => {
    e.preventDefault();
    const trimmed = inputWord.trim();
    if (!trimmed || trimmed.length < 2) {
      setErrorMsg('Please enter a safe word at least 2 characters long.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleContactChange = (index, field, value) => {
    setContacts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handlePlaceNameChange = (index, value) => {
    setPlaces(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name: value };
      return updated;
    });
  };

  // Capture live GPS coordinates for a familiar place
  const captureGpsForPlace = (index) => {
    if (!navigator.geolocation) {
      setGpsCaptureStatus(prev => ({ ...prev, [index]: 'GPS unsupported' }));
      return;
    }

    setGpsCaptureStatus(prev => ({ ...prev, [index]: 'Capturing...' }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPlaces(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            latitude: Math.round(latitude * 10000) / 10000,
            longitude: Math.round(longitude * 10000) / 10000
          };
          return updated;
        });
        setGpsCaptureStatus(prev => ({ ...prev, [index]: '✓ Captured' }));
      },
      (err) => {
        setGpsCaptureStatus(prev => ({ ...prev, [index]: `Error: ${err.message}` }));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleFinalSave = (e) => {
    e.preventDefault();
    completeOnboarding(inputWord, selectedMode, contacts, places);
    setErrorMsg('');
  };

  return (
    <div className="onboarding-overlay" id="onboarding-modal">
      <div className="onboarding-modal-card">
        {/* Header */}
        <div className="modal-header">
          <div className="shield-badge">🛡️</div>
          <h2>{isOnboarded ? 'Security & Sharing Settings' : 'Setup Astraea'}</h2>
          <div className="step-indicator">
            <span className={`step-dot ${step === 1 ? 'active' : 'done'}`}>1. Safe Word</span>
            <span className="step-line" />
            <span className={`step-dot ${step === 2 ? 'active' : ''}`}>2. Protection Profile</span>
          </div>
        </div>

        <div className="modal-body">
          {/* STEP 1: Safe Word */}
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="onboarding-form">
              <p className="onboarding-description">
                Choose a secret <strong>safe word or phrase</strong>. If you're ever asked to confirm you're okay, <strong>only this exact word will stand down an alert</strong>.
              </p>

              <div className="coercion-notice">
                <span className="notice-icon">⚠️</span>
                <p>
                  <strong>Anti-Coercion Rule:</strong> Typing <em>"I'm fine"</em> or any wrong word triggers Instant Emergency SOS.
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="safe-word-input">Your Secret Safe Word / Phrase</label>
                <input
                  id="safe-word-input"
                  type="text"
                  placeholder="e.g. ASTRAEA, BLUE SKY, STARLIGHT"
                  value={inputWord}
                  onChange={(e) => {
                    setInputWord(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  autoFocus
                  className="safe-word-input"
                  autoComplete="off"
                />
                {errorMsg && <span className="input-error-msg">{errorMsg}</span>}
              </div>

              <div className="modal-actions">
                {isOnboarded && (
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowSettingsModal(false)}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn-primary-action">
                  Continue to Profile Setup →
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Mode, Circle & Familiar Places */}
          {step === 2 && (
            <form onSubmit={handleFinalSave} className="onboarding-form">
              <p className="onboarding-description">
                Configure your sharing mode and familiar safety zones:
              </p>

              {/* Mode Selection Cards */}
              <div className="mode-cards-grid">
                <div
                  className={`mode-card ${selectedMode === 'Solo' ? 'selected' : ''}`}
                  onClick={() => setSelectedMode('Solo')}
                >
                  <div className="mode-card-header">
                    <span className="mode-icon">👤</span>
                    <span className="mode-name">Solo</span>
                  </div>
                  <p className="mode-desc">Just you, nothing shared.</p>
                </div>

                <div
                  className={`mode-card ${selectedMode === 'Connected' ? 'selected' : ''}`}
                  onClick={() => setSelectedMode('Connected')}
                >
                  <div className="mode-card-header">
                    <span className="mode-icon">👥</span>
                    <span className="mode-name">Connected</span>
                  </div>
                  <p className="mode-desc">Add people who can be notified in a real emergency.</p>
                </div>
              </div>

              {/* Connected Contacts Setup */}
              {selectedMode === 'Connected' && (
                <div className="circle-contacts-section">
                  <div className="contacts-header">
                    <label>Trusted Circle Contacts (1-3):</label>
                    <span className="contacts-sublabel">Simulated emergency notification recipients</span>
                  </div>

                  <div className="contacts-inputs-list">
                    {contacts.map((contact, idx) => (
                      <div key={contact.id || idx} className="contact-input-row">
                        <input
                          type="text"
                          placeholder={`Contact ${idx + 1} Name (e.g. Maya)`}
                          value={contact.name}
                          onChange={(e) => handleContactChange(idx, 'name', e.target.value)}
                          className="contact-name-input"
                        />
                        <input
                          type="tel"
                          placeholder="Phone Number"
                          value={contact.phone}
                          onChange={(e) => handleContactChange(idx, 'phone', e.target.value)}
                          className="contact-phone-input"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Familiar Places Geofence Setup */}
              <div className="places-setup-section">
                <div className="places-header">
                  <label>Saved Familiar Places (Optional Geofence):</label>
                  <span className="places-sublabel">Used to calculate real-world Route Familiarity (500m radius)</span>
                </div>

                <div className="places-list">
                  {places.map((place, idx) => (
                    <div key={place.id || idx} className="place-item-row">
                      <input
                        type="text"
                        placeholder="Place Label (e.g. Home, Campus)"
                        value={place.name}
                        onChange={(e) => handlePlaceNameChange(idx, e.target.value)}
                        className="place-name-input"
                      />
                      <button
                        type="button"
                        className="btn-capture-gps"
                        onClick={() => captureGpsForPlace(idx)}
                      >
                        {gpsCaptureStatus[idx] || (place.latitude ? '📍 Update GPS' : '📍 Set Current GPS')}
                      </button>
                      {place.latitude && (
                        <span className="coords-pill">
                          {place.latitude}, {place.longitude}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <button type="submit" className="btn-primary-action">
                  {isOnboarded ? 'Save Settings' : 'Arm Astraea'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
