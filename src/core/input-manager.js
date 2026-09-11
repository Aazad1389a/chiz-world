// ============================================================
// AZAD WORLD
// INPUT MANAGER
// ============================================================
//
// Central input system for:
// - Keyboard
// - Mouse
// - Touch
// - Virtual joystick
// - Game actions
// - Pointer lock
// - Mobile controls
//
// Other game systems should read input from this module instead
// of attaching their own keyboard/mouse listeners.
// ============================================================

import { gameState } from "./game-state.js";

// ------------------------------------------------------------
// DEFAULT ACTIONS
// ------------------------------------------------------------

const DEFAULT_ACTIONS = {
  moveForward: ["KeyW", "ArrowUp"],
  moveBackward: ["KeyS", "ArrowDown"],
  moveLeft: ["KeyA", "ArrowLeft"],
  moveRight: ["KeyD", "ArrowRight"],

  jump: ["Space"],
  sprint: ["ShiftLeft", "ShiftRight"],

  interact: ["KeyE"],
  action: ["KeyF"],

  crouch: ["KeyC"],
  reload: ["KeyR"],

  inventory: ["KeyI", "Tab"],
  map: ["KeyM"],
  pause: ["Escape"],

  primaryAction: ["Mouse0"],
  secondaryAction: ["Mouse2"]
};

// ------------------------------------------------------------
// INPUT MANAGER
// ------------------------------------------------------------

export class InputManager {
  constructor(options = {}) {
    this.target = options.target || window;

    this.enabled = true;

    this.destroyed = false;

    // --------------------------------------------------------
    // KEYBOARD
    // --------------------------------------------------------

    this.keys = new Set();

    this.previousKeys = new Set();

    this.keyPressed = new Set();

    this.keyReleased = new Set();

    // --------------------------------------------------------
    // MOUSE
    // --------------------------------------------------------

    this.mouse = {
      x: 0,
      y: 0,

      deltaX: 0,
      deltaY: 0,

      wheelX: 0,
      wheelY: 0,

      buttons: new Set(),

      pressed: new Set(),
      released: new Set(),

      locked: false
    };

    // --------------------------------------------------------
    // TOUCH
    // --------------------------------------------------------

    this.touches = new Map();

    this.touch = {
      active: false,

      x: 0,
      y: 0,

      deltaX: 0,
      deltaY: 0
    };

    // --------------------------------------------------------
    // VIRTUAL JOYSTICK
    // --------------------------------------------------------

    this.joystick = {
      active: false,

      x: 0,
      y: 0,

      magnitude: 0,

      angle: 0,

      pointerId: null,

      startX: 0,
      startY: 0,

      radius: 60
    };

    // --------------------------------------------------------
    // ACTION STATE
    // --------------------------------------------------------

    this.actions = new Map();

    this.actionPressed = new Set();

    this.actionReleased = new Set();

    // --------------------------------------------------------
    // CUSTOM KEYMAP
    // --------------------------------------------------------

    this.bindings = {
      ...DEFAULT_ACTIONS,
      ...(options.bindings || {})
    };

    // --------------------------------------------------------
    // EVENT SYSTEM
    // --------------------------------------------------------

    this.listeners = new Map();

    // --------------------------------------------------------
    // POINTER LOCK
    // --------------------------------------------------------

    this.pointerLockElement = null;

    // --------------------------------------------------------
    // SETTINGS
    // --------------------------------------------------------

    this.mouseSensitivity =
      Number(options.mouseSensitivity ?? 1);

    this.touchSensitivity =
      Number(options.touchSensitivity ?? 1);

    this.invertMouseY =
      Boolean(options.invertMouseY ?? false);

    this.invertTouchY =
      Boolean(options.invertTouchY ?? false);

    // --------------------------------------------------------
    // BIND EVENTS
    // --------------------------------------------------------

    this.boundEvents = {
      keydown: (event) => this.handleKeyDown(event),
      keyup: (event) => this.handleKeyUp(event),

      mousedown: (event) => this.handleMouseDown(event),
      mouseup: (event) => this.handleMouseUp(event),
      mousemove: (event) => this.handleMouseMove(event),
      wheel: (event) => this.handleWheel(event),

      touchstart: (event) => this.handleTouchStart(event),
      touchmove: (event) => this.handleTouchMove(event),
      touchend: (event) => this.handleTouchEnd(event),
      touchcancel: (event) => this.handleTouchEnd(event),

      pointerlockchange: () =>
        this.handlePointerLockChange(),

      contextmenu: (event) =>
        this.handleContextMenu(event),

      blur: () => this.releaseAll(),

      visibilitychange: () => {
        if (document.hidden) {
          this.releaseAll();
        }
      }
    };

    this.attach();
  }

  // ==========================================================
  // ATTACH
  // ==========================================================

  attach() {
    if (this.destroyed) {
      return;
    }

    this.target.addEventListener(
      "keydown",
      this.boundEvents.keydown
    );

    this.target.addEventListener(
      "keyup",
      this.boundEvents.keyup
    );

    this.target.addEventListener(
      "mousedown",
      this.boundEvents.mousedown
    );

    this.target.addEventListener(
      "mouseup",
      this.boundEvents.mouseup
    );

    this.target.addEventListener(
      "mousemove",
      this.boundEvents.mousemove
    );

    this.target.addEventListener(
      "wheel",
      this.boundEvents.wheel,
      { passive: false }
    );

    this.target.addEventListener(
      "touchstart",
      this.boundEvents.touchstart,
      { passive: false }
    );

    this.target.addEventListener(
      "touchmove",
      this.boundEvents.touchmove,
      { passive: false }
    );

    this.target.addEventListener(
      "touchend",
      this.boundEvents.touchend,
      { passive: false }
    );

    this.target.addEventListener(
      "touchcancel",
      this.boundEvents.touchcancel,
      { passive: false }
    );

    document.addEventListener(
      "pointerlockchange",
      this.boundEvents.pointerlockchange
    );

    this.target.addEventListener(
      "contextmenu",
      this.boundEvents.contextmenu
    );

    window.addEventListener(
      "blur",
      this.boundEvents.blur
    );

    document.addEventListener(
      "visibilitychange",
      this.boundEvents.visibilitychange
    );
  }

  // ==========================================================
  // KEYBOARD
  // ==========================================================

  handleKeyDown(event) {
    if (!this.enabled) {
      return;
    }

    const code = event.code;

    if (!this.keys.has(code)) {
      this.keyPressed.add(code);
    }

    this.keys.add(code);

    this.emit("keydown", event);

    if (this.shouldPreventDefault(event)) {
      event.preventDefault();
    }
  }

  handleKeyUp(event) {
    if (!this.enabled) {
      return;
    }

    const code = event.code;

    this.keys.delete(code);

    this.keyReleased.add(code);

    this.emit("keyup", event);

    if (this.shouldPreventDefault(event)) {
      event.preventDefault();
    }
  }

  isKeyDown(code) {
    return this.keys.has(code);
  }

  isKeyPressed(code) {
    return this.keyPressed.has(code);
  }

  isKeyReleased(code) {
    return this.keyReleased.has(code);
  }

  // ==========================================================
  // MOUSE
  // ==========================================================

  handleMouseDown(event) {
    if (!this.enabled) {
      return;
    }

    const button = event.button;

    if (!this.mouse.buttons.has(button)) {
      this.mouse.pressed.add(button);
    }

    this.mouse.buttons.add(button);

    this.emit("mousedown", event);
  }

  handleMouseUp(event) {
    if (!this.enabled) {
      return;
    }

    const button = event.button;

    this.mouse.buttons.delete(button);

    this.mouse.released.add(button);

    this.emit("mouseup", event);
  }

  handleMouseMove(event) {
    if (!this.enabled) {
      return;
    }

    let deltaX =
      event.movementX ??
      event.mozMovementX ??
      0;

    let deltaY =
      event.movementY ??
      event.mozMovementY ??
      0;

    if (!this.mouse.locked) {
      deltaX = event.movementX || 0;
      deltaY = event.movementY || 0;
    }

    if (this.invertMouseY) {
      deltaY *= -1;
    }

    this.mouse.deltaX +=
      deltaX * this.mouseSensitivity;

    this.mouse.deltaY +=
      deltaY * this.mouseSensitivity;

    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;

    this.emit("mousemove", event);
  }

  handleWheel(event) {
    if (!this.enabled) {
      return;
    }

    this.mouse.wheelX += event.deltaX;
    this.mouse.wheelY += event.deltaY;

    this.emit("wheel", event);

    event.preventDefault();
  }

  isMouseDown(button = 0) {
    return this.mouse.buttons.has(button);
  }

  isMousePressed(button = 0) {
    return this.mouse.pressed.has(button);
  }

  isMouseReleased(button = 0) {
    return this.mouse.released.has(button);
  }

  getMouseDelta() {
    return {
      x: this.mouse.deltaX,
      y: this.mouse.deltaY
    };
  }

  getMousePosition() {
    return {
      x: this.mouse.x,
      y: this.mouse.y
    };
  }

  getWheelDelta() {
    return {
      x: this.mouse.wheelX,
      y: this.mouse.wheelY
    };
  }

  // ==========================================================
  // TOUCH
  // ==========================================================

  handleTouchStart(event) {
    if (!this.enabled) {
      return;
    }

    event.preventDefault();

    for (const touch of event.changedTouches) {
      this.touches.set(touch.identifier, {
        id: touch.identifier,

        x: touch.clientX,
        y: touch.clientY,

        previousX: touch.clientX,
        previousY: touch.clientY,

        startX: touch.clientX,
        startY: touch.clientY
      });
    }

    this.touch.active = this.touches.size > 0;

    this.emit("touchstart", event);
  }

  handleTouchMove(event) {
    if (!this.enabled) {
      return;
    }

    event.preventDefault();

    for (const touch of event.changedTouches) {
      const current = this.touches.get(
        touch.identifier
      );

      if (!current) {
        continue;
      }

      const deltaX =
        (touch.clientX - current.previousX) *
        this.touchSensitivity;

      let deltaY =
        (touch.clientY - current.previousY) *
        this.touchSensitivity;

      if (this.invertTouchY) {
        deltaY *= -1;
      }

      this.touch.deltaX += deltaX;
      this.touch.deltaY += deltaY;

      current.previousX = touch.clientX;
      current.previousY = touch.clientY;

      current.x = touch.clientX;
      current.y = touch.clientY;
    }

    this.touch.active = this.touches.size > 0;

    this.emit("touchmove", event);
  }

  handleTouchEnd(event) {
    if (!this.enabled) {
      return;
    }

    event.preventDefault();

    for (const touch of event.changedTouches) {
      this.touches.delete(touch.identifier);
    }

    this.touch.active = this.touches.size > 0;

    this.emit("touchend", event);
  }

  getTouchDelta() {
    return {
      x: this.touch.deltaX,
      y: this.touch.deltaY
    };
  }

  getActiveTouches() {
    return Array.from(this.touches.values()).map(
      (touch) => ({ ...touch })
    );
  }

  // ==========================================================
  // VIRTUAL JOYSTICK
  // ==========================================================

  setJoystickPosition(
    x,
    y,
    startX = 0,
    startY = 0
  ) {
    const dx = x - startX;
    const dy = y - startY;

    const distance = Math.sqrt(
      dx * dx + dy * dy
    );

    const radius = Math.max(
      1,
      this.joystick.radius
    );

    const normalizedDistance = Math.min(
      distance / radius,
      1
    );

    let normalizedX = 0;
    let normalizedY = 0;

    if (distance > 0) {
      normalizedX =
        (dx / distance) *
        normalizedDistance;

      normalizedY =
        (dy / distance) *
        normalizedDistance;
    }

    this.joystick.active = true;

    this.joystick.x = normalizedX;
    this.joystick.y = normalizedY;

    this.joystick.magnitude =
      normalizedDistance;

    this.joystick.angle =
      Math.atan2(normalizedY, normalizedX);

    this.joystick.startX = startX;
    this.joystick.startY = startY;

    this.emit("joystickmove", {
      x: normalizedX,
      y: normalizedY,
      magnitude: normalizedDistance,
      angle: this.joystick.angle
    });
  }

  resetJoystick() {
    this.joystick.active = false;

    this.joystick.x = 0;
    this.joystick.y = 0;

    this.joystick.magnitude = 0;

    this.joystick.angle = 0;

    this.joystick.pointerId = null;

    this.emit("joystickreset");
  }

  getJoystick() {
    return {
      active: this.joystick.active,

      x: this.joystick.x,
      y: this.joystick.y,

      magnitude: this.joystick.magnitude,

      angle: this.joystick.angle
    };
  }

  // ==========================================================
  // ACTION BINDINGS
  // ==========================================================

  bindAction(action, bindings) {
    if (!action) {
      return false;
    }

    if (!Array.isArray(bindings)) {
      bindings = [bindings];
    }

    this.bindings[action] = [...bindings];

    return true;
  }

  unbindAction(action) {
    if (!action) {
      return false;
    }

    delete this.bindings[action];

    return true;
  }

  getActionBindings(action) {
    return [
      ...(this.bindings[action] || [])
    ];
  }

  // ==========================================================
  // ACTION STATE
  // ==========================================================

  isActionDown(action) {
    const bindings =
      this.bindings[action] || [];

    for (const binding of bindings) {
      if (this.isBindingDown(binding)) {
        return true;
      }
    }

    return false;
  }

  isActionPressed(action) {
    const bindings =
      this.bindings[action] || [];

    for (const binding of bindings) {
      if (this.isBindingPressed(binding)) {
        return true;
      }
    }

    return false;
  }

  isActionReleased(action) {
    const bindings =
      this.bindings[action] || [];

    for (const binding of bindings) {
      if (this.isBindingReleased(binding)) {
        return true;
      }
    }

    return false;
  }

  isBindingDown(binding) {
    if (binding === "Mouse0") {
      return this.isMouseDown(0);
    }

    if (binding === "Mouse1") {
      return this.isMouseDown(1);
    }

    if (binding === "Mouse2") {
      return this.isMouseDown(2);
    }

    if (binding.startsWith("Touch")) {
      return this.touch.active;
    }

    return this.isKeyDown(binding);
  }

  isBindingPressed(binding) {
    if (binding === "Mouse0") {
      return this.isMousePressed(0);
    }

    if (binding === "Mouse1") {
      return this.isMousePressed(1);
    }

    if (binding === "Mouse2") {
      return this.isMousePressed(2);
    }

    return this.isKeyPressed(binding);
  }

  isBindingReleased(binding) {
    if (binding === "Mouse0") {
      return this.isMouseReleased(0);
    }

    if (binding === "Mouse1") {
      return this.isMouseReleased(1);
    }

    if (binding === "Mouse2") {
      return this.isMouseReleased(2);
    }

    return this.isKeyReleased(binding);
  }

  // ==========================================================
  // MOVEMENT VECTOR
  // ==========================================================

  getMovementVector() {
    let x = 0;
    let y = 0;

    if (this.isActionDown("moveLeft")) {
      x -= 1;
    }

    if (this.isActionDown("moveRight")) {
      x += 1;
    }

    if (this.isActionDown("moveForward")) {
      y += 1;
    }

    if (this.isActionDown("moveBackward")) {
      y -= 1;
    }

    // --------------------------------------------------------
    // Add mobile joystick
    // --------------------------------------------------------

    if (this.joystick.active) {
      x += this.joystick.x;
      y -= this.joystick.y;
    }

    const length = Math.sqrt(
      x * x + y * y
    );

    if (length > 1) {
      x /= length;
      y /= length;
    }

    return {
      x,
      y,

      magnitude: Math.min(length, 1)
    };
  }

  // ==========================================================
  // COMMON GAME ACTIONS
  // ==========================================================

  getGameplayInput() {
    return {
      movement: this.getMovementVector(),

      jump: this.isActionDown("jump"),

      jumpPressed:
        this.isActionPressed("jump"),

      sprint:
        this.isActionDown("sprint"),

      interact:
        this.isActionPressed("interact"),

      action:
        this.isActionPressed("action"),

      crouch:
        this.isActionDown("crouch"),

      reload:
        this.isActionPressed("reload"),

      primaryAction:
        this.isActionDown("primaryAction"),

      secondaryAction:
        this.isActionDown("secondaryAction"),

      inventory:
        this.isActionPressed("inventory"),

      map:
        this.isActionPressed("map"),

      pause:
        this.isActionPressed("pause")
    };
  }

  // ==========================================================
  // POINTER LOCK
  // ==========================================================

  async requestPointerLock(element = null) {
    const target =
      element ||
      this.pointerLockElement ||
      document.body;

    if (!target?.requestPointerLock) {
      return false;
    }

    try {
      await target.requestPointerLock();

      return true;
    } catch (error) {
      console.warn(
        "[InputManager] Pointer lock failed:",
        error
      );

      return false;
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  handlePointerLockChange() {
    this.mouse.locked =
      Boolean(document.pointerLockElement);

    gameState.set(
      "input.mouseLocked",
      this.mouse.locked
    );

    this.emit(
      "pointerlockchange",
      this.mouse.locked
    );
  }

  // ==========================================================
  // CONTEXT MENU
  // ==========================================================

  handleContextMenu(event) {
    if (
      this.mouse.locked ||
      this.enabled
    ) {
      event.preventDefault();
    }
  }

  // ==========================================================
  // PREVENT DEFAULT
  // ==========================================================

  shouldPreventDefault(event) {
    const blockedKeys = [
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Tab"
    ];

    return blockedKeys.includes(event.code);
  }

  // ==========================================================
  // ENABLE / DISABLE
  // ==========================================================

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);

    if (!this.enabled) {
      this.releaseAll();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  // ==========================================================
  // RESET FRAME INPUT
  // ==========================================================

  update() {
    if (this.destroyed) {
      return;
    }

    this.previousKeys = new Set(this.keys);

    this.keyPressed.clear();
    this.keyReleased.clear();

    this.mouse.pressed.clear();
    this.mouse.released.clear();

    this.mouse.deltaX = 0;
    this.mouse.deltaY = 0;

    this.mouse.wheelX = 0;
    this.mouse.wheelY = 0;

    this.touch.deltaX = 0;
    this.touch.deltaY = 0;
  }

  // ==========================================================
  // RELEASE EVERYTHING
  // ==========================================================

  releaseAll() {
    this.keys.clear();

    this.previousKeys.clear();

    this.keyPressed.clear();
    this.keyReleased.clear();

    this.mouse.buttons.clear();

    this.mouse.pressed.clear();
    this.mouse.released.clear();

    this.touches.clear();

    this.touch.active = false;

    this.resetJoystick();

    gameState.update(
      "input",
      {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        action: false,
        interact: false,
        mouseLocked: false
      }
    );
  }

  // ==========================================================
  // EVENTS
  // ==========================================================

  on(eventName, callback) {
    if (typeof callback !== "function") {
      return () => {};
    }

    if (!this.listeners.has(eventName)) {
      this.listeners.set(
        eventName,
        new Set()
      );
    }

    const callbacks =
      this.listeners.get(eventName);

    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);

      if (callbacks.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  off(eventName, callback) {
    const callbacks =
      this.listeners.get(eventName);

    if (!callbacks) {
      return;
    }

    callbacks.delete(callback);

    if (callbacks.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  emit(eventName, data = null) {
    const callbacks =
      this.listeners.get(eventName);

    if (!callbacks) {
      return;
    }

    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (error) {
        console.error(
          `[InputManager] Event error: ${eventName}`,
          error
        );
      }
    }
  }

  // ==========================================================
  // SETTINGS
  // ==========================================================

  setMouseSensitivity(value) {
    this.mouseSensitivity =
      Math.max(0.01, Number(value) || 1);
  }

  setTouchSensitivity(value) {
    this.touchSensitivity =
      Math.max(0.01, Number(value) || 1);
  }

  setInvertMouseY(enabled) {
    this.invertMouseY =
      Boolean(enabled);
  }

  setInvertTouchY(enabled) {
    this.invertTouchY =
      Boolean(enabled);
  }

  getSettings() {
    return {
      mouseSensitivity:
        this.mouseSensitivity,

      touchSensitivity:
        this.touchSensitivity,

      invertMouseY:
        this.invertMouseY,

      invertTouchY:
        this.invertTouchY
    };
  }

  // ==========================================================
  // DEBUG
  // ==========================================================

  getDebugInfo() {
    return {
      enabled: this.enabled,

      keyboardKeys:
        [...this.keys],

      mouse: {
        x: this.mouse.x,
        y: this.mouse.y,

        deltaX: this.mouse.deltaX,
        deltaY: this.mouse.deltaY,

        locked: this.mouse.locked,

        buttons: [
          ...this.mouse.buttons
        ]
      },

      touch: {
        active: this.touch.active,

        count: this.touches.size,

        deltaX: this.touch.deltaX,
        deltaY: this.touch.deltaY
      },

      joystick: this.getJoystick(),

      movement:
        this.getMovementVector(),

      gameplay:
        this.getGameplayInput()
    };
  }

  // ==========================================================
  // DISPOSE
  // ==========================================================

  dispose() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    this.releaseAll();

    this.target.removeEventListener(
      "keydown",
      this.boundEvents.keydown
    );

    this.target.removeEventListener(
      "keyup",
      this.boundEvents.keyup
    );

    this.target.removeEventListener(
      "mousedown",
      this.boundEvents.mousedown
    );

    this.target.removeEventListener(
      "mouseup",
      this.boundEvents.mouseup
    );

    this.target.removeEventListener(
      "mousemove",
      this.boundEvents.mousemove
    );

    this.target.removeEventListener(
      "wheel",
      this.boundEvents.wheel
    );

    this.target.removeEventListener(
      "touchstart",
      this.boundEvents.touchstart
    );

    this.target.removeEventListener(
      "touchmove",
      this.boundEvents.touchmove
    );

    this.target.removeEventListener(
      "touchend",
      this.boundEvents.touchend
    );

    this.target.removeEventListener(
      "touchcancel",
      this.boundEvents.touchcancel
    );

    this.target.removeEventListener(
      "contextmenu",
      this.boundEvents.contextmenu
    );

    document.removeEventListener(
      "pointerlockchange",
      this.boundEvents.pointerlockchange
    );

    window.removeEventListener(
      "blur",
      this.boundEvents.blur
    );

    document.removeEventListener(
      "visibilitychange",
      this.boundEvents.visibilitychange
    );

    this.listeners.clear();

    this.keys.clear();
    this.previousKeys.clear();

    this.touches.clear();

    this.actions.clear();
    this.actionPressed.clear();
    this.actionReleased.clear();
  }
}

// ============================================================
// SINGLETON
// ============================================================

export const inputManager =
  new InputManager();

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

export function getInput() {
  return inputManager.getGameplayInput();
}

export function getMovementInput() {
  return inputManager.getMovementVector();
}

export function isActionDown(action) {
  return inputManager.isActionDown(action);
}

export function isActionPressed(action) {
  return inputManager.isActionPressed(action);
}

export function isActionReleased(action) {
  return inputManager.isActionReleased(action);
}

export function updateInput() {
  inputManager.update();
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default inputManager;
