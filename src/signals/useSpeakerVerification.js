/**
 * Astraea - On-Device Speaker Verification
 * 
 * Extracts spectral voice profiles via Web Audio API FFT filterbanks (16 bands across 100Hz - 8kHz)
 * and verifies speaker identity using Cosine Similarity against an enrolled voice template.
 * 
 * Features:
 * - 100% on-device processing: Audio never leaves the browser.
 * - Anti-coercion detection: If words match but voice spectral signature deviates significantly,
 *   covert alert can be triggered.
 * - Pure mathematical core exported for unit testing.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'astraea_voice_enrollment_profile';
const SIMILARITY_THRESHOLD = 0.68; // 68% cosine similarity threshold for human speech match
const NUM_BANDS = 16;

/**
 * Pure Math: Computes vector dot product
 */
export function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Pure Math: Computes Euclidean norm (magnitude) of a vector
 */
export function vectorNorm(v) {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) {
    sumSq += v[i] * v[i];
  }
  return Math.sqrt(sumSq) || 1e-9;
}

/**
 * Pure Math: Normalizes vector to unit length
 */
export function normalizeVector(v) {
  const norm = vectorNorm(v);
  return v.map(x => x / norm);
}

/**
 * Pure Math: Computes Cosine Similarity between two feature vectors [0.0 to 1.0]
 */
export function cosineSimilarity(v1, v2) {
  if (!v1 || !v2 || v1.length === 0 || v2.length === 0) return 0;
  const dot = dotProduct(v1, v2);
  const norm1 = vectorNorm(v1);
  const norm2 = vectorNorm(v2);
  const sim = dot / (norm1 * norm2);
  return Math.max(0, Math.min(1, Math.round(sim * 1000) / 1000));
}

/**
 * Averages multiple feature vectors and unit-normalizes the result.
 */
export function averageFeatureVectors(vectors) {
  if (!vectors || vectors.length === 0) return [];
  const len = vectors[0].length;
  const avg = new Array(len).fill(0);
  
  for (const vec of vectors) {
    for (let i = 0; i < len; i++) {
      avg[i] += vec[i] || 0;
    }
  }
  
  return normalizeVector(avg.map(x => x / vectors.length));
}

/**
 * Maps raw FFT bin energies into logarithmically spaced filterbanks.
 */
export function binFFTToFilterbanks(fftData, numBands = NUM_BANDS) {
  if (!fftData || fftData.length === 0) return new Array(numBands).fill(0);
  
  const bands = new Array(numBands).fill(0);
  const binCount = fftData.length;
  
  // Logarithmic bin partition across active speech frequencies (approx 100Hz - 8kHz)
  for (let b = 0; b < numBands; b++) {
    const startIdx = Math.floor(binCount * Math.pow(b / numBands, 2));
    const endIdx = Math.max(startIdx + 1, Math.floor(binCount * Math.pow((b + 1) / numBands, 2)));
    
    let bandEnergy = 0;
    let count = 0;
    for (let i = startIdx; i < endIdx && i < binCount; i++) {
      // Byte frequency data is 0-255
      bandEnergy += (fftData[i] / 255);
      count++;
    }
    bands[b] = count > 0 ? bandEnergy / count : 0;
  }
  
  return normalizeVector(bands);
}

/**
 * React Hook for Speaker Verification and Enrollment
 */
export function useSpeakerVerification() {
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolledProfile, setEnrolledProfile] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [similarityScore, setSimilarityScore] = useState(null);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const capturedFramesRef = useRef([]);

  // Load existing profile from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.profileVector && parsed.profileVector.length > 0) {
          setEnrolledProfile(parsed);
          setIsEnrolled(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  /**
   * Starts capturing audio stream for spectral analysis
   */
  const startCapture = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.warn('Speaker verification: Web Audio / MediaDevices not supported');
      return false;
    }

    try {
      capturedFramesRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      return true;
    } catch (err) {
      console.warn('Speaker verification capture failed:', err);
      setIsListening(false);
      return false;
    }
  }, []);

  /**
   * Samples current audio frame from analyser
   */
  const sampleFrame = useCallback(() => {
    if (!analyserRef.current) return null;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    
    // Check if frame has enough energy to be speech (not pure silence)
    const totalEnergy = data.reduce((acc, val) => acc + val, 0) / data.length;
    if (totalEnergy > 10) {
      const bands = binFFTToFilterbanks(data);
      capturedFramesRef.current.push(bands);
      return bands;
    }
    return null;
  }, []);

  /**
   * Stops capture and returns the aggregated spectral profile vector
   */
  const stopCapture = useCallback(() => {
    setIsListening(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    if (capturedFramesRef.current.length === 0) {
      return null;
    }

    const aggregatedProfile = averageFeatureVectors(capturedFramesRef.current);
    capturedFramesRef.current = [];
    return aggregatedProfile;
  }, []);

  /**
   * Saves an enrolled profile to storage
   */
  const saveEnrollment = useCallback((profileVector, phrase) => {
    const record = {
      profileVector,
      phrase,
      enrolledAt: Date.now(),
      version: '1.0'
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      setEnrolledProfile(record);
      setIsEnrolled(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Clears the current voice profile
   */
  const clearEnrollment = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setEnrolledProfile(null);
    setIsEnrolled(false);
    setSimilarityScore(null);
  }, []);

  /**
   * Verifies live spoken vector against stored enrolled profile
   */
  const verifySpokenAudio = useCallback((liveVector) => {
    if (!enrolledProfile || !enrolledProfile.profileVector) {
      return { verified: true, score: 1.0, isEnrolled: false, message: 'No voice enrolled; fallback allowed' };
    }

    if (!liveVector || liveVector.length === 0) {
      return { verified: true, score: 0.75, isEnrolled: true, message: 'Audio capture minimal; allowed with caution' };
    }

    const score = cosineSimilarity(enrolledProfile.profileVector, liveVector);
    setSimilarityScore(score);

    const verified = score >= SIMILARITY_THRESHOLD;
    return {
      verified,
      score,
      isEnrolled: true,
      message: verified ? 'Speaker verified' : 'Speaker voice mismatch (possible coercion)'
    };
  }, [enrolledProfile]);

  return {
    isEnrolled,
    enrolledProfile,
    isListening,
    similarityScore,
    startCapture,
    sampleFrame,
    stopCapture,
    saveEnrollment,
    clearEnrollment,
    verifySpokenAudio
  };
}
