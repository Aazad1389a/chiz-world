// src/ui/menu.js

import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { saveManager } from "../gameplay/save.js";

/* =========================================================
   Menu Constants
========================================================= */

export const MENU_STATES = Object.freeze({
  MAIN: "main",
  PLAYING: "playing",
  PAUSED: "paused",
  SETTINGS: "settings",
  LOADING: "loading",
  ERROR: "error"
});

/* =========================================================
   Helpers
========================================================= */

function getElement(id) {
  if (typeof document === "undefined") return null;
  return document.getElementById(id);
}

function setVisible(element, visible) {
  if (!element) return;

  element.hidden = !visible;
  element.style.display = visible ? "" : "none";
}

function setText(element, text) {
  if (!element) return;
  element.textContent = text;
}

/* =========================================================
   Menu Manager
========================================================= */

export class MenuManager {
  constructor(options = {}) {
    this.config = {
      rootId: options.rootId || "main-menu",
      startButtonId: options.startButtonId || "btn-start",
      continueButtonId: options.continueButtonId || "btn-continue",
      settingsButtonId: options.settingsButtonId || "btn-settings",
      exitButtonId: options.exitButtonId || "btn-exit",
      pauseButtonId: options.pauseButtonId || "btn-resume",
      settingsPanelId: options.settingsPanelId || "settings-panel",
      loadingScreenId: options.loadingScreenId || "loading-screen",
      errorScreenId: options.errorScreenId || "error-screen"
    };

    this.state = MENU_STATES.MAIN;

    this.initialized = false;
    this.gameStarted = false;

    this.elements = {};

    this.listeners = new Map();

    this.boundHandlers = [];
  }

  /* =======================================================
     Events
  ======================================================= */

  on(event, callback) {
    if (typeof callback !== "function") {
      return () => {};
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  off(event, callback) {
    const listeners = this.listeners.get(event);

    if (!listeners) return;

    listeners.delete(callback);

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event, data = {}) {
    const listeners = this.listeners.get(event);

    if (!listeners) return;

    for (const callback of listeners) {
      try {
        callback(data);
      } catch (error) {
        console.error(
          `[MenuManager] Event error: ${event}`,
          error
        );
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

    this.cacheElements();
    this.bindEvents();

    this.updateContinueButton();

    this.initialized = true;

    this.emit("initialized", {
      state: this.state
    });

    return this;
  }

  /* =======================================================
     Elements
  ======================================================= */

  cacheElements() {
    this.elements.root =
      getElement(this.config.rootId);

    this.elements.start =
      getElement(this.config.startButtonId);

    this.elements.continue =
      getElement(this.config.continueButtonId);

    this.elements.settings =
      getElement(this.config.settingsButtonId);

    this.elements.exit =
      getElement(this.config.exitButtonId);

    this.elements.resume =
      getElement(this.config.pauseButtonId);

    this.elements.settingsPanel =
      getElement(this.config.settingsPanelId);

    this.elements.loading =
      getElement(this.config.loadingScreenId);

    this.elements.error =
      getElement(this.config.errorScreenId);

    return this.elements;
  }

  /* =======================================================
     Event Binding
  ======================================================= */

  bindEvents() {
    this.unbindEvents();

    this.bindClick(
      this.elements.start,
      () => this.startNewGame()
    );

    this.bindClick(
      this.elements.continue,
      () => this.continueGame()
    );

    this.bindClick(
      this.elements.settings,
      () => this.openSettings()
    );

    this.bindClick(
      this.elements.exit,
      () => this.exitGame()
    );

    this.bindClick(
      this.elements.resume,
      () => this.resumeGame()
    );

    if (typeof window !== "undefined") {
      const keyHandler = (event) => {
        this.handleKeyboard(event);
      };

      window.addEventListener(
        "keydown",
        keyHandler
      );

      this.boundHandlers.push({
        target: window,
        event: "keydown",
        handler: keyHandler
      });
    }
  }

  bindClick(element, callback) {
    if (!element) return;

    const handler = (event) => {
      event.preventDefault();
      callback(event);
    };

    element.addEventListener(
      "click",
      handler
    );

    this.boundHandlers.push({
      target: element,
      event: "click",
      handler
    });
  }

  unbindEvents() {
    for (const item of this.boundHandlers) {
      item.target.removeEventListener(
        item.event,
        item.handler
      );
    }

    this.boundHandlers = [];
  }

  /* =======================================================
     Keyboard
  ======================================================= */

  handleKeyboard(event) {
    if (event.code !== "Escape") {
      return;
    }

    if (this.state === MENU_STATES.PLAYING) {
      this.pauseGame();
      return;
    }

    if (this.state === MENU_STATES.PAUSED) {
      this.resumeGame();
      return;
    }

    if (this.state === MENU_STATES.SETTINGS) {
      this.closeSettings();
    }
  }

  /* =======================================================
     State
  ======================================================= */

  setState(state) {
    if (!Object.values(MENU_STATES).includes(state)) {
      return false;
    }

    const previous = this.state;

    this.state = state;

    this.applyStateVisibility();

    this.emit("stateChanged", {
      previous,
      state
    });

    return true;
  }

  getState() {
    return this.state;
  }

  /* =======================================================
     Visibility
  ======================================================= */

  applyStateVisibility() {
    const mainMenu =
      this.elements.root;

    const settings =
      this.elements.settingsPanel;

    const loading =
      this.elements.loading;

    const error =
      this.elements.error;

    if (this.state === MENU_STATES.MAIN) {
      setVisible(mainMenu, true);
      setVisible(settings, false);
      setVisible(loading, false);
      setVisible(error, false);
      return;
    }

    if (this.state === MENU_STATES.PLAYING) {
      setVisible(mainMenu, false);
      setVisible(settings, false);
      setVisible(loading, false);
      setVisible(error, false);
      return;
    }

    if (this.state === MENU_STATES.PAUSED) {
      setVisible(mainMenu, true);
      setVisible(settings, false);
      setVisible(loading, false);
      setVisible(error, false);
      return;
    }

    if (this.state === MENU_STATES.SETTINGS) {
      setVisible(settings, true);
      return;
    }

    if (this.state === MENU_STATES.LOADING) {
      setVisible(loading, true);
      return;
    }

    if (this.state === MENU_STATES.ERROR) {
      setVisible(error, true);
    }
  }

  /* =======================================================
     Start New Game
  ======================================================= */

  async startNewGame() {
    if (this.state === MENU_STATES.LOADING) {
      return false;
    }

    this.setState(MENU_STATES.LOADING);

    this.emit("beforeStart");

    try {
      /*
       * Reset the current game state.
       */
      if (
        typeof gameState.reset === "function"
      ) {
        gameState.reset();
      }

      this.gameStarted = true;

      this.setState(MENU_STATES.PLAYING);

      this.emit("newGameStarted", {
        slot: saveManager.getSlot()
      });

      return true;
    } catch (error) {
      this.showError(error);
      return false;
    }
  }

  /* =======================================================
     Continue Game
  ======================================================= */

  async continueGame() {
    if (this.state === MENU_STATES.LOADING) {
      return false;
    }

    this.setState(MENU_STATES.LOADING);

    this.emit("beforeContinue");

    try {
      const result =
        await saveManager.load({
          slot: saveManager.getSlot()
        });

      if (!result.success) {
        /*
         * No save exists:
         * start a fresh game instead.
         */
        if (result.found === false) {
          this.gameStarted = true;

          this.setState(
            MENU_STATES.PLAYING
          );

          this.emit("newGameStarted", {
            reason: "no-save-found"
          });

          return true;
        }

        throw (
          result.error ||
          new Error(
            "Unable to load saved game."
          )
        );
      }

      this.gameStarted = true;

      this.setState(MENU_STATES.PLAYING);

      this.emit("gameLoaded", {
        save: result.save
      });

      return true;
    } catch (error) {
      this.showError(error);
      return false;
    }
  }

  /* =======================================================
     Pause
  ======================================================= */

  pauseGame() {
    if (
      !this.gameStarted ||
      this.state !== MENU_STATES.PLAYING
    ) {
      return false;
    }

    this.setState(MENU_STATES.PAUSED);

    this.emit("paused");

    return true;
  }

  /* =======================================================
     Resume
  ======================================================= */

  resumeGame() {
    if (
      !this.gameStarted ||
      this.state !== MENU_STATES.PAUSED
    ) {
      return false;
    }

    this.setState(MENU_STATES.PLAYING);

    this.emit("resumed");

    return true;
  }

  /* =======================================================
     Settings
  ======================================================= */

  openSettings() {
    const previous =
      this.state;

    this.setState(
      MENU_STATES.SETTINGS
    );

    this.emit("settingsOpened", {
      previous
    });

    return true;
  }

  closeSettings() {
    const previous =
      this.state;

    if (
      this.gameStarted &&
      previous === MENU_STATES.SETTINGS
    ) {
      this.setState(
        MENU_STATES.PAUSED
      );
    } else {
      this.setState(
        MENU_STATES.MAIN
      );
    }

    this.emit("settingsClosed", {
      previous
    });

    return true;
  }

  /* =======================================================
     Exit
  ======================================================= */

  async exitGame() {
    this.emit("beforeExit");

    /*
     * Save before leaving when possible.
     */
    if (this.gameStarted) {
      try {
        await saveManager.save({
          type: "manual"
        });
      } catch (error) {
        console.warn(
          "[MenuManager] Exit save failed:",
          error
        );
      }
    }

    this.gameStarted = false;

    this.setState(
      MENU_STATES.MAIN
    );

    this.emit("exited");

    return true;
  }

  /* =======================================================
     Continue Button
  ======================================================= */

  async updateContinueButton() {
    const button =
      this.elements.continue;

    if (!button) {
      return;
    }

    try {
      const exists =
        await saveManager.exists(
          saveManager.getSlot()
        );

      button.disabled = !exists;

      if (exists) {
        setText(
          button,
          "ادامه بازی"
        );
      } else {
        setText(
          button,
          "ادامه بازی"
        );
      }
    } catch {
      button.disabled = false;
    }
  }

  /* =======================================================
     Loading
  ======================================================= */

  showLoading(message = "در حال بارگذاری...") {
    this.setState(
      MENU_STATES.LOADING
    );

    const element =
      this.elements.loading;

    if (!element) {
      return;
    }

    const messageElement =
      element.querySelector(
        "[data-loading-message]"
      );

    if (messageElement) {
      setText(
        messageElement,
        message
      );
    }
  }

  hideLoading() {
    if (
      this.state === MENU_STATES.LOADING
    ) {
      this.setState(
        this.gameStarted
          ? MENU_STATES.PLAYING
          : MENU_STATES.MAIN
      );
    }
  }

  /* =======================================================
     Error
  ======================================================= */

  showError(error) {
    const message =
      error?.message ||
      String(error) ||
      "خطای ناشناخته";

    this.setState(
      MENU_STATES.ERROR
    );

    const element =
      this.elements.error;

    if (element) {
      const messageElement =
        element.querySelector(
          "[data-error-message]"
        );

      if (messageElement) {
        setText(
          messageElement,
          message
        );
      }
    }

    this.emit("error", {
      error,
      message
    });
  }

  hideError() {
    if (
      this.state === MENU_STATES.ERROR
    ) {
      this.setState(
        this.gameStarted
          ? MENU_STATES.PLAYING
          : MENU_STATES.MAIN
      );
    }
  }

  /* =======================================================
     Save
  ======================================================= */

  async saveGame() {
    try {
      const result =
        await saveManager.quickSave();

      if (!result.success) {
        this.showError(
          result.error ||
          new Error(
            "ذخیره بازی انجام نشد."
          )
        );

        return false;
      }

      this.emit("gameSaved", {
        result
      });

      return true;
    } catch (error) {
      this.showError(error);
      return false;
    }
  }

  /* =======================================================
     Slot
  ======================================================= */

  setSaveSlot(slot) {
    const result =
      saveManager.setSlot(slot);

    if (result) {
      this.updateContinueButton();
    }

    return result;
  }

  getSaveSlot() {
    return saveManager.getSlot();
  }

  /* =======================================================
     Game Started
  ======================================================= */

  isGameStarted() {
    return this.gameStarted;
  }

  setGameStarted(value) {
    this.gameStarted =
      Boolean(value);

    return this.gameStarted;
  }

  /* =======================================================
     Snapshot
  ======================================================= */

  snapshot() {
    return {
      initialized: this.initialized,
      state: this.state,
      gameStarted: this.gameStarted,
      saveSlot: saveManager.getSlot()
    };
  }

  debug() {
    return {
      ...this.snapshot(),
      elements: {
        root: Boolean(this.elements.root),
        start: Boolean(this.elements.start),
        continue: Boolean(this.elements.continue),
        settings: Boolean(this.elements.settings),
        exit: Boolean(this.elements.exit),
        resume: Boolean(this.elements.resume),
        settingsPanel: Boolean(
          this.elements.settingsPanel
        ),
        loading: Boolean(
          this.elements.loading
        ),
        error: Boolean(
          this.elements.error
        )
      }
    };
  }

  /* =======================================================
     Dispose
  ======================================================= */

  dispose() {
    this.unbindEvents();

    this.listeners.clear();

    this.elements = {};

    this.initialized = false;
    this.gameStarted = false;
    this.state = MENU_STATES.MAIN;
  }
}

/* =========================================================
   Singleton
========================================================= */

export const menuManager =
  new MenuManager();

/* =========================================================
   Convenience Functions
========================================================= */

export function initializeMenu(options) {
  return menuManager.initialize(options);
}

export function startNewGame() {
  return menuManager.startNewGame();
}

export function continueGame() {
  return menuManager.continueGame();
}

export function pauseGame() {
  return menuManager.pauseGame();
}

export function resumeGame() {
  return menuManager.resumeGame();
}

export function openSettings() {
  return menuManager.openSettings();
}

export function closeSettings() {
  return menuManager.closeSettings();
}

export function saveGame() {
  return menuManager.saveGame();
}

export function getMenuState() {
  return menuManager.getState();
}

export default menuManager;
