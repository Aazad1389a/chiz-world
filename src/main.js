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
   AUTHENTICATION
========================================================= */

import {
  authManager
} from "./api/auth.js";

import {
  authUIManager,
  initializeAuthUI
} from "./ui/auth-ui.js";


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

  initialized: false,

  authenticated: false

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

  const safeProgress =
    Math.max(
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
      "#loading-progress"
    );


  const text =
    loading.querySelector(
      "#loading-text"
    );


  if (bar) {

    bar.style.width =
      `${safeProgress}%`;

  }


  if (text && message) {

    text.textContent =
      message;

  }

}


function hideLoadingScreen() {

  const loading =
    getElement("loading-screen");


  if (!loading) {

    return;

  }


  loading.classList.add(
    "hidden"
  );

  loading.classList.remove(
    "active"
  );

  loading.hidden = true;

  loading.style.display =
    "none";

}


function showLoadingScreen(
  message = "در حال بارگذاری..."
) {

  const loading =
    getElement("loading-screen");


  if (!loading) {

    return;

  }


  loading.classList.remove(
    "hidden"
  );

  loading.classList.add(
    "active"
  );

  loading.hidden = false;

  loading.style.display =
    "";


  const text =
    loading.querySelector(
      "#loading-text"
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


  app.error =
    message;

  app.loading =
    false;


  const screen =
    getElement("error-screen");


  if (screen) {

    screen.classList.remove(
      "hidden"
    );

    screen.hidden = false;

    screen.style.display =
      "";


    const text =
      getElement(
        "error-message"
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
   Authentication State
========================================================= */

async function refreshAuthenticationState() {

  try {

    let user = null;


    if (
      authManager &&
      typeof authManager.getUser ===
        "function"
    ) {

      user =
        await authManager.getUser();

    }


    app.authenticated =
      Boolean(user);


    if (
      typeof gameState.set ===
      "function"
    ) {

      gameState.set(
        "connection.authenticated",
        Boolean(user)
      );


      gameState.set(
        "player.loggedIn",
        Boolean(user)
      );

    }


    return user;

  } catch (error) {

    warn(
      "Authentication state check failed.",
      error
    );

    app.authenticated =
      false;

    return null;

  }

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
    getElement("game-canvas") ||
    getElement("game") ||
    document.body;


  initializeRenderer(
    container
  );


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
    93,
    "راه‌اندازی منوی بازی..."
  );


  /* -------------------------------------------------------
     Authentication UI
  ------------------------------------------------------- */

  initializeAuthUI();

  systems.push(
    authUIManager
  );


  setLoadingProgress(
    96,
    "راه‌اندازی حساب کاربری..."
  );

}


/* =========================================================
   Direct DOM UI Connections
========================================================= */

function connectDOMButtons() {

  /* -------------------------------------------------------
     PLAY
  ------------------------------------------------------- */

  const playButton =
    getElement("play-button");


  if (playButton) {

    playButton.addEventListener(
      "click",
      async () => {

        const user =
          await refreshAuthenticationState();


        if (!user) {

          hideMainMenu();

          authUIManager.show();

          return;

        }


        startGameplay();

      }
    );

  }


  /* -------------------------------------------------------
     SETTINGS
  ------------------------------------------------------- */

  const settingsButton =
    getElement(
      "settings-button"
    );


  if (settingsButton) {

    settingsButton.addEventListener(
      "click",
      () => {

        if (
          typeof settingsManager.open ===
          "function"
        ) {

          settingsManager.open();

        } else {

          const panel =
            getElement(
              "settings-panel"
            );


          if (panel) {

            panel.classList.remove(
              "hidden"
            );

          }

        }

      }
    );

  }


  /* -------------------------------------------------------
     CLOSE SETTINGS
  ------------------------------------------------------- */

  const closeSettings =
    getElement(
      "close-settings-button"
    );


  if (closeSettings) {

    closeSettings.addEventListener(
      "click",
      () => {

        const panel =
          getElement(
            "settings-panel"
          );


        if (panel) {

          panel.classList.add(
            "hidden"
          );

        }

      }
    );

  }


  /* -------------------------------------------------------
     RESUME
  ------------------------------------------------------- */

  const resumeButton =
    getElement(
      "resume-button"
    );


  if (resumeButton) {

    resumeButton.addEventListener(
      "click",
      () => {

        resumeGameplay();

      }
    );

  }


  /* -------------------------------------------------------
     QUIT
  ------------------------------------------------------- */

  const quitButton =
    getElement(
      "quit-button"
    );


  if (quitButton) {

    quitButton.addEventListener(
      "click",
      () => {

        stopGameplay();

        showMainMenu();

      }
    );

  }


  /* -------------------------------------------------------
     PAUSE SETTINGS
  ------------------------------------------------------- */

  const pauseSettings =
    getElement(
      "pause-settings-button"
    );


  if (pauseSettings) {

    pauseSettings.addEventListener(
      "click",
      () => {

        const pauseMenu =
          getElement(
            "pause-menu"
          );


        if (pauseMenu) {

          pauseMenu.classList.add(
            "hidden"
          );

        }


        const settingsPanel =
          getElement(
            "settings-panel"
          );


        if (settingsPanel) {

          settingsPanel.classList.remove(
            "hidden"
          );

        }

      }
    );

  }


  /* -------------------------------------------------------
     RELOAD
  ------------------------------------------------------- */

  const reloadButton =
    getElement(
      "reload-button"
    );


  if (reloadButton) {

    reloadButton.addEventListener(
      "click",
      () => {

        window.location.reload();

      }
    );

  }

}


/* =========================================================
   Authentication Connections
========================================================= */

function connectAuthentication() {

  if (!authUIManager) {

    return;

  }


  /* -------------------------------------------------------
     Login/Register success
  ------------------------------------------------------- */

  authUIManager.on(
    "authenticated",
    async () => {

      app.authenticated =
        true;


      await refreshAuthenticationState();


      authUIManager.hide();


      showMainMenu();


      startGameplay();

    }
  );


  /* -------------------------------------------------------
     Auth state changed
  ------------------------------------------------------- */

  authUIManager.on(
    "auth-change",
    async () => {

      await refreshAuthenticationState();

    }
  );


  /* -------------------------------------------------------
     Logout
  ------------------------------------------------------- */

  authUIManager.on(
    "logout",
    async () => {

      app.authenticated =
        false;


      await refreshAuthenticationState();


      stopGameplay();

      authUIManager.hide();

      showMainMenu();

    }
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

  if (
    menuManager &&
    typeof menuManager.on ===
      "function"
  ) {

    menuManager.on(
      "newGameStarted",
      async () => {

        const user =
          await refreshAuthenticationState();


        if (!user) {

          authUIManager.show();

          return;

        }


        startGameplay();

      }
    );


    menuManager.on(
      "gameLoaded",
      async () => {

        const user =
          await refreshAuthenticationState();


        if (!user) {

          authUIManager.show();

          return;

        }


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

        showMainMenu();

      }
    );

  }


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

      if (!target) {

        return;

      }


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

      if (!mission) {

        return;

      }


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

      if (!mission) {

        return;

      }


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
     Weather
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
   Menu Visibility
========================================================= */

function hideMainMenu() {

  const menu =
    getElement(
      "main-menu"
    );


  if (!menu) {

    return;

  }


  menu.classList.add(
    "hidden"
  );

  menu.classList.remove(
    "active"
  );

}


function showMainMenu() {

  const menu =
    getElement(
      "main-menu"
    );


  if (!menu) {

    return;

  }


  menu.classList.remove(
    "hidden"
  );

  menu.classList.add(
    "active"
  );

}


function hidePauseMenu() {

  const menu =
    getElement(
      "pause-menu"
    );


  if (!menu) {

    return;

  }


  menu.classList.add(
    "hidden"
  );

}


function showPauseMenu() {

  const menu =
    getElement(
      "pause-menu"
    );


  if (!menu) {

    return;

  }


  menu.classList.remove(
    "hidden"
  );

}


/* =========================================================
   Gameplay Start
========================================================= */

function startGameplay() {

  if (app.running) {

    return;

  }


  app.running =
    true;

  app.paused =
    false;

  app.loading =
    false;


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


  hideMainMenu();

  hidePauseMenu();

  authUIManager.hide();

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


  app.paused =
    true;


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


  showPauseMenu();


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


  app.paused =
    false;


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


  hidePauseMenu();


  log(
    "Gameplay resumed."
  );

}


/* =========================================================
   Stop Gameplay
========================================================= */

function stopGameplay() {

  app.running =
    false;

  app.paused =
    false;


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


  hidePauseMenu();

  hudManager.hide();


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


  update(
    delta
  );


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


  lastFrameTime =
    0;


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


  gameLoopId =
    null;

}


/* =========================================================
   Bootstrap
========================================================= */

async function bootstrap() {

  if (booted) {

    return;

  }


  booted =
    true;


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

    connectAuthentication();

    connectDOMButtons();


    /* -----------------------------------------------------
       Check Authentication
    ----------------------------------------------------- */

    const user =
      await refreshAuthenticationState();


    initialized =
      true;

    app.initialized =
      true;

    app.loading =
      false;


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


    if (
      typeof rendererSystem.start ===
      "function"
    ) {

      rendererSystem.start();

    }


    hideLoadingScreen();


    /*
     * If already logged in,
     * show the main menu.
     */

    if (user) {

      app.authenticated =
        true;

      showMainMenu();

    } else {

      app.authenticated =
        false;

      showMainMenu();

    }


    if (
      typeof saveManager.startAutosave ===
      "function"
    ) {

      saveManager.startAutosave();

    }


    if (
      typeof menuManager.updateContinueButton ===
      "function"
    ) {

      menuManager.updateContinueButton();

    }


    log(
      "AZAD WORLD initialized successfully."
    );


  } catch (error) {

    showFatalError(
      error
    );

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

    authenticated:
      app.authenticated,

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
