import {
  getSupabase,
  getCurrentUser,
  databaseSelect,
  databaseInsert,
  databaseUpdate
} from "./supabase.js";

import { authManager } from "./auth.js";

/**
 * AZAD WORLD
 * Player Profile API
 *
 * مسئول:
 * - ساخت خودکار پروفایل بعد از ورود/ثبت‌نام
 * - دریافت پروفایل
 * - بروزرسانی پروفایل
 * - ذخیره اطلاعات عمومی بازیکن
 * - هماهنگ‌سازی وضعیت آنلاین
 */

export class ProfileManager {
  constructor() {
    this.supabase = getSupabase();
    this.profile = null;
    this.authUnsubscribe = null;
    this.initialized = false;
  }

  async getProfile(userId = null) {
    const supabase = this.supabase;

    if (!supabase) {
      return {
        ok: false,
        error: "Supabase is not configured."
      };
    }

    try {
      const user = await getCurrentUser();
      const id = userId || user?.id;

      if (!id) {
        return {
          ok: false,
          error: "User is not logged in."
        };
      }

      const result = await databaseSelect(
        "profiles",
        "*",
        {
          id: `eq.${id}`,
          limit: 1
        }
      );

      if (!result.ok) {
        return result;
      }

      const rows = result.data || [];

      if (rows.length === 0) {
        return {
          ok: true,
          data: null,
          exists: false
        };
      }

      this.profile = rows[0];

      return {
        ok: true,
        data: this.profile,
        exists: true
      };
    } catch (error) {
      console.error("[ProfileManager] getProfile:", error);

      return {
        ok: false,
        error: error?.message || "Failed to load profile."
      };
    }
  }

  async createProfile(data = {}) {
    const supabase = this.supabase;

    if (!supabase) {
      return {
        ok: false,
        error: "Supabase is not configured."
      };
    }

    try {
      const user = await getCurrentUser();

      if (!user) {
        return {
          ok: false,
          error: "User is not logged in."
        };
      }

      const metadata = user.user_metadata || {};

      const profile = {
        id: user.id,

        username:
          data.username ||
          metadata.username ||
          `Player_${user.id.slice(0, 8)}`,

        display_name:
          data.display_name ||
          metadata.display_name ||
          data.username ||
          metadata.username ||
          "Player",

        avatar:
          data.avatar ||
          metadata.avatar ||
          null,

        level:
          Number.isFinite(data.level)
            ? data.level
            : 1,

        experience:
          Number.isFinite(data.experience)
            ? data.experience
            : 0,

        coins:
          Number.isFinite(data.coins)
            ? data.coins
            : 0,

        online:
          data.online !== false,

        platform:
          data.platform ||
          this.detectPlatform(),

        last_seen:
          new Date().toISOString()
      };

      const result = await databaseInsert(
        "profiles",
        profile
      );

      if (!result.ok) {
        return result;
      }

      this.profile = Array.isArray(result.data)
        ? result.data[0]
        : result.data;

      return {
        ok: true,
        data: this.profile,
        created: true
      };
    } catch (error) {
      console.error("[ProfileManager] createProfile:", error);

      return {
        ok: false,
        error: error?.message || "Failed to create profile."
      };
    }
  }

  async getOrCreateProfile(data = {}) {
    const existing = await this.getProfile();

    if (!existing.ok) {
      return existing;
    }

    if (existing.exists && existing.data) {
      return existing;
    }

    return await this.createProfile(data);
  }

  async updateProfile(updates = {}) {
    const supabase = this.supabase;

    if (!supabase) {
      return {
        ok: false,
        error: "Supabase is not configured."
      };
    }

    try {
      const user = await getCurrentUser();

      if (!user) {
        return {
          ok: false,
          error: "User is not logged in."
        };
      }

      const allowedFields = [
        "username",
        "display_name",
        "avatar",
        "level",
        "experience",
        "coins",
        "online",
        "platform",
        "last_seen"
      ];

      const cleanUpdates = {};

      for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(updates, field)) {
          cleanUpdates[field] = updates[field];
        }
      }

      cleanUpdates.last_seen =
        new Date().toISOString();

      const result = await databaseUpdate(
        "profiles",
        cleanUpdates,
        {
          id: `eq.${user.id}`
        }
      );

      if (!result.ok) {
        return result;
      }

      this.profile = Array.isArray(result.data)
        ? result.data[0]
        : result.data;

      return {
        ok: true,
        data: this.profile
      };
    } catch (error) {
      console.error("[ProfileManager] updateProfile:", error);

      return {
        ok: false,
        error: error?.message || "Failed to update profile."
      };
    }
  }

  async setOnlineStatus(online) {
    return await this.updateProfile({
      online: Boolean(online),
      last_seen: new Date().toISOString()
    });
  }

  async syncAuthenticatedProfile() {
    try {
      const user = await getCurrentUser();

      if (!user) {
        this.clearCache();
        return {
          ok: true,
          data: null,
          authenticated: false
        };
      }

      const metadata = user.user_metadata || {};

      const result = await this.getOrCreateProfile({
        username: metadata.username,
        display_name: metadata.display_name,
        avatar: metadata.avatar,
        online: true,
        platform: this.detectPlatform()
      });

      if (!result.ok) {
        console.error(
          "[ProfileManager] Failed to sync authenticated profile:",
          result.error
        );
        return result;
      }

      if (result.data) {
        const updateResult = await this.updateProfile({
          online: true,
          platform: this.detectPlatform()
        });

        if (updateResult.ok) {
          this.profile = updateResult.data;
          return updateResult;
        }
      }

      return result;
    } catch (error) {
      console.error(
        "[ProfileManager] syncAuthenticatedProfile:",
        error
      );

      return {
        ok: false,
        error:
          error?.message ||
          "Failed to synchronize authenticated profile."
      };
    }
  }

  startAuthSync() {
    if (this.authUnsubscribe) {
      return this;
    }

    if (
      !authManager ||
      typeof authManager.onChange !== "function"
    ) {
      return this;
    }

    this.authUnsubscribe = authManager.onChange(
      async () => {
        const user = await getCurrentUser();

        if (user) {
          await this.syncAuthenticatedProfile();
        } else {
          this.clearCache();
        }
      }
    );

    return this;
  }

  async addExperience(amount) {
    const profileResult = await this.getProfile();

    if (!profileResult.ok) {
      return profileResult;
    }

    const profile = profileResult.data;

    if (!profile) {
      return {
        ok: false,
        error: "Profile does not exist."
      };
    }

    const currentXP =
      Number(profile.experience) || 0;

    const currentLevel =
      Number(profile.level) || 1;

    const newXP =
      Math.max(0, currentXP + Number(amount || 0));

    let level = currentLevel;
    let remainingXP = newXP;

    while (
      remainingXP >= this.getXPRequired(level)
    ) {
      remainingXP -= this.getXPRequired(level);
      level += 1;
    }

    return await this.updateProfile({
      experience: remainingXP,
      level
    });
  }

  async addCoins(amount) {
    const profileResult = await this.getProfile();

    if (!profileResult.ok) {
      return profileResult;
    }

    const profile = profileResult.data;

    if (!profile) {
      return {
        ok: false,
        error: "Profile does not exist."
      };
    }

    const currentCoins =
      Number(profile.coins) || 0;

    const newCoins =
      Math.max(
        0,
        currentCoins + Number(amount || 0)
      );

    return await this.updateProfile({
      coins: newCoins
    });
  }

  getXPRequired(level) {
    const safeLevel =
      Math.max(1, Number(level) || 1);

    return Math.floor(
      100 * Math.pow(safeLevel, 1.35)
    );
  }

  detectPlatform() {
    if (typeof navigator === "undefined") {
      return "unknown";
    }

    const ua =
      navigator.userAgent.toLowerCase();

    if (/android/.test(ua)) {
      return "android";
    }

    if (/iphone|ipad|ipod/.test(ua)) {
      return "ios";
    }

    if (/windows/.test(ua)) {
      return "windows";
    }

    if (/macintosh|mac os/.test(ua)) {
      return "macos";
    }

    if (/linux/.test(ua)) {
      return "linux";
    }

    return "unknown";
  }

  getCachedProfile() {
    return this.profile;
  }

  clearCache() {
    this.profile = null;
  }

  async initialize(defaultData = {}) {
    if (this.initialized) {
      return {
        ok: true,
        data: this.profile
      };
    }

    this.initialized = true;
    this.startAuthSync();

    const user = await getCurrentUser();

    if (!user) {
      return {
        ok: true,
        data: null,
        authenticated: false
      };
    }

    return await this.getOrCreateProfile({
      ...defaultData,
      username:
        defaultData.username ||
        user.user_metadata?.username,
      display_name:
        defaultData.display_name ||
        user.user_metadata?.display_name,
      online: true,
      platform:
        defaultData.platform ||
        this.detectPlatform()
    });
  }

  dispose() {
    if (typeof this.authUnsubscribe === "function") {
      this.authUnsubscribe();
    }

    this.authUnsubscribe = null;
    this.profile = null;
    this.initialized = false;
  }
}

export const profileManager =
  new ProfileManager();

/*
 * Start listening immediately so profile creation is connected
 * to authentication even when main.js has not initialized yet.
 */
profileManager.startAuthSync();

export default profileManager;
