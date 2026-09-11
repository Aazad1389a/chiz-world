import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { inputManager } from "../core/input-manager.js";
import { saveManager } from "../gameplay/save.js";

/* =========================================================
   Settings Constants
========================================================= */

export const SETTINGS_CATEGORIES = Object.freeze({
  GRAPHICS: "graphics",
  AUDIO: "audio",
  CONTROLS: "controls",
  GAMEPLAY: "gameplay",
  MOBILE: "mobile",
  INTERFACE: "interface",
  NETWORK: "network"
});

export const GRAPHICS_QUALITY = Object.freeze([
  "low",
  "medium",
  "high",
  "ultra"
]);

export const SHADOW_QUALITY = Object.freeze([
  "off",
  "low",
  "medium",
  "high",
  "ultra"
]);

const DEFAULT_SETTINGS = Object.freeze({
  graphics: {
    quality:
      GAME_CONFIG.graphics?.quality ||
      "high",

    renderScale:
      GAME_CONFIG.graphics?.renderScale ||
      1,

    shadows:
      GAME_CONFIG.graphics?.shadowQuality ||
      "high",

    maxPixelRatio:
      GAME_CONFIG.graphics?.maxPixelRatio ||
      2,

    fullscreen: false,

    vsync: true,

    showFPS: true,

    showPing: true,

    showCrosshair: true
  },

  audio: {
    masterVolume: 1,
    musicVolume: 0.8,
    sfxVolume: 1,
    voiceVolume: 1,
    ambientVolume: 0.8,

    muted: false
  },

  controls: {
    mouseSensitivity:
      GAME_CONFIG.player?.mouseSensitivity ||
      0.0025,

    invertY: false,

    sprintToggle: false,

    crouchToggle: false,

    vibration: true
  },

  gameplay: {
    cameraMode:
      GAME_CONFIG.camera?.mode ||
      "third-person",

    showDamageNumbers: true,

    autoPickup: true,

    subtitles: true
  },

  mobile: {
    enabled:
      GAME_CONFIG.mobile?.enabled ??
      true,

    joystickSize: 1,

    buttonSize: 1,

    vibration: true,

    aimAssist: true,

    showTouchControls: true
  },

  interface: {
    scale: 1,

    language: "fa",

    showHUD: true,

    showNotifications: true,

    showInteractionPrompts: true
  },

  network: {
    region: "auto",

    voiceChat: false,

    lowLatencyMode: true
  }
});

/* =========================================================
   Helpers
========================================================= */

function clone(value) {
  try {
    return JSON.parse(
      JSON.stringify(value)
    );
  } catch {
    return value;
  }
}

function mergeDeep(target, source) {
  if (!source || typeof source !== "object") {
    return target;
  }

  for (const key of Object.keys(source)) {
    const value = source[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      if (
        !target[key] ||
        typeof target[key] !== "object"
      ) {
        target[key] = {};
      }

      mergeDeep(target[key], value);
    } else {
      target[key] = clone(value);
    }
  }

  return target;
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

/* =========================================================
   Settings Manager
========================================================= */

export class SettingsManager {
  constructor(options = {}) {
    this.config = {
      autoSave:
        options.autoSave ??
        true,

      saveDelay:
        options.saveDelay ||
        500,

      storageKey:
        options.storageKey ||
        `${GAME_CONFIG.identity?.id || "azad-world"}:settings`
    };

    this.settings =
      clone(DEFAULT_SETTINGS);

    this.initialized = false;

    this.saveTimer = null;

    this.listeners = new Map();

    this.elements = new Map();
  }

  /* =======================================================
     Events
  ======================================================= */

  on(event, callback) {
    if (typeof callback !== "function") {
      return () => {};
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(
        event,
        new Set()
      );
    }

    this.listeners
      .get(event)
      .add(callback);

    return () =>
      this.off(event, callback);
  }

  off(event, callback) {
    const listeners =
      this.listeners.get(event);

    if (!listeners) return;

    listeners.delete(callback);

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event, data = {}) {
    const listeners =
      this.listeners.get(event);

    if (!listeners) return;

    for (const callback of listeners) {
      try {
        callback(data);
      } catch (error) {
        console.error(
          `[SettingsManager] Event error: ${event}`,
          error
        );
      }
    }
  }

  /* =======================================================
     Initialize
  ======================================================= */

  initialize() {
    if (this.initialized) {
      return this;
    }

    this.loadLocal();

    this.syncState();

    this.initialized = true;

    this.emit(
      "initialized",
      {
        settings: this.snapshot()
      }
    );

    return this;
  }

  /* =======================================================
     Categories
  ======================================================= */

  getCategories() {
    return Object.values(
      SETTINGS_CATEGORIES
    );
  }

  /* =======================================================
     Get
  ======================================================= */

  get(category, key, fallback = undefined) {
    if (
      !category ||
      !key
    ) {
      return fallback;
    }

    const section =
      this.settings[category];

    if (!section) {
      return fallback;
    }

    return section[key] !== undefined
      ? section[key]
      : fallback;
  }

  getCategory(category) {
    if (!this.settings[category]) {
      return {};
    }

    return clone(
      this.settings[category]
    );
  }

  getAll() {
    return clone(
      this.settings
    );
  }

  /* =======================================================
     Set
  ======================================================= */

  set(
    category,
    key,
    value,
    options = {}
  ) {
    if (
      !category ||
      !key
    ) {
      return false;
    }

    if (!this.settings[category]) {
      this.settings[category] = {};
    }

    const previous =
      this.settings[category][key];

    this.settings[category][key] =
      clone(value);

    this.syncState();

    this.applySetting(
      category,
      key,
      value
    );

    this.emit(
      "changed",
      {
        category,
        key,
        value,
        previous
      }
    );

    if (
      this.config.autoSave &&
      options.save !== false
    ) {
      this.scheduleSave();
    }

    return true;
  }

  setCategory(
    category,
    values,
    options = {}
  ) {
    if (
      !category ||
      !values ||
      typeof values !== "object"
    ) {
      return false;
    }

    for (const [
      key,
      value
    ] of Object.entries(values)) {
      this.set(
        category,
        key,
        value,
        {
          save: false
        }
      );
    }

    if (
      this.config.autoSave &&
      options.save !== false
    ) {
      this.scheduleSave();
    }

    return true;
  }

  /* =======================================================
     Apply Setting
  ======================================================= */

  applySetting(
    category,
    key,
    value
  ) {
    /* -----------------------------------------------------
       Graphics
    ----------------------------------------------------- */

    if (category === "graphics") {
      if (key === "showFPS") {
        this.emit(
          "graphicsChanged",
          {
            key,
            value
          }
        );
      }

      if (key === "quality") {
        this.emit(
          "qualityChanged",
          {
            quality: value
          }
        );
      }

      if (key === "renderScale") {
        this.emit(
          "renderScaleChanged",
          {
            renderScale: value
          }
        );
      }

      if (key === "shadows") {
        this.emit(
          "shadowQualityChanged",
          {
            quality: value
          }
        );
      }

      if (key === "fullscreen") {
        this.setFullscreen(
          Boolean(value)
        );
      }
    }

    /* -----------------------------------------------------
       Audio
    ----------------------------------------------------- */

    if (category === "audio") {
      this.emit(
        "audioChanged",
        {
          key,
          value
        }
      );
    }

    /* -----------------------------------------------------
       Controls
    ----------------------------------------------------- */

    if (category === "controls") {
      this.emit(
        "controlsChanged",
        {
          key,
          value
        }
      );
    }

    /* -----------------------------------------------------
       Gameplay
    ----------------------------------------------------- */

    if (category === "gameplay") {
      this.emit(
        "gameplayChanged",
        {
          key,
          value
        }
      );
    }

    /* -----------------------------------------------------
       Mobile
    ----------------------------------------------------- */

    if (category === "mobile") {
      this.emit(
        "mobileChanged",
        {
          key,
          value
        }
      );
    }

    /* -----------------------------------------------------
       Interface
    ----------------------------------------------------- */

    if (category === "interface") {
      this.emit(
        "interfaceChanged",
        {
          key,
          value
        }
      );
    }

    /* -----------------------------------------------------
       Network
    ----------------------------------------------------- */

    if (category === "network") {
      this.emit(
        "networkChanged",
        {
          key,
          value
        }
      );
    }
  }

  /* =======================================================
     Graphics
  ======================================================= */

  setGraphicsQuality(quality) {
    if (
      !GRAPHICS_QUALITY.includes(
        quality
      )
    ) {
      return false;
    }

    return this.set(
      "graphics",
      "quality",
      quality
    );
  }

  getGraphicsQuality() {
    return this.get(
      "graphics",
      "quality",
      "high"
    );
  }

  setShadowQuality(quality) {
    if (
      !SHADOW_QUALITY.includes(
        quality
      )
    ) {
      return false;
    }

    return this.set(
      "graphics",
      "shadows",
      quality
    );
  }

  setRenderScale(scale) {
    const value =
      clamp(
        Number(scale) || 1,
        0.5,
        1.5
      );

    return this.set(
      "graphics",
      "renderScale",
      value
    );
  }

  /* =======================================================
     Fullscreen
  ======================================================= */

  async setFullscreen(enabled) {
    if (
      typeof document === "undefined"
    ) {
      return false;
    }

    try {
      if (enabled) {
        const element =
          document.documentElement;

        if (
          !document.fullscreenElement &&
          element.requestFullscreen
        ) {
          await element.requestFullscreen();
        }
      } else if (
        document.fullscreenElement &&
        document.exitFullscreen
      ) {
        await document.exitFullscreen();
      }

      this.settings.graphics.fullscreen =
        Boolean(
          document.fullscreenElement
        );

      this.syncState();

      return true;
    } catch (error) {
      console.warn(
        "[SettingsManager] Fullscreen error:",
        error
      );

      return false;
    }
  }

  async toggleFullscreen() {
    return this.setFullscreen(
      !this.settings.graphics.fullscreen
    );
  }

  /* =======================================================
     Audio
  ======================================================= */

  setMasterVolume(value) {
    return this.set(
      "audio",
      "masterVolume",
      clamp(
        Number(value) || 0,
        0,
        1
      )
    );
  }

  setMusicVolume(value) {
    return this.set(
      "audio",
      "musicVolume",
      clamp(
        Number(value) || 0,
        0,
        1
      )
    );
  }

  setSFXVolume(value) {
    return this.set(
      "audio",
      "sfxVolume",
      clamp(
        Number(value) || 0,
        0,
        1
      )
    );
  }

  setVoiceVolume(value) {
    return this.set(
      "audio",
      "voiceVolume",
      clamp(
        Number(value) || 0,
        0,
        1
      )
    );
  }

  muteAudio(muted = true) {
    return this.set(
      "audio",
      "muted",
      Boolean(muted)
    );
  }

  /* =======================================================
     Controls
  ======================================================= */

  setMouseSensitivity(value) {
    const sensitivity =
      clamp(
        Number(value) || 0.0025,
        0.0001,
        0.02
      );

    const result =
      this.set(
        "controls",
        "mouseSensitivity",
        sensitivity
      );

    if (
      inputManager &&
      typeof inputManager.setSettings ===
        "function"
    ) {
      inputManager.setSettings({
        mouseSensitivity:
          sensitivity
      });
    }

    return result;
  }

  setInvertY(enabled) {
    return this.set(
      "controls",
      "invertY",
      Boolean(enabled)
    );
  }

  setSprintToggle(enabled) {
    return this.set(
      "controls",
      "sprintToggle",
      Boolean(enabled)
    );
  }

  setCrouchToggle(enabled) {
    return this.set(
      "controls",
      "crouchToggle",
      Boolean(enabled)
    );
  }

  /* =======================================================
     Gameplay
  ======================================================= */

  setCameraMode(mode) {
    const allowed = [
      "first-person",
      "third-person"
    ];

    if (!allowed.includes(mode)) {
      return false;
    }

    return this.set(
      "gameplay",
      "cameraMode",
      mode
    );
  }

  /* =======================================================
     Mobile
  ======================================================= */

  setMobileEnabled(enabled) {
    return this.set(
      "mobile",
      "enabled",
      Boolean(enabled)
    );
  }

  setAimAssist(enabled) {
    return this.set(
      "mobile",
      "aimAssist",
      Boolean(enabled)
    );
  }

  setTouchControls(enabled) {
    return this.set(
      "mobile",
      "showTouchControls",
      Boolean(enabled)
    );
  }

  setJoystickSize(size) {
    return this.set(
      "mobile",
      "joystickSize",
      clamp(
        Number(size) || 1,
        0.7,
        1.5
      )
    );
  }

  setButtonSize(size) {
    return this.set(
      "mobile",
      "buttonSize",
      clamp(
        Number(size) || 1,
        0.7,
        1.5
      )
    );
  }

  /* =======================================================
     Interface
  ======================================================= */

  setHUDVisible(enabled) {
    return this.set(
      "interface",
      "showHUD",
      Boolean(enabled)
    );
  }

  setLanguage(language) {
    return this.set(
      "interface",
      "language",
      String(language || "fa")
    );
  }

  setUIScale(scale) {
    return this.set(
      "interface",
      "scale",
      clamp(
        Number(scale) || 1,
        0.75,
        1.5
      )
    );
  }

  /* =======================================================
     Network
  ======================================================= */

  setRegion(region) {
    return this.set(
      "network",
      "region",
      String(region || "auto")
    );
  }

  setLowLatencyMode(enabled) {
    return this.set(
      "network",
      "lowLatencyMode",
      Boolean(enabled)
    );
  }

  /* =======================================================
     Local Storage
  ======================================================= */

  loadLocal() {
    if (
      typeof localStorage === "undefined"
    ) {
      return false;
    }

    try {
      const raw =
        localStorage.getItem(
          this.config.storageKey
        );

      if (!raw) {
        return false;
      }

      const parsed =
        JSON.parse(raw);

      mergeDeep(
        this.settings,
        parsed
      );

      return true;
    } catch (error) {
      console.warn(
        "[SettingsManager] Local settings load failed:",
        error
      );

      return false;
    }
  }

  saveLocal() {
    if (
      typeof localStorage === "undefined"
    ) {
      return false;
    }

    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify(
          this.settings
        )
      );

      return true;
    } catch (error) {
      console.warn(
        "[SettingsManager] Local settings save failed:",
        error
      );

      return false;
    }
  }

  scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(
        this.saveTimer
      );
    }

    this.saveTimer =
      setTimeout(() => {
        this.save();
      }, this.config.saveDelay);
  }

  async save() {
    const local =
      this.saveLocal();

    let cloud = false;

    /*
     * Save through the central save
     * system when available.
     */
    try {
      if (
        saveManager &&
        typeof saveManager.save ===
          "function"
      ) {
        const state =
          gameState.snapshot();

        if (state?.save) {
          cloud = true;
        }
      }
    } catch {
      cloud = false;
    }

    this.emit("saved", {
      local,
      cloud
    });

    return {
      local,
      cloud
    };
  }

  /* =======================================================
     Reset
  ======================================================= */

  reset(options = {}) {
    this.settings =
      clone(DEFAULT_SETTINGS);

    this.syncState();

    if (
      options.save !== false
    ) {
      this.save();
    }

    this.emit(
      "reset",
      {
        settings: this.snapshot()
      }
    );

    return true;
  }

  resetCategory(
    category,
    options = {}
  ) {
    if (
      !DEFAULT_SETTINGS[category]
    ) {
      return false;
    }

    this.settings[category] =
      clone(
        DEFAULT_SETTINGS[category]
      );

    this.syncState();

    if (
      options.save !== false
    ) {
      this.save();
    }

    this.emit(
      "categoryReset",
      {
        category
      }
    );

    return true;
  }

  /* =======================================================
     State Synchronization
  ======================================================= */

  syncState() {
    try {
      if (
        typeof gameState.update ===
        "function"
      ) {
        gameState.update(
          "ui.settings",
          clone(this.settings)
        );
      }
    } catch (error) {
      console.warn(
        "[SettingsManager] State sync failed:",
        error
      );
    }
  }

  loadFromState() {
    try {
      const state =
        gameState.snapshot();

      const stored =
        state?.ui?.settings;

      if (
        stored &&
        typeof stored === "object"
      ) {
        mergeDeep(
          this.settings,
          stored
        );
      }

      return true;
    } catch {
      return false;
    }
  }

  /* =======================================================
     DOM Binding
  ======================================================= */

  bindInput(
    element,
    category,
    key,
    options = {}
  ) {
    if (!element) {
      return false;
    }

    const event =
      options.event || "change";

    const handler = () => {
      let value;

      if (
        element.type === "checkbox"
      ) {
        value = element.checked;
      } else if (
        element.type === "range" ||
        element.type === "number"
      ) {
        value =
          Number(element.value);
      } else {
        value =
          element.value;
      }

      this.set(
        category,
        key,
        value
      );
    };

    element.addEventListener(
      event,
      handler
    );

    this.elements.set(
      element,
      {
        event,
        handler
      }
    );

    return true;
  }

  unbindInput(element) {
    const binding =
      this.elements.get(element);

    if (!binding) {
      return false;
    }

    element.removeEventListener(
      binding.event,
      binding.handler
    );

    this.elements.delete(
      element
    );

    return true;
  }

  /* =======================================================
     Snapshot
  ======================================================= */

  snapshot() {
    return clone(
      this.settings
    );
  }

  debug() {
    return {
      initialized:
        this.initialized,

      settings:
        this.snapshot(),

      boundElements:
        this.elements.size,

      autoSave:
        this.config.autoSave
    };
  }

  /* =======================================================
     Dispose
  ======================================================= */

  dispose() {
    if (this.saveTimer) {
      clearTimeout(
        this.saveTimer
      );

      this.saveTimer = null;
    }

    for (const element of this.elements.keys()) {
      this.unbindInput(element);
    }

    this.listeners.clear();

    this.initialized = false;
  }
}

/* =========================================================
   Singleton
========================================================= */

export const settingsManager =
  new SettingsManager();

/* =========================================================
   Convenience Functions
========================================================= */

export function initializeSettings() {
  return settingsManager.initialize();
}

export function getSetting(
  category,
  key,
  fallback
) {
  return settingsManager.get(
    category,
    key,
    fallback
  );
}

export function setSetting(
  category,
  key,
  value,
  options
) {
  return settingsManager.set(
    category,
    key,
    value,
    options
  );
}

export function getSettings() {
  return settingsManager.getAll();
}

export function resetSettings(options) {
  return settingsManager.reset(
    options
  );
}

export function saveSettings() {
  return settingsManager.save();
}

export default settingsManager;
