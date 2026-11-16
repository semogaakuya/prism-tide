// PRISM TIDE — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 20,
  speed: 340,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnerable: 1.6,
};

export const LIVES = 3;

/** Win by clearing this wave. */
export const WIN_WAVE = 10;

/** The three prism colours. Attunement is an index into this array. */
export const PRISMS = [
  { name: 'Coral', key: 'coral', color: '#ff6b6b', glow: '#ff9a9a', dark: '#7a1f1f' },
  { name: 'Gold', key: 'gold', color: '#ffc94d', glow: '#ffe08a', dark: '#7a5a10' },
  { name: 'Teal', key: 'teal', color: '#4dd8c4', glow: '#8ef0e0', dark: '#0f5a50' },
];

export const ORB = {
  radius: 13,
  points: 10,
  /** Orbs drift in slowly and fade out if ignored. */
  lifetime: 9,
  spawnInterval: 1.05,
  spawnIntervalScale: 0.93,
  minInterval: 0.45,
};

export const SHARD = {
  radius: 15,
  speed: 105,
  speedPerWave: 13,
  spawnInterval: 2.8,
  spawnIntervalScale: 0.9,
  minInterval: 1.1,
};

export const HUNTER = {
  radius: 22,
  speed: 64,
  speedPerWave: 7,
  banishPoints: 50,
  /** Hunters first appear from this wave on. */
  firstWave: 2,
  spawnInterval: 7,
};

/** Orbs of the matching colour needed to clear each wave. */
export function quotaForWave(wave) {
  return 6 + wave * 2;
}

export const POWERUP = {
  radius: 16,
  shieldSeconds: 0, // shield lasts until it absorbs one hit
  slowSeconds: 5,
  surgeSeconds: 6,
  spawnInterval: 11,
};

export const PALETTE = {
  backdrop: '#070d1d',
  deep: '#0b1730',
  tide: '#12264a',
  panel: '#131f38',
  text: '#eef3ff',
  muted: '#93a3c4',
  danger: '#ff5d73',
  white: '#ffffff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'prism-tide.best';
