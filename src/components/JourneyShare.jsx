import React, { useState, useEffect } from 'react';
import { useApp } from '../state/useApp';
import JourneyMap from './JourneyMap';
import './JourneyShare.css';

export default function JourneyShare() {
  const {
    mode,
    journey,
    startJourney,
    endJourney,
    circleNotifications,
    getCircleNames,
    setShowSettingsModal,
    geoSignals,
    familiarPlaces
  } = useApp();

  const [customLabel, setCustomLabel] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (!journey.isActive || !journey.startedAt) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [journey.isActive, journey.startedAt]);

  const elapsedSeconds = journey.isActive && journey.startedAt
    ? Math.max(0, Math.floor((currentTime - journey.startedAt) / 1000))
    : 0;

  const formatElapsed = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStart = (e) => {
    e.preventDefault();
    startJourney(customLabel || 'Heading Home');
    setCustomLabel('');
  };

  const handleShareLink = async () => {
    const lat = geoSignals.coordinates?.latitude || 28.6139;
    const lng = geoSignals.coordinates?.longitude || 77.2090;
    const shareUrl = `${window.location.origin}?track=${encodeURIComponent(journey.label)}&lat=${lat}&lng=${lng}`;
    const shareData = {
      title: `Astraea Live Journey: ${journey.label}`,
      text: `Track my live safety transit session "${journey.label}". I am currently near ${geoSignals.currentAddress}.`,
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus('✓ Link copied to clipboard!');
      setTimeout(() => setCopyStatus(''), 3500);
    }
  };

  const circleNames = getCircleNames();

  return (
    <div className="journey-view-shell" id="journey-share">
      
      {/* 1. Main Interactive Journey Map */}
      <JourneyMap
        coordinates={geoSignals.coordinates}
        breadcrumbs={geoSignals.routeBreadcrumbs}
        savedPlaces={familiarPlaces}
        currentAddress={geoSignals.currentAddress}
        speedKmh={geoSignals.speedKmh}
        pace={geoSignals.pace}
        stillnessSeconds={geoSignals.stillnessSeconds}
        isTracking={geoSignals.isGeolocationActive}
      />

      {/* Feature 2: Unusual Pattern / Anomaly Alert Banner */}
      {geoSignals.journeyAnomaly && (
        <div className="journey-anomaly-alert-card animate-fade-in">
          <div className="anomaly-alert-header">
            <span className="anomaly-icon">⚠️</span>
            <div className="anomaly-text-wrap">
              <h4>Unusual Pattern Detected in Journey</h4>
              <p>{geoSignals.journeyAnomaly.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Journey Live Card */}
      <div className={`journey-companion-card ${journey.isActive ? 'card-journey-active' : ''}`}>
        <div className="journey-card-top">
          <div className="journey-title-wrap">
            <span className="journey-live-icon">{journey.isActive ? '🛰️' : '📍'}</span>
            <div>
              <h3>Live Journey Companion</h3>
              <p className="circle-recipient-text">
                {mode === 'Connected' ? (
                  <>Connected with: <strong>{circleNames}</strong></>
                ) : (
                  <>Solo Mode: <strong>On-Device Privacy Mode</strong></>
                )}
              </p>
            </div>
          </div>
          {journey.isActive ? (
            <div className="live-pulsing-badge">
              <span className="pulsar-dot" />
              <span>STREAMING</span>
            </div>
          ) : (
            <span className="standby-badge">STANDBY</span>
          )}
        </div>

        {/* Live Metrics Row */}
        {journey.isActive && (
          <div className="transit-stats-row">
            <div className="transit-stat-block">
              <span className="stat-label">Elapsed Time</span>
              <span className="stat-val timer-highlight">{formatElapsed(elapsedSeconds)}</span>
            </div>
            <div className="transit-stat-block">
              <span className="stat-label">Current Velocity</span>
              <span className="stat-val font-mono">{geoSignals.speedKmh} km/h</span>
            </div>
            <div className="transit-stat-block">
              <span className="stat-label">Breadcrumb GPS Fixes</span>
              <span className="stat-val font-mono">{geoSignals.routeBreadcrumbs.length} pts</span>
            </div>
          </div>
        )}

        {journey.isActive ? (
          <div className="journey-active-actions">
            <p className="journey-active-hint">
              Streaming live threat advisories for <strong>"{journey.label}"</strong>. Your circle is notified automatically if your threat level shifts.
            </p>

            <div className="journey-btn-group">
              <button
                type="button"
                className="btn-share-live-link"
                onClick={handleShareLink}
              >
                🔗 Share Live Tracking Link
              </button>

              <button
                type="button"
                className="btn-complete-journey"
                onClick={endJourney}
              >
                🏠 I've Arrived Safely (End Walk)
              </button>
            </div>

            {copyStatus && <span className="copy-confirm-text">{copyStatus}</span>}
          </div>
        ) : (
          <div className="journey-start-section">
            <p className="journey-start-intro">
              Walking home alone or taking late transit? Share a live time-boxed monitoring session with <strong>{circleNames}</strong>.
            </p>
            <form onSubmit={handleStart} className="journey-start-form">
              <input
                type="text"
                placeholder="Trip label (e.g. Walking home, Late cab) — optional"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="journey-input-field"
              />
              <button type="submit" className="btn-start-walk">
                ▶ Start Live Journey Share
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 3. Live Notification Feed */}
      {circleNotifications.length > 0 && (
        <div className="simulated-toast-stream">
          <div className="stream-header">
            <span className="stream-radar-icon">📡</span>
            <span className="stream-title">Live Circle Notification Feed</span>
          </div>
          <div className="stream-list">
            {circleNotifications.map((notif) => (
              <div key={notif.id} className={`stream-toast toast-${notif.type}`}>
                <span className="toast-type-dot" />
                <span className="toast-text">{notif.message}</span>
                <span className="toast-timestamp">Just now</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
