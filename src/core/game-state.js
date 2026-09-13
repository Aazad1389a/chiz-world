// ============================================================
// AZAD WORLD
// CENTRAL GAME STATE
// ============================================================
//
// This module keeps the important runtime state of the game
// in one place.
//
// It does NOT contain gameplay logic.
// Other systems can read and update the state through the
// methods provided below.
// ============================================================

import { GAME_CONFIG } from "../config/game-config.js";

// ------------------------------------------------------------
// DEFAULT STATE
// ------------------------------------------------------------

const DEFAULT_STATE = {
  // ----------------------------------------------------------
  // APPLICATION
  // ----------------------------------------------------------

  app: {
    initialized: false,
    loading: true,
    running: false,
    paused: false,

    screen: "loading",

    version: GAME_CONFIG.identity.version
  },

  // ----------------------------------------------------------
  // CONNECTION
  // ----------------------------------------------------------

  connection: {
    online: false,
    connected: false,

    connecting: false,
    reconnecting: false,

    roomId: null,

    ping: 0,

    connectionAttempts: 0,

    lastConnectedAt: null,
    lastDisconnectedAt: null,

    error: null
  },

  // ----------------------------------------------------------
  // PLAYER
  // ----------------------------------------------------------

  player: {
    id: null,

    username: null,
    displayName: null,

    level: 1,
    experience: 0,

    health: GAME_CONFIG.player.maxHealth,
    maxHealth: GAME_CONFIG.player.maxHealth,

    stamina: GAME_CONFIG.player.maxStamina,
    maxStamina: GAME_CONFIG.player.maxStamina,

    coins: 0,

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

    velocity: {
      x: 0,
      y: 0,
      z: 0
    },

    grounded: true,

    alive: true,

    sprinting: false,

    platform: "unknown"
  },

  // ----------------------------------------------------------
  // WORLD
  // ----------------------------------------------------------

  world: {
    id: "main-world",

    loaded: false,

    loading: false,

    chunkX: 0,
    chunkZ: 0,

    timeOfDay: 12,

    weather: "clear",

    season: "summer",

    worldEvent: null
  },

  // ----------------------------------------------------------
  // MISSION
  // ----------------------------------------------------------

  mission: {
    activeMissionId: null,

    completedMissions: [],

    trackedMissionId: null,

    progress: {},

    objective: null
  },

  // ----------------------------------------------------------
  // INVENTORY
  // ----------------------------------------------------------

  inventory: {
    items: [],

    equippedWeapon: null,

    equippedArmor: null,

    selectedSlot: 0,

    capacity: 40
  },

  // ----------------------------------------------------------
  // MULTIPLAYER
  // ----------------------------------------------------------

  multiplayer: {
    enabled: GAME_CONFIG.modes.multiplayer,

    roomId: null,

    playerCount: 0,

    players: {},

    localPlayerReady: false,

    synchronized: false
  },

  // ----------------------------------------------------------
  // SOCIAL
  // ----------------------------------------------------------

  social: {
    friends: [],

    partyId: null,

    partyMembers: [],

    unreadMessages: 0
  },

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  ui: {
    menuOpen: true,

    pauseOpen: false,

    settingsOpen: false,

    inventoryOpen: false,

    mapOpen: false,

    missionOpen: false,

    profileOpen: false,

    leaderboardOpen: false,

    chatOpen: false,

    notification: null
  },

  // ----------------------------------------------------------
  // INPUT
  // ----------------------------------------------------------

  input: {
    forward: false,
    backward: false,

    left: false,
    right: false,

    jump: false,
    sprint: false,

    action: false,

    interact: false,

    mouseLocked: false
  },

  // ----------------------------------------------------------
  // GRAPHICS
  // ----------------------------------------------------------

  graphics: {
    quality: GAME_CONFIG.graphics.defaultQuality,

    fps: 0,

    pixelRatio: 1,

    dynamicResolution: GAME_CONFIG.graphics.dynamicResolution,

    shadows: GAME_CONFIG.graphics.shadows,

    postProcessing: GAME_CONFIG.graphics.postProcessing
  },

  // ----------------------------------------------------------
  // AUDIO
  // ----------------------------------------------------------

  audio: {
    muted: false,

    masterVolume: GAME_CONFIG.audio.masterVolume,

    musicVolume: GAME_CONFIG.audio.musicVolume,

    effectsVolume: GAME_CONFIG.audio.effectsVolume,

    voiceVolume: GAME_CONFIG.audio.voiceVolume
  },

  // ----------------------------------------------------------
  // SAVE
  // ----------------------------------------------------------

  save: {
    dirty: false,

    saving: false,

    loading: false,

    lastSavedAt: null,

    lastLoadedAt: null,

    error: null
  },

  // ----------------------------------------------------------
  // STATISTICS
  // ----------------------------------------------------------

  statistics: {
    playTime: 0,

    distanceTravelled: 0,

    missionsCompleted: 0,

    enemiesDefeated: 0,

    locationsDiscovered: 0,

    itemsCollected: 0,

    multiplayerSessions: 0
  }
};

// ------------------------------------------------------------
// DEEP CLONE
// ------------------------------------------------------------
//
// The previous implementation used:
//
// JSON.parse(JSON.stringify(value))
//
// That crashes when value is undefined because:
// JSON.stringify(undefined) === undefined
//
// This implementation safely handles:
// - undefined
// - null
// - primitive values
// - arrays
// - plain objects
// - structuredClone-capable browsers
// ------------------------------------------------------------

function clone(value) {
  // undefined and null are valid state values.
  if (value === undefined || value === null) {
    return value;
  }

  // Primitive values do not need cloning.
  if (typeof value !== "object") {
    return value;
  }

  // Use native structuredClone when available.
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall back to the recursive clone below.
    }
  }

  // Arrays.
  if (Array.isArray(value)) {
    return value.map((item) => clone(item));
  }

  // Plain objects.
  const result = {};

  for (const [key, item] of Object.entries(value)) {
    result[key] = clone(item);
  }

  return result;
}

// ------------------------------------------------------------
// DEEP MERGE
// ------------------------------------------------------------

function mergeDeep(target, source) {
  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
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

// ------------------------------------------------------------
// GAME STATE CLASS
// ------------------------------------------------------------

export class GameState {
  constructor(initialState = {}) {
    this.state = clone(DEFAULT_STATE);

    this.listeners = new Map();

    this.changeQueue = [];

    this.version = 0;

    if (
      initialState &&
      typeof initialState === "object"
    ) {
      mergeDeep(
        this.state,
        clone(initialState)
      );
    }
  }

  // ----------------------------------------------------------
  // GET
  // ----------------------------------------------------------

  get(path = null, fallback = null) {
    if (!path) {
      return clone(this.state);
    }

    const parts = path.split(".");

    let current = this.state;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        !(part in current)
      ) {
        return fallback;
      }

      current = current[part];
    }

    return clone(current);
  }

  // ----------------------------------------------------------
  // SET
  // ----------------------------------------------------------

  set(path, value, options = {}) {
    if (
      !path ||
      typeof path !== "string"
    ) {
      return false;
    }

    const parts = path.split(".");

    let current = this.state;

    for (
      let i = 0;
      i < parts.length - 1;
      i++
    ) {
      const part = parts[i];

      if (
        !current[part] ||
        typeof current[part] !== "object" ||
        Array.isArray(current[part])
      ) {
        current[part] = {};
      }

      current = current[part];
    }

    const finalKey =
      parts[parts.length - 1];

    const previousValue =
      clone(current[finalKey]);

    const nextValue =
      clone(value);

    current[finalKey] = nextValue;

    this.version++;

    const change = {
      path,

      previousValue,

      value: clone(nextValue),

      version: this.version,

      timestamp: Date.now()
    };

    this.changeQueue.push(change);

    if (this.changeQueue.length > 100) {
      this.changeQueue.shift();
    }

    if (!options.silent) {
      this.emit(path, change);
      this.emit("*", change);
    }

    return true;
  }

  // ----------------------------------------------------------
  // UPDATE OBJECT
  // ----------------------------------------------------------

  update(path, values, options = {}) {
    if (
      values === undefined ||
      values === null
    ) {
      return this.set(
        path,
        values,
        options
      );
    }

    const current =
      this.get(path, {});

    if (
      !current ||
      typeof current !== "object" ||
      Array.isArray(current)
    ) {
      return this.set(
        path,
        values,
        options
      );
    }

    if (
      typeof values !== "object" ||
      Array.isArray(values)
    ) {
      return this.set(
        path,
        values,
        options
      );
    }

    const updated = {
      ...current,
      ...clone(values)
    };

    return this.set(
      path,
      updated,
      options
    );
  }

  // ----------------------------------------------------------
  // RESET
  // ----------------------------------------------------------

  reset(options = {}) {
    const previous =
      clone(this.state);

    this.state =
      clone(DEFAULT_STATE);

    this.version++;

    const change = {
      path: "*",

      previousValue: previous,

      value: clone(this.state),

      version: this.version,

      timestamp: Date.now()
    };

    this.changeQueue.push(change);

    if (!options.silent) {
      this.emit("*", change);
    }

    return true;
  }

  // ----------------------------------------------------------
  // SUBSCRIBE
  // ----------------------------------------------------------

  subscribe(path, callback) {
    if (
      typeof callback !== "function"
    ) {
      return () => {};
    }

    if (!this.listeners.has(path)) {
      this.listeners.set(
        path,
        new Set()
      );
    }

    const listeners =
      this.listeners.get(path);

    listeners.add(callback);

    return () => {
      listeners.delete(callback);

      if (listeners.size === 0) {
        this.listeners.delete(path);
      }
    };
  }

  // ----------------------------------------------------------
  // EMIT
  // ----------------------------------------------------------

  emit(path, change) {
    const listeners =
      this.listeners.get(path);

    if (!listeners) {
      return;
    }

    for (const callback of listeners) {
      try {
        callback(change);
      } catch (error) {
        console.error(
          `[GameState] Listener error for "${path}"`,
          error
        );
      }
    }
  }

  // ----------------------------------------------------------
  // PLAYER HELPERS
  // ----------------------------------------------------------

  setPlayerPosition(x, y, z) {
    this.update(
      "player.position",
      {
        x,
        y,
        z
      }
    );
  }

  getPlayerPosition() {
    return this.get(
      "player.position"
    );
  }

  setPlayerHealth(health) {
    const maxHealth =
      this.get(
        "player.maxHealth",
        GAME_CONFIG.player.maxHealth
      );

    this.set(
      "player.health",
      Math.max(
        0,
        Math.min(
          health,
          maxHealth
        )
      )
    );
  }

  setPlayerStamina(stamina) {
    const maxStamina =
      this.get(
        "player.maxStamina",
        GAME_CONFIG.player.maxStamina
      );

    this.set(
      "player.stamina",
      Math.max(
        0,
        Math.min(
          stamina,
          maxStamina
        )
      )
    );
  }

  addCoins(amount) {
    const coins =
      this.get(
        "player.coins",
        0
      );

    this.set(
      "player.coins",
      Math.max(
        0,
        coins + amount
      )
    );
  }

  addExperience(amount) {
    const experience =
      this.get(
        "player.experience",
        0
      );

    this.set(
      "player.experience",
      Math.max(
        0,
        experience + amount
      )
    );
  }

  // ----------------------------------------------------------
  // CONNECTION HELPERS
  // ----------------------------------------------------------

  setConnectionStatus(
    status = {}
  ) {
    this.update(
      "connection",
      status
    );
  }

  setOnline(online) {
    this.set(
      "connection.online",
      Boolean(online)
    );
  }

  setPing(ping) {
    this.set(
      "connection.ping",
      Math.max(
        0,
        Number(ping) || 0
      )
    );
  }

  // ----------------------------------------------------------
  // WORLD HELPERS
  // ----------------------------------------------------------

  setWorldTime(hours) {
    let time =
      Number(hours) || 0;

    time %= 24;

    if (time < 0) {
      time += 24;
    }

    this.set(
      "world.timeOfDay",
      time
    );
  }

  setWeather(weather) {
    this.set(
      "world.weather",
      weather
    );
  }

  setWorldEvent(event) {
    this.set(
      "world.worldEvent",
      event
    );
  }

  // ----------------------------------------------------------
  // UI HELPERS
  // ----------------------------------------------------------

  openMenu() {
    this.update(
      "ui",
      {
        menuOpen: true,
        pauseOpen: false
      }
    );
  }

  closeMenu() {
    this.set(
      "ui.menuOpen",
      false
    );
  }

  openPause() {
    this.update(
      "ui",
      {
        pauseOpen: true,
        menuOpen: false
      }
    );

    this.set(
      "app.paused",
      true
    );
  }

  closePause() {
    this.set(
      "ui.pauseOpen",
      false
    );

    this.set(
      "app.paused",
      false
    );
  }

  togglePause() {
    const paused =
      this.get(
        "app.paused",
        false
      );

    if (paused) {
      this.closePause();
    } else {
      this.openPause();
    }
  }

  // ----------------------------------------------------------
  // SAVE HELPERS
  // ----------------------------------------------------------

  markDirty() {
    this.set(
      "save.dirty",
      true
    );
  }

  markSaved() {
    this.update(
      "save",
      {
        dirty: false,

        saving: false,

        lastSavedAt: Date.now(),

        error: null
      }
    );
  }

  markSaveError(error) {
    this.update(
      "save",
      {
        saving: false,

        error:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );
  }

  // ----------------------------------------------------------
  // SNAPSHOT
  // ----------------------------------------------------------

  createSnapshot() {
    return {
      version: this.version,

      timestamp: Date.now(),

      state: clone(this.state)
    };
  }

  restoreSnapshot(
    snapshot,
    options = {}
  ) {
    if (
      !snapshot ||
      typeof snapshot !== "object"
    ) {
      return false;
    }

    if (!snapshot.state) {
      return false;
    }

    this.state =
      clone(snapshot.state);

    this.version++;

    if (!options.silent) {
      this.emit(
        "*",
        {
          path: "*",

          previousValue: null,

          value: clone(
            this.state
          ),

          version: this.version,

          timestamp: Date.now(),

          restored: true
        }
      );
    }

    return true;
  }

  // ----------------------------------------------------------
  // CHANGE HISTORY
  // ----------------------------------------------------------

  getRecentChanges(
    limit = 20
  ) {
    return this.changeQueue
      .slice(
        -Math.max(1, limit)
      )
      .map((change) =>
        clone(change)
      );
  }

  clearChangeHistory() {
    this.changeQueue.length = 0;
  }

  // ----------------------------------------------------------
  // VERSION
  // ----------------------------------------------------------

  getVersion() {
    return this.version;
  }

  // ----------------------------------------------------------
  // DEBUG
  // ----------------------------------------------------------

  getDebugInfo() {
    return {
      version: this.version,

      app: this.get("app"),

      connection:
        this.get(
          "connection"
        ),

      player: {
        id: this.get(
          "player.id"
        ),

        level: this.get(
          "player.level"
        ),

        health: this.get(
          "player.health"
        ),

        stamina: this.get(
          "player.stamina"
        ),

        position:
          this.get(
            "player.position"
          )
      },

      world:
        this.get("world"),

      multiplayer: {
        roomId:
          this.get(
            "multiplayer.roomId"
          ),

        playerCount:
          this.get(
            "multiplayer.playerCount"
          )
      },

      save:
        this.get("save")
    };
  }

  // ----------------------------------------------------------
  // DISPOSE
  // ----------------------------------------------------------

  dispose() {
    this.listeners.clear();

    this.changeQueue.length = 0;

    this.state =
      clone(DEFAULT_STATE);

    this.version = 0;
  }
}

// ============================================================
// SINGLETON
// ============================================================

export const gameState =
  new GameState();

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

export function getGameState(
  path = null,
  fallback = null
) {
  return gameState.get(
    path,
    fallback
  );
}

export function setGameState(
  path,
  value,
  options = {}
) {
  return gameState.set(
    path,
    value,
    options
  );
}

export function updateGameState(
  path,
  values,
  options = {}
) {
  return gameState.update(
    path,
    values,
    options
  );
}

export function subscribeGameState(
  path,
  callback
) {
  return gameState.subscribe(
    path,
    callback
  );
}

export function resetGameState(
  options = {}
) {
  return gameState.reset(
    options
  );
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default gameState;
