import { GAME_CONFIG } from "./config/game-config.js";
import { gameState } from "./core/game-state.js";
import { inputManager } from "./core/input-manager.js";

import {
  rendererSystem,
  initializeRenderer
} from "./engine/renderer.js";

import {
  worldSystem,
  initializeWorld
} from "./world/world.js";

import {
  terrainSystem,
  initializeTerrain
} from "./world/terrain.js";

import {
  buildingsSystem,
  initializeBuildings
} from "./world/buildings.js";

import {
  weatherSystem,
  initializeWeather
} from "./world/weather.js";

import {
  player,
  initializePlayer,
  updatePlayer
} from "./player/player.js";

import {
  playerController,
  initializePlayerController,
  updatePlayerController
} from "./player/controller.js";

import {
  playerCamera,
  initializePlayerCamera,
  updatePlayerCamera
} from "./player/camera.js";

import {
  playerAnimation,
  initializePlayerAnimation,
  updatePlayerAnimation
} from "./player/animation.js";

import {
  interactionManager,
  initializeInteraction
} from "./gameplay/interaction.js";

import {
  missionManager,
  initializeMissionManager
} from "./gameplay/missions.js";

import {
  inventoryManager,
  initializeInventoryManager
} from "./gameplay/inventory.js";

import {
  saveManager,
  initializeSaveManager
} from "./gameplay/save.js";

import {
  menuManager,
  initializeMenu
} from "./ui/menu.js";

import {
  hudManager,
  initializeHUD
} from "./ui/hud.js";

import {
  settingsManager,
  initializeSettings
} from "./ui/settings.js";

/* =========================================================
   AZAD WORLD
   Main Application
========================================================= */

const APP_VERSION = "1.0.0";

let initialized = false;
let booted = false;

let gameLoopId = null;

let lastFrameTime = 0;

const systems = [];

/* =========================================================
   Application State
========================================================= */

const app = {
  version: APP_VERSION,

  running: false,

  paused: false,

  loading: true,

  error: null,

  initialized: false
};

/* =========================================================
   Utility
========================================================= */

function log(...args) {
  if (
    GAME_CONFIG.development?.debug
  ) {
    console.log(
      "[AZAD WORLD]",
      ...args
    );
  }
}

function warn(...args) {
  console.warn(
    "[AZAD WORLD]",
    ...args
  );
}

function getElement(id) {
  if (
    typeof document === "undefined"
  ) {
    return null;
  }

  return document.getElementById(id);
}

/* =========================================================
   Loading Screen
========================================================= */

function setLoadingProgress(
  progress,
  message = ""
) {
  const safeProgress = Math.max(
    0,
    Math.min(
      100,
      Number(progress) || 0
    )
  );

  const loading =
    getElement("loading-screen");

  if (!loading) {
    return;
  }

  const bar =
    loading.querySelector(
      "[data-loading-progress]"
    );

  const text =
    loading.querySelector(
      "[data-loading-message]"
    );

  if (bar) {
    bar.style.width =
      `${safeProgress}%`;
  }

  if (text && message) {
    text.textContent = message;
  }
}

function hideLoadingScreen() {
  const loading =
    getElement("loading-screen");

  if (!loading) {
    return;
  }

  loading.hidden = true;
  loading.style.display = "none";
}

function showLoadingScreen(
  message = "در حال بارگذاری..."
) {
  const loading =
    getElement("loading-screen");

  if (!loading) {
    return;
  }

  loading.hidden = false;
  loading.style.display = "";

  const text =
    loading.querySelector(
      "[data-loading-message]"
    );

  if (text) {
    text.textContent =
      message;
  }
}

/* =========================================================
   Error Screen
========================================================= */

function showFatalError(error) {
  const message =
    error?.message ||
    String(error) ||
    "Unknown error";

  app.error = message;
  app.loading = false;

  const screen =
    getElement("error-screen");

  if (screen) {
    screen.hidden = false;
    screen.style.display = "";

    const text =
      screen.querySelector(
        "[data-error-message]"
      );

    if (text) {
      text.textContent =
        message;
    }
  }

  console.error(
    "[AZAD WORLD] Fatal error:",
    error
  );
}

/* =========================================================
   State Initialization
========================================================= */

function initializeGameState() {
  try {
    if (
      typeof gameState.set ===
      "function"
    ) {
      gameState.set(
        "app.version",
        APP_VERSION
      );

      gameState.set(
        "app.initialized",
        true
      );

      gameState.set(
        "app.platform",
        detectPlatform()
      );
    }
  } catch (error) {
    warn(
      "Game state initialization failed.",
      error
    );
  }
}

/* =========================================================
   Platform
========================================================= */

function detectPlatform() {
  if (
    typeof navigator ===
    "undefined"
  ) {
    return "unknown";
  }

  const userAgent =
    navigator.userAgent
      .toLowerCase();

  if (
    /android|iphone|ipad|ipod/
      .test(userAgent)
  ) {
    return "mobile";
  }

  return "desktop";
}

/* =========================================================
   Core Systems
========================================================= */

async function initializeCoreSystems() {
  log(
    "Initializing core systems..."
  );

  setLoadingProgress(
    5,
    "راه‌اندازی موتور بازی..."
  );

  initializeGameState();

  /* -------------------------------------------------------
     Settings
  ------------------------------------------------------- */

  initializeSettings();

  systems.push(
    settingsManager
  );

  setLoadingProgress(
    10,
    "بارگذاری تنظیمات..."
  );

  /* -------------------------------------------------------
     Save
  ------------------------------------------------------- */

  initializeSaveManager();

  systems.push(
    saveManager
  );

  setLoadingProgress(
    15,
    "راه‌اندازی سیستم ذخیره..."
  );

  /* -------------------------------------------------------
     Input
  ------------------------------------------------------- */

  if (
    typeof inputManager.initialize ===
    "function"
  ) {
    inputManager.initialize();
  }

  systems.push(
    inputManager
  );

  setLoadingProgress(
    20,
    "راه‌اندازی کنترل‌ها..."
  );
}

/* =========================================================
   Renderer
========================================================= */

async function initializeRendering() {
  log(
    "Initializing renderer..."
  );

  const container =
    getElement("game") ||
    document.body;

  initializeRenderer({
    container
  });

  systems.push(
    rendererSystem
  );

  setLoadingProgress(
    30,
    "راه‌اندازی گرافیک..."
  );
}

/* =========================================================
   World
========================================================= */

async function initializeWorldSystems() {
  log(
    "Initializing world systems..."
  );

  initializeWorld();

  systems.push(
    worldSystem
  );

  setLoadingProgress(
    38,
    "ساخت جهان..."
  );

  initializeTerrain();

  systems.push(
    terrainSystem
  );

  setLoadingProgress(
    45,
    "ساخت زمین..."
  );

  initializeBuildings();

  systems.push(
    buildingsSystem
  );

  setLoadingProgress(
    52,
    "ساخت ساختمان‌ها..."
  );

  initializeWeather();

  systems.push(
    weatherSystem
  );

  setLoadingProgress(
    58,
    "راه‌اندازی آب‌وهوا..."
  );
}

/* =========================================================
   Player
========================================================= */

async function initializePlayerSystems() {
  log(
    "Initializing player systems..."
  );

  initializePlayerController();

  systems.push(
    playerController
  );

  setLoadingProgress(
    64,
    "راه‌اندازی بازیکن..."
  );

  initializePlayer();

  systems.push(
    player
  );

  setLoadingProgress(
    68,
    "ساخت مدل بازیکن..."
  );

  initializePlayerCamera();

  systems.push(
    playerCamera
  );

  setLoadingProgress(
    72,
    "راه‌اندازی دوربین..."
  );

  initializePlayerAnimation();

  systems.push(
    playerAnimation
  );

  setLoadingProgress(
    76,
    "راه‌اندازی انیمیشن..."
  );
}

/* =========================================================
   Gameplay
========================================================= */

async function initializeGameplaySystems() {
  log(
    "Initializing gameplay systems..."
  );

  initializeMissionManager();

  systems.push(
    missionManager
  );

  setLoadingProgress(
    80,
    "راه‌اندازی مأموریت‌ها..."
  );

  initializeInventoryManager();

  systems.push(
    inventoryManager
  );

  setLoadingProgress(
    83,
    "راه‌اندازی Inventory..."
  );

  initializeInteraction({
    scene:
      rendererSystem.scene,
    camera:
      playerCamera.camera
  });

  systems.push(
    interactionManager
  );

  setLoadingProgress(
    86,
    "راه‌اندازی تعاملات..."
  );
}

/* =========================================================
   UI
========================================================= */

async function initializeUISystems() {
  log(
    "Initializing UI systems..."
  );

  initializeHUD();

  systems.push(
    hudManager
  );

  setLoadingProgress(
    90,
    "راه‌اندازی HUD..."
  );

  initializeMenu();

  systems.push(
    menuManager
  );

  setLoadingProgress(
    94,
    "راه‌اندازی منوی بازی..."
  );
}

/* =========================================================
   System Connections
========================================================= */

function connectSystems() {
  log(
    "Connecting game systems..."
  );

  /* -------------------------------------------------------
     Menu → Game
  ------------------------------------------------------- */

  menuManager.on(
    "newGameStarted",
    () => {
      startGameplay();
    }
  );

  menuManager.on(
    "gameLoaded",
    () => {
      startGameplay();
    }
  );

  menuManager.on(
    "paused",
    () => {
      pauseGameplay();
    }
  );

  menuManager.on(
    "resumed",
    () => {
      resumeGameplay();
    }
  );

  menuManager.on(
    "exited",
    () => {
      stopGameplay();
    }
  );

  /* -------------------------------------------------------
     Settings → Renderer
  ------------------------------------------------------- */

  settingsManager.on(
    "qualityChanged",
    ({ quality }) => {
      if (
        rendererSystem &&
        typeof rendererSystem.setQuality ===
          "function"
      ) {
        rendererSystem.setQuality(
          quality
        );
      }
    }
  );

  settingsManager.on(
    "renderScaleChanged",
    ({ renderScale }) => {
      if (
        rendererSystem &&
        typeof rendererSystem.setRenderScale ===
          "function"
      ) {
        rendererSystem.setRenderScale(
          renderScale
        );
      }
    }
  );

  settingsManager.on(
    "shadowQualityChanged",
    ({ quality }) => {
      if (
        rendererSystem &&
        typeof rendererSystem.setShadowQuality ===
          "function"
      ) {
        rendererSystem.setShadowQuality(
          quality
        );
      }
    }
  );

  /* -------------------------------------------------------
     Settings → Input
  ------------------------------------------------------- */

  settingsManager.on(
    "controlsChanged",
    ({
      key,
      value
    }) => {
      if (
        inputManager &&
        typeof inputManager.setSettings ===
          "function"
      ) {
        inputManager.setSettings({
          [key]: value
        });
      }
    }
  );

  /* -------------------------------------------------------
     Interaction → HUD
  ------------------------------------------------------- */

  interactionManager.on(
    "targetChanged",
    (target) => {
      if (!target) {
        hudManager.hideInteraction();
        return;
      }

      hudManager.showInteraction(
        target.prompt ||
        target.name ||
        "Interact"
      );
    }
  );

  interactionManager.on(
    "interacted",
    ({ target }) => {
      if (!target) return;

      hudManager.notify(
        target.successMessage ||
        "انجام شد"
      );
    }
  );

  /* -------------------------------------------------------
     Missions → HUD
  ------------------------------------------------------- */

  missionManager.on(
    "started",
    ({ mission }) => {
      if (!mission) return;

      hudManager.notify(
        `ماموریت جدید: ${
          mission.title ||
          mission.name ||
          "Mission"
        }`
      );
    }
  );

  missionManager.on(
    "completed",
    ({ mission }) => {
      if (!mission) return;

      hudManager.notify(
        `ماموریت کامل شد: ${
          mission.title ||
          mission.name ||
          "Mission"
        }`
      );
    }
  );

  /* -------------------------------------------------------
     Save → HUD
  ------------------------------------------------------- */

  saveManager.on(
    "saved",
    () => {
      hudManager.notify(
        "بازی ذخیره شد"
      );
    }
  );

  saveManager.on(
    "saveError",
    () => {
      hudManager.notify(
        "ذخیره بازی ناموفق بود"
      );
    }
  );

  /* -------------------------------------------------------
     Weather → State
  ------------------------------------------------------- */

  weatherSystem.on(
    "weatherChanged",
    ({ weather }) => {
      log(
        "Weather changed:",
        weather
      );
    }
  );
}

/* =========================================================
   Gameplay Start
========================================================= */

function startGameplay() {
  if (app.running) {
    return;
  }

  app.running = true;
  app.paused = false;
  app.loading = false;

  gameState.set(
    "app.running",
    true
  );

  gameState.set(
    "app.paused",
    false
  );

  if (
    typeof rendererSystem.resume ===
    "function"
  ) {
    rendererSystem.resume();
  }

  if (
    typeof inputManager.enable ===
    "function"
  ) {
    inputManager.enable();
  }

  hudManager.show();

  log(
    "Gameplay started."
  );
}

/* =========================================================
   Pause
========================================================= */

function pauseGameplay() {
  if (!app.running) {
    return;
  }

  app.paused = true;

  gameState.set(
    "app.paused",
    true
  );

  if (
    typeof rendererSystem.pause ===
    "function"
  ) {
    rendererSystem.pause();
  }

  if (
    typeof inputManager.disable ===
    "function"
  ) {
    inputManager.disable();
  }

  log(
    "Gameplay paused."
  );
}

/* =========================================================
   Resume
========================================================= */

function resumeGameplay() {
  if (!app.running) {
    return;
  }

  app.paused = false;

  gameState.set(
    "app.paused",
    false
  );

  if (
    typeof rendererSystem.resume ===
    "function"
  ) {
    rendererSystem.resume();
  }

  if (
    typeof inputManager.enable ===
    "function"
  ) {
    inputManager.enable();
  }

  log(
    "Gameplay resumed."
  );
}

/* =========================================================
   Stop Gameplay
========================================================= */

function stopGameplay() {
  app.running = false;
  app.paused = false;

  gameState.set(
    "app.running",
    false
  );

  gameState.set(
    "app.paused",
    false
  );

  if (
    typeof inputManager.disable ===
    "function"
  ) {
    inputManager.disable();
  }

  log(
    "Gameplay stopped."
  );
}

/* =========================================================
   Main Update
========================================================= */

function update(deltaTime) {
  if (!app.running) {
    return;
  }

  if (app.paused) {
    return;
  }

  const dt =
    Math.min(
      Number(deltaTime) || 0,
      0.1
    );

  /* -------------------------------------------------------
     World
  ------------------------------------------------------- */

  if (
    typeof worldSystem.update ===
    "function"
  ) {
    worldSystem.update(
      dt
    );
  }

  if (
    typeof terrainSystem.update ===
    "function"
  ) {
    terrainSystem.update(
      dt
    );
  }

  if (
    typeof buildingsSystem.update ===
    "function"
  ) {
    buildingsSystem.update(
      dt
    );
  }

  if (
    typeof weatherSystem.update ===
    "function"
  ) {
    weatherSystem.update(
      dt
    );
  }

  /* -------------------------------------------------------
     Player
  ------------------------------------------------------- */

  updatePlayerController(
    dt
  );

  updatePlayer(
    dt
  );

  updatePlayerAnimation(
    dt
  );

  updatePlayerCamera(
    dt
  );

  /* -------------------------------------------------------
     Gameplay
  ------------------------------------------------------- */

  if (
    typeof missionManager.update ===
    "function"
  ) {
    missionManager.update(
      dt
    );
  }

  if (
    typeof interactionManager.update ===
    "function"
  ) {
    interactionManager.update(
      dt
    );
  }
}

/* =========================================================
   Application Loop
========================================================= */

function applicationLoop(
  timestamp
) {
  if (!lastFrameTime) {
    lastFrameTime =
      timestamp;
  }

  const delta =
    (timestamp -
      lastFrameTime) /
    1000;

  lastFrameTime =
    timestamp;

  update(delta);

  gameLoopId =
    requestAnimationFrame(
      applicationLoop
    );
}

/* =========================================================
   Start Main Loop
========================================================= */

function startMainLoop() {
  if (gameLoopId) {
    return;
  }

  lastFrameTime = 0;

  gameLoopId =
    requestAnimationFrame(
      applicationLoop
    );
}

/* =========================================================
   Stop Main Loop
========================================================= */

function stopMainLoop() {
  if (!gameLoopId) {
    return;
  }

  cancelAnimationFrame(
    gameLoopId
  );

  gameLoopId = null;
}

/* =========================================================
   Bootstrap
========================================================= */

async function bootstrap() {
  if (booted) {
    return;
  }

  booted = true;

  showLoadingScreen(
    "در حال راه‌اندازی AZAD WORLD..."
  );

  try {
    await initializeCoreSystems();

    await initializeRendering();

    await initializeWorldSystems();

    await initializePlayerSystems();

    await initializeGameplaySystems();

    await initializeUISystems();

    connectSystems();

    /* -----------------------------------------------------
       Final State
    ----------------------------------------------------- */

    initialized = true;

    app.initialized = true;
    app.loading = false;

    gameState.set(
      "app.initialized",
      true
    );

    gameState.set(
      "app.loading",
      false
    );

    setLoadingProgress(
      100,
      "آماده ورود به بازی"
    );

    startMainLoop();

    /*
     * Renderer owns the actual WebGL
     * render loop. Our loop handles
     * gameplay systems.
     */
    if (
      typeof rendererSystem.start ===
      "function"
    ) {
      rendererSystem.start();
    }

    hideLoadingScreen();

    /*
     * Show the main menu.
     */
    menuManager.setState(
      "main"
    );

    /*
     * Start autosave only after
     * initialization is complete.
     */
    saveManager.startAutosave();

    /*
     * Refresh Continue button.
     */
    menuManager.updateContinueButton();

    log(
      "AZAD WORLD initialized successfully."
    );
  } catch (error) {
    showFatalError(error);
  }
}

/* =========================================================
   Global Error Handling
========================================================= */

if (
  typeof window !== "undefined"
) {
  window.addEventListener(
    "error",
    (event) => {
      console.error(
        "[AZAD WORLD] Window error:",
        event.error
      );
    }
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      console.error(
        "[AZAD WORLD] Unhandled promise rejection:",
        event.reason
      );
    }
  );
}

/* =========================================================
   Page Visibility
========================================================= */

if (
  typeof document !== "undefined"
) {
  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.hidden &&
        app.running &&
        !app.paused
      ) {
        pauseGameplay();
      }
    }
  );
}

/* =========================================================
   Start
========================================================= */

if (
  typeof document !== "undefined"
) {
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      bootstrap,
      {
        once: true
      }
    );
  } else {
    bootstrap();
  }
}

/* =========================================================
   Public API
========================================================= */

export function getAppState() {
  return {
    ...app
  };
}

export function startGame() {
  startGameplay();
}

export function pauseGame() {
  pauseGameplay();
}

export function resumeGame() {
  resumeGameplay();
}

export function stopGame() {
  stopGameplay();
}

export function getSystems() {
  return [
    ...systems
  ];
}

export function getAppSnapshot() {
  return {
    app: {
      ...app
    },

    version:
      APP_VERSION,

    platform:
      detectPlatform(),

    systems:
      systems.map(
        (system) => {
          if (
            typeof system?.snapshot ===
            "function"
          ) {
            return system.snapshot();
          }

          return {
            name:
              system?.constructor?.name ||
              "UnknownSystem"
          };
        }
      )
  };
}

/* =========================================================
   Debug
========================================================= */

export function debugGame() {
  console.group(
    "AZAD WORLD DEBUG"
  );

  console.log(
    "App:",
    getAppState()
  );

  console.log(
    "Game State:",
    gameState.snapshot()
  );

  console.log(
    "Systems:",
    getAppSnapshot()
  );

  console.groupEnd();
}

if (
  typeof window !== "undefined"
) {
  window.AZAD_WORLD = {
    version:
      APP_VERSION,

    state:
      getAppState,

    snapshot:
      getAppSnapshot,

    debug:
      debugGame,

    start:
      startGame,

    pause:
      pauseGame,

    resume:
      resumeGame,

    stop:
      stopGame
  };
}

export default {
  version:
    APP_VERSION,

  bootstrap,

  startGame,

  pauseGame,

  resumeGame,

  stopGame,

  getAppState,

  getAppSnapshot,

  debugGame
};
