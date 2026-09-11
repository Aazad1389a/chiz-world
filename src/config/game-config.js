// ============================================================
// AZAD WORLD
// GAME CONFIGURATION
// ============================================================

import GAME_GOALS from "./game-goals.js";

// ------------------------------------------------------------
// GAME IDENTITY
// ------------------------------------------------------------

export const GAME_CONFIG = {
  identity: {
    id: "azad-world",
    name: "AZAD WORLD",
    shortName: "AZAD",
    version: "1.0.0",

    developer: "AZAD WORLD",
    environment: "production",

    language: "fa-IR",
    supportedLanguages: [
      "fa-IR",
      "en-US"
    ]
  },

  // ----------------------------------------------------------
  // PLATFORM
  // ----------------------------------------------------------

  platform: {
    browser: true,

    desktop: true,
    mobile: true,

    pc: true,
    android: true,

    ios: false,

    desktopBrowser: true,
    mobileBrowser: true,

    fullscreen: true,
    landscapePreferred: true
  },

  // ----------------------------------------------------------
  // GAME MODES
  // ----------------------------------------------------------

  modes: {
    singlePlayer: true,
    multiplayer: true,

    cooperative: true,
    competitive: true,

    openWorld: true,

    onlineWorld: true,

    offlineFallback: true
  },

  // ----------------------------------------------------------
  // NETWORK
  // ----------------------------------------------------------

  network: {
    enabled: true,

    onlineRequired: false,

    realtime: true,

    interpolation: true,
    clientPrediction: true,

    stateSynchronization: true,

    reconnect: true,
    autoReconnect: true,

    reconnectAttempts: 8,

    connectionTimeout: 10000,

    heartbeatInterval: 15000,

    playerUpdateRate: 15,

    maxPlayersPerRoom: 32,

    maxPlayersVisible: 64,

    region: "auto",

    regions: [
      "auto",
      "middle-east",
      "europe",
      "asia"
    ]
  },

  // ----------------------------------------------------------
  // WORLD
  // ----------------------------------------------------------

  world: {
    enabled: true,

    openWorld: true,

    worldSize: 10000,

    chunkSize: 256,

    streaming: true,

    dynamicLoading: true,

    unloadDistance: 1500,

    preloadDistance: 1000,

    simulationDistance: 500,

    maxActiveNPCs: 150,

    maxVisiblePlayers: 32,

    persistentWorld: true
  },

  // ----------------------------------------------------------
  // PLAYER
  // ----------------------------------------------------------

  player: {
    enabled: true,

    height: 1.8,

    radius: 0.35,

    walkSpeed: 5,

    runSpeed: 8,

    sprintSpeed: 11,

    acceleration: 25,

    deceleration: 18,

    jumpForce: 7,

    gravity: 20,

    maxHealth: 100,

    maxStamina: 100,

    staminaDrain: 20,

    staminaRecovery: 15,

    respawnDelay: 5
  },

  // ----------------------------------------------------------
  // CAMERA
  // ----------------------------------------------------------

  camera: {
    enabled: true,

    perspective: true,

    fov: 75,

    near: 0.05,

    far: 5000,

    firstPerson: true,
    thirdPerson: true,

    defaultMode: "third-person",

    smoothMovement: true,

    cameraSmoothing: 8,

    mouseSensitivity: 1,

    touchSensitivity: 1
  },

  // ----------------------------------------------------------
  // GRAPHICS
  // ----------------------------------------------------------

  graphics: {
    enabled: true,

    defaultQuality: "high",

    availableQuality: [
      "low",
      "medium",
      "high",
      "ultra"
    ],

    autoQuality: true,

    maxPixelRatio: 2,

    antialias: true,

    shadows: true,

    shadowQuality: "high",

    physicallyCorrectLights: true,

    toneMapping: true,

    exposure: 1.1,

    colorManagement: true,

    hdr: true,

    pbr: true,

    postProcessing: true,

    ambientOcclusion: true,

    bloom: true,

    fog: true,

    reflections: true,

    waterReflections: true,

    vegetation: true,

    particles: true
  },

  // ----------------------------------------------------------
  // ASSETS
  // ----------------------------------------------------------

  assets: {
    enabled: true,

    basePath: "./assets/",

    modelsPath: "./assets/models/",
    texturesPath: "./assets/textures/",
    hdrPath: "./assets/hdr/",
    audioPath: "./assets/audio/",
    animationsPath: "./assets/animations/",

    format: "glb",

    gltf: true,

    draco: true,
    meshopt: true,
    ktx2: true,

    textureCompression: true,

    cache: true,

    preload: true,

    streaming: true,

    progressiveLoading: true,

    maxConcurrentLoads: 4
  },

  // ----------------------------------------------------------
  // AUDIO
  // ----------------------------------------------------------

  audio: {
    enabled: true,

    masterVolume: 1,
    musicVolume: 0.8,
    effectsVolume: 1,
    ambientVolume: 0.8,
    voiceVolume: 1,

    positionalAudio: true,

    music: true,
    effects: true,
    ambient: true,
    voice: true,

    dynamicMusic: true,

    preload: false
  },

  // ----------------------------------------------------------
  // PHYSICS
  // ----------------------------------------------------------

  physics: {
    enabled: true,

    gravity: -20,

    fixedTimeStep: 1 / 60,

    maxSubSteps: 4,

    collisionDetection: true,

    playerCollision: true,

    worldCollision: true,

    vehicleCollision: true,

    npcCollision: true
  },

  // ----------------------------------------------------------
  // GAMEPLAY
  // ----------------------------------------------------------

  gameplay: {
    enabled: true,

    pauseAllowed: true,

    autosave: true,

    autosaveInterval: 60000,

    checkpoints: true,

    respawn: true,

    fastTravel: true,

    interactionDistance: 3,

    missionTracking: true,

    dynamicEvents: true
  },

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  ui: {
    enabled: true,

    hud: true,

    minimap: true,

    worldMap: true,

    inventory: true,

    missions: true,

    profile: true,

    friends: true,

    leaderboard: true,

    settings: true,

    notifications: true,

    loadingScreen: true,

    pauseMenu: true,

    mobileControls: true
  },

  // ----------------------------------------------------------
  // MOBILE
  // ----------------------------------------------------------

  mobile: {
    enabled: true,

    touchControls: true,

    virtualJoystick: true,

    actionButtons: true,

    vibration: true,

    adaptiveQuality: true,

    dynamicResolution: true,

    batteryOptimization: true,

    reducedEffectsOnLowEnd: true,

    maxPixelRatio: 1.5,

    targetFPS: 60
  },

  // ----------------------------------------------------------
  // PERFORMANCE
  // ----------------------------------------------------------

  performance: {
    enabled: true,

    targetFPS: 60,

    minimumFPS: 30,

    adaptiveQuality: true,

    dynamicResolution: true,

    lod: true,

    frustumCulling: true,

    occlusionCulling: true,

    instancing: true,

    objectPooling: true,

    textureStreaming: true,

    assetStreaming: true,

    memoryOptimization: true,

    garbageCollectionFriendly: true
  },

  // ----------------------------------------------------------
  // SAVE
  // ----------------------------------------------------------

  save: {
    enabled: true,

    local: true,
    cloud: true,

    autosave: true,

    autosaveInterval: 60000,

    maxLocalSlots: 3,

    maxCloudSlots: 3,

    compression: true,

    versioning: true,

    backup: true
  },

  // ----------------------------------------------------------
  // SECURITY
  // ----------------------------------------------------------

  security: {
    enabled: true,

    serverValidation: true,

    inputValidation: true,

    databaseRLS: true,

    rateLimiting: true,

    antiCheat: true,

    secureRealtime: true,

    secureStorage: true,

    clientTrust: false,

    authoritativeServerReady: true
  },

  // ----------------------------------------------------------
  // API
  // ----------------------------------------------------------

  api: {
    enabled: true,

    provider: "supabase",

    authentication: true,

    database: true,

    realtime: true,

    storage: true,

    edgeFunctions: true,

    cloudSave: true,

    profiles: true,

    leaderboard: true
  },

  // ----------------------------------------------------------
  // DEVELOPMENT
  // ----------------------------------------------------------

  development: {
    debug: false,

    showFPS: false,

    showPing: true,

    showNetworkStats: false,

    showCollisionDebug: false,

    showPlayerDebug: false,

    showWorldDebug: false,

    verboseLogging: false,

    testMode: false
  },

  // ----------------------------------------------------------
  // FEATURE FLAGS
  // ----------------------------------------------------------

  features: {
    story: true,
    exploration: true,
    missions: true,
    combat: true,

    economy: true,
    inventory: true,
    crafting: true,

    housing: true,
    vehicles: true,

    multiplayer: true,
    social: true,

    competition: true,
    events: true,

    collection: true,
    achievements: true,

    customization: true,

    npc: true,
    worldSimulation: true,

    cloudSave: true,
    account: true,

    map: true,
    fastTravel: true
  }
};

// ============================================================
// CONFIGURATION HELPERS
// ============================================================

/**
 * Check whether a configuration path is enabled.
 *
 * Example:
 * isConfigEnabled("graphics", "hdr")
 */
export function isConfigEnabled(category, feature) {
  return GAME_CONFIG?.[category]?.[feature] === true;
}

/**
 * Get a configuration category.
 */
export function getConfig(category) {
  return GAME_CONFIG?.[category] ?? null;
}

/**
 * Get a configuration value.
 *
 * Example:
 * getConfigValue("graphics", "defaultQuality")
 */
export function getConfigValue(category, key, fallback = null) {
  const value = GAME_CONFIG?.[category]?.[key];

  return value === undefined ? fallback : value;
}

/**
 * Check whether a major game feature is enabled.
 *
 * This connects the general game configuration
 * with the central GAME_GOALS configuration.
 */
export function isGameFeatureEnabled(feature) {
  if (GAME_CONFIG.features?.[feature] === false) {
    return false;
  }

  if (GAME_GOALS?.[feature]?.enabled === false) {
    return false;
  }

  return (
    GAME_CONFIG.features?.[feature] === true ||
    GAME_GOALS?.[feature]?.enabled === true
  );
}

/**
 * Get all currently enabled features.
 */
export function getEnabledFeatures() {
  return Object.keys(GAME_CONFIG.features).filter(
    (feature) => isGameFeatureEnabled(feature)
  );
}

/**
 * Get all currently disabled features.
 */
export function getDisabledFeatures() {
  return Object.keys(GAME_CONFIG.features).filter(
    (feature) => !isGameFeatureEnabled(feature)
  );
}

/**
 * Get a safe copy of the configuration.
 */
export function getGameConfigSnapshot() {
  return JSON.parse(JSON.stringify(GAME_CONFIG));
}

/**
 * Check whether the game is configured for online play.
 */
export function isOnlineGame() {
  return (
    GAME_CONFIG.modes.multiplayer === true &&
    GAME_CONFIG.network.enabled === true
  );
}

/**
 * Check whether mobile support is enabled.
 */
export function isMobileSupported() {
  return GAME_CONFIG.platform.mobile === true;
}

/**
 * Check whether desktop support is enabled.
 */
export function isDesktopSupported() {
  return GAME_CONFIG.platform.desktop === true;
}

/**
 * Get the current graphics quality.
 */
export function getGraphicsQuality() {
  return GAME_CONFIG.graphics.defaultQuality;
}

/**
 * Get the maximum supported pixel ratio.
 */
export function getMaxPixelRatio() {
  return GAME_CONFIG.graphics.maxPixelRatio;
}

/**
 * Get the configured maximum players per room.
 */
export function getMaxPlayersPerRoom() {
  return GAME_CONFIG.network.maxPlayersPerRoom;
}

/**
 * Print a compact configuration summary.
 */
export function getConfigSummary() {
  return {
    game: GAME_CONFIG.identity.name,
    version: GAME_CONFIG.identity.version,

    online: isOnlineGame(),

    multiplayer: GAME_CONFIG.modes.multiplayer,

    openWorld: GAME_CONFIG.modes.openWorld,

    desktop: isDesktopSupported(),
    mobile: isMobileSupported(),

    graphicsQuality: getGraphicsQuality(),

    maxPlayersPerRoom:
      GAME_CONFIG.network.maxPlayersPerRoom,

    enabledFeatures: getEnabledFeatures()
  };
}

// ------------------------------------------------------------
// DEFAULT EXPORT
// ------------------------------------------------------------

export default GAME_CONFIG;
