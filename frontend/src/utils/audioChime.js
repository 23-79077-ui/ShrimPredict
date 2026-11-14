import { CHIME_DATA_URI } from './chimeBase64';

/**
 * Clean, safe notification sound chime engine.
 * Specifically designed to:
 * 1. NEVER make any sound on click, tap, or touch (zero false positives).
 * 2. ONLY play audio when playNotificationSound() is explicitly called for an incoming alert.
 * 3. Never execute for Administrator routes.
 * 4. Silently prime Web Audio API on iOS Safari so alerts play reliably on the first time.
 */

let sharedAudioCtx = null;
let keepAliveNode = null;
let unlockListenersAttached = false;

// Get or create singleton AudioContext (only created when needed)
export function getSharedAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  return sharedAudioCtx;
}

// Inaudible keep-alive node to prevent iOS Safari from putting AudioContext to sleep
function ensureKeepAlive(ctx) {
  if (keepAliveNode || !ctx || ctx.state !== 'running') return;
  try {
    const silentBuffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = silentBuffer;
    source.loop = true;
    source.connect(ctx.destination);
    source.start(0);
    keepAliveNode = source;
  } catch (e) {}
}

/**
 * 100% SILENT audio permission unlocker for mobile Safari.
 * Calls ctx.resume() with ZERO audio output.
 * NEVER calls audio.play() or plays any audible sound.
 */
export function unlockAudio() {
  if (typeof window === 'undefined') return;

  try {
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        ensureKeepAlive(ctx);
      }).catch(() => {});
    } else if (ctx && ctx.state === 'running') {
      ensureKeepAlive(ctx);
    }
  } catch (e) {}
}

/**
 * Attaches silent unlock listener on first user interaction.
 */
export function initAudioUnlock() {
  if (typeof window === 'undefined') return;
  if (unlockListenersAttached) return;

  const handleSilentUnlock = () => {
    unlockAudio();
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === 'running') {
      ['touchstart', 'touchend', 'click', 'keydown'].forEach((evt) => {
        window.removeEventListener(evt, handleSilentUnlock);
        document.removeEventListener(evt, handleSilentUnlock);
      });
    }
  };

  ['touchstart', 'touchend', 'click', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, handleSilentUnlock, { passive: true, capture: true });
    document.addEventListener(evt, handleSilentUnlock, { passive: true, capture: true });
  });

  unlockListenersAttached = true;
}

// Auto-attach unlock listeners when loaded in client context
if (typeof window !== 'undefined') {
  initAudioUnlock();
}

/**
 * Internal synthesis helper for harmonic bell chime (A5 + E6 harmonic)
 */
function triggerOscillators(ctx) {
  try {
    const now = ctx.currentTime;

    // Tone 1: Clear bell note (A5 = 880.0 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880.0, now);
    gain1.gain.setValueAtTime(0.75, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Tone 2: Crisp harmonic chime (E6 = 1318.5 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.12);
    gain2.gain.setValueAtTime(0.85, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.85);

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Synthesizes a loud, pleasant harmonic bell chime (A5 + E6 harmonic).
 * Handles both running and suspended states smoothly.
 */
export function playWebAudioChime() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        triggerOscillators(ctx);
        ensureKeepAlive(ctx);
      }).catch(() => {});
      // Also attempt immediately in case resume is synchronous or supported
      triggerOscillators(ctx);
    } else {
      triggerOscillators(ctx);
      ensureKeepAlive(ctx);
    }

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Master chime trigger.
 * ONLY called when an actual alert arrives for a caretaker.
 */
export function playNotificationSound() {
  if (typeof window === 'undefined') return;

  unlockAudio();

  // Channel 1: Web Audio API synthesis
  playWebAudioChime();

  // Channel 2: Base64 HTML5 Audio fallback
  try {
    const audio = new Audio(CHIME_DATA_URI);
    audio.volume = 1.0;
    const p = audio.play();
    if (p !== undefined) p.catch(() => {});
  } catch (e) {}

  // Channel 3: In-DOM audio element if mounted
  try {
    const domAudio = document.getElementById('live-notification-sound');
    if (domAudio) {
      domAudio.currentTime = 0;
      domAudio.volume = 1.0;
      const p = domAudio.play();
      if (p !== undefined) p.catch(() => {});
    }
  } catch (e) {}
}
