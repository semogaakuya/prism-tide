// PRISM TIDE — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between five screens:
// title, play, paused, game over and win.
//
// ?seed=N fixes the tide's pattern. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import {
  createWorld, EVENT_COLLECT, EVENT_MISMATCH, EVENT_HIT, EVENT_OVER, EVENT_WIN,
  EVENT_WAVE, EVENT_BANISH, EVENT_POWERUP,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_PAUSE, ACTION_DASH, ACTION_ATTUNE_NEXT, ACTION_ATTUNE_PREV,
  createInput,
} from './input.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear screen changes and hits.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Collect matching orbs to clear wave 1.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`You won! Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.over();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const attuneTo = input.takeAttuneTo();
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    // R restarts from pause or from an end screen.
    if (screen === SCREEN_PAUSED && actions & ACTION_CONFIRM) {
      // Enter/click resumes; R is handled by the keydown listener below.
    }
    return { actions, attuneTo };
  }

  // R restarts a paused or finished run without going through the confirm path.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyR' && (screen === SCREEN_PAUSED || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    }
  });

  function playEvents(events) {
    if (events & EVENT_COLLECT) audio.collect(world.state.player.attune, world.state.combo);
    if (events & EVENT_MISMATCH) audio.mismatch();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_BANISH) audio.banish();
    if (events & EVENT_POWERUP) audio.powerup();
    if (events & EVENT_WAVE) audio.waveClear(world.state.wave);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_HIT) {
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
  }

  function step(pending) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, 0, -1, true);
      return;
    }
    const move = input.vector(world.state.player.x, world.state.player.y);
    const dash = Boolean(pending.actions & ACTION_DASH);
    const attuneDelta = (pending.actions & ACTION_ATTUNE_NEXT ? 1 : 0) - (pending.actions & ACTION_ATTUNE_PREV ? 1 : 0);
    const events = world.step(STEP, move, dash, attuneDelta, pending.attuneTo, false);
    if (dash && world.state.player.dashTime > 0) audio.dash();
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const pending = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(pending);
        accumulator -= STEP;
        pending.actions = 0;
        pending.attuneTo = -1;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the tide rise unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Prism Tide. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
