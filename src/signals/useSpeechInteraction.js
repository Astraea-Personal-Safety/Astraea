import { useState, useEffect, useRef, useCallback } from 'react';
import { classifyVoiceTrigger } from './voiceTriggers.js';

/**
 * Normalizes speech/input phrase for robust matching:
 * - Lowercase
 * - Strips punctuation and accents/special characters
 * - Collapses consecutive spaces
 */
export function normalizePhrase(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]|_/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein distance between two normalized strings.
 */
export function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Matches candidate phrase against a target safe/duress phrase.
 * Supports exact word matching and 1-edit fuzzy tolerance for speech recognition variations.
 */
export function matchPhrase(candidate, target) {
  const normCandidate = normalizePhrase(candidate);
  const normTarget = normalizePhrase(target);
  if (!normCandidate || !normTarget) return false;
  if (normCandidate === normTarget) return true;

  const candidateWords = normCandidate.split(' ');
  const targetWords = normTarget.split(' ');

  // If candidate is a sentence containing target as consecutive words
  if (candidateWords.length >= targetWords.length) {
    for (let i = 0; i <= candidateWords.length - targetWords.length; i++) {
      const windowStr = candidateWords.slice(i, i + targetWords.length).join(' ');
      if (windowStr === normTarget) return true;
      if (normTarget.length >= 5 && levenshteinDistance(windowStr, normTarget) <= 1) {
        return true;
      }
    }
  }

  // Small fuzzy tolerance on the whole phrase if lengths are very close
  if (Math.abs(normCandidate.length - normTarget.length) <= 2 && normTarget.length >= 5) {
    if (levenshteinDistance(normCandidate, normTarget) <= 1) return true;
  }

  return false;
}

/**
 * Astraea - Web Speech API Hook (TTS Voice Check-ins + STT Voice Commands & Emergency Trigger)
 */
export function useSpeechInteraction({
  safeWord = '',
  duressWord = '',
  voiceSosPhrase = 'ASTRAEA HELP ME',
  isCheckInActive = false,
  ttsEnabled = true,
  sttEnabled = true,
  onVoiceSOS = () => {},
  onSubmitCheckIn = () => {},
  onTriggerCheckIn = () => {},
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
    if (!sttEnabled) return;

    const clean = spokenText.trim().toUpperCase();
    setTranscript(clean);

    const sosTarget = (voiceSosPhrase || 'ASTRAEA HELP ME').trim().toUpperCase();

    // 1. Voice-Triggered SOS Hotphrase Check (always checks emergency triggers first)
    if (
      matchPhrase(clean, sosTarget) ||
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
      if (safeWord && matchPhrase(clean, safeWord)) {
        setRecognizedCommand({ type: 'SAFE_STANDDOWN', text: clean });
        onSubmitCheckIn(clean);
        return;
      }
      if (duressWord && matchPhrase(clean, duressWord)) {
        setRecognizedCommand({ type: 'DURESS_TRIGGER', text: clean });
        onSubmitCheckIn(clean);
        return;
      }

      // If speech is recognized during active check-in but does NOT match safe or duress word:
      // Escalate immediately (same as typed mismatch) to protect against coercion / silence
      if (clean.length >= 3) {
        setRecognizedCommand({ type: 'CHECKIN_MISMATCH', text: clean });
        onSubmitCheckIn(clean);
        return;
      }
    }

    // 3. Multi-Language Safety Trigger Classifier (English / Hindi / Hinglish)
    const classified = classifyVoiceTrigger(clean);
    if (classified.matched) {
      if (classified.type === 'URGENT') {
        setRecognizedCommand({ type: 'SOS_TRIGGER', text: clean, triggerInfo: classified });
        speakText('Emergency detected. Silently alerting circle.');
        onVoiceSOS('voice_trigger', { silent: true });
        return;
      } else if (classified.type === 'CHECKIN') {
        setRecognizedCommand({ type: 'CHECKIN_TRIGGER', text: clean, triggerInfo: classified });
        onTriggerCheckIn();
        return;
      }
    }

    // 4. Natural Language Safety Commands
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
    sttEnabled,
    safeWord,
    duressWord,
    voiceSosPhrase,
    isCheckInActive,
    speakText,
    onVoiceSOS,
    onSubmitCheckIn,
    onTriggerCheckIn,
    onStartJourney,
    onEndJourney,
    onStatusRequest
  ]);

  // Speech Recognition Controller
  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || !sttEnabled) return;

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
        // Prevent echo: ignore spoken results while speech synthesis TTS is speaking
        if (isSpeakingRef.current || (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking)) {
          return;
        }

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
        if (shouldListenRef.current && sttEnabled) {
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
  }, [sttEnabled, processSpokenPhrase]);

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
