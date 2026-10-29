import React, { useState } from 'react';
import { useApp } from '../state/useApp';
import './VoiceAssistantBar.css';

export default function VoiceAssistantBar() {
  const {
    speechEngine,
    privacySettings,
    voiceSosPhrase,
    triggerSOS,
    startJourney,
    endJourney,
    riskAssessment,
    explainAssessment
  } = useApp();

  const [assistantResponse, setAssistantResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!privacySettings.sttVoiceCommandsEnabled && !privacySettings.ttsVoiceEnabled) {
    return null;
  }

  const handleCommandClick = (cmdText) => {
    setIsProcessing(true);
    setAssistantResponse(`Executing: "${cmdText}"`);

    setTimeout(() => {
      speechEngine.simulateVoiceCommand(cmdText);
      setIsProcessing(false);
    }, 400);
  };

  return (
    <div className="voice-assistant-bar-shell" id="voice-assistant-bar">
      <div className="voice-bar-header">
        <div className="voice-title-group">
          <span className="voice-mic-icon">🎙️</span>
          <div>
            <span className="voice-bar-title">Natural Voice Guardian</span>
            <span className="voice-subtext">Hands-free commands & voice check-in</span>
          </div>
        </div>

        <div className="voice-controls-row">
          {speechEngine.sttSupported ? (
            <button
              type="button"
              className={`btn-voice-listen ${speechEngine.isListening ? 'listening' : ''}`}
              onClick={speechEngine.isListening ? speechEngine.stopListening : speechEngine.startListening}
              title={speechEngine.isListening ? 'Stop voice recognition' : 'Start hands-free voice recognition'}
            >
              <span className="voice-pulse-ring" />
              <span>{speechEngine.isListening ? 'Listening...' : 'Enable Voice'}</span>
            </button>
          ) : (
            <span className="voice-unsupported-tag">Voice Command Ready (Tap)</span>
          )}
        </div>
      </div>

      {/* Hotphrase Status Strip */}
      <div className="voice-hotphrase-strip">
        <span className="hotphrase-badge">EMERGENCY HOTPHRASE:</span>
        <span className="hotphrase-text">"{voiceSosPhrase || 'ASTRAEA HELP ME'}"</span>
        <span className="hotphrase-hint">(Spoken trigger arms SOS immediately)</span>
      </div>

      {/* Real-time transcript or last recognized command */}
      {speechEngine.transcript && (
        <div className="voice-live-transcript">
          <span className="transcript-label">Recognized Speech:</span>
          <span className="transcript-content">"{speechEngine.transcript}"</span>
        </div>
      )}

      {/* Spoken command shortcut chips */}
      <div className="voice-command-chips">
        <button
          type="button"
          className="cmd-chip"
          onClick={() => handleCommandClick('Start walk')}
        >
          🚶 "Start walk"
        </button>
        <button
          type="button"
          className="cmd-chip"
          onClick={() => handleCommandClick('What is my risk score?')}
        >
          🛡️ "Am I safe?"
        </button>
        <button
          type="button"
          className="cmd-chip"
          onClick={() => handleCommandClick('I arrived safely')}
        >
          🏠 "I arrived"
        </button>
        <button
          type="button"
          className="cmd-chip cmd-chip-emergency"
          onClick={() => handleCommandClick(voiceSosPhrase || 'Astraea help me')}
        >
          🚨 "{voiceSosPhrase || 'Astraea help me'}"
        </button>
      </div>
    </div>
  );
}
