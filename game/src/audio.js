// Sound, synthesized with WebAudio only — no audio files, no network.
// The context is created lazily on the first user gesture (browsers block audio
// before that), and every call is a no-op until then.

const PITCH = [523.25, 659.25, 783.99]; // C5, E5, G5 — one per prism colour

export function createAudio() {
  let context = null;
  let master = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.16;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, duration, type, volume, when = 0, slideTo = 0) {
    if (!context || !master) return;
    try {
      const start = context.currentTime + when;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** Call from any user gesture so later sounds are allowed. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    /** A matching orb, pitched by prism colour and lifted by the combo. */
    collect(prismIndex, combo) {
      if (!ensure()) return;
      const lift = Math.min(combo, 12) * 18;
      tone(PITCH[prismIndex % 3] + lift, 0.22, 'sine', 0.9);
      tone((PITCH[prismIndex % 3] + lift) * 2, 0.14, 'triangle', 0.35);
    },
    /** A wrong-colour orb: a dull thud, combo lost. */
    mismatch() {
      if (!ensure()) return;
      tone(180, 0.16, 'square', 0.35, 0, 110);
    },
    hit() {
      if (!ensure()) return;
      tone(220, 0.3, 'sawtooth', 0.7, 0, 55);
      tone(90, 0.25, 'square', 0.5, 0, 45);
    },
    dash() {
      if (!ensure()) return;
      tone(300, 0.14, 'sine', 0.5, 0, 720);
    },
    banish() {
      if (!ensure()) return;
      tone(660, 0.18, 'triangle', 0.7, 0, 1320);
      tone(880, 0.22, 'sine', 0.5, 0.06, 1760);
    },
    powerup() {
      if (!ensure()) return;
      tone(587, 0.12, 'triangle', 0.6);
      tone(880, 0.2, 'triangle', 0.6, 0.09);
    },
    waveClear(wave) {
      if (!ensure()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.55, i * 0.09));
      void wave;
    },
    win() {
      if (!ensure()) return;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => tone(freq, 0.35, 'triangle', 0.6, i * 0.12));
    },
    over() {
      if (!ensure()) return;
      [392, 329.63, 261.63, 196].forEach((freq, i) => tone(freq, 0.4, 'sine', 0.55, i * 0.16));
    },
  };
}
