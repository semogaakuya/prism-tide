// Keyboard and pointer input for free 2D movement.
// Held keys give a steering vector; one-shot presses (start/restart, pause, dash,
// attunement switch) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The pointer also steers:
// holding the mouse button moves the prism toward the pointer.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_ATTUNE_NEXT = 8;
export const ACTION_ATTUNE_PREV = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
const ATTUNE_NEXT = new Set(['KeyE', 'Digit3']);
const ATTUNE_PREV = new Set(['KeyQ', 'Digit1']);
const ATTUNE_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2 };

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  let attuneTo = -1;
  let pointer = null;
  let pointerHeld = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (ATTUNE_NEXT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ATTUNE_NEXT;
    } else if (ATTUNE_PREV.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ATTUNE_PREV;
    } else if (event.code in ATTUNE_KEYS) {
      if (!event.repeat) attuneTo = ATTUNE_KEYS[event.code];
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    pointerHeld = false;
  });

  function updatePointer(event) {
    const rect = target.getBoundingClientRect();
    pointer = {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }
  target.addEventListener('pointermove', updatePointer);
  target.addEventListener('pointerdown', (event) => {
    updatePointer(event);
    pointerHeld = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', () => {
    pointerHeld = false;
  });

  return {
    /** Normalised steering vector from keys, or toward the held pointer. */
    vector(playerX, playerY) {
      let x = (right ? 1 : 0) - (left ? 1 : 0);
      let y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0 && pointerHeld && pointer) {
        x = pointer.x - playerX;
        y = pointer.y - playerY;
        const len = Math.hypot(x, y);
        if (len > 12) {
          x /= len;
          y /= len;
          return { x, y };
        }
        return { x: 0, y: 0 };
      }
      const len = Math.hypot(x, y);
      if (len === 0) return { x: 0, y: 0 };
      return { x: x / len, y: y / len };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** A direct attunement index requested with 1/2/3, or -1. */
    takeAttuneTo() {
      const taken = attuneTo;
      attuneTo = -1;
      return taken;
    },
  };
}
