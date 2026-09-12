import { profileManager } from "../api/profile.js";
import { gameState } from "../core/game-state.js";
import { missionsManager } from "./missions.js";

/**
 * AZAD WORLD
 * Progression System
 *
 * Mission rewards
 * XP
 * Coins
 * Level progression
 * Supabase profile synchronization
 */

class ProgressionManager {
    constructor() {
        this.initialized = false;
        this.pendingRewards = [];

        this.handleMissionCompleted =
            this.handleMissionCompleted.bind(this);

        this.handleAuthChange =
            this.handleAuthChange.bind(this);
    }

    initialize() {
        if (this.initialized) {
            return;
        }

        this.initialized = true;

        if (
            missionsManager &&
            typeof missionsManager.on === "function"
        ) {
            missionsManager.on(
                "missionCompleted",
                this.handleMissionCompleted
            );
        }

        if (
            profileManager &&
            typeof profileManager.on === "function"
        ) {
            profileManager.on(
                "authenticated",
                this.handleAuthChange
            );
        }

        this.syncProfileToGameState();
    }

    async handleMissionCompleted(payload = {}) {
        const mission = payload.mission || {};
        const rewards = payload.rewards || mission.rewards || {};

        const experience = Math.max(
            0,
            Number(rewards.experience || 0)
        );

        const coins = Math.max(
            0,
            Number(rewards.coins || 0)
        );

        if (experience <= 0 && coins <= 0) {
            return {
                success: true,
                experience: 0,
                coins: 0
            };
        }

        await this.awardRewards({
            experience,
            coins,
            reason: mission.id || mission.title || "mission"
        });
    }

    async awardRewards({
        experience = 0,
        coins = 0,
        reason = "gameplay"
    } = {}) {
        const xp = Math.max(0, Number(experience || 0));
        const coinAmount = Math.max(0, Number(coins || 0));

        if (xp <= 0 && coinAmount <= 0) {
            return {
                success: true,
                experience: 0,
                coins: 0
            };
        }

        const user =
            typeof profileManager.getCurrentUser === "function"
                ? await profileManager.getCurrentUser()
                : null;

        if (!user) {
            this.pendingRewards.push({
                experience: xp,
                coins: coinAmount,
                reason
            });

            this.applyLocalRewards(xp, coinAmount);

            return {
                success: false,
                pending: true,
                experience: xp,
                coins: coinAmount
            };
        }

        let xpResult = {
            success: true,
            profile: null
        };

        let coinResult = {
            success: true,
            profile: null
        };

        if (xp > 0) {
            xpResult =
                await profileManager.addExperience(xp);
        }

        if (coinAmount > 0) {
            coinResult =
                await profileManager.addCoins(coinAmount);
        }

        const profile =
            coinResult.profile ||
            xpResult.profile ||
            null;

        if (profile) {
            this.syncProfileToGameState(profile);
        }

        const result = {
            success:
                xpResult.success !== false &&
                coinResult.success !== false,
            experience: xp,
            coins: coinAmount,
            profile,
            reason,
            leveledUp:
                Boolean(xpResult.leveledUp),
            levelsGained:
                Number(xpResult.levelsGained || 0)
        };

        window.dispatchEvent(
            new CustomEvent("azad:progression-updated", {
                detail: result
            })
        );

        return result;
    }

    applyLocalRewards(experience, coins) {
        const currentXP =
            Number(gameState.get("player.experience") || 0);

        const currentCoins =
            Number(gameState.get("player.coins") || 0);

        gameState.set(
            "player.experience",
            currentXP + experience
        );

        gameState.set(
            "player.coins",
            currentCoins + coins
        );
    }

    syncProfileToGameState(profile = null) {
        if (!profile) {
            profile =
                typeof profileManager.getCachedProfile === "function"
                    ? profileManager.getCachedProfile()
                    : null;
        }

        if (!profile) {
            return;
        }

        if (profile.level != null) {
            gameState.set(
                "player.level",
                Number(profile.level)
            );
        }

        if (profile.experience != null) {
            gameState.set(
                "player.experience",
                Number(profile.experience)
            );
        }

        if (profile.coins != null) {
            gameState.set(
                "player.coins",
                Number(profile.coins)
            );
        }
    }

    async handleAuthChange() {
        this.syncProfileToGameState();
        await this.flushPendingRewards();
    }

    async flushPendingRewards() {
        if (!this.pendingRewards.length) {
            return;
        }

        const rewards = [...this.pendingRewards];
        this.pendingRewards.length = 0;

        for (const reward of rewards) {
            await this.awardRewards(reward);
        }
    }

    async awardExperience(amount, reason = "gameplay") {
        return this.awardRewards({
            experience: amount,
            coins: 0,
            reason
        });
    }

    async awardCoins(amount, reason = "gameplay") {
        return this.awardRewards({
            experience: 0,
            coins: amount,
            reason
        });
    }

    dispose() {
        if (
            missionsManager &&
            typeof missionsManager.off === "function"
        ) {
            missionsManager.off(
                "missionCompleted",
                this.handleMissionCompleted
            );
        }

        this.initialized = false;
        this.pendingRewards.length = 0;
    }
}

export const progressionManager =
    new ProgressionManager();

progressionManager.initialize();

export default progressionManager;
