# Astraea

A voice-first personal safety web app (PWA) built for the **Bolna Buildathon 2026**. Astraea watches over you hands-free: it fuses passive on-device signals into a risk score, checks in with you by voice, and, if you don't respond correctly, silently alerts and phones your trusted contacts with your live location using **Bolna AI** voice agents.

> **Status:** Active development for Bolna Buildathon 2026. Built with React + Vite.

## Origin
Astraea builds on an earlier open prototype ("Aurora"/"SafeSignal") written by a teammate, who agreed to its reuse. Its risk-scoring engine, sensor hooks and map are kept; the rest is being reworked.

## Privacy by design
Safe phrase, duress phrase, voiceprint and raw audio stay **on the user's phone**. The server only holds short-lived session data (live location, call/acknowledgement state).

## Run locally
```bash
npm install
npm run dev
npm test
```

## Honest limitations (so far)
- Browser app: listening works only while the app screen is open (Chrome recommended).
- Browsers cannot silently place calls or work with no signal; true background/offline calling needs a native app (future work).
- Speaker verification (planned) is experimental and not a security guarantee.
- Emergency services (112/100) are never auto-dialed; tap-to-call only.

## Core Architecture
- **Passive Signals & Risk Engine:** Multi-sensor fusion (motion, low battery, geofencing, ambient noise) scored entirely on-device.
- **On-Device Voice & Privacy:** Voice check-in and duress detection stay 100% on the user's device.
- **Escalation & Emergency Calling:** Bolna AI voice agents reach trusted contacts when check-ins are missed or a duress phrase is spoken.
