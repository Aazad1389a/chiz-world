import { profileManager } from "../api/profile.js";

/**
 * AZAD WORLD - Profile HUD Bridge
 * Keeps the existing HUD player fields synchronized with Supabase profile data.
 */

const ELEMENT_IDS = Object.freeze({
  name: ["player-name", "hud-player-name"],
  level: ["player-level", "hud-player-level"],
  coins: ["player-coins", "hud-player-coins"]
});

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

function renderProfile(profile) {
  if (!profile) return;

  setText(ELEMENT_IDS.name, profile.display_name || profile.username || "Player");
  setText(ELEMENT_IDS.level, `Lv. ${Math.max(1, Number(profile.level) || 1)}`);
  setText(ELEMENT_IDS.coins, Math.max(0, Number(profile.coins) || 0).toLocaleString());
}

let started = false;
let unsubscribe = null;

export function syncProfileHUD() {
  const profile = profileManager.getProfile?.() || profileManager.profile || null;
  if (profile) renderProfile(profile);
  return profile;
}

export function initializeProfileHUD() {
  if (started) {
    syncProfileHUD();
    return;
  }

  started = true;
  syncProfileHUD();

  if (typeof profileManager.on === "function") {
    unsubscribe = profileManager.on("profile-updated", ({ profile }) => renderProfile(profile));
    if (!unsubscribe) {
      unsubscribe = profileManager.on("updated", ({ profile }) => renderProfile(profile));
    }
  }

  // ProfileManager already performs authentication synchronization.
  // Polling is intentionally lightweight and also covers managers without events.
  window.setInterval(syncProfileHUD, 1000);
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProfileHUD, { once: true });
  } else {
    initializeProfileHUD();
  }
}

export default initializeProfileHUD;
