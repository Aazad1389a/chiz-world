import {
  getSupabase,
  getCurrentUser,
  databaseSelect,
  databaseInsert,
  databaseUpdate
} from "./supabase.js";

/**
 * AZAD WORLD
 * Cloud Save System
 *
 * مسئول:
 * - ذخیره پیشرفت بازیکن در Cloud
 * - دریافت Save
 * - بروزرسانی Save
 * - حذف Save
 * - نگهداری نسخه Save
 */

const SAVE_VERSION = 1;

const DEFAULT_SAVE = {
  version: SAVE_VERSION,

  player: {
    level: 1,
    experience: 0,
    health: 100,
    stamina: 100
  },

  position: {
    x: 0,
    y: 1,
    z: 0
  },

  inventory: [],

  missions: [],

  settings: {
    graphics: "high",
    volume: 1,
    musicVolume: 1,
    sfxVolume: 1
  },

  world: {
    dayTime: 12,
    discoveredLocations: []
  },

  statistics: {
    playTime: 0,
    missionsCompleted: 0,
    distanceTravelled: 0
  }
};

function deepClone(object) {
  return JSON.parse(JSON.stringify(object));
}

export class CloudSaveManager {
  constructor() {
    this.supabase = getSupabase();

    this.currentSave = null;

    this.lastSavedAt = null;

    this.autoSaveEnabled = true;

    this.autoSaveInterval = 60000;

    this.autoSaveTimer = null;

    this.isSaving = false;
  }

  createDefaultSave() {
    return deepClone(DEFAULT_SAVE);
  }

  mergeSave(base, incoming) {
    if (!incoming || typeof incoming !== "object") {
      return deepClone(base);
    }

    const result = deepClone(base);

    const merge = (target, source) => {
      for (const key of Object.keys(source)) {
        const value = source[key];

        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          if (
            !target[key] ||
            typeof target[key] !== "object" ||
            Array.isArray(target[key])
          ) {
            target[key] = {};
          }

          merge(target[key], value);
        } else {
          target[key] = value;
        }
      }
    };

    merge(result, incoming);

    return result;
  }

  async loadSave() {
    if (!this.supabase) {
      const localSave = this.loadLocalSave();

      this.currentSave = localSave;

      return {
        ok: true,
        data: localSave,
        source: "local"
      };
    }

    try {
      const user = await getCurrentUser();

      if (!user) {
        const localSave = this.loadLocalSave();

        this.currentSave = localSave;

        return {
          ok: true,
          data: localSave,
          source: "local"
        };
      }

      const result = await databaseSelect(
        "game_saves",
        "*",
        {
          user_id: `eq.${user.id}`,
          limit: 1
        }
      );

      if (!result.ok) {
        return result;
      }

      const rows = result.data || [];

      if (rows.length === 0) {
        const newSave = this.createDefaultSave();

        this.currentSave = newSave;

        await this.saveToCloud(newSave);

        return {
          ok: true,
          data: newSave,
          source: "new"
        };
      }

      const cloudRow = rows[0];

      const saveData =
        cloudRow.save_data || this.createDefaultSave();

      this.currentSave =
        this.mergeSave(
          this.createDefaultSave(),
          saveData
        );

      this.lastSavedAt =
        cloudRow.updated_at || null;

      return {
        ok: true,
        data: this.currentSave,
        source: "cloud",
        updatedAt: this.lastSavedAt
      };

    } catch (error) {
      console.error(
        "[CloudSaveManager] loadSave:",
        error
      );

      const localSave = this.loadLocalSave();

      this.currentSave = localSave;

      return {
        ok: true,
        data: localSave,
        source: "local-fallback",
        error: error?.message
      };
    }
  }

  async saveToCloud(saveData = null) {
    if (!this.supabase) {
      return this.saveLocal(saveData);
    }

    if (this.isSaving) {
      return {
        ok: false,
        error: "A save operation is already running."
      };
    }

    this.isSaving = true;

    try {
      const user = await getCurrentUser();

      if (!user) {
        return this.saveLocal(saveData);
      }

      const finalSave =
        this.mergeSave(
          this.createDefaultSave(),
          saveData || this.currentSave
        );

      finalSave.version = SAVE_VERSION;

      const payload = {
        user_id: user.id,
        save_data: finalSave,
        updated_at: new Date().toISOString()
      };

      const existing = await databaseSelect(
        "game_saves",
        "id",
        {
          user_id: `eq.${user.id}`,
          limit: 1
        }
      );

      if (!existing.ok) {
        return existing;
      }

      let result;

      if ((existing.data || []).length === 0) {
        result = await databaseInsert(
          "game_saves",
          payload
        );
      } else {
        result = await databaseUpdate(
          "game_saves",
          {
            save_data: finalSave,
            updated_at: payload.updated_at
          },
          {
            user_id: `eq.${user.id}`
          }
        );
      }

      if (!result.ok) {
        return result;
      }

      this.currentSave = finalSave;

      this.lastSavedAt =
        payload.updated_at;

      this.saveLocal(finalSave);

      return {
        ok: true,
        data: finalSave,
        savedAt: this.lastSavedAt
      };

    } catch (error) {
      console.error(
        "[CloudSaveManager] saveToCloud:",
        error
      );

      return {
        ok: false,
        error:
          error?.message ||
          "Cloud save failed."
      };

    } finally {
      this.isSaving = false;
    }
  }

  async save(saveData = null) {
    const data =
      saveData ||
      this.currentSave ||
      this.createDefaultSave();

    this.currentSave = data;

    if (!this.supabase) {
      return this.saveLocal(data);
    }

    return await this.saveToCloud(data);
  }

  saveLocal(saveData = null) {
    try {
      const data =
        saveData ||
        this.currentSave ||
        this.createDefaultSave();

      localStorage.setItem(
        "azad_world_save",
        JSON.stringify(data)
      );

      this.currentSave = data;

      this.lastSavedAt =
        new Date().toISOString();

      return {
        ok: true,
        data,
        source: "local",
        savedAt: this.lastSavedAt
      };

    } catch (error) {
      console.error(
        "[CloudSaveManager] saveLocal:",
        error
      );

      return {
        ok: false,
        error:
          error?.message ||
          "Local save failed."
      };
    }
  }

  loadLocalSave() {
    try {
      const raw =
        localStorage.getItem(
          "azad_world_save"
        );

      if (!raw) {
        return this.createDefaultSave();
      }

      const parsed =
        JSON.parse(raw);

      return this.mergeSave(
        this.createDefaultSave(),
        parsed
      );

    } catch (error) {
      console.error(
        "[CloudSaveManager] loadLocalSave:",
        error
      );

      return this.createDefaultSave();
    }
  }

  async deleteCloudSave() {
    if (!this.supabase) {
      return {
        ok: false,
        error: "Supabase is not configured."
      };
    }

    try {
      const user =
        await getCurrentUser();

      if (!user) {
        return {
          ok: false,
          error: "User is not logged in."
        };
      }

      const { error } =
        await this.supabase
          .from("game_saves")
          .delete()
          .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      this.currentSave =
        this.createDefaultSave();

      localStorage.removeItem(
        "azad_world_save"
      );

      this.lastSavedAt = null;

      return {
        ok: true
      };

    } catch (error) {
      console.error(
        "[CloudSaveManager] deleteCloudSave:",
        error
      );

      return {
        ok: false,
        error:
          error?.message ||
          "Failed to delete cloud save."
      };
    }
  }

  getSave() {
    if (!this.currentSave) {
      this.currentSave =
        this.loadLocalSave();
    }

    return this.currentSave;
  }

  updateSave(path, value) {
    const save =
      this.getSave();

    const parts =
      String(path).split(".");

    let target = save;

    for (
      let i = 0;
      i < parts.length - 1;
      i++
    ) {
      const key = parts[i];

      if (
        !target[key] ||
        typeof target[key] !== "object"
      ) {
        target[key] = {};
      }

      target = target[key];
    }

    target[
      parts[parts.length - 1]
    ] = value;

    this.currentSave = save;

    return save;
  }

  getValue(path, fallback = null) {
    const save =
      this.getSave();

    const parts =
      String(path).split(".");

    let value = save;

    for (const part of parts) {
      if (
        value === null ||
        value === undefined
      ) {
        return fallback;
      }

      value = value[part];
    }

    return value === undefined
      ? fallback
      : value;
  }

  startAutoSave(interval = null) {
    this.stopAutoSave();

    if (interval !== null) {
      this.autoSaveInterval =
        Math.max(
          10000,
          Number(interval)
        );
    }

    this.autoSaveEnabled = true;

    this.autoSaveTimer =
      setInterval(
        async () => {
          if (
            !this.autoSaveEnabled ||
            this.isSaving
          ) {
            return;
          }

          await this.save();
        },
        this.autoSaveInterval
      );
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(
        this.autoSaveTimer
      );

      this.autoSaveTimer = null;
    }
  }

  setAutoSaveEnabled(enabled) {
    this.autoSaveEnabled =
      Boolean(enabled);

    if (this.autoSaveEnabled) {
      this.startAutoSave();
    } else {
      this.stopAutoSave();
    }
  }

  async forceSave() {
    return await this.save();
  }

  getLastSavedAt() {
    return this.lastSavedAt;
  }

  isCurrentlySaving() {
    return this.isSaving;
  }

  dispose() {
    this.stopAutoSave();
    this.currentSave = null;
  }
}

export const cloudSaveManager =
  new CloudSaveManager();

export default cloudSaveManager;
