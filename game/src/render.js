// PRISM TIDE — the renderer. It paints the world state onto the canvas and nothing
// else: no rules live here. The playfield is 1280x720 logical pixels, scaled to fit
// the window, so the game looks the same on any desktop screen.

import { FIELD, PRISMS, PALETTE, FONT, WIN_WAVE, ORB, SHARD, HUNTER, POWERUP } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

const POWERUP_LABEL = { shield: 'SHIELD', slow: 'SLOW TIDE', surge: 'PRISM SURGE' };
const POWERUP_COLOR = { shield: '#bfe3ff', slow: '#8ef0e0', surge: '#ffd166' };

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 18, 36, 0.88)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(147, 163, 196, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawOrb(ctx, x, y, radius, color, glow, pulse) {
  const r = radius * (1 + 0.08 * Math.sin(pulse));
  const gradient = ctx.createRadialGradient(x, y, 1, x, y, r * 2.2);
  gradient.addColorStop(0, glow);
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawShard(ctx, x, y, radius, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * 1.4);
  ctx.fillStyle = '#2a0e1a';
  ctx.strokeStyle = '#ff5d73';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.8, 0);
  ctx.lineTo(0, radius);
  ctx.lineTo(-radius * 0.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff5d73';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHunter(ctx, x, y, radius, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 2) * 0.15);
  ctx.fillStyle = '#1c1030';
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e9d5ff';
  ctx.beginPath();
  ctx.arc(-radius * 0.35, -radius * 0.15, 3.5, 0, Math.PI * 2);
  ctx.arc(radius * 0.35, -radius * 0.15, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, player, time) {
  const blink = player.invuln > 0 && Math.floor(time * 12) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.dashTime > 0) ctx.globalAlpha = 0.85;
  else if (blink) ctx.globalAlpha = 0.35;
  const prism = PRISMS[player.attune];
  const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
  gradient.addColorStop(0, prism.glow);
  gradient.addColorStop(0.5, prism.color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();
  // The prism: a rotating triangle with a bright core.
  ctx.rotate(time * 0.6);
  ctx.fillStyle = prism.color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(17, 13);
  ctx.lineTo(-17, 13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (player.shield) {
    ctx.save();
    ctx.strokeStyle = 'rgba(191, 227, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 30 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (player.dashCooldown > 0 && player.dashTime <= 0) {
    const frac = 1 - player.dashCooldown / 1.6;
    ctx.save();
    ctx.strokeStyle = 'rgba(238, 243, 255, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 26, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let time = 0;

  function fit() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = Math.round(FIELD.width * scale);
    canvas.height = Math.round(FIELD.height * scale);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
  }
  fit();
  window.addEventListener('resize', fit);

  function drawBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.backdrop);
    gradient.addColorStop(0.55, PALETTE.deep);
    gradient.addColorStop(1, PALETTE.tide);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Tide lines.
    ctx.strokeStyle = 'rgba(77, 216, 196, 0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      const y = 110 + i * 130;
      for (let x = 0; x <= FIELD.width; x += 32) {
        const yy = y + Math.sin(x / 160 + time * 0.7 + i * 1.3) * 14;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // Faint stars / motes.
    ctx.fillStyle = 'rgba(238, 243, 255, 0.16)';
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 173) % FIELD.width;
      const y = (i * 97) % FIELD.height;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawHud(state, screen) {
    const prism = PRISMS[state.player.attune];
    ctx.fillStyle = 'rgba(10, 18, 36, 0.72)';
    roundRect(ctx, 16, 12, FIELD.width - 32, 54, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 24px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SCORE ${state.score}`, 32, 40);
    ctx.font = '600 17px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(state.best, state.score)}`, 220, 40);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 20px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${state.wave} / ${WIN_WAVE}`, FIELD.width / 2, 32);
    ctx.font = '600 15px ' + FONT;
    ctx.fillStyle = prism.color;
    ctx.fillText(`ORBS ${state.collected} / ${state.quota}`, FIELD.width / 2, 54);
    // Lives as hearts.
    ctx.textAlign = 'right';
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < state.lives ? '#ff5d73' : 'rgba(147, 163, 196, 0.3)';
      const x = FIELD.width - 40 - i * 30;
      ctx.beginPath();
      ctx.arc(x - 5, 36, 6, 0, Math.PI * 2);
      ctx.arc(x + 5, 36, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 11, 38);
      ctx.lineTo(x, 50);
      ctx.lineTo(x + 11, 38);
      ctx.fill();
    }
    // Attunement + combo, bottom left.
    ctx.textAlign = 'left';
    ctx.font = '700 16px ' + FONT;
    ctx.fillStyle = prism.color;
    ctx.fillText(`● ${prism.name.toUpperCase()}  (Q / E or 1-2-3 to switch)`, 32, FIELD.height - 44);
    if (state.combo >= 2) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '700 20px ' + FONT;
      ctx.fillText(`COMBO x${state.combo}`, 32, FIELD.height - 70);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 15px ' + FONT;
    ctx.fillText(`TIME ${formatTime(state.elapsed)}`, FIELD.width - 32, FIELD.height - 44);
    if (state.slowTimer > 0) {
      ctx.fillStyle = POWERUP_COLOR.slow;
      ctx.fillText(`SLOW TIDE ${Math.ceil(state.slowTimer)}s`, FIELD.width - 32, FIELD.height - 70);
    } else if (state.surgeTimer > 0) {
      ctx.fillStyle = POWERUP_COLOR.surge;
      ctx.fillText(`PRISM SURGE ${Math.ceil(state.surgeTimer)}s — every orb matches!`, FIELD.width - 32, FIELD.height - 70);
    } else if (state.player.shield) {
      ctx.fillStyle = POWERUP_COLOR.shield;
      ctx.fillText('SHIELD READY', FIELD.width - 32, FIELD.height - 70);
    }
    if (screen === SCREEN_PLAY && state.wave === 1 && state.elapsed < 6) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(238, 243, 255, 0.9)';
      ctx.font = '600 17px ' + FONT;
      ctx.fillText('Move: WASD / arrows / hold mouse  •  Dash: Space  •  Switch colour: Q / E', FIELD.width / 2, 92);
    }
  }

  function drawTitle(state, best) {
    drawPanel(ctx, 330, 150, 620, 400);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8ef0e0';
    ctx.font = '700 54px ' + FONT;
    ctx.fillText('PRISM TIDE', FIELD.width / 2, 225);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 20px ' + FONT;
    ctx.fillText('Ride the tide. Match the prism. Survive 10 waves.', FIELD.width / 2, 265);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '400 17px ' + FONT;
    ctx.fillText('Collect orbs of your attuned colour to fill each wave.', FIELD.width / 2, 305);
    ctx.fillText('Wrong colours break your combo. Shards and hunters cost a life.', FIELD.width / 2, 330);
    ctx.fillText('Dash (Space) through a hunter or shard to shatter it.', FIELD.width / 2, 355);
    // The three prisms.
    PRISMS.forEach((prism, i) => {
      const x = FIELD.width / 2 + (i - 1) * 110;
      drawOrb(ctx, x, 400, 16, prism.color, prism.glow, time * 2 + i);
      ctx.fillStyle = prism.color;
      ctx.font = '700 15px ' + FONT;
      ctx.fillText(prism.name.toUpperCase(), x, 432);
    });
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 22px ' + FONT;
    const pulse = 0.75 + 0.25 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillText('PRESS ENTER OR CLICK TO START', FIELD.width / 2, 490);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 15px ' + FONT;
    ctx.fillText('WASD / arrows or hold mouse to move', FIELD.width / 2, 508);
    ctx.fillText('Q / E switch colour  •  Space dash  •  P pause', FIELD.width / 2, 530);
    if (best > 0) {
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`BEST SCORE ${best}`, FIELD.width / 2, 545);
    }
    void state;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(7, 13, 29, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawPanel(ctx, 440, 260, 400, 180);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 36px ' + FONT;
    ctx.fillText('PAUSED', FIELD.width / 2, 320);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '400 17px ' + FONT;
    ctx.fillText('Press P or Enter to keep playing', FIELD.width / 2, 360);
    ctx.fillText('Press R to restart the run', FIELD.width / 2, 390);
  }

  function drawEnd(state, best, won) {
    ctx.fillStyle = 'rgba(7, 13, 29, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawPanel(ctx, 380, 170, 520, 360);
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? '#ffd166' : '#ff5d73';
    ctx.font = '700 46px ' + FONT;
    ctx.fillText(won ? 'YOU RODE THE TIDE!' : 'THE TIDE TOOK YOU', FIELD.width / 2, 235);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 20px ' + FONT;
    ctx.fillText(won ? `All ${WIN_WAVE} waves cleared — a true Prism Master.` : `You reached wave ${state.wave} of ${WIN_WAVE}.`, FIELD.width / 2, 280);
    ctx.font = '700 30px ' + FONT;
    ctx.fillText(`SCORE ${state.score}`, FIELD.width / 2, 335);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 17px ' + FONT;
    ctx.fillText(`BEST ${Math.max(best, state.score)}    •    BEST COMBO x${state.bestCombo}    •    TIME ${formatTime(state.elapsed)}`, FIELD.width / 2, 375);
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 20px ' + FONT;
    const pulse = 0.75 + 0.25 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillText('PRESS ENTER OR CLICK TO PLAY AGAIN', FIELD.width / 2, 440);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '400 15px ' + FONT;
    ctx.fillText('Tip: switch attunement (Q / E) toward the biggest orb cluster,', FIELD.width / 2, 480);
    ctx.fillText('and save your dash for hunters closing in.', FIELD.width / 2, 502);
  }

  function draw(state, screen, best) {
    time += 1 / 60;
    ctx.save();
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    ctx.scale(scale, scale);
    drawBackdrop();
    // Power-ups.
    for (const power of state.powerups) {
      const bob = Math.sin(time * 3 + power.x) * 3;
      ctx.fillStyle = POWERUP_COLOR[power.kind];
      ctx.beginPath();
      ctx.arc(power.x, power.y + bob, POWERUP.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1730';
      ctx.font = '700 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(power.kind === 'shield' ? 'S' : power.kind === 'slow' ? 'T' : 'P', power.x, power.y + bob);
      ctx.font = '700 12px ' + FONT;
      ctx.fillStyle = POWERUP_COLOR[power.kind];
      ctx.fillText(POWERUP_LABEL[power.kind], power.x, power.y + bob - POWERUP.radius - 10);
    }
    // Orbs, with a ring on the ones matching the current attunement.
    for (const orb of state.orbs) {
      const prism = PRISMS[orb.prism];
      const matching = state.surgeTimer > 0 || orb.prism === state.player.attune;
      const fade = orb.life < 2 ? 0.35 + 0.3 * Math.sin(time * 8) : 1;
      ctx.globalAlpha = fade;
      drawOrb(ctx, orb.x, orb.y, ORB.radius, prism.color, prism.glow, orb.phase + time * 2);
      if (matching) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, ORB.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    for (const shard of state.shards) drawShard(ctx, shard.x, shard.y, SHARD.radius, time);
    for (const hunter of state.hunters) drawHunter(ctx, hunter.x, hunter.y, HUNTER.radius, time);
    // Particles.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (screen !== SCREEN_TITLE) drawPlayer(ctx, state.player, time);
    if (screen === SCREEN_TITLE) {
      // A lone prism drifting on the title screen.
      drawPlayer(ctx, { ...state.player, invuln: 0, dashTime: 0, dashCooldown: 0, shield: false }, time);
    }
    if (screen !== SCREEN_TITLE) drawHud(state, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawEnd(state, best, false);
    else if (screen === SCREEN_WIN) drawEnd(state, best, true);
    ctx.restore();
  }

  return { draw };
}
