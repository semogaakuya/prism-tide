// PRISM TIDE — the simulation. One fixed step at a time: the player drifts, orbs
// and shards drift in, hunters chase, and every touch is resolved here. The renderer
// only paints this state; it never changes a rule.
//
// The loop: collect orbs of your attuned prism colour to fill the wave quota.
// A matching orb scores and grows the combo; a wrong-colour orb breaks the combo.
// Dark shards and hunters cost a life on touch (a shield absorbs one). Dashing
// through a shard or a hunter shatters it. Clear wave 10 to win; lose all 3 lives
// and the tide takes you.

import {
  FIELD, PLAYER, LIVES, WIN_WAVE, PRISMS, ORB, SHARD, HUNTER, POWERUP, quotaForWave,
} from './config.js';
import { pick, range } from './random.js';

export const EVENT_COLLECT = 1;
export const EVENT_MISMATCH = 2;
export const EVENT_HIT = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_WAVE = 32;
export const EVENT_BANISH = 64;
export const EVENT_POWERUP = 128;

const POWERUP_KINDS = ['shield', 'slow', 'surge'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    player: { x: FIELD.width / 2, y: FIELD.height / 2, attune: 0, dashTime: 0, dashCooldown: 0, dashX: 0, dashY: 1, invuln: 0, shield: false },
    score: 0,
    best: 0,
    lives: LIVES,
    combo: 0,
    bestCombo: 0,
    wave: 1,
    collected: 0,
    quota: quotaForWave(1),
    elapsed: 0,
    slowTimer: 0,
    surgeTimer: 0,
    orbs: [],
    shards: [],
    hunters: [],
    powerups: [],
    particles: [],
    orbTimer: 0,
    shardTimer: 1.5,
    hunterTimer: 6,
    powerTimer: 9,
    over: false,
    won: false,
  };

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const v = range(random, speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        life: range(random, 0.35, 0.7), maxLife: 0.7, color, size: range(random, 2, 5),
      });
    }
    if (state.particles.length > 220) state.particles.splice(0, state.particles.length - 220);
  }

  function spawnOrb() {
    const margin = 60;
    state.orbs.push({
      x: range(random, margin, FIELD.width - margin),
      y: range(random, margin, FIELD.height - margin),
      vx: range(random, -14, 14),
      vy: range(random, -14, 14),
      prism: Math.floor(random() * PRISMS.length),
      age: 0,
      life: ORB.lifetime,
      phase: random() * Math.PI * 2,
    });
  }

  function spawnShard() {
    const edge = Math.floor(random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = range(random, 0, FIELD.width); y = -20; }
    else if (edge === 1) { x = range(random, 0, FIELD.width); y = FIELD.height + 20; }
    else if (edge === 2) { x = -20; y = range(random, 0, FIELD.height); }
    else { x = FIELD.width + 20; y = range(random, 0, FIELD.height); }
    const tx = range(random, FIELD.width * 0.2, FIELD.width * 0.8);
    const ty = range(random, FIELD.height * 0.2, FIELD.height * 0.8);
    const angle = Math.atan2(ty - y, tx - x);
    const speed = SHARD.speed + SHARD.speedPerWave * (state.wave - 1);
    state.shards.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }

  function spawnHunter() {
    const edge = Math.floor(random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = range(random, 0, FIELD.width); y = -26; }
    else if (edge === 1) { x = range(random, 0, FIELD.width); y = FIELD.height + 26; }
    else if (edge === 2) { x = -26; y = range(random, 0, FIELD.height); }
    else { x = FIELD.width + 26; y = range(random, 0, FIELD.height); }
    state.hunters.push({ x, y });
  }

  function spawnPowerup() {
    state.powerups.push({
      x: range(random, 80, FIELD.width - 80),
      y: range(random, 80, FIELD.height - 80),
      kind: pick(random, POWERUP_KINDS),
      age: 0,
    });
  }

  function hurt(events) {
    const player = state.player;
    if (player.shield) {
      player.shield = false;
      player.invuln = PLAYER.invulnerable;
      burst(player.x, player.y, '#bfe3ff', 18, 200);
      return events | EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 0;
    player.invuln = PLAYER.invulnerable;
    burst(player.x, player.y, '#ff5d73', 24, 260);
    if (state.lives <= 0) {
      state.over = true;
      return events | EVENT_HIT | EVENT_OVER;
    }
    return events | EVENT_HIT;
  }

  function clearWave() {
    const bonus = 100 * state.wave;
    state.score += bonus;
    burst(state.player.x, state.player.y, '#ffffff', 30, 300);
    state.shards.length = 0;
    state.hunters.length = 0;
    if (state.wave >= WIN_WAVE) {
      state.won = true;
      state.over = true;
      return EVENT_WAVE | EVENT_WIN;
    }
    state.wave += 1;
    state.collected = 0;
    state.quota = quotaForWave(state.wave);
    state.shardTimer = 1.2;
    state.hunterTimer = 5;
    return EVENT_WAVE;
  }

  function reset() {
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height / 2;
    state.player.attune = 0;
    state.player.dashTime = 0;
    state.player.dashCooldown = 0;
    state.player.invuln = 0;
    state.player.shield = false;
    state.score = 0;
    state.lives = LIVES;
    state.combo = 0;
    state.bestCombo = 0;
    state.wave = 1;
    state.collected = 0;
    state.quota = quotaForWave(1);
    state.elapsed = 0;
    state.slowTimer = 0;
    state.surgeTimer = 0;
    state.orbs.length = 0;
    state.shards.length = 0;
    state.hunters.length = 0;
    state.powerups.length = 0;
    state.particles.length = 0;
    state.orbTimer = 0;
    state.shardTimer = 1.5;
    state.hunterTimer = 6;
    state.powerTimer = 9;
    state.over = false;
    state.won = false;
    for (let i = 0; i < 5; i += 1) spawnOrb();
  }

  /**
   * Advance the world one fixed step.
   * `move` is a normalised {x, y} vector, `dash` a one-shot dash request,
   * `attuneDelta` -1/0/+1 cycles the prism, `attuneSet` sets it directly.
   * In `title` mode the tide just drifts for the backdrop — no scoring, no hazards.
   */
  function step(dt, move, dash, attuneDelta, attuneSet, title) {
    let events = 0;
    const player = state.player;
    const slow = state.slowTimer > 0 ? 0.5 : 1;

    if (attuneSet >= 0) player.attune = attuneSet % PRISMS.length;
    else if (attuneDelta !== 0) player.attune = (player.attune + attuneDelta + PRISMS.length) % PRISMS.length;

    if (title) {
      state.orbTimer -= dt;
      if (state.orbTimer <= 0 && state.orbs.length < 7) {
        spawnOrb();
        state.orbTimer = 0.8;
      }
      for (const orb of state.orbs) {
        orb.age += dt;
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        if (orb.x < 30 || orb.x > FIELD.width - 30) orb.vx *= -1;
        if (orb.y < 30 || orb.y > FIELD.height - 30) orb.vy *= -1;
      }
      return 0;
    }

    state.elapsed += dt;
    if (state.slowTimer > 0) state.slowTimer -= dt;
    if (state.surgeTimer > 0) state.surgeTimer -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;

    // Dash: a short burst in the current move direction (or the last one).
    if (dash && player.dashCooldown <= 0 && player.dashTime <= 0) {
      const dx = move.x !== 0 || move.y !== 0 ? move.x : player.dashX;
      const dy = move.x !== 0 || move.y !== 0 ? move.y : player.dashY;
      player.dashX = dx;
      player.dashY = dy;
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
    }
    let speed = PLAYER.speed;
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      speed = PLAYER.dashSpeed;
      player.x += player.dashX * speed * dt;
      player.y += player.dashY * speed * dt;
    } else {
      player.x += move.x * speed * dt;
      player.y += move.y * speed * dt;
    }
    player.x = clamp(player.x, PLAYER.radius, FIELD.width - PLAYER.radius);
    player.y = clamp(player.y, PLAYER.radius, FIELD.height - PLAYER.radius);

    // Spawning, faster as the waves rise.
    state.orbTimer -= dt;
    if (state.orbTimer <= 0) {
      spawnOrb();
      state.orbTimer = Math.max(ORB.minInterval, ORB.spawnInterval * Math.pow(ORB.spawnIntervalScale, state.wave - 1));
    }
    state.shardTimer -= dt * slow;
    if (state.shardTimer <= 0) {
      spawnShard();
      state.shardTimer = Math.max(SHARD.minInterval, SHARD.spawnInterval * Math.pow(SHARD.spawnIntervalScale, state.wave - 1));
    }
    if (state.wave >= HUNTER.firstWave) {
      state.hunterTimer -= dt * slow;
      if (state.hunterTimer <= 0 && state.hunters.length < state.wave - 1) {
        spawnHunter();
        state.hunterTimer = HUNTER.spawnInterval;
      }
    }
    state.powerTimer -= dt;
    if (state.powerTimer <= 0) {
      spawnPowerup();
      state.powerTimer = POWERUP.spawnInterval;
    }

    const dashing = player.dashTime > 0;

    // Orbs drift, age out, and are collected on touch.
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const orb = state.orbs[i];
      orb.age += dt;
      orb.life -= dt;
      orb.x += orb.vx * dt * slow;
      orb.y += orb.vy * dt * slow;
      if (orb.x < 20 || orb.x > FIELD.width - 20) orb.vx *= -1;
      if (orb.y < 20 || orb.y > FIELD.height - 20) orb.vy *= -1;
      if (orb.life <= 0) {
        state.orbs.splice(i, 1);
        continue;
      }
      const reach = ORB.radius + PLAYER.radius;
      if (dist2(orb, player) < reach * reach) {
        const matching = state.surgeTimer > 0 || orb.prism === player.attune;
        const color = PRISMS[orb.prism].color;
        burst(orb.x, orb.y, color, matching ? 14 : 6, 170);
        state.orbs.splice(i, 1);
        if (matching) {
          state.combo += 1;
          state.bestCombo = Math.max(state.bestCombo, state.combo);
          state.score += ORB.points + 2 * Math.min(state.combo, 20);
          state.collected += 1;
          events |= EVENT_COLLECT;
          if (state.collected >= state.quota) events |= clearWave();
        } else {
          state.combo = 0;
          events |= EVENT_MISMATCH;
        }
      }
    }

    // Shards fly straight; a dash shatters them, a touch hurts.
    for (let i = state.shards.length - 1; i >= 0; i -= 1) {
      const shard = state.shards[i];
      shard.x += shard.vx * dt * slow;
      shard.y += shard.vy * dt * slow;
      if (shard.x < -60 || shard.x > FIELD.width + 60 || shard.y < -60 || shard.y > FIELD.height + 60) {
        state.shards.splice(i, 1);
        continue;
      }
      const reach = SHARD.radius + PLAYER.radius;
      if (dist2(shard, player) < reach * reach) {
        if (dashing) {
          burst(shard.x, shard.y, '#ff5d73', 12, 200);
          state.shards.splice(i, 1);
          state.score += 5;
          events |= EVENT_BANISH;
        } else if (player.invuln <= 0) {
          state.shards.splice(i, 1);
          events |= hurt(events);
          if (state.over) return events;
        }
      }
    }

    // Hunters chase the player; a dash banishes them for big points.
    const hunterSpeed = HUNTER.speed + HUNTER.speedPerWave * (state.wave - 1);
    for (let i = state.hunters.length - 1; i >= 0; i -= 1) {
      const hunter = state.hunters[i];
      const dx = player.x - hunter.x;
      const dy = player.y - hunter.y;
      const len = Math.hypot(dx, dy) || 1;
      hunter.x += (dx / len) * hunterSpeed * dt * slow;
      hunter.y += (dy / len) * hunterSpeed * dt * slow;
      const reach = HUNTER.radius + PLAYER.radius;
      if (dist2(hunter, player) < reach * reach) {
        if (dashing) {
          burst(hunter.x, hunter.y, '#c084fc', 20, 240);
          state.hunters.splice(i, 1);
          state.score += HUNTER.banishPoints;
          events |= EVENT_BANISH;
        } else if (player.invuln <= 0) {
          state.hunters.splice(i, 1);
          events |= hurt(events);
          if (state.over) return events;
        }
      }
    }

    // Power-ups: shield, slow tide, prism surge.
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const power = state.powerups[i];
      power.age += dt;
      if (power.age > 12) {
        state.powerups.splice(i, 1);
        continue;
      }
      const reach = POWERUP.radius + PLAYER.radius;
      if (dist2(power, player) < reach * reach) {
        if (power.kind === 'shield') player.shield = true;
        else if (power.kind === 'slow') state.slowTimer = POWERUP.slowSeconds;
        else state.surgeTimer = POWERUP.surgeSeconds;
        burst(power.x, power.y, '#bfe3ff', 16, 200);
        state.powerups.splice(i, 1);
        events |= EVENT_POWERUP;
      }
    }

    // Particles fade.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
