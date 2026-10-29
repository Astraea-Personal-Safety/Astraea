import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Astraea - Web Speech API Hook (TTS Voice Check-ins + STT Voice Commands & Emergency Trigger)
 * 
 * Capabilities:
 * 1. Speech Synthesis (TTS): Discreet spoken check-in prompts ("Astraea check-in: Are you safe?").
 * 2. Voice-Triggered SOS: Hands-free detection of configured phrases ("Astraea help me", "Code Red").
 * 3. Natural-Language Safety Commands: "Start journey", "I'm safe", "Status report".
 * 4. Safe Phrase Verification: Stand down check-in by speaking your secret phrase.
 */
export function useSpeechInteraction({
  safeWord = '',
  duressWord = '',
  voiceSosPhrase = 'ASTRAEA HELP ME',
  isCheckInActive = false,
  ttsEnabled = true,
  onVoiceSOS = () => {},
  onSubmitCheckIn = () => {},
  onStartJourney = () => {},
  onEndJourney = () => {},
  onStatusRequest = () => {}
} = {}) {
  const [ttsSupported, setTtsSupported] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastSpokenText, setLastSpokenText] = useState('');
  const [recognizedCommand, setRecognizedCommand] = useState(null);
  const [speechError, setSpeechError] = useState(null);

  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);
  const isSpeakingRef = useRef(false);

  // Check Web Speech API support
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('speechSynthesis' in window) {
      setTtsSupported(true);
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      setSttSupported(true);
    }
  }, []);

  // Text-to-Speech (TTS) Engine
  const speakText = useCallback((text, { priority = 'normal', onEnd = null } = {}) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !ttsEnabled) {
      return;
    }

    try {
      if (priority === 'urgent') {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Select natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setLastSpokenText(text);
      };

      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (onEnd) onEnd();
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
    }
  }, [ttsEnabled]);

  // Command & Phrase Interpreter
  const processSpokenPhrase = useCallback((spokenText) => {
    const clean = spokenText.trim().toUpperCase();
    setTranscript(clean);

    const safeTarget = (safeWord || '').trim().toUpperCase();
    const duressTarget = (duressWord || '').trim().toUpperCase();
    const sosTarget = (voiceSosPhrase || 'ASTRAEA HELP ME').trim().toUpperCase();

    // 1. Voice-Triggered SOS Hotphrase Check
    if (
      clean.includes(sosTarget) ||
      clean.includes('ASTRAEA HELP') ||
      clean.includes('CODE RED') ||
      clean.includes('EMERGENCY SOS')
    ) {
      setRecognizedCommand({ type: 'SOS_TRIGGER', text: clean });
      speakText('Emergency SOS initiated. Alerting circle.');
      onVoiceSOS('voice_trigger');
      return;
    }

    // 2. Active Check-In Stand-Down / Duress Verification
    if (isCheckInActive) {
      if (safeTarget && clean.includes(safeTarget)) {
        setRecognizedCommand({ type: 'SAFE_STANDDOWN', text: clean });
        speakText('Safe word verified. Alert stood down.');
        onSubmitCheckIn(safeWord);
        return;
      }
      if (duressTarget && clean.includes(duressTarget)) {
        setRecognizedCommand({ type: 'DURESS_TRIGGER', text: clean });
        // Anti-coercion: silently escalate to SOS
        onVoiceSOS('coercion_wrong_word');
        return;
      }
    }

    // 3. Natural Language Safety Commands
    if (clean.includes('START JOURNEY') || clean.includes('START WALK') || clean.includes('WALKING HOME')) {
      setRecognizedCommand({ type: 'START_JOURNEY', text: clean });
      speakText('Starting live journey monitoring with your circle.');
      onStartJourney('Voice: Heading Home');
      return;
    }

    if (clean.includes('END JOURNEY') || clean.includes('ARRIVED SAFELY') || clean.includes('STOP WALK') || clean.includes('I AM HOME')) {
      setRecognizedCommand({ type: 'END_JOURNEY', text: clean });
      speakText('Journey completed. You have arrived safely.');
      onEndJourney();
      return;
    }

    if (clean.includes('STATUS') || clean.includes('RISK SCORE') || clean.includes('AM I SAFE')) {
      setRecognizedCommand({ type: 'STATUS_REPORT', text: clean });
      onStatusRequest();
      return;
    }

    if (clean.includes('HELP') || clean.includes('EMERGENCY')) {
      setRecognizedCommand({ type: 'SOS_TRIGGER', text: clean });
      speakText('Emergency detected. Triggering SOS.');
      onVoiceSOS('voice_trigger');
      return;
    }

    setRecognizedCommand({ type: 'UNRECOGNIZED', text: clean });
  }, [
    safeWord,
    duressWord,
    voiceSosPhrase,
    isCheckInActive,
    speakText,
    onVoiceSOS,
    onSubmitCheckIn,
    onStartJourney,
    onEndJourney,
    onStatusRequest
  ]);

  // Speech Recognition Controller
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechError('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        shouldListenRef.current = true;
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          }
        }

        if (finalTranscript) {
          processSpokenPhrase(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech') {
          setSpeechError(`Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (shouldListenRef.current) {
          // Restart for continuous background hotphrase listening
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setSpeechError(err.message);
      setIsListening(false);
    }
  }, [processSpokenPhrase]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore cleanup error
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    ttsSupported,
    sttSupported,
    isListening,
    transcript,
    lastSpokenText,
    recognizedCommand,
    speechError,
    speakText,
    startListening,
    stopListening,
    simulateVoiceCommand: (phrase) => processSpokenPhrase(phrase)
  };
}
