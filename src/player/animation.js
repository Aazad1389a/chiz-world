import * as THREE from "three";

import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { playerController } from "./controller.js";
import { player } from "./player.js";

/**
 * AZAD WORLD
 * Player Animation System
 *
 * مدیریت:
 * - Idle
 * - Walk
 * - Run
 * - Jump
 * - Fall
 * - Land
 * - Death
 * - انتقال نرم بین انیمیشن‌ها
 * - Animation Mixer
 * - Animation Clips
 * - Root Motion آماده
 * - Playback Speed
 * - Animation Events
 *
 * این سیستم به Player و PlayerController
 * متصل می‌شود و با مدل GLB/GLTF کار می‌کند.
 */

const DEFAULTS = {
    fadeDuration: 0.18,
    defaultSpeed: 1,
    runSpeedMultiplier: 1.15,
    walkSpeedMultiplier: 1,
    jumpSpeedMultiplier: 1,
    fallSpeedMultiplier: 1,

    maxDeltaTime: 0.05,

    idleThreshold: 0.1,
    walkThreshold: 0.75,

    useControllerState: true,
    autoPlay: true
};

/**
 * Clamp.
 */
function clamp(value, min, max) {
    return Math.max(
        min,
        Math.min(max, value)
    );
}

/**
 * Safe number.
 */
function number(value, fallback = 0) {
    return Number.isFinite(Number(value))
        ? Number(value)
        : fallback;
}

/**
 * Event emitter.
 */
function createEmitter() {
    const listeners = new Map();

    return {
        on(event, callback) {
            if (typeof callback !== "function") {
                return () => {};
            }

            if (!listeners.has(event)) {
                listeners.set(
                    event,
                    new Set()
                );
            }

            listeners
                .get(event)
                .add(callback);

            return () => {
                listeners
                    .get(event)
                    ?.delete(callback);
            };
        },

        off(event, callback) {
            listeners
                .get(event)
                ?.delete(callback);
        },

        emit(event, data) {
            const callbacks =
                listeners.get(event);

            if (!callbacks) {
                return;
            }

            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(
                        `[Animation] Event "${event}" error:`,
                        error
                    );
                }
            }
        },

        clear() {
            listeners.clear();
        }
    };
}

/**
 * Read nested config safely.
 */
function getConfigValue(
    path,
    fallback
) {
    try {
        let value = GAME_CONFIG;

        for (const key of path) {
            if (value == null) {
                return fallback;
            }

            value = value[key];
        }

        return value ?? fallback;
    } catch {
        return fallback;
    }
}

/**
 * Normalize animation name.
 */
function normalizeName(name) {
    return String(name ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
}

/**
 * Animation aliases.
 *
 * Different GLB models often use
 * different animation names.
 */
const ANIMATION_ALIASES = {
    idle: [
        "idle",
        "idle1",
        "stand",
        "standing",
        "breathing"
    ],

    walk: [
        "walk",
        "walking",
        "walkforward",
        "locomotionwalk"
    ],

    run: [
        "run",
        "running",
        "sprint",
        "sprinting",
        "locomotionrun"
    ],

    jump: [
        "jump",
        "jumpstart",
        "jumpup",
        "takeoff"
    ],

    fall: [
        "fall",
        "falling",
        "air",
        "airborne"
    ],

    land: [
        "land",
        "landing",
        "landed"
    ],

    death: [
        "death",
        "die",
        "dead",
        "knockout"
    ],

    crouch: [
        "crouch",
        "crouching",
        "duck"
    ],

    crouchWalk: [
        "crouchwalk",
        "crouchwalking"
    ],

    attack: [
        "attack",
        "attack1",
        "melee",
        "hit"
    ],

    reload: [
        "reload",
        "reloading"
    ],

    interact: [
        "interact",
        "interaction",
        "use"
    ]
};

/**
 * Animation states.
 */
const ANIMATION_STATES = Object.freeze({
    IDLE: "idle",
    WALK: "walk",
    RUN: "run",
    JUMP: "jump",
    FALL: "fall",
    LAND: "land",
    DEATH: "death",
    CROUCH: "crouch",
    CROUCH_WALK: "crouchWalk",
    ATTACK: "attack",
    RELOAD: "reload",
    INTERACT: "interact"
});

export class PlayerAnimation {
    constructor(options = {}) {
        this.options = options;

        this.config = {
            fadeDuration:
                options.fadeDuration ??
                getConfigValue(
                    ["animation", "fadeDuration"],
                    DEFAULTS.fadeDuration
                ),

            defaultSpeed:
                options.defaultSpeed ??
                DEFAULTS.defaultSpeed,

            runSpeedMultiplier:
                options.runSpeedMultiplier ??
                DEFAULTS.runSpeedMultiplier,

            walkSpeedMultiplier:
                options.walkSpeedMultiplier ??
                DEFAULTS.walkSpeedMultiplier,

            jumpSpeedMultiplier:
                options.jumpSpeedMultiplier ??
                DEFAULTS.jumpSpeedMultiplier,

            fallSpeedMultiplier:
                options.fallSpeedMultiplier ??
                DEFAULTS.fallSpeedMultiplier,

            maxDeltaTime:
                options.maxDeltaTime ??
                DEFAULTS.maxDeltaTime,

            idleThreshold:
                options.idleThreshold ??
                DEFAULTS.idleThreshold,

            walkThreshold:
                options.walkThreshold ??
                DEFAULTS.walkThreshold,

            useControllerState:
                options.useControllerState ??
                DEFAULTS.useControllerState,

            autoPlay:
                options.autoPlay ??
                DEFAULTS.autoPlay
        };

        /**
         * Three.js AnimationMixer.
         */
        this.mixer = null;

        /**
         * Model controlled by mixer.
         */
        this.root = null;

        /**
         * Animation clips.
         */
        this.clips = new Map();

        /**
         * Animation actions.
         */
        this.actions = new Map();

        /**
         * Resolved aliases.
         */
        this.resolved = new Map();

        /**
         * Current animation.
         */
        this.currentState =
            ANIMATION_STATES.IDLE;

        this.previousState = null;

        this.currentAction = null;

        /**
         * Playback.
         */
        this.globalSpeed =
            this.config.defaultSpeed;

        this.stateSpeed =
            this.config.defaultSpeed;

        /**
         * Manual state override.
         */
        this.manualState = null;

        this.manualStateTimeout = 0;

        /**
         * Initialization.
         */
        this.initialized = false;
        this.enabled = true;

        /**
         * Events.
         */
        this.emitter =
            createEmitter();

        /**
         * Last player state.
         */
        this.previousPlayerState = null;

        /**
         * Debug/statistics.
         */
        this.updateCount = 0;
        this.transitionCount = 0;

        /**
         * Root motion support.
         *
         * Disabled by default because
         * controller owns player movement.
         */
        this.rootMotionEnabled = false;

        this.rootMotion = {
            x: 0,
            y: 0,
            z: 0
        };
    }

    /**
     * Initialize animation system.
     */
    initialize(model = null) {
        if (this.initialized) {
            return this;
        }

        /**
         * Use supplied model or current
         * player model.
         */
        const animationRoot =
            model ??
            player.getModel();

        if (animationRoot) {
            this.setModel(
                animationRoot
            );
        }

        this.initialized = true;

        if (
            this.config.autoPlay &&
            this.actions.size
        ) {
            this.play(
                ANIMATION_STATES.IDLE,
                {
                    fade: 0
                }
            );
        }

        this.emitter.emit(
            "initialized",
            this.getSnapshot()
        );

        return this;
    }

    /**
     * Attach model.
     */
    setModel(model) {
        if (!model) {
            return false;
        }

        this.root = model;

        /**
         * Create mixer.
         */
        this.mixer =
            new THREE.AnimationMixer(
                model
            );

        /**
         * Try to read animations from
         * userData when available.
         */
        const animations =
            model.userData?.animations;

        if (
            Array.isArray(animations)
        ) {
            this.loadAnimations(
                animations
            );
        }

        this.emitter.emit(
            "modelSet",
            {
                model
            }
        );

        return true;
    }

    /**
     * Load animation clips.
     */
    loadAnimations(
        clips = []
    ) {
        if (!this.mixer) {
            if (!this.root) {
                return 0;
            }

            this.mixer =
                new THREE.AnimationMixer(
                    this.root
                );
        }

        if (!Array.isArray(clips)) {
            return 0;
        }

        for (const clip of clips) {
            this.addClip(clip);
        }

        this.resolveAliases();

        return this.clips.size;
    }

    /**
     * Add one animation clip.
     */
    addClip(clip) {
        if (!clip) {
            return false;
        }

        const name =
            clip.name ||
            `Animation_${this.clips.size}`;

        const action =
            this.mixer.clipAction(
                clip
            );

        action.enabled = true;

        action.setEffectiveWeight(0);

        action.setEffectiveTimeScale(
            this.globalSpeed
        );

        this.clips.set(
            name,
            clip
        );

        this.actions.set(
            name,
            action
        );

        /**
         * Listen for finished animations.
         */
        const finishedHandler =
            (event) => {
                if (
                    event.action === action
                ) {
                    this.emitter.emit(
                        "animationFinished",
                        {
                            name,
                            action,
                            clip
                        }
                    );
                }
            };

        /**
         * Mixer events are global, so
         * register once per action.
         */
        this.mixer.addEventListener(
            "finished",
            finishedHandler
        );

        this.mixer.addEventListener(
            "loop",
            (event) => {
                if (
                    event.action === action
                ) {
                    this.emitter.emit(
                        "animationLoop",
                        {
                            name,
                            action,
                            clip
                        }
                    );
                }
            }
        );

        this.emitter.emit(
            "clipAdded",
            {
                name,
                clip,
                action
            }
        );

        return true;
    }

    /**
     * Resolve aliases such as
     * "walking" -> walk.
     */
    resolveAliases() {
        this.resolved.clear();

        const normalizedActions =
            new Map();

        for (const [name, action] of this.actions) {
            normalizedActions.set(
                normalizeName(name),
                {
                    name,
                    action
                }
            );
        }

        for (
            const [state, aliases]
            of Object.entries(
                ANIMATION_ALIASES
            )
        ) {
            for (const alias of aliases) {
                const found =
                    normalizedActions.get(
                        normalizeName(
                            alias
                        )
                    );

                if (found) {
                    this.resolved.set(
                        state,
                        found
                    );

                    break;
                }
            }
        }

        return this.resolved;
    }

    /**
     * Find action by state.
     */
    getAction(state) {
        if (!state) {
            return null;
        }

        /**
         * First use resolved aliases.
         */
        const resolved =
            this.resolved.get(state);

        if (resolved) {
            return resolved.action;
        }

        /**
         * Direct action lookup.
         */
        const direct =
            this.actions.get(state);

        if (direct) {
            return direct;
        }

        /**
         * Normalized lookup.
         */
        const normalized =
            normalizeName(state);

        for (
            const [name, action]
            of this.actions
        ) {
            if (
                normalizeName(name) ===
                normalized
            ) {
                return action;
            }
        }

        return null;
    }

    /**
     * Get real clip name for state.
     */
    getResolvedName(state) {
        const resolved =
            this.resolved.get(state);

        return resolved?.name ?? null;
    }

    /**
     * Play state.
     */
    play(
        state,
        options = {}
    ) {
        const action =
            this.getAction(state);

        if (!action) {
            return false;
        }

        const fade =
            number(
                options.fade,
                this.config.fadeDuration
            );

        const loop =
            options.loop ??
            THREE.LoopRepeat;

        const repetitions =
            options.repetitions ??
            Infinity;

        const clampWhenFinished =
            options.clampWhenFinished ??
            false;

        const speed =
            number(
                options.speed,
                this.getStateSpeed(state)
            );

        /**
         * Same animation.
         */
        if (
            this.currentAction ===
            action &&
            this.currentState ===
            state
        ) {
            action.enabled = true;

            action.setEffectiveTimeScale(
                speed *
                    this.globalSpeed
            );

            return true;
        }

        /**
         * Fade old action.
         */
        if (this.currentAction) {
            this.currentAction.fadeOut(
                fade
            );
        }

        /**
         * Configure new action.
         */
        action.reset();

        action.enabled = true;

        action.setLoop(
            loop,
            repetitions
        );

        action.clampWhenFinished =
            clampWhenFinished;

        action.setEffectiveTimeScale(
            speed *
                this.globalSpeed
        );

        action.setEffectiveWeight(
            1
        );

        if (fade > 0) {
            action.fadeIn(
                fade
            );
        }

        action.play();

        this.previousState =
            this.currentState;

        this.currentState =
            state;

        this.currentAction =
            action;

        this.stateSpeed =
            speed;

        this.transitionCount++;

        this.emitter.emit(
            "stateChanged",
            {
                previous:
                    this.previousState,

                current:
                    this.currentState,

                action,

                speed
            }
        );

        return true;
    }

    /**
     * Play one-shot animation.
     */
    playOnce(
        state,
        options = {}
    ) {
        return this.play(
            state,
            {
                ...options,

                loop:
                    THREE.LoopOnce,

                repetitions: 1,

                clampWhenFinished:
                    true
            }
        );
    }

    /**
     * Stop current animation.
     */
    stop(
        fade =
            this.config.fadeDuration
    ) {
        if (!this.currentAction) {
            return;
        }

        if (fade > 0) {
            this.currentAction.fadeOut(
                fade
            );
        } else {
            this.currentAction.stop();
        }

        this.currentAction = null;

        this.emitter.emit(
            "stopped"
        );
    }

    /**
     * Determine animation from
     * PlayerController.
     */
    determineState() {
        if (
            !playerController ||
            !this.config.useControllerState
        ) {
            return ANIMATION_STATES.IDLE;
        }

        const state =
            playerController.getSnapshot();

        if (!state) {
            return ANIMATION_STATES.IDLE;
        }

        if (!state.alive) {
            return ANIMATION_STATES.DEATH;
        }

        /**
         * Air state.
         */
        if (!state.grounded) {
            if (
                state.velocity.y > 0.1
            ) {
                return ANIMATION_STATES.JUMP;
            }

            return ANIMATION_STATES.FALL;
        }

        /**
         * Horizontal speed.
         */
        const horizontalSpeed =
            Math.sqrt(
                state.velocity.x *
                    state.velocity.x +
                state.velocity.z *
                    state.velocity.z
            );

        if (
            horizontalSpeed <=
            this.config.idleThreshold
        ) {
            return ANIMATION_STATES.IDLE;
        }

        if (
            state.sprinting ||
            horizontalSpeed >=
                this.config.walkThreshold
        ) {
            return ANIMATION_STATES.RUN;
        }

        return ANIMATION_STATES.WALK;
    }

    /**
     * Automatic animation update.
     */
    updateStateAnimation() {
        /**
         * Manual animation has priority.
         */
        if (
            this.manualState
        ) {
            return;
        }

        const nextState =
            this.determineState();

        if (
            nextState ===
            this.currentState
        ) {
            return;
        }

        /**
         * Landing gets a short one-shot
         * animation if available.
         */
        if (
            nextState ===
            ANIMATION_STATES.IDLE &&
            this.currentState ===
                ANIMATION_STATES.FALL
        ) {
            const landed =
                this.getAction(
                    ANIMATION_STATES.LAND
                );

            if (landed) {
                this.playOnce(
                    ANIMATION_STATES.LAND,
                    {
                        fade:
                            this.config.fadeDuration,
                        speed: 1
                    }
                );

                return;
            }
        }

        const action =
            this.getAction(nextState);

        /**
         * If model doesn't contain the
         * requested animation, fallback.
         */
        if (!action) {
            if (
                nextState !==
                ANIMATION_STATES.IDLE
            ) {
                const idle =
                    this.getAction(
                        ANIMATION_STATES.IDLE
                    );

                if (idle) {
                    this.play(
                        ANIMATION_STATES.IDLE
                    );
                }
            }

            return;
        }

        this.play(nextState);
    }

    /**
     * Set manual state temporarily.
     */
    setManualState(
        state,
        duration = 0
    ) {
        this.manualState =
            state;

        this.manualStateTimeout =
            Math.max(
                0,
                number(duration)
            );

        this.play(
            state,
            {
                loop:
                    duration > 0
                        ? THREE.LoopOnce
                        : THREE.LoopRepeat,

                repetitions:
                    duration > 0
                        ? 1
                        : Infinity,

                clampWhenFinished:
                    duration > 0
            }
        );
    }

    /**
     * Clear manual override.
     */
    clearManualState() {
        this.manualState = null;
        this.manualStateTimeout = 0;
    }

    /**
     * State-specific speed.
     */
    getStateSpeed(state) {
        switch (state) {
            case ANIMATION_STATES.RUN:
                return (
                    this.config
                        .runSpeedMultiplier
                );

            case ANIMATION_STATES.WALK:
                return (
                    this.config
                        .walkSpeedMultiplier
                );

            case ANIMATION_STATES.JUMP:
                return (
                    this.config
                        .jumpSpeedMultiplier
                );

            case ANIMATION_STATES.FALL:
                return (
                    this.config
                        .fallSpeedMultiplier
                );

            default:
                return 1;
        }
    }

    /**
     * Set global playback speed.
     */
    setPlaybackSpeed(speed = 1) {
        this.globalSpeed =
            clamp(
                number(speed, 1),
                0.05,
                5
            );

        for (
            const action
            of this.actions.values()
        ) {
            action.setEffectiveTimeScale(
                this.globalSpeed
            );
        }

        return this.globalSpeed;
    }

    /**
     * Get current action.
     */
    getCurrentAction() {
        return this.currentAction;
    }

    /**
     * Get current state.
     */
    getCurrentState() {
        return this.currentState;
    }

    /**
     * Enable root motion.
     */
    setRootMotionEnabled(
        enabled
    ) {
        this.rootMotionEnabled =
            Boolean(enabled);
    }

    /**
     * Root motion extraction placeholder.
     *
     * The controller remains authoritative
     * unless root motion is explicitly
     * enabled.
     */
    extractRootMotion(deltaTime) {
        if (
            !this.rootMotionEnabled ||
            !this.currentAction
        ) {
            this.rootMotion.x = 0;
            this.rootMotion.y = 0;
            this.rootMotion.z = 0;

            return this.rootMotion;
        }

        /**
         * Kept intentionally conservative.
         * Real root-motion extraction depends
         * on the imported character rig.
         */
        this.rootMotion.x = 0;
        this.rootMotion.y = 0;
        this.rootMotion.z = 0;

        return this.rootMotion;
    }

    /**
     * Main update.
     */
    update(deltaTime = 1 / 60) {
        if (!this.initialized) {
            this.initialize();
        }

        if (!this.enabled) {
            return;
        }

        const dt =
            clamp(
                number(
                    deltaTime,
                    1 / 60
                ),
                0,
                this.config.maxDeltaTime
            );

        /**
         * Manual state timer.
         */
        if (
            this.manualState &&
            this.manualStateTimeout > 0
        ) {
            this.manualStateTimeout -=
                dt;

            if (
                this.manualStateTimeout <= 0
            ) {
                this.clearManualState();
            }
        }

        /**
         * Automatic state selection.
         */
        this.updateStateAnimation();

        /**
         * Update mixer.
         */
        if (this.mixer) {
            this.mixer.update(dt);
        }

        /**
         * Root motion.
         */
        this.extractRootMotion(dt);

        /**
         * Detect player state changes.
         */
        this.detectPlayerEvents();

        this.updateCount++;
    }

    /**
     * Detect player events.
     */
    detectPlayerEvents() {
        if (!playerController) {
            return;
        }

        const state =
            playerController.getSnapshot();

        if (!state) {
            return;
        }

        if (this.previousPlayerState) {
            if (
                !this.previousPlayerState.grounded &&
                state.grounded
            ) {
                this.emitter.emit(
                    "land",
                    state
                );
            }

            if (
                this.previousPlayerState.grounded &&
                !state.grounded
            ) {
                this.emitter.emit(
                    "jump",
                    state
                );
            }

            if (
                this.previousPlayerState.alive &&
                !state.alive
            ) {
                this.emitter.emit(
                    "death",
                    state
                );
            }

            if (
                !this.previousPlayerState.sprinting &&
                state.sprinting
            ) {
                this.emitter.emit(
                    "sprintStart",
                    state
                );
            }

            if (
                this.previousPlayerState.sprinting &&
                !state.sprinting
            ) {
                this.emitter.emit(
                    "sprintStop",
                    state
                );
            }
        }

        this.previousPlayerState = {
            ...state,

            position: {
                ...state.position
            },

            velocity: {
                ...state.velocity
            }
        };
    }

    /**
     * Add animation directly.
     */
    addAnimation(
        name,
        clip
    ) {
        if (!clip) {
            return false;
        }

        if (!this.mixer) {
            if (!this.root) {
                return false;
            }

            this.mixer =
                new THREE.AnimationMixer(
                    this.root
                );
        }

        if (name) {
            clip.name = name;
        }

        return this.addClip(
            clip
        );
    }

    /**
     * Remove animation.
     */
    removeAnimation(name) {
        const action =
            this.actions.get(name);

        if (!action) {
            return false;
        }

        action.stop();

        this.actions.delete(name);
        this.clips.delete(name);

        this.resolveAliases();

        if (
            this.currentAction ===
            action
        ) {
            this.currentAction = null;
            this.currentState =
                ANIMATION_STATES.IDLE;
        }

        return true;
    }

    /**
     * Check animation availability.
     */
    hasAnimation(state) {
        return Boolean(
            this.getAction(state)
        );
    }

    /**
     * Get available animations.
     */
    getAvailableAnimations() {
        return Array.from(
            this.actions.keys()
        );
    }

    /**
     * Get resolved animations.
     */
    getResolvedAnimations() {
        const result = {};

        for (
            const [state, data]
            of this.resolved
        ) {
            result[state] =
                data.name;
        }

        return result;
    }

    /**
     * Pause animation.
     */
    pause() {
        if (this.mixer) {
            this.mixer.timeScale = 0;
        }
    }

    /**
     * Resume animation.
     */
    resume() {
        if (this.mixer) {
            this.mixer.timeScale =
                1;
        }
    }

    /**
     * Reset mixer.
     */
    reset() {
        for (
            const action
            of this.actions.values()
        ) {
            action.stop();
            action.reset();
            action.setEffectiveWeight(0);
        }

        this.currentAction = null;

        this.currentState =
            ANIMATION_STATES.IDLE;

        this.previousState = null;
    }

    /**
     * Enable.
     */
    enable() {
        this.enabled = true;

        if (this.mixer) {
            this.mixer.timeScale = 1;
        }
    }

    /**
     * Disable.
     */
    disable() {
        this.enabled = false;

        if (this.mixer) {
            this.mixer.timeScale = 0;
        }
    }

    /**
     * Toggle.
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }

        return this.enabled;
    }

    /**
     * GameState synchronization.
     */
    syncState() {
        if (!gameState) {
            return;
        }

        gameState.update(
            "player",
            {
                animation:
                    this.currentState
            }
        );
    }

    /**
     * Snapshot.
     */
    getSnapshot() {
        return {
            initialized:
                this.initialized,

            enabled:
                this.enabled,

            currentState:
                this.currentState,

            previousState:
                this.previousState,

            currentAction:
                this.currentAction
                    ? this.currentAction
                        .getClip()
                        ?.name ?? null
                    : null,

            animationCount:
                this.actions.size,

            available:
                this.getAvailableAnimations(),

            resolved:
                this.getResolvedAnimations(),

            playbackSpeed:
                this.globalSpeed,

            manualState:
                this.manualState,

            rootMotionEnabled:
                this.rootMotionEnabled
        };
    }

    /**
     * Debug info.
     */
    getDebugInfo() {
        return {
            state:
                this.currentState,

            previous:
                this.previousState,

            currentAction:
                this.currentAction
                    ? this.currentAction
                        .getClip()
                        ?.name ?? null
                    : null,

            animations:
                this.actions.size,

            enabled:
                this.enabled,

            playbackSpeed:
                this.globalSpeed,

            manual:
                this.manualState,

            rootMotion:
                this.rootMotionEnabled,

            updates:
                this.updateCount,

            transitions:
                this.transitionCount
        };
    }

    /**
     * Events.
     */
    on(event, callback) {
        return this.emitter.on(
            event,
            callback
        );
    }

    off(event, callback) {
        this.emitter.off(
            event,
            callback
        );
    }

    /**
     * Cleanup.
     */
    dispose() {
        this.stop(0);

        if (this.mixer) {
            this.mixer.stopAllAction();
        }

        this.actions.clear();
        this.clips.clear();
        this.resolved.clear();

        this.mixer = null;
        this.root = null;

        this.currentAction = null;

        this.emitter.clear();

        this.initialized = false;
        this.enabled = false;
    }
}

/**
 * Singleton animation system.
 */
export const playerAnimation =
    new PlayerAnimation();

/**
 * Initialize helper.
 */
export function initializePlayerAnimation(
    model = null
) {
    return playerAnimation.initialize(
        model
    );
}

/**
 * Update helper.
 */
export function updatePlayerAnimation(
    deltaTime
) {
    playerAnimation.update(
        deltaTime
    );
}

/**
 * Get animation system.
 */
export function getPlayerAnimation() {
    return playerAnimation;
}

/**
 * Animation state constants.
 */
export {
    ANIMATION_STATES,
    ANIMATION_ALIASES
};

export default playerAnimation;
