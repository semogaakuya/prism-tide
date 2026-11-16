// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
// The play pilot steers toward the nearest matching orb and away from hazards;
// the end pilot wanders, so it is caught out once the tide speeds up.

import { FIELD, STEP, PRISMS } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 600;

function autopilot(state, smart) {
  const player = state.player;
  if (smart === 'suicide') {
    // Steer straight at the nearest shard or hunter: a careless player who
    // chases danger instead of orbs, so the end scene arrives quickly.
    let target = null;
    let nearestDist = Infinity;
    for (const hazard of [...state.shards, ...state.hunters]) {
      const d = (hazard.x - player.x) ** 2 + (hazard.y - player.y) ** 2;
      if (d < nearestDist) {
        nearestDist = d;
        target = hazard;
      }
    }
    if (!target) return { x: 0.6, y: 0.35 };
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }
  if (!smart) {
    // Wander: a fixed slow drift that never chases orbs.
    return { x: 0.6, y: 0.35 };
  }
  // Choose the attunement of the nearest orb cluster.
  let nearest = null;
  let nearestDist = Infinity;
  for (const orb of state.orbs) {
    const d = (orb.x - player.x) ** 2 + (orb.y - player.y) ** 2;
    if (d < nearestDist) {
      nearestDist = d;
      nearest = orb;
    }
  }
  const attune = nearest ? nearest.prism : player.attune;
  // Score the 8 compass directions plus staying still: chase matching orbs,
  // flee shards and hunters, stay inside the field.
  const dirs = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 0.707, y: 0.707 }, { x: -0.707, y: 0.707 }, { x: 0.707, y: -0.707 }, { x: -0.707, y: -0.707 },
  ];
  let bestDir = dirs[0];
  let bestScore = -Infinity;
  for (const dir of dirs) {
    const nx = player.x + dir.x * 60;
    const ny = player.y + dir.y * 60;
    if (nx < 40 || nx > FIELD.width - 40 || ny < 40 || ny > FIELD.height - 40) continue;
    let score = 0;
    for (const orb of state.orbs) {
      const d = Math.hypot(orb.x - nx, orb.y - ny);
      const match = state.surgeTimer > 0 || orb.prism === attune;
      score += match ? Math.max(0, 300 - d) : Math.max(0, 80 - d) * 0.2;
    }
    for (const shard of state.shards) {
      const d = Math.hypot(shard.x - nx, shard.y - ny);
      score -= Math.max(0, 220 - d) * 2;
    }
    for (const hunter of state.hunters) {
      const d = Math.hypot(hunter.x - nx, hunter.y - ny);
      score -= Math.max(0, 260 - d) * 2.5;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return { dir: bestDir, attune };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, 0, -1, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const smart = name === 'play';
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let index = 0; index < limit / STEP; index += 1) {
    // The end scene first plays well for a while (a real score, a later wave),
    // then steers into danger until the tide catches it.
    const mode = smart ? true : (world.state.wave >= 2 || index < 14 / STEP ? true : 'suicide');
    const move = autopilot(world.state, mode);
    const dir = move.dir ?? move;
    const attune = move.attune !== undefined ? move.attune : -1;
    const events = world.step(STEP, dir, false, 0, attune, false);
    if (events & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}

export { PRISMS };
