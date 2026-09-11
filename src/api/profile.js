import {
  getSupabase,
  getCurrentUser,
  databaseSelect,
  databaseInsert,
  databaseUpdate
} from "./supabase.js";

/**
 * AZAD WORLD
 * Player Profile API
 *
 * مسئول:
 * - ساخت پروفایل بازیکن
 * - دریافت پروفایل
 * - بروزرسانی پروفایل
 * - ذخیره اطلاعات عمومی بازیکن
 */

export class ProfileManager {
  constructor() {
    this.supabase = getSupabase();
    this.profile = null;
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

      const profile = {
        id: user.id,

        username:
          data.username ||
          user.user_metadata?.username ||
          `Player_${user.id.slice(0, 8)}`,

        display_name:
          data.display_name ||
          user.user_metadata?.display_name ||
          "Player",

        avatar_url:
          data.avatar_url ||
          user.user_metadata?.avatar_url ||
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
          data.online === true,

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
        data: this.profile
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
        "avatar_url",
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

    const xpRequired =
      this.getXPRequired(currentLevel);

    let level = currentLevel;

    if (newXP >= xpRequired) {
      level += 1;
    }

    return await this.updateProfile({
      experience: newXP,
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
    const ua =
      navigator.userAgent.toLowerCase();

    if (
      /android/.test(ua)
    ) {
      return "android";
    }

    if (
      /iphone|ipad|ipod/.test(ua)
    ) {
      return "ios";
    }

    if (
      /windows/.test(ua)
    ) {
      return "windows";
    }

    if (
      /macintosh|mac os/.test(ua)
    ) {
      return "macos";
    }

    if (
      /linux/.test(ua)
    ) {
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
    const result =
      await this.getOrCreateProfile(defaultData);

    if (result.ok && result.data) {
      this.profile = result.data;
    }

    return result;
  }

  dispose() {
    this.profile = null;
  }
}

export const profileManager =
  new ProfileManager();

export default profileManager;
