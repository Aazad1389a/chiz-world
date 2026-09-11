import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { playerController } from "../player/controller.js";

/* =========================================================
   HUD Constants
========================================================= */

export const HUD_ELEMENTS = Object.freeze({
  HEALTH: "hud-health",
  HEALTH_VALUE: "hud-health-value",
  STAMINA: "hud-stamina",
  STAMINA_VALUE: "hud-stamina-value",

  FPS: "hud-fps",
  PING: "hud-ping",

  PLAYER_NAME: "hud-player-name",
  PLAYER_LEVEL: "hud-player-level",
  PLAYER_COINS: "hud-player-coins",

  MISSION: "hud-mission",
  MISSION_TITLE: "hud-mission-title",
  MISSION_PROGRESS: "hud-mission-progress",

  INTERACTION: "hud-interaction",
  NOTIFICATION: "hud-notification",

  CROSSHAIR: "crosshair"
});

/* =========================================================
   Helpers
========================================================= */

function getElement(id) {
  if (typeof document === "undefined") {
    return null;
  }

  return document.getElementById(id);
}

function setText(element, value) {
  if (!element) return;

  element.textContent = String(value ?? "");
}

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) {
    return "0";
  }

  return Math.floor(Number(value)).toLocaleString();
}

/* =========================================================
   HUD Manager
========================================================= */

export class HUDManager {
  constructor(options = {}) {
    this.config = {
      updateInterval:
        options.updateInterval || 50,

      notificationDuration:
        options.notificationDuration || 3000,

      showFPS:
        options.showFPS ??
        GAME_CONFIG.ui?.showFPS ??
        true,

      showPing:
        options.showPing ??
        GAME_CONFIG.ui?.showPing ??
        true,

      showCrosshair:
        options.showCrosshair ??
        GAME_CONFIG.ui?.showCrosshair ??
        true
    };

    this.elements = {};

    this.initialized = false;
    this.visible = true;

    this.updateTimer = null;

    this.lastUpdate = 0;

    this.notificationTimer = null;

    this.listeners = new Map();

    this.stats = {
      fps: 0,
      ping: 0
    };
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
          `[HUDManager] Event error: ${event}`,
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

    this.cacheElements();

    this.initialized = true;

    this.applyVisibility();

    this.update();

    this.start();

    this.emit("initialized");

    return this;
  }

  /* =======================================================
     Cache Elements
  ======================================================= */

  cacheElements() {
    this.elements.health =
      getElement(HUD_ELEMENTS.HEALTH);

    this.elements.healthValue =
      getElement(
        HUD_ELEMENTS.HEALTH_VALUE
      );

    this.elements.stamina =
      getElement(HUD_ELEMENTS.STAMINA);

    this.elements.staminaValue =
      getElement(
        HUD_ELEMENTS.STAMINA_VALUE
      );

    this.elements.fps =
      getElement(HUD_ELEMENTS.FPS);

    this.elements.ping =
      getElement(HUD_ELEMENTS.PING);

    this.elements.playerName =
      getElement(
        HUD_ELEMENTS.PLAYER_NAME
      );

    this.elements.playerLevel =
      getElement(
        HUD_ELEMENTS.PLAYER_LEVEL
      );

    this.elements.playerCoins =
      getElement(
        HUD_ELEMENTS.PLAYER_COINS
      );

    this.elements.mission =
      getElement(HUD_ELEMENTS.MISSION);

    this.elements.missionTitle =
      getElement(
        HUD_ELEMENTS.MISSION_TITLE
      );

    this.elements.missionProgress =
      getElement(
        HUD_ELEMENTS.MISSION_PROGRESS
      );

    this.elements.interaction =
      getElement(
        HUD_ELEMENTS.INTERACTION
      );

    this.elements.notification =
      getElement(
        HUD_ELEMENTS.NOTIFICATION
      );

    this.elements.crosshair =
      getElement(
        HUD_ELEMENTS.CROSSHAIR
      );

    return this.elements;
  }

  /* =======================================================
     Start / Stop
  ======================================================= */

  start() {
    this.stop();

    this.updateTimer = setInterval(
      () => this.update(),
      this.config.updateInterval
    );

    return true;
  }

  stop() {
    if (this.updateTimer) {
      clearInterval(
        this.updateTimer
      );

      this.updateTimer = null;
    }
  }

  /* =======================================================
     Main Update
  ======================================================= */

  update() {
    if (!this.initialized) {
      return;
    }

    if (!this.visible) {
      return;
    }

    const now = performance.now();

    if (
      now - this.lastUpdate <
      this.config.updateInterval
    ) {
      return;
    }

    this.lastUpdate = now;

    this.updatePlayer();
    this.updatePerformance();
    this.updateMission();
    this.updateInteraction();
  }

  /* =======================================================
     Player
  ======================================================= */

  updatePlayer() {
    const snapshot =
      typeof playerController.getSnapshot ===
      "function"
        ? playerController.getSnapshot()
        : null;

    const state =
      gameState.snapshot();

    const player =
      snapshot ||
      state?.player ||
      {};

    const health =
      Number.isFinite(player.health)
        ? player.health
        : 100;

    const stamina =
      Number.isFinite(player.stamina)
        ? player.stamina
        : 100;

    const level =
      Number.isFinite(player.level)
        ? player.level
        : 1;

    const coins =
      Number.isFinite(player.coins)
        ? player.coins
        : 0;

    const maxHealth =
      Number.isFinite(player.maxHealth)
        ? player.maxHealth
        : 100;

    const maxStamina =
      Number.isFinite(player.maxStamina)
        ? player.maxStamina
        : 100;

    this.setHealth(
      health,
      maxHealth
    );

    this.setStamina(
      stamina,
      maxStamina
    );

    this.setPlayerLevel(level);
    this.setPlayerCoins(coins);

    const username =
      player.username ||
      player.name ||
      state?.profile?.username ||
      state?.player?.username ||
      "Player";

    this.setPlayerName(username);
  }

  /* =======================================================
     Health
  ======================================================= */

  setHealth(value, max = 100) {
    const safeMax =
      Math.max(1, Number(max) || 100);

    const health =
      clamp(
        Number(value) || 0,
        0,
        safeMax
      );

    const percent =
      (health / safeMax) * 100;

    if (this.elements.health) {
      this.elements.health.style.width =
        `${percent}%`;

      this.elements.health.setAttribute(
        "aria-valuenow",
        String(Math.round(health))
      );

      this.elements.health.setAttribute(
        "aria-valuemax",
        String(safeMax)
      );
    }

    setText(
      this.elements.healthValue,
      Math.round(health)
    );
  }

  /* =======================================================
     Stamina
  ======================================================= */

  setStamina(value, max = 100) {
    const safeMax =
      Math.max(1, Number(max) || 100);

    const stamina =
      clamp(
        Number(value) || 0,
        0,
        safeMax
      );

    const percent =
      (stamina / safeMax) * 100;

    if (this.elements.stamina) {
      this.elements.stamina.style.width =
        `${percent}%`;

      this.elements.stamina.setAttribute(
        "aria-valuenow",
        String(Math.round(stamina))
      );

      this.elements.stamina.setAttribute(
        "aria-valuemax",
        String(safeMax)
      );
    }

    setText(
      this.elements.staminaValue,
      Math.round(stamina)
    );
  }

  /* =======================================================
     Player Information
  ======================================================= */

  setPlayerName(name) {
    setText(
      this.elements.playerName,
      name || "Player"
    );
  }

  setPlayerLevel(level) {
    setText(
      this.elements.playerLevel,
      `Lv. ${Math.max(
        1,
        Math.floor(Number(level) || 1)
      )}`
    );
  }

  setPlayerCoins(coins) {
    setText(
      this.elements.playerCoins,
      formatNumber(coins)
    );
  }

  /* =======================================================
     Performance
  ======================================================= */

  updatePerformance() {
    const state =
      gameState.snapshot();

    const fps =
      state?.graphics?.fps ??
      state?.statistics?.fps ??
      this.stats.fps;

    const ping =
      state?.connection?.ping ??
      state?.multiplayer?.ping ??
      this.stats.ping;

    if (Number.isFinite(Number(fps))) {
      this.setFPS(fps);
    }

    if (Number.isFinite(Number(ping))) {
      this.setPing(ping);
    }
  }

  setFPS(value) {
    this.stats.fps =
      Math.max(
        0,
        Math.round(Number(value) || 0)
      );

    if (!this.config.showFPS) {
      this.hideElement(
        this.elements.fps
      );

      return;
    }

    this.showElement(
      this.elements.fps
    );

    setText(
      this.elements.fps,
      `FPS: ${this.stats.fps}`
    );
  }

  setPing(value) {
    this.stats.ping =
      Math.max(
        0,
        Math.round(Number(value) || 0)
      );

    if (!this.config.showPing) {
      this.hideElement(
        this.elements.ping
      );

      return;
    }

    this.showElement(
      this.elements.ping
    );

    setText(
      this.elements.ping,
      `PING: ${this.stats.ping} ms`
    );
  }

  /* =======================================================
     Mission
  ======================================================= */

  updateMission() {
    const state =
      gameState.snapshot();

    const missionState =
      state?.mission;

    if (!missionState) {
      return;
    }

    const active =
      missionState.active ||
      missionState.current ||
      null;

    if (!active) {
      this.hideMission();
      return;
    }

    const title =
      active.title ||
      active.name ||
      "Mission";

    const progress =
      active.progress ??
      0;

    const target =
      active.target ??
      active.required ??
      0;

    this.showMission(
      title,
      progress,
      target
    );
  }

  showMission(
    title,
    progress = 0,
    target = 0
  ) {
    this.showElement(
      this.elements.mission
    );

    setText(
      this.elements.missionTitle,
      title
    );

    if (target > 0) {
      setText(
        this.elements.missionProgress,
        `${formatNumber(progress)} / ${formatNumber(target)}`
      );
    } else {
      setText(
        this.elements.missionProgress,
        formatNumber(progress)
      );
    }
  }

  hideMission() {
    this.hideElement(
      this.elements.mission
    );
  }

  /* =======================================================
     Interaction
  ======================================================= */

  updateInteraction() {
    const state =
      gameState.snapshot();

    const target =
      state?.ui?.interactionTarget ||
      state?.interaction?.target ||
      null;

    if (!target) {
      this.hideInteraction();
      return;
    }

    const prompt =
      target.prompt ||
      target.label ||
      target.name ||
      "Interact";

    this.showInteraction(prompt);
  }

  showInteraction(text) {
    this.showElement(
      this.elements.interaction
    );

    setText(
      this.elements.interaction,
      text
    );
  }

  hideInteraction() {
    this.hideElement(
      this.elements.interaction
    );
  }

  /* =======================================================
     Notifications
  ======================================================= */

  notify(
    message,
    options = {}
  ) {
    if (!this.elements.notification) {
      return false;
    }

    const duration =
      options.duration ??
      this.config.notificationDuration;

    setText(
      this.elements.notification,
      message
    );

    this.showElement(
      this.elements.notification
    );

    if (this.notificationTimer) {
      clearTimeout(
        this.notificationTimer
      );
    }

    this.notificationTimer =
      setTimeout(() => {
        this.hideNotification();
      }, duration);

    this.emit("notification", {
      message,
      duration
    });

    return true;
  }

  hideNotification() {
    if (this.notificationTimer) {
      clearTimeout(
        this.notificationTimer
      );

      this.notificationTimer = null;
    }

    this.hideElement(
      this.elements.notification
    );
  }

  /* =======================================================
     Crosshair
  ======================================================= */

  setCrosshairVisible(visible) {
    this.config.showCrosshair =
      Boolean(visible);

    if (visible) {
      this.showElement(
        this.elements.crosshair
      );
    } else {
      this.hideElement(
        this.elements.crosshair
      );
    }
  }

  /* =======================================================
     General Visibility
  ======================================================= */

  show() {
    this.visible = true;

    this.applyVisibility();

    this.emit("shown");

    return true;
  }

  hide() {
    this.visible = false;

    this.applyVisibility();

    this.emit("hidden");

    return true;
  }

  toggle() {
    return this.visible
      ? this.hide()
      : this.show();
  }

  applyVisibility() {
    const root =
      getElement("hud");

    if (root) {
      root.hidden = !this.visible;
      root.style.display =
        this.visible
          ? ""
          : "none";
    }

    if (this.visible) {
      this.setCrosshairVisible(
        this.config.showCrosshair
      );
    }
  }

  /* =======================================================
     Utility Visibility
  ======================================================= */

  showElement(element) {
    if (!element) return;

    element.hidden = false;
    element.style.display = "";
  }

  hideElement(element) {
    if (!element) return;

    element.hidden = true;
    element.style.display = "none";
  }

  /* =======================================================
     Direct Updates
  ======================================================= */

  updatePing(ping) {
    this.setPing(ping);
  }

  updateFPS(fps) {
    this.setFPS(fps);
  }

  updateMissionProgress(
    progress,
    target
  ) {
    if (!this.elements.missionProgress) {
      return;
    }

    if (target > 0) {
      setText(
        this.elements.missionProgress,
        `${formatNumber(progress)} / ${formatNumber(target)}`
      );
    } else {
      setText(
        this.elements.missionProgress,
        formatNumber(progress)
      );
    }
  }

  /* =======================================================
     Snapshot
  ======================================================= */

  snapshot() {
    return {
      initialized:
        this.initialized,

      visible:
        this.visible,

      fps:
        this.stats.fps,

      ping:
        this.stats.ping,

      autosync:
        Boolean(this.updateTimer),

      showFPS:
        this.config.showFPS,

      showPing:
        this.config.showPing,

      showCrosshair:
        this.config.showCrosshair
    };
  }

  debug() {
    return {
      ...this.snapshot(),

      elements: {
        health:
          Boolean(this.elements.health),

        stamina:
          Boolean(this.elements.stamina),

        fps:
          Boolean(this.elements.fps),

        ping:
          Boolean(this.elements.ping),

        mission:
          Boolean(this.elements.mission),

        interaction:
          Boolean(this.elements.interaction),

        notification:
          Boolean(this.elements.notification),

        crosshair:
          Boolean(this.elements.crosshair)
      }
    };
  }

  /* =======================================================
     Dispose
  ======================================================= */

  dispose() {
    this.stop();

    this.hideNotification();

    this.listeners.clear();

    this.elements = {};

    this.initialized = false;
    this.visible = false;
  }
}

/* =========================================================
   Singleton
========================================================= */

export const hudManager =
  new HUDManager();

/* =========================================================
   Convenience Functions
========================================================= */

export function initializeHUD(options) {
  return hudManager.initialize(
    options
  );
}

export function showHUD() {
  return hudManager.show();
}

export function hideHUD() {
  return hudManager.hide();
}

export function toggleHUD() {
  return hudManager.toggle();
}

export function setHUDHealth(
  value,
  max
) {
  return hudManager.setHealth(
    value,
    max
  );
}

export function setHUDStamina(
  value,
  max
) {
  return hudManager.setStamina(
    value,
    max
  );
}

export function setHUDFPS(fps) {
  return hudManager.setFPS(fps);
}

export function setHUDPing(ping) {
  return hudManager.setPing(ping);
}

export function showHUDMission(
  title,
  progress,
  target
) {
  return hudManager.showMission(
    title,
    progress,
    target
  );
}

export function hideHUDMission() {
  return hudManager.hideMission();
}

export function showHUDInteraction(
  text
) {
  return hudManager.showInteraction(
    text
  );
}

export function hideHUDInteraction() {
  return hudManager.hideInteraction();
}

export function notifyHUD(
  message,
  options
) {
  return hudManager.notify(
    message,
    options
  );
}

export default hudManager;
