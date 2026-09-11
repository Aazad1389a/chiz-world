// src/gameplay/save.js

import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { cloudSaveManager } from "../api/cloud-save.js";
import { missionManager } from "./missions.js";
import { inventoryManager } from "./inventory.js";

/* =========================================================
   Constants
========================================================= */

export const SAVE_STATUS = Object.freeze({
  IDLE: "idle",
  SAVING: "saving",
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error"
});

export const SAVE_TYPES = Object.freeze({
  MANUAL: "manual",
  AUTO: "auto",
  CHECKPOINT: "checkpoint",
  CLOUD: "cloud",
  LOCAL: "local"
});

const DEFAULT_SLOT = "slot_1";

const DEFAULT_SAVE = Object.freeze({
  version: 1,
  slot: DEFAULT_SLOT,

  player: {
    position: {
      x: 0,
      y: 0,
      z: 0
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0
    },
    health: 100,
    stamina: 100,
    level: 1,
    experience: 0,
    coins: 0,
    alive: true
  },

  world: {
    time: 12,
    weather: "clear",
    currentZone: null
  },

  missions: {},
  inventory: {},

  settings: {},

  statistics: {
    playTime: 0,
    distanceTravelled: 0,
    missionsCompleted: 0,
    enemiesDefeated: 0,
    itemsCollected: 0
  },

  metadata: {
    createdAt: null,
    updatedAt: null,
    platform: "unknown"
  }
});

/* =========================================================
   Helpers
========================================================= */

function clone(value) {
  if (value === undefined) return undefined;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function mergeDeep(target, source) {
  if (!source || typeof source !== "object") {
    return target;
  }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];

    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue)
    ) {
      if (
        !target[key] ||
        typeof target[key] !== "object" ||
        Array.isArray(target[key])
      ) {
        target[key] = {};
      }

      mergeDeep(target[key], sourceValue);
    } else {
      target[key] = clone(sourceValue);
    }
  }

  return target;
}

function createDefaultSave(slot = DEFAULT_SLOT) {
  const save = clone(DEFAULT_SAVE);

  save.slot = slot;
  save.metadata.createdAt = new Date().toISOString();
  save.metadata.updatedAt = save.metadata.createdAt;

  return save;
}

function getLocalStorageKey(slot) {
  return `${GAME_CONFIG.identity?.id || "azad-world"}:save:${slot}`;
}

function safeStorage() {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }

    return localStorage;
  } catch {
    return null;
  }
}

/* =========================================================
   Save Manager
========================================================= */

export class SaveManager {
  constructor(options = {}) {
    this.config = {
      defaultSlot:
        options.defaultSlot ||
        GAME_CONFIG.save?.defaultSlot ||
        DEFAULT_SLOT,

      autosaveEnabled:
        options.autosaveEnabled ??
        GAME_CONFIG.save?.autosaveEnabled ??
        true,

      autosaveInterval:
        options.autosaveInterval ||
        GAME_CONFIG.save?.autosaveInterval ||
        60000,

      localEnabled:
        options.localEnabled ??
        GAME_CONFIG.save?.localEnabled ??
        true,

      cloudEnabled:
        options.cloudEnabled ??
        GAME_CONFIG.save?.cloudEnabled ??
        true,

      maxSlots:
        options.maxSlots ||
        GAME_CONFIG.save?.maxSlots ||
        3
    };

    this.currentSlot = this.config.defaultSlot;

    this.status = SAVE_STATUS.IDLE;

    this.lastSave = null;
    this.lastLoad = null;

    this.autosaveTimer = null;
    this.initialized = false;

    this.listeners = new Map();
  }

  /* =======================================================
     Events
  ======================================================= */

  on(event, callback) {
    if (typeof callback !== "function") return () => {};

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  off(event, callback) {
    const set = this.listeners.get(event);

    if (!set) return;

    set.delete(callback);

    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event, payload = {}) {
    const set = this.listeners.get(event);

    if (!set) return;

    for (const callback of set) {
      try {
        callback(payload);
      } catch (error) {
        console.error(`[SaveManager] Event error: ${event}`, error);
      }
    }
  }

  /* =======================================================
     Initialization
  ======================================================= */

  initialize() {
    if (this.initialized) {
      return this;
    }

    this.initialized = true;

    this.emit("initialized", {
      slot: this.currentSlot
    });

    return this;
  }

  /* =======================================================
     Slot Management
  ======================================================= */

  setSlot(slot) {
    if (!slot || typeof slot !== "string") {
      return false;
    }

    this.currentSlot = slot;

    this.emit("slotChanged", {
      slot
    });

    return true;
  }

  getSlot() {
    return this.currentSlot;
  }

  getAvailableSlots() {
    const slots = [];

    for (let i = 1; i <= this.config.maxSlots; i++) {
      slots.push(`slot_${i}`);
    }

    return slots;
  }

  /* =======================================================
     Build Save Data
  ======================================================= */

  collectSaveData(slot = this.currentSlot) {
    const state = gameState.snapshot();

    const playerState = state?.player || {};
    const worldState = state?.world || {};
    const statistics = state?.statistics || {};

    const missionData =
      typeof missionManager.snapshot === "function"
        ? missionManager.snapshot()
        : state?.mission?.progress || {};

    const inventoryData =
      typeof inventoryManager.snapshot === "function"
        ? inventoryManager.snapshot()
        : state?.inventory || {};

    const save = createDefaultSave(slot);

    save.player = {
      ...save.player,

      position: clone(playerState.position) || save.player.position,
      rotation: clone(playerState.rotation) || save.player.rotation,

      health:
        typeof playerState.health === "number"
          ? playerState.health
          : save.player.health,

      stamina:
        typeof playerState.stamina === "number"
          ? playerState.stamina
          : save.player.stamina,

      level:
        typeof playerState.level === "number"
          ? playerState.level
          : save.player.level,

      experience:
        typeof playerState.experience === "number"
          ? playerState.experience
          : save.player.experience,

      coins:
        typeof playerState.coins === "number"
          ? playerState.coins
          : save.player.coins,

      alive:
        typeof playerState.alive === "boolean"
          ? playerState.alive
          : true
    };

    save.world = {
      ...save.world,

      time:
        typeof worldState.time === "number"
          ? worldState.time
          : 12,

      weather:
        worldState.weather ||
        "clear",

      currentZone:
        worldState.currentZone ||
        null
    };

    save.missions = clone(missionData) || {};
    save.inventory = clone(inventoryData) || {};

    save.settings = clone(state?.ui?.settings || state?.settings || {});

    save.statistics = {
      ...save.statistics,
      ...clone(statistics)
    };

    save.metadata.platform =
      GAME_CONFIG.platform?.default ||
      "unknown";

    save.metadata.updatedAt = new Date().toISOString();

    return save;
  }

  /* =======================================================
     Validate
  ======================================================= */

  validateSave(save) {
    if (!save || typeof save !== "object") {
      return {
        valid: false,
        reason: "Save data is empty."
      };
    }

    if (!save.version) {
      return {
        valid: false,
        reason: "Save version is missing."
      };
    }

    if (!save.slot) {
      return {
        valid: false,
        reason: "Save slot is missing."
      };
    }

    return {
      valid: true,
      reason: null
    };
  }

  /* =======================================================
     Local Save
  ======================================================= */

  saveLocal(save) {
    if (!this.config.localEnabled) {
      return {
        success: false,
        skipped: true
      };
    }

    const storage = safeStorage();

    if (!storage) {
      return {
        success: false,
        error: "Local storage is unavailable."
      };
    }

    try {
      const key = getLocalStorageKey(save.slot);

      storage.setItem(
        key,
        JSON.stringify(save)
      );

      return {
        success: true,
        type: SAVE_TYPES.LOCAL
      };
    } catch (error) {
      console.error("[SaveManager] Local save failed:", error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /* =======================================================
     Local Load
  ======================================================= */

  loadLocal(slot = this.currentSlot) {
    if (!this.config.localEnabled) {
      return null;
    }

    const storage = safeStorage();

    if (!storage) {
      return null;
    }

    try {
      const key = getLocalStorageKey(slot);
      const raw = storage.getItem(key);

      if (!raw) {
        return null;
      }

      const save = JSON.parse(raw);

      const validation = this.validateSave(save);

      if (!validation.valid) {
        console.warn(
          "[SaveManager] Invalid local save:",
          validation.reason
        );

        return null;
      }

      return save;
    } catch (error) {
      console.error("[SaveManager] Local load failed:", error);
      return null;
    }
  }

  /* =======================================================
     Cloud Save
  ======================================================= */

  async saveCloud(save) {
    if (!this.config.cloudEnabled) {
      return {
        success: false,
        skipped: true
      };
    }

    if (
      !cloudSaveManager ||
      typeof cloudSaveManager.save !== "function"
    ) {
      return {
        success: false,
        skipped: true,
        error: "CloudSaveManager is unavailable."
      };
    }

    try {
      const result = await cloudSaveManager.save(save);

      return {
        success: true,
        type: SAVE_TYPES.CLOUD,
        result
      };
    } catch (error) {
      console.warn(
        "[SaveManager] Cloud save failed:",
        error
      );

      return {
        success: false,
        error: error.message
      };
    }
  }

  /* =======================================================
     Cloud Load
  ======================================================= */

  async loadCloud(slot = this.currentSlot) {
    if (!this.config.cloudEnabled) {
      return null;
    }

    if (
      !cloudSaveManager ||
      typeof cloudSaveManager.load !== "function"
    ) {
      return null;
    }

    try {
      const result =
        await cloudSaveManager.load(slot);

      if (!result) {
        return null;
      }

      return result;
    } catch (error) {
      console.warn(
        "[SaveManager] Cloud load failed:",
        error
      );

      return null;
    }
  }

  /* =======================================================
     Apply Save
  ======================================================= */

  applySave(save) {
    const validation = this.validateSave(save);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const state = gameState.snapshot();

    const restored = clone(state);

    restored.player = {
      ...restored.player,
      ...clone(save.player)
    };

    restored.world = {
      ...restored.world,
      ...clone(save.world)
    };

    restored.mission = {
      ...restored.mission,
      progress: clone(save.missions)
    };

    restored.inventory = {
      ...restored.inventory,
      ...clone(save.inventory)
    };

    restored.statistics = {
      ...restored.statistics,
      ...clone(save.statistics)
    };

    if (save.settings) {
      restored.ui = {
        ...restored.ui,
        settings: clone(save.settings)
      };
    }

    gameState.restore(restored);

    this.emit("applied", {
      save
    });

    return true;
  }

  /* =======================================================
     Save
  ======================================================= */

  async save(options = {}) {
    const slot = options.slot || this.currentSlot;

    const type =
      options.type ||
      SAVE_TYPES.MANUAL;

    this.setSlot(slot);

    this.status = SAVE_STATUS.SAVING;

    this.emit("saving", {
      slot,
      type
    });

    try {
      const save = this.collectSaveData(slot);

      const validation = this.validateSave(save);

      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      const localResult =
        this.saveLocal(save);

      let cloudResult = {
        success: false,
        skipped: true
      };

      if (options.cloud !== false) {
        cloudResult =
          await this.saveCloud(save);
      }

      const success =
        localResult.success ||
        cloudResult.success ||
        localResult.skipped && cloudResult.skipped;

      this.lastSave = {
        save,
        local: localResult,
        cloud: cloudResult,
        type,
        timestamp: Date.now()
      };

      this.status = success
        ? SAVE_STATUS.SUCCESS
        : SAVE_STATUS.ERROR;

      this.emit(
        success ? "saved" : "saveError",
        {
          save,
          local: localResult,
          cloud: cloudResult,
          type
        }
      );

      return {
        success,
        save,
        local: localResult,
        cloud: cloudResult
      };
    } catch (error) {
      this.status = SAVE_STATUS.ERROR;

      this.emit("saveError", {
        error,
        slot,
        type
      });

      return {
        success: false,
        error
      };
    }
  }

  /* =======================================================
     Load
  ======================================================= */

  async load(options = {}) {
    const slot =
      options.slot ||
      this.currentSlot;

    this.setSlot(slot);

    this.status = SAVE_STATUS.LOADING;

    this.emit("loading", {
      slot
    });

    try {
      let save = null;

      /*
       * Cloud first when enabled.
       */
      if (options.cloud !== false) {
        save = await this.loadCloud(slot);
      }

      /*
       * Local fallback.
       */
      if (!save && options.local !== false) {
        save = this.loadLocal(slot);
      }

      /*
       * No save found.
       */
      if (!save) {
        this.status = SAVE_STATUS.IDLE;

        this.emit("noSave", {
          slot
        });

        return {
          success: false,
          found: false,
          slot
        };
      }

      const validation =
        this.validateSave(save);

      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      this.applySave(save);

      this.lastLoad = {
        save,
        timestamp: Date.now()
      };

      this.status = SAVE_STATUS.SUCCESS;

      this.emit("loaded", {
        save,
        slot
      });

      return {
        success: true,
        found: true,
        save
      };
    } catch (error) {
      this.status = SAVE_STATUS.ERROR;

      this.emit("loadError", {
        error,
        slot
      });

      return {
        success: false,
        error
      };
    }
  }

  /* =======================================================
     Quick Save
  ======================================================= */

  async quickSave() {
    return this.save({
      type: SAVE_TYPES.MANUAL
    });
  }

  /* =======================================================
     Checkpoint
  ======================================================= */

  async checkpoint() {
    return this.save({
      type: SAVE_TYPES.CHECKPOINT
    });
  }

  /* =======================================================
     Auto Save
  ======================================================= */

  startAutosave() {
    this.stopAutosave();

    if (!this.config.autosaveEnabled) {
      return false;
    }

    this.autosaveTimer = setInterval(
      () => {
        this.save({
          type: SAVE_TYPES.AUTO
        }).catch((error) => {
          console.warn(
            "[SaveManager] Autosave failed:",
            error
          );
        });
      },
      this.config.autosaveInterval
    );

    this.emit("autosaveStarted", {
      interval: this.config.autosaveInterval
    });

    return true;
  }

  stopAutosave() {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    this.emit("autosaveStopped");

    return true;
  }

  isAutosaveRunning() {
    return Boolean(this.autosaveTimer);
  }

  /* =======================================================
     Delete Local Save
  ======================================================= */

  deleteLocal(slot = this.currentSlot) {
    const storage = safeStorage();

    if (!storage) {
      return false;
    }

    try {
      storage.removeItem(
        getLocalStorageKey(slot)
      );

      this.emit("localDeleted", {
        slot
      });

      return true;
    } catch (error) {
      console.error(
        "[SaveManager] Delete local save failed:",
        error
      );

      return false;
    }
  }

  /* =======================================================
     Delete Cloud Save
  ======================================================= */

  async deleteCloud(slot = this.currentSlot) {
    if (
      !cloudSaveManager ||
      typeof cloudSaveManager.delete !== "function"
    ) {
      return false;
    }

    try {
      await cloudSaveManager.delete(slot);

      this.emit("cloudDeleted", {
        slot
      });

      return true;
    } catch (error) {
      console.warn(
        "[SaveManager] Delete cloud save failed:",
        error
      );

      return false;
    }
  }

  /* =======================================================
     Delete Save
  ======================================================= */

  async deleteSave(slot = this.currentSlot) {
    const local = this.deleteLocal(slot);

    const cloud =
      await this.deleteCloud(slot);

    return {
      local,
      cloud,
      success: local || cloud
    };
  }

  /* =======================================================
     Save Exists
  ======================================================= */

  async exists(slot = this.currentSlot) {
    const local = Boolean(
      this.loadLocal(slot)
    );

    if (local) {
      return true;
    }

    const cloud =
      await this.loadCloud(slot);

    return Boolean(cloud);
  }

  /* =======================================================
     Get Last Save
  ======================================================= */

  getLastSave() {
    return clone(this.lastSave);
  }

  getLastLoad() {
    return clone(this.lastLoad);
  }

  getStatus() {
    return this.status;
  }

  /* =======================================================
     Snapshot
  ======================================================= */

  snapshot() {
    return {
      initialized: this.initialized,
      currentSlot: this.currentSlot,
      status: this.status,
      autosaveRunning: this.isAutosaveRunning(),
      autosaveInterval: this.config.autosaveInterval,
      lastSave: this.lastSave
        ? {
            type: this.lastSave.type,
            timestamp: this.lastSave.timestamp
          }
        : null,
      lastLoad: this.lastLoad
        ? {
            timestamp: this.lastLoad.timestamp
          }
        : null
    };
  }

  debug() {
    return {
      ...this.snapshot(),
      config: clone(this.config),
      availableSlots:
        this.getAvailableSlots()
    };
  }

  /* =======================================================
     Dispose
  ======================================================= */

  dispose() {
    this.stopAutosave();

    this.listeners.clear();

    this.lastSave = null;
    this.lastLoad = null;

    this.initialized = false;
    this.status = SAVE_STATUS.IDLE;
  }
}

/* =========================================================
   Singleton
========================================================= */

export const saveManager =
  new SaveManager();

/* =========================================================
   Convenience Functions
========================================================= */

export function initializeSaveManager(options) {
  return saveManager.initialize(options);
}

export function saveGame(options) {
  return saveManager.save(options);
}

export function loadGame(options) {
  return saveManager.load(options);
}

export function quickSaveGame() {
  return saveManager.quickSave();
}

export function checkpointGame() {
  return saveManager.checkpoint();
}

export function startAutosave() {
  return saveManager.startAutosave();
}

export function stopAutosave() {
  return saveManager.stopAutosave();
}

export function deleteSave(slot) {
  return saveManager.deleteSave(slot);
}

export function setSaveSlot(slot) {
  return saveManager.setSlot(slot);
}

export default saveManager;
