// AZAD WORLD
// Mission & Objective System
// Path: src/gameplay/missions.js

import { GAME_CONFIG } from "../config/game-config.js";
import { GAME_GOALS } from "../config/game-goals.js";
import { gameState } from "../core/game-state.js";

const DEFAULT_CONFIG = {
    autoActivate: true,
    maxActiveMissions: 20,
    allowAbandon: true,
    saveProgress: true,
    emitEvents: true,
};

const MISSION_TYPES = Object.freeze({
    STORY: "story",
    MAIN: "main",
    SIDE: "side",
    DAILY: "daily",
    WEEKLY: "weekly",
    EVENT: "event",
    EXPLORATION: "exploration",
    COLLECTION: "collection",
    SOCIAL: "social",
    COMPETITION: "competition",
    CUSTOM: "custom",
});

const MISSION_STATUS = Object.freeze({
    LOCKED: "locked",
    AVAILABLE: "available",
    ACTIVE: "active",
    COMPLETED: "completed",
    FAILED: "failed",
    ABANDONED: "abandoned",
});

const OBJECTIVE_TYPES = Object.freeze({
    GENERIC: "generic",
    COLLECT: "collect",
    REACH: "reach",
    INTERACT: "interact",
    TALK: "talk",
    EXPLORE: "explore",
    SURVIVE: "survive",
    SCORE: "score",
    CUSTOM: "custom",
});

function clone(value) {
    if (value === undefined) return undefined;

    try {
        return structuredClone(value);
    } catch {
        return JSON.parse(JSON.stringify(value));
    }
}

function now() {
    return Date.now();
}

function createId(prefix = "id") {
    return `${prefix}_${now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}

function normalizeObjective(objective = {}) {
    const target = Math.max(
        1,
        normalizeNumber(objective.target, 1)
    );

    const progress = clamp(
        normalizeNumber(objective.progress, 0),
        0,
        target
    );

    return {
        id: objective.id || createId("objective"),
        type: objective.type || OBJECTIVE_TYPES.GENERIC,
        title: objective.title || "Objective",
        description: objective.description || "",
        target,
        progress,
        optional: Boolean(objective.optional),
        hidden: Boolean(objective.hidden),
        completed: progress >= target,
        failed: false,
        metadata: clone(objective.metadata || {}),
    };
}

function normalizeReward(reward = {}) {
    return {
        experience: Math.max(
            0,
            normalizeNumber(reward.experience, 0)
        ),
        coins: Math.max(
            0,
            normalizeNumber(reward.coins, 0)
        ),
        items: Array.isArray(reward.items)
            ? clone(reward.items)
            : [],
        custom: clone(reward.custom || {}),
    };
}

function normalizeMission(mission = {}) {
    const objectives = Array.isArray(mission.objectives)
        ? mission.objectives.map(normalizeObjective)
        : [];

    const status = mission.status || (
        mission.locked
            ? MISSION_STATUS.LOCKED
            : MISSION_STATUS.AVAILABLE
    );

    return {
        id: mission.id || createId("mission"),

        type: mission.type || MISSION_TYPES.SIDE,

        title: mission.title || "Unnamed Mission",

        description: mission.description || "",

        status,

        priority: normalizeNumber(mission.priority, 50),

        objectives,

        prerequisites: Array.isArray(mission.prerequisites)
            ? [...mission.prerequisites]
            : [],

        rewards: normalizeReward(mission.rewards),

        repeatable: Boolean(mission.repeatable),

        autoActivate:
            mission.autoActivate !== undefined
                ? Boolean(mission.autoActivate)
                : DEFAULT_CONFIG.autoActivate,

        hidden: Boolean(mission.hidden),

        levelRequirement: Math.max(
            0,
            normalizeNumber(mission.levelRequirement, 0)
        ),

        timeLimit: Math.max(
            0,
            normalizeNumber(mission.timeLimit, 0)
        ),

        metadata: clone(mission.metadata || {}),

        createdAt: mission.createdAt || now(),

        startedAt: mission.startedAt || null,

        completedAt: mission.completedAt || null,

        failedAt: mission.failedAt || null,

        abandonedAt: mission.abandonedAt || null,

        expiresAt: mission.expiresAt || null,

        completionCount: Math.max(
            0,
            normalizeNumber(mission.completionCount, 0)
        ),
    };
}

class MissionManager {
    constructor(config = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        };

        this.missions = new Map();

        this.activeMissions = new Set();

        this.completedMissions = new Set();

        this.failedMissions = new Set();

        this.listeners = new Map();

        this.initialized = false;
    }

    // --------------------------------------------------
    // EVENTS
    // --------------------------------------------------

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

    emit(event, payload = {}) {
        if (!this.config.emitEvents) return;

        const listeners = this.listeners.get(event);

        if (!listeners) return;

        for (const callback of listeners) {
            try {
                callback(payload);
            } catch (error) {
                console.error(
                    `[MissionManager] Event error: ${event}`,
                    error
                );
            }
        }
    }

    // --------------------------------------------------
    // INITIALIZATION
    // --------------------------------------------------

    initialize() {
        if (this.initialized) {
            return this;
        }

        this.initialized = true;

        this.emit("initialized", {
            missionCount: this.missions.size,
        });

        return this;
    }

    // --------------------------------------------------
    // REGISTER MISSIONS
    // --------------------------------------------------

    register(mission) {
        const normalized = normalizeMission(mission);

        this.missions.set(
            normalized.id,
            normalized
        );

        this.updateMissionStatus(normalized.id);

        this.emit("missionRegistered", {
            mission: clone(normalized),
        });

        return normalized;
    }

    registerMany(missions = []) {
        const results = [];

        for (const mission of missions) {
            results.push(this.register(mission));
        }

        return results;
    }

    unregister(missionId) {
        const mission = this.missions.get(missionId);

        if (!mission) {
            return false;
        }

        this.missions.delete(missionId);

        this.activeMissions.delete(missionId);
        this.completedMissions.delete(missionId);
        this.failedMissions.delete(missionId);

        this.emit("missionUnregistered", {
            missionId,
        });

        return true;
    }

    clear() {
        this.missions.clear();
        this.activeMissions.clear();
        this.completedMissions.clear();
        this.failedMissions.clear();

        this.emit("missionsCleared");
    }

    // --------------------------------------------------
    // GETTERS
    // --------------------------------------------------

    get(missionId) {
        return this.missions.get(missionId) || null;
    }

    getSnapshot(missionId) {
        const mission = this.get(missionId);

        return mission
            ? clone(mission)
            : null;
    }

    getAll(options = {}) {
        let missions = [...this.missions.values()];

        if (options.type) {
            missions = missions.filter(
                mission => mission.type === options.type
            );
        }

        if (options.status) {
            missions = missions.filter(
                mission => mission.status === options.status
            );
        }

        if (options.includeHidden !== true) {
            missions = missions.filter(
                mission => !mission.hidden
            );
        }

        missions.sort(
            (a, b) => b.priority - a.priority
        );

        return missions.map(clone);
    }

    getActive() {
        return [...this.activeMissions]
            .map(id => this.getSnapshot(id))
            .filter(Boolean);
    }

    getCompleted() {
        return [...this.completedMissions]
            .map(id => this.getSnapshot(id))
            .filter(Boolean);
    }

    getAvailable() {
        return this.getAll({
            status: MISSION_STATUS.AVAILABLE,
        });
    }

    // --------------------------------------------------
    // PREREQUISITES
    // --------------------------------------------------

    arePrerequisitesComplete(mission) {
        if (!mission.prerequisites.length) {
            return true;
        }

        return mission.prerequisites.every(
            prerequisiteId => {
                const prerequisite =
                    this.missions.get(prerequisiteId);

                return (
                    prerequisite &&
                    prerequisite.status ===
                        MISSION_STATUS.COMPLETED
                );
            }
        );
    }

    meetsLevelRequirement(mission) {
        const level =
            gameState.get("player.level") || 1;

        return level >= mission.levelRequirement;
    }

    canStart(missionId) {
        const mission = this.get(missionId);

        if (!mission) return false;

        if (
            mission.status === MISSION_STATUS.COMPLETED &&
            !mission.repeatable
        ) {
            return false;
        }

        if (
            mission.status === MISSION_STATUS.ACTIVE
        ) {
            return false;
        }

        if (
            !this.arePrerequisitesComplete(mission)
        ) {
            return false;
        }

        if (
            !this.meetsLevelRequirement(mission)
        ) {
            return false;
        }

        if (
            this.activeMissions.size >=
            this.config.maxActiveMissions
        ) {
            return false;
        }

        return true;
    }

    updateMissionStatus(missionId) {
        const mission = this.get(missionId);

        if (!mission) return null;

        if (
            mission.status === MISSION_STATUS.ACTIVE ||
            mission.status === MISSION_STATUS.COMPLETED ||
            mission.status === MISSION_STATUS.FAILED
        ) {
            return mission;
        }

        if (
            this.arePrerequisitesComplete(mission) &&
            this.meetsLevelRequirement(mission)
        ) {
            mission.status =
                MISSION_STATUS.AVAILABLE;
        } else {
            mission.status =
                MISSION_STATUS.LOCKED;
        }

        return mission;
    }

    updateAllStatuses() {
        for (const mission of this.missions.values()) {
            this.updateMissionStatus(mission.id);
        }
    }

    // --------------------------------------------------
    // START / ACTIVATE
    // --------------------------------------------------

    start(missionId) {
        const mission = this.get(missionId);

        if (!mission) {
            return {
                success: false,
                reason: "mission_not_found",
            };
        }

        if (!this.canStart(missionId)) {
            return {
                success: false,
                reason: "mission_cannot_start",
                mission: clone(mission),
            };
        }

        mission.status = MISSION_STATUS.ACTIVE;

        mission.startedAt = now();

        mission.completedAt = null;
        mission.failedAt = null;
        mission.abandonedAt = null;

        if (mission.timeLimit > 0) {
            mission.expiresAt =
                mission.startedAt +
                mission.timeLimit;
        }

        this.activeMissions.add(missionId);

        this.emit("missionStarted", {
            mission: clone(mission),
        });

        this.saveProgress();

        return {
            success: true,
            mission: clone(mission),
        };
    }

    activate(missionId) {
        return this.start(missionId);
    }

    // --------------------------------------------------
    // OBJECTIVES
    // --------------------------------------------------

    getObjective(missionId, objectiveId) {
        const mission = this.get(missionId);

        if (!mission) return null;

        return (
            mission.objectives.find(
                objective =>
                    objective.id === objectiveId
            ) || null
        );
    }

    updateObjective(
        missionId,
        objectiveId,
        progress,
        options = {}
    ) {
        const mission = this.get(missionId);

        if (!mission) {
            return {
                success: false,
                reason: "mission_not_found",
            };
        }

        const objective =
            this.getObjective(
                missionId,
                objectiveId
            );

        if (!objective) {
            return {
                success: false,
                reason: "objective_not_found",
            };
        }

        if (
            mission.status !==
            MISSION_STATUS.ACTIVE
        ) {
            return {
                success: false,
                reason: "mission_not_active",
            };
        }

        const oldProgress = objective.progress;

        if (options.add === true) {
            objective.progress +=
                normalizeNumber(progress, 0);
        } else {
            objective.progress =
                normalizeNumber(progress, 0);
        }

        objective.progress = clamp(
            objective.progress,
            0,
            objective.target
        );

        objective.completed =
            objective.progress >= objective.target;

        this.emit("objectiveUpdated", {
            missionId,
            objectiveId,
            oldProgress,
            progress: objective.progress,
            target: objective.target,
            completed: objective.completed,
        });

        if (objective.completed) {
            this.emit("objectiveCompleted", {
                missionId,
                objectiveId,
            });
        }

        this.checkMissionCompletion(missionId);

        this.saveProgress();

        return {
            success: true,
            objective: clone(objective),
        };
    }

    addObjectiveProgress(
        missionId,
        objectiveId,
        amount = 1
    ) {
        return this.updateObjective(
            missionId,
            objectiveId,
            amount,
            { add: true }
        );
    }

    completeObjective(
        missionId,
        objectiveId
    ) {
        const objective =
            this.getObjective(
                missionId,
                objectiveId
            );

        if (!objective) {
            return false;
        }

        this.updateObjective(
            missionId,
            objectiveId,
            objective.target
        );

        return true;
    }

    // --------------------------------------------------
    // MISSION COMPLETION
    // --------------------------------------------------

    areObjectivesComplete(mission) {
        const requiredObjectives =
            mission.objectives.filter(
                objective => !objective.optional
            );

        if (requiredObjectives.length === 0) {
            return true;
        }

        return requiredObjectives.every(
            objective => objective.completed
        );
    }

    checkMissionCompletion(missionId) {
        const mission = this.get(missionId);

        if (!mission) return false;

        if (
            mission.status !==
            MISSION_STATUS.ACTIVE
        ) {
            return false;
        }

        if (!this.areObjectivesComplete(mission)) {
            return false;
        }

        this.complete(missionId);

        return true;
    }

    complete(missionId) {
        const mission = this.get(missionId);

        if (!mission) {
            return {
                success: false,
                reason: "mission_not_found",
            };
        }

        if (
            mission.status ===
            MISSION_STATUS.COMPLETED
        ) {
            return {
                success: false,
                reason: "already_completed",
            };
        }

        mission.status =
            MISSION_STATUS.COMPLETED;

        mission.completedAt = now();

        mission.expiresAt = null;

        mission.completionCount += 1;

        this.activeMissions.delete(missionId);

        this.completedMissions.add(missionId);

        this.applyRewards(mission);

        this.emit("missionCompleted", {
            mission: clone(mission),
            rewards: clone(mission.rewards),
        });

        this.updateAllStatuses();

        this.saveProgress();

        return {
            success: true,
            mission: clone(mission),
            rewards: clone(mission.rewards),
        };
    }

    // --------------------------------------------------
    // FAIL / ABANDON
    // --------------------------------------------------

    fail(missionId, reason = "unknown") {
        const mission = this.get(missionId);

        if (!mission) {
            return {
                success: false,
                reason: "mission_not_found",
            };
        }

        mission.status =
            MISSION_STATUS.FAILED;

        mission.failedAt = now();

        mission.expiresAt = null;

        this.activeMissions.delete(missionId);

        this.failedMissions.add(missionId);

        this.emit("missionFailed", {
            mission: clone(mission),
            reason,
        });

        this.saveProgress();

        return {
            success: true,
            mission: clone(mission),
            reason,
        };
    }

    abandon(missionId) {
        if (!this.config.allowAbandon) {
            return {
                success: false,
                reason: "abandon_disabled",
            };
        }

        const mission = this.get(missionId);

        if (!mission) {
            return {
                success: false,
                reason: "mission_not_found",
            };
        }

        if (
            mission.status !==
            MISSION_STATUS.ACTIVE
        ) {
            return {
                success: false,
                reason: "mission_not_active",
            };
        }

        mission.status =
            MISSION_STATUS.ABANDONED;

        mission.abandonedAt = now();

        mission.expiresAt = null;

        this.activeMissions.delete(missionId);

        this.emit("missionAbandoned", {
            mission: clone(mission),
        });

        this.saveProgress();

        return {
            success: true,
            mission: clone(mission),
        };
    }

    // --------------------------------------------------
    // REPEATABLE MISSIONS
    // --------------------------------------------------

    resetRepeatableMission(missionId) {
        const mission = this.get(missionId);

        if (!mission) return false;

        if (!mission.repeatable) {
            return false;
        }

        for (const objective of mission.objectives) {
            objective.progress = 0;
            objective.completed = false;
            objective.failed = false;
        }

        mission.status =
            MISSION_STATUS.AVAILABLE;

        mission.startedAt = null;
        mission.completedAt = null;
        mission.failedAt = null;
        mission.abandonedAt = null;
        mission.expiresAt = null;

        this.activeMissions.delete(missionId);
        this.completedMissions.delete(missionId);
        this.failedMissions.delete(missionId);

        this.emit("missionReset", {
            mission: clone(mission),
        });

        this.saveProgress();

        return true;
    }

    // --------------------------------------------------
    // REWARDS
    // --------------------------------------------------

    applyRewards(mission) {
        const rewards = mission.rewards;

        if (!rewards) return;

        if (rewards.experience > 0) {
            const currentXP =
                gameState.get(
                    "player.experience"
                ) || 0;

            gameState.set(
                "player.experience",
                currentXP + rewards.experience
            );
        }

        if (rewards.coins > 0) {
            const currentCoins =
                gameState.get(
                    "player.coins"
                ) || 0;

            gameState.set(
                "player.coins",
                currentCoins + rewards.coins
            );
        }

        if (rewards.items.length > 0) {
            const inventory =
                gameState.get(
                    "inventory.items"
                ) || [];

            gameState.set(
                "inventory.items",
                [
                    ...inventory,
                    ...clone(rewards.items),
                ]
            );
        }

        this.emit("rewardsGranted", {
            missionId: mission.id,
            rewards: clone(rewards),
        });
    }

    // --------------------------------------------------
    // EVENT-BASED PROGRESS
    // --------------------------------------------------

    processEvent(
        eventType,
        eventData = {}
    ) {
        const updated = [];

        for (const mission of this.missions.values()) {
            if (
                mission.status !==
                MISSION_STATUS.ACTIVE
            ) {
                continue;
            }

            for (const objective of mission.objectives) {
                if (objective.completed) {
                    continue;
                }

                if (
                    objective.type !== eventType &&
                    objective.type !==
                        OBJECTIVE_TYPES.CUSTOM
                ) {
                    continue;
                }

                if (
                    objective.metadata.event &&
                    objective.metadata.event !==
                        eventType
                ) {
                    continue;
                }

                let amount =
                    normalizeNumber(
                        eventData.amount,
                        1
                    );

                if (
                    objective.metadata.targetId &&
                    objective.metadata.targetId !==
                        eventData.targetId
                ) {
                    continue;
                }

                const result =
                    this.addObjectiveProgress(
                        mission.id,
                        objective.id,
                        amount
                    );

                if (result.success) {
                    updated.push({
                        missionId: mission.id,
                        objectiveId: objective.id,
                        progress:
                            result.objective.progress,
                    });
                }
            }
        }

        return updated;
    }

    // --------------------------------------------------
    // TIME / EXPIRATION
    // --------------------------------------------------

    update(deltaTime = 0) {
        const currentTime = now();

        for (const mission of this.missions.values()) {
            if (
                mission.status !==
                MISSION_STATUS.ACTIVE
            ) {
                continue;
            }

            if (
                mission.expiresAt &&
                currentTime >= mission.expiresAt
            ) {
                this.fail(
                    mission.id,
                    "time_expired"
                );

                continue;
            }

            if (
                mission.timeLimit > 0 &&
                mission.startedAt
            ) {
                const elapsed =
                    currentTime -
                    mission.startedAt;

                if (
                    elapsed >= mission.timeLimit
                ) {
                    this.fail(
                        mission.id,
                        "time_expired"
                    );
                }
            }
        }
    }

    // --------------------------------------------------
    // SAVE / RESTORE
    // --------------------------------------------------

    getSaveData() {
        return {
            version: 1,

            missions: [...this.missions.values()]
                .map(clone),

            activeMissions:
                [...this.activeMissions],

            completedMissions:
                [...this.completedMissions],

            failedMissions:
                [...this.failedMissions],

            savedAt: now(),
        };
    }

    restoreSaveData(data = {}) {
        if (!data || !Array.isArray(data.missions)) {
            return false;
        }

        this.missions.clear();

        this.activeMissions.clear();

        this.completedMissions.clear();

        this.failedMissions.clear();

        for (const rawMission of data.missions) {
            const mission =
                normalizeMission(rawMission);

            this.missions.set(
                mission.id,
                mission
            );
        }

        if (Array.isArray(data.activeMissions)) {
            for (const id of data.activeMissions) {
                if (this.missions.has(id)) {
                    this.activeMissions.add(id);
                }
            }
        }

        if (Array.isArray(data.completedMissions)) {
            for (const id of data.completedMissions) {
                if (this.missions.has(id)) {
                    this.completedMissions.add(id);
                }
            }
        }

        if (Array.isArray(data.failedMissions)) {
            for (const id of data.failedMissions) {
                if (this.missions.has(id)) {
                    this.failedMissions.add(id);
                }
            }
        }

        this.emit("progressRestored", {
            missionCount: this.missions.size,
        });

        return true;
    }

    saveProgress() {
        if (!this.config.saveProgress) {
            return;
        }

        try {
            gameState.set(
                "mission.progress",
                this.getSaveData()
            );
        } catch (error) {
            console.warn(
                "[MissionManager] Could not save mission progress.",
                error
            );
        }
    }

    loadProgress() {
        try {
            const data =
                gameState.get(
                    "mission.progress"
                );

            if (data) {
                this.restoreSaveData(data);
            }
        } catch (error) {
            console.warn(
                "[MissionManager] Could not load mission progress.",
                error
            );
        }
    }

    // --------------------------------------------------
    // DEFAULT / GOAL INTEGRATION
    // --------------------------------------------------

    isMissionSystemEnabled() {
        return Boolean(
            GAME_GOALS?.missions?.enabled ??
            GAME_CONFIG?.features?.missions ??
            true
        );
    }

    // --------------------------------------------------
    // DEBUG / SNAPSHOT
    // --------------------------------------------------

    getSnapshot() {
        return {
            initialized: this.initialized,

            missionCount:
                this.missions.size,

            activeCount:
                this.activeMissions.size,

            completedCount:
                this.completedMissions.size,

            failedCount:
                this.failedMissions.size,

            activeMissions:
                this.getActive(),

            availableMissions:
                this.getAvailable(),
        };
    }

    debug() {
        return {
            ...this.getSnapshot(),

            config: clone(this.config),

            missions:
                [...this.missions.values()]
                    .map(clone),
        };
    }

    // --------------------------------------------------
    // DISPOSE
    // --------------------------------------------------

    dispose() {
        this.missions.clear();

        this.activeMissions.clear();

        this.completedMissions.clear();

        this.failedMissions.clear();

        this.listeners.clear();

        this.initialized = false;
    }
}

// --------------------------------------------------
// SINGLETON
// --------------------------------------------------

export const missionManager =
    new MissionManager();

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

export function initializeMissionManager(
    config = {}
) {
    if (Object.keys(config).length > 0) {
        missionManager.config = {
            ...missionManager.config,
            ...config,
        };
    }

    missionManager.initialize();

    missionManager.loadProgress();

    return missionManager;
}

export function registerMission(mission) {
    return missionManager.register(mission);
}

export function startMission(missionId) {
    return missionManager.start(missionId);
}

export function completeMission(missionId) {
    return missionManager.complete(missionId);
}

export function failMission(
    missionId,
    reason
) {
    return missionManager.fail(
        missionId,
        reason
    );
}

export function updateMissionObjective(
    missionId,
    objectiveId,
    progress,
    options
) {
    return missionManager.updateObjective(
        missionId,
        objectiveId,
        progress,
        options
    );
}

export function addMissionObjectiveProgress(
    missionId,
    objectiveId,
    amount
) {
    return missionManager.addObjectiveProgress(
        missionId,
        objectiveId,
        amount
    );
}

export function processMissionEvent(
    eventType,
    eventData
) {
    return missionManager.processEvent(
        eventType,
        eventData
    );
}

export function updateMissions(deltaTime) {
    return missionManager.update(deltaTime);
}

export function getMissionManager() {
    return missionManager;
}

export {
    MISSION_TYPES,
    MISSION_STATUS,
    OBJECTIVE_TYPES,
};

export default missionManager;
