/**
 * Astraea - Web Audio Emergency Siren Synthesizer
 * 
 * Generates an authentic dual-tone emergency alarm using Web Audio API oscillators.
 * Zero external audio assets required. Runs completely client-side.
 */

let audioCtx = null;
let oscillator = null;
let lfo = null;
let gainNode = null;
let isPlaying = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export const sirenSynth = {
  isPlaying: () => isPlaying,

  startSiren: ({ volume = 0.4 } = {}) => {
    if (isPlaying) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Master Gain
      gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.exponentialRampToValueAtTime(Math.min(1.0, volume), now + 0.3);
      gainNode.connect(ctx.destination);

      // Carrier Oscillator (Tone)
      oscillator = ctx.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(800, now);

      // Low-Frequency Oscillator (LFO) for sweeping wail effect (700 Hz - 1300 Hz)
      lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.8, now); // 0.8 Hz sweep rate

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(450, now); // Sweep amplitude

      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);

      oscillator.connect(gainNode);

      oscillator.start(now);
      lfo.start(now);
      isPlaying = true;
    } catch (err) {
      console.warn('Siren start error:', err);
    }
  },

  stopSiren: () => {
    if (!isPlaying || !gainNode || !audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      setTimeout(() => {
        try {
          if (oscillator) oscillator.stop();
          if (lfo) lfo.stop();
          if (oscillator) oscillator.disconnect();
          if (lfo) lfo.disconnect();
          if (gainNode) gainNode.disconnect();
        } catch {}
        oscillator = null;
        lfo = null;
        gainNode = null;
        isPlaying = false;
      }, 350);
    } catch {
      isPlaying = false;
    }
  },

  playAlertChime: (freq = 880, duration = 0.18) => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + duration);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {}
  }
};
