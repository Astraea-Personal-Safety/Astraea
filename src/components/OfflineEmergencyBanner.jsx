import React from 'react';
import { useApp } from '../state/useApp';
import './OfflineEmergencyBanner.css';

export function OfflineEmergencyBanner() {
  const {
    networkSignal,
    batterySignal,
    signals,
    trustedCircle,
    geoSignals
  } = useApp();

  const isOffline = Boolean(signals?.networkOffline) || !networkSignal?.isOnline;
  const effectiveBattery = signals?.batteryLevel ?? batterySignal?.batteryLevel ?? 100;
  const isCriticalBattery = effectiveBattery <= 15;
  const isBatterySaver = effectiveBattery <= 20;

  if (!isOffline && !isCriticalBattery && !isBatterySaver) {
    return null;
  }

  const primaryContact = (trustedCircle || []).find(c => c.phone);
  const coords = geoSignals?.coordinates;
  const locationText = geoSignals?.currentAddress || (coords?.latitude != null ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : 'Location pending');
  const smsBody = encodeURIComponent(`ASTRAEA EMERGENCY: Device offline/low battery (${effectiveBattery}%). My last known location is ${locationText}. Please check on me.`);
  const smsHref = primaryContact?.phone ? `sms:${primaryContact.phone}?body=${smsBody}` : `sms:?body=${smsBody}`;

  return (
    <div className={`offline-emergency-banner ${isCriticalBattery ? 'battery-critical' : isOffline ? 'network-offline' : 'battery-saver'}`}>
      <div className="banner-content">
        <span className="banner-icon">
          {isCriticalBattery ? '🪫' : isOffline ? '📡' : '🔋'}
        </span>
        <div className="banner-text">
          <strong>
            {isCriticalBattery
              ? 'Critical Battery (≤15%)'
              : isOffline
              ? 'No Internet Connection (Offline)'
              : 'Battery Saver Active (≤20%)'}
          </strong>
          <p>
            {isOffline
              ? 'Cloud sync is paused. Use cellular direct SMS or 112 emergency calling.'
              : isCriticalBattery
              ? 'Final GPS snapshot buffered. Tap SMS to transmit coordinates before phone powers down.'
              : 'GPS polling throttled to conserve remaining battery.'}
          </p>
        </div>
      </div>

      <div className="banner-actions">
        <a href={smsHref} className="btn-banner-action btn-sms">
          📱 Direct SMS
        </a>
        <a href="tel:112" className="btn-banner-action btn-police">
          🚨 Call 112
        </a>
      </div>
    </div>
  );
}
