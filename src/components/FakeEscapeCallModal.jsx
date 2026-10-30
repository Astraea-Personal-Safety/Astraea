import React, { useState, useEffect, useRef } from 'react';
import { ringtoneSynth } from '../engine/ringtoneSynth.js';
import './FakeEscapeCallModal.css';

export function FakeEscapeCallModal({ isOpen, onClose, callerName = 'Mom' }) {
  const [callState, setCallState] = useState('incoming'); // 'incoming' | 'connected'
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCallState('incoming');
      setCallDuration(0);
      ringtoneSynth.play();
    } else {
      ringtoneSynth.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      ringtoneSynth.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const handleAccept = () => {
    ringtoneSynth.stop();
    setCallState('connected');
    
    // Start duration timer
    timerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);

    // Speak believable escape conversation using SpeechSynthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        "Hey! Where are you right now? I'm waiting for you downstairs, could you hurry up and come outside? Dinner is ready."
      );
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleDecline = () => {
    ringtoneSynth.stop();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onClose();
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fake-call-overlay">
      <div className="fake-call-screen">
        {/* Top Caller Info */}
        <div className="caller-info">
          <div className="caller-avatar">
            <span>👤</span>
          </div>
          <h2 className="caller-name">{callerName}</h2>
          <span className="caller-subtitle">
            {callState === 'incoming' ? 'Incoming Call...' : formatTimer(callDuration)}
          </span>
        </div>

        {/* Center Aesthetic Audio Wave when Connected */}
        {callState === 'connected' && (
          <div className="call-connected-visual">
            <div className="voice-waves">
              <span /><span /><span /><span /><span />
            </div>
            <p className="call-script-hint">
              "Hey! Where are you right now? I'm waiting for you downstairs..."
            </p>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="fake-call-actions">
          {callState === 'incoming' ? (
            <div className="incoming-actions-row">
              <button className="btn-call-decline" onClick={handleDecline} aria-label="Decline">
                <span className="call-btn-icon">📵</span>
                <span className="call-btn-label">Decline</span>
              </button>

              <button className="btn-call-accept" onClick={handleAccept} aria-label="Accept">
                <span className="call-btn-icon">📞</span>
                <span className="call-btn-label">Accept</span>
              </button>
            </div>
          ) : (
            <div className="connected-actions-row">
              <button className="btn-call-hangup" onClick={handleDecline} aria-label="End Call">
                <span className="call-btn-icon">📵</span>
                <span className="call-btn-label">End Call</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
