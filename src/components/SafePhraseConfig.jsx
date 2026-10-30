import React, { useState } from 'react';
import { useApp } from '../state/useApp';
import { SpeakerEnrollmentModal } from './SpeakerEnrollmentModal.jsx';
import './SafePhraseConfig.css';

export default function SafePhraseConfig({ onInterceptSave = null }) {
  const {
    safeWord,
    duressWord,
    voiceSosPhrase,
    updateSafePhrases,
    speechEngine
  } = useApp();

  const [inputSafe, setInputSafe] = useState(safeWord || '');
  const [inputDuress, setInputDuress] = useState(duressWord || '');
  const [inputVoiceSos, setInputVoiceSos] = useState(voiceSosPhrase || 'ASTRAEA HELP ME');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSpeechText, setTestSpeechText] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [showVoiceEnrollment, setShowVoiceEnrollment] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    if (!inputSafe.trim()) return;

    if (onInterceptSave) {
      onInterceptSave(
        inputSafe.trim().toUpperCase(),
        inputDuress.trim().toUpperCase(),
        inputVoiceSos.trim().toUpperCase()
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      return;
    }

    updateSafePhrases({
      safeWord: inputSafe.trim().toUpperCase(),
      duressWord: inputDuress.trim().toUpperCase(),
      voiceSosPhrase: inputVoiceSos.trim().toUpperCase()
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestPronunciation = () => {
    if (!testSpeechText.trim()) return;
    const cleanTest = testSpeechText.trim().toUpperCase();

    if (cleanTest === inputSafe.trim().toUpperCase()) {
      setTestResult({ match: true, type: 'SAFE_WORD', message: '✓ Verified: Exactly matches secret Safe Word (Stand-Down Protocol)' });
    } else if (inputDuress && cleanTest === inputDuress.trim().toUpperCase()) {
      setTestResult({ match: false, type: 'DURESS_WORD', message: '⚠️ Verified: Matches Duress Phrase (Will silently trigger Emergency SOS)' });
    } else if (cleanTest.includes(inputVoiceSos.trim().toUpperCase())) {
      setTestResult({ match: true, type: 'VOICE_SOS', message: '🚨 Verified: Matches Voice Emergency Hotphrase' });
    } else {
      setTestResult({ match: false, type: 'COERCION_MISMATCH', message: '❌ Mismatch: Under live check-in, this phrase would trigger Emergency SOS (Anti-Coercion)' });
    }
  };

  return (
    <div className="safe-phrase-config-card" id="safe-phrase-config">
      <div className="config-header">
        <span className="config-icon">🔐</span>
        <div>
          <h3>Safe Phrase & Anti-Coercion Configuration</h3>
          <p>Configure secret verification words, duress signals, and hands-free voice triggers</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="safe-phrases-form">
        {/* 1. Primary Safe Word */}
        <div className="phrase-input-group">
          <div className="phrase-label-row">
            <label htmlFor="cfg-safe-word">1. Secret Safe Confirmation Word / Phrase</label>
            <span className="phrase-tag tag-safe">DISARMS ALERTS</span>
          </div>
          <p className="phrase-explainer">
            Only this exact word/phrase stands down an active check-in or emergency alarm. Never reveal this to anyone.
          </p>
          <input
            id="cfg-safe-word"
            type="text"
            value={inputSafe}
            onChange={(e) => setInputSafe(e.target.value)}
            placeholder="e.g. ASTRAEA, BLUE SKY, STARLIGHT"
            className="phrase-input"
            required
          />
        </div>

        {/* 2. Duress Phrase */}
        <div className="phrase-input-group">
          <div className="phrase-label-row">
            <label htmlFor="cfg-duress-word">2. Duress Alarm Phrase (Anti-Coercion Covert Signal)</label>
            <span className="phrase-tag tag-duress">SILENT SOS TRIGGER</span>
          </div>
          <p className="phrase-explainer">
            A phrase that sounds reassuring to an attacker (e.g. "I AM FINE", "EVERYTHING IS OK"), but secretly arms Emergency SOS immediately.
          </p>
          <input
            id="cfg-duress-word"
            type="text"
            value={inputDuress}
            onChange={(e) => setInputDuress(e.target.value)}
            placeholder="e.g. EVERYTHING IS FINE, I AM SAFE"
            className="phrase-input"
          />
        </div>

        {/* 3. Voice-Triggered Emergency Hotphrase */}
        <div className="phrase-input-group">
          <div className="phrase-label-row">
            <label htmlFor="cfg-voice-sos">3. Voice-Triggered Emergency SOS Hotphrase</label>
            <span className="phrase-tag tag-voice">HANDS-FREE SOS</span>
          </div>
          <p className="phrase-explainer">
            Spoken phrase that automatically initiates SOS without needing to touch your phone.
          </p>
          <input
            id="cfg-voice-sos"
            type="text"
            value={inputVoiceSos}
            onChange={(e) => setInputVoiceSos(e.target.value)}
            placeholder="e.g. ASTRAEA HELP ME, CODE RED"
            className="phrase-input"
            required
          />
        </div>

        <div className="form-save-row">
          {saveSuccess && <span className="save-success-msg">✓ Security phrases saved successfully</span>}
          <button type="submit" className="btn-save-phrases">
            Save Security Phrases
          </button>
        </div>
      </form>

      {/* On-Device Biometric Voice Verification Card */}
      <div className="voice-biometric-enroll-card" style={{
        marginTop: '1.25rem',
        padding: '1rem',
        background: 'rgba(56, 189, 248, 0.05)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <div>
          <h5 style={{ margin: 0, color: '#38bdf8', fontSize: '0.9rem', fontWeight: 600 }}>🎙️ Biometric Voice Verification</h5>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
            Train on-device acoustic model so Astraea recognizes your authentic voice during safe phrase de-escalation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowVoiceEnrollment(true)}
          style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid #38bdf8',
            color: '#38bdf8',
            borderRadius: '8px',
            padding: '0.5rem 0.9rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Train Voice Profile
        </button>
      </div>

      <SpeakerEnrollmentModal
        safePhrase={inputSafe || 'ASTRAEA'}
        isOpen={showVoiceEnrollment}
        onClose={() => setShowVoiceEnrollment(false)}
      />

      {/* Interactive Speech & Verification Tester */}
      <div className="phrase-tester-box">
        <h5>🧪 Pronunciation & Verification Simulator</h5>
        <p className="tester-hint">Type or speak a phrase below to test how the anti-coercion pipeline evaluates it:</p>

        <div className="tester-input-row">
          <input
            type="text"
            value={testSpeechText}
            onChange={(e) => setTestSpeechText(e.target.value)}
            placeholder="Type phrase to test (e.g. Blue Sky, I am fine)..."
            className="tester-input"
          />
          <button
            type="button"
            className="btn-run-test"
            onClick={handleTestPronunciation}
          >
            Evaluate Phrase
          </button>
        </div>

        {testResult && (
          <div className={`test-result-box result-${testResult.type.toLowerCase()}`}>
            <span>{testResult.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
