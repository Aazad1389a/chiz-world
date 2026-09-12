import { profileManager } from "../api/profile.js";
import { getCurrentUser } from "../api/supabase.js";

/**
 * AZAD WORLD - Profile HUD + In-Game Profile Panel
 * Connects the Supabase profile to the existing HUD and provides
 * an in-game profile page with XP and online status.
 */

const ELEMENT_IDS = Object.freeze({
  name: ["player-name", "hud-player-name"],
  level: ["player-level", "hud-player-level"],
  coins: ["player-coins", "hud-player-coins"]
});

const PROFILE_BUTTON_ID = "azad-profile-button";
const PROFILE_PANEL_ID = "azad-profile-panel";
const PROFILE_STYLE_ID = "azad-profile-panel-style";

function findElement(ids) {
  if (typeof document === "undefined") return null;
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) return element;
  }
  return null;
}

function setText(ids, value) {
  const element = findElement(ids);
  if (element) element.textContent = String(value ?? "");
}

function getXPRequired(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return Math.floor(100 * Math.pow(safeLevel, 1.35));
}

function renderHUD(profile) {
  if (!profile) return;

  setText(
    ELEMENT_IDS.name,
    profile.display_name || profile.username || "Player"
  );

  setText(
    ELEMENT_IDS.level,
    `Lv. ${Math.max(1, Number(profile.level) || 1)}`
  );

  setText(
    ELEMENT_IDS.coins,
    Math.max(0, Number(profile.coins) || 0).toLocaleString()
  );
}

function injectStyles() {
  if (typeof document === "undefined" || document.getElementById(PROFILE_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = PROFILE_STYLE_ID;
  style.textContent = `
    #${PROFILE_BUTTON_ID} {
      margin-top: 10px;
    }

    #${PROFILE_PANEL_ID} {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0, 0, 0, .72);
      backdrop-filter: blur(8px);
    }

    #${PROFILE_PANEL_ID}.open {
      display: flex;
    }

    .azad-profile-card {
      width: min(430px, 94vw);
      padding: 26px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 18px;
      background: rgba(15,18,25,.96);
      color: #fff;
      box-shadow: 0 20px 70px rgba(0,0,0,.5);
      font-family: system-ui, sans-serif;
    }

    .azad-profile-card h2 {
      margin: 0 0 6px;
      font-size: 28px;
    }

    .azad-profile-subtitle {
      margin: 0 0 22px;
      opacity: .65;
      font-size: 13px;
    }

    .azad-profile-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .azad-profile-label { opacity: .65; }
    .azad-profile-value { font-weight: 700; }

    .azad-profile-xp {
      margin-top: 20px;
    }

    .azad-profile-xp-head {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }

    .azad-profile-xp-track {
      height: 10px;
      overflow: hidden;
      border-radius: 99px;
      background: rgba(255,255,255,.1);
    }

    .azad-profile-xp-fill {
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #4facfe, #00f2fe);
      transition: width .25s ease;
    }

    .azad-profile-online {
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }

    .azad-profile-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #777;
    }

    .azad-profile-dot.online { background: #32d583; }

    .azad-profile-close {
      width: 100%;
      margin-top: 22px;
      padding: 11px 14px;
      border: 0;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 700;
    }
  `;

  document.head.appendChild(style);
}

function createProfileButton() {
  if (typeof document === "undefined") return null;
  if (document.getElementById(PROFILE_BUTTON_ID)) {
    return document.getElementById(PROFILE_BUTTON_ID);
  }

  const mainMenu = document.getElementById("main-menu");
  if (!mainMenu) return null;

  const button = document.createElement("button");
  button.id = PROFILE_BUTTON_ID;
  button.type = "button";
  button.textContent = "PROFILE";
  button.addEventListener("click", openProfilePanel);

  const settingsButton = document.getElementById("settings-button");
  if (settingsButton?.parentElement === mainMenu) {
    settingsButton.insertAdjacentElement("afterend", button);
  } else {
    mainMenu.appendChild(button);
  }

  return button;
}

function createProfilePanel() {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(PROFILE_PANEL_ID);
  if (existing) return existing;

  injectStyles();

  const panel = document.createElement("div");
  panel.id = PROFILE_PANEL_ID;
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <section class="azad-profile-card" role="dialog" aria-modal="true" aria-labelledby="azad-profile-title">
      <h2 id="azad-profile-title">PLAYER PROFILE</h2>
      <p class="azad-profile-subtitle">AZAD WORLD account information</p>

      <div class="azad-profile-row">
        <span class="azad-profile-label">Username</span>
        <strong class="azad-profile-value" id="azad-profile-name">Player</strong>
      </div>

      <div class="azad-profile-row">
        <span class="azad-profile-label">Level</span>
        <strong class="azad-profile-value" id="azad-profile-level">1</strong>
      </div>

      <div class="azad-profile-row">
        <span class="azad-profile-label">Coins</span>
        <strong class="azad-profile-value" id="azad-profile-coins">0</strong>
      </div>

      <div class="azad-profile-row">
        <span class="azad-profile-label">Platform</span>
        <strong class="azad-profile-value" id="azad-profile-platform">-</strong>
      </div>

      <div class="azad-profile-row">
        <span class="azad-profile-label">Status</span>
        <strong class="azad-profile-value azad-profile-online">
          <span class="azad-profile-dot" id="azad-profile-dot"></span>
          <span id="azad-profile-status">Offline</span>
        </strong>
      </div>

      <div class="azad-profile-xp">
        <div class="azad-profile-xp-head">
          <span>Experience</span>
          <strong id="azad-profile-xp-text">0 / 100 XP</strong>
        </div>
        <div class="azad-profile-xp-track">
          <div class="azad-profile-xp-fill" id="azad-profile-xp-fill"></div>
        </div>
      </div>

      <button class="azad-profile-close" id="azad-profile-close" type="button">CLOSE</button>
    </section>
  `;

  panel.addEventListener("click", (event) => {
    if (event.target === panel) closeProfilePanel();
  });

  panel.querySelector("#azad-profile-close")?.addEventListener(
    "click",
    closeProfilePanel
  );

  document.body.appendChild(panel);
  return panel;
}

function renderProfilePanel(profile) {
  if (!profile) return;

  const level = Math.max(1, Number(profile.level) || 1);
  const xp = Math.max(0, Number(profile.experience) || 0);
  const required = Math.max(1, getXPRequired(level));
  const percent = Math.min(100, (xp / required) * 100);
  const online = Boolean(profile.online);

  const name = document.getElementById("azad-profile-name");
  const levelElement = document.getElementById("azad-profile-level");
  const coins = document.getElementById("azad-profile-coins");
  const platform = document.getElementById("azad-profile-platform");
  const status = document.getElementById("azad-profile-status");
  const dot = document.getElementById("azad-profile-dot");
  const xpText = document.getElementById("azad-profile-xp-text");
  const xpFill = document.getElementById("azad-profile-xp-fill");

  if (name) name.textContent = profile.display_name || profile.username || "Player";
  if (levelElement) levelElement.textContent = `Lv. ${level}`;
  if (coins) coins.textContent = Math.max(0, Number(profile.coins) || 0).toLocaleString();
  if (platform) platform.textContent = profile.platform || "unknown";
  if (status) status.textContent = online ? "Online" : "Offline";
  if (dot) dot.classList.toggle("online", online);
  if (xpText) xpText.textContent = `${xp.toLocaleString()} / ${required.toLocaleString()} XP`;
  if (xpFill) xpFill.style.width = `${percent}%`;
}

export async function syncProfileHUD() {
  let profile = profileManager.getCachedProfile?.() || profileManager.profile || null;

  if (!profile) {
    try {
      const user = await getCurrentUser();
      if (user) {
        const result = await profileManager.getOrCreateProfile({
          username: user.user_metadata?.username,
          display_name: user.user_metadata?.display_name,
          avatar: user.user_metadata?.avatar,
          online: true,
          platform: profileManager.detectPlatform?.() || "unknown"
        });
        if (result?.ok) profile = result.data;
      }
    } catch (error) {
      console.warn("[ProfileHUD] Profile refresh failed:", error);
    }
  }

  if (profile) {
    renderHUD(profile);
    renderProfilePanel(profile);
  }

  return profile;
}

export function openProfilePanel() {
  const panel = createProfilePanel();
  if (!panel) return false;

  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  void syncProfileHUD();
  return true;
}

export function closeProfilePanel() {
  const panel = document.getElementById(PROFILE_PANEL_ID);
  if (!panel) return false;

  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  return true;
}

let started = false;
let refreshTimer = null;

export function initializeProfileHUD() {
  if (started) {
    void syncProfileHUD();
    return;
  }

  started = true;
  createProfilePanel();
  createProfileButton();
  void syncProfileHUD();

  // Keep online/XP/profile values fresh without adding a new realtime dependency.
  refreshTimer = window.setInterval(() => {
    void syncProfileHUD();
  }, 2000);
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProfileHUD, { once: true });
  } else {
    initializeProfileHUD();
  }
}

export function disposeProfileHUD() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
  started = false;
}

export default initializeProfileHUD;
