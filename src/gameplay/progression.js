import "../core/renderer-loop-fix.js";
import { profileManager } from "../api/profile.js";
import { authManager } from "../api/auth.js";
import { gameState } from "../core/game-state.js";
import { missionManager } from "./missions.js";

/**
 * AZAD WORLD
 * Progression System
 *
 * Handles mission rewards, XP, coins, levels and profile sync.
 */

class ProgressionManager {
    constructor() {
        this.initialized = false;
        this.pendingRewards = [];
        this.authUnsubscribe = null;

        this.handleMissionCompleted = this.handleMissionCompleted.bind(this);
        this.handleAuthChange = this.handleAuthChange.bind(this);
    }

    initialize() {
        if (this.initialized) return;
        this.initialized = true;

        if (missionManager && typeof missionManager.on === "function") {
            missionManager.on("missionCompleted", this.handleMissionCompleted);
        }

        if (authManager && typeof authManager.onChange === "function") {
            this.authUnsubscribe = authManager.onChange(this.handleAuthChange);
        }

        this.syncProfileToGameState();
    }

    async handleMissionCompleted(payload = {}) {
        const mission = payload.mission || {};
        const rewards = payload.rewards || mission.rewards || {};

        return await this.awardRewards({
            experience: Math.max(0, Number(rewards.experience || 0)),
            coins: Math.max(0, Number(rewards.coins || 0)),
            reason: mission.id || mission.title || "mission"
        });
    }

    async awardRewards({ experience = 0, coins = 0, reason = "gameplay" } = {}) {
        const xp = Math.max(0, Number(experience || 0));
        const coinAmount = Math.max(0, Number(coins || 0));

        if (xp <= 0 && coinAmount <= 0) {
            return { ok: true, experience: 0, coins: 0 };
        }

        const user = authManager && typeof authManager.getUser === "function"
            ? await authManager.getUser()
            : null;

        if (!user) {
            this.pendingRewards.push({ experience: xp, coins: coinAmount, reason });
            this.applyLocalRewards(xp, coinAmount);
            return { ok: false, pending: true, experience: xp, coins: coinAmount };
        }

        let xpResult = { ok: true, data: null };
        let coinResult = { ok: true, data: null };

        if (xp > 0) xpResult = await profileManager.addExperience(xp);
        if (coinAmount > 0) coinResult = await profileManager.addCoins(coinAmount);

        const profile = coinResult.data || xpResult.data || profileManager.getCachedProfile();
        if (profile) this.syncProfileToGameState(profile);

        const result = {
            ok: xpResult.ok !== false && coinResult.ok !== false,
            experience: xp,
            coins: coinAmount,
            profile,
            reason
        };

        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("azad:progression-updated", { detail: result }));
        }

        return result;
    }

    applyLocalRewards(experience, coins) {
        gameState.set("player.experience", Number(gameState.get("player.experience") || 0) + experience);
        gameState.set("player.coins", Number(gameState.get("player.coins") || 0) + coins);
    }

    syncProfileToGameState(profile = null) {
        const current = profile || profileManager.getCachedProfile();
        if (!current) return;

        if (current.level != null) gameState.set("player.level", Number(current.level));
        if (current.experience != null) gameState.set("player.experience", Number(current.experience));
        if (current.coins != null) gameState.set("player.coins", Number(current.coins));
    }

    async handleAuthChange() {
        const profileResult = await profileManager.getProfile();
        if (profileResult?.ok && profileResult.data) {
            this.syncProfileToGameState(profileResult.data);
        }
        await this.flushPendingRewards();
    }

    async flushPendingRewards() {
        if (!this.pendingRewards.length) return;

        const rewards = [...this.pendingRewards];
        this.pendingRewards.length = 0;

        for (const reward of rewards) {
            await this.awardRewards(reward);
        }
    }

    async awardExperience(amount, reason = "gameplay") {
        return await this.awardRewards({ experience: amount, coins: 0, reason });
    }

    async awardCoins(amount, reason = "gameplay") {
        return await this.awardRewards({ experience: 0, coins: amount, reason });
    }

    dispose() {
        if (missionManager && typeof missionManager.off === "function") {
            missionManager.off("missionCompleted", this.handleMissionCompleted);
        }
        if (typeof this.authUnsubscribe === "function") this.authUnsubscribe();

        this.authUnsubscribe = null;
        this.initialized = false;
        this.pendingRewards.length = 0;
    }
}

export const progressionManager = new ProgressionManager();
progressionManager.initialize();

export default progressionManager;
