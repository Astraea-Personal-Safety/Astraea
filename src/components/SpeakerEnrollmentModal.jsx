import React, { useState, useEffect, useRef } from 'react';
import { useSpeakerVerification, averageFeatureVectors } from '../signals/useSpeakerVerification.js';
import './SpeakerEnrollmentModal.css';

const ENROLLMENT_STEPS = [
  { step: 1, label: 'Normal Voice', hint: 'Speak clearly at your normal conversational volume.' },
  { step: 2, label: 'Hurried / Brisk Voice', hint: 'Speak slightly faster, as if walking briskly.' },
  { step: 3, label: 'Firm / Low Voice', hint: 'Speak firmly and quietly, as if in a quiet or tense setting.' }
];

export function SpeakerEnrollmentModal({ safePhrase = 'ASTRAEA', isOpen, onClose, onEnrollmentComplete }) {
  const {
    isEnrolled,
    enrolledProfile,
    isListening,
    startCapture,
    sampleFrame,
    stopCapture,
    saveEnrollment,
    clearEnrollment
  } = useSpeakerVerification();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [recordedVectors, setRecordedVectors] = useState([]);
  const [recordingStatus, setRecordingStatus] = useState('idle'); // 'idle' | 'recording' | 'processing' | 'done'
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const sampleIntervalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (sampleIntervalRef.current) {
        clearInterval(sampleIntervalRef.current);
        sampleIntervalRef.current = null;
      }
      stopCapture();
      setCurrentStepIndex(0);
      setRecordedVectors([]);
      setRecordingStatus('idle');
      setAudioLevel(0);
      setErrorMessage('');
    }
    return () => {
      if (sampleIntervalRef.current) {
        clearInterval(sampleIntervalRef.current);
        sampleIntervalRef.current = null;
      }
      stopCapture();
    };
  }, [isOpen, stopCapture]);

  const handleStartRecording = async () => {
    setErrorMessage('');
    const started = await startCapture();
    if (!started) {
      setErrorMessage('Microphone access denied or audio unavailable.');
      return;
    }

    setRecordingStatus('recording');
    
    // Poll audio frames every 80ms
    sampleIntervalRef.current = setInterval(() => {
      const frame = sampleFrame();
      if (frame) {
        // Compute pseudo energy for visual meter
        const level = frame.reduce((acc, v) => acc + v, 0) / frame.length;
        setAudioLevel(Math.min(100, Math.round(level * 200)));
      }
    }, 80);
  };

  const handleStopRecording = () => {
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    setAudioLevel(0);

    const vector = stopCapture();
    if (!vector || vector.length === 0) {
      setRecordingStatus('idle');
      setErrorMessage('No voice detected. Please hold the button while speaking clearly.');
      return;
    }

    const updated = [...recordedVectors, vector];
    setRecordedVectors(updated);

    if (currentStepIndex + 1 < ENROLLMENT_STEPS.length) {
      setCurrentStepIndex(currentStepIndex + 1);
      setRecordingStatus('idle');
    } else {
      // Completed all 3 steps! Average the 3 vectors and save
      setRecordingStatus('processing');
      const finalVector = averageFeatureVectors(updated);
      saveEnrollment(finalVector, safePhrase);
      setRecordingStatus('done');
      if (onEnrollmentComplete) {
        onEnrollmentComplete();
      }
    }
  };

  const handleReset = () => {
    clearEnrollment();
    setCurrentStepIndex(0);
    setRecordedVectors([]);
    setRecordingStatus('idle');
  };

  if (!isOpen) return null;

  return (
    <div className="speaker-modal-overlay" onClick={onClose}>
      <div className="speaker-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="speaker-modal-header">
          <div className="speaker-modal-title-row">
            <span className="speaker-modal-badge">Biometric Voice Profile</span>
            <button className="speaker-modal-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <h3>On-Device Speaker Verification</h3>
          <p className="speaker-modal-subtitle">
            Trains your personal acoustic profile so Astraea can verify that your safe phrase was actually spoken by you.
          </p>
        </div>

        {isEnrolled && recordingStatus !== 'done' && recordedVectors.length === 0 ? (
          <div className="speaker-enrolled-view">
            <div className="enrolled-status-card">
              <span className="enrolled-check-icon">✓</span>
              <div>
                <strong>Voice Profile Active</strong>
                <p>Enrolled on {enrolledProfile?.enrolledAt ? new Date(enrolledProfile.enrolledAt).toLocaleDateString() : 'Recently'}</p>
              </div>
            </div>

            <p className="enrolled-explainer">
              Your voice acoustic signature is stored privately in on-device browser storage. Audio is never transmitted to external servers.
            </p>

            <div className="speaker-modal-actions">
              <button className="btn-secondary" onClick={handleReset}>
                Re-Train Voice
              </button>
              <button className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : recordingStatus === 'done' ? (
          <div className="speaker-success-view">
            <div className="success-pulse-circle">✓</div>
            <h4>Voice Enrollment Complete</h4>
            <p>Your unique acoustic signature has been encrypted and stored on-device.</p>
            <button className="btn-primary" onClick={onClose} style={{ marginTop: '1.25rem', width: '100%' }}>
              Save & Finish
            </button>
          </div>
        ) : (
          <div className="speaker-training-flow">
            {/* Steps Progress Indicator */}
            <div className="enroll-steps-indicator">
              {ENROLLMENT_STEPS.map((s, idx) => (
                <div 
                  key={s.step} 
                  className={`enroll-step-node ${idx === currentStepIndex ? 'active' : ''} ${idx < currentStepIndex ? 'completed' : ''}`}
                >
                  <div className="step-circle">{idx < currentStepIndex ? '✓' : s.step}</div>
                  <span className="step-name">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Current Step Instruction */}
            <div className="step-instruction-box">
              <span className="step-counter">Sample {currentStepIndex + 1} of 3</span>
              <h4>{ENROLLMENT_STEPS[currentStepIndex].hint}</h4>
              <div className="phrase-prompt-card">
                <span className="phrase-prompt-label">Say:</span>
                <span className="phrase-prompt-text">"{safePhrase}"</span>
              </div>
            </div>

            {/* Live Audio Visualizer Meter */}
            <div className="audio-meter-container">
              <div 
                className="audio-meter-fill" 
                style={{ width: `${Math.min(100, audioLevel)}%` }}
              />
            </div>

            {errorMessage && (
              <div className="speaker-error-banner">{errorMessage}</div>
            )}

            {/* Push-to-record Button */}
            <div className="recording-controls">
              {recordingStatus === 'recording' ? (
                <button 
                  className="btn-record-active"
                  onClick={handleStopRecording}
                >
                  <span className="record-pulsing-dot" /> Release when finished
                </button>
              ) : (
                <button 
                  className="btn-record-start"
                  onClick={handleStartRecording}
                >
                  🎙️ Tap to Record "{safePhrase}"
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
