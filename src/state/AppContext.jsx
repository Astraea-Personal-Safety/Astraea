import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppContext } from './context';
import { DEFAULT_SIGNALS } from './constants';
import { calculateRiskScore } from '../engine/riskScore';
import { storage } from './storage';
import { CHECKIN_RESPONSE_WINDOW_SECONDS, CHECKIN_MAX_ATTEMPTS, CHECKIN_RETRY_INTERVAL_SECONDS } from '../engine/checkInConfig';
import { useTimeOfDaySignal } from '../signals/useTimeOfDaySignal';
import { useBatterySignal } from '../signals/useBatterySignal';
import { useGeolocationSignals } from '../signals/useGeolocationSignals';
import { useDeviceMotionSignal } from '../signals/useDeviceMotionSignal';
import { useAudioDistressSignal } from '../signals/useAudioDistressSignal';
import { useNetworkSignal } from '../signals/useNetworkSignal';
import { useSpeechInteraction, matchPhrase } from '../signals/useSpeechInteraction';
import { explainRiskAssessment, interpretSafetyCommand, fetchGeminiSafetyAnalysis } from '../engine/aiReasoning';
import { buildEmergencyPayload, dispatchEmergencyToCircle, sendBrowserNotification } from '../engine/deliveryService';
import { sirenSynth } from '../engine/sirenSynth';
import { useSpeakerVerification } from '../signals/useSpeakerVerification.js';
import { apiClient } from '../services/apiClient.js';

export { CHECKIN_RESPONSE_WINDOW_SECONDS, CHECKIN_MAX_ATTEMPTS, CHECKIN_RETRY_INTERVAL_SECONDS };

export function AppProvider({ children }) {
  // 1. Onboarding & Security Settings State
  const [safeWord, setSafeWordState] = useState(() => storage.getSafeWord());
  const [duressWord, setDuressWordState] = useState(() => storage.getDuressWord());
  const [voiceSosPhrase, setVoiceSosPhraseState] = useState(() => storage.getVoiceSosPhrase());
  const [isOnboarded, setIsOnboarded] = useState(() => storage.isOnboarded());
  const [mode, setModeState] = useState(() => storage.getMode()); // 'Solo' | 'Connected'
  const [trustedCircle, setTrustedCircleState] = useState(() => storage.getTrustedCircle());
  const [familiarPlaces, setFamiliarPlacesState] = useState(() => storage.getFamiliarPlaces());
  const [privacySettings, setPrivacySettingsState] = useState(() => storage.getPrivacySettings());
  const [webhookUrl, setWebhookUrlState] = useState(() => storage.getWebhookUrl());
  const [telegramConfig, setTelegramConfigState] = useState(() => storage.getTelegramConfig());
  const [whatsappConfig, setWhatsAppConfigState] = useState(() => storage.getWhatsAppConfig());
  const [geminiApiKey, setGeminiApiKeyState] = useState(() => storage.getGeminiApiKey());
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const setTelegramConfig = useCallback((cfg) => {
    setTelegramConfigState(cfg);
    storage.setTelegramConfig(cfg);
  }, []);

  const setWhatsAppConfig = useCallback((cfg) => {
    setWhatsAppConfigState(cfg);
    storage.setWhatsAppConfig(cfg);
  }, []);

  const setGeminiApiKey = useCallback((key) => {
    setGeminiApiKeyState(key);
    storage.setGeminiApiKey(key);
  }, []);

  // 2. Timeline Events Audit Log
  const [timelineEvents, setTimelineEvents] = useState(() => storage.getTimelineEvents());

  const addTimelineEvent = useCallback((event) => {
    const fullEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      ...event
    };
    setTimelineEvents(prev => {
      const updated = [...prev, fullEvent];
      storage.saveTimelineEvents(updated);
      return updated;
    });
  }, []);

  const clearTimeline = useCallback(() => {
    storage.clearTimeline();
    setTimelineEvents([]);
  }, []);

  // 3. Manual Simulation Dials (used when real sensors are inactive or for testing)
  const [manualSignals, setManualSignals] = useState({
    ...DEFAULT_SIGNALS,
    distressAudio: false,
    deviceImpact: false,
    networkOffline: false
  });

  // 4. Real Signal Hooks
  const timeSignal = useTimeOfDaySignal();
  const batterySignal = useBatterySignal(manualSignals.batteryLevel, manualSignals.batteryDropType);
  const geoSignals = useGeolocationSignals({
    manualPace: manualSignals.pace,
    manualStillnessSeconds: manualSignals.stillnessSeconds,
    manualRouteFamiliarity: manualSignals.routeFamiliarity,
    savedPlaces: familiarPlaces
  });
  const deviceMotionSignal = useDeviceMotionSignal({ enabled: privacySettings.motionSensorEnabled });
  const audioDistressSignal = useAudioDistressSignal({ enabled: privacySettings.micDistressEnabled });
  const networkSignal = useNetworkSignal();
  const speakerVerifier = useSpeakerVerification();

  // 5. Live Journey State
  const [journey, setJourney] = useState({
    isActive: false,
    label: '',
    startedAt: null
  });

  // 6. Notification Toasts & Delivery Tracker Records
  const [circleNotifications, setCircleNotifications] = useState([]);
  const [deliveryRecords, setDeliveryRecords] = useState([]);

  // 7. Emergency SOS State
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [isCovertAlertActive, setIsCovertAlertActive] = useState(false);
  const [sosReason, setSosReason] = useState(null);
  const [sosTriggeredAt, setSosTriggeredAt] = useState(null);
  const [emergencyPayload, setEmergencyPayload] = useState(null);

  // 8. Check-In Pipeline State
  const [checkInState, setCheckInState] = useState('idle');
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [countdown, setCountdown] = useState(CHECKIN_RESPONSE_WINDOW_SECONDS);
  const [checkInFeedback, setCheckInFeedback] = useState(null);
  const checkInCooldownUntilRef = useRef(0);

  // Dev & Manual override mode
  const isDevMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('dev') === '1';
  }, []);
  const [manualOverrideMode, setManualOverrideMode] = useState(false);

  const lastUpdatedRef = useRef(0);
  const prevScoreRef = useRef(0);
  const prevTierRef = useRef('LOW');

  useEffect(() => {
    lastUpdatedRef.current = Date.now();
  }, []);

  // Helper to format circle names
  const getCircleNames = useCallback(() => {
    if (!trustedCircle || trustedCircle.length === 0) return 'Trusted Circle';
    return trustedCircle.map(c => c.name).filter(Boolean).join(', ') || 'Trusted Circle';
  }, [trustedCircle]);

  // Toast Dispatcher (Live Circle Ping Toast)
  const dispatchCircleNotification = useCallback((message, type = 'info') => {
    const newNotif = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      message,
      type,
      timestamp: Date.now()
    };

    setCircleNotifications(prev => [...prev.slice(-3), newNotif]);

    setTimeout(() => {
      setCircleNotifications(prev => prev.filter(n => n.id !== newNotif.id));
    }, 4500);
  }, []);

  // Compute effective composite signals combining real sensors and fallback simulation
  const effectiveSignals = useMemo(() => {
    const override = manualOverrideMode || isDevMode;
    return {
      // Pace: dev/manual override if active, else real GPS if active, else manual fallback
      pace: override ? manualSignals.pace : (geoSignals.isGeolocationActive ? geoSignals.pace : manualSignals.pace),
      
      // Stillness: dev/manual override if active, else real GPS stillness if active, else manual fallback
      stillnessSeconds: override ? manualSignals.stillnessSeconds : (geoSignals.isGeolocationActive ? geoSignals.stillnessSeconds : manualSignals.stillnessSeconds),
      
      // Crowd Density: Manual simulation
      crowdDensity: manualSignals.crowdDensity,
      
      // Time of Day: dev/manual override if provided, else real browser clock
      timeOfDay: override ? (manualSignals.timeOfDay || timeSignal.timeOfDay) : timeSignal.timeOfDay,
      
      // Route Familiarity: dev/manual override if active, else real GPS distance to saved places
      routeFamiliarity: override
        ? manualSignals.routeFamiliarity
        : ((geoSignals.isGeolocationActive && familiarPlaces.length > 0) ? geoSignals.routeFamiliarity : manualSignals.routeFamiliarity),
      
      // Battery Level: dev/manual override if active, else real battery
      batteryLevel: override
        ? manualSignals.batteryLevel
        : (batterySignal.isBatterySupported ? batterySignal.batteryLevel : manualSignals.batteryLevel),
      
      // Battery Drop Type: dev/manual override if active, else real battery anomaly
      batteryDropType: override
        ? manualSignals.batteryDropType
        : (batterySignal.isBatterySupported ? batterySignal.batteryDropType : manualSignals.batteryDropType),
      
      // Real Hardware Sensor: Acoustic Distress Detection (Web Audio API)
      distressAudio: audioDistressSignal.distressDetected || manualSignals.distressAudio,
      
      // Real Hardware Sensor: Fall / Impact (DeviceMotionEvent)
      deviceImpact: deviceMotionSignal.impactDetected || manualSignals.deviceImpact,
      
      // Real Hardware Sensor: Network disconnection
      networkOffline: !networkSignal.isOnline || manualSignals.networkOffline,

      // Journey Share State
      journeyShareActive: journey.isActive
    };
  }, [
    manualOverrideMode,
    isDevMode,
    geoSignals.isGeolocationActive,
    geoSignals.pace,
    geoSignals.stillnessSeconds,
    geoSignals.routeFamiliarity,
    manualSignals,
    timeSignal.timeOfDay,
    familiarPlaces.length,
    batterySignal.isBatterySupported,
    batterySignal.batteryLevel,
    batterySignal.batteryDropType,
    audioDistressSignal.distressDetected,
    deviceMotionSignal.impactDetected,
    networkSignal.isOnline,
    journey.isActive
  ]);

  // Telemetry metadata
  const signalSourcesMeta = useMemo(() => {
    return {
      timeOfDay: {
        isReal: true,
        source: 'Real Browser System Clock',
        displayVal: `${timeSignal.formattedTime} (${timeSignal.timeOfDay === 'day' ? '☀️ Day' : '🌙 Night'})`,
        note: 'Calculated from local browser time (Day: 6 AM - 7 PM)'
      },
      pace: {
        isReal: geoSignals.isGeolocationActive,
        source: geoSignals.isGeolocationActive ? 'Real GPS Telemetry' : 'Manual Simulation (Fallback)',
        displayVal: geoSignals.isGeolocationActive ? `${geoSignals.speedKmh} km/h (${geoSignals.pace})` : manualSignals.pace,
        fallbackReason: geoSignals.fallbackReason
      },
      stillness: {
        isReal: geoSignals.isGeolocationActive,
        source: geoSignals.isGeolocationActive ? 'Real GPS Stillness' : 'Manual Simulation (Fallback)',
        displayVal: `${geoSignals.isGeolocationActive ? geoSignals.stillnessSeconds : manualSignals.stillnessSeconds}s stationary`,
        fallbackReason: geoSignals.fallbackReason
      },
      routeFamiliarity: {
        isReal: geoSignals.isGeolocationActive && familiarPlaces.length > 0,
        source: (geoSignals.isGeolocationActive && familiarPlaces.length > 0) ? 'Real GPS Geofence' : 'Manual Simulation',
        displayVal: (geoSignals.isGeolocationActive && familiarPlaces.length > 0) ? geoSignals.routeFamiliarity : manualSignals.routeFamiliarity,
        nearestPlaceInfo: geoSignals.nearestPlaceInfo,
        fallbackReason: !geoSignals.isGeolocationActive ? 'GPS inactive' : null
      },
      battery: {
        isReal: batterySignal.isBatterySupported,
        source: batterySignal.isBatterySupported ? 'Real Battery Status API' : 'Manual Simulation (Fallback)',
        displayVal: `${batterySignal.isBatterySupported ? batterySignal.batteryLevel : manualSignals.batteryLevel}% (${batterySignal.batteryDropType})`,
        fallbackReason: batterySignal.fallbackReason
      },
      crowdDensity: {
        isReal: false,
        source: 'Manual Simulation Only',
        displayVal: manualSignals.crowdDensity
      },
      deviceMotion: {
        isReal: deviceMotionSignal.motionSupported,
        source: deviceMotionSignal.motionSupported ? 'Real Accelerometer (DeviceMotion)' : 'Emulated Sensor',
        displayVal: `${deviceMotionSignal.magnitude} m/s² (Impact: ${deviceMotionSignal.impactDetected ? 'YES' : 'NO'})`
      },
      ambientAudio: {
        isReal: audioDistressSignal.permissionStatus === 'granted',
        source: audioDistressSignal.permissionStatus === 'granted' ? 'Real Web Audio FFT Mic' : 'Standby / Muted',
        displayVal: `${audioDistressSignal.volumeDb} dB (Scream: ${Math.round(audioDistressSignal.screamRatio * 100)}%)`
      }
    };
  }, [timeSignal, batterySignal, geoSignals, manualSignals, familiarPlaces.length, deviceMotionSignal, audioDistressSignal]);

  // Risk Assessment
  const [riskAssessment, setRiskAssessment] = useState(() => calculateRiskScore(effectiveSignals, 0, 0));
  const [previousScore, setPreviousScore] = useState(0);
  const [isCriticalFlash, setIsCriticalFlash] = useState(false);

  // AI Reasoning Explanation
  const aiExplanation = useMemo(() => {
    return explainRiskAssessment(effectiveSignals, riskAssessment);
  }, [effectiveSignals, riskAssessment]);

  // UNIFIED SOS TRIGGER ACTION
  const triggerSOS = useCallback((reason = 'manual', { silent = false } = {}) => {
    setIsSOSActive(true);
    setIsCovertAlertActive(silent);
    setSosReason(reason);
    const now = Date.now();
    setSosTriggeredAt(now);

    if (!silent) {
      setIsCriticalFlash(true);
      setTimeout(() => setIsCriticalFlash(false), 1500);
    }

    setCheckInState('idle');
    setCheckInFeedback(null);

    // Audible emergency siren alarm (loud path only)
    if (privacySettings.audibleSiren && !silent) {
      sirenSynth.startSiren({ volume: 0.5 });
    }

    // Tactical haptics (loud path only)
    if (privacySettings.hapticsEnabled && !silent && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 500]);
    }

    let reasonText = 'Manual Emergency SOS Activated';
    if (reason === 'coercion_wrong_word') {
      reasonText = 'CRITICAL ALERT: Potential coercion/duress detected (non-matching safe word or duress phrase)';
    } else if (reason === 'coercion_duress_word') {
      reasonText = 'CRITICAL ALERT: Covert duress phrase spoken or entered by user';
    } else if (reason === 'silence_timeout') {
      reasonText = 'CRITICAL ALERT: Emergency response window expired after 3 unanswered check-ins';
    } else if (reason === 'voice_trigger') {
      reasonText = 'CRITICAL ALERT: Emergency voice trigger hotphrase spoken';
    } else if (reason === 'ambient_distress') {
      reasonText = 'CRITICAL ALERT: Acoustic scream / ambient distress signature detected';
    }

    setRiskAssessment({
      score: 100,
      tier: 'CRITICAL',
      contributingFactors: [
        reasonText,
        silent ? 'Covert silent emergency dispatch active' : 'Alert broadcast to Trusted Circle & Emergency Links Armed',
        'Strict safe-word stand-down required'
      ]
    });
    prevScoreRef.current = 100;
    prevTierRef.current = 'CRITICAL';

    // Build payload and initiate delivery tracking
    const payload = buildEmergencyPayload({
      reason,
      coordinates: geoSignals.coordinates,
      address: geoSignals.currentAddress || 'Live GPS Coordinates',
      riskScore: 100,
      tier: 'CRITICAL',
      timestamp: now
    });
    setEmergencyPayload(payload);

    // Dispatch via delivery service
    dispatchEmergencyToCircle({
      contacts: mode === 'Connected' ? trustedCircle : [],
      payload,
      webhookUrl,
      telegramConfig,
      whatsappConfig,
      onContactStatusUpdate: (record) => {
        setDeliveryRecords(prev => {
          const index = prev.findIndex(r => r.contactId === record.contactId);
          if (index >= 0) {
            const next = [...prev];
            next[index] = record;
            return next;
          }
          return [...prev, record];
        });
      }
    });

    // Trigger Outbound AI Call to Primary Emergency Contact via Bolna
    const primaryContact = (trustedCircle || []).find(c => c.phone);
    if (primaryContact && primaryContact.phone) {
      apiClient.triggerBolnaCall({
        phoneNumber: primaryContact.phone,
        callType: 'alert',
        recipientName: primaryContact.name || 'Emergency Contact',
        trackingUrl: `https://astraea-safety.vercel.app/track/sos-${now}`,
        emergencyReason: reasonText,
        dryRun: false
      }).catch(err => {
        console.warn('Bolna call dispatch:', err.message);
      });
    }

    // Log timeline event
    addTimelineEvent({
      category: 'SOS',
      title: silent ? '⚠️ Covert Emergency Alert Dispatched' : '🚨 Emergency SOS Triggered',
      description: reasonText,
      details: { reason, location: geoSignals.currentAddress || 'GPS Coordinates', silent }
    });

    if (!silent) {
      if (mode === 'Connected') {
        const names = getCircleNames();
        dispatchCircleNotification(`🚨 EMERGENCY SOS DISPATCH: Notifying ${names} — Immediate assistance requested`, 'alert');
      } else {
        dispatchCircleNotification(`🚨 LOCAL SOS ARMED: Solo Mode active (Local emergency links ready)`, 'alert');
      }
    }
  }, [privacySettings, geoSignals, mode, trustedCircle, webhookUrl, telegramConfig, whatsappConfig, getCircleNames, dispatchCircleNotification, addTimelineEvent]);

  // Stand down SOS
  const standDownSOS = useCallback((enteredWord) => {
    if (!safeWord) return false;
    const isMatch = matchPhrase(enteredWord, safeWord);

    if (isMatch) {
      setIsSOSActive(false);
      setIsCovertAlertActive(false);
      setSosReason(null);
      setSosTriggeredAt(null);
      sirenSynth.stopSiren();
      setManualOverrideMode(false);
      checkInCooldownUntilRef.current = Date.now() + 120000; // 2 min cooldown to prevent instant re-trigger
      setManualSignals({
        ...DEFAULT_SIGNALS,
        distressAudio: false,
        deviceImpact: false,
        networkOffline: false
      });
      const res = calculateRiskScore(effectiveSignals, 0, 0);
      setRiskAssessment(res);
      prevScoreRef.current = res.score;
      prevTierRef.current = res.tier;
      setPreviousScore(0);
      setCheckInState('resolved');
      setCheckInFeedback({ type: 'success', message: 'Safe word verified • Emergency stand-down confirmed' });

      addTimelineEvent({
        category: 'CHECKIN',
        title: '✅ Emergency Alert Stood Down',
        description: 'Exact safe confirmation word verified. Siren disarmed.'
      });

      if (mode === 'Connected') {
        const names = getCircleNames();
        dispatchCircleNotification(`✅ STAND-DOWN: Notifying ${names} — Safe word confirmed. Alert resolved.`, 'success');
      }

      setTimeout(() => {
        setCheckInState('idle');
        setCheckInFeedback(null);
      }, 4000);
      return true;
    }
    return false;
  }, [safeWord, effectiveSignals, mode, getCircleNames, dispatchCircleNotification, addTimelineEvent]);

  // Submit Check-In
  const submitCheckIn = useCallback((inputText, options = {}) => {
    const trimmedInput = inputText.trim();

    // 0. Biometric Speaker Verification Coercion Check
    // If the words match but speaker acoustics deviate significantly, trigger silent alert
    if (options.speakerMismatch) {
      lastUpdatedRef.current = Date.now();
      setCheckInState('resolved');
      setCheckInFeedback({ type: 'success', message: 'Safe word verified • Alert stood down' });
      checkInCooldownUntilRef.current = Date.now() + 120000;

      addTimelineEvent({
        category: 'SOS',
        title: '⚠️ Biometric Speaker Mismatch Detected',
        description: 'Safe word text matched, but acoustic voice verification failed (potential coercion or non-user speaker). Silent alert dispatched.'
      });

      triggerSOS('coercion_voice_mismatch', { silent: true });

      setTimeout(() => {
        setCheckInState('idle');
        setCheckInFeedback(null);
      }, 4000);
      return { success: true, covert: true, reason: 'voice_mismatch' };
    }

    // 1. Covert Duress Word Verification
    if (duressWord && matchPhrase(trimmedInput, duressWord)) {
      lastUpdatedRef.current = Date.now();
      setCheckInState('resolved');
      setCheckInFeedback({ type: 'success', message: 'Safe word verified • Alert stood down' });
      checkInCooldownUntilRef.current = Date.now() + 120000;

      addTimelineEvent({
        category: 'SOS',
        title: '⚠️ Covert Duress Phrase Activated',
        description: 'User entered covert duress phrase. Normal safe confirmation shown while emergency dispatch is silently triggered.'
      });

      // Silent covert emergency dispatch without siren or loud modal
      triggerSOS('coercion_duress_word', { silent: true });

      setTimeout(() => {
        setCheckInState('idle');
        setCheckInFeedback(null);
      }, 4000);
      return { success: true, covert: true };
    }

    // 2. Safe Word Verification
    if (safeWord && matchPhrase(trimmedInput, safeWord)) {
      lastUpdatedRef.current = Date.now();
      prevScoreRef.current = 0;
      prevTierRef.current = 'LOW';
      setPreviousScore(0);
      setManualOverrideMode(false);
      setManualSignals({
        ...DEFAULT_SIGNALS,
        distressAudio: false,
        deviceImpact: false,
        networkOffline: false
      });
      setCheckInState('resolved');
      setCheckInFeedback({ type: 'success', message: 'Safe word verified • Alert stood down' });
      checkInCooldownUntilRef.current = Date.now() + 120000;

      addTimelineEvent({
        category: 'CHECKIN',
        title: '✅ Check-In Stand-Down Verified',
        description: 'Safe word verified. Risk score reset to baseline.'
      });

      if (mode === 'Connected' && journey.isActive) {
        const names = getCircleNames();
        dispatchCircleNotification(`✅ CHECK-IN VERIFIED: Notifying ${names} — Safe confirmation received`, 'info');
      }

      setTimeout(() => {
        setCheckInState('idle');
        setCheckInFeedback(null);
      }, 4000);
      return { success: true };
    }

    // 3. Mismatched Word -> Anti-coercion silent escalation
    triggerSOS('coercion_wrong_word', { silent: true });
    return { success: false, reason: 'coercion' };
  }, [duressWord, safeWord, mode, journey.isActive, getCircleNames, dispatchCircleNotification, triggerSOS, addTimelineEvent]);

  // Journey Share Actions
  const startJourney = useCallback((label = 'Heading Home') => {
    const cleanLabel = label.trim() || 'Active Journey';
    setJourney({
      isActive: true,
      label: cleanLabel,
      startedAt: Date.now()
    });

    addTimelineEvent({
      category: 'SYSTEM',
      title: '📍 Journey Started',
      description: `Live Journey Share started for "${cleanLabel}"`
    });

    const names = getCircleNames();
    dispatchCircleNotification(`📍 JOURNEY STARTED: Notifying ${names} — "${cleanLabel}" (Live monitoring enabled)`, 'info');
  }, [getCircleNames, dispatchCircleNotification, addTimelineEvent]);

  const endJourney = useCallback(() => {
    setJourney({
      isActive: false,
      label: '',
      startedAt: null
    });

    addTimelineEvent({
      category: 'SYSTEM',
      title: '🏠 Journey Completed',
      description: 'Arrived safely. Live location sharing ended.'
    });

    const names = getCircleNames();
    dispatchCircleNotification(`🏠 JOURNEY ENDED: Notifying ${names} — Arrived safely`, 'success');
  }, [getCircleNames, dispatchCircleNotification, addTimelineEvent]);

  // Manual or Voice Triggered Check-In
  const speechEngineRef = useRef(null);
  const triggerSafetyCheckIn = useCallback((reason = 'Voice safety trigger detected') => {
    if (isSOSActive || checkInState !== 'idle') return;
    setCheckInState('prompting');
    setCurrentAttempt(1);
    setCountdown(CHECKIN_RESPONSE_WINDOW_SECONDS);
    if (privacySettings.ttsVoiceEnabled && speechEngineRef.current) {
      speechEngineRef.current.speakText('Astraea safety check-in: Are you safe? Speak or type your safe phrase.');
    }
    if (privacySettings.hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    sirenSynth.playAlertChime();
    addTimelineEvent({
      category: 'CHECKIN',
      title: '🛡️ Voice-Triggered Check-In Initiated',
      description: reason
    });
  }, [isSOSActive, checkInState, privacySettings, addTimelineEvent]);

  // Active Check-In Biometric Voice Sampling
  useEffect(() => {
    if (checkInState !== 'prompting' || !speakerVerifier.isEnrolled) {
      return;
    }
    let sampleTimer = null;
    speakerVerifier.startCapture().then(started => {
      if (started) {
        sampleTimer = setInterval(() => {
          speakerVerifier.sampleFrame();
        }, 100);
      }
    });
    return () => {
      if (sampleTimer) clearInterval(sampleTimer);
    };
  }, [checkInState, speakerVerifier]);

  // Speech Engine Integration
  const speechEngine = useSpeechInteraction({
    safeWord,
    duressWord,
    voiceSosPhrase,
    isCheckInActive: checkInState === 'prompting' || checkInState === 'waiting_retry',
    ttsEnabled: privacySettings.ttsVoiceEnabled,
    sttEnabled: privacySettings.sttVoiceCommandsEnabled,
    onVoiceSOS: (reason, opts) => triggerSOS(reason, opts || { silent: reason === 'coercion_wrong_word' }),
    onSubmitCheckIn: (phrase) => {
      const liveVec = speakerVerifier.isEnrolled ? speakerVerifier.stopCapture() : null;
      const verResult = speakerVerifier.verifySpokenAudio(liveVec);
      submitCheckIn(phrase, {
        speakerMismatch: speakerVerifier.isEnrolled && !verResult.verified,
        similarityScore: verResult.score
      });
    },
    onTriggerCheckIn: () => triggerSafetyCheckIn(),
    onStartJourney: (lbl) => startJourney(lbl),
    onEndJourney: () => endJourney(),
    onStatusRequest: () => {
      const text = `Current risk score is ${riskAssessment.score} out of 100, which is ${riskAssessment.tier} risk. ${riskAssessment.contributingFactors.length} factors contributing.`;
      speechEngineRef.current?.speakText(text);
    }
  });
  useEffect(() => {
    speechEngineRef.current = speechEngine;
  }, [speechEngine]);

  // Settings & Storage Updaters
  const setMode = useCallback((newMode) => {
    storage.setMode(newMode);
    setModeState(newMode);
  }, []);

  const setTrustedCircle = useCallback((newCircle) => {
    storage.setTrustedCircle(newCircle);
    setTrustedCircleState(newCircle);
  }, []);

  const setFamiliarPlaces = useCallback((newPlaces) => {
    storage.setFamiliarPlaces(newPlaces);
    setFamiliarPlacesState(newPlaces);
  }, []);

  const updatePrivacySettings = useCallback((partial) => {
    const updated = { ...privacySettings, ...partial };
    storage.setPrivacySettings(updated);
    setPrivacySettingsState(updated);
  }, [privacySettings]);

  const setWebhookUrl = useCallback((url) => {
    storage.setWebhookUrl(url);
    setWebhookUrlState(url);
  }, []);

  const updateSafePhrases = useCallback(({ safeWord: sw, duressWord: dw, voiceSosPhrase: vp }) => {
    if (sw) {
      storage.setSafeWord(sw);
      setSafeWordState(sw);
    }
    if (dw !== undefined) {
      storage.setDuressWord(dw);
      setDuressWordState(dw);
    }
    if (vp) {
      storage.setVoiceSosPhrase(vp);
      setVoiceSosPhraseState(vp);
    }
  }, []);

  const completeOnboarding = useCallback((word, newMode, circleContacts, places = [], duress = '', voicePhrase = '') => {
    const trimmed = word.trim();
    if (!trimmed) return false;
    storage.setSafeWord(trimmed);
    setSafeWordState(trimmed);

    if (duress) {
      storage.setDuressWord(duress.trim());
      setDuressWordState(duress.trim());
    }

    if (voicePhrase) {
      storage.setVoiceSosPhrase(voicePhrase.trim());
      setVoiceSosPhraseState(voicePhrase.trim());
    }
    
    storage.setMode(newMode);
    setModeState(newMode);

    if (newMode === 'Connected') {
      const validContacts = circleContacts.filter(c => c.name.trim() || c.phone.trim());
      storage.setTrustedCircle(validContacts);
      setTrustedCircleState(validContacts);
    } else {
      storage.setTrustedCircle([]);
      setTrustedCircleState([]);
    }

    const validPlaces = places.filter(p => p.name && typeof p.latitude === 'number');
    storage.setFamiliarPlaces(validPlaces);
    setFamiliarPlacesState(validPlaces);

    setIsOnboarded(true);
    setShowSettingsModal(false);
    return true;
  }, []);

  const purgeAllData = useCallback(() => {
    storage.resetOnboarding();
    sirenSynth.stopSiren();
    setSafeWordState('');
    setDuressWordState('');
    setVoiceSosPhraseState('ASTRAEA HELP ME');
    setIsOnboarded(false);
    setModeState('Solo');
    setTrustedCircleState([]);
    setFamiliarPlacesState([]);
    setTimelineEvents([]);
    setDeliveryRecords([]);
    setIsSOSActive(false);
    setJourney({ isActive: false, label: '', startedAt: null });
  }, []);

  // Test notification trigger for delivery tracker
  const triggerTestAlert = useCallback(() => {
    const payload = buildEmergencyPayload({
      reason: 'manual',
      coordinates: geoSignals.coordinates,
      address: geoSignals.currentAddress || 'Test Location',
      riskScore: 35,
      tier: 'ELEVATED'
    });

    dispatchEmergencyToCircle({
      contacts: trustedCircle.length > 0 ? trustedCircle : [{ id: 'test-1', name: 'Maya (Test)', phone: '+91 98765 43210' }],
      payload,
      webhookUrl,
      telegramConfig,
      whatsappConfig,
      onContactStatusUpdate: (record) => {
        setDeliveryRecords(prev => {
          const index = prev.findIndex(r => r.contactId === record.contactId);
          if (index >= 0) {
            const next = [...prev];
            next[index] = record;
            return next;
          }
          return [...prev, record];
        });
      }
    });

    dispatchCircleNotification('⚡ Non-Emergency Test Dispatch sent through delivery pipeline', 'info');
  }, [geoSignals, trustedCircle, webhookUrl, telegramConfig, whatsappConfig, dispatchCircleNotification]);

  // Recalculate risk whenever effective signals update
  useEffect(() => {
    if (isSOSActive) return;

    const now = Date.now();
    const lastTime = lastUpdatedRef.current || now;
    const secondsElapsed = Math.max(0, (now - lastTime) / 1000);
    lastUpdatedRef.current = now;

    const currentPrev = prevScoreRef.current;
    const result = calculateRiskScore(effectiveSignals, currentPrev, secondsElapsed);

    if (result.tier === 'CRITICAL' && currentPrev < 60) {
      setIsCriticalFlash(true);
      setTimeout(() => setIsCriticalFlash(false), 1200);
    }

    // Check-in trigger condition: crosses into ELEVATED or above, OR journey anomaly detected
    const isCooldownActive = Date.now() < checkInCooldownUntilRef.current;
    const shouldCheckIn = (
      !isCooldownActive &&
      !isSOSActive &&
      (result.tier === 'ELEVATED' || result.tier === 'HIGH' || result.tier === 'CRITICAL' || geoSignals.journeyAnomaly) &&
      checkInState === 'idle'
    );

    if (shouldCheckIn) {
      setCheckInState('prompting');
      setCurrentAttempt(1);
      setCountdown(CHECKIN_RESPONSE_WINDOW_SECONDS);

      // Discreet voice prompt via Web Speech Synthesis
      if (privacySettings.ttsVoiceEnabled) {
        speechEngine.speakText('Astraea safety check-in: Are you safe? Speak or type your safe phrase.');
      }

      // Haptics & chime
      if (privacySettings.hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      sirenSynth.playAlertChime();

      addTimelineEvent({
        category: 'CHECKIN',
        title: '🛡️ Safety Check-In Initiated',
        description: `Threat level reached [${result.tier}]. Waiting for safe confirmation word.`,
        details: { score: result.score, tier: result.tier }
      });
    }

    // Circle Notification Trigger Matrix
    if (mode === 'Connected' && journey.isActive && prevTierRef.current !== result.tier) {
      const names = getCircleNames();
      const tierType = (result.tier === 'HIGH' || result.tier === 'CRITICAL') ? 'warning' : 'info';
      dispatchCircleNotification(`⚠️ LIVE JOURNEY UPDATE: Notifying ${names} — Threat level shifted to [${result.tier}]`, tierType);
      
      addTimelineEvent({
        category: 'THREAT',
        title: `⚠️ Threat Level Shifted to [${result.tier}]`,
        description: `Score moved to ${result.score}/100 during active journey. Circle notified.`,
        details: { score: result.score, factors: result.contributingFactors }
      });
    } else if (mode === 'Connected' && !journey.isActive && result.tier === 'CRITICAL' && prevTierRef.current !== 'CRITICAL') {
      const names = getCircleNames();
      dispatchCircleNotification(`🚨 CRITICAL THREAT: Notifying ${names} — Risk engine crossed Critical threshold`, 'alert');
      
      addTimelineEvent({
        category: 'THREAT',
        title: '🚨 Critical Threat Crossed',
        description: `Risk score hit ${result.score}/100. Emergency dispatch armed.`,
        details: { score: result.score }
      });
    }

    prevTierRef.current = result.tier;
    setPreviousScore(currentPrev);
    prevScoreRef.current = result.score;
    setRiskAssessment(result);
  }, [
    effectiveSignals,
    isSOSActive,
    checkInState,
    mode,
    journey.isActive,
    geoSignals.journeyAnomaly,
    privacySettings,
    speechEngine,
    getCircleNames,
    dispatchCircleNotification,
    addTimelineEvent
  ]);

  // Check-In Countdown & Retry Timer
  useEffect(() => {
    if (isSOSActive || checkInState === 'idle' || checkInState === 'resolved') {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prevCountdown) => {
        if (prevCountdown > 1) {
          return prevCountdown - 1;
        }

        if (checkInState === 'prompting') {
          if (currentAttempt < CHECKIN_MAX_ATTEMPTS) {
            setCheckInState('waiting_retry');
            return CHECKIN_RETRY_INTERVAL_SECONDS;
          } else {
            triggerSOS('silence_timeout');
            return 0;
          }
        } else if (checkInState === 'waiting_retry') {
          setCurrentAttempt((prev) => prev + 1);
          setCheckInState('prompting');
          if (privacySettings.ttsVoiceEnabled) {
            speechEngine.speakText('Astraea safety check-in: Final verification window.');
          }
          return CHECKIN_RESPONSE_WINDOW_SECONDS;
        }

        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [checkInState, currentAttempt, isSOSActive, triggerSOS, privacySettings.ttsVoiceEnabled, speechEngine]);

  // Update a single manual signal
  const updateSignal = useCallback((key, value) => {
    setManualOverrideMode(true);
    setManualSignals(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateSignals = useCallback((partial) => {
    setManualOverrideMode(true);
    setManualSignals(prev => ({ ...prev, ...partial }));
  }, []);

  const resetToSafeBaseline = useCallback(() => {
    if (isSOSActive) return;
    setManualOverrideMode(false);
    checkInCooldownUntilRef.current = Date.now() + 120000;
    lastUpdatedRef.current = Date.now();
    prevScoreRef.current = 0;
    prevTierRef.current = 'LOW';
    setPreviousScore(0);
    setManualSignals({
      ...DEFAULT_SIGNALS,
      distressAudio: false,
      deviceImpact: false,
      networkOffline: false
    });
    setCheckInState('idle');
    setCheckInFeedback(null);
  }, [isSOSActive]);

  const value = {
    // 1. Security & Onboarding
    safeWord,
    duressWord,
    voiceSosPhrase,
    updateSafePhrases,
    isOnboarded,
    mode,
    setMode,
    trustedCircle,
    setTrustedCircle,
    familiarPlaces,
    setFamiliarPlaces,
    privacySettings,
    updatePrivacySettings,
    webhookUrl,
    setWebhookUrl,
    completeOnboarding,
    purgeAllData,
    showSettingsModal,
    setShowSettingsModal,
    getCircleNames,

    // 2. Real Hardware Sensors & Meta
    geoSignals,
    batterySignal,
    timeSignal,
    deviceMotionSignal,
    audioDistressSignal,
    networkSignal,
    speechEngine,
    speakerVerifier,
    signalSourcesMeta,

    // 2b. External Cloud API Integrations
    telegramConfig,
    setTelegramConfig,
    whatsappConfig,
    setWhatsAppConfig,
    geminiApiKey,
    setGeminiApiKey,
    askGeminiAdvisor: (query) => fetchGeminiSafetyAnalysis({
      apiKey: geminiApiKey,
      signals: effectiveSignals,
      riskAssessment,
      userQuery: query
    }),

    // 3. Live Journey & Map
    journey,
    startJourney,
    endJourney,

    // 4. Notifications & Delivery Pipeline
    circleNotifications,
    dispatchCircleNotification,
    deliveryRecords,
    triggerTestAlert,
    emergencyPayload,

    // 5. Timeline & Audit
    timelineEvents,
    addTimelineEvent,
    clearTimeline,

    // 6. AI Reasoning
    aiExplanation,
    explainAssessment: () => explainRiskAssessment(effectiveSignals, riskAssessment),
    interpretCommand: (query) => interpretSafetyCommand(query, {
      score: riskAssessment.score,
      tier: riskAssessment.tier,
      activeFactorsCount: riskAssessment.contributingFactors.length,
      recommendations: aiExplanation.recommendations
    }),

    // 7. Telemetry & Scoring
    signals: effectiveSignals,
    manualSignals,
    isDevMode,
    manualOverrideMode,
    updateSignal,
    updateSignals,
    resetToSafeBaseline,
    riskAssessment,
    previousScore,
    isCriticalFlash,

    // 8. Emergency SOS & Siren
    isSOSActive,
    isCovertAlertActive,
    sosReason,
    sosTriggeredAt,
    triggerSOS,
    standDownSOS,
    sirenController: {
      startSiren: () => sirenSynth.startSiren({ volume: 0.5 }),
      stopSiren: () => sirenSynth.stopSiren(),
      playChime: () => sirenSynth.playAlertChime()
    },

    // 9. Check-In Retry Pipeline
    checkInState,
    currentAttempt,
    countdown,
    checkInFeedback,
    submitCheckIn,
    triggerSafetyCheckIn,
    CHECKIN_MAX_ATTEMPTS,
    CHECKIN_RESPONSE_WINDOW_SECONDS,
    CHECKIN_RETRY_INTERVAL_SECONDS
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
