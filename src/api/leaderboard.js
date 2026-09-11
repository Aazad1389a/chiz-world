import {
  getSupabase,
  getCurrentUser,
  databaseSelect
} from "./supabase.js";

/**
 * AZAD WORLD
 * Leaderboard System
 *
 * امکانات:
 * - دریافت رتبه‌بندی بازیکنان
 * - رتبه‌بندی بر اساس Level
 * - رتبه‌بندی بر اساس XP
 * - رتبه‌بندی بر اساس Coins
 * - پیدا کردن رتبه بازیکن فعلی
 * - جستجوی بازیکن
 * - دریافت Top Players
 */

export class LeaderboardManager {
  constructor() {
    this.supabase = getSupabase();

    this.cache = new Map();

    this.cacheDuration = 30000;

    this.currentPlayerRank = null;
  }

  getCacheKey(type, limit) {
    return `${type}:${limit}`;
  }

  isCacheValid(entry) {
    if (!entry) {
      return false;
    }

    return (
      Date.now() - entry.timestamp <
      this.cacheDuration
    );
  }

  async getLeaderboard(
    type = "level",
    limit = 100
  ) {
    if (!this.supabase) {
      return {
        ok: false,
        error: "Supabase is not configured."
      };
    }

    const safeLimit = Math.min(
      Math.max(Number(limit) || 100, 1),
      500
    );

    const cacheKey =
      this.getCacheKey(
        type,
        safeLimit
      );

    const cached =
      this.cache.get(cacheKey);

    if (this.isCacheValid(cached)) {
      return {
        ok: true,
        data: cached.data,
        cached: true
      };
    }

    const allowedTypes = {
      level: "level",
      experience: "experience",
      coins: "coins"
    };

    const orderColumn =
      allowedTypes[type] ||
      allowedTypes.level;

    try {
      const result =
        await databaseSelect(
          "profiles",
          `
            id,
            username,
            display_name,
            avatar_url,
            level,
            experience,
            coins,
            platform
          `,
          {
            order:
              `${orderColumn}.desc`,
            limit: safeLimit
          }
        );

      if (!result.ok) {
        return result;
      }

      const rows =
        (result.data || []).map(
          (player, index) => ({
            ...player,
            rank: index + 1
          })
        );

      this.cache.set(
        cacheKey,
        {
          data: rows,
          timestamp: Date.now()
        }
      );

      return {
        ok: true,
        data: rows,
        cached: false
      };

    } catch (error) {
      console.error(
        "[LeaderboardManager] getLeaderboard:",
        error
      );

      return {
        ok: false,
        error:
          error?.message ||
          "Failed to load leaderboard."
      };
    }
  }

  async getTopPlayers(
    limit = 10,
    type = "level"
  ) {
    return await this.getLeaderboard(
      type,
      limit
    );
  }

  async getPlayerRank(
    userId = null,
    type = "level"
  ) {
    if (!this.supabase) {
      return {
        ok: false,
        error: "Supabase is not configured."
      };
    }

    try {
      let playerId = userId;

      if (!playerId) {
        const user =
          await getCurrentUser();

        if (!user) {
          return {
            ok: false,
            error: "User is not logged in."
          };
        }

        playerId = user.id;
      }

      const leaderboard =
        await this.getLeaderboard(
          type,
          500
        );

      if (!leaderboard.ok) {
        return leaderboard;
      }

      const index =
        leaderboard.data.findIndex(
          (player) =>
            player.id === playerId
        );

      if (index === -1) {
        return {
          ok: true,
          data: {
            rank: null,
            player: null
          }
        };
      }

      const player =
        leaderboard.data[index];

      this.currentPlayerRank =
        index + 1;

      return {
        ok: true,
        data: {
          rank: index + 1,
          player
        }
      };

    } catch (error) {
      console.error(
        "[LeaderboardManager] getPlayerRank:",
        error
      );

      return {
        ok: false,
        error:
          error?.message ||
          "Failed to calculate player rank."
      };
    }
  }

  async getCurrentPlayerRank(
    type = "level"
  ) {
    return await this.getPlayerRank(
      null,
      type
    );
  }

  async searchPlayers(
    searchText,
    limit = 20
  ) {
    if (!this.supabase) {
      return {
        ok: false,
        error: "Supabase is not configured."
      };
    }

    const query =
      String(searchText || "")
        .trim();

    if (!query) {
      return {
        ok: true,
        data: []
      };
    }

    const safeLimit =
      Math.min(
        Math.max(
          Number(limit) || 20,
          1
        ),
        100
      );

    try {
      const result =
        await databaseSelect(
          "profiles",
          `
            id,
            username,
            display_name,
            avatar_url,
            level,
            experience,
            coins,
            platform
          `,
          {
            or:
              `username.ilike.%${query}%,display_name.ilike.%${query}%`,
            limit: safeLimit
          }
        );

      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        data: result.data || []
      };

    } catch (error) {
      console.error(
        "[LeaderboardManager] searchPlayers:",
        error
      );

      return {
        ok: false,
        error:
          error?.message ||
          "Player search failed."
      };
    }
  }

  async getNearbyPlayers(
    userId = null,
    range = 5,
    type = "level"
  ) {
    const rankResult =
      await this.getPlayerRank(
        userId,
        type
      );

    if (!rankResult.ok) {
      return rankResult;
    }

    const rank =
      rankResult.data.rank;

    if (!rank) {
      return {
        ok: true,
        data: []
      };
    }

    const start =
      Math.max(
        1,
        rank - range
      );

    const end =
      rank + range;

    const leaderboard =
      await this.getLeaderboard(
        type,
        end
      );

    if (!leaderboard.ok) {
      return leaderboard;
    }

    return {
      ok: true,
      data:
        leaderboard.data.filter(
          (player) =>
            player.rank >= start &&
            player.rank <= end
        )
    };
  }

  clearCache() {
    this.cache.clear();

    this.currentPlayerRank = null;
  }

  setCacheDuration(milliseconds) {
    this.cacheDuration =
      Math.max(
        5000,
        Number(milliseconds) || 30000
      );
  }

  getCachedLeaderboard(
    type = "level",
    limit = 100
  ) {
    const cacheKey =
      this.getCacheKey(
        type,
        limit
      );

    const cached =
      this.cache.get(cacheKey);

    if (
      !this.isCacheValid(cached)
    ) {
      return null;
    }

    return cached.data;
  }

  dispose() {
    this.clearCache();
  }
}

export const leaderboardManager =
  new LeaderboardManager();

export default leaderboardManager;
